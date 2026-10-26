# Panduan Pengisian Keamanan Data (Data Safety) Google Play — Ngopi

Google Play mewajibkan seluruh pengembang untuk mengisi formulir **Keamanan Data (Data Safety Section)** di Play Console. Dokumen ini merangkum jawaban resmi untuk setiap pertanyaan formulir agar sesuai dengan arsitektur privasi aplikasi Ngopi.

---

## 1. Pengumpulan & Keamanan Data (Data Collection & Security)

| Pertanyaan di Play Console | Jawaban | Catatan |
| :--- | :--- | :--- |
| **Apakah aplikasi Anda mengumpulkan atau membagikan jenis data pengguna yang diwajibkan?** | **Ya (Yes)** | Akun, pesan terenkripsi, foto/audio opsional |
| **Apakah semua data pengguna yang dikumpulkan oleh aplikasi Anda dienkripsi saat transit?** | **Ya (Yes)** | Menggunakan enkripsi HTTPS/TLS dan E2EE (X25519 + AES-256-GCM) untuk pesan obrolan |
| **Apakah Anda menyediakan cara bagi pengguna untuk meminta penghapusan data mereka?** | **Ya (Yes)** | Tersedia tombol hapus akun di dalam aplikasi dan formulir di situs web |
| **Tautan URL permintaan penghapusan akun:** | `https://ngopi.top/privacy` | Sesuai mandat Google Play (URL publik yang menjelaskan mekanisme hapus akun) |

---

## 2. Rincian Jenis Data yang Dikumpulkan (Data Types)

### A. Informasi Pribadi (Personal Info)
1. **Nama (Name / Display Name)**:
   - *Dikumpulkan?* **Ya**
   - *Dibagikan ke pihak ketiga?* **Tidak**
   - *Diproses secara efemeral?* **Tidak** (disimpan selama akun aktif)
   - *Wajib atau opsional?* **Wajib** (untuk identifikasi nama di warung kopi)
   - *Tujuan:* **Fungsionalitas Aplikasi (App functionality)** & **Pengelolaan Akun (Account management)**.
2. **ID Pengguna (User IDs / Username)**:
   - *Dikumpulkan?* **Ya**
   - *Dibagikan ke pihak ketiga?* **Tidak**
   - *Tujuan:* **Fungsionalitas Aplikasi (App functionality)** & **Pengelolaan Akun (Account management)**.
3. **Nomor Telepon & Email:**
   - *Dikumpulkan?* **Tidak**. Ngopi tidak meminta nomor telepon seluler untuk pendaftaran.

---

### B. Pesan (Messages)
1. **Pesan dalam Aplikasi (In-app messages)**:
   - *Dikumpulkan?* **Ya** (ditransmisikan & disimpan terenkripsi E2EE)
   - *Dibagikan ke pihak ketiga?* **Tidak**
   - *Tujuan:* **Fungsionalitas Aplikasi (App functionality)**.
   - *Catatan Privasi:* Semua pesan antar pengguna dienkripsi dari ujung ke ujung (*End-to-End Encryption*) menggunakan protokol TweetNaCl X25519 dan AES-256-GCM. Pihak pengembang/server tidak memiliki kunci untuk membaca isi percakapan.

---

### C. Foto & Video (Photos & Videos)
1. **Foto (Photos)**:
   - *Dikumpulkan?* **Ya** (hanya saat pengguna mengunggah foto profil atau membagikan gambar di ruang obrolan)
   - *Dibagikan ke pihak ketiga?* **Tidak**
   - *Wajib atau opsional?* **Opsional** (pengguna dapat memilih apakah ingin membagikan foto atau tidak)
   - *Tujuan:* **Fungsionalitas Aplikasi (App functionality)**.

---

### D. File Audio (Audio Files)
1. **Rekaman Suara (Voice or sound recordings)**:
   - *Dikumpulkan?* **Ya** (hanya jika pengguna mengirimkan rekaman pesan suara di obrolan)
   - *Dibagikan ke pihak ketiga?* **Tidak**
   - *Wajib atau opsional?* **Opsional**
   - *Tujuan:* **Fungsionalitas Aplikasi (App functionality)**.

---

### E. Informasi Keuangan (Financial Info)
- *Apakah aplikasi mengumpulkan informasi kartu kredit, rekening bank, atau riwayat pinjaman?*
- **Tidak (No)**. Sistem poin Ngopi adalah sistem loyalitas internal dan konversi Web3 BMC berjalan langsung dari dompet pengguna.

---

### F. Lokasi (Location)
- *Apakah aplikasi mengumpulkan data lokasi akurat atau perkiraan?*
- **Tidak (No)**.

---

### G. Kontak (Contacts)
- *Apakah aplikasi mengakses buku kontak pengguna?*
- **Tidak (No)**. Ngopi tidak meminta izin pembacaan kontak perangkat.

---

## 3. Berbagi Data dengan Pihak Ketiga (Data Sharing)
- *Apakah ada data pengguna yang dibagikan ke pihak ketiga, pengiklan, atau agregator data?*
- **TIDAK (None)**. Data pengguna tidak pernah dijual, disewakan, atau dibagikan ke biro iklan pihak ketiga mana pun.
