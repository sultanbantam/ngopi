# PROMPT SPESIFIKASI INTEGRASI MODUL: ceKKes (Cek Kesehatan Mandiri) — Autonomous AI Agent untuk ngopi.top

**Target Eksekusi:** [Google Antigravity IDE](https://antigravity.google/product/antigravity-ide/) / [Antigravity Agent](https://aistudio.google.com/docs/antigravity-agent)
**Target Codebase:** Proyek Aplikasi **`ngopi.top`** (Eksisting)
**Nama Halaman & Fitur:** **`ceKKes` (Cek Kesehatan Mandiri)** — Route: `/cekkes`
**Kompetisi Target:** [Create AI Agents Championship - Dubai Chamber of Digital Economy](https://www.dubaichamberdigital.com/en/create-ai-agents) (Kategori: *Best Personal Agent* / *Best Societal Agent*)

## 1. INSTRUKSI UTAMA UNTUK AGENT AI ANTIGRAVITY (SYSTEM ROLE & INTEGRATION MANDATE)

Anda adalah Principal Full-Stack Engineer, Mobile Sensor Specialist, dan Medical AI Architect.
**INSTRUKSI KRITIS:** **JANGAN** membuat proyek baru dari nol dan **JANGAN** menghapus atau merusak fitur aplikasi **`ngopi.top`** yang sudah berjalan (seperti ruang obrolan `/warkop`, *Voice Call*, *Video Call*, Email `@ngopi.top`, dan *Nomor Ngopi*). Tugas Anda adalah mengintegrasikan fitur **Autonomous Health AI Agent** bernama **`ceKKes` (Cek Kesehatan Mandiri)** sebagai halaman dan modul tambahan di dalam *codebase* **`ngopi.top`** yang sudah ada.

Halaman **`ceKKes` (`/cekkes`)** menggabungkan dua mesin utama yang langsung terhubung dengan aktivitas pengguna di `ngopi.top`:

1. **Passive Digital Phenotyping Engine (Pemantauan Latar Belakang 4 Aktivitas Harian di `ngopi.top`)**: Secara otomatis mendeteksi, mencatat, merangkum, dan melaporkan kesehatan harian pengguna dalam bentuk **Dashboard Harian `ceKKes`** dari 4 aktivitas utama saat menggunakan aplikasi `ngopi.top` di HP, iPad, atau Tablet:
   * **(1) Memegang HP/Tablet** (Sensor IMU: *Accelerometer* & *Gyroscope* untuk mendeteksi tremor tangan dan sudut postur leher selama membuka `ngopi.top`).
   * **(2) Jari Menyentuh Layar** (*Keystroke & Touch Dynamics* saat mengetik pesan *chat* di `/warkop` atau menulis email `@ngopi.top` untuk mendeteksi kelelahan motorik halus dan kognitif tanpa menyadap isi teks pesan).
   * **(3) Mata Menatap Layar** (Kamera Depan saat menatap layar atau melakukan *Video Call* di `ngopi.top` untuk menghitung *blink rate*, fiksasi tatapan, dan *Passive Facial rPPG* untuk detak jantung/stres).
   * **(4) Aktivitas Menelepon / Berbicara** (Mikrofon Pasif saat pengguna melakukan panggilan suara *Voice Call*, *Video Call*, atau pesan suara di `ngopi.top` menggunakan *Passive Vocal Biomarkers* untuk mendeteksi kelelahan vokal, serak, frekuensi napas, dan tingkat stres akustik tanpa merekam isi percakapan).

2. **Active 6-Point Multi-Sensor Diagnostic Engine (Pemeriksaan Mandiri Aktif `ceKKes`)**: Memungkinkan pengguna melakukan pemeriksaan fisik mandiri secara langsung menggunakan sensor perangkat, diikuti dengan **Rekomendasi Penanganan Awal Otonom** yang mencakup **Obat Bebas (OTC), Obat Herbal / Tanaman Obat (Fitofarmaka), serta Makanan & Minuman Fungsional** lengkap dengan takaran/dosis, jadwal waktu konsumsi, dan peringatan keamanan medis.

Bangun dan integrasikan halaman **`ceKKes`** ini secara lengkap, interaktif, memiliki *real sensor integration* (Web API untuk kamera, mikrofon, *device motion/orientation*, dan *touch/keystroke events*) yang dilengkapi dengan **Interactive Simulation Mode** (sehingga juri kompetisi maupun pengguna di desktop/mobile dapat menguji seluruh skenario sensor secara langsung), jalankan *dev server*, dan pastikan tidak ada *error* di terminal maupun konsol browser.

## 2. ARSITEKTUR INTEGRASI KE CODEBASE `ngopi.top`

Ikuti langkah arsitektur berikut saat menyuntikkan modul **`ceKKes`** ke dalam `ngopi.top`:

* **Penyesuaian Stack & Struktur Proyek**:
  * Inspeksi `package.json`, sistem *routing* (React Router / Next.js / Vite / struktur halaman eksisting), dan *state management* di `ngopi.top` terlebih dahulu.
  * Gunakan *library* ikon dan komponen yang kompatibel dengan `ngopi.top` (seperti Lucide Icons, Tailwind CSS, dan Chart.js / Recharts / Canvas grafik).
* **Routing & Navigasi (`ceKKes`)**:
  * Buat halaman utama fitur ini pada rute **`/cekkes`** (serta dukung alias `/health` atau komponen tab di dalam `/warkop` sesuai struktur `ngopi.top`).
  * Tambahkan tombol akses cepat berlabel **"ceKKes (Cek Kesehatan Mandiri)"** lengkap dengan indikator status *Agent Active* pada *Sidebar / Header Navigation* di halaman utama `ngopi.top` dan di ruang komunikasi `/warkop`.
* **Keselarasan Identitas Visual (`ngopi.top` Theme Harmony)**:
  * Padukan estetika khas **`ngopi.top`** (**Dark Espresso** `#1A120B` / `#120D08`, **Rich Coffee Surface** `#261C15`, dan aksen **Warm Gold / Amber** `#D4AF37` / `#F59E0B`) dengan indikator warna klinis medis (**Emerald Health Green** `#10B981` untuk kondisi normal, **Medical Cyan/Cobalt** `#0EA5E9` untuk telemetri sensor, dan **Rose/Red Alert** `#F43F5E` untuk peringatan klinis) sehingga halaman **`ceKKes`** terlihat menyatu secara elegan sebagai fitur bawaan `ngopi.top`.
* **Global Passive Telemetry Hook (`useCekkesPassiveAgent`)**:
  * Buat *provider* atau *background hook* ringan yang dipasang di level aplikasi agar saat pengguna beraktivitas di `/warkop` (mengetik *chat*, *scrolling*, melakukan *voice call* atau *video call*), metrik kesehatannya otomatis tercatat ke `localStorage` (`ngopi_cekkes_telemetry`) dan langsung ter-update di Dashboard **`ceKKes`** (*100% On-Device Privacy*).

## 3. FITUR INTI 1: DASHBOARD HARIAN OTOMATIS `ceKKes` (4 AKTIVITAS PASIF PENGGUNA)

Buat tab pertama di halaman `/cekkes` bernama **"Dashboard Harian (Passive Agent)"** yang menampilkan laporan otomatis dari 4 aktivitas keseharian pengguna selama menggunakan perangkat dan berkomunikasi di `ngopi.top`:

### A. 4 Modul Deteksi Aktivitas Pasif

1. **Aktivitas 1 — Memegang Perangkat (Grip & Postural Biomechanics)**
   * **Cara Kerja**: Membaca fluktuasi *Accelerometer* (`devicemotion` sumbu X, Y, Z) pada pita frekuensi [3–12 Hz](https://www.mdpi.com/1424-8220/26/18/5981) untuk mengukur *Micro-Tremor Index* (stabilitas genggaman tangan) dan membaca sudut kemiringan (`deviceorientation` *pitch angle*) untuk mendeteksi *Text Neck Syndrome* (sudut tunduk leher di bawah 35° dalam durasi lama).
   * **Output Metrik**: Frekuensi Tremor (Hz), Sudut Postur Rata-rata (°), Durasi Beban Statis Pergelangan Tangan (jam).

2. **Aktivitas 2 — Jari Menyentuh Layar di `ngopi.top/warkop` (Keystroke & Touch Dynamics)**
   * **Cara Kerja**: Mengukur [dinamika ketikan dan sentuhan layar](https://pmc.ncbi.nlm.nih.gov/articles/PMC8358561/) saat pengguna mengetik pesan/email atau menggeser layar, meliputi *Dwell/Hold Time* (ms), *Flight Time* atau jeda antar-ketukan (ms), rasio koreksi (*backspace rate*), dan deviasi kelengkungan jalur *swipe* ([evaluasi rentang gerak sendi jari](https://escholarship.org/content/qt3gg3w87k/qt3gg3w87k.pdf)).
   * **Output Metrik**: Kecepatan Respon Motorik Halus (ms), Indeks Kelelahan Jari & Kognitif (%), Akurasi Koordinasi Sentuh.

3. **Aktivitas 3 — Mata Menatap Layar & Video Call (Ocular Strain & Facial rPPG)**
   * **Cara Kerja**: Menggunakan kamera depan secara periodik (atau selama sesi *Video Call* di `ngopi.top`) untuk menghitung laju kedipan mata ([normal 15–20 kedipan/menit vs risiko mata kering 5–7 kedipan/menit](https://www.proeye.com/blog/digital-eye-strain-how-screen-time-affects-your-vision)), jarak pandang layar (cm), serta mengekstrak sinyal [Passive Heart Rate Monitoring (PHRM / rPPG)](https://research.google/blog/towards-passive-heart-health-monitoring-via-smartphone-camera/) dan [Heart Rate Variability (HRV)](https://www.mdpi.com/2306-5354/10/7/851) dari perubahan mikro-warna kulit wajah saat menatap layar.
   * **Output Metrik**: Laju Kedipan (x/menit), Durasi *Screen Time* Aktif (jam), Detak Jantung Pasif (bpm), dan Skor Stres Otonom (HRV RMSSD dalam ms).

4. **Aktivitas 4 — Menelepon di `ngopi.top` (Passive Call Vocal Biomarkers)**
   * **Cara Kerja**: Saat pengguna melakukan panggilan suara (*Voice Call* / *Video Call* melalui Nomor Ngopi) atau berbicara, agen menganalisis sinyal akustik suara secara *real-time* di perangkat menggunakan `AudioContext` & `AnalyserNode` (*Zero Content Recording* — hanya mengekstrak fitur matematis gelombang suara, bukan menyadap teks pembicaraan). Parameter yang dihitung mengikuti standar [Vocal Biomarkers Klinis](https://pmc.ncbi.nlm.nih.gov/articles/PMC12293195/):
     * *Fundamental Frequency ($F_0$ / Pitch Variability)*: Penurunan variasi *pitch* (suara monoton) berkorelasi dengan kelelahan mental atau [gejala depresi/stres](https://www.psychiatry.org/news-room/apa-blogs/vocal-biomarkers-for-mental-health/).
     * *Jitter & Shimmer*: Ketidakstabilan mikro pada frekuensi dan amplitudo pita suara untuk mendeteksi iritasi laring, suara serak, atau gejala awal infeksi saluran pernapasan atas (ISPA).
     * *Harmonics-to-Noise Ratio (HNR) & Breath Pause Ratio*: Menghitung jeda tarikan napas saat berbicara panjang di telepon untuk mendeteksi [kelelahan pernapasan dan fungsi paru](https://publications.ersnet.org/content/erj/66/suppl69/pa4967).
   * **Output Metrik**: Skor Energi Vokal (%), Indeks Kejernihan Pita Suara (HNR dB), Laju Napas Bicara (tarikan napas/menit), dan Durasi Menelepon Harian (menit).

### B. Fitur Komponen Dashboard Harian `ceKKes`

* **Live Telemetry Sandbox & Preset Skenario Simulasi**: Sediakan area uji ketik langsung (*Live Typing & Voice Call Simulator*) di dalam halaman `/cekkes` serta tombol *Preset* ("Hari Normal", "Overwork & Layar Intensif", "Kelelahan Vokal Telepon & ISPA Ringan", "Kelelahan Motorik & Stres Tinggi") beserta slider interaktif untuk ke-4 aktivitas agar pengguna/juri dapat menguji perubahan diagnosis agen AI secara *real-time*.
* **Grafik Tren 24 Jam (Timeline Telemetry)**: Menampilkan kurva perubahan energi vokal telepon, kecepatan ketik jari di `/warkop`, laju kedipan mata, dan detak jantung pasif dari pagi hingga malam.
* **Rangkuman Eksekutif Harian & Solusi Otomatis Agent AI**: Kartu laporan pintar yang merangkum anomali hari tersebut dan langsung mengeluarkan protokol pemulihan sore/malam hari (OTC, Herbal, Makanan/Minuman, dan Jadwal Istirahat).

## 4. FITUR INTI 2: PEMERIKSAAN AKTIF 6 MODUL SENSOR (`ceKKes` ON-DEMAND SELF-CHECK)

Buat tab kedua di halaman `/cekkes` bernama **"Pemeriksaan Aktif (6-Sensor Check)"** yang memandu pengguna melakukan pemeriksaan kesehatan mandiri langkah demi langkah:

1. **Modul 1: Sentuhan Jari (Fingertip Contact PPG & Tap Test)**
   * Mengakses kamera belakang (atau simulator gelombang PPG) untuk mengukur detak jantung (HR), saturasi/perfusi perifer, dan *Heart Rate Variability* ([PPG ujung jari](https://pmc.ncbi.nlm.nih.gov/articles/PMC5368348/)), ditambah uji ketuk cepat 15 detik (*Finger Tapping Test*) di layar untuk menguji fungsi saraf motorik.

2. **Modul 2: Intensitas Tatapan & Kelelahan Mata (Active Ocular Scan)**
   * Mengakses kamera depan dengan panduan bingkai mata untuk mengukur stabilitas lapisan air mata (*Tear Film Break-Up Time* mandiri lewat uji tahan kedip) dan respons kelelahan visual ([Digital Eye Strain](https://pmc.ncbi.nlm.nih.gov/articles/PMC12387441/)).

3. **Modul 3: Sentuhan Perangkat di Dada & Perut (SCG Cardiac & Abdominal Acoustics)**
   * **Dada (Jantung & Paru)**: Menggunakan *Accelerometer* dan *Gyroscope* untuk merekam getaran mekanis dinding dada ([Seismocardiography / SCG](https://www.mdpi.com/1424-8220/24/7/2139)) guna mendeteksi irama detak jantung dan laju pernapasan.
   * **Perut (Lambung & Pencernaan)**: Menggunakan mikrofon sensitivitas tinggi untuk merekam frekuensi bising usus (*borborygmi* / motilitas gastro-intestinal) selama 15 detik.
   * **Catatan Medis Penting pada UI (Skrining Ginjal Terintegrasi)**: Tampilkan informasi edukatif bahwa ginjal berada jauh di rongga retroperitoneal sehingga tidak memancarkan gelombang mekanis/suara ke permukaan perut; sebagai gantinya, aplikasi mengalihkan skrining awal ginjal ke **deteksi bengkak kelopak mata (*periorbital edema*) lewat kamera** dan **kuesioner pola berkemih/warna urin**.

4. **Modul 4: Analisis Suara Aktif & Keluhan (Active Voice & Symptom NLP)**
   * Pengguna menekan tombol rekam mikrofon untuk mengucapkan vokal panjang ("Aaaaa..." selama 5 detik untuk uji [biomarka vokal terstandar](https://www.mdpi.com/1424-8220/25/11/3424)) dan menyampaikan keluhan kesehatannya secara lisan/teks. Agen AI mengekstrak kata kunci gejala dan menggabungkannya dengan spektrum suara mikrofon.

5. **Modul 5: Kamera Klinis Mata, Mulut & Kulit (Clinical Computer Vision)**
   * Menyediakan fitur unggah foto atau tangkapan kamera langsung dengan 3 mode analisis:
     * **Mata (Konjungtiva & Sklera)**: Analisis kolorimetri kepucatan kelopak mata bawah untuk skrining [anemia non-invasif](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0302883) dan warna sklera kuning (*jaundice*).
     * **Mulut & Lidah**: Analisis warna dan lapisan mukosa lidah/bibir ([skrining mukosa oral](https://pmc.ncbi.nlm.nih.gov/articles/PMC10620602/)) untuk tanda dehidrasi, sariawan, atau kandidiasis oral.
     * **Permukaan Kulit**: Klasifikasi visual untuk keluhan gatal, panu/jamur (*tinea*), eksim (*dermatitis*), luka ringan, kutil (*plantar/cutaneous warts*), dan mata ikan (*clavus*).

6. **Modul 6: Asisten Terapi Termal Terukur & Peringatan Keamanan Kulit (Guided Hyperthermia & Thermal Safety Module)**
   * **Guardrail Keamanan Perangkat & Medis (Wajib Ditampilkan di UI)**: Aplikasi menampilkan peringatan keamanan bahwa **memanaskan bodi HP/tablet dan menempelkannya langsung ke kulit yang luka, eksim, atau berjamur dilarang keras** karena suhu di atas [44°C memicu luka bakar jaringan](https://www.ccjm.org/content/ccjom/29/3/156.full.pdf), memperparah inflamasi eksim, berisiko merusak baterai Lithium-Ion ([risiko *thermal burn* perangkat seluler](https://www.researchgate.net/publication/292679261_Cellular_phone_collateral_damage_A_review_of_burns_associated_with_lithium_battery_powered_mobile_devices)), serta menyebarkan spora jamur/virus HPV ke permukaan layar HP.
   * **Fungsi Pengganti yang Terbukti Klinis**:
     * Memantau estimasi suhu perangkat agar tetap di bawah batas aman (< 40°C).
     * Menyediakan **Guided Local Hyperthermia Timer & Scheduler** yang memandu pengguna menempelkan **kompres hangat bersih atau *medical warming patch* terstandar (suhu stabil 42°C–44°C)** khusus untuk indikasi yang terbukti secara klinis seperti [terapi hipertermia lokal kutil/HPV selama 30 menit/hari](https://pubmed.ncbi.nlm.nih.gov/20199243/) atau kompres hangat folikulitis/bisul ringan, lengkap dengan pengaturan waktu otomatis (berapa menit per sesi, berapa kali sehari, dan jam pelaksanaannya).
     * Secara otomatis **mengunci/melarang** rekomendasi kompres panas jika hasil pemeriksaan kulit mendeteksi eksim meradang akut, luka berdarah, atau infeksi jamur aktif (mengalihkannya ke kompres dingin atau terapi antijamur kering).

## 5. FITUR INTI 3: MESIN REKOMENDASI OTONOM (OTC, HERBAL, NUTRISI & DOSIS)

Buat tab ketiga di halaman `/cekkes` bernama **"Resep Penanganan & Jadwal Otonom (Care Plan Agent)"** yang menerima input profil pengguna (**Usia, Berat Badan, Riwayat Alergi, Kondisi Hamil/Menyusui, dan Obat Rutin**) lalu menghasilkan rekomendasi terstruktur untuk setiap temuan dari Dashboard Pasif maupun Pemeriksaan Aktif:

1. **Rekomendasi Obat Bebas Tanpa Resep (OTC / Over-The-Counter)**:
   * Mencantumkan nama zat aktif, kategori tanda bulatan hijau/biru (Obat Bebas / Bebas Terbatas), dosis spesifik berdasarkan usia/berat badan, frekuensi harian, durasi maksimal penggunaan, dan aturan pakai (sebelum/sesudah makan atau oles tipis).
   * Contoh basis data terintegrasi:
     * *Jamur / Panu / Kurap*: Krim *Clotrimazole* 1% atau *Miconazole Nitrate* 2% (oles tipis 2x sehari pagi & malam selama 2–4 minggu).
     * *Kutil / Mata Ikan*: Plester atau larutan *Salicylic Acid* 10%–20% (1x sehari malam hari setelah direndam air hangat) + jadwal terapi hipertermia lokal 43°C selama 30 menit.
     * *Eksim / Gatal Alergi Ringan*: Krim *Hydrocortisone* 1% (maksimal 2x sehari selama 5–7 hari) atau losion *Calamine* + tablet antihistamin *Cetirizine* 10 mg (1x sehari malam hari).
     * *Mata Kering Digital (Digital Eye Strain)*: Tetes mata *Sodium Hyaluronate* 0,1% atau *Carboxymethylcellulose* (1–2 tetes, 3–4x sehari).
     * *Kelelahan Saraf Jari / Tremor Kelelahan*: Vitamin Neurotropik (*Vitamin B1 100 mg, B6 100 mg, B12 5000 mcg*, 1 tablet sehari sesudah makan).
     * *Lambung / Dispepsia Ringan*: *Antasida Doen* (*Aluminium Hydroxide* + *Magnesium Hydroxide*, 1–2 tablet dikunyah 30 menit sebelum makan).
     * *Suara Serak / Iritasi Tenggorokan (Dari Deteksi Telepon)*: Lozenges antiseptik (*Dequalinium Chloride* / *Amylmetacresol*, 1 tablet hisap tiap 3–4 jam, maks 6–8 tablet/hari).

2. **Rekomendasi Obat Herbal & Tanaman Obat (Fitofarmaka / Jamu Terukur)**:
   * Mencantumkan nama tanaman herbal, bagian yang digunakan, takaran gramasi atau mililiter, cara penyeduhan/pemakaian, dan jadwal konsumsi harian.
   * Contoh basis data terintegrasi:
     * *Kesehatan Mata & Lelah Layar*: Seduhan bunga krisan (*Chrysanthemum morifolium* 3 gram dalam 200 ml air hangat, 1–2x sehari) dan ekstrak buah *Bilberry*.
     * *Kelelahan Saraf, Kognitif & Jari*: Teh daun pegagan (*Centella asiatica* 2 gram seduh air hangat sore hari) dan minyak atsiri sereh wangi (*Cymbopogon nardus*) / minyak kayu putih untuk pijat topikal pergelangan tangan.
     * *Tenggorokan & Pita Suara (Pasca Menelepon Lama)*: Seduhan kencur (*Kaempferia galanga* 3 gram parut/iris + 150 ml air hangat + 1 sdt madu murni, diminum 2x sehari pagi dan malam) atau teh akar manis (*Licorice* / *Glycyrrhiza glabra*).
     * *Keluhan Lambung & Perut*: Seduhan rimpang temulawak (*Curcuma xanthorrhiza* 3 gram) atau jahe merah (*Zingiber officinale* 2 gram) dalam 150 ml air hangat 2x sehari.
     * *Kesehatan Kulit (Gatal/Iritasi/Jamur Ringan)*: Gel lidah buaya (*Aloe vera* murni dingin oles 3x sehari untuk menenangkan kulit) atau rebusan daun sirih merah (*Piper crocatum* 3–5 lembar dalam 500 ml air hangat untuk membasuh area gatal jamur setelah dingin).

3. **Rekomendasi Makanan & Minuman Fungsional (Dosis Nutrisi Harian)**:
   * Menghitung target air putih harian otomatis ($\text{Berat Badan (kg)} \times 30\text{--}35\text{ ml/hari}$).
   * Menyusun daftar makanan spesifik beserta porsi gramasi (misalnya bayam merah, hati ayam, dan jeruk tinggi Vitamin C untuk pucat konjungtiva/anemia; pisang dan kacang almond kaya Magnesium untuk tremor kelelahan jari; hindari kopi berlebih, gorengan, dan makanan pedas saat suara serak atau lambung sensitif).

4. **Safety & Drug-Herb Interaction Guardrail (Filter Keamanan Otomatis)**:
   * Sistem wajib memeriksa kontraindikasi secara otomatis: jika pengguna mencentang "Sedang konsumsi obat pengencer darah", sistem memberi peringatan interaksi pada jahe dosis tinggi/pegagan; jika pengguna mencentang "Gerd/Maag Akut", sistem membatasi vitamin C asam dosis tinggi; dan menampilkan *Red Flag Banner* (rujukan segera ke dokter/IGD) bila ditemukan gejala darurat (nyeri dada menjalar, sesak napas berat, demam tinggi > 3 hari, atau luka bernanah luas).

5. **Autonomous Daily Scheduler (Jadwal Pengingat Interaktif)**:
   * Menghasilkan tabel jadwal harian (*Pagi 07:00, Siang 12:30, Sore 16:30, Malam 20:30*) berisi daftar tindakan (minum obat OTC, seduh herbal, kompres hangat 43°C selama 30 menit, atau latihan mata 20-20-20) yang dapat dicentang (*checklist*) oleh pengguna.

## 6. TAHAP EKSEKUSI & VERIFIKASI DI ANTIGRAVITY IDE

1. Inspeksi struktur folder dan *routing* proyek `ngopi.top` saat ini.
2. Buat direktori komponen modular untuk **`ceKKes`** (misalnya di `src/pages/Cekkes/` atau `src/components/cekkes/` yang mencakup `CekkesPage.tsx`, `PassiveDashboard.tsx`, `ActiveScanner.tsx`, `CarePlanEngine.tsx`, `ThermalTherapyGuide.tsx`, `useCekkesPassiveAgent.ts`, dan `medicalKnowledgeBase.ts`).
3. Daftarkan rute **`/cekkes`** dan tambahkan tombol navigasi **"ceKKes (Cek Kesehatan Mandiri)"** di halaman utama `ngopi.top` serta di sidebar `/warkop`.
4. Jalankan *build* dan nyalakan *dev server*.
5. Buka rute `/cekkes` di browser internal Antigravity, uji keempat modul aktivitas pasif, uji ke-6 sensor pemeriksaan aktif, pastikan kalkulator dosis obat/herbal berjalan akurat sesuai berat badan/usia, dan pastikan halaman `/warkop` serta fitur utama `ngopi.top` lainnya tetap berjalan normal tanpa *error*.