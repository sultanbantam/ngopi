# Kebijakan Keamanan Informasi (Information Security Policy)
**Standar Kepatuhan:** SNI ISO/IEC 27001:2022 Sistem Manajemen Keamanan Informasi (SMKI)  
**Tingkat Dokumen:** Kebijakan Tingkat 1 (High-Level Security Policy)  
**Penerbit:** PT Ngopi Kreasi Digital | **Tahun:** 2026  

---

## 1. Pernyataan Komitmen Manajemen
Manajemen PT Ngopi Kreasi Digital berkomitmen untuk menjaga **Kerahasiaan (Confidentiality)**, **Keutuhan (Integrity)**, dan **Ketersediaan (Availability)** seluruh aset informasi pengguna, mitra, dan infrastruktur sistem aplikasi Ngopi.

## 2. Ruang Lingkup SMKI
Sistem Manajemen Keamanan Informasi mencakup seluruh siklus hidup pengembangan perangkat lunak (SDLC), server aplikasi backend, basis data PostgreSQL, perutean Socket.IO, layanan Bluetooth Mesh, dan node Web3 token BMC.

## 3. Kebijakan Kontrol Keamanan Kunci (ISO 27001:2022 Annex A)
1. **A.5.15 Kontrol Akses (Access Control)**:
   - Menerapkan prinsip hak akses paling minimal (*Principle of Least Privilege*).
   - Seluruh endpoint privat diwajibkan memvalidasi token JWT bertanda tangan kriptografis dengan masa berlaku terbatas.
2. **A.8.2 Klasifikasi Informasi**:
   - Data Publik: Nama warkop, daftar permainan, katalog booster pack.
   - Data Privat: Username pengguna, transaksi Poin Ngopi.
   - Data Rahasia/Sensitif: Konten obrolan E2EE, password hash, private key dompet.
3. **A.8.13 Pencadangan Informasi (Backup & Recovery)**:
   - Pencadangan otomatis harian snapshot database dengan replikasi lintas zona.
   - Uji pemulihan pencadangan berkala setiap kuartal.
4. **A.8.16 Pencatatan & Pemantauan (Logging & Monitoring)**:
   - Pencatatan log aktivitas sistem (Winston logger).
   - Pemantauan anomali lalu lintas jaringan untuk mendeteksi potensi serangan DDoS atau upaya peretasan brute force.
5. **A.8.24 Penggunaan Kriptografi**:
   - Penggunaan algoritma kriptografi modern yang diakui standar industri (AES-256-GCM, SHA-256, Curve25519, TweetNaCl).
   - Penolakan penggunaan cipher lawas (DES, MD5, SHA-1).
6. **A.8.28 Pengodean Aman (Secure Coding)**:
   - Validasi ketat seluruh masukan pengguna (*Input Validation*) pada lapisan controller/middleware.
   - Penggunaan prepared statements / ORM Prisma untuk mencegah SQL Injection.
   - Pemasangan middleware Helmet untuk perlindungan header HTTP (CSP, HSTS, X-Frame-Options).

## 4. Pelanggaran Kebijakan
Setiap pelanggaran terhadap kebijakan keamanan informasi akan dikenakan tindakan disipliner tegas hingga pemutusan hubungan kerja serta pelaporan ke pihak berwajib jika terdapat unsur tindak pidana siber.
