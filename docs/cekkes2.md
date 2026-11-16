# PROMPT SPESIFIKASI RE-ARSITEKTUR MOBILE-FIRST UX: ceKKes (Cek Kesehatan Mandiri) — Autonomous 24/7 AI Doctor Assistant untuk ngopi.top

**Target Eksekusi:** [Google Antigravity IDE](https://antigravity.google/product/antigravity-ide/) / [Antigravity Agent](https://aistudio.google.com/docs/antigravity-agent)
**Target Codebase:** Proyek Aplikasi **`ngopi.top`** (Eksisting di `/cekkes` dan `/warkop`)
**Nama Halaman & Fitur:** **`ceKKes` (Cek Kesehatan Mandiri)** — Route: `/cekkes`
**Kompetisi Target:**
1. [Future Health Digital Innovation Challenge - Hack2skill & Abu Dhabi](https://hack2skill.com/event/futurehealthchallenge/) (Deadline: **20 November 2026** | Track: *Wellbeing* & *Population Health*)
2. [Create AI Agents Championship - Dubai Chamber of Digital Economy](https://www.dubaichamberdigital.com/en/create-ai-agents) (Kategori: *Best Personal Agent* / *Best Societal Agent*)

---

## 1. VISI UTAMA PEROMBAKAN UX (MENGAPA HARUS DIUBAH SEKARANG)

Tampilan `/cekkes` versi sebelumnya **terlalu padat teks penjelasan (wall of text), belum nyaman di layar HP (kurang mobile-friendly), dan membuat pengguna bingung harus mulai dari mana**.

**Filosofi Baru yang Wajib Anda Bangun (Progressive Disclosure & Zero-Effort UX):**
Selama 24 jam (kecuali saat tidur), pengguna selalu memegang HP, jari-jarinya menyentuh layar, matanya menatap layar, dan suaranya berbicara melalui panggilan telepon/WhatsApp/Telegram/`ngopi.top`. Oleh karena itu, **pengguna TIDAK BOLEH disambut oleh halaman penuh teks instruksi rumit**. Sebaliknya, aplikasi `ceKKes` harus bekerja dengan **3 Alur Pengalaman Bertahap (3-Step Journey)** yang sangat sederhana, intuitif, dan ramah layar HP:

1. **TAHAP 1: NOTIFIKASI PROAKTIF & SUARA DOKTER DIGITAL (24-Hour Passive Trigger)**
   - Saat pengguna beraktivitas normal (di `/warkop` atau baru membuka `ngopi.top`), **Autonomous AI Agent** bekerja di latar belakang menganalisis 4 rutinitas harian (Genggaman HP, Sentuhan Jari, Tatapan Mata, dan Suara Telepon).
   - Begitu terdeteksi kelelahan atau pada jam laporan harian, muncul **Smart Notification Banner** yang ringkas di bagian atas layar dengan **2 tombol utama**:
     - **`[📊 Lihat Dashboard Kesehatan]`**: Jika diklik, langsung membuka ringkasan visual Dashboard 24 Jam yang bersih.
     - **`[🔊 Dengarkan Dokter Digital]`**: Jika diklik, langsung memutar **suara asisten/dokter digital (Web Speech API `speechSynthesis` + Gelombang Audio Interaktif)** yang menyapa pengguna dengan hangat, membacakan kondisi tubuhnya saat ini dari hasil pemantauan layar HP selama 24 jam, dan menyampaikan saran penanganan awalnya secara lisan!
2. **TAHAP 2: DASHBOARD VISUAL 24 JAM & REKOMENDASI OTOMATIS (Clean Mobile Dashboard)**
   - Halaman utama `/cekkes` tampil bersih seperti aplikasi kesehatan modern (seperti Apple Health / Oura / Whoop) dengan **Skor Kesehatan 24 Jam (Lingkaran Besar)**, **Pemutar Suara Dokter Digital**, **4 Kartu Ikon Ringkas (2x2 Grid)** untuk 4 aktivitas rutin (Genggaman, Jari, Mata, Suara), dan **Kartu Rekomendasi Otomatis (Obat OTC, Herbal, Makanan/Minuman & Checklist Jadwal)** yang disusun rapi dengan *Accordion* (bisa dibuka-tutup agar tidak membanjiri layar HP).
3. **TAHAP 3: PEMERIKSAAN LANJUTAN 6 SENSOR INTERAKTIF (On-Demand Deep Check)**
   - Di bawah kesimpulan Dashboard 24 Jam, Dokter Digital bertanya: *"Ingin pemeriksaan fisik lebih detail pada bagian tubuh yang dikeluhkan?"*
   - Pengguna cukup menekan **1 dari 6 Kartu Ikon Besar** (Jari PPG, Mata, Dada/Perut/Ginjal, Rekam Suara Keluhan, Kamera Mata/Mulut/Kulit, atau Terapi Termal 43°C). Saat salah satu ikon diklik, barulah muncul **Bottom Sheet / Modal Wizard Langkah-demi-Langkah** untuk sensor tersebut (dilengkapi grafik gelombang *live* dan panduan singkat), lalu hasilnya otomatis memperbarui resep Obat OTC, Herbal, dan Nutrisi!

---

## 2. PERBAIKAN TATA LETAK MOBILE (MOBILE-FIRST UI FIXES WAJIB)

Perbaiki seluruh kelemahan tampilan mobile dari versi sebelumnya:
1. **Perbaiki Sticky Header yang Terlalu Tinggi**:
   - Di versi sebelumnya, header atas memakan hampir **35% tinggi layar HP** dan memiliki **dua tombol panah kembali (`←`) yang bertumpuk**.
   - **Solusi**: Buat **Compact Single-Row Sticky Header (tinggi maksimal 56px)** berisi: `[← Kembali]` + Judul `ceKKes AI` + Badge hijau `● 24h Active` + Toggle Bahasa `EN | ID` + Ikon Info Klinis `🛡️`.
2. **Gunakan Bottom Navigation Bar (Navigasi Bawah Ramah Ibu Jari)**:
   - Pindahkan ke-3 menu utama dari tombol bertumpuk di atas menjadi **Fixed Bottom Navigation Bar** (atau *Segmented Pill Tab* 1 baris yang ringkas) dengan 3 tab jelas:
     - **`📊 24h Routine`** (Dashboard Pasif & Dokter Suara)
     - **`🩺 Cek Detail`** (6 Ikon Sensor Interaktif)
     - **`💊 Resep & Jadwal`** (OTC, Herbal, Nutrisi & Checklist Kronologis)
3. **Pangkas Teks Penjelasan Panjang menjadi *Clean Visual Cards* + *Expandable Details***:
   - Jangan menampilkan paragraf penjelasan medis panjang secara langsung di kartu utama. Gunakan angka metrik besar, badge status berwarna (*Aman / Waspada / Perlu Istirahat*), dan tombol kecil `Lihat Detail` (*accordion*) jika pengguna ingin membaca penjelasan ilmiahnya.
4. **Urutkan Jadwal Pengingat Harian secara Kronologis**:
   - Pada Tab Resep & Jadwal, urutkan checklist waktu secara benar dari pagi ke malam: **`07:00 Pagi` → `12:30 Siang` → `16:30 Sore` → `20:30 Malam`** (di versi sebelumnya urutan waktunya melompat `16:30` dulu baru `07:00`).

---

## 3. SPESIFIKASI FITUR BARU: NOTIFIKASI PINTAR & AUDIO DOKTER DIGITAL (VOICE AI DOCTOR)

### A. Smart Notification Toast / Banner (Di `/warkop` & di Atas `/cekkes`)
* Buat komponen **Autonomous Health Notification Banner** yang muncul secara elegan (dan memiliki tombol simulasi *"🔔 Simulasikan Notifikasi 24 Jam"* untuk keperluan demo kompetisi):
  * **Tampilan Banner**:
    > **🩺 dr. ceKKes AI — Laporan Rutinitas 24 Jam Anda Siap**
    > *"Dari aktivitas layar & suara telepon hari ini, terdeteksi kelelahan mata (kedipan 7x/mnt) & ketegangan saraf jari (435ms)."*
    > **`[📊 Buka Dashboard]`**  **`[🔊 Putar Suara Dokter]`**
* Jika pengguna mengklik **`[📊 Buka Dashboard]`**, halaman otomatis mengarah/menggulir ke ringkasan visual Dashboard 24 Jam dan menyorot bagian tubuh yang memerlukan perhatian.
* Jika pengguna mengklik **`[🔊 Putar Suara Dokter]`**, sistem langsung menjalankan **Audio Digital Doctor Briefing**.

### B. Audio Digital Doctor Briefing (`Web Speech API` + Visual Audio Waveform)
* Buat kartu khusus **Asisten Suara Dokter Digital (`dr. ceKKes Voice Assistant`)** di bagian atas halaman `/cekkes`:
  * Dilengkapi tombol **`[▶️ Dengarkan Penjelasan Dokter Digital]`** / **`[⏹️ Hentikan Suara]`**, pengatur bahasa suara (`id-ID` untuk Bahasa Indonesia / `en-US` untuk Bahasa Inggris mengikuti toggle `EN | ID`), dan animasi bar gelombang suara (*audio equalizer bars*) saat dokter berbicara.
  * **Naskah Suara Dinamis (Otomatis Menyesuaikan Kondisi Sensor 24 Jam)**:
    - *Contoh dalam Bahasa Indonesia (`id-ID`)*:
      > *"Halo, saya dokter digital ceKKes Anda. Berdasarkan pemantauan otomatis selama 24 jam dari aktivitas Anda memegang handphone, mengetik di layar, menatap layar, dan berbicara di telepon: saat ini kondisi detak jantung pasif Anda 72 kali per menit, namun saya mendeteksi kelelahan pada saraf jari sebesar 86 persen dengan getaran halus 3,8 Hertz, serta mata mulai kering karena kedipan turun menjadi 7 kali per menit. Untuk penanganan awal hari ini, saya merekomendasikan istirahat layar sejenak, tetes mata pelembap bebas resep, vitamin neurotropik B-kompleks sesudah makan, serta seduhan hangat daun pegagan dan bunga krisan sore nanti. Jika Anda merasakan keluhan lain di dada, perut, kulit, atau tenggorokan, silakan sentuh menu Cek Detail di bawah untuk pemeriksaan langsung dengan sensor handphone Anda."*
    - *Contoh dalam Bahasa Inggris (`en-US` untuk Juri Hack2skill)*:
      > *"Hello, I am your ceKKes Digital Health Assistant. Based on 24-hour passive monitoring of how you hold your phone, touch the screen, gaze at the display, and speak during calls: your passive heart rate is stable at 72 BPM, but I detected fine motor finger fatigue at 86 percent with a 3.8 Hertz micro-tremor and reduced eye blinking. For early self-care today, I have prepared a personalized OTC, herbal, and hydration schedule below. If you want to examine a specific symptom on your chest, abdomen, eyes, mouth, or skin, tap the Deep Check tab to use your phone's active sensors."*
  * Pastikan implementasi `window.speechSynthesis` memiliki *fallback* visual teks berjalan (*live captions/transcript*) dan gelombang suara sintetis via `AudioContext` sehingga tetap bekerja mulus di semua browser Android, iOS, maupun Desktop saat direkam dengan OBS Studio.

---

## 4. SPESIFIKASI 3 TAB UTAMA DENGAN DESAIN BARU YANG NYAMAN DI HP

### TAB 1: `📊 24h Routine` (Dashboard Rutinitas 24 Jam & Rekomendasi Awal Otomatis)
Saat pengguna membuka `/cekkes` (atau mengklik notifikasi), mereka melihat tampilan yang sangat bersih dan terstruktur:
1. **Kartu Utama Skor 24 Jam & Dokter Suara**:
   - Lingkaran indikator **Skor Kebugaran Harian (mis. `74 / 100 — Perlu Istirahat Ringan`)** + Tombol besar **`[🔊 Dengarkan Analisis Dokter Digital]`**.
   - Baris *Chip Skenario Cepat* (untuk simulasi 1-klik: *Normal*, *Layar & Jari Lelah*, *Suara Telepon Serak*, *Stres Tinggi*).
2. **Grid 2x2 Ringkas: 4 Aktivitas Rutin 24 Jam**:
   - **Kartu 1: Genggaman & Postur (IMU)** → Ikon Tangan, angka utama `3.8 Hz` & Sudut `39°`, badge status.
   - **Kartu 2: Sentuhan Jari (`/warkop`)** → Ikon Jari Sentuh, angka utama `435 ms`, Kelelahan `86%`, badge status.
   - **Kartu 3: Tatapan Mata (Kamera)** → Ikon Mata, angka utama `17 /mnt`, HR Pasif `72 bpm`, badge status.
   - **Kartu 4: Suara Telepon & WA/App** → Ikon Telepon/Suara, angka utama `86% Energi`, HNR `21.4 dB`, badge status.
   - *(Setiap kartu memiliki tombol kecil `+ Detail / Simulasi` jika pengguna ingin mengubah angka atau mencoba kotak ketik sandbox, sehingga halaman utama tetap pendek dan rapi).*
3. **Kartu Rekomendasi Otomatis 24 Jam (Langsung Muncul Tanpa Perlu Pindah Tab)**:
   - Menampilkan ringkasan **Solusi Penanganan Awal Hari Ini** berdasarkan ke-4 aktivitas rutin di atas (1 kartu ringkas untuk Obat OTC, 1 untuk Herbal, 1 untuk Air Putih & Nutrisi) + tombol **`[Lihat Dosis Lengkap & Jadwal →]`**.
4. **Kartu Ajakan Pemeriksaan Lanjutan (Bridge to Active Sensors)**:
   - Banner ramah di bagian bawah Tab 1:
     > **🔍 Ada keluhan spesifik di tubuh Anda hari ini?**
     > *Gunakan sensor HP Anda untuk memeriksa denyut jari, detak jantung di dada, bising lambung di perut, foto mata/mulut/kulit, atau terapi hangat kulit.*
     > **`[🩺 Mulai Pemeriksaan Sensor Detail →]`** (Membuka Tab 2).

### TAB 2: `🩺 Cek Detail` (Pemeriksaan Interaktif 6 Sensor — Desain Ikon Bertahap)
Jangan menumpuk 6 kotak teks panjang sekaligus! Tampilkan **Grid 6 Kartu Ikon Visual yang Bersih**:
1. **👆 Sentuhan Jari (Nadi PPG & Motorik)** — *Tempel jari di kamera belakang / ketuk layar*.
2. **👁️ Tatapan & Kelelahan Mata** — *Uji ketahanan lapisan air mata & fokus layar*.
3. **❤️ Dada, Perut & Skrining Ginjal** — *Tempel HP di dada (detak jantung SCG) & perut (lambung), plus cek kelopak mata untuk ginjal*.
4. **🗣️ Suara & Keluhan Bicara** — *Ucapkan "Aaaaa..." & ceritakan keluhan Anda ke mikrofon*.
5. **📸 Foto Mata, Mulut & Kulit** — *Potret kelopak mata pucat, lidah, atau kulit gatal/jamur/kutil*.
6. **🌡️ Terapi Hangat Kulit (43°C Timer)** — *Panduan kompres hangat aman untuk kutil/bisul & peringatan bahaya panas baterai HP*.

**Cara Kerja Interaktif di Tab 2**:
- Saat pengguna menyentuh salah satu dari 6 kartu ikon di atas, buka **Panel Pemeriksaan Fokus (Active Sensor View)** untuk modul tersebut yang dilengkapi:
  - **Panduan Singkat 1 Kalimat + Ilustrasi Posisi HP**.
  - **Layar Grafik Sinyal Live (`<canvas>` Waveform / Spektrum Audio / Bingkai Kamera)**.
  - **Tombol Mulai / Simulasi Hasil Cepat** -> Begitu selesai (5–15 detik), Dokter Digital membacakan hasilnya lewat suara dan otomatis menambahkan obat/herbal yang sesuai ke Tab 3!
  - *(Pastikan catatan medis tentang ginjal retroperitoneal di Modul 3 dan larangan menempelkan bodi HP panas > 44°C ke kulit yang luka/eksim/jamur di Modul 6 tetap ditampilkan dengan jelas dan rapi di dalam modul masing-masing).*

### TAB 3: `💊 Resep & Jadwal` (OTC, Herbal, Makanan/Minuman & Checklist Kronologis)
1. **Bar Profil Ringkas (Collapsible Pill)**: Menampilkan `Usia: 50 thn • BB: 80 kg • Alergi: Tidak ada • Target Air: 2.600 ml/hari` dengan tombol `[Ubah Profil & Cek Gejala Darurat / Red Flags]` agar formulir input tidak memenuhi separuh layar atas.
2. **Kartu Rekomendasi Terstruktur (OTC, Herbal & Nutrisi)**:
   - **Obat Bebas (OTC)** lengkap dengan badge Hijau/Biru, dosis terukur, frekuensi, dan aturan pakai.
   - **Obat Herbal & Tanaman Obat (Fitofarmaka)** lengkap dengan takaran gramasi/ml dan cara seduh/oles.
   - **Makanan, Minuman & Hidrasi** sesuai berat badan dan keluhan.
3. **Jadwal Pengingat Harian (Urutan Kronologis yang Benar)**:
   - Urutkan selalu dari pagi ke malam:
     - `07:00 Pagi` — Hidrasi Awal & Sarapan Seimbang / Obat Pagi
     - `12:30 Siang` — Nutrisi Siang & Evaluasi Postur/Mata
     - `16:30 Sore` — Peregangan Pergelangan, Seduhan Herbal & Vitamin
     - `20:30 Malam` — Terapi Kompres Hangat (bila ada indikasi kutil) & Protokol Tidur Berkualitas
4. **Tombol Ekspor Laporan & Penalaran AI**:
   - Panel *collapsible* **`🧠 Lihat Alur Penalaran Agent AI (Agentic Reasoning Trace)`** dan tombol **`[📄 Cetak / Simpan Ringkasan Medis]`**.

---

## 5. KEPATUHAN KOMPETISI HACK2SKILL (TETAP SERTAKAN SECARA RAPI)

1. **Toggle Bahasa `EN | ID`** di header atas agar juri internasional [Future Health Digital Innovation Challenge](https://hack2skill.com/event/futurehealthchallenge/) dapat menilai dalam Bahasa Inggris maupun Bahasa Indonesia, termasuk suara Dokter Digital (`en-US` dan `id-ID`).
2. **Modal `🛡️ Info Klinis, Asumsi & Batasan`** di ikon perisai header atas yang memuat *Non-Diagnostic Disclaimer*, *On-Device Zero-Content Privacy*, serta asumsi dan batasan teknis (optik, akustik, anatomi ginjal, dan batas termal kulit 44°C).
3. **Tombol `⚡ Demo Juri (1-Klik)`** yang langsung memicu **Notifikasi 24 Jam + Suara Dokter Digital + Simulasi Pemeriksaan Sensor** sehingga sangat mudah direkam menjadi video demo < 3 menit.

---

## 6. TAHAP EKSEKUSI & VERIFIKASI DI ANTIGRAVITY IDE

1. Buka kode halaman `/cekkes` di proyek `ngopi.top`.
2. Rombak tata letak menjadi **Mobile-First UX** yang bersih sesuai Bagian 1–5 di atas (Compact Header 1 baris tanpa panah ganda, Smart Notification Banner 24 Jam, Audio Digital Doctor dengan `speechSynthesis` + animasi gelombang suara, Grid 2x2 untuk 4 aktivitas pasif, Grid 6 Kartu Ikon untuk pemeriksaan aktif, serta urutan jadwal kronologis 07:00 → 12:30 → 16:30 → 20:30).
3. Jalankan *build* dan nyalakan *dev server*.
4. Uji coba di tampilan mobile browser: pastikan klik notifikasi membuka dashboard, klik tombol audio mengeluarkan suara penjelasan dokter digital, dan perpindahan dari hasil pemantauan 24 jam ke pemeriksaan detail 6 sensor terasa sangat mudah dipahami oleh pengguna awam.