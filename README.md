# ThermoGuard AI: Sistem Pendingin Data Center Proaktif Berbasis Physics-Informed AI

**ThermoGuard AI** adalah prototipe simulasi interaktif berbasis web untuk inovasi sistem pendingin data center proaktif (*Feedforward Closed-Loop Cooling*) berbasis **Physics-Informed Neural Network (PINN)** untuk data center berpendingin udara (*Air Cooling*) di iklim tropis Indonesia.

---

## 🌟 Fitur Utama
1. **Dinamika Aliran Fluida & Ruang Server 60 FPS (Canvas):**
   - 8 Rak Server (Format Grid 2 Baris $\times$ 4 Kolom: Baris A *Cold Aisle* & Baris B *Hot Aisle*).
   - Unit CRAC dengan sirip louver dinamis adaptif (-12° hingga +15°).
   - Kipas blower 7-bilah variabel dengan kecepatan putaran dinamis sesuai beban termal.
   - Sinar *Laser Raycasting AI* (`#AF6EFF`) dan panah chevron bergerak (`>>>`) membidik langsung ke rak target pre-cooling.

2. **Pipeline Integrasi Sistem Tertutup (*Closed-Loop Feedforward*):**
   - **Tahap 1:** *Job Scheduler Queue* membaca antrean beban komputasi AI (LLM Training 95% pada T-15 Menit).
   - **Tahap 2:** *PINN Neural Solver* menyelesaikan persamaan diferensial Navier-Stokes dan entalpi kalor dengan latensi 4.2 ms.
   - **Tahap 3:** *Aerodynamic Actuators* memutar sirip louver ke sudut -12° dan menaikkan PWM kipas blower ke 78%.
   - **Tahap 4:** Suhu rak server terjaga stabil di 23.2°C (standar ASHRAE TC 9.9), mencegah thermal shock, dan memangkas biaya energi operasional hingga 36.5%.

3. **Desain Antarmuka Eksekutif SF UI Display (Neo-Figma):**
   - Palet warna: Charcoal Black (`#181A1A`), Lavender Purple (`#AF6EFF`), Peach Amber (`#FFC46D`), Mint Green (`#A1E688`), dan Studio Light Ground (`#EAEAEF`).
   - Widget Aliran Udara (*Wave Banner*): Kapasitas 18.5 kCFM dan 93.3% efisiensi aliran optimal.
   - Widget Beban Komputasi (*Radial Gauge*): Respon lonjakan beban komputasi server hingga 3,400 GFLOPS.
   - Widget Prediksi Suhu (*Route Curve Chart*): Perbandingan kurva stabil AI (23.2°C) vs kurva lonjakan konvensional (48.0°C).
   - Karusel Interaktif 8 Rak: Klik rak mana pun untuk memfokuskan kamera dan telemetri.

---

## 🚀 Cara Menjalankan Secara Lokal

1. Clone repositori ini:
   ```bash
   git clone https://github.com/<USERNAME>/thermoguard-ai.git
   cd thermoguard-ai
   ```

2. Jalankan HTTP server lokal sederhana (misal menggunakan Python):
   ```bash
   python -m http.server 8080
   ```
   *atau menggunakan Node.js `npx serve`:*
   ```bash
   npx serve . -p 8080
   ```

3. Buka browser di:
   ```
   http://localhost:8080
   ```

---

## 🛠️ Teknologi yang Digunakan
- **HTML5 & Vanilla JavaScript (ES6+):** Logika simulasi termal, CFD particle system, dan rendering canvas 60 FPS.
- **Tailwind CSS & Custom Figma Design System (`style.css`):** Antarmuka modern, tipografi SF UI Display (*Plus Jakarta Sans*, *Inter*, *JetBrains Mono*).
- **Physics Engine (`physics.js`):** Pemodelan fisika nyata (Persamaan kalor sensibel, hukum pendinginan Newton, difusi termal, dan keterlambatan mekanis konvensional).

---

*Dikembangkan untuk Inovasi Teknologi Pendingin Data Center Indonesia.*
