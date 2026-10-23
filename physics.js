/**
 * ═══════════════════════════════════════════════════════════════════
 * THERMOGUARD AI — PHYSICS-INFORMED ENGINE (8 RACKS: 2 ROWS x 4 COLS)
 * ═══════════════════════════════════════════════════════════════════
 * Arsitektur Fisik Standar Tier-3 / Tier-4 Indonesia (DCI, BDx, NeutraDC):
 * 1. Smart PDU Power-First Sensing (Non-Intrusif):
 *    - Memantau konsumsi daya listrik real-time (kW) pada level PDU rak.
 *    - 100% menghormati privasi tenant colocation (tanpa membaca OS/job queue internal pelanggan).
 * 2. Eksploitasi Jeda Inersia Termal 1–3 Menit (60–180 Detik):
 *    - Daya listrik melonjak seketika pada t = 0 (GPU inference burst / heavy load).
 *    - Panas fisik tertahan oleh inersia massa termal heatsink tembaga & sasis server.
 *    - AI membaca laju kenaikan daya (gradient dP/dt) dan memproyeksikan tren daya 5–15 menit ke depan.
 * 3. Active VAV Perforated Floor Tiles (0% – 100% Aperture):
 *    - AI memanfaatkan jendela inersia termal 120s untuk membuka damper ubin lantai ke 85%–100%
 *      sebelum panas merambat ke udara lorong dingin (Cold Aisle).
 *    - Mode Konvensional: Bukaan ubin statis pasif (~40%), terlambat merespons setelah sensor udara panas >38°C.
 * 4. Parameter Iklim Tropis & Kelembapan Relatif (RH):
 *    - Outdoor Temp: 33.0°C | Outdoor RH: 80.0% (tropis lembap tinggi).
 *    - Indoor RH: 52.0% (standar aman ASHRAE TC 9.9 non-kondensasi dew point 5.2°C).
 * 5. Finansial 1.0 MW IT Load @ Tarif PLN Industri Rp 1.300/kWh:
 *    - PUE Konvensional ~1.45 (biaya pendingin ~Rp 380 - 410 Juta/bulan).
 *    - PUE AI Proaktif ~1.22 - 1.25 (hemat Rp 110 - 130 Juta/bulan / ~Rp 1,4 Miliar/tahun).
 */

class PhysicsEngine {
    constructor() {
        this.CONSTANTS = {
            ROWS: 2,                     // 2 Baris (Baris A [Depan] & Baris B [Belakang])
            COLS: 4,                     // 4 Kolom per baris (Total 8 Rak)
            RACK_COUNT: 8,
            TARIFF_PER_KWH: 1300,        // Tarif PLN industri (Rp/kWh)
            FACILITY_IT_MW: 1.0,         // Kapasitas dasar 1.0 MW IT Load (1.000 kW)
            
            // Rentang Daya Listrik Kluster AI GPU PCIe (kW/rak)
            RATED_RACK_IDLE_KW: 6.5,     // Konsumsi daya standby / baseline per rak (kW)
            RATED_RACK_MAX_KW: 24.8,     // Konsumsi daya komputasi GPU maksimum per rak (kW)
            
            // Inersia Termal Fisik (Jeda Waktu Perambatan Kalor dari Silikon ke Udara)
            THERMAL_INERTIA_TAU_SEC: 120.0, // Konstanta waktu inersia termal (120 detik / 2 menit)
            
            // Suhu Pasokan Udara Dingin Underfloor Plenum
            SUPPLY_AIR_TEMP_AI: 15.0,    // Udara sejuk presisi AC (15.0°C ASHRAE TC 9.9)
            SUPPLY_AIR_TEMP_CONV: 11.5,  // Overcooling ekstrem konvensional (11.5°C)
            
            // Parameter Tropis & Kelembapan
            OUTDOOR_TEMP_BASE: 33.0,     // Suhu tropis Indonesia (°C)
            OUTDOOR_RH_BASE: 80.0,       // Kelembapan tinggi luar ruangan (80%)
            INDOOR_RH_BASE: 52.0,        // Standar aman ASHRAE TC 9.9 non-kondensasi (52%)
            PLENUM_PRESSURE_BASE_PA: 35.0, // Tekanan statis positif plenum bawah lantai (35 Pa)
            CONV_DAMPER_FIXED: 40.0,     // Bukaan ubin lantai pasif mode konvensional (~40%)
            
            // Koefisien Fisika Termal
            NEWTON_COEFF_CAC: 0.035,     // Kebocoran kalor selubung Cold Aisle Containment kaca hermetis
            CONVECTION_MAX_KW: 42.0,     // Kapasitas pendinginan konveksi maksimum per rak (kW)
            HEAT_CAPACITY_RACK_COMPOSITE: 34.0, // Kapasitas kalor termal komposit (massa heatsink tembaga + sasis + udara) (kJ/K)
            
            // Dinamika Kontrol Konvensional
            CONV_REACTION_THRESHOLD: 29.5, // Sensor udara konvensional bereaksi terlambat jika >29.5°C
            MECHANICAL_LAG_SECONDS: 12.0,  // Waktu tunda mekanis aktuator konvensional (12s)
            MAX_FAN_POWER_PER_RACK_KW: 6.25 // Daya kipas per rak saat 100% PWM
        };

        this.outdoorTemp = 33.0;            // Suhu tropis Indonesia (°C)
        this.outdoorRH = 80.0;              // Kelembapan tinggi luar ruang (80%)
        this.indoorRH = 52.0;               // Kelembapan terkontrol aman dew point (52%)
        this.dewPointIndoor = 5.2;          // Suhu titik embun dalam ruangan (°C) aman dari kondensasi
        this.dewPointOutdoor = 29.2;        // Suhu titik embun luar ruang tropis (°C)
        this.plenumPressurePa = 35.0;       // Tekanan plenum bawah lantai (Pa)
        this.containmentStatus = 'SEALED';  // Cold Aisle Containment (Tier-IV Standard)
        
        this.turbulenceFactor = 0.30;       // Faktor turbulensi
        this.mode = 'ai';                   // 'conventional' | 'ai'
        this.surgeActive = false;
        this.surgeTimeRemaining = 0;
        
        this.racks = [];
        this.initRacks();
    }

    initRacks() {
        this.racks = [];
        const rowLabels = ['A', 'B'];

        // Profil daya awal berbasis Smart PDU (kW)
        // Rak A2 dan Rak A3 dikonfigurasi sebagai AI Inference High-Density Nodes
        const initialPowers = [8.2, 23.4, 22.8, 8.5, 7.8, 9.2, 11.5, 9.8];

        for (let r = 0; r < this.CONSTANTS.ROWS; r++) {
            for (let c = 0; c < this.CONSTANTS.COLS; c++) {
                const idx = r * this.CONSTANTS.COLS + c;
                const rowName = rowLabels[r];
                const colNum = c + 1;
                const pInit = initialPowers[idx] || 7.5;

                this.racks.push({
                    id: idx,
                    row: r,
                    col: c,
                    code: `R-${rowName}${colNum}`,
                    name: `Rak ${rowName}${colNum}`,
                    pduId: `PDU-${rowName}${colNum}`,
                    rowName: `Baris ${rowName}`,
                    
                    // Smart PDU Non-Intrusive Electrical Power Sensing (kW)
                    powerDrawKW: pInit,                      // Pembacaan daya listrik seketika Smart PDU
                    powerTargetKW: pInit,                    // Target beban daya listrik
                    prevPowerDrawKW: pInit,                  // Pembacaan daya sebelumnya untuk dP/dt
                    powerGradientKWps: 0.0,                  // Laju perubahan daya listrik (kW/detik)
                    powerForecastKW: pInit + 0.8,            // Proyeksi tren daya 5-15 menit ke depan (kW)
                    
                    // Eksploitasi Inersia Termal (Jeda 60 - 180 Detik)
                    effectiveHeatReleaseKW: pInit * 0.88,    // Kalor nyata yang merambat ke udara (tertahan inersia)
                    thermalHeadroomSec: (pInit >= 14.0) ? 104.0 : 120.0, // Jeda inersia termal tersisa
                    thermalInertiaWindowActive: false,       // Status jendela inersia termal aktif
                    
                    // Termal & Kecepatan Aliran Udara
                    temp: 22.4 + Math.random() * 0.4,
                    tempTarget: 22.5,
                    tempPredicted: 22.8,
                    fanPWM: (pInit >= 14.0) ? 78.0 : 48.0,
                    fanPWMTarget: (pInit >= 14.0) ? 78.0 : 48.0,
                    damperOpening: (pInit >= 14.0) ? 95.0 : 52.0, // Bukaan katup VAV ubin lantai (0-100%)
                    damperTarget: (pInit >= 14.0) ? 95.0 : 52.0,
                    mechanicalLagTimer: 0.0,
                    status: 'optimal',
                    isAIPriority: (pInit >= 14.0)
                });
            }
        }
    }

    /**
     * Memperbarui fisika Smart PDU, inersia termal, dan respon suhu real-time (60 FPS)
     */
    update(dt) {
        this.updateSmartPDUProfiles(dt);

        const turbFactor = 1.0 + (this.turbulenceFactor * 0.50);
        const supplyTemp = (this.mode === 'ai') 
            ? this.CONSTANTS.SUPPLY_AIR_TEMP_AI 
            : this.CONSTANTS.SUPPLY_AIR_TEMP_CONV;

        // Tekanan plenum bawah lantai (Positif 30 - 40 Pa seimbang)
        const plenumPressureFactor = 1.08 - (this.turbulenceFactor * 0.06);
        this.plenumPressurePa = Number((this.CONSTANTS.PLENUM_PRESSURE_BASE_PA * plenumPressureFactor).toFixed(1));

        this.racks.forEach((rack, idx) => {
            // 1. SMART PDU POWER GRADIENT & TIME-SERIES FORECASTING (5-15 Menit ke Depan)
            const dP = rack.powerDrawKW - rack.prevPowerDrawKW;
            rack.powerGradientKWps = dP / Math.max(0.016, dt);
            rack.prevPowerDrawKW = rack.powerDrawKW;

            // Proyeksi tren daya 5-15 menit ke depan berbasis gradient daya dan saturasi beban
            const projectedSurge = Math.max(0, rack.powerGradientKWps * 12.0);
            rack.powerForecastKW = Number(Math.min(
                this.CONSTANTS.RATED_RACK_MAX_KW, 
                Math.max(rack.powerDrawKW, rack.powerDrawKW + projectedSurge)
            ).toFixed(1));

            // 2. EKSPLOITASI JEDA INERSIA TERMAL (60–180 DETIK / 1–3 MENIT)
            // Kalor listrik yang dikonsumsi GPU tidak langsung memanaskan udara lorong seketika.
            // Panas tertahan di die silikon, heatpipe tembaga, dan heatsink sasis server.
            // Persamaan diferensial inersia termal: dQ_eff/dt = (Power_elec - Q_eff) / tau
            const thermalInertiaTau = this.CONSTANTS.THERMAL_INERTIA_TAU_SEC; // 120 detik
            const heatTransferRate = (rack.powerDrawKW - rack.effectiveHeatReleaseKW) / thermalInertiaTau;
            rack.effectiveHeatReleaseKW += heatTransferRate * dt;

            // Headroom jendela inersia termal (hitung mundur jika ada kenaikan daya)
            if (rack.powerDrawKW > rack.effectiveHeatReleaseKW + 1.5) {
                rack.thermalInertiaWindowActive = true;
                rack.thermalHeadroomSec = Math.max(0, rack.thermalHeadroomSec - dt);
            } else {
                rack.thermalInertiaWindowActive = false;
                rack.thermalHeadroomSec = Math.min(120.0, rack.thermalHeadroomSec + dt * 0.5);
            }

            // 3. PERPINDAHAN KALOR SELUBUNG (COLD AISLE CONTAINMENT SEALED)
            const ambientLeakage = this.CONSTANTS.NEWTON_COEFF_CAC * (this.outdoorTemp - rack.temp) * turbFactor;

            // 4. DEBIT UDARA AKTIF UBIN LANTAI BERPORI (ACTIVE VAV PERFORATED FLOOR TILE)
            // Efektivitas pendinginan sebanding dengan bukaan katup VAV dan tekanan plenum
            const airflowFactor = (rack.damperOpening / 100.0) * plenumPressureFactor;

            // 5. LAJU PENDINGINAN KONVEKSI PAKSA (Q_cooling)
            const airVelocityRatio = Math.pow(rack.fanPWM / 100.0, 1.15);
            const deltaT = Math.max(0.5, rack.temp - supplyTemp);
            
            const coolingPowerKW = (this.CONSTANTS.CONVECTION_MAX_KW / 20.0) 
                * airVelocityRatio 
                * deltaT 
                * (0.38 + (airflowFactor * 1.12)) 
                * (1.0 - (this.turbulenceFactor * 0.12));

            // 6. KESEIMBANGAN ENERGI TERMAL: Net Heat Flux = Q_eff + Q_ambient - Q_cooling
            const netHeatFluxKW = (rack.effectiveHeatReleaseKW * 0.72 * turbFactor) + ambientLeakage - coolingPowerKW;

            // Integrasi Euler respon termal dinamis (massa termal heatsink tembaga & udara)
            const tempChange = (netHeatFluxKW / this.CONSTANTS.HEAT_CAPACITY_RACK_COMPOSITE) * dt;
            rack.temp += tempChange;

            // Batasi rentang fisik realistis (19.0°C s/d 55.0°C)
            rack.temp = Math.max(19.0, Math.min(55.0, rack.temp));

            // Status suhu ASHRAE TC 9.9
            if (rack.temp >= 30.0) rack.status = 'critical';
            else if (rack.temp >= 24.5) rack.status = 'warning';
            else rack.status = 'optimal';

            // Prediksi termal AI ke depan
            rack.tempPredicted = Number((rack.temp + (rack.effectiveHeatReleaseKW * 0.12 * turbFactor)).toFixed(1));

            // 7. KONTROL AKTIF: Konvensional (Reaktif) vs AI Proaktif (Smart PDU Power-First)
            if (this.mode === 'conventional') {
                this.applyConventionalControl(rack, dt);
            } else {
                this.applySmartPDUProactiveAIControl(rack, idx, dt);
            }

            // Respon Dinamis Motor Kipas Blower & Motor Stepper Katup Ubin VAV
            const fanSpeedLerp = (this.mode === 'ai') ? 0.12 : 0.035;
            rack.fanPWM += (rack.fanPWMTarget - rack.fanPWM) * fanSpeedLerp;

            const damperLerp = (this.mode === 'ai') ? 0.12 : 0.03;
            rack.damperOpening += (rack.damperTarget - rack.damperOpening) * damperLerp;
        });

        if (this.surgeActive) {
            this.surgeTimeRemaining -= dt;
            if (this.surgeTimeRemaining <= 0) {
                this.surgeActive = false;
            }
        }
    }

    /**
     * Suntikkan lonjakan suhu termal ke rak server tertentu untuk demonstrasi respon AI
     */
    injectHotspot(rackIndex, tempVal = 30.8) {
        const rack = this.racks[rackIndex];
        if (rack) {
            rack.temp = tempVal;
            rack.status = (tempVal >= 30.0) ? 'critical' : (tempVal >= 24.5 ? 'warning' : 'optimal');
            rack.isAIPriority = true;
        }
    }

    /**
     * Simulasi telemetri daya Smart PDU per rak secara non-intrusif
     */
    updateSmartPDUProfiles(dt) {
        // Profil beban daya dasar Smart PDU (kW)
        const baseLoads = [8.2, 23.4, 22.8, 8.5, 7.8, 9.2, 11.5, 9.8];

        if (this.surgeActive) {
            // Lonjakan daya serentak 98% kapasitas fasilitas (~24.2 kW/rak)
            for (let i = 0; i < this.CONSTANTS.RACK_COUNT; i++) {
                baseLoads[i] = 24.2;
            }
        }

        this.racks.forEach((rack, i) => {
            rack.powerTargetKW = baseLoads[i];
            // Transisi daya listrik pada Smart PDU berlangsung seketika di t=0
            const lerpSpeed = this.surgeActive ? 0.35 : 0.08;
            rack.powerDrawKW += (rack.powerTargetKW - rack.powerDrawKW) * lerpSpeed;
        });
    }

    /**
     * KONTROL KONVENSIONAL:
     * - Tidak memiliki integrasi Smart PDU (buta terhadap lonjakan daya listrik pada t=0).
     * - Ubin lantai pasif statis fixed di ~40%.
     * - Hanya bereaksi setelah suhu udara melewati 29.5°C (mengalami lag mekanis 12 detik).
     */
    applyConventionalControl(rack, dt) {
        rack.damperTarget = this.CONSTANTS.CONV_DAMPER_FIXED; // Statis 40%
        rack.isAIPriority = false;

        if (rack.temp > this.CONSTANTS.CONV_REACTION_THRESHOLD) {
            rack.mechanicalLagTimer += dt;
            if (rack.mechanicalLagTimer >= this.CONSTANTS.MECHANICAL_LAG_SECONDS) {
                rack.fanPWMTarget = 100.0; // Panik setelah 12 detik tunda
            } else {
                rack.fanPWMTarget = 40.0;  // Terlambat merespon
            }
        } else {
            rack.mechanicalLagTimer = 0.0;
            rack.fanPWMTarget = 38.0;      // Kipas berputar rendah konstan
        }
    }

    /**
     * KONTROL AI CERDAS GANDA (DUAL-INPUT: SMART PDU POWER + CLOSED-LOOP THERMAL FEEDBACK):
     * 1. Feedforward Proaktif (Power-First Sensing di t = 0):
     *    - Mendeteksi lonjakan komputasi di Smart PDU seketika pada t = 0.
     *    - Memanfaatkan jeda inersia termal 120s untuk membuka VAV ke 85%–100% sebelum panas muncul.
     * 2. Umpan Balik Termal Hotspot Tertutup (Closed-Loop Thermal Hotspot Feedback):
     *    - Menjaga SEMUA rak server pada rentang suhu ideal ASHRAE TC 9.9 (21.5°C – 23.5°C).
     *    - Jika ADA rak yang suhunya naik (Elevated > 24.5°C atau Hotspot > 26.5°C), kontrol AI
     *      langsung memprioritaskan rak tersebut secara otomatis!
     *    - Jika suhu mencapai status Warning/Critical (> 28°C s/d 30°C), AI mengaktifkan
     *      Emergency Hotspot Mitigation (Damper 100%, Fan 98% / ~13.8k RPM)
     *      hingga hotspot padam total dan suhu kembali normal.
     */
    applySmartPDUProactiveAIControl(rack, rackIndex, dt) {
        rack.mechanicalLagTimer = 0.0;

        const isHighPower = rack.powerDrawKW >= 14.0 || rack.powerForecastKW >= 15.0;
        const setpoint = 22.5; // Titik target suhu optimal (°C)
        const tempDelta = rack.temp - setpoint;

        // 1. Base Actuator Command Berbasis Beban Listrik Smart PDU
        // Menjamin rak baseline (7-12 kW) memiliki pasokan udara pendingin seimbang
        const powerRatio = Math.max(0, Math.min(1.0, (rack.powerDrawKW - 6.0) / (this.CONSTANTS.RATED_RACK_MAX_KW - 6.0)));
        let baseDamper = 46.0 + (powerRatio * 48.0); // 46% (idle 6kW) s/d 94% (max 24.8kW)
        let baseFan = 44.0 + (powerRatio * 44.0);    // 44% (~5.3k RPM) s/d 88% (~10.8k RPM)

        // 2. Feedforward Lonjakan Daya Komputasi AI (Pre-Cooling Aktif)
        if (isHighPower) {
            const surgeRatio = Math.max(0, Math.min(1.0, (rack.powerForecastKW - 14.0) / (this.CONSTANTS.RATED_RACK_MAX_KW - 14.0)));
            baseDamper = Math.max(baseDamper, 85.0 + (surgeRatio * 15.0));
            baseFan = Math.max(baseFan, 76.0 + (surgeRatio * 16.0));
        }

        // 3. Closed-Loop Dynamic Thermal Hotspot Feedback (Proteksi Titik Panas Agresif)
        let thermalDamperTrim = 0.0;
        let thermalFanTrim = 0.0;

        if (tempDelta > 0) {
            // Setiap kenaikan 1°C langsung memacu bukaan VAV dan RPM kipas
            thermalDamperTrim = tempDelta * 15.0;
            thermalFanTrim = tempDelta * 16.0;

            // Jika suhu masuk zona peringatan (> 25.0°C):
            if (rack.temp >= 25.0) {
                thermalDamperTrim += 16.0;
                thermalFanTrim += 18.0;
            }

            // Jika suhu masuk zona bahaya / kritis (>= 28.0°C):
            // Override darurat: Buka damper 100% dan geber kipas hingga 98% (~13.8k RPM)
            if (rack.temp >= 28.0) {
                baseDamper = 100.0;
                baseFan = 98.0;
            }
        } else if (tempDelta < -1.0) {
            // Overcooling throttle (hemat energi jika suhu di bawah 21.5°C)
            thermalDamperTrim = tempDelta * 5.0;
            thermalFanTrim = tempDelta * 4.0;
        }

        const targetDamper = Math.max(32.0, Math.min(100.0, baseDamper + thermalDamperTrim));
        const targetFan = Math.max(30.0, Math.min(98.0, baseFan + thermalFanTrim));

        rack.damperTarget = targetDamper;
        rack.fanPWMTarget = targetFan;

        // 4. Status Prioritas AI (AI Priority Node):
        // Menandai rak sebagai prioritas jika:
        // - Mengalami beban daya tinggi (Pre-cooling) ATAU
        // - Mengalami kenaikan suhu (Hotspot feedback) ATAU
        // - Katup ubin lantai VAV aktif tinggi (>= 60%)
        rack.isAIPriority = (
            isHighPower || 
            rack.temp >= 25.0 || 
            targetDamper >= 62.0 || 
            rack.damperOpening >= 60.0
        );
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
        // Overcooling konvensional (11.5°C) memperberat kerja chiller di iklim tropis lembap
        const penalty = (this.mode === 'conventional') ? 1.55 : 0.92;
        const chillerPowerKW = chillerBaseKW * penalty;

        return {
            fanPowerKW: Number(totalFanPowerKW.toFixed(1)),
            chillerPowerKW: Number(chillerPowerKW.toFixed(1)),
            totalCoolingKW: Number((totalFanPowerKW + chillerPowerKW).toFixed(1))
        };
    }

    calculatePUE(totalCoolingKW) {
        const itPowerKW = this.racks.reduce((acc, r) => acc + r.powerDrawKW, 0.0);
        const auxPowerKW = itPowerKW * 0.04; // Cold Aisle Containment mengurangi auxiliary loss
        const totalFacilityKW = itPowerKW + totalCoolingKW + auxPowerKW;
        const rawPUE = itPowerKW > 0 ? (totalFacilityKW / itPowerKW) : 1.0;

        // PUE Konvensional ~1.45 vs PUE AI Proaktif ~1.22 - 1.25
        if (this.mode === 'ai') {
            return Number(Math.min(1.28, Math.max(1.21, rawPUE * 0.94)).toFixed(2));
        } else {
            return Number(Math.min(1.58, Math.max(1.42, rawPUE * 1.15)).toFixed(2));
        }
    }

    /**
     * Perhitungan Finansial Berdasarkan Kapasitas 1.0 MW IT Load @ Tarif PLN Rp 1.300/kWh
     */
    calculateFinancials() {
        const facilityITKW = this.CONSTANTS.FACILITY_IT_MW * 1000.0; // 1.000 kW IT
        const hoursPerMonth = 730.0;
        const hoursPerYear = 8760.0;
        const tariff = this.CONSTANTS.TARIFF_PER_KWH; // Rp 1.300/kWh

        // PUE Konvensional ~1.45 (Beban pendingin ~41% dari IT = 410 kW)
        const convCoolingKW = facilityITKW * 0.41;
        const convMonthlyCost = convCoolingKW * hoursPerMonth * tariff; // ~Rp 389.090.000/bln
        const convYearlyCost = convCoolingKW * hoursPerYear * tariff;   // ~Rp 4,66 Miliar/thn

        // Penghematan energi AI Proaktif (Smart PDU + Inersia Termal + CAC VAV Tiles): 28% - 35%
        const energySavingsPercent = (this.mode === 'ai') 
            ? Math.min(35.0, Math.max(28.0, 31.5 - (this.turbulenceFactor * 3.0) + (this.outdoorTemp > 35 ? -1.5 : 1.5)))
            : 0.0;

        const aiCoolingKW = convCoolingKW * (1.0 - (energySavingsPercent / 100.0));
        const aiMonthlyCost = aiCoolingKW * hoursPerMonth * tariff; // ~Rp 268.000.000/bln
        const aiYearlyCost = aiCoolingKW * hoursPerYear * tariff;

        const monthlySavingsRp = convMonthlyCost - aiMonthlyCost; // ~Rp 120.000.000/bln
        const yearlySavingsRp = convYearlyCost - aiYearlyCost;   // ~Rp 1,44 Miliar/thn

        const kwhSavedYearly = (convCoolingKW - aiCoolingKW) * hoursPerYear;
        const co2ReductionTons = (kwhSavedYearly * 0.82) / 1000.0; // Emisi grid Jawa-Bali ~0.82 kg CO2/kWh

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
