# Project Prompt: BambooChat Customer Service Hub (Ecosystem Integration)

## 1. Tujuan Utama
Mengembangkan fitur Customer Service (CS) terintegrasi di dalam BambooChat, sehingga aplikasi ini tidak hanya berfungsi seperti WhatsApp/Telegram, tetapi juga menjadi **"Super App"** yang melayani seluruh pertanyaan, keluhan, dan informasi tentang ekosistem Bamboochain.

### Platform yang Harus Didukung (Ecosystem):
1. **bamboochain.id** (Blockchain & Dompet)
2. **bamboogame.click** (Game/Platform Gaming)
3. **xignalx.click** (Belum diketahui, asumsikan sebagai platform sinyal/data)
4. **votiva.click** (Voting/Governance)
5. **aichitect.click** (AI/Arsitektur)
6. **whaleofsavu.org** (Komunitas/Inisiatif Sosial)

---

## 2. Fitur Wajib yang Harus Dibangun

### A. Pusat Informasi di "Rumpun Bambupedia" (Publik)
- **Pinned Message / Pengumuman**: Buat pesan sistem yang selalu berada di atas (sticky) berisi daftar lengkap semua platform, deskripsi singkat, dan link menuju platform tersebut.
- **Topik/Thread per Platform**: Dalam satu Rumpun, buat sistem "Thread" atau "Topic" (mirip forum). Setiap platform memiliki thread sendiri agar diskusi tidak tercampur.
- **Fitur Tag/ Label**: Admin/CS bisa menambahkan tag seperti `#Bamboochain`, `#Bamboogame`, `#Votiva` pada setiap jawaban untuk memudahkan pencarian.
- **Command Sederhana**: User bisa mengetik `!list` untuk melihat daftar platform, atau `!info [nama_platform]` untuk mendapatkan informasi singkat.

### B. Sistem Tiket & Chat Pribadi dengan CS
- **Fitur "Hubungi CS"**:
  - Tambahkan tombol atau command (misal `/cs`) di dalam chat.
  - Saat user mengetik `/cs`, sistem akan membuka **chat 1-on-1** dengan akun CS (atau membuat tiket baru).
  - **Tiket** memiliki status: `open`, `in_progress`, `resolved`, `closed`.
  - Setiap tiket harus menyimpan `platform` yang ditanyakan (user bisa memilih platform saat membuka tiket).
- **Routing Otomatis**: Jika user memilih platform tertentu (misal `bamboogame`), tiket akan diarahkan ke agen CS yang bertanggung jawab untuk platform tersebut.

### C. AI Chatbot Otomatis (Jawaban 24/7) - Kunci Utama
- **Knowledge Base (FAQ)**: Buat database FAQ untuk setiap platform. Contoh:
  - *Bamboochain*: "Bagaimana cara daftar?" / "Bagaimana topup BMC?"
  - *Bamboogame*: "Bagaimana cara mulai main?" / "Apa itu token in-game?"
  - *Votiva*: "Bagaimana cara membuat voting?"
  - *Aichitect*: "Bagaimana generate desain?"
- **AI Engine**:
  - Saat user bertanya di Rumpun publik atau chat pribadi, AI akan mendeteksi platform yang ditanyakan dan mencocokkan dengan FAQ.
  - Jika kecocokan tinggi (>80%), AI menjawab otomatis.
  - Jika kecocokan rendah atau pertanyaan terlalu kompleks, AI akan menyarankan: *"Untuk pertanyaan ini, saya akan menghubungkan Anda dengan CS kami. Mohon tunggu."* lalu otomatis membuka tiket.
- **Multi-Bahasa**: Dukungan terjemahan otomatis (sesuai permintaan sebelumnya) tetap berlaku untuk semua percakapan CS.

### D. Dashboard Admin / CS (Khusus Staff)
- Daftar semua tiket yang masuk dengan status, platform, dan waktu.
- Agen CS bisa mengambil tiket, membalas, mengubah status, dan menambahkan catatan internal (tidak terlihat user).
- Statistik: Jumlah tiket per platform, rata-rata waktu respon.

---

## 3. Database Schema (Tambahan/Modifikasi)

**Table `platforms`**:
- `id` (UUID)
- `name` (string, unik: "bamboochain", "bamboogame", dll.)
- `display_name` (string, "Bamboochain ID", "Bamboo Game")
- `description` (text)
- `website_url` (string)
- `icon` (string, emoji atau path logo)
- `created_at`

**Table `faqs`**:
- `id` (UUID)
- `platform_id` (FK)
- `question` (text)
- `answer` (text)
- `keywords` (text[], untuk pencarian)
- `created_at`

**Table `tickets`**:
- `id` (UUID)
- `user_id` (FK, pembuat tiket)
- `platform_id` (FK)
- `title` (string, ringkasan masalah)
- `status` (enum: 'open', 'in_progress', 'resolved', 'closed')
- `assigned_agent_id` (FK ke users, nullable)
- `is_escalated` (boolean, dari AI ke CS)
- `created_at`, `updated_at`

**Table `ticket_messages`**:
- `id` (UUID)
- `ticket_id` (FK)
- `sender_id` (FK, user atau agent)
- `content` (text, terenkripsi)
- `is_internal` (boolean, untuk catatan internal CS)
- `created_at`

---

## 4. Struktur API Endpoint (Wajib Dibuat)

### A. Endpoint untuk User:
- `GET /api/platforms` → Mendapatkan daftar semua platform ekosistem.
- `GET /api/faqs?platform_id=xxx` → Mendapatkan FAQ untuk platform tertentu.
- `POST /api/ai/query` → Kirim pertanyaan user, dapatkan jawaban AI (atau rekomendasi buat tiket).
  - *Request Body*: `{ "question": "string", "platform_id": "uuid" }`
  - *Response*: `{ "answer": "string", "confidence": 0.85, "suggest_ticket": boolean }`
- `POST /api/tickets` → Buat tiket baru (bisa dari user langsung atau hasil eskalasi AI).
  - *Request Body*: `{ "platform_id": "uuid", "title": "string", "message": "string" }`
- `GET /api/tickets/my` → User melihat daftar tiket mereka sendiri.
- `GET /api/tickets/:id/messages` → Lihat detail chat tiket.

### B. Endpoint untuk Admin/CS (perlu role check):
- `GET /api/admin/tickets` → Daftar semua tiket (dengan filter status & platform).
- `PATCH /api/admin/tickets/:id/status` → Ubah status tiket.
- `PATCH /api/admin/tickets/:id/assign` → Assign ke agen tertentu.
- `POST /api/admin/tickets/:id/messages` → Kirim balasan (support internal notes).
- `POST /api/admin/faqs` → Tambah/edit FAQ di knowledge base.

---

## 5. Integrasi di Frontend (UI/UX)

### A. Halaman Utama (Contacts/Groups):
- Tambahkan **tombol "Pusat Bantuan"** atau **"Help Center"** yang mencolok di menu utama.
- Di daftar kontak, tambahkan kontak khusus **"BambooCS"** (seperti kontak customer service) yang selalu online.

### B. Rumpun Bambupedia:
- **Pinned Message** otomatis di atas: tampilkan daftar 6 platform dengan emoji dan link cepat.
- **Input Command**: Saat user mengetik `!info bamboogame`, bot (AI) akan merespon di chat publik dengan informasi dan link.

### C. Chat Pribadi / Tiket:
- Di dalam chat, ada indikator "Ini adalah percakapan dengan Customer Service".
- User bisa melihat status tiket (Open, In Progress, Resolved).
- Ada tombol "Tutup Tiket" di sisi user.

### D. Dashboard Admin (Web khusus):
- Layout terpisah (misal `/admin/dashboard`).
- Tampilan kartu tiket yang bisa diseret untuk mengubah status (Drag & Drop) ala Trello.

---

## 6. Langkah Implementasi untuk AI Agent (Tahapan)

### Tahap 1: Setup Database & Models
- Tambahkan model `Platform`, `Faq`, `Ticket`, `TicketMessage` ke Prisma schema.
- Jalankan migrasi database.
- *Seed data*: Masukkan 6 platform dan minimal 10-15 FAQ per platform (sesuai ekosistem).

### Tahap 2: Endpoint AI & Knowledge Base
- Buat service `AiService.js` yang berfungsi untuk mencocokkan pertanyaan user dengan FAQ di database (gunakan full-text search PostgreSQL atau library sederhana seperti `fuse.js` di server).
- Buat endpoint `/api/ai/query` yang mengembalikan jawaban + confidence score.

### Tahap 3: Sistem Tiket
- Buat endpoint CRUD untuk tiket (user create, view, agent reply, update status).
- Integrasikan dengan Socket.IO agar chat tiket real-time.

### Tahap 4: Integrasi dengan Rumpun Bambupedia
- Ubah logic `Rumpun Bambupedia` agar menerima command `!info`.
- Tampilkan pinned message otomatis saat user masuk ke rumpun.

### Tahap 5: Dashboard Admin (CS Portal)
- Buat halaman `/admin` (gunakan autentikasi JWT + role middleware).
- Tampilkan daftar tiket, form balasan, dan statistik sederhana.

### Tahap 6: Testing & Refinement
- Simulasikan percakapan AI + User + CS.
- Optimalkan keyword matching untuk FAQ.

---

## 7. Aturan Keamanan & Privasi (Khusus CS)
- **Enkripsi Tetap Berlaku**: Pesan di tiket tetap dienkripsi end-to-end.
- **Catatan Internal**: Field `is_internal` pada `ticket_messages` bersifat *server-side only*, tidak dikirim ke client user.
- **Role Management**: Hanya user dengan role `admin` atau `agent` yang bisa mengakses endpoint `/api/admin/*`.
- **Logging Aktivitas**: Catat semua aksi CS (assign, change status) untuk audit.

---

## 8. Catatan untuk AI Agent
- Prioritaskan fitur **AI Auto-Reply** dan **Sistem Tiket** karena ini adalah nilai jual utama untuk CS.
- Pastikan *command* `!info` dan `!list` di Rumpun publik responsif dan mudah digunakan.
- Gunakan library atau framework yang sudah familiar di stack (Node.js + Prisma) untuk mempercepat development.

Dengan prompt ini, BambooChat akan menjadi **pusat layanan 24/7** yang cerdas dan terintegrasi penuh dengan seluruh platform dalam ekosistem Bambu. Selamat membangun!