# Project Prompt: BambooChat (Decentralized Messaging for Bamboochain)

## 1. Project Overview
BambooChat adalah aplikasi pesan instan (chat, voice call, video call) yang **TIDAK** memerlukan nomor HP atau email untuk registrasi. Identitas pengguna adalah **Username + Password** (di tahap awal) dengan opsi koneksi ke **Dompet Bamboochain** untuk mengaktifkan utility token **BMC**.

## 2. Core Philosophy
- **Privacy First**: Tidak ada data pribadi (HP/Email) yang disimpan di server.
- **Web3 Native**: Terintegrasi penuh dengan ekosistem Bamboochain.id.
- **Token Utility**: BMC digunakan sebagai akses fitur premium dan insentif.

## 3. Tech Stack (Wajib Diikuti)
- **Frontend**: React Native (untuk Android/iOS) + React.js (untuk Web Dashboard).
- **Backend**: Node.js dengan Express.js.
- **Database**: PostgreSQL (untuk user & metadata) + Redis (untuk session & real-time state).
- **Real-time Communication**: Socket.IO (WebSocket).
- **Blockchain Interaction**: Ethers.js (untuk membaca saldo BMC dan kontrak pintar Bamboochain).
- **File Storage**: IPFS (desentralisasi) atau S3 (opsional untuk MVP).

## 4. Fitur Wajib (MVP - Minimum Viable Product)
### A. Autentikasi (Tanpa HP/Email)
- Registrasi hanya membutuhkan: `username` (unik), `password`, dan `display_name`.
- Password wajib di-hash menggunakan `bcryptjs`.
- Login menghasilkan JWT (JSON Web Token) yang disimpan di `httpOnly` cookie atau Secure Storage.
- **Nantinya**: Tambahkan opsi "Login with Bamboochain Wallet" (Verify Signature).

### B. Chat 1-on-1
- Pengguna dapat mencari username lain dan memulai percakapan.
- Pesan teks dikirim real-time via Socket.IO.
- **End-to-End Encryption (E2EE)**: Pesan dienkripsi di sisi klien menggunakan AES-GCM dengan kunci turunan (derived key) dari password (menggunakan `crypto-js` atau `libsodium`). Server tidak bisa membaca isi pesan.

### C. Grup & Token-Gated Rooms
- Pengguna bisa membuat grup.
- **Fitur Token-Gated**: Admin grup bisa mengatur "Minimum saldo BMC" untuk bergabung.
AI Agent wajib membuat middleware yang memeriksa saldo dompet pengguna (via RPC Bamboochain) sebelum mengizinkan akses ke grup tertentu.

### D. Utility Token BMC
- **Tip / Kirim BMC**: Fitur untuk mengirim tip BMC antar pengguna di dalam chat.
- **Akses Fitur**: Voicenote atau pengiriman file berukuran > 5MB memerlukan pembayaran kecil (fee) menggunakan BMC.
- AI Agent harus membuat fungsi untuk memanggil kontrak pintar BMC di jaringan Bamboochain.

## 5. Database Schema (Referensi untuk AI)
**Table `users`**:
- `id` (UUID)
- `username` (string, unique)
- `password_hash` (string)
- `display_name` (string)
- `wallet_address` (string, nullable, untuk koneksi ke dompet)
- `public_key` (string, untuk E2EE)
- `created_at` (timestamp)

**Table `messages`**:
- `id` (UUID)
- `room_id` (UUID)
- `sender_id` (UUID)
- `content` (text, terenkripsi)
- `is_delivered` (boolean)
- `timestamp` (timestamp)

**Table `groups`**:
- `id` (UUID)
- `name` (string)
- `min_bmc_balance` (decimal, untuk token-gated)
- `created_by` (UUID)

## 6. Struktur Folder (Wajib Dibuat AI)
```
bamboochat/
├── backend/
│ ├── src/
│ │ ├── models/ (User, Message, Group)
│ │ ├── controllers/ (Auth, Chat, BMC)
│ │ ├── middleware/ (Auth, TokenGating)
│ │ ├── sockets/ (Event handlers)
│ │ └── utils/ (Encryption, Blockchain)
│ └── .env (DB_URL, JWT_SECRET, BMC_CONTRACT)
├── frontend/
│ ├── app/ (React Native screens)
│ └── web/ (React dashboard)
└── README.md
```

## 7. Aturan Keamanan Khusus (Hard Rules untuk AI)
- **JANGAN PERNAH** hardcode private key atau secret di dalam kode. Gunakan environment variables.
- Semua request API (kecuali login/register) harus melewati middleware `verifyJWT`.
- Validasi input di sisi server (menggunakan `Joi` atau `yup`) untuk mencegah SQL Injection.
- Koneksi WebSocket harus diautentikasi dengan token JWT yang dikirim di query parameter saat handshake.

## 8. Perintah Langkah-demi-Langkah untuk AI Agent
**Tahap 1 (Setup)**:
- Inisialisasi project Node.js (Express + TypeScript).
- Setup database PostgreSQL dengan Prisma ORM.
- Buat endpoint `/api/auth/register` dan `/api/auth/login`.

**Tahap 2 (Real-time Chat)**:
- Implementasi Socket.IO di backend.
- Buat event `send_message` dan `receive_message`.
- Integrasikan enkripsi sederhana di frontend.

**Tahap 3 (Integrasi BMC)**:
- Tambahkan `ethers.js`.
- Buat endpoint `/api/bmc/balance` untuk mengecek saldo.
- Implementasi logic `Token-Gated Room` di middleware grup.

**Tahap 4 (Frontend Mobile)**:
- Buat layar Login, Register, Contact List, dan Chat Room menggunakan React Native (Expo).

## 9. Catatan untuk AI
Jika ada keputusan arsitektur yang ambigu (misal: pilih database mana atau library enkripsi mana), pilihlah yang paling populer dan memiliki dokumentasi terbaik. Prioritaskan **keamanan** di atas kemudahan pengembangan. Tampilkan console log yang jelas untuk memudahkan debugging selama development.
