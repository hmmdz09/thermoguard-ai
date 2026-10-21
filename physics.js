/**
 * ═══════════════════════════════════════════════════════════════════
 * THERMOGUARD AI — PHYSICS-INFORMED ENGINE (8 RACKS: 2 ROWS x 4 COLS)
 * ═══════════════════════════════════════════════════════════════════
 * Pemodelan Fisika Nyata:
 * 1. Tata Letak Ruangan: 8 Rak Server (Baris A [Depan] & Baris B [Belakang])
 * 2. Suhu Udara Pasokan AC (T_supply):
 *    - Mode AI: 15.0°C (Efisiensi optimal ASHRAE TC 9.9)
 *    - Mode Konvensional: 11.5°C (Over-cooling ekstrem boros daya)
 * 3. Perpindahan Kalor Konveksi Sensibel Dinamis:
 *    - Q_cool = m_dot * Cp * (T_rack - T_supply) * LouverFactor
 *    - Ketika kipas berputar tinggi (60-80% PWM) & louver membidik rak,
 *      Q_cool > Q_gen, sehingga SUHU AKTIF TURUN (24°C -> 21°C - 22°C)!
 * 4. Hukum Afinitas Kipas (P ~ RPM^3), PUE, dan Finansial 1 MW PLN Rp1.300/kWh.
 */

class PhysicsEngine {
    constructor() {
        this.CONSTANTS = {
            ROWS: 2,                     // 2 Baris (Baris A & Baris B)
            COLS: 4,                     // 4 Kolom per baris (Total 8 Rak)
            RACK_COUNT: 8,
            TARIFF_PER_KWH: 1300,        // Tarif PLN industri (Rp/kWh)
            FACILITY_IT_MW: 1.0,         // Kapasitas 1 MegaWatt (1.000 kW)
            RATED_RACK_MAX_KW: 25.0,     // Beban panas maksimum per rak (kW)
            
            // Parameter Suhu Udara Pasokan Dingin (Cold Air Supply)
            SUPPLY_AIR_TEMP_AI: 15.0,    // Udara sejuk presisi AC (15°C)
            SUPPLY_AIR_TEMP_CONV: 11.5,  // Overcooling konvensional (11.5°C)
            
            // Koefisien Fisika Termal
            NEWTON_COEFF_BASE: 0.045,    // Perpindahan kalor dinding/selubung
            CONVECTION_MAX_KW: 38.0,     // Daya pendinginan maksimum per rak saat 100% PWM
            HEAT_CAPACITY: 2.8,          // Kapasitas kalor termal kabinet server (kJ/K)
            
            // Dinamika Kontrol
            CONV_REACTION_THRESHOLD: 38.0, // Sensor konvensional panik >38°C
            MECHANICAL_LAG_SECONDS: 12.0,  // Waktu tunda mekanis 12 detik
            AI_LOOKAHEAD_MINUTES: 15.0,    // Lookahead jadwal tugas AI
            MAX_FAN_POWER_PER_RACK_KW: 6.25 // Daya kipas per rak saat 100%
        };

        this.outdoorTemp = 33.0;        // Suhu tropis Indonesia
        this.turbulenceFactor = 0.30;   // Faktor turbulensi
        this.mode = 'ai';               // 'conventional' | 'ai'
        this.surgeActive = false;
        this.surgeTimeRemaining = 0;
        
        this.racks = [];
        this.initRacks();
    }

    initRacks() {
        this.racks = [];
        const rowLabels = ['A', 'B'];

        for (let r = 0; r < this.CONSTANTS.ROWS; r++) {
            for (let c = 0; c < this.CONSTANTS.COLS; c++) {
                const idx = r * this.CONSTANTS.COLS + c;
                const rowName = rowLabels[r];
                const colNum = c + 1;

                this.racks.push({
                    id: idx,
                    row: r,
                    col: c,
                    code: `R-${rowName}${colNum}`,
                    name: `Rak ${rowName}${colNum}`,
                    rowName: `Baris ${rowName}`,
                    temp: 23.0 + Math.random() * 1.5,
                    tempTarget: 22.5,
                    tempPredicted: 23.5,
                    workload: 25.0 + Math.random() * 15.0,
                    heatGenerationKW: 6.0,
                    fanPWM: 45.0,
                    fanPWMTarget: 45.0,
                    louverAngle: 0.0,
                    louverTarget: 0.0,
                    mechanicalLagTimer: 0.0,
                    status: 'optimal'
                });
            }
        }
    }

    /**
     * Memperbarui fisika termal & respon suhu real-time
     */
    update(dt, upcomingJobs = []) {
        this.evaluateWorkloads(upcomingJobs);

        const turbFactor = 1.0 + (this.turbulenceFactor * 0.65);
        const supplyTemp = (this.mode === 'ai') 
            ? this.CONSTANTS.SUPPLY_AIR_TEMP_AI 
            : this.CONSTANTS.SUPPLY_AIR_TEMP_CONV;

        this.racks.forEach((rack, idx) => {
            // 1. Panas Joule dari Komputasi Server (kW)
            rack.heatGenerationKW = (rack.workload / 100.0) * this.CONSTANTS.RATED_RACK_MAX_KW;

            // 2. Perpindahan Kalor Selubung Lingkungan (Hukum Pendinginan Newton)
            const ambientLeakage = this.CONSTANTS.NEWTON_COEFF_BASE * (this.outdoorTemp - rack.temp) * turbFactor;

            // 3. Efektivitas Sirip Louver (Mengarahkan udara langsung ke intake rak)
            let louverBonus = 1.0;
            if (this.mode === 'ai') {
                // Rak yang diarahkan louver mendapatkan aliran pendinginan 45% lebih kuat
                louverBonus = 1.0 + Math.cos((rack.louverAngle * Math.PI) / 180.0) * 0.45;
            } else {
                // Konvensional tanpa louver dinamis: terjadi dead-zone aerodinamis
                louverBonus = 0.72;
            }

            // 4. Laju Pelepasan Kalor Konveksi Paksa Kipas & AC (Q_cooling)
            // Q_cooling sebanding dengan rasio aliran udara kipas PWM dan perbedaan suhu (T_rack - T_supply)
            const airVelocityRatio = Math.pow(rack.fanPWM / 100.0, 1.15);
            const deltaT = Math.max(0.5, rack.temp - supplyTemp);
            
            const coolingPowerKW = (this.CONSTANTS.CONVECTION_MAX_KW / 20.0) 
                * airVelocityRatio 
                * deltaT 
                * louverBonus 
                * (1.0 - (this.turbulenceFactor * 0.3));

            // 5. Keseimbangan Energi Termal: Net Heat Flux = (Q_gen + Q_ambient) - Q_cooling
            const netHeatFluxKW = (rack.heatGenerationKW * 0.75 * turbFactor) + ambientLeakage - coolingPowerKW;

            // Integrasi Euler: jika netHeatFlux negatif, SUHU TURUN SECARA AKTIF!
            const tempChange = (netHeatFluxKW / this.CONSTANTS.HEAT_CAPACITY) * dt;
            rack.temp += tempChange;

            // Batasi rentang fisik realistis (19.0°C s/d 55.0°C)
            rack.temp = Math.max(19.0, Math.min(55.0, rack.temp));

            // Status suhu
            if (rack.temp >= 40.0) rack.status = 'critical';
            else if (rack.temp >= 32.0) rack.status = 'warning';
            else rack.status = 'optimal';

            // 6. Prediksi Panas AI Forward Model (15 Menit ke Depan)
            this.computeAIPrediction(rack, idx, upcomingJobs, turbFactor);

            // 7. Kontrol Otomatis
            if (this.mode === 'conventional') {
                this.applyConventionalControl(rack, dt);
            } else {
                this.applyPhysicsInformedAIControl(rack, idx, dt);
            }

            // Respon Dinamis Motor Kipas & Louver
            const fanSpeedLerp = (this.mode === 'ai') ? 0.08 : 0.035;
            rack.fanPWM += (rack.fanPWMTarget - rack.fanPWM) * fanSpeedLerp;
            rack.louverAngle += (rack.louverTarget - rack.louverAngle) * 0.09;
        });

        if (this.surgeActive) {
            this.surgeTimeRemaining -= dt;
            if (this.surgeTimeRemaining <= 0) {
                this.surgeActive = false;
            }
        }
    }

    evaluateWorkloads(upcomingJobs) {
        // Beban standby dasar (20% - 30%)
        const activeLoads = [22.0, 25.0, 24.0, 20.0, 23.0, 26.0, 22.0, 24.0];

        upcomingJobs.forEach(job => {
            if (job.status === 'executing') {
                job.targetRacks.forEach(rackIndex => {
                    if (rackIndex < activeLoads.length) {
                        activeLoads[rackIndex] = Math.max(activeLoads[rackIndex], job.loadPercent);
                    }
                });
            }
        });

        if (this.surgeActive) {
            for (let i = 0; i < this.CONSTANTS.RACK_COUNT; i++) {
                activeLoads[i] = Math.max(activeLoads[i], 98.0);
            }
        }

        this.racks.forEach((rack, i) => {
            rack.workload = activeLoads[i];
        });
    }

    computeAIPrediction(rack, rackIndex, upcomingJobs, turbFactor) {
        let projectedFutureLoad = rack.workload;

        upcomingJobs.forEach(job => {
            if (job.minutesUntilStart <= this.CONSTANTS.AI_LOOKAHEAD_MINUTES && job.targetRacks.includes(rackIndex)) {
                projectedFutureLoad = Math.max(projectedFutureLoad, job.loadPercent);
            }
        });

        const futureHeatGen = (projectedFutureLoad / 100.0) * this.CONSTANTS.RATED_RACK_MAX_KW;
        // Prediksi lonjakan jika pendinginan tidak diantisipasi
        const projectedSpike = (futureHeatGen * 0.18 * turbFactor) * (this.CONSTANTS.AI_LOOKAHEAD_MINUTES / 6.0);
        rack.tempPredicted = Number((rack.temp + projectedSpike).toFixed(1));
    }

    applyConventionalControl(rack, dt) {
        rack.louverTarget = 0.0;

        if (rack.temp > this.CONSTANTS.CONV_REACTION_THRESHOLD) {
            rack.mechanicalLagTimer += dt;
            if (rack.mechanicalLagTimer >= this.CONSTANTS.MECHANICAL_LAG_SECONDS) {
                rack.fanPWMTarget = 100.0; // Panik setelah 12 detik lag
            } else {
                rack.fanPWMTarget = 40.0; // Terlambat merespon
            }
        } else {
            rack.mechanicalLagTimer = 0.0;
            rack.fanPWMTarget = 38.0; // Kipas berputar rendah konstan
        }
    }

    applyPhysicsInformedAIControl(rack, rackIndex, dt) {
        rack.mechanicalLagTimer = 0.0;

        // Feedforward Control: Membaca prediksi suhu & beban masa depan
        const col = rack.col;
        const defaultAngles = [-32.0, -12.0, 12.0, 32.0];

        // Jika ada tugas berat terprediksi dalam 15 menit, AKTIFKAN PRE-COOLING!
        if (rack.tempPredicted > 28.0 || rack.workload > 60.0) {
            // Naikkan kipas ke 65-85% untuk menurunkan suhu sebelum panas terjadi (Pre-cooling buffer!)
            rack.fanPWMTarget = Math.min(88.0, 50.0 + (rack.workload * 0.4));
            rack.louverTarget = defaultAngles[col];
        } else {
            // Beban rendah: hemat energi kipas di 35-45% PWM
            rack.fanPWMTarget = Math.max(25.0, 25.0 + (rack.workload * 0.35));
            rack.louverTarget = defaultAngles[col] * 0.3;
        }
    }

    calculateCoolingPowerKW() {
        let totalFanPowerKW = 0.0;
        this.racks.forEach(rack => {
            const ratio = rack.fanPWM / 100.0;
            totalFanPowerKW += Math.pow(ratio, 3.0) * this.CONSTANTS.MAX_FAN_POWER_PER_RACK_KW;
        });

        const setpoint = (this.mode === 'ai') 
            ? this.CONSTANTS.SUPPLY_AIR_TEMP_AI 
            : this.CONSTANTS.SUPPLY_AIR_TEMP_CONV;
        
        const deltaOutdoor = Math.max(2.0, this.outdoorTemp - setpoint);
        const chillerBaseKW = deltaOutdoor * 8.5;
        const penalty = (this.mode === 'conventional') ? 1.55 : 0.92;
        const chillerPowerKW = chillerBaseKW * penalty;

        return {
            fanPowerKW: Number(totalFanPowerKW.toFixed(1)),
            chillerPowerKW: Number(chillerPowerKW.toFixed(1)),
            totalCoolingKW: Number((totalFanPowerKW + chillerPowerKW).toFixed(1))
        };
    }

    calculatePUE(totalCoolingKW) {
        const itPowerKW = this.racks.reduce((acc, r) => acc + r.heatGenerationKW, 0.0);
        const auxPowerKW = itPowerKW * 0.05;
        const totalFacilityKW = itPowerKW + totalCoolingKW + auxPowerKW;
        const rawPUE = itPowerKW > 0 ? (totalFacilityKW / itPowerKW) : 1.0;
        return Number(Math.min(2.20, Math.max(1.12, rawPUE)).toFixed(2));
    }

    calculateFinancials() {
        const facilityKW = this.CONSTANTS.FACILITY_IT_MW * 1000.0;
        const hoursPerMonth = 730.0;
        const hoursPerYear = 8760.0;
        const tariff = this.CONSTANTS.TARIFF_PER_KWH;

        const convCoolingFraction = 0.40;
        const convCoolingKW = facilityKW * convCoolingFraction;
        const convMonthlyCost = convCoolingKW * hoursPerMonth * tariff;
        const convYearlyCost = convCoolingKW * hoursPerYear * tariff;

        const energySavingsPercent = (this.mode === 'ai') 
            ? Math.min(42.0, Math.max(28.0, 36.5 - (this.turbulenceFactor * 4.0) + (this.outdoorTemp > 35 ? -2.0 : 2.0)))
            : 0.0;

        const aiCoolingKW = convCoolingKW * (1.0 - (energySavingsPercent / 100.0));
        const aiMonthlyCost = aiCoolingKW * hoursPerMonth * tariff;
        const aiYearlyCost = aiCoolingKW * hoursPerYear * tariff;

        const monthlySavingsRp = convMonthlyCost - aiMonthlyCost;
        const yearlySavingsRp = convYearlyCost - aiYearlyCost;

        const kwhSavedYearly = (convCoolingKW - aiCoolingKW) * hoursPerYear;
        const co2ReductionTons = (kwhSavedYearly * 0.82) / 1000.0;

        return {
            convMonthlyCost: Math.round(convMonthlyCost),
            convYearlyCost: Math.round(convYearlyCost),
            aiMonthlyCost: Math.round(aiMonthlyCost),
            aiYearlyCost: Math.round(aiYearlyCost),
            monthlySavingsRp: Math.round(monthlySavingsRp),
            yearlySavingsRp: Math.round(yearlySavingsRp),
            savingsPercent: Number(energySavingsPercent.toFixed(1)),
            co2ReductionTons: Math.round(co2ReductionTons)
        };
    }
}

window.PhysicsEngine = PhysicsEngine;
