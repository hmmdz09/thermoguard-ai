# ThermoGuard AI: Sistem Pendingin Data Center Proaktif Berbasis Smart PDU Power-First Sensing & Cold Aisle Containment

**ThermoGuard AI** adalah inovasi sistem pendingin data center proaktif (*Feedforward Closed-Loop Cooling*) berbasis **Physics-Informed Neural Network (PINN)** yang dirancang selaras 100% dengan standar fisik data center **Tier-3 / Tier-4 di Indonesia** (seperti standar DCI Indonesia, BDx, dan NeutraDC Telkom) pada iklim tropis berkelembapan tinggi.

Berbeda dari model konvensional yang reaktif maupun model teoritis yang mengasumsikan akses ke sistem operasi server, ThermoGuard AI menerapkan arsitektur **Smart PDU Power-First Sensing & Thermal Inertia Exploitation** yang bersifat **non-intrusif** dan menjaga kerahasiaan tenant colocation.

---

## 🌟 Pilar Arsitektur Sistem

### 1. Smart PDU Power-First Sensing (100% Non-Intrusif)
* **Kepatuhan Privasi Tenant Colocation:** Pada fasilitas multi-tenant colocation di Indonesia, operator data center tidak memiliki izin untuk membaca antrean pekerjaan internal (*job queue*), proses komputasi, atau metrik OS pelanggan karena batasan regulasi privasi data, SLA ketat, dan sertifikasi ISO/IEC 27001 serta SOC-2.
* **Deteksi Daya Seketika ($t = 0$):** ThermoGuard AI memantau konsumsi daya listrik aktual (kW) langsung dari sensor *Smart PDU* di tingkat rak kabinet.
* **Gradient $dP/dt$ & Time-Series Forecasting (5–15 Menit):** Laju perubahan daya listrik ($\frac{dP}{dt}$) dievaluasi secara real-time untuk memproyeksikan lintasan tren daya 5 hingga 15 menit ke depan (`powerForecastKW`).

### 2. Eksploitasi Jeda Inersia Termal (60–180 Detik / 1–3 Menit)
* **Fisika Hambatan Kalor:** Saat chip GPU atau CPU mengalami lonjakan komputasi, daya listrik melonjak seketika pada $t = 0$. Namun, panas fisik tidak langsung merambat ke udara lorong karena terhambat oleh kapasitas kalor massa termal silikon, *copper vapor chambers*, dan *heatsink* aluminium sasis server.
* **Golden Window (Thermal Headroom 120s):** Terdapat jeda alami selama 60 hingga 180 detik sebelum kalor terbuang ke udara sasis.
* **Pre-Cooling Preventif:** AI memanfaatkan jeda 120 detik ini untuk segera membuka katup ubin berpori ke **85% – 100%** dan meningkatkan aliran udara dingin sebelum udara lorong sempat memanas.
* **Kelemahan Sistem Konvensional:** Kontroler konvensional hanya bergantung pada sensor suhu udara. Karena suhu udara belum naik selama jeda inersia termal, sistem konvensional tidak bereaksi hingga udara telanjur panas (>38°C), lalu mengalami lag mekanis 12 detik tambahan yang menyebabkan lonjakan panas kritis (*thermal hotspot* 42°C – 48°C).

### 3. Cold Aisle Containment (CAC) & Active VAV Perforated Floor Tiles
* **Sekat Kaca Hermetis (Tier-IV Standard):** Dinding partisi kaca transparan dan pintu geser *airlock* mengurung lorong dingin antara Baris A (*Depan*) dan Baris B (*Belakang*), mencegah percampuran udara pasokan dingin (*cold supply*) dan udara buangan panas (*hot exhaust*).
* **Underfloor Raised Floor Plenum Balancing:** Udara dingin dari unit CRAC dialirkan ke bawah lantai panggung (*raised floor*) dengan tekanan positif seimbang 35 Pa pada suhu 15.0°C (ASHRAE TC 9.9).
* **Active VAV Perforated Floor Tiles:** Kisi lantai berpori bermotor di depan rak dengan bukaan katup (*aperture*) 0% hingga 100%.
* **CFD Aliran Vertikal:** Udara dingin menyembur vertikal ke atas dari bawah lantai menembus kisi berpori langsung ke intake rak server. Rak dengan damper 95%–100% menghasilkan semburan vertikal yang lebih deras dan padat.

### 4. Penyesuaian Iklim Tropis Indonesia
* **Outdoor Relative Humidity (80% RH):** Kelembapan tinggi atmosfer tropis Indonesia dimodelkan secara akurat.
* **Indoor Relative Humidity (52% RH):** Kelembapan lorong dingin dikendalikan pada 52% RH sesuai standar ASHRAE TC 9.9 untuk menjamin keamanan dari risiko kondensasi titik embun (*dew point safe* pada 5.2°C).
* **Densitas Daya AI GPU Cluster:** Daya listrik per rak dimodelkan realistis pada rentang **15.0 kW hingga 24.8 kW per rak**.

---

## 💰 Analisis Finansial Listrik PLN (Kapasitas 1.0 MW IT)

Perhitungan finansial fasilitas data center 1.0 MW IT Load (1.000 kW) beroperasi 24/7/365 dengan tarif listrik PLN Industri Tegangan Menengah (I-3/I-4) **Rp 1.300 per kWh**:

| Parameter Finansial & Operasional | Sistem Konvensional (Reaktif) | ThermoGuard AI (Smart PDU & CAC) | Penghematan / Efisiensi |
| :--- | :--- | :--- | :--- |
| **Arsitektur Pendingin** | Lorong Terbuka / Damper Statis (40%) | Cold Aisle Containment + Active VAV | Isolasi Termal Presisi |
| **Metode Deteksi** | Sensor Suhu Udara (Lag 1–3 Menit) | Smart PDU Listrik $t=0$ + Inersia 120s | Respons Proaktif Seketika |
| **Target Suhu Pasokan AC** | 11.5°C (Overcooling Ekstrem) | 15.0°C (Efisiensi ASHRAE TC 9.9) | +3.5°C Chiller Delta |
| **PUE (Power Usage Effectiveness)** | **1.45** | **1.23** | **Turun 0.22 PUE** |
| **Beban Daya Pendingin Rata-rata** | 410 kW | 275 kW | **Hemat 135 kW (32.9%)** |
| **Biaya Listrik Pendingin per Bulan** | Rp 389.090.000 | Rp 260.975.000 | **Hemat Rp 128.115.000 / bln** |
| **Biaya Listrik Pendingin per Tahun** | Rp 4.669.080.000 | Rp 3.131.700.000 | **Hemat ~Rp 1,53 Miliar / thn** |
| **Reduksi Emisi Karbon ($CO_2$)** | Baseline Fasilitas | Turun ~969 Ton $CO_2$ / tahun | ESG & Green Data Center |

---

## 🚀 Cara Menjalankan Secara Lokal

1. Masuk ke direktori proyek:
   ```bash
   cd C:\Users\yuiop\.gemini\antigravity-ide\scratch\thermoguard-ai
   ```

2. Jalankan HTTP server lokal:
   ```bash
   python -m http.server 8765
   ```

3. Buka browser di:
   ```
   http://localhost:8765
   ```

---

## 🛠️ Arsitektur Berkas Proyek
* `physics.js`: Physics engine pemodelan daya Smart PDU, persamaan diferensial inersia termal 120s, gradient $dP/dt$, proyeksi daya 5–15 menit, katup VAV ubin berpori, kelembapan RH tropis, PUE 1.23 vs 1.45, dan kalkulator finansial PLN.
* `app.js`: Visualisasi canvas 60 FPS, CFD partikel vertikal underfloor plenum, dinding kaca Cold Aisle Containment, efek Aperture Ring / Glow pada ubin aktif, dan panel Smart PDU Telemetry.
* `index.html`: Antarmuka Bento-Grid SF UI Neo-Figma, indikator Tier-IV sealed containment, thermal lag headroom countdown, dan pipeline integrasi.
* `style.css`: Token desain, palet warna executive (Charcoal, Lavender `#AF6EFF`, Peach Amber `#FFC46D`, Mint `#A1E688`), dan tata letak responsif.

---

*Dikembangkan untuk Inovasi Pendingin Data Center Berkelanjutan Standar Tier-3/Tier-4 di Indonesia.*
