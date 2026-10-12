# Ngopi — "ngobrol paling intim" ☕🌿

Ngopi adalah aplikasi komunikasi privat, santai, dan penuh makna yang dirancang untuk semua generasi. Terinspirasi dari filosofi **Warung Kopi** Nusantara: tempat nongkrong santai, bertukar cerita, mendengarkan musik bersama, tanpa tekanan dan bisingnya algoritma media sosial.

- **URL Aplikasi**: https://ngopi.top
- **API Server**: https://api.ngopi.top

---

## Fitur Utama

### 1. Keamanan & Privasi Mutlak (E2EE)
- Enkripsi ujung-ke-ujung (End-to-End Encryption) menggunakan X25519 (TweetNaCl) dan AES-256-GCM.
- Tanpa nomor telepon, pendaftaran privat dan aman.
- Sinkronisasi & pemulihan kunci otomatis lintas perangkat dengan tombol "🔄 Muat Ulang Kunci".

### 2. Suasana Warkop (Sprint 1)
- **Jukebox Warung 🎶**: Playlist bersama yang tersinkronisasi di setiap Warung Kopi. Dilengkapi fitur Request Lagu, Vote Skip, dan Like.
- **Ambient Sound 🔊**: Suara latar khas warkop (Hujan Rintik, Kafe Ramai, Ombak, Hutan Senja, Jangkrik Malam, Api Unggun) yang dapat diatur volumenya secara personal.
- **Reaksi Warkop ☕**: Koleksi reaksi khas (☕ Kopi, 🍵 Teh, 🚬 Kretek, 🎵 Musik, 🍜 Mie, 🌙 Malam).
- **Mode Ngobrol Malam 🌙**: Tema hangat temaram dengan aksen amber yang aktif otomatis saat malam hari (21:00 - 05:00) atau dapat diatur manual.

### 3. Ekosistem Permainan Warkop (Games & TCG) 🎮
- **Permainan Meja Interaktif**: Gapleh (Gaya Kampung & Turnamen Berpasangan 2v2), Catur Warkop dengan AI 3 tingkat kesulitan, Remi, Poker, Bridge, Truf, UNO (108 kartu dengan penalti shout/catch), Ular Tangga 100 kotak serpentine, dan Monopoli Cepat 24 kotak.
- **Sprint 4: Kartu Monster Nusantara (Pokemon TCG Style) 🎴**:
  - 18 Makhluk mistis Nusantara orisinal lintas 6 elemen (Api, Air, Tanah, Listrik, Tumbuhan, Psikis).
  - Sistem kelangkaan & kartu varian *Shiny Foil* berkilau (+10% stat).
  - Matriks keunggulan elemen taktis (Super efektif 1.5x damage).
  - Mode duel 1-on-1 dengan 3 monster (aktif & cadangan), pergantian monster, aksi jurus elemen, dan bot AI.
  - Album koleksi (Binder), pembukaan Booster Pack (Gacha beranimasi), dan bursa pertukaran kartu antar pemain.
- **Sprint 5: Sistem Undangan & Penjadwalan Event Game 📅**:
  - Agenda mabar terstruktur untuk semua jenis permainan warkop.
  - Undangan langsung ke teman komunitas dengan sistem konfirmasi kehadiran (Terima / Tolak).
  - Otomatisasi pembentukan meja server-authoritative (`TableManager.createTable`) saat waktu acara tiba.
  - Hitung mundur (live countdown timer) dan pengingat event real-time via Socket.IO.

### 4. Mode Offline via Bluetooth (Mesh Networking) 📡
- **Pesan Peer-to-Peer Tanpa Internet**: Chatting tetap berfungsi di area warkop saat internet mati menggunakan BLE Mesh / P2P broadcast.
- **Multi-Hop Routing (Hingga 5 Hops)**: Pesan dapat diteruskan antar perangkat kawan warkop untuk memperluas jangkauan transmisi hingga radius 500 meter.
- **Store-and-Forward**: Pesan untuk penerima yang sedang di luar jangkauan ditampung sementara dan otomatis terkirim saat perangkat mendekat.
- **Keamanan & Verifikasi Kunci**: E2EE tetap aktif (X25519 + AES-GCM), verifikasi identitas peer via sidik jari SHA-256 untuk perlindungan anti-MITM, dan rate limiting anti-spam (maks 10 pesan/menit).
- **Auto-Sync Cloud**: Seluruh pesan yang dikirim/diterima saat offline otomatis disinkronkan ke server pusat saat internet kembali online.

### 5. Ekonomi BMC & Poin Ngopi (Sprint 7) 🪙
- **Dua Lapis Ekonomi**: Poin Ngopi off-chain (reward obrolan, reaksi, main game, daily streak) dan Token BMC on-chain di Bamboochain.
- **Fitur Premium**: Kirim file besar (>5MB), paket stiker khas warkop, penyimpanan cloud tambahan (+5GB), lencana profil emas, tema visual kayu jati antik, dan akses fitur beta.
- **Bridge Web3**: Konversi mandiri 1.000 Poin = 1 Token BMC langsung ke alamat dompet crypto pengguna.
- **Ruang Bioskop (Watch Party) 🎬**: Nonton video bareng kawan warkop dengan sinkronisasi kendali putar real-time (play/pause/seek) oleh Host.

### 6. Kepatuhan Regulasi Indonesia & Keamanan Data (Sprint 8) 🛡️
- **Kepatuhan UU PDP No. 27/2022**: Banner persetujuan eksplisit, kebijakan privasi transparan, dan minimisasi data tanpa pengumpulan nomor telepon.
- **Hak Subjek Data Mandiri**: Unduh salinan data pribadi format JSON (`GET /api/user/export`) dan hak penghapusan akun (`DELETE /api/user/delete`) dengan masa tenggang aman 30 hari (*grace period*).
- **Pemberitahuan Insiden 3 x 24 Jam**: Prosedur tanggap darurat siber sesuai Pasal 46 UU PDP ke Kominfo dan DPO (`dpo@ngopi.top`).
- **Pendaftaran PSE Kominfo & ISO 27001**: Kesiapan penuh Penyelenggara Sistem Elektronik (PSE) Lingkup Privat dan penerapan kontrol keamanan informasi ISO/IEC 27001:2022.

### 7. Anti-Spam & Moderasi AI (Sprint 9) 🛡️🤖
- **Pertahanan 5 Lapis (Defense-in-Depth)**:
  - **Lapisan 1 (Rate Limiting)**: Throttling ketat sisi server (10 pesan/detik anti-burst, 60 pesan/menit, 500 pesan/jam, dan 3 pergantian warkop/menit).
  - **Lapisan 2 (Pre-AI Rules & Hash Dedup)**: Deteksi otomatis multi-link (3+ URL), repetisi karakter panjang (>= 20 karakter identik), karakter tak terlihat (*zero-width*), flooding mention/emoji, dan deduplikasi hash SHA-256 (maks 3 pengiriman pesan identik).
  - **Lapisan 3 (AI Content Classifier)**: Deteksi otomatis bahasa Indonesia untuk judi slot online / togel, konten seksual eksplisit / prostitusi, ujaran kebencian, dan scam keuangan.
  - **Lapisan 4 (Matriks Eskalasi Progresif)**: Tingkatan penalti bertahap: Peringatan (Warning) -> Bisu 1 Jam (Mute) -> Dikeluarkan dari Warkop (Kick) -> Blokir Akun 7 Hari (Ban) -> Daftar Hitam Permanen (Blacklist).
  - **Lapisan 5 (Pipeline Server-Side Real-time)**: Integrasi Socket.IO real-time yang memblokir pesan sebelum disimpan atau didistribusikan, dengan feedback instan ke klien.
- **Pusat Pelaporan Pengguna & Antrean Tinjauan Admin**: Formulir pengaduan interaktif di frontend dan antrean moderasi (*Review Queue*) di backend untuk investigasi admin.

### 8. Pengalaman Pengguna Ramah (UX)
- **Banner Offline Global**: Indikator mode offline real-time dengan jumlah peer terdeteksi.
- **Modal Jaringan Peer**: Daftar perangkat sekitar dengan visualisasi hop (1 hop, 2 hop, 3+ hop) dan kekuatan sinyal.
- **Onboarding Interaktif**: Panduan 3 langkah untuk menyambut pengguna baru.
- **Empty State Informatif**: Ilustrasi hangat dan tombol CTA sapaan saat percakapan masih kosong.
- **Standarisasi Waktu**: Format konsisten (Hari ini `06:22`, Kemarin `Kemarin, 06:22`, `29 Sep, 06:22`).
- **Read Receipts**: Indikator status pesan (✓ Terkirim, ✓✓ Terbaca dengan aksen kopi).

---

## Tech Stack
- **Frontend**: React (React Native Web / Expo Router), Axios, TweetNaCl, CryptoJS, Ionicons.
- **Backend**: Node.js, Express, Socket.IO, Prisma ORM, PostgreSQL.
- **Integrasi**: Bamboochain BMC Token, Alih Bahasa Live Meeting.
