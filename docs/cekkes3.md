# PROMPT SPESIFIKASI PENYEMPURNAAN FINAL, GLOBAL BILINGUAL (EN | ID) & FITUR STRAVA-STYLE STEP/RUN TRACKER: Ekosistem ngopi.top + ceKKes (Hack2skill Winner Polish)

**Target Eksekusi:** [Google Antigravity IDE](https://antigravity.google/product/antigravity-ide/) / [Antigravity Agent](https://aistudio.google.com/docs/antigravity-agent)
**Target Codebase:** Seluruh Halaman & Komponen Proyek **`ngopi.top`** (Landing Page, `/warkop`, Modals, Android Native Service, dan `/cekkes`)
**Kompetisi Target:**
1. [Future Health Digital Innovation Challenge - Hack2skill & Abu Dhabi](https://hack2skill.com/event/futurehealthchallenge/) (Deadline: **20 November 2026** | Track: *Wellbeing* & *Population Health*)
2. [Create AI Agents Championship - Dubai Chamber of Digital Economy](https://www.dubaichamberdigital.com/en/create-ai-agents) (Kategori: *Best Personal Agent* / *Best Societal Agent*)

---

## 1. DUA MANDAT UTAMA PEMBARUAN INI (JANGAN SENTUH KOMPONEN FLOATING `☕ AI` EKSISTING)

**CATATAN PENTING:** Pertahankan seluruh tampilan Mobile-First UX `ceKKes` saat ini yang sudah sangat bagus (Sticky Header 1 baris, Bottom Navigation, Lingkaran Wellness Score, Kartu Listen to Digital Doctor, Grid Aktivitas Pasif, Grid Deep Check, dan Checklist Kronologis), serta **JANGAN mengubah atau menyentuh kode komponen tombol melayang `☕ AI` yang sudah ada** (karena fitur geser/*draggable* eksistingnya sudah berjalan baik).

Fokuskan pembaruan hanya pada **2 mandat utama** berikut:

1. **Fitur Baru `ceKKes Move` (Pelacak Langkah Jalan Kaki & Lari ala Strava Menggunakan Sensor HP)**: Tambahkan kemampuan menghitung **jumlah langkah (*Step Counter*), jarak tempuh (km), waktu tempuh (*Duration*), kecepatan/*pace* (menit/km), klasifikasi otomatis Jalan Kaki vs. Lari (*Cadence Detection*), rute GPS, dan kalori terbakar** menggunakan *Accelerometer* HP + *Web Geolocation GPS*, yang langsung terhubung dengan rekomendasi elektrolit, herbal, dan pemulihan otot dari Dokter Digital!
2. **Global Bilingual (`EN | ID`) di Seluruh Halaman & Fitur `ngopi.top`** (bukan hanya di `/cekkes`) beserta **4 perbaikan presisi di `/cekkes`**.

---

## 2. SPESIFIKASI TEKNIS FITUR BARU: PELACAK JALAN KAKI & LARI ALA STRAVA (`ceKKes Move — Walk & Run Tracker`)

Integrasikan kemampuan pelacak olahraga jalan kaki dan lari berbasis sensor HP ke dalam **Pemantauan Pasif 24 Jam (Tab 1)** sekaligus sebagai **Mode Pelacak Aktif Bergaya Strava**:

### A. Cara Kerja Algoritma Sensor HP (IMU Pedometer + GPS Haversine)
1. **Penghitung Langkah Otomatis via Accelerometer (*3D Magnitude Peak Detection*)**:
   - Gunakan event `window.addEventListener('devicemotion')` untuk membaca percepatan 3 sumbu ($a_x, a_y, a_z$) dan hitung magnitudo vektor total:
     $$|a| = \sqrt{a_x^2 + a_y^2 + a_z^2}$$
   - Terapkan *band-pass filter* dan algoritma [Windowed Peak Detection](https://pmc.ncbi.nlm.nih.gov/articles/PMC5712972/) (mendeteksi puncak osilasi di atas ambang batas $\approx 11,5\text{--}12,5\text{ m/s}^2$ dengan jeda minimal antar-langkah $250\text{ ms}$) sehingga langkah tetap terhitung akurat baik saat HP dipegang di tangan, dimasukkan ke saku celana, maupun di dalam tas.
2. **Klasifikasi Otomatis Jalan Kaki vs. Lari (*Cadence & Amplitude Classifier*)**:
   - Hitung **Cadence (Langkah per Menit / SPM)** secara *real-time*:
     - **Jalan Kaki (*Walking*)**: Cadence $60\text{--}135\text{ langkah/menit}$ dengan amplitudo puncak percepatan sedang ($11,5\text{--}15\text{ m/s}^2$). Panjang langkah dinamis $\approx \text{Tinggi Badan} \times 0,415$ (default $0,72\text{ m}$).
     - **Lari (*Running*)**: Cadence $> 140\text{ langkah/menit}$ atau amplitudo hentakan vertikal $> 16\text{ m/s}^2$. Panjang langkah lari dinamis $\approx 1,05\text{--}1,25\text{ m}$.
3. **Pelacak Jarak, Waktu Tempuh, *Pace* & Peta Rute ala Strava (`navigator.geolocation.watchPosition`)**:
   - Gunakan [Web Geolocation API (`watchPosition`)](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition) dengan `enableHighAccuracy: true` untuk mencatat titik koordinat GPS $(\text{lat}, \text{lng})$ selama sesi jalan kaki atau lari berlangsung.
   - Hitung jarak tempuh presisi menggunakan **Rumus Haversine** (dengan *fallback* otomatis $\text{Jumlah Langkah} \times \text{Panjang Langkah}$ apabila pengguna berjalan di dalam ruangan/*indoor* atau di *treadmill*).
   - Hitung metrik ala Strava secara *live*:
     - **Total Steps (Langkah)** & **Target Harian** (mis. `6,420 / 8,000 steps`).
     - **Elapsed Time (Waktu Tempuh)**: Stopwatch `MM:SS` / `HH:MM:SS`.
     - **Distance (Jarak Tempuh)**: dalam Kilometer (`km`).
     - **Average Pace (Kecepatan Tempuh)**: dalam format Strava **`min/km`** (mis. `6'15" /km` untuk lari atau `11'30" /km` untuk jalan santai) serta kecepatan `km/h`.
     - **Calories Burned (Kalori)**: dihitung dari rumus METs ($\text{MET} \times 3,5 \times \text{BB (kg)} / 200 \times \text{menit}$, di mana MET Jalan $= 3,8$ dan MET Lari $= 8,5$).
   - Gambar **Visualisasi Jalur Rute Live (*Strava-Style Neon Polyline Route Canvas*)** di atas kanvas peta gelap ber-grid yang menampilkan titik *Start*, garis lintasan lari/jalan berwarna *Strava Orange / Emerald*, *Split per Km*, dan titik posisi saat ini.

### B. Penempatan UI `ceKKes Move (Walk & Run)` agar Tetap Bersih & Mobile-Friendly
1. **Di Tab 1 (`24h Routine`)**:
   - Tambahkan **Kartu Aktivitas Fisik & Langkah 24 Jam (`🏃 Walk & Run Activity — Strava Mode`)** tepat di bawah/bersama Grid 2x2 rutinitas harian yang menampilkan:
     - Ringkasan cepat hari ini: **`4,850 Steps • 3.6 km • 42 min • 245 kcal`** (terbagi menjadi *Walking: 3.1 km* & *Running: 0.5 km*).
     - Tombol **`[▶️ Start Walk / Run Tracker]`** dan tombol simulasi cepat untuk juri: **`[⚡ Simulate 5K Run]`** / **`[🚶 Simulate 30m Walk]`**.
2. **Modal / Panel `Strava-Style Live Workout Tracker`**:
   - Saat pengguna menekan **`[▶️ Start Walk / Run Tracker]`** (atau membukanya dari *Deep Check*), tampilkan layar pelacak olahraga bergaya Strava yang menampilkan:
     - Pilihan Mode: **`🚶 Walking`**, **`🏃 Running`**, atau **`🤖 Auto-Detect (IMU)`**.
     - Layar angka besar **Waktu Tempuh (`00:24:18`)**, **Jarak (`3.42 km`)**, **Langkah (`4,120 steps`)**, **Pace (`7'06" /km`)**, **Cadence (`152 spm`)**, dan **Kalori (`218 kcal`)**.
     - **Kanvas Lintasan Rute GPS & Gelombang Hentakan Kaki IMU** secara *real-time*.
     - Tombol **`[▶️ Start GPS + IMU]`**, **`[⏸️ Pause]`**, **`[⚡ Simulate Active Run (Demo)]`**, dan **`[⏹️ Finish & Sync to Doctor AI]`**.
3. **Integrasi Otonom ke Suara Dokter Digital & Resep `Plan` (Tab 3)**:
   - Begitu sesi jalan/lari selesai (atau saat jumlah langkah harian tinggi/kurang gerak), **Suara Dokter Digital** dan **Tab `Plan`** otomatis menyesuaikan rekomendasi:
     - **Jika Habis Lari / Langkah Tinggi (> 7.000 langkah)**: Otomatis menambahkan tambahan target **Air Putih & Elektrolit Alami** ($+500\text{--}800\text{ ml}$ air kelapa murni / oralit ringan), **Makanan Pemulihan Otot** (pisang + protein), **Herbal Anti-Pegal** (seduhan jahe merah hangat 2g + kompres hangat/oles minyak sereh wangi di betis), serta **OTC Topikal** (gel *Menthol / Methyl Salicylate* jika terdeteksi beban langkah berat).
     - **Jika Kurang Gerak / Sedentary (< 2.000 langkah padahal *screen time* tinggi)**: Dokter Digital mengingatkan pengguna untuk berjalan kaki 15 menit (1.500 langkah) guna melancarkan sirkulasi darah dan menurunkan ketegangan leher/mata.

---

## 3. GLOBAL BILINGUAL (`EN | ID`) DI SELURUH `ngopi.top` + 4 PERBAIKAN PRESISI `/cekkes`

1. **Global Language Switcher (`EN | ID`) di Seluruh `ngopi.top`**:
   - Sinkronkan state bahasa (`'en'` atau `'id'`) di `localStorage` (`ngopi_lang`) untuk seluruh halaman: **Landing Page (`ngopi.top`)**, **Ruang Komunikasi (`/warkop`)**, **Menu Drawer Warung Kopi** (*Cafe Partnership MoU, NGOPINOMIC, ceKKes, Merchant Dashboard, Language, Help Center, Contacts, Privacy, Terms*), **Notifikasi Android/Web**, dan **Halaman `/cekkes`**.
2. **Bersihkan String Bahasa Indonesia yang Bocor Saat Mode `EN` Aktif**:
   - Ubah `17 /mnt` menjadi **`17 /min`** saat `EN` aktif.
   - Ubah `1.860–2.170 ml/hari` menjadi **`1,860–2,170 ml/day`** saat `EN` aktif.
   - Pastikan judul dan isi **Notifikasi Sistem Android / Web** menggunakan Bahasa Inggris saat mode `EN` aktif.
3. **Sinkronkan Angka Badge `Plan (0)` vs `Plan (1)` & Perbaiki Logika Banner Alert**:
   - Pastikan tombol `Plan (X) ->` di Tab *Deep Check* dan badge `Plan (X)` di *Bottom Navigation* membaca jumlah rekomendasi aktif yang sama persis.
   - Perbaiki teks banner biru `24h Routine Report Ready` agar hanya menyebutkan metrik yang benar-benar berstatus *Alert* (atau set kedipan mata ke `7 /min (Alert)` saat skenario *Screen & Finger* / *Demo* aktif).
4. **Sembunyikan Banner Biru `24h Routine Report Ready` Saat Berada di Tab `Deep Check` dan `Plan`**:
   - Tampilkan banner biru tersebut hanya di Tab 1 (`24h Routine`) atau saat tombol `Test 24h Alert` ditekan, dan sembunyikan otomatis ketika pengguna berpindah ke tab `Deep Check` atau `Plan`.

---

## 4. TAHAP EKSEKUSI & VERIFIKASI DI ANTIGRAVITY IDE

1. Terapkan **Global Bilingual (`EN | ID`)** di seluruh halaman dan menu `ngopi.top`.
2. **Jangan mengubah kode komponen tombol floating `☕ AI` eksisting**.
3. Tambahkan modul **`ceKKes Move (Strava-Style Walk & Run Tracker)`** lengkap dengan sensor *Accelerometer Step Counter*, *GPS Geolocation Distance/Pace*, kanvas rute *live*, tombol simulasi lari/jalan 1-klik untuk demo juri, serta integrasi otomatis ke Suara Dokter Digital dan resep pemulihan di Tab `Plan`.
4. Terapkan ke-4 perbaikan presisi di Bagian 3, jalankan *build*, dan verifikasi di browser sampai bebas *error*.