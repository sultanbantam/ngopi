# Project Prompt: BambooChat (v2) – Fitur Lengkap & Keamanan

## 1. Nama Aplikasi
**BambooChat** – Tersedia di `bamboochat.click`

## 2. Tujuan Utama
Membangun aplikasi pesan instan (chat, panggilan suara, video call) yang **TIDAK** memerlukan nomor HP atau email. Registrasi/login menggunakan akun yang sudah terdaftar di **Bamboochain.id** (berbasis dompet blockchain). Semua fitur dirancang untuk menarik pengguna dengan utility token **BMC**.

---

## 3. Fitur Wajib (MVP+)

### A. Autentikasi & Integrasi Dompet
- Login/daftar hanya menggunakan **username + password** dari akun Bamboochain.id.
- Opsi "Login with Bamboochain Wallet" (verify signature) untuk pengguna yang sudah memiliki dompet.
- Setelah login, tampilkan **alamat dompet** pengguna di halaman profil.
- Fitur **"Atur Alamat Dompet"** di pengaturan akun, di mana pengguna bisa menambahkan/mengganti alamat dompet mereka (sesuai screenshot).
- Tambahkan **wallet airdrop BMC** – fitur untuk mengklaim airdrop token BMC secara periodik (misal setiap hari) di halaman dompet.

### B. Kontak & Grup
- **Kontak**: Daftar pengguna lain yang ditemukan dari username atau alamat dompet.
- **Grup** (disebut **"Rumpun"** – istilah khas Indonesia):
  - Buat rumpun baru dengan nama dan deskripsi.
  - **Token-Gated Rumpun**: Admin bisa menentukan minimum saldo BMC (misal 10 BMC) untuk bergabung. Sistem akan memeriksa saldo dompet pengguna via RPC Bamboochain sebelum mengizinkan akses.
  - **Fitur keanggotaan**: Tampilkan daftar anggota rumpun.

### C. Chat (1-on-1 & Grup)
- **Teks** dengan dukungan emoji, stiker, dan file (gambar, video, audio, dokumen PPT/PDF/Docs/Excel, dsb).
- **Tombol aksi per pesan** (sesuai permintaan):
  - **Balas** (Reply) – membalas pesan tertentu dengan kutipan.
  - **Teruskan** (Forward) – meneruskan pesan ke kontak/rumpun lain.
  - **Edit** – mengubah isi pesan (dengan tampilan "telah diedit").
  - **Hapus** – menghapus pesan (untuk semua atau hanya untuk diri sendiri).
  - **Reaksi** – menggunakan emoji reaksi (👍❤😂 dll.) di bawah pesan.
- **Notifikasi badge**: Tampilkan angka notifikasi (jumlah pesan, panggilan tak terjawab, reaksi, balasan, dll.) di samping nama kontak atau rumpun di daftar utama.

### D. Panggilan Suara & Video
- **Panggilan suara** 1-on-1 dan grup.
- **Video call** 1-on-1 dan grup (**vicall rame2**).
- **Berbagi layar** (screen sharing) selama panggilan.
- **Whiteboard kolaboratif**: Peserta bisa menulis, menggambar, dan membuat sketsa bersama di papan virtual yang sama.
- **Rekaman panggilan**: Pengguna yang mengundang (host) dapat merekam seluruh sesi panggilan (suara, video, layar, whiteboard) dan menyimpan rekaman di perangkat masing-masing (HP/laptop/PC/iPad).

### E. Terjemahan Otomatis (Fitur Unggulan)
- **Translate otomatis** pesan masuk ke bahasa yang dipilih pengguna.
- Pengguna bisa memilih **bahasa negara** (misal Inggris, Mandarin, Arab) atau **bahasa suku di Indonesia** (Jawa, Sunda, Batak, dll.).
- Deteksi bahasa sumber secara otomatis, lalu terjemahkan ke bahasa target menggunakan API penerjemah (misal Google Translate API atau DeepL) – pastikan privasi pesan tetap terjaga (opsi enkripsi lokal jika memungkinkan).

### F. Tata Letak (Layout) Khusus
- Saat sedang berada di layar chat (baik dengan kontak atau di rumpun), **di bagian bawah layar** tampilkan daftar kontak yang **online** (status hijau) dan daftar rumpun yang sedang aktif.
- Ini membantu pengguna melihat aktivitas teman-temannya tanpa harus keluar dari percakapan.

### G. Privasi & Visibilitas
- Pengguna dapat **menyembunyikan**:
  - Nama mereka sendiri dari daftar kontak orang lain (mode inkognito).
  - Daftar kontak mereka (tidak terlihat oleh orang lain).
  - Daftar rumpun yang mereka ikuti (tidak terlihat oleh orang luar).
- Pengaturan ini tersedia di halaman **Pengaturan Akun**.

---

## 4. Keamanan (Pilar Utama)

### A. Enkripsi End-to-End (E2EE)
- Semua pesan teks, panggilan suara, dan video harus dienkripsi **dari pengirim ke penerima** menggunakan protokol yang sudah teruji (misal **Signal Protocol** atau **libsodium** dengan kunci publik/privat).
- Server **tidak bisa** membaca isi pesan atau mendengarkan panggilan.

### B. Autentikasi & Sesi
- Gunakan **JWT** yang disimpan di `httpOnly` cookie (untuk web) dan Secure Storage (untuk mobile).
- Terapkan **2FA** (opsional) melalui aplikasi authenticator.
- Setiap koneksi WebSocket (`wss://`) harus diautentikasi dengan JWT saat handshake.

### C. Keamanan Data
- Enkripsi data sensitif (pesan, riwayat panggilan) di database.
- Validasi ketat semua input (hindari SQL Injection, XSS).
- Gunakan HTTPS dan WSS di seluruh domain.

### D. Keamanan Dompet
- Jangan pernah menyimpan private key di server. Semua transaksi BMC ditandatangani di sisi klien.
- Untuk fitur airdrop, buat mekanisme klaim yang aman (misal dengan signature verifikasi).

---

## 5. Integrasi BMC (Utility Token)
- **Token-Gated Rumpun**: Periksa saldo BMC via RPC Bamboochain.
- **Tip/Donasi**: Kirim BMC antar pengguna di dalam chat.
- **Fitur Berbayar**: Ukuran file besar (>5MB) atau penyimpanan pesan lama memerlukan biaya kecil dalam BMC.
- **Airdrop**: Fitur klaim token gratis setiap hari untuk mendorong aktivitas.

---

## 6. Tech Stack
- **Frontend Web**: React.js + Tailwind CSS.
- **Frontend Mobile**: React Native (Expo) untuk Android/iOS.
- **Backend**: Node.js + Express.js.
- **Real-time**: Socket.IO (dengan autentikasi JWT).
- **Database**: PostgreSQL (Prisma ORM) + Redis (untuk session & online status).
- **Enkripsi**: `libsodium` atau `signal-protocol` library.
- **Blockchain**: Ethers.js untuk interaksi dengan kontrak BMC di Bamboochain.
- **Penerjemah**: Google Cloud Translation API atau DeepL API (dengan cache untuk menghemat biaya).
- **WebRTC**: Untuk panggilan suara/video dan berbagi layar (menggunakan `simple-peer` atau `peerjs`).

---

## 7. Database Schema (Tambahan)

**Table `user_settings`**:
- `user_id` (FK)
- `hide_name` (boolean)
- `hide_contacts` (boolean)
- `hide_groups` (boolean)
- `preferred_language` (string, kode bahasa)

**Table `group_members`**:
- `group_id`, `user_id`, `joined_at`, `wallet_address` (untuk token-gated check)

**Table `reactions`**:
- `message_id`, `user_id`, `emoji`

**Table `call_records`**:
- `id`, `room_id`, `host_user_id`, `recording_url` (opsional, jika disimpan di IPFS/S3)

---

## 8. Struktur Folder (Backend)

```
bamboochat-backend/
├── src/
│   ├── models/           (User, Message, Group, Reaction, Call)
│   ├── controllers/      (Auth, Chat, Group, Payment, Translate)
│   ├── middleware/       (JWT, TokenGating, RateLimiter)
│   ├── sockets/          (message, call, typing, online)
│   ├── services/         (encryption, blockchain, translate)
│   ├── utils/            (helpers, constants)
│   └── app.js
├── .env
└── package.json
```

---

## 9. Petunjuk untuk AI Agent (Langkah Implementasi)

### Tahap 1 – Setup & Autentikasi
- Inisialisasi project Express + Prisma.
- Buat endpoint register/login (hanya username + password) yang terintegrasi dengan database Bamboochain (atau buat sendiri).
- Implementasi JWT dengan `httpOnly` cookie.

### Tahap 2 – Chat Real-time & Enkripsi
- Setup Socket.IO dengan auth JWT.
- Buat event `send_message`, `receive_message`, `typing`.
- Implementasi enkripsi E2EE menggunakan `libsodium` (kunci publik/privat) – setiap pengguna memiliki keypair yang disimpan di sisi klien.

### Tahap 3 – Grup (Rumpun) & Token-Gated
- Buat model Group dan GroupMember.
- Endpoint untuk membuat rumpun, menambah anggota, mengatur minimum BMC.
- Middleware untuk memeriksa saldo BMC sebelum bergabung (panggil RPC Bamboochain).

### Tahap 4 – Fitur Pesan (Balas, Teruskan, Edit, Hapus, Reaksi)
- Tambahkan field `parent_message_id` (untuk balas), `is_edited`, `is_deleted`.
- Buat endpoint untuk edit, hapus, forward, dan reaksi (tabel terpisah).

### Tahap 5 – Panggilan & Whiteboard
- Integrasi WebRTC via `simple-peer`.
- Buat signaling server melalui Socket.IO.
- Fitur rekaman menggunakan MediaRecorder API di sisi klien (host).

### Tahap 6 – Terjemahan Otomatis
- Integrasi API penerjemah (Google Translate).
- Saat pesan masuk, deteksi bahasa, lalu terjemahkan ke bahasa preferensi pengguna (disimpan di `user_settings`).

### Tahap 7 – Layout Khusus & Privasi
- Kirim daftar kontak online dan grup aktif melalui Socket.IO (event `online_list`).
- Tambahkan toggle di pengaturan untuk menyembunyikan nama, kontak, atau grup.

### Tahap 8 – Dompet & Airdrop BMC
- Tampilkan saldo BMC dan alamat dompet di profil.
- Fitur airdrop: setiap hari pengguna bisa mengklaim sejumlah BMC (dengan signature) – simpan riwayat klaim di database untuk mencegah abuse.

---

## 10. Catatan Akhir
- Prioritaskan **keamanan** di setiap tahap.
- Pastikan semua koneksi menggunakan HTTPS/WSS.
- Untuk MVP, gunakan library yang sudah teruji dan dokumentasi yang jelas.
- Selalu lakukan testing (unit test dan integrasi) sebelum deploy.

Dengan prompt ini, AI Agent akan memiliki panduan lengkap untuk membangun BambooChat sesuai dengan visi Anda. Selamat berkarya!
