/**
 * ═══════════════════════════════════════════════════════════════════
 * THERMOGUARD AI — LIGHT STUDIO INTERACTIVE SIMULATOR (8 RACKS)
 * ═══════════════════════════════════════════════════════════════════
 * SF UI Display & Neo-Figma Aesthetic:
 * - Palette: #181A1A (Charcoal), #AF6EFF (Lavender), #FFC46D (Amber), #A1E688 (Mint)
 * - 8 Racks in 2 Rows x 4 Columns (Row A Cold Aisle & Row B Hot Aisle)
 * - High-Tech Studio Canvas: Apple-white server racks, CFD fluid streamlines,
 *   neon laser conduits targeting Pre-Cooling zones (Rak A2 & A3).
 * - Live radial gauges, route revenue line charts, and vehicle/rack carousel.
 */

class ThermoGuardApp {
    constructor() {
        this.physics = new window.PhysicsEngine();

        this.canvas = document.getElementById('simulationCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvasWidth = 0;
        this.canvasHeight = 0;

        this.PARTICLE_COUNT = 320;
        this.particles = [];
        this.streamlines = [];

        this.showCFDStreamlines = true;
        this.showAITargetBeams = true;
        this.selectedRackIndex = 1; // Default select Rak A2 (Pre-cooling target)

        // Antrean Tugas (Job Scheduler 15-30 Menit ke Depan)
        this.jobQueue = [
            {
                id: 'JOB-01',
                title: 'Database Indexing (Routine)',
                targetRacks: [0], // Rak A1
                targetNames: 'Rak A1',
                loadPercent: 45,
                minutesUntilStart: -2,
                status: 'executing'
            },
            {
                id: 'JOB-02',
                title: 'Microservices API Gateway',
                targetRacks: [1, 5], // Rak A2 & B2
                targetNames: 'Rak A2 & B2',
                loadPercent: 40,
                minutesUntilStart: 2,
                status: 'scheduled'
            },
            {
                id: 'JOB-03',
                title: 'Training LLM 70B (Batch #4)',
                targetRacks: [1, 2], // Rak A2 & A3: TARGET UTAMA PRE-COOLING
                targetNames: 'Rak A2 & A3',
                loadPercent: 95,
                minutesUntilStart: 15,
                status: 'scheduled'
            },
            {
                id: 'JOB-04',
                title: 'Real-Time GPU Inference Burst',
                targetRacks: [6, 7], // Rak B3 & B4
                targetNames: 'Rak B3 & B4',
                loadPercent: 88,
                minutesUntilStart: 22,
                status: 'scheduled'
            },
            {
                id: 'JOB-05',
                title: 'Full Facility Stress Test',
                targetRacks: [0, 1, 2, 3, 4, 5, 6, 7],
                targetNames: 'Semua Rak (A1-B4)',
                loadPercent: 98,
                minutesUntilStart: 30,
                status: 'scheduled'
            }
        ];

        this.simTimeSeconds = 0;
        this.lastTimestamp = 0;
        this.aiLogTimer = 0;

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
        this.updateJobQueueUI();
        this.updateMetricsUI();

        this.addStreamLog('PINN_CORE', 'stream-tag-purple', 'Physics Engine aktif: 8 Rak Server (2 Baris x 4 Kolom) termonitor.');
        this.addStreamLog('AI_TARGET', 'stream-tag-mint', 'Pre-Cooling aktif di Rak A2 & A3 untuk mengantisipasi lonjakan beban LLM 95%.');

        requestAnimationFrame(this.render);
    }

    handleResize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        this.canvasWidth = rect.width;
        this.canvasHeight = 480;

        this.canvas.width = this.canvasWidth * dpr;
        this.canvas.height = this.canvasHeight * dpr;
        this.ctx.resetTransform();
        this.ctx.scale(dpr, dpr);
    }

    initParticles() {
        this.particles = [];
        for (let i = 0; i < this.PARTICLE_COUNT; i++) {
            this.particles.push(this.createParticle(Math.random() < 0.75));
        }
    }

    initStreamlines() {
        this.streamlines = [];
        for (let i = 0; i < 14; i++) {
            this.streamlines.push({
                lane: i,
                speed: 1.0 + Math.random() * 0.4
            });
        }
    }

    createParticle(isFromAC = true) {
        const cw = this.canvasWidth;
        const ch = this.canvasHeight;

        if (isFromAC) {
            return {
                x: 65 + Math.random() * 30,
                y: 80 + Math.random() * (ch - 160),
                vx: 2.2 + Math.random() * 2.8,
                vy: (Math.random() - 0.5) * 0.4,
                temp: 14.5 + Math.random() * 2.0,
                life: 300 + Math.random() * 400,
                maxLife: 700,
                size: 2.0 + Math.random() * 2.0,
                eddyPhase: Math.random() * Math.PI * 2,
                isJet: Math.random() < 0.5
            };
        } else {
            return {
                x: 120 + Math.random() * (cw - 180),
                y: 60 + Math.random() * (ch - 120),
                vx: 1.0 + Math.random() * 1.5,
                vy: (Math.random() - 0.5) * 0.6,
                temp: 22.0 + Math.random() * 10.0,
                life: 200 + Math.random() * 300,
                maxLife: 500,
                size: 1.8 + Math.random() * 1.8,
                eddyPhase: Math.random() * Math.PI * 2,
                isJet: false
            };
        }
    }

    getRackCoordinates(index) {
        const cw = this.canvasWidth;
        const col = index % 4; // 0, 1, 2, 3
        const row = Math.floor(index / 4); // 0 = Baris A (Depan), 1 = Baris B (Belakang)

        const startX = 145;
        const totalAvailWidth = Math.max(480, cw - startX - 35);
        const colGap = totalAvailWidth / 4;

        const rw = Math.min(84, colGap - 18);
        const x = startX + col * colGap + (colGap - rw) / 2;

        let y, h;
        if (row === 0) {
            // Baris A (Depan / Cold Aisle)
            y = 265;
            h = 168;
        } else {
            // Baris B (Belakang / Hot Aisle)
            y = 52;
            h = 152;
        }

        return { x, y, w: rw, h, row, col };
    }

    setupEventListeners() {
        const btnConv = document.getElementById('modeBtnConv');
        const btnAI = document.getElementById('modeBtnAI');

        if (btnConv) btnConv.addEventListener('click', () => this.setMode('conventional'));
        if (btnAI) btnAI.addEventListener('click', () => this.setMode('ai'));

        const surgeBtn = document.getElementById('btnSimulateSurge');
        if (surgeBtn) surgeBtn.addEventListener('click', () => this.triggerLoadSurge());

        const outdoorSlider = document.getElementById('sliderOutdoorTemp');
        const outdoorDisplay = document.getElementById('displayOutdoorTemp');
        const headerOutdoor = document.getElementById('headerOutdoorTemp');
        if (outdoorSlider) {
            outdoorSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                this.physics.outdoorTemp = val;
                if (outdoorDisplay) outdoorDisplay.textContent = `${val.toFixed(0)}°C`;
                if (headerOutdoor) headerOutdoor.textContent = `${val.toFixed(0)}°C`;
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
                this.showAITargetBeams = !this.showAITargetBeams;
                this.showCFDStreamlines = !this.showCFDStreamlines;
                toggleVectorsBtn.classList.toggle('bg-[#F4EDFF]', this.showAITargetBeams);
                this.addStreamLog('VISUAL_FX', 'stream-tag-purple', `Raycasting Beams: ${this.showAITargetBeams ? 'AKTIF' : 'NONAKTIF'}`);
            });
        }

        // Canvas Click Listener for Rack Selection
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            for (let i = 0; i < 8; i++) {
                const rCoord = this.getRackCoordinates(i);
                if (clickX >= rCoord.x && clickX <= rCoord.x + rCoord.w &&
                    clickY >= rCoord.y && clickY <= rCoord.y + rCoord.h) {
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
            this.addStreamLog('MODE_CHANGE', 'stream-tag-mint', 'Mode B aktif: AI memprediksi antrean tugas & mengarahkan louver aerodinamis.');
        } else {
            if (btnConv) btnConv.className = 'mode-tab-btn active-conv';
            if (btnAI) btnAI.className = 'mode-tab-btn';
            if (badgeStatus) {
                badgeStatus.className = 'badge-amber';
                badgeStatus.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#4A2E05]"></span> Reaktif (Lag 12s)`;
            }
            this.addStreamLog('MODE_CHANGE', 'stream-tag-amber', 'Mode A aktif: Sistem konvensional menunggu sensor panas melewati 38°C.');
        }
    }

    triggerLoadSurge() {
        this.physics.surgeActive = true;
        this.physics.surgeTimeRemaining = 16.0;
        const surgeBtn = document.getElementById('btnSimulateSurge');
        if (surgeBtn) {
            surgeBtn.classList.add('pulsing');
            surgeBtn.innerHTML = `<span>⚠️</span><span>LONJAKAN AKTIF (98% BEBAN)...</span>`;
            surgeBtn.disabled = true;
        }

        this.addStreamLog('BURST_EVENT', 'stream-tag-amber', 'Lonjakan komputasi 98% terdeteksi di seluruh 8 rak server!');

        setTimeout(() => {
            if (surgeBtn) {
                surgeBtn.classList.remove('pulsing');
                surgeBtn.innerHTML = `<span>⚡</span><span>SIMULASIKAN LONJAKAN BEBAN (BURST 98%)</span>`;
                surgeBtn.disabled = false;
            }
            this.addStreamLog('BURST_END', 'stream-tag-mint', 'Beban komputasi normal kembali. AI menstabilkan putaran blower.');
        }, 16000);
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

        while (logBox.children.length > 30) {
            logBox.removeChild(logBox.lastChild);
        }
    }

    initRackCarousel() {
        const container = document.getElementById('rackCarouselContainer');
        if (!container) return;

        let html = '';
        for (let i = 0; i < 8; i++) {
            const rack = this.physics.racks[i];
            const isSelected = (i === this.selectedRackIndex);
            const isTarget = (this.physics.mode === 'ai' && (i === 1 || i === 2));

            html += `
                <div id="carouselCard-${i}" class="rack-thumb-card ${isSelected ? 'selected' : ''}" onclick="window.app.selectRack(${i})">
                    <div class="flex items-center justify-between mb-1.5">
                        <span class="font-bold text-xs text-[#181A1A]">${rack.name}</span>
                        ${isTarget ? '<span class="text-[9px] font-bold text-[#1A5912] bg-[#A1E688]/40 px-1.5 py-0.5 rounded">TARGET</span>' : '<span class="text-[9px] text-[#7A8293] font-mono">Row ' + (rack.row === 0 ? 'A' : 'B') + '</span>'}
                    </div>
                    <div class="flex items-baseline justify-between">
                        <span id="carouselTemp-${i}" class="text-base font-black text-[#181A1A] font-mono">${rack.temp.toFixed(1)}°C</span>
                        <span id="carouselFan-${i}" class="text-[10px] text-[#7A8293] font-mono font-bold">${rack.fanPWM.toFixed(0)}% Fan</span>
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
        this.addStreamLog('SELECT', 'stream-tag-purple', `Fokus ke ${rack.name} (${rack.temp.toFixed(1)}°C, Fan ${rack.fanPWM.toFixed(0)}%)`);
    }

    updateJobQueueUI() {
        const container = document.getElementById('jobSchedulerContainer');
        if (!container) return;

        let html = '';
        this.jobQueue.forEach(job => {
            const isCritical = job.loadPercent >= 90;
            const isTargeted = (this.physics.mode === 'ai' && job.minutesUntilStart === 15);

            let timeBadgeStyle = 'bg-[#F0F2F6] text-[#5E6573] border border-black/5';
            if (isTargeted) {
                timeBadgeStyle = 'bg-[#A1E688] text-[#123B0A] font-bold';
            } else if (job.minutesUntilStart <= 0) {
                timeBadgeStyle = 'bg-[#EBF2FE] text-[#1D4ED8] font-bold';
            } else if (isCritical) {
                timeBadgeStyle = 'bg-[#FEF3C7] text-[#B45309] font-bold';
            }

            const timeLabel = job.minutesUntilStart <= 0 ? 'Active' : `T-${job.minutesUntilStart}m`;

            html += `
                <div class="job-item-card p-2.5 rounded-xl border border-black/5 bg-[#F9FAFC] flex items-center justify-between gap-3 text-xs hover:border-[#AF6EFF]/40 hover:bg-white transition-all">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <span class="${timeBadgeStyle} text-[10px] px-2 py-0.5 rounded-full font-mono whitespace-nowrap shrink-0">
                            ${timeLabel}
                        </span>
                        <div class="min-w-0">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="font-bold text-xs text-[#181A1A] truncate">${job.title}</span>
                                ${isTargeted ? '<span class="text-[9px] font-extrabold text-[#123B0A] bg-[#A1E688] px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">TARGET PRE-COOL</span>' : ''}
                            </div>
                            <div class="text-[10px] text-[#7A8293] mt-0.5">
                                Target: <strong class="text-[#AF6EFF]">${job.targetNames}</strong>
                            </div>
                        </div>
                    </div>
                    <div class="text-right shrink-0">
                        <span class="font-mono font-black text-xs ${isCritical ? 'text-[#D97706]' : 'text-[#181A1A]'}">${job.loadPercent}%</span>
                        <div class="text-[9px] text-[#8F97A6] uppercase">Load</div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    updateMetricsUI() {
        const rackA2 = this.physics.racks[1] || { temp: 23.2, fanPWM: 75 };
        const rackA3 = this.physics.racks[2] || { temp: 23.4, fanPWM: 72 };
        const avgTargetTemp = ((rackA2.temp + rackA3.temp) / 2).toFixed(1);

        // Update Tracking Card
        const trackTempDisplay = document.getElementById('trackTempDisplay');
        if (trackTempDisplay) trackTempDisplay.textContent = `${avgTargetTemp}°C Suhu`;

        const progressBar = document.getElementById('targetProgressBar');
        if (progressBar) {
            const pct = Math.min(100, Math.max(20, rackA2.fanPWM));
            progressBar.style.width = `${pct}%`;
        }

        const louverAngleEl = document.getElementById('telemetryLouverAngle');
        if (louverAngleEl) {
            const isAI = (this.physics.mode === 'ai');
            louverAngleEl.textContent = isAI ? `${rackA2.louverAngle.toFixed(0)}° Focus Target` : '0° Flat (Dispersi)';
            louverAngleEl.className = isAI ? 'text-[#AF6EFF] font-bold' : 'text-[#F43F5E] font-bold';
        }

        // Update Radial Gauge
        const gaugeValText = document.getElementById('gaugeValText');
        const gaugePathFill = document.getElementById('gaugePathFill');
        if (gaugeValText) {
            const burstVal = this.physics.surgeActive ? 3400 : (2400 + Math.round(rackA2.fanPWM * 6));
            gaugeValText.textContent = burstVal.toLocaleString('id-ID');
        }

        // Update Wavy Route Revenue / Temperature Highlight
        const chartHighlightTemp = document.getElementById('chartHighlightTemp');
        const chartHighlightDelta = document.getElementById('chartHighlightDelta');
        const isAI = (this.physics.mode === 'ai');
        if (chartHighlightTemp) {
            chartHighlightTemp.textContent = isAI ? `${avgTargetTemp}°C` : '48.0°C';
        }
        if (chartHighlightDelta) {
            if (isAI) {
                chartHighlightDelta.textContent = 'Stabil (-24.8°C Panas)';
                chartHighlightDelta.className = 'text-xs font-bold text-[#A1E688]';
            } else {
                chartHighlightDelta.textContent = '⚠️ Bahaya (+24.8°C Spike)';
                chartHighlightDelta.className = 'text-xs font-bold text-[#F43F5E]';
            }
        }

        // Update Carousel thumbnails
        for (let i = 0; i < 8; i++) {
            const rack = this.physics.racks[i];
            const tempEl = document.getElementById(`carouselTemp-${i}`);
            const fanEl = document.getElementById(`carouselFan-${i}`);
            if (tempEl) tempEl.textContent = `${rack.temp.toFixed(1)}°C`;
            if (fanEl) fanEl.textContent = `${rack.fanPWM.toFixed(0)}% Fan`;
        }
    }

    render(timestamp) {
        if (!this.lastTimestamp) this.lastTimestamp = timestamp;
        const dt = Math.min(0.1, (timestamp - this.lastTimestamp) / 1000);
        this.lastTimestamp = timestamp;
        this.simTimeSeconds += dt;

        // Step Physics Engine
        this.physics.update(dt);

        // Update UI every ~120ms
        this.aiLogTimer += dt;
        if (this.aiLogTimer > 0.12) {
            this.updateMetricsUI();
            this.aiLogTimer = 0;
        }

        // Clear Canvas with Light Studio Aesthetic
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

        // 1. Draw Architectural Studio Room
        this.drawDataCenterRoom();

        // 2. Draw CFD Airflow Streamlines
        if (this.showCFDStreamlines) {
            this.drawCFDStreamlines();
        }

        // 3. Draw AI Neon Targeting Conduits
        if (this.showAITargetBeams && this.physics.mode === 'ai') {
            this.drawAITargetConduits();
        }

        // 4. Update and Draw Fluid Particles
        this.updateParticles(dt);
        this.drawFluidParticles();

        // 5. Draw 8 Server Racks in 2 Rows x 4 Cols
        this.drawServerRacks();

        requestAnimationFrame(this.render);
    }

    /**
     * STUDIO DATA CENTER ROOM (LIGHT MODE FIGMA AESTHETIC)
     */
    drawDataCenterRoom() {
        const ctx = this.ctx;
        const cw = this.canvasWidth;
        const ch = this.canvasHeight;

        // Studio Floor Background
        const floorGrad = ctx.createLinearGradient(0, 0, 0, ch);
        floorGrad.addColorStop(0, '#FAFBFD');
        floorGrad.addColorStop(1, '#EDF1F7');
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, 0, cw, ch);

        // Subtle Isometric Grid Lines
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

        // COLD AISLE CONTAINMENT ZONE (Translucent Glass Floor Corridor)
        const coldGrad = ctx.createLinearGradient(125, 0, cw - 20, 0);
        coldGrad.addColorStop(0, 'rgba(161, 230, 136, 0.18)'); // Mint #A1E688
        coldGrad.addColorStop(0.5, 'rgba(175, 110, 255, 0.12)'); // Lavender #AF6EFF
        coldGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
        ctx.fillStyle = coldGrad;
        this.drawRoundedRect(ctx, 130, 218, cw - 150, 40, 10);
        ctx.fill();

        ctx.strokeStyle = 'rgba(175, 110, 255, 0.25)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([6, 6]);
        this.drawRoundedRect(ctx, 130, 218, cw - 150, 40, 10);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label Cold Aisle
        ctx.fillStyle = '#7928CA';
        ctx.font = '700 8.5px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('COLD AISLE (15°C)', 145, 242);

        // CRAC UNIT CASING (Kiri)
        const acX = 18;
        const acY = 40;
        const acW = 90;
        const acH = ch - 80;

        // Shadow
        ctx.shadowColor = 'rgba(24, 26, 26, 0.08)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 6;

        ctx.fillStyle = '#FFFFFF';
        this.drawRoundedRect(ctx, acX, acY, acW, acH, 16);
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = 'rgba(24, 26, 26, 0.1)';
        ctx.lineWidth = 1.5;
        this.drawRoundedRect(ctx, acX, acY, acW, acH, 16);
        ctx.stroke();

        // Header CRAC
        ctx.fillStyle = '#181A1A';
        this.drawRoundedRect(ctx, acX + 8, acY + 10, acW - 16, 24, 8);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '800 9px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('CRAC UNIT', acX + acW / 2, acY + 25);

        // Status Indicator
        ctx.fillStyle = '#A1E688';
        ctx.beginPath();
        ctx.arc(acX + 20, acY + 22, 3, 0, Math.PI * 2);
        ctx.fill();

        // Louver Compartment & Directional Blades
        const isAI = (this.physics.mode === 'ai');
        const targetRack = this.physics.racks[1];
        const targetAngle = isAI ? targetRack.louverAngle : 0; // -12 deg in AI mode

        const louverCount = 8;
        const louverStartY = acY + 50;
        const louverGap = (acH - 70) / louverCount;

        for (let i = 0; i < louverCount; i++) {
            const ly = louverStartY + i * louverGap;
            ctx.save();
            ctx.translate(acX + acW - 14, ly);
            ctx.rotate((targetAngle * Math.PI) / 180.0);

            // Louver blade
            ctx.fillStyle = isAI ? '#AF6EFF' : '#94A3B8';
            this.drawRoundedRect(ctx, -22, -3, 26, 6, 2);
            ctx.fill();

            if (isAI) {
                ctx.strokeStyle = '#7928CA';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            ctx.restore();
        }

        // Louver Telemetry Badge below CRAC
        ctx.fillStyle = isAI ? '#F4EDFF' : '#F1F3F5';
        this.drawRoundedRect(ctx, acX + 6, acY + acH - 34, acW - 12, 24, 6);
        ctx.fill();

        ctx.fillStyle = isAI ? '#7928CA' : '#5E6573';
        ctx.font = '700 8.5px "Plus Jakarta Sans"';
        ctx.textAlign = 'center';
        ctx.fillText(isAI ? `LOUVER ${targetAngle.toFixed(0)}°` : 'LOUVER 0°', acX + acW / 2, acY + acH - 19);
    }

    /**
     * GARIS ARUS CFD KE KEDUA BARIS RAK (LAVENDER & MINT STREAMLINES)
     */
    drawCFDStreamlines() {
        const ctx = this.ctx;
        const cw = this.canvasWidth;
        const acX = 108;

        const targetYs = [85, 120, 275, 330];

        targetYs.forEach((ly, i) => {
            const rackIdx = (i < 2) ? (4 + i) : (i - 2);
            const rack = this.physics.racks[rackIdx] || this.physics.racks[0];
            const rCoord = this.getRackCoordinates(rackIdx);

            const isAI = (this.physics.mode === 'ai');
            const angleDeg = isAI ? rack.louverAngle : 0;
            const targetY = ly + Math.sin((angleDeg * Math.PI) / 180.0) * (rCoord.x - acX) * 0.25;

            ctx.save();
            const flowGrad = ctx.createLinearGradient(acX, ly, cw - 30, targetY);
            flowGrad.addColorStop(0, 'rgba(161, 230, 136, 0.7)'); // Mint
            flowGrad.addColorStop(0.4, 'rgba(175, 110, 255, 0.6)'); // Lavender
            flowGrad.addColorStop(0.75, 'rgba(255, 196, 109, 0.35)'); // Amber
            flowGrad.addColorStop(1, 'rgba(244, 63, 94, 0.2)');

            ctx.strokeStyle = flowGrad;
            ctx.lineWidth = 1.8;
            ctx.setLineDash([10, 8]);
            ctx.lineDashOffset = -this.simTimeSeconds * (40 + (rack.fanPWM * 0.6));

            ctx.beginPath();
            ctx.moveTo(acX, ly);
            ctx.bezierCurveTo(acX + 70, ly, rCoord.x - 35, targetY, cw - 20, targetY - 10);
            ctx.stroke();
            ctx.restore();
        });
    }

    /**
     * VISUALISASI AI: LASER CONDUITS & CHEVRON STREAM KE RAK TARGET (A2 & A3)
     */
    drawAITargetConduits() {
        const ctx = this.ctx;
        const acX = 108;

        // Target utama Pre-Cooling adalah Rak A2 (index 1) & Rak A3 (index 2)
        [1, 2].forEach(idx => {
            const rack = this.physics.racks[idx];
            const rCoord = this.getRackCoordinates(idx);
            const rx = rCoord.x;
            const ry = rCoord.y + rCoord.h / 2;
            const ly = 270 + (idx - 1) * 35;

            ctx.save();
            // Laser Conduit Neon Lavender
            ctx.strokeStyle = 'rgba(175, 110, 255, 0.85)';
            ctx.lineWidth = 3.0;
            ctx.shadowColor = '#AF6EFF';
            ctx.shadowBlur = 12;

            ctx.beginPath();
            ctx.moveTo(acX, ly);
            ctx.bezierCurveTo(acX + 75, ly - 10, rx - 45, ry, rx - 4, ry);
            ctx.stroke();
            ctx.restore();

            // Animated Chevrons (>>>)
            const count = 4;
            for (let c = 0; c < count; c++) {
                const phase = ((this.simTimeSeconds * 1.4 + (c / count)) % 1.0);
                const t = phase;

                const cx = (1 - t) * (1 - t) * acX + 2 * (1 - t) * t * (acX + 75) + t * t * rx;
                const cy = (1 - t) * (1 - t) * ly + 2 * (1 - t) * t * ry + t * t * ry;

                ctx.save();
                ctx.fillStyle = '#FFFFFF';
                ctx.font = '800 12px "Plus Jakarta Sans"';
                ctx.textAlign = 'center';
                ctx.shadowColor = '#AF6EFF';
                ctx.shadowBlur = 8;
                ctx.fillText('›', cx, cy + 4);
                ctx.restore();
            }

            // Pulsing Rings around Target Inlets
            const pulse = (this.simTimeSeconds * 3) % (Math.PI * 2);
            const rSize = 14 + Math.sin(pulse) * 4;
            ctx.save();
            ctx.strokeStyle = '#A1E688';
            ctx.lineWidth = 2.0;
            ctx.beginPath();
            ctx.arc(rx - 6, ry, rSize, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        });
    }

    /**
     * DRAW 8 SERVER RACKS (APPLE-WHITE CHASSIS & CHARCOAL BEZEL)
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
            const isTarget = (this.physics.mode === 'ai' && (idx === 1 || idx === 2));

            // 1. Ambient Drop Shadow
            ctx.save();
            ctx.shadowColor = isSelected ? 'rgba(175, 110, 255, 0.35)' : 'rgba(24, 26, 26, 0.08)';
            ctx.shadowBlur = isSelected ? 20 : 12;
            ctx.shadowOffsetY = 6;

            // Chassis Body (Pure White)
            ctx.fillStyle = '#FFFFFF';
            this.drawRoundedRect(ctx, rx, ry, rw, rh, 14);
            ctx.fill();
            ctx.restore();

            // Border
            ctx.strokeStyle = isSelected ? '#AF6EFF' : (isTarget ? '#A1E688' : 'rgba(24, 26, 26, 0.1)');
            ctx.lineWidth = isSelected ? 2.5 : (isTarget ? 2.0 : 1.2);
            this.drawRoundedRect(ctx, rx, ry, rw, rh, 14);
            ctx.stroke();

            // 2. Rack Header / Bezel
            const headerH = 26;
            ctx.fillStyle = '#181A1A';
            this.drawRoundedRect(ctx, rx + 4, ry + 4, rw - 8, headerH, 10);
            ctx.fill();

            // Rack Name
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '800 8.5px "Plus Jakarta Sans"';
            ctx.textAlign = 'center';
            ctx.fillText(rack.name, rx + rw / 2, ry + 16);

            // Row Badge
            ctx.fillStyle = '#AF6EFF';
            ctx.beginPath();
            ctx.arc(rx + 14, ry + 14, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // 3. Digital LCD Temperature Readout Pill
            const temp = rack.temp;
            let tempColor, pillBg;
            if (temp < 24.0) {
                tempColor = '#123B0A';
                pillBg = '#A1E688'; // Mint
            } else if (temp < 30.0) {
                tempColor = '#4A2E05';
                pillBg = '#FFC46D'; // Amber
            } else {
                tempColor = '#FFFFFF';
                pillBg = '#F43F5E'; // Rose
            }

            const pillW = rw - 16;
            const pillY = ry + headerH + 8;
            ctx.fillStyle = pillBg;
            this.drawRoundedRect(ctx, rx + 8, pillY, pillW, 20, 6);
            ctx.fill();

            ctx.fillStyle = tempColor;
            ctx.font = '800 11px "JetBrains Mono"';
            ctx.textAlign = 'center';
            ctx.fillText(`${temp.toFixed(1)}°C`, rx + rw / 2, pillY + 14);

            // 4. Server Blade Chassis Bays (Horizontal slots)
            const slotStartY = pillY + 26;
            const slotCount = 4;
            const slotH = 10;
            const slotGap = 4;

            for (let s = 0; s < slotCount; s++) {
                const sy = slotStartY + s * (slotH + slotGap);
                ctx.fillStyle = '#F4F5F8';
                this.drawRoundedRect(ctx, rx + 8, sy, rw - 16, slotH, 3);
                ctx.fill();

                // Blinking LED Activity Lights
                const ledPhase = (this.simTimeSeconds * 6 + s * 1.5 + idx) % (Math.PI * 2);
                const isLedOn = Math.sin(ledPhase) > -0.2;

                ctx.fillStyle = isLedOn ? (s % 2 === 0 ? '#AF6EFF' : '#A1E688') : '#CBD5E1';
                ctx.beginPath();
                ctx.arc(rx + 16, sy + slotH / 2, 2, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = isLedOn ? '#FFC46D' : '#CBD5E1';
                ctx.beginPath();
                ctx.arc(rx + 23, sy + slotH / 2, 2, 0, Math.PI * 2);
                ctx.fill();
            }

            // 5. Rotating 7-Blade Variable Blower Fan
            const fanCenterY = ry + rh - 34;
            const fanRadius = Math.min(18, rw / 2 - 12);
            const fanCenterX = rx + rw / 2;

            // Fan Outer Well
            ctx.fillStyle = '#F0F2F6';
            ctx.beginPath();
            ctx.arc(fanCenterX, fanCenterY, fanRadius + 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(24, 26, 26, 0.08)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Blades Rotation
            const rotSpeed = (rack.fanPWM / 100.0) * 16.0;
            const fanAngle = (this.simTimeSeconds * rotSpeed) % (Math.PI * 2);

            ctx.save();
            ctx.translate(fanCenterX, fanCenterY);
            ctx.rotate(fanAngle);

            const bladeCount = 7;
            for (let b = 0; b < bladeCount; b++) {
                ctx.rotate((Math.PI * 2) / bladeCount);
                ctx.fillStyle = '#181A1A';
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.quadraticCurveTo(fanRadius * 0.45, -3, fanRadius * 0.9, -1);
                ctx.lineTo(fanRadius * 0.85, 2);
                ctx.quadraticCurveTo(fanRadius * 0.35, 1, 0, 0);
                ctx.fill();
            }

            // Center Hub
            ctx.fillStyle = '#AF6EFF';
            ctx.beginPath();
            ctx.arc(0, 0, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // 6. Fan Speed Sub-Pill
            ctx.fillStyle = '#181A1A';
            ctx.font = '700 8px "JetBrains Mono"';
            ctx.textAlign = 'center';
            ctx.fillText(`FAN ${rack.fanPWM.toFixed(0)}%`, rx + rw / 2, ry + rh - 6);

            // 7. Target Lock Bracket Reticle & Floating HUD jika Rak A2 & A3 di-Precool oleh AI
            if (isTarget) {
                ctx.save();
                ctx.strokeStyle = '#A1E688';
                ctx.lineWidth = 2.4;

                const bSize = 10;
                ctx.beginPath();
                ctx.moveTo(rx - 4, ry + bSize);
                ctx.lineTo(rx - 4, ry - 4);
                ctx.lineTo(rx + bSize, ry - 4);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(rx + rw + 4 - bSize, ry - 4);
                ctx.lineTo(rx + rw + 4, ry - 4);
                ctx.lineTo(rx + rw + 4, ry + bSize);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(rx - 4, ry + rh - bSize);
                ctx.lineTo(rx - 4, ry + rh + 4);
                ctx.lineTo(rx + bSize, ry + rh + 4);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(rx + rw + 4 - bSize, ry + rh + 4);
                ctx.lineTo(rx + rw + 4, ry + rh + 4);
                ctx.lineTo(rx + rw + 4, ry + rh - bSize);
                ctx.stroke();

                // Floating Hologram Target Chip over the rack
                const chipW = rw + 24;
                const chipX = rx - 12;
                const chipY = ry - 20;

                ctx.fillStyle = '#FFFFFF';
                ctx.shadowColor = 'rgba(161, 230, 136, 0.45)';
                ctx.shadowBlur = 10;
                this.drawRoundedRect(ctx, chipX, chipY, chipW, 15, 6);
                ctx.fill();

                ctx.strokeStyle = '#A1E688';
                ctx.lineWidth = 1.3;
                ctx.stroke();

                ctx.fillStyle = '#123B0A';
                ctx.font = '800 7.5px "Plus Jakarta Sans"';
                ctx.textAlign = 'center';
                ctx.fillText('🎯 TARGET T-15m', rx + rw / 2, chipY + 10.5);

                ctx.restore();
            } else if (this.physics.mode !== 'ai' && (idx === 1 || idx === 2) && rack.temp > 27) {
                // Conventional Hotspot Warning Chip
                ctx.save();
                const chipW = rw + 20;
                const chipX = rx - 10;
                const chipY = ry - 20;

                ctx.fillStyle = '#FFF1F2';
                ctx.shadowColor = 'rgba(244, 63, 94, 0.35)';
                ctx.shadowBlur = 10;
                this.drawRoundedRect(ctx, chipX, chipY, chipW, 15, 6);
                ctx.fill();

                ctx.strokeStyle = '#F43F5E';
                ctx.lineWidth = 1.3;
                ctx.stroke();

                ctx.fillStyle = '#9F1239';
                ctx.font = '800 7.5px "Plus Jakarta Sans"';
                ctx.textAlign = 'center';
                ctx.fillText('⚠️ RISIKO 48°C', rx + rw / 2, chipY + 10.5);

                ctx.restore();
            }
        });
    }

    updateParticles(dt) {
        const cw = this.canvasWidth;
        const ch = this.canvasHeight;

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= 1;

            if (p.x > cw - 20 || p.y < 30 || p.y > ch - 30 || p.life <= 0) {
                this.particles[i] = this.createParticle(Math.random() < 0.7);
            }
        }
    }

    drawFluidParticles() {
        const ctx = this.ctx;
        this.particles.forEach(p => {
            const alpha = Math.min(1.0, p.life / 80.0) * (p.isJet ? 0.9 : 0.65);
            const heatRatio = Math.max(0, Math.min(1.0, (p.temp - 15.0) / 25.0));

            let color;
            if (heatRatio < 0.35) {
                color = `rgba(161, 230, 136, ${alpha})`; // Mint
            } else if (heatRatio < 0.7) {
                color = `rgba(175, 110, 255, ${alpha})`; // Lavender
            } else {
                color = `rgba(255, 196, 109, ${alpha})`; // Amber
            }

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
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
