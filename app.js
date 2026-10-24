/**
 * ═══════════════════════════════════════════════════════════════════
 * THERMOGUARD AI — LIGHT STUDIO INTERACTIVE SIMULATOR (8 RACKS)
 * ═══════════════════════════════════════════════════════════════════
 * Arsitektur Fisik Standar Tier-3 / Tier-4 Indonesia (DCI, BDx, NeutraDC):
 * - Palette: #181A1A (Charcoal), #AF6EFF (Lavender), #FFC46D (Amber), #A1E688 (Mint)
 * - Smart PDU Power-First Sensing: Deteksi lonjakan daya kW non-intrusif per rak (t = 0)
 * - Eksploitasi Jeda Inersia Termal (60–180 detik) & Prediksi Tren Daya 5–15 Menit (dP/dt)
 * - Cold Aisle Containment (CAC): Dinding kaca transparan hermetis mengisolasi lorong dingin
 * - Active VAV Perforated Floor Tiles: Katup kisi lantai bermotor (0% – 100% bukaan)
 * - Layout Presisi Bebas Tumpang Tindih (Zero Collision Layout)
 */

class ThermoGuardApp {
    constructor() {
        this.physics = new window.PhysicsEngine();

        this.canvas = document.getElementById('simulationCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvasWidth = 0;
        this.canvasHeight = 0;

        this.COLD_JET_COUNT = 150;
        this.HOT_PLUME_COUNT = 110;
        this.coldJets = [];
        this.hotPlumes = [];
        this.streamlines = [];

        this.showCFDStreamlines = true;
        this.showActiveTileBeams = true;
        this.selectedRackIndex = 1; // Default select Rak A2 (Target Pre-Cooling Smart PDU)

        // Telemetri Daya Smart PDU Real-time & Time-Series Forecast (Non-Intrusif)
        this.smartPDUFeeds = [
            {
                pduId: 'PDU-A1',
                rackIndex: 0,
                rackName: 'Rak A1 (Core API Gateway)',
                type: 'Baseline Compute',
                status: 'steady'
            },
            {
                pduId: 'PDU-A2',
                rackIndex: 1,
                rackName: 'Rak A2 (AI Inference Cluster)',
                type: 'GPU PCIe Inference',
                status: 'surge_target'
            },
            {
                pduId: 'PDU-A3',
                rackIndex: 2,
                rackName: 'Rak A3 (Deep Learning Node)',
                type: 'GPU Dense Node',
                status: 'surge_target'
            },
            {
                pduId: 'PDU-A4',
                rackIndex: 3,
                rackName: 'Rak A4 (Distributed Database)',
                type: 'High-IO Storage',
                status: 'steady'
            },
            {
                pduId: 'PDU-B1',
                rackIndex: 4,
                rackName: 'Rak B1 (Edge Microservices)',
                type: 'App Container',
                status: 'steady'
            },
            {
                pduId: 'PDU-B2',
                rackIndex: 5,
                rackName: 'Rak B2 (In-Memory Cache)',
                type: 'Memory Node',
                status: 'steady'
            },
            {
                pduId: 'PDU-B3',
                rackIndex: 6,
                rackName: 'Rak B3 (GPU Render Farm)',
                type: 'Scheduled Batch',
                status: 'forecast_trend'
            },
            {
                pduId: 'PDU-B4',
                rackIndex: 7,
                rackName: 'Rak B4 (GPU Analytics DB)',
                type: 'Scheduled Burst',
                status: 'forecast_trend'
            }
        ];

        this.simTimeSeconds = 0;
        this.lastTimestamp = 0;
        this.aiLogTimer = 0;
        this.telemetryIntervalTimer = 0;
        this.telemetryStep = 0;

        this.render = this.render.bind(this);
        this.handleResize = this.handleResize.bind(this);
    }

    init() {
        this.handleResize();
        window.addEventListener('resize', this.handleResize);

        this.initParticles();
        this.initStreamlines();
        this.setupEventListeners();
        this.initRackCarousel();
        this.updateSmartPDUTelemetryUI();
        this.updateMetricsUI();

        // Inisialisasi Log Awal Diagnostik DCIM & Smart PDU
        this.addStreamLog('SYSTEM_BOOT', 'stream-tag-purple', 'DCIM Engine terhubung ke 8 unit Rack PDU via Modbus-TCP (Polling 10ms).');
        this.addStreamLog('CAC_ENCLOSURE', 'stream-tag-blue', 'Cold Aisle Containment terisolasi Tier-IV: Tekanan statis plenum 35.0 Pa stabil.');
        this.addStreamLog('PINN_MODEL', 'stream-tag-purple', 'Physics-Informed Neural Network online: Jendela inersia termal 120s aktif.');
        this.addStreamLog('SMART_PDU', 'stream-tag-mint', 'Smart PDU Power Sensing aktif: 8 rak termonitor non-intrusif pada level PDU.');
        this.addStreamLog('VAV_ACTUATORS', 'stream-tag-mint', '8 motor aktuator VAV ubin berpori tersinkronisasi (Respon dinamik 0-100%).');

        requestAnimationFrame(this.render);
    }

    handleResize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvasWidth = rect.width;
        this.canvasHeight = 500;

        this.canvas.width = this.canvasWidth * dpr;
        this.canvas.height = this.canvasHeight * dpr;
        this.ctx.resetTransform();
        this.ctx.scale(dpr, dpr);
    }

    initParticles() {
        this.coldJets = [];
        this.hotPlumes = [];

        // 1. Inisialisasi 150 Partikel Cold Laminar Jets (Hanya menyembur dari ubin lantai)
        for (let i = 0; i < this.COLD_JET_COUNT; i++) {
            const priorityRacks = this.physics.racks.map((r, idx) => (r.isAIPriority || r.temp >= 25.0) ? idx : -1).filter(idx => idx !== -1);
            const rackIdx = (Math.random() < 0.60 && this.physics.mode === 'ai' && priorityRacks.length > 0) 
                ? priorityRacks[Math.floor(Math.random() * priorityRacks.length)] 
                : Math.floor(Math.random() * 8);
            this.coldJets.push(this.createColdJet(rackIdx, true));
        }

        // 2. Inisialisasi 110 Partikel Hot Aisle Thermal Exhaust Plumes (Keluar dari pembuangan sasis belakang)
        for (let i = 0; i < this.HOT_PLUME_COUNT; i++) {
            const rackIdx = Math.floor(Math.random() * 8);
            this.hotPlumes.push(this.createHotPlume(rackIdx, true));
        }
    }

    initStreamlines() {
        this.streamlines = [];
        for (let i = 0; i < 8; i++) {
            this.streamlines.push({
                lane: i,
                speed: 1.0 + Math.random() * 0.4
            });
        }
    }

    /**
     * Cold Laminar CFD Jet: Muncul HANYA dari ubin berpori dan bergerak terarah ke intake server
     */
    createColdJet(rackIdx, randomizeProgress = false) {
        const rack = this.physics.racks[rackIdx] || { damperOpening: 40 };
        const tCoord = this.getTileCoordinates(rackIdx);
        const isRowA = (rackIdx < 4);
        const damperRatio = rack.damperOpening / 100.0;
        const fanRatio = rack.fanPWM / 100.0;
        const isTarget = (this.physics.mode === 'ai' && (rack.isAIPriority || rack.temp >= 25.0 || rack.powerDrawKW >= 14.0));

        // Kecepatan semburan udara dingin langsung terhubung ke RPM kipas server & bukaan katup ubin
        const jetSpeed = 1.6 + (fanRatio * 4.4); // Kipas 40% -> 3.3 px/f, Kipas 98% -> 5.9 px/f!
        const baseVy = isRowA ? jetSpeed : -jetSpeed;
        const startY = isRowA ? (tCoord.y + tCoord.h - 1) : (tCoord.y + 1);
        const endY = isRowA ? 310 : 180;
        const progress = randomizeProgress ? Math.random() : 0;
        const currentY = startY + progress * (endY - startY);

        return {
            rackIndex: rackIdx,
            x: tCoord.x + 8 + Math.random() * (tCoord.w - 16),
            y: currentY,
            startY: startY,
            endY: endY,
            vx: (Math.random() - 0.5) * 0.15,
            vy: baseVy,
            length: 6 + damperRatio * 10,
            width: isTarget ? 2.5 : 1.8,
            alpha: 0.88,
            color: Math.random() < 0.65 ? '#A1E688' : '#38BDF8',
            isTarget: isTarget,
            isRowA: isRowA
        };
    }

    /**
     * Hot Aisle Thermal Exhaust Plume: Muncul di belakang rak keluar menuju plafon/lantai return
     */
    createHotPlume(rackIdx, randomizeProgress = false) {
        const rack = this.physics.racks[rackIdx] || { powerDrawKW: 8.0 };
        const rCoord = this.getRackCoordinates(rackIdx);
        const isRowA = (rackIdx < 4);
        const pwrRatio = Math.max(0, Math.min(1.0, rack.powerDrawKW / 24.8));

        const baseVy = isRowA ? (0.7 + pwrRatio * 0.7) : -(0.7 + pwrRatio * 0.7);
        const startY = isRowA ? (rCoord.y + rCoord.h - 2) : (rCoord.y + 2);
        const maxDist = 36;
        const progress = randomizeProgress ? Math.random() : 0;
        const currentY = startY + (isRowA ? progress * maxDist : -progress * maxDist);

        return {
            rackIndex: rackIdx,
            x: rCoord.x + 8 + Math.random() * (rCoord.w - 16),
            y: currentY,
            startY: startY,
            vx: (Math.random() - 0.5) * 0.35,
            vy: baseVy,
            radius: 3.0 + progress * 5.0,
            maxRadius: 8.0 + Math.random() * 4.0,
            alpha: Math.max(0, 0.28 * (1.0 - progress)),
            color: pwrRatio > 0.65 ? 'rgba(244, 63, 94, ' : 'rgba(255, 196, 109, ',
            life: Math.round(50 * (1.0 - progress)),
            maxLife: 50,
            isRowA: isRowA
        };
    }

    /**
     * TATA LETAK KOORDINAT RAK DENGAN PROPORSI SIMETRIS & BEBAS OVERLAP
     */
    getRackCoordinates(index) {
        const cw = this.canvasWidth;
        const col = index % 4; // 0, 1, 2, 3
        const row = Math.floor(index / 4); // 0 = Baris A (Depan / Bawah), 1 = Baris B (Belakang / Atas)

        const startX = 124;
        const totalAvailWidth = Math.max(260, cw - startX - 22);
        const colGap = totalAvailWidth / 4;

        const rw = Math.min(84, Math.max(54, colGap - 14));
        const x = startX + col * colGap + (colGap - rw) / 2;

        let y, h;
        if (row === 0) {
            // Baris A (Depan / Bawah): Di bawah lorong dingin CAC
            y = 310;
            h = 136;
        } else {
            // Baris B (Belakang / Atas): Di atas lorong dingin CAC
            y = 44;
            h = 136;
        }

        return { x, y, w: rw, h, row, col };
    }

    /**
     * TATA LETAK KOORDINAT UBIN BERPORI (PRESISI DI DEPAN INTAKE RAK)
     */
    getTileCoordinates(index) {
        const rCoord = this.getRackCoordinates(index);
        const isRowA = (index < 4);

        if (isRowA) {
            // Ubin Baris A: Berada di lorong dingin, tepat di atas sisi atas rak Baris A
            return {
                x: rCoord.x,
                y: 272,
                w: rCoord.w,
                h: 26,
                isRowA: true
            };
        } else {
            // Ubin Baris B: Berada di lorong dingin, tepat di bawah sisi bawah rak Baris B
            return {
                x: rCoord.x,
                y: 192,
                w: rCoord.w,
                h: 26,
                isRowA: false
            };
        }
    }

    setupEventListeners() {
        const btnConv = document.getElementById('modeBtnConv');
        const btnAI = document.getElementById('modeBtnAI');

        if (btnConv) btnConv.addEventListener('click', () => this.setMode('conventional'));
        if (btnAI) btnAI.addEventListener('click', () => this.setMode('ai'));

        const surgeBtn = document.getElementById('btnSimulateSurge');
        if (surgeBtn) surgeBtn.addEventListener('click', () => this.triggerLoadSurge());

        const hotspotBtn = document.getElementById('btnInjectHotspot');
        if (hotspotBtn) hotspotBtn.addEventListener('click', () => this.injectHotspotToSelectedRack());

        const outdoorSlider = document.getElementById('sliderOutdoorTemp');
        const outdoorDisplay = document.getElementById('displayOutdoorTemp');
        const headerOutdoor = document.getElementById('headerOutdoorTemp');
        if (outdoorSlider) {
            outdoorSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.physics.outdoorTemp = val;
                if (outdoorDisplay) outdoorDisplay.textContent = `${val.toFixed(0)}°C`;
                if (headerOutdoor) headerOutdoor.textContent = `${val.toFixed(0)}°C (80% RH)`;
            });
        }

        const turbSlider = document.getElementById('sliderTurbulence');
        const turbDisplay = document.getElementById('displayTurbulence');
        if (turbSlider) {
            turbSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.physics.turbulenceFactor = val;
                if (turbDisplay) turbDisplay.textContent = val.toFixed(2);
            });
        }

        const toggleVectorsBtn = document.getElementById('btnToggleAIVectors');
        if (toggleVectorsBtn) {
            toggleVectorsBtn.addEventListener('click', () => {
                this.showActiveTileBeams = !this.showActiveTileBeams;
                this.showCFDStreamlines = !this.showCFDStreamlines;
                toggleVectorsBtn.classList.toggle('bg-[#F4EDFF]', this.showActiveTileBeams);
                this.addStreamLog('VISUAL_FX', 'stream-tag-purple', `Active VAV Tiles CFD: ${this.showActiveTileBeams ? 'AKTIF' : 'NONAKTIF'}`);
            });
        }

        // Canvas Click Listener for Rack Selection
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            for (let i = 0; i < 8; i++) {
                const rCoord = this.getRackCoordinates(i);
                const tCoord = this.getTileCoordinates(i);
                if ((clickX >= rCoord.x && clickX <= rCoord.x + rCoord.w &&
                     clickY >= rCoord.y && clickY <= rCoord.y + rCoord.h) ||
                    (clickX >= tCoord.x && clickX <= tCoord.x + tCoord.w &&
                     clickY >= tCoord.y && clickY <= tCoord.y + tCoord.h)) {
                    this.selectRack(i);
                    break;
                }
            }
        });
    }

    setMode(newMode) {
        this.physics.mode = newMode;
        const btnConv = document.getElementById('modeBtnConv');
        const btnAI = document.getElementById('modeBtnAI');
        const badgeStatus = document.getElementById('badgeActiveStatus');

        if (newMode === 'ai') {
            if (btnAI) btnAI.className = 'mode-tab-btn active-ai';
            if (btnConv) btnConv.className = 'mode-tab-btn';
            if (badgeStatus) {
                badgeStatus.className = 'badge-mint';
                badgeStatus.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#123B0A] animate-ping"></span> Pre-Cooling Active`;
            }
            this.addStreamLog('MODE_CHANGE', 'stream-tag-mint', 'Mode B aktif: AI PINN membaca Smart PDU di t=0 & memanfaatkan jeda inersia termal 120s.');
        } else {
            if (btnConv) btnConv.className = 'mode-tab-btn active-conv';
            if (btnAI) btnAI.className = 'mode-tab-btn';
            if (badgeStatus) {
                badgeStatus.className = 'badge-amber';
                badgeStatus.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#4A2E05]"></span> Reaktif (Lag 12s)`;
            }
            this.addStreamLog('MODE_CHANGE', 'stream-tag-amber', 'Mode A aktif: Katup ubin lantai statis 40%, sistem konvensional menunggu sensor panas melewati 38°C.');
        }
    }

    triggerLoadSurge() {
        this.physics.surgeActive = true;
        this.physics.surgeTimeRemaining = 16.0;
        const surgeBtn = document.getElementById('btnSimulateSurge');
        if (surgeBtn) {
            surgeBtn.classList.add('pulsing');
            surgeBtn.innerHTML = `<span>⚠️</span><span>LONJAKAN PDU (24 kW/RAK)...</span>`;
            surgeBtn.disabled = true;
        }

        this.addStreamLog('SMART_PDU_SURGE', 'stream-tag-amber', 'Lonjakan daya 24.2 kW terdeteksi seketika di Smart PDU (t=0)! Jeda inersia termal 120s dimulai.');

        setTimeout(() => {
            if (surgeBtn) {
                surgeBtn.classList.remove('pulsing');
                surgeBtn.innerHTML = `<span>⚡</span><span>Simulasikan Lonjakan Daya Smart PDU (24 kW)</span>`;
                surgeBtn.disabled = false;
            }
            this.addStreamLog('SURGE_STABILIZED', 'stream-tag-mint', 'Daya listrik kembali normal. AI menstabilkan bukaan katup VAV ubin lantai.');
        }, 16000);
    }

    /**
     * UJI COBA RESPON HOTSPOT TERMAL:
     * Menyuntikkan lonjakan suhu instan (+8.5°C) pada rak yang dipilih agar pengguna
     * dapat menyaksikan respon AI Closed-Loop seketika menggeber kipas dan membuka VAV 100%.
     */
    injectHotspotToSelectedRack() {
        const targetIndex = (this.selectedRackIndex >= 0) ? this.selectedRackIndex : 6; // default Rak B3
        const rack = this.physics.racks[targetIndex];
        if (!rack) return;

        // Injeksi panas mendadak (+8.5°C) menjadi hotspot kritis ~31.0°C
        this.physics.injectHotspot(targetIndex, 31.0);

        this.addStreamLog('HOTSPOT_ALERT', 'stream-tag-amber', `🔥 HOTSPOT TERDETEKSI: ${rack.name} melonjak ke 31.0°C! AI seketika menggeber kipas ke ~13.8k RPM dan membuka VAV 100%!`);

        this.showNotification(
            `🔥 Hotspot Termal di ${rack.name}!`,
            `Suhu melonjak ke 31.0°C. AI Closed-Loop seketika menggeber kipas ke kecepatan maksimal (~13.8k RPM) dan membuka ubin VAV 100% untuk memadamkan panas!`
        );
    }

    showNotification(title, message) {
        const toast = document.getElementById('toastNotification');
        const titleEl = document.getElementById('toastTitle');
        const msgEl = document.getElementById('toastMessage');
        if (!toast || !titleEl || !msgEl) return;

        titleEl.textContent = title;
        msgEl.textContent = message;
        toast.classList.add('show');

        if (this._toastTimer) clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            toast.classList.remove('show');
        }, 4500);
    }

    addStreamLog(source, tagClass, message) {
        const logBox = document.getElementById('aiDecisionStream');
        if (!logBox) return;

        const timeNow = new Date().toLocaleTimeString('id-ID', { hour12: false });
        const line = document.createElement('div');
        line.className = 'stream-item animate-pop';
        line.innerHTML = `
            <span class="stream-time">[${timeNow}]</span>
            <span class="${tagClass}">${source}</span>
            <span class="stream-msg">${message}</span>
        `;
        logBox.prepend(line);
        logBox.scrollTop = 0;

        while (logBox.children.length > 35) {
            logBox.removeChild(logBox.lastChild);
        }
    }

    /**
     * PERIODIC REAL-TIME TELEMETRY LOG GENERATOR
     * Menghasilkan log telemetri hidup yang dinamis, kontekstual, dan bervariasi setiap ~3.2 detik
     * mencakup: PDU Sensing, VAV Tile Modulation, Inersia Termal, Kipas PWM, Audit ASHRAE, & PUE.
     */
    generatePeriodicTelemetryLog() {
        // Prioritas 1: Jika lonjakan daya surge sedang aktif
        if (this.physics.surgeActive) {
            const highRack = this.physics.racks.find(r => r.powerDrawKW >= 18.0) || this.physics.racks[1];
            this.addStreamLog(
                'SURGE_TRACK',
                'stream-tag-amber',
                `Lonjakan PDU ${highRack.name}: Daya ${highRack.powerDrawKW.toFixed(1)} kW (Beban GPU 100%). AI membuka katup VAV ${highRack.damperOpening.toFixed(0)}%!`
            );
            return;
        }

        // Prioritas 2: Jika ada hotspot suhu tinggi (temp >= 26.5°C)
        const hotRack = this.physics.racks.find(r => r.temp >= 26.5);
        if (hotRack) {
            this.addStreamLog(
                'HOTSPOT_DEFENSE',
                'stream-tag-rose',
                `Mitigasi Panas ${hotRack.name}: Suhu ${hotRack.temp.toFixed(1)}°C terdeteksi. Blower dinaikkan ke ${hotRack.fanPWM.toFixed(0)}% (~${Math.round(hotRack.fanPWM * 142)} RPM)!`
            );
            return;
        }

        // Rotasi Telemetri Standar (6 Jenis Event Siklis yang Relevan)
        const step = this.telemetryStep % 6;
        this.telemetryStep++;

        switch (step) {
            case 0: {
                // 1. SMART PDU POWER GRADIENT & FORECAST SENSING
                const targetIdx = (this.telemetryStep % 2 === 0) ? 1 : 2; // Fokus ke AI Inference Node Rak A2 / A3
                const rack = this.physics.racks[targetIdx];
                const gradSign = rack.powerGradientKWps >= 0 ? '+' : '';
                this.addStreamLog(
                    'PDU_SENSE',
                    'stream-tag-mint',
                    `Smart PDU ${rack.name}: ${rack.powerDrawKW.toFixed(1)} kW (${gradSign}${rack.powerGradientKWps.toFixed(2)} kW/s) • Proyeksi 10m: ${rack.powerForecastKW.toFixed(1)} kW.`
                );
                break;
            }
            case 1: {
                // 2. ACTIVE VAV PERFORATED FLOOR TILE MODULATION
                const rack = this.physics.racks[this.selectedRackIndex >= 0 ? this.selectedRackIndex : 1];
                if (this.physics.mode === 'ai') {
                    const cfm = Math.round(rack.damperOpening * 4.2);
                    this.addStreamLog(
                        'VAV_DAMPER',
                        'stream-tag-purple',
                        `VAV Tile ${rack.name} modulasi ke ${rack.damperOpening.toFixed(0)}% (~${cfm} CFM) • Mengisolasi Cold Aisle pada ${rack.tempTarget || 22.5}°C.`
                    );
                } else {
                    this.addStreamLog(
                        'VAV_DAMPER',
                        'stream-tag-amber',
                        `VAV Tile ${rack.name} terkunci statis 40.0% (Konvensional) • Pendinginan pasif tanpa kompensasi beban PDU.`
                    );
                }
                break;
            }
            case 2: {
                // 3. THERMAL INERTIA & HEATSINK HEADROOM
                const rack = this.physics.racks[1]; // Rak A2
                const headroom = rack.thermalHeadroomSec || 104;
                this.addStreamLog(
                    'THERMAL_LAG',
                    'stream-tag-amber',
                    `Inersia Massa Heatsink ${rack.name}: Sisa headroom ${headroom.toFixed(0)}s dieksploitasi untuk mitigasi pra-dingin.`
                );
                break;
            }
            case 3: {
                // 4. CHASSIS BLOWER SPEED & RPM MODULATION
                const rack = this.physics.racks[(this.telemetryStep + 2) % 8];
                const rpm = Math.round(rack.fanPWM * 142);
                this.addStreamLog(
                    'FAN_PWM',
                    'stream-tag-blue',
                    `Chassis Blower ${rack.name}: PWM ${rack.fanPWM.toFixed(0)}% (~${(rpm / 1000).toFixed(1)}k RPM) • Menjaga kesetimbangan termal sasis.`
                );
                break;
            }
            case 4: {
                // 5. ASHRAE TC 9.9 & ENVIRONMENTAL COMPLIANCE AUDIT
                const avgTemp = (this.physics.racks.reduce((acc, r) => acc + r.temp, 0) / 8).toFixed(1);
                this.addStreamLog(
                    'ASHRAE_AUDIT',
                    'stream-tag-mint',
                    `Audit Lingkungan CAC: Suhu rerata lorong dingin ${avgTemp}°C | Plenum ${this.physics.plenumPressurePa} Pa | RH ${this.physics.indoorRH.toFixed(0)}% (Standar A1 Safe).`
                );
                break;
            }
            case 5: {
                // 6. ENERGY EFFICIENCY & PUE TRACKING
                const isAI = (this.physics.mode === 'ai');
                const pue = isAI ? '1.24' : '1.45';
                const tag = isAI ? 'stream-tag-mint' : 'stream-tag-amber';
                const desc = isAI 
                    ? 'PUE Efisien 1.24 • Penghematan kompresor pendingin 31.4% (Pre-Cooling aktif).' 
                    : 'PUE Boros 1.45 • Terjadi overcooling berlebih pada suplai udara 11.5°C.';
                this.addStreamLog('ENERGY_PUE', tag, `Efisiensi Energi: ${desc}`);
                break;
            }
        }
    }

    initRackCarousel() {
        const container = document.getElementById('rackCarouselContainer');
        if (!container) return;

        let html = '';
        for (let i = 0; i < 8; i++) {
            const rack = this.physics.racks[i];
            const isSelected = (i === this.selectedRackIndex);
            const isTarget = (this.physics.mode === 'ai' && (rack.isAIPriority || rack.temp >= 25.0 || rack.powerDrawKW >= 14.0));
            const pwrRatio = Math.min(100, Math.max(15, (rack.powerDrawKW / 24.8) * 100));

            const priorityBadge = (rack.temp >= 26.5) 
                ? `<span class="text-[9px] font-extrabold text-[#9F1239] bg-[#FFE4E6] px-1.5 py-0.5 rounded">HOTSPOT VAV ${rack.damperOpening.toFixed(0)}%</span>`
                : (isTarget ? `<span class="text-[9px] font-extrabold text-[#123B0A] bg-[#A1E688] px-1.5 py-0.5 rounded">VAV ${rack.damperOpening.toFixed(0)}%</span>` : `<span class="text-[9px] text-[#7A8293] font-mono">${rack.pduId}</span>`);

            html += `
                <div id="carouselCard-${i}" class="rack-thumb-card ${isSelected ? 'selected' : ''}" onclick="window.app.selectRack(${i})">
                    <div class="flex items-center justify-between mb-1">
                        <span class="font-bold text-xs text-[#181A1A]">${rack.name}</span>
                        ${priorityBadge}
                    </div>
                    <div class="flex items-baseline justify-between">
                        <span id="carouselPower-${i}" class="text-base font-black text-[#181A1A] font-mono">${rack.powerDrawKW.toFixed(1)} kW</span>
                        <span id="carouselTemp-${i}" class="text-xs font-bold text-[#7928CA] font-mono">${rack.temp.toFixed(1)}°C</span>
                    </div>
                    <div class="flex items-center justify-between mt-1 text-[10px] text-[#7A8293] font-mono">
                        <span id="carouselFan-${i}">${rack.fanPWM.toFixed(0)}% Fan</span>
                        <span id="carouselDamper-${i}" class="text-[#AF6EFF] font-bold">VAV ${rack.damperOpening.toFixed(0)}%</span>
                    </div>
                    <div class="w-full bg-[#E5E7EB] h-1 rounded-full mt-2 overflow-hidden">
                        <div id="carouselBar-${i}" class="h-full rounded-full transition-all duration-300 ${isTarget ? 'bg-[#AF6EFF]' : 'bg-[#A1E688]'}" style="width: ${pwrRatio.toFixed(0)}%;"></div>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
    }

    selectRack(index) {
        this.selectedRackIndex = index;
        for (let i = 0; i < 8; i++) {
            const card = document.getElementById(`carouselCard-${i}`);
            if (card) {
                card.classList.toggle('selected', i === index);
            }
        }
        const rack = this.physics.racks[index];
        const btnHotspotLabel = document.getElementById('btnHotspotLabel');
        if (btnHotspotLabel && rack) {
            btnHotspotLabel.textContent = `Uji Hotspot Termal (+8°C ke ${rack.name})`;
        }
        this.addStreamLog('SELECT', 'stream-tag-purple', `Fokus ke ${rack.name} (${rack.pduId}: ${rack.powerDrawKW.toFixed(1)} kW, Temp ${rack.temp.toFixed(1)}°C, VAV ${rack.damperOpening.toFixed(0)}%)`);
    }

    /**
     * SMART PDU TELEMETRY & TIME-SERIES POWER FORECAST (Non-Intrusif)
     */
    updateSmartPDUTelemetryUI() {
        const container = document.getElementById('jobSchedulerContainer');
        if (!container) return;

        let html = '';
        this.smartPDUFeeds.forEach(feed => {
            const rack = this.physics.racks[feed.rackIndex] || {
                powerDrawKW: 7.5,
                powerForecastKW: 8.0,
                thermalHeadroomSec: 120.0
            };

            const isSurge = rack.powerDrawKW >= 14.0;
            const isTargeted = (this.physics.mode === 'ai' && (rack.isAIPriority || rack.temp >= 25.0 || isSurge));

            let badgeStyle = 'bg-[#F0F2F6] text-[#5E6573] border border-black/5';
            let statusText = 'Steady Baseline';
            if (isTargeted) {
                if (rack.temp >= 26.5) {
                    badgeStyle = 'bg-[#FFE4E6] text-[#9F1239] font-bold';
                    statusText = 'Hotspot Mitigation';
                } else {
                    badgeStyle = 'bg-[#A1E688] text-[#123B0A] font-bold';
                    statusText = 'Pre-Cooling Active';
                }
            } else if (isSurge) {
                badgeStyle = 'bg-[#FEF3C7] text-[#B45309] font-bold';
                statusText = 'High Load Node';
            } else if (feed.status === 'forecast_trend') {
                badgeStyle = 'bg-[#F4EDFF] text-[#7928CA] font-bold';
                statusText = 'Forecast 5-15m';
            }

            const headroomLabel = `${Math.round(rack.thermalHeadroomSec)}s Headroom`;
            const vavStatusTag = isTargeted 
                ? `<span class="text-[9px] font-extrabold ${rack.temp >= 26.5 ? 'text-[#9F1239] bg-[#FFE4E6]' : 'text-[#123B0A] bg-[#A1E688]'} px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">${rack.temp >= 26.5 ? 'VAV ' + rack.damperOpening.toFixed(0) + '% HOTSPOT' : 'VAV ' + rack.damperOpening.toFixed(0) + '% PRE-COOL'}</span>`
                : '';

            html += `
                <div class="job-item-card p-2.5 rounded-xl border border-black/5 bg-[#F9FAFC] flex items-center justify-between gap-3 text-xs hover:border-[#AF6EFF]/40 hover:bg-white transition-all">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <span class="${badgeStyle} text-[10px] px-2 py-0.5 rounded-full font-mono whitespace-nowrap shrink-0">
                            ${feed.pduId}
                        </span>
                        <div class="min-w-0">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="font-bold text-xs text-[#181A1A] truncate">${feed.rackName}</span>
                                ${vavStatusTag}
                            </div>
                            <div class="flex items-center gap-2 text-[10px] text-[#7A8293] mt-0.5 font-mono">
                                <span>Tren 5-15m: <strong class="text-[#AF6EFF]">${rack.powerForecastKW.toFixed(1)} kW</strong></span>
                                <span>•</span>
                                <span class="${rack.thermalHeadroomSec < 60 ? 'text-[#D97706] font-bold' : 'text-[#1A5912]'}">${headroomLabel}</span>
                            </div>
                        </div>
                    </div>
                    <div class="text-right shrink-0">
                        <span class="font-mono font-black text-xs ${isSurge ? 'text-[#D97706]' : 'text-[#181A1A]'}">${rack.powerDrawKW.toFixed(1)} kW</span>
                        <div class="text-[9px] text-[#8F97A6] uppercase">${statusText}</div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    updateMetricsUI() {
        const activeRack = this.physics.racks[this.selectedRackIndex] || this.physics.racks.find(r => r.isAIPriority) || this.physics.racks[1];
        const allTemps = this.physics.racks.map(r => r.temp);
        const maxTemp = Math.max(...allTemps);
        const avgTargetTemp = (allTemps.reduce((acc, t) => acc + t, 0) / allTemps.length).toFixed(1);

        // Update Tracking Card
        const trackTempDisplay = document.getElementById('trackTempDisplay');
        if (trackTempDisplay) trackTempDisplay.textContent = `${activeRack.temp.toFixed(1)}°C Suhu`;

        const progressBar = document.getElementById('targetProgressBar');
        if (progressBar) {
            const pct = Math.min(100, Math.max(20, activeRack.damperOpening));
            progressBar.style.width = `${pct}%`;
        }

        // Telemetry Active Damper Aperture
        const damperApertureEl = document.getElementById('telemetryDamperAperture');
        if (damperApertureEl) {
            const isAI = (this.physics.mode === 'ai');
            damperApertureEl.textContent = isAI 
                ? `${activeRack.name}: ${activeRack.damperOpening.toFixed(0)}% VAV Aperture` 
                : '40% Aperture (Statis/Pasif)';
            damperApertureEl.className = isAI ? 'text-[#AF6EFF] font-bold' : 'text-[#F43F5E] font-bold';
        }

        // Update Environmental & Thermal Lag Indicators
        const displayIndoorRH = document.getElementById('displayIndoorRH');
        if (displayIndoorRH) {
            displayIndoorRH.textContent = `${this.physics.indoorRH.toFixed(0)}% RH (Safe Dew Point)`;
        }
        const displayContainment = document.getElementById('displayContainment');
        const headerContainment = document.getElementById('headerContainmentStatus');
        if (displayContainment) {
            displayContainment.textContent = `${this.physics.containmentStatus} (Tier-IV Standard)`;
        }
        if (headerContainment) {
            headerContainment.textContent = `Aisle: Sealed Tier-IV`;
        }
        const displayPlenumPressure = document.getElementById('displayPlenumPressure');
        if (displayPlenumPressure) {
            displayPlenumPressure.textContent = `${this.physics.plenumPressurePa} Pa (Balanced)`;
        }

        const displayThermalLag = document.getElementById('displayThermalLag');
        if (displayThermalLag) {
            const headroom = activeRack.thermalHeadroomSec || 104;
            displayThermalLag.textContent = `${headroom.toFixed(0)}s (Headroom)`;
        }

        // Pipeline Actuator Text
        const pipelineActuatorText = document.getElementById('pipelineActuatorText');
        if (pipelineActuatorText) {
            const isAI = (this.physics.mode === 'ai');
            pipelineActuatorText.textContent = isAI 
                ? `${activeRack.name}: VAV Tile ${activeRack.damperOpening.toFixed(0)}% • Fan ${activeRack.fanPWM.toFixed(0)}%` 
                : `VAV Tile 40% (Statis) • Fan ${activeRack.fanPWM.toFixed(0)}%`;
        }

        // Update Radial Gauge: Beban Total IT Daya Smart PDU
        const gaugeValText = document.getElementById('gaugeValText');
        if (gaugeValText) {
            const totalPower = this.physics.racks.reduce((acc, r) => acc + r.powerDrawKW, 0);
            gaugeValText.textContent = Math.round(totalPower * 25).toLocaleString('id-ID');
        }

        // Update Temperature Forecast Highlight Card
        const chartHighlightTemp = document.getElementById('chartHighlightTemp');
        const chartHighlightDelta = document.getElementById('chartHighlightDelta');
        const isAI = (this.physics.mode === 'ai');
        if (chartHighlightTemp) {
            chartHighlightTemp.textContent = isAI ? `${avgTargetTemp}°C` : '48.0°C';
        }
        if (chartHighlightDelta) {
            if (isAI) {
                chartHighlightDelta.textContent = 'Stabil (-25.2°C Panas)';
                chartHighlightDelta.className = 'text-xs font-bold text-[#A1E688]';
            } else {
                chartHighlightDelta.textContent = '⚠️ Bahaya (+24.8°C Spike)';
                chartHighlightDelta.className = 'text-xs font-bold text-[#F43F5E]';
            }
        }

        // Update Carousel thumbnails
        for (let i = 0; i < 8; i++) {
            const rack = this.physics.racks[i];
            const pwrEl = document.getElementById(`carouselPower-${i}`);
            const tempEl = document.getElementById(`carouselTemp-${i}`);
            const fanEl = document.getElementById(`carouselFan-${i}`);
            const damperEl = document.getElementById(`carouselDamper-${i}`);
            if (pwrEl) pwrEl.textContent = `${rack.powerDrawKW.toFixed(1)} kW`;
            if (tempEl) tempEl.textContent = `${rack.temp.toFixed(1)}°C`;
            if (fanEl) fanEl.textContent = `${rack.fanPWM.toFixed(0)}% Fan`;
            if (damperEl) damperEl.textContent = `VAV ${rack.damperOpening.toFixed(0)}%`;
            const barEl = document.getElementById(`carouselBar-${i}`);
            if (barEl) {
                const pwrRatio = Math.min(100, Math.max(15, (rack.powerDrawKW / 24.8) * 100));
                barEl.style.width = `${pwrRatio.toFixed(0)}%`;
            }
        }
    }

    render(timestamp) {
        if (!this.lastTimestamp) this.lastTimestamp = timestamp;
        const dt = Math.min(0.1, (timestamp - this.lastTimestamp) / 1000);
        this.lastTimestamp = timestamp;
        this.simTimeSeconds += dt;

        this.physics.update(dt);

        this.aiLogTimer += dt;
        if (this.aiLogTimer > 0.12) {
            this.updateMetricsUI();
            this.updateSmartPDUTelemetryUI();
            this.aiLogTimer = 0;
        }

        // Periodic Live Telemetry Stream Logging (Every ~3.2 seconds)
        this.telemetryIntervalTimer += dt;
        if (this.telemetryIntervalTimer >= 3.2) {
            this.telemetryIntervalTimer = 0;
            this.generatePeriodicTelemetryLog();
        }

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

        // 1. Data Center Room & Cold Aisle Containment
        this.drawDataCenterRoom();

        // 2. Active VAV Perforated Floor Tiles
        this.drawPerforatedFloorTiles();

        // 3. CFD Streamlines
        if (this.showCFDStreamlines) {
            this.drawCFDStreamlines();
        }

        // 4. AI Target Highlight on Active VAV Floor Tiles
        if (this.showActiveTileBeams && this.physics.mode === 'ai') {
            this.drawActiveFloorTilesHighlight();
        }

        // 5. Update and Draw Fluid CFD Particles
        this.updateParticles(dt);
        this.drawFluidParticles();

        // 6. 8 Server Racks
        this.drawServerRacks();

        requestAnimationFrame(this.render);
    }

    /**
     * STUDIO DATA CENTER ROOM DENGAN COLD AISLE CONTAINMENT (CAC) TERTUTUP KACA
     */
    drawDataCenterRoom() {
        const ctx = this.ctx;
        const cw = this.canvasWidth;
        const ch = this.canvasHeight;

        // Background
        const floorGrad = ctx.createLinearGradient(0, 0, 0, ch);
        floorGrad.addColorStop(0, '#FAFBFD');
        floorGrad.addColorStop(1, '#EDF1F7');
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, 0, cw, ch);

        // Grid Lines
        ctx.strokeStyle = 'rgba(24, 26, 26, 0.04)';
        ctx.lineWidth = 1;
        const gridSize = 36;
        for (let x = 0; x < cw; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, ch);
            ctx.stroke();
        }
        for (let y = 0; y < ch; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(cw, y);
            ctx.stroke();
        }

        // ═══════════════════════════════════════════════════════════════
        // COLD AISLE CONTAINMENT (CAC) PHYSICAL GLASS ENCLOSURE (Tier-IV)
        // ═══════════════════════════════════════════════════════════════
        const startX = 124;
        const totalAvailWidth = Math.max(260, cw - startX - 22);
        const cacX = startX - 10;
        const cacY = 186;
        const cacW = totalAvailWidth + 4;
        const cacH = 118;

        // 1. Underfloor Plenum Pressurized Conduit (From CRAC Discharge to Subfloor Tiles)
        const plenumX = 106;
        const plenumW = cacW + (cacX - plenumX);
        const plenumY = 222;
        const plenumH = 46;

        ctx.save();
        const plenumGrad = ctx.createLinearGradient(plenumX, 0, plenumX + plenumW, 0);
        plenumGrad.addColorStop(0, 'rgba(6, 182, 212, 0.10)');
        plenumGrad.addColorStop(0.5, 'rgba(161, 230, 136, 0.08)');
        plenumGrad.addColorStop(1, 'rgba(6, 182, 212, 0.06)');
        ctx.fillStyle = plenumGrad;
        this.drawRoundedRect(ctx, plenumX, plenumY, plenumW, plenumH, 6);
        ctx.fill();

        // Hot Aisle Return Zone Identifiers (Outside CAC - Top & Bottom)
        ctx.fillStyle = 'rgba(24, 26, 26, 0.40)';
        ctx.font = '700 8px "Space Grotesk", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('▲ HOT AISLE RETURN PLENUM • BARIS B EXHAUST (38.0°C)', startX + 6, 32);
        ctx.fillText('▼ HOT AISLE RETURN PERIMETER • BARIS A EXHAUST (38.0°C)', startX + 6, 466);

        // 2. Contained Cold Corridor Floor Area (Clean Translucent Tempered Glass)
        const cacGrad = ctx.createLinearGradient(cacX, 0, cacX + cacW, 0);
        cacGrad.addColorStop(0, 'rgba(56, 189, 248, 0.09)');
        cacGrad.addColorStop(0.5, 'rgba(175, 110, 255, 0.06)');
        cacGrad.addColorStop(1, 'rgba(161, 230, 136, 0.08)');
        ctx.fillStyle = cacGrad;
        this.drawRoundedRect(ctx, cacX, cacY, cacW, cacH, 8);
        ctx.fill();

        // 3. Double-Line Tempered Glass Containment Partition Walls (Crisp & Clean)
        // Top Glass Barrier (Isolasi Baris B)
        ctx.strokeStyle = 'rgba(175, 110, 255, 0.70)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(cacX, cacY);
        ctx.lineTo(cacX + cacW, cacY);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(cacX, cacY + 1.5);
        ctx.lineTo(cacX + cacW, cacY + 1.5);
        ctx.stroke();

        // Bottom Glass Barrier (Isolasi Baris A)
        ctx.strokeStyle = 'rgba(161, 230, 136, 0.80)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(cacX, cacY + cacH);
        ctx.lineTo(cacX + cacW, cacY + cacH);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(cacX, cacY + cacH - 1.5);
        ctx.lineTo(cacX + cacW, cacY + cacH - 1.5);
        ctx.stroke();

        // 4. Diagonal Glass Sheen Reflection Streaks (Subtle Clean Material)
        ctx.save();
        const sheenWidths = [18, 30, 14, 24];
        const sheenOffsets = [0.15, 0.38, 0.65, 0.85];

        ctx.beginPath();
        this.drawRoundedRect(ctx, cacX, cacY, cacW, cacH, 8);
        ctx.clip();

        sheenOffsets.forEach((offset, idx) => {
            const sx = cacX + offset * cacW;
            const w = sheenWidths[idx];
            const sheenGrad = ctx.createLinearGradient(sx, cacY, sx + 50, cacY + cacH);
            sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.20)');
            sheenGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.05)');
            sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

            ctx.fillStyle = sheenGrad;
            ctx.beginPath();
            ctx.moveTo(sx, cacY);
            ctx.lineTo(sx + w, cacY);
            ctx.lineTo(sx + w - 40, cacY + cacH);
            ctx.lineTo(sx - 40, cacY + cacH);
            ctx.closePath();
            ctx.fill();
        });
        ctx.restore();

        // 5. Sliding Airlock Glass Door on Right (Pintu Kaca Geser Hermetis)
        const doorX = cacX + cacW - 16;
        const doorY = cacY + 4;
        const doorW = 14;
        const doorH = cacH - 8;

        // Sliding top & bottom tracks
        ctx.fillStyle = '#181A1A';
        ctx.fillRect(doorX - 2, cacY, doorW + 4, 3);
        ctx.fillRect(doorX - 2, cacY + cacH - 3, doorW + 4, 3);

        // Glass sliding door panel
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.drawRoundedRect(ctx, doorX, doorY, doorW, doorH, 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(175, 110, 255, 0.6)';
        ctx.lineWidth = 1.2;
        this.drawRoundedRect(ctx, doorX, doorY, doorW, doorH, 3);
        ctx.stroke();

        // Stainless steel pull handle bar
        ctx.fillStyle = '#181A1A';
        this.drawRoundedRect(ctx, doorX + 4, doorY + doorH / 2 - 16, 2.5, 32, 1);
        ctx.fill();

        // Biometric / RFID security card reader panel with glowing green access LED
        ctx.fillStyle = '#181A1A';
        this.drawRoundedRect(ctx, doorX + 1, doorY + 12, 10, 16, 2);
        ctx.fill();
        ctx.fillStyle = '#A1E688';
        ctx.beginPath();
        ctx.arc(doorX + 6, doorY + 18, 2.0, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '700 5px "JetBrains Mono"';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.fillText('RFID', doorX + 6, doorY + 26);

        // 6. Directional Airflow Floor Markers (Center Walking Aisle - Subtle & Non-intrusive)
        const markerCount = 5;
        const markerStep = (cacW - 80) / markerCount;
        for (let m = 0; m < markerCount; m++) {
            const mx = cacX + 50 + m * markerStep;
            const my = cacY + cacH / 2;
            ctx.fillStyle = 'rgba(175, 110, 255, 0.22)';
            ctx.font = '700 8px "Space Grotesk", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('▷', mx, my + 3);
        }

        ctx.restore();

        // ═══════════════════════════════════════════════════════════════
        // ENTERPRISE PRECISION CRAH / CRAC COOLING UNIT (Schneider / Vertiv Liebert Style)
        // ═══════════════════════════════════════════════════════════════
        // ═══════════════════════════════════════════════════════════════
        // CRAH UNIT (Clean & Minimalist — Hanya Nama Sesuai Permintaan)
        // ═══════════════════════════════════════════════════════════════
        const acX = 16;
        const acY = 44;
        const acW = 80;
        const acH = ch - 88; // 412px

        // 1. Cabinet Body
        ctx.save();
        ctx.shadowColor = 'rgba(24, 26, 26, 0.08)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 4;

        ctx.fillStyle = '#FFFFFF';
        this.drawRoundedRect(ctx, acX, acY, acW, acH, 8);
        ctx.fill();
        ctx.restore();

        // Cabinet Outer Border
        ctx.strokeStyle = '#2A2E39';
        ctx.lineWidth = 1.6;
        this.drawRoundedRect(ctx, acX, acY, acW, acH, 8);
        ctx.stroke();

        // 2. Header: Nama CRAH Unit
        const hdrH = 28;
        ctx.fillStyle = '#181A1A';
        this.drawRoundedRect(ctx, acX + 4, acY + 4, acW - 8, hdrH, 6);
        ctx.fill();

        // Active Status LED Dot
        ctx.fillStyle = '#A1E688';
        ctx.beginPath();
        ctx.arc(acX + 13, acY + 4 + hdrH / 2, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Teks Nama
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 9px "Space Grotesk", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CRAH UNIT 01', acX + acW / 2 + 4, acY + 4 + 17.5);

        // 3. Interior Clean Panel (Minimalist Cabinet)
        ctx.fillStyle = '#F8FAFC';
        this.drawRoundedRect(ctx, acX + 6, acY + 38, acW - 12, acH - 44, 6);
        ctx.fill();
        ctx.strokeStyle = 'rgba(24, 26, 26, 0.06)';
        ctx.lineWidth = 1;
        this.drawRoundedRect(ctx, acX + 6, acY + 38, acW - 12, acH - 44, 6);
        ctx.stroke();
    }

    /**
     * DRAW ACTIVE VAV PERFORATED FLOOR TILES (KATUP KISI LANTAI BERMOTOR)
     * Rapi, simetris, bebas tumpang tindih antara lubang pori dan lencana VAV
     */
    drawPerforatedFloorTiles() {
        const ctx = this.ctx;

        for (let i = 0; i < 8; i++) {
            const rack = this.physics.racks[i];
            const tCoord = this.getTileCoordinates(i);
            const isTarget = (this.physics.mode === 'ai' && (rack.isAIPriority || rack.temp >= 25.0 || rack.powerDrawKW >= 14.0));

            // 1. Floor Tile Frame
            ctx.save();
            ctx.fillStyle = isTarget ? '#FFFFFF' : '#F8FAFC';
            this.drawRoundedRect(ctx, tCoord.x, tCoord.y, tCoord.w, tCoord.h, 4);
            ctx.fill();

            // Border
            ctx.strokeStyle = isTarget ? '#A1E688' : 'rgba(24, 26, 26, 0.16)';
            ctx.lineWidth = isTarget ? 1.8 : 1.0;
            this.drawRoundedRect(ctx, tCoord.x, tCoord.y, tCoord.w, tCoord.h, 4);
            ctx.stroke();

            // 2. Perforated Micro-Holes (HANYA di Sisi Kiri & Kanan, Tanpa Menabrak Lencana)
            const holeY1 = tCoord.y + 7.5;
            const holeY2 = tCoord.y + 18.5;
            const holeRadius = 1.4;

            ctx.fillStyle = isTarget ? '#16A34A' : '#64748B';

            // 4 lubang di sisi kiri (2 kolom x 2 baris)
            [-12, -5].forEach(dx => {
                const hx = tCoord.x + 18 + dx;
                ctx.beginPath();
                ctx.arc(hx, holeY1, holeRadius, 0, Math.PI * 2);
                ctx.arc(hx, holeY2, holeRadius, 0, Math.PI * 2);
                ctx.fill();
            });

            // 4 lubang di sisi kanan (2 kolom x 2 baris)
            [5, 12].forEach(dx => {
                const hx = tCoord.x + tCoord.w - 18 + dx;
                ctx.beginPath();
                ctx.arc(hx, holeY1, holeRadius, 0, Math.PI * 2);
                ctx.arc(hx, holeY2, holeRadius, 0, Math.PI * 2);
                ctx.fill();
            });

            // 3. VAV Damper Opening Badge di Tengah (Bebas Tabrakan)
            const badgeW = 44;
            const badgeH = 14;
            const badgeX = tCoord.x + (tCoord.w - badgeW) / 2;
            const badgeY = tCoord.y + (tCoord.h - badgeH) / 2;

            ctx.fillStyle = isTarget ? '#EEFAEA' : '#EDF2F7';
            this.drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
            ctx.fill();

            ctx.strokeStyle = isTarget ? 'rgba(161, 230, 136, 0.8)' : 'rgba(203, 213, 225, 0.8)';
            ctx.lineWidth = 1;
            this.drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 4);
            ctx.stroke();

            ctx.fillStyle = isTarget ? '#123B0A' : '#1E293B';
            ctx.font = '800 7.5px "JetBrains Mono"';
            ctx.textAlign = 'center';
            ctx.fillText(`VAV ${rack.damperOpening.toFixed(0)}%`, badgeX + badgeW / 2, badgeY + 10);

            ctx.restore();
        }
    }

    /**
     * VISUALISASI AI: ACTIVE FLOOR TILE GLOW (MINT #A1E688)
     * Hanya pendaran bersih di sekeliling ubin, tanpa lingkaran atau teks tumpang tindih
     */
    drawActiveFloorTilesHighlight() {
        const ctx = this.ctx;

        this.physics.racks.forEach((rack, idx) => {
            const isTarget = (this.physics.mode === 'ai' && (rack.isAIPriority || rack.temp >= 25.0 || rack.powerDrawKW >= 14.0));
            if (!isTarget) return;

            const tCoord = this.getTileCoordinates(idx);

            ctx.save();
            ctx.shadowColor = '#A1E688';
            ctx.shadowBlur = 12;

            ctx.strokeStyle = '#A1E688';
            ctx.lineWidth = 2.0;
            this.drawRoundedRect(ctx, tCoord.x - 1.5, tCoord.y - 1.5, tCoord.w + 3, tCoord.h + 3, 5);
            ctx.stroke();

            ctx.restore();
        });
    }

    /**
     * GARIS ARUS CFD UNDERFLOOR PLENUM & VERTICAL AIRFLOW (SUBTLE & CLEAN)
     */
    drawCFDStreamlines() {
        const ctx = this.ctx;
        const acX = 106;

        [0, 1, 2, 3].forEach(col => {
            const tCoordA = this.getTileCoordinates(col);
            const tCoordB = this.getTileCoordinates(col + 4);
            const rackA = this.physics.racks[col];
            const rackB = this.physics.racks[col + 4];
            const targetX = tCoordA.x + tCoordA.w / 2;
            const isTarget = (this.physics.mode === 'ai' && (
                rackA?.isAIPriority || rackB?.isAIPriority || 
                (rackA && rackA.temp >= 25.0) || (rackB && rackB.temp >= 25.0) || 
                (rackA && rackA.powerDrawKW >= 14.0) || (rackB && rackB.powerDrawKW >= 14.0)
            ));

            ctx.save();
            const flowGrad = ctx.createLinearGradient(acX, 245, targetX, 245);
            flowGrad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
            flowGrad.addColorStop(1, isTarget ? 'rgba(161, 230, 136, 0.45)' : 'rgba(175, 110, 255, 0.25)');

            ctx.strokeStyle = flowGrad;
            ctx.lineWidth = isTarget ? 1.4 : 1.0;

            // Horizontal underfloor plenum conduit flow
            ctx.beginPath();
            ctx.moveTo(acX, 245);
            ctx.lineTo(targetX, 245);
            ctx.stroke();

            // Branch lines ke ubin lantai
            ctx.beginPath();
            ctx.moveTo(targetX, 245);
            ctx.lineTo(targetX, tCoordB.y + tCoordB.h);
            ctx.moveTo(targetX, 245);
            ctx.lineTo(targetX, tCoordA.y);
            ctx.stroke();

            ctx.restore();
        });
    }

    /**
     * UPDATE CFD PARTIKEL: LAMINAR COLD JETS & WARM EXHAUST PLUMES
     */
    updateParticles(dt) {
        // 1. Update Cold Laminar Streamline Jets (Hanya menyembur dari ubin ke intake server)
        for (let i = 0; i < this.coldJets.length; i++) {
            const p = this.coldJets[i];
            const rack = this.physics.racks[p.rackIndex] || { damperOpening: 40, fanPWM: 40 };
            const fanRatio = rack.fanPWM / 100.0;
            const jetSpeed = 1.6 + (fanRatio * 4.4); // Kecepatan semburan mengikuti putaran kipas
            p.vy = p.isRowA ? jetSpeed : -jetSpeed;
            p.length = 8.0 + (fanRatio * 16.0); // Garis semburan memanjang saat kipas kencang

            p.x += p.vx;
            p.y += p.vy;

            // Penyerapan partikel saat memasuki sasis server intake
            let absorbed = false;
            if (p.isRowA) {
                if (p.y >= 308) {
                    p.alpha *= 0.72;
                    p.length *= 0.80;
                    if (p.alpha < 0.08 || p.y >= 320) absorbed = true;
                }
            } else {
                if (p.y <= 182) {
                    p.alpha *= 0.72;
                    p.length *= 0.80;
                    if (p.alpha < 0.08 || p.y <= 170) absorbed = true;
                }
            }

            if (absorbed) {
                const priorityRacks = this.physics.racks.map((r, idx) => (r.isAIPriority || r.temp >= 25.0) ? idx : -1).filter(idx => idx !== -1);
                const nextRack = (this.physics.mode === 'ai' && priorityRacks.length > 0 && Math.random() < 0.60)
                    ? priorityRacks[Math.floor(Math.random() * priorityRacks.length)]
                    : Math.floor(Math.random() * 8);
                this.coldJets[i] = this.createColdJet(nextRack, false);
            }
        }

        // 2. Update Hot Aisle Thermal Exhaust Plumes (Puff hangat lembut ke saluran return)
        for (let i = 0; i < this.hotPlumes.length; i++) {
            const p = this.hotPlumes[i];
            p.x += p.vx;
            p.y += p.vy;
            p.radius += 0.08;
            p.life -= 1;
            p.alpha = Math.max(0, (p.life / p.maxLife) * 0.28);

            let expired = (p.life <= 0);
            if (p.isRowA && p.y >= 494) expired = true;
            if (!p.isRowA && p.y <= 6) expired = true;

            if (expired) {
                const nextRack = Math.floor(Math.random() * 8);
                this.hotPlumes[i] = this.createHotPlume(nextRack, false);
            }
        }
    }

    /**
     * DRAW CFD STREAMLINES & THERMAL EXHAUST PLUMES
     */
    drawFluidParticles() {
        const ctx = this.ctx;

        // 1. Hot Aisle Thermal Exhaust Plumes (Puff kalor hangat transparan di luar containment)
        for (let i = 0; i < this.hotPlumes.length; i++) {
            const p = this.hotPlumes[i];
            if (p.alpha <= 0.01) continue;

            ctx.fillStyle = p.color + p.alpha.toFixed(2) + ')';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        // 2. Cold Laminar CFD Streamlines & Directed Jets (Muncul HANYA dari ubin lantai)
        for (let i = 0; i < this.coldJets.length; i++) {
            const p = this.coldJets[i];
            if (p.alpha <= 0.02) continue;

            ctx.save();
            if (p.isTarget) {
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 6;
            }

            const tailY = p.y - (p.vy > 0 ? p.length : -p.length);
            const grad = ctx.createLinearGradient(p.x, p.y, p.x, tailY);
            grad.addColorStop(0, p.color);
            grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');

            ctx.strokeStyle = grad;
            ctx.lineWidth = p.width;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 2, tailY);
            ctx.stroke();

            // Kepala partikel aerodinamis bercahaya
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.width * 0.55, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    /**
     * DRAW 8 ENTERPRISE DCIM SERVER RACKS
     * Sesuai permintaan pengguna: Hanya menampilkan 3 indikator:
     * 1. Nama Rak
     * 2. Suhu (°C)
     * 3. Kecepatan Kipas (Speedometer Arc & RPM)
     */
    drawServerRacks() {
        const ctx = this.ctx;

        this.physics.racks.forEach((rack, idx) => {
            const rCoord = this.getRackCoordinates(idx);
            const rx = rCoord.x;
            const ry = rCoord.y;
            const rw = rCoord.w;
            const rh = rCoord.h;

            const isSelected = (idx === this.selectedRackIndex);
            const isTarget = (this.physics.mode === 'ai' && (rack.isAIPriority || rack.temp >= 25.0 || rack.powerDrawKW >= 14.0));

            // 1. Enclosure Card Frame (Enterprise DCIM Monitoring Card)
            ctx.save();
            ctx.shadowColor = isSelected ? 'rgba(175, 110, 255, 0.40)' : (isTarget ? 'rgba(161, 230, 136, 0.35)' : 'rgba(24, 26, 26, 0.10)');
            ctx.shadowBlur = isSelected ? 16 : (isTarget ? 14 : 8);
            ctx.shadowOffsetY = 4;

            // Chassis Background
            ctx.fillStyle = '#FFFFFF';
            this.drawRoundedRect(ctx, rx, ry, rw, rh, 8);
            ctx.fill();
            ctx.restore();

            // Card Outer Border
            ctx.strokeStyle = isSelected ? '#AF6EFF' : (isTarget ? '#A1E688' : '#2A2E39');
            ctx.lineWidth = isSelected ? 2.5 : (isTarget ? 2.2 : 1.4);
            this.drawRoundedRect(ctx, rx, ry, rw, rh, 8);
            ctx.stroke();

            // ═══════════════════════════════════════════════════════════════
            // 1. INDIKATOR NAMA RAK
            // ═══════════════════════════════════════════════════════════════
            const headerY = ry + 6;
            const headerH = 24;
            ctx.fillStyle = '#181A1A';
            this.drawRoundedRect(ctx, rx + 5, headerY, rw - 10, headerH, 6);
            ctx.fill();

            // Active Status LED Dot
            ctx.fillStyle = isTarget ? '#A1E688' : '#AF6EFF';
            ctx.beginPath();
            ctx.arc(rx + 14, headerY + headerH / 2, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Nama Rak
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '700 9px "Space Grotesk", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(rack.name, rx + rw / 2 + 4, headerY + 15.5);

            // ═══════════════════════════════════════════════════════════════
            // 2. INDIKATOR SUHU (TEMPERATURE)
            // ═══════════════════════════════════════════════════════════════
            const tempY = ry + 36;
            const tempH = 40;
            const temp = rack.temp;
            let tempColor, pillBg, pillBorder, statusLabel;
            if (temp < 24.5) {
                tempColor = '#123B0A';
                pillBg = '#EEFAEA';
                pillBorder = '#A1E688';
                statusLabel = 'OPTIMAL';
            } else if (temp < 30.0) {
                tempColor = '#92400E';
                pillBg = '#FFF7EC';
                pillBorder = '#FFC46D';
                statusLabel = 'ELEVATED';
            } else {
                tempColor = '#9F1239';
                pillBg = '#FFE4E6';
                pillBorder = '#F43F5E';
                statusLabel = 'CRITICAL';
            }

            ctx.fillStyle = pillBg;
            this.drawRoundedRect(ctx, rx + 6, tempY, rw - 12, tempH, 6);
            ctx.fill();
            ctx.strokeStyle = pillBorder;
            ctx.lineWidth = 1.2;
            this.drawRoundedRect(ctx, rx + 6, tempY, rw - 12, tempH, 6);
            ctx.stroke();

            // Label SUHU
            ctx.fillStyle = tempColor;
            ctx.font = '700 6.5px "JetBrains Mono"';
            ctx.textAlign = 'center';
            ctx.fillText(`SUHU • ${statusLabel}`, rx + rw / 2, tempY + 12);

            // Angka Suhu Besar & Jelas
            ctx.fillStyle = tempColor;
            ctx.font = '800 13px "JetBrains Mono"';
            ctx.textAlign = 'center';
            ctx.fillText(`${temp.toFixed(1)}°C`, rx + rw / 2, tempY + 30);

            // ═══════════════════════════════════════════════════════════════
            // 3. INDIKATOR KECEPATAN KIPAS (FAN SPEED)
            // ═══════════════════════════════════════════════════════════════
            const fanY = ry + 82;
            const fanH = 48;
            ctx.fillStyle = '#F8FAFC';
            this.drawRoundedRect(ctx, rx + 6, fanY, rw - 12, fanH, 6);
            ctx.fill();
            ctx.strokeStyle = 'rgba(24, 26, 26, 0.08)';
            ctx.lineWidth = 1;
            this.drawRoundedRect(ctx, rx + 6, fanY, rw - 12, fanH, 6);
            ctx.stroke();

            // Label KIPAS
            ctx.fillStyle = '#64748B';
            ctx.font = '700 6.5px "JetBrains Mono"';
            ctx.textAlign = 'center';
            ctx.fillText('KECEPATAN KIPAS', rx + rw / 2, fanY + 11);

            // Speedometer Arc Gauge
            const arcCx = rx + rw / 2;
            const arcCy = fanY + 27;
            const arcR = 12.5;

            // Track latar belakang abu-abu
            ctx.strokeStyle = '#E2E8F0';
            ctx.lineWidth = 2.6;
            ctx.beginPath();
            ctx.arc(arcCx, arcCy, arcR, Math.PI * 0.75, Math.PI * 2.25);
            ctx.stroke();

            // Busur aktif kecepatan kipas (Warna dinamis mencerminkan akselerasi pendinginan)
            const fanRatio = Math.max(0.08, Math.min(1.0, rack.fanPWM / 100.0));
            const arcEnd = Math.PI * 0.75 + fanRatio * (Math.PI * 1.5);
            
            let arcColor = '#AF6EFF'; // Ungu tenang (idle / baseline)
            if (fanRatio >= 0.85) {
                arcColor = '#F43F5E'; // Merah padamkan hotspot darurat
            } else if (fanRatio >= 0.65) {
                arcColor = '#16A34A'; // Hijau active speed boost
            } else if (isTarget) {
                arcColor = '#A1E688';
            }

            ctx.strokeStyle = arcColor;
            ctx.lineWidth = (fanRatio >= 0.70) ? 3.0 : 2.6;
            ctx.beginPath();
            ctx.arc(arcCx, arcCy, arcR, Math.PI * 0.75, arcEnd);
            ctx.stroke();

            // 🌀 ROTOR KIPAS BERPUTAR REAL-TIME (Animasi Kecepatan Putaran Fisik)
            // Kecepatan putar rotor langsung proporsional terhadap fanPWM & laju pendinginan
            rack.rotorAngle = (rack.rotorAngle || 0) + (fanRatio * 0.50);
            ctx.save();
            ctx.translate(arcCx, arcCy);
            ctx.rotate(rack.rotorAngle);
            const bladeColor = (fanRatio >= 0.85) ? '#F43F5E' : ((fanRatio >= 0.65) ? '#16A34A' : '#7928CA');
            for (let b = 0; b < 4; b++) {
                ctx.rotate(Math.PI / 2);
                ctx.fillStyle = bladeColor;
                ctx.beginPath();
                ctx.ellipse(0, 4.0, 1.4, 3.2, 0, 0, Math.PI * 2);
                ctx.fill();
            }
            // Center Hub
            ctx.fillStyle = '#181A1A';
            ctx.beginPath();
            ctx.arc(0, 0, 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Angka RPM Kipas (Dengan Label Indikator Akselerasi)
            const rpmVal = Math.round(rack.fanPWM * 142);
            const isHighSpeed = (fanRatio >= 0.65);
            const isEmergency = (fanRatio >= 0.85);

            ctx.fillStyle = isEmergency ? '#9F1239' : (isHighSpeed ? '#15803D' : '#181A1A');
            ctx.font = '800 8.5px "JetBrains Mono"';
            ctx.textAlign = 'center';

            let rpmText = `${(rpmVal / 1000).toFixed(1)}k RPM`;
            if (isEmergency) rpmText += ' 🔥';
            else if (isHighSpeed) rpmText += ' ⚡';
            ctx.fillText(rpmText, rx + rw / 2, fanY + 44);

            // Target Lock Reticle jika Rak A2 & A3 di-Precool oleh AI
            if (isTarget) {
                ctx.save();
                ctx.strokeStyle = '#A1E688';
                ctx.lineWidth = 2.2;

                const bSize = 8;
                ctx.beginPath();
                ctx.moveTo(rx - 3, ry + bSize);
                ctx.lineTo(rx - 3, ry - 3);
                ctx.lineTo(rx + bSize, ry - 3);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(rx + rw + 3 - bSize, ry - 3);
                ctx.lineTo(rx + rw + 3, ry - 3);
                ctx.lineTo(rx + rw + 3, ry + bSize);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(rx - 3, ry + rh - bSize);
                ctx.lineTo(rx - 3, ry + rh + 3);
                ctx.lineTo(rx + bSize, ry + rh + 3);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(rx + rw + 3 - bSize, ry + rh + 3);
                ctx.lineTo(rx + rw + 3, ry + rh + 3);
                ctx.lineTo(rx + rw + 3, ry + rh - bSize);
                ctx.stroke();

                ctx.restore();
            }
        });
    }

    drawRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.app = new ThermoGuardApp();
    window.app.init();
});
