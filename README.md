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

### 3. Pengalaman Pengguna Ramah (UX)
- **Onboarding Interaktif**: Panduan 3 langkah untuk menyambut pengguna baru.
- **Empty State Informatif**: Ilustrasi hangat dan tombol CTA sapaan saat percakapan masih kosong.
- **Standarisasi Waktu**: Format konsisten (Hari ini `06:22`, Kemarin `Kemarin, 06:22`, `29 Sep, 06:22`).
- **Read Receipts**: Indikator status pesan (✓ Terkirim, ✓✓ Terbaca dengan aksen kopi).

---

## Tech Stack
- **Frontend**: React (React Native Web / Expo Router), Axios, TweetNaCl, CryptoJS, Ionicons.
- **Backend**: Node.js, Express, Socket.IO, Prisma ORM, PostgreSQL.
- **Integrasi**: Bamboochain BMC Token, Alih Bahasa Live Meeting.
