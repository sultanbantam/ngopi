Berikut adalah revisi lengkap untuk Draft Kerja Sama (MoU), alur UI/UX, dan Prompt AI Agent berdasarkan dua poin revisi Anda. Sistem ini sekarang mewajibkan Pihak Kedua login ke Ngopi dan mendapatkan notifikasi real-time di dalam aplikasi.

\---

📄 BAGIAN 1: DRAFT PERJANJIAN KERJA SAMA (MoU) \- REVISI

Teks di bawah ini akan ditampilkan di halaman web ngopi.top/partnership (hanya bisa diakses jika sudah login).

\---

PERJANJIAN KERJA SAMA KEMITRAAN DIGITAL  
NGOPI x \[NAMA CAFE\]

PIHAK PERTAMA:  
Ngopi (dioperasikan oleh BaMbooChain)  
Website: https\://bamboochain.id

PIHAK KEDUA:  
Username Ngopi: @\[username\_pihak\_kedua\]  
Nama Pemilik: \[Nama Pemilik\]  
Nama Cafe: \[Nama Cafe\]  
Alamat: \[Alamat Lengkap\]  
No. Telepon/WA: \[Nomor\]

PASAL 1: RUANG LINGKUP KERJA SAMA

1\. Pihak Pertama menyediakan platform aplikasi digital "Ngopi" (berbasis web dan PWA) untuk mendukung operasional dan komunitas Pihak Kedua.  
2\. Pihak Kedua menyediakan lokasi fisik (Cafe) sebagai titik lokasi (Check-in Point) pengguna Ngopi.

PASAL 2: FITUR DAN LAYANAN

1\. Check-in Digital & Loyalty: Pihak Pertama menyediakan QR Code unik khusus untuk Pihak Kedua. Setiap pengguna Ngopi yang melakukan scan (maks. 1x sehari) akan mendapatkan 50 Poin Ngopi.  
2\. Merchant Dashboard: Pihak Pertama memberikan akses eksklusif kepada Pihak Kedua untuk melihat statistik kunjungan dan mengirim siaran promo (Broadcast) ke pengguna.  
3\. Event Komunitas: Pihak Kedua dapat mengadakan turnamen (Gapleh/Catur) yang difasilitasi sistem matchmaking dan leaderboard dari Ngopi.

PASAL 3: HAK DAN KEWAJIBAN

1\. Hak Pihak Pertama: Mendapatkan data statistik anonim untuk pengembangan aplikasi dan promosi bersama.  
2\. Kewajiban Pihak Pertama: Menjaga kerahasiaan data pelanggan sesuai UU PDP dan memastikan sistem berjalan tanpa gangguan (uptime minimal 99%).  
3\. Hak Pihak Kedua: Mendapatkan traffic tambahan, promosi gratis di aplikasi, dan alat loyalitas pelanggan.  
4\. Kewajiban Pihak Kedua: Menyediakan QR Code fisik di meja, menghormati reward (misal: penukaran Poin dengan Kopi), dan menjaga reputasi baik di komunitas Ngopi.

PASAL 4: KETENTUAN KOMERSIAL (OPSIONAL)  
(Pilih salah satu dengan mencentang di sistem)

☐ Model A (Gratis/Trial): Tidak ada biaya. Ngopi mengambil data engagement untuk case study.  
☐ Model B (Bagi Hasil): Pihak Kedua mendapat potongan 5% dari setiap transaksi F\&B yang dilakukan melalui fitur Order di Ngopi.

PASAL 5: JANGKA WAKTU & PENGAKHIRAN

1\. Perjanjian ini berlaku selama 1 (satu) tahun sejak tanggal persetujuan digital dan diperpanjang secara otomatis.  
2\. Salah satu pihak dapat mengakhiri kerja sama dengan pemberitahuan tertulis (via fitur chat Ngopi atau email) minimal 30 hari sebelumnya.

PASAL 6: PERSETUJUAN DIGITAL  
Dengan menekan tombol "Setuju & Tandatangani" pada pop-up verifikasi yang muncul di akun Ngopi Pihak Kedua, Pihak Kedua menyatakan telah membaca, memahami, dan menyetujui seluruh isi perjanjian ini. Tanda tangan digital ini memiliki kekuatan hukum yang sah.

\---

\---

💻 BAGIAN 2: ALUR UI/UX (Bagaimana Cara Menandatanganinya)

1\. Pemilik Cafe wajib login ke aplikasi ngopi.top menggunakan akun mereka.  
2\. Mereka membuka menu "Partnership / Kerja Sama" di dalam aplikasi.  
3\. Mereka mengisi form pendaftaran (Nama Pemilik, Nama Cafe, Alamat, No HP).  
4\. Teks MoU di atas muncul di layar.  
5\. Di bagian paling bawah, ada kotak centang: ☑️ "Saya setuju dengan Syarat & Ketentuan Kemitraan di atas."  
6\. Pemilik Cafe menekan tombol "Ajukan Kerja Sama".  
7\. Sistem mengirimkan POP-UP / NOTIFIKASI REAL-TIME (via WebSocket) ke akun Ngopi mereka sendiri.  
8\. Di dalam pop-up tersebut terdapat ringkasan MoU dan tombol "Verifikasi & Tandatangani".  
9\. Setelah ditekan, sistem mengonfirmasi bahwa MoU telah ditandatangani secara digital oleh username tersebut.

\---

⚙️ BAGIAN 3: OTOMATISASI SISTEM (Apa yang Terjadi Setelah Tanda Tangan)

Begitu pemilik cafe menekan tombol verifikasi di pop-up, backend Ngopi bekerja secara otomatis:

1\. Pembuatan Profil Merchant:  
   Sistem mengubah role user tersebut dari regular\_user menjadi merchant\_partner.  
2\. Generate QR Code Otomatis:  
   Sistem membuatkan QR Code unik (berisi token rahasia khusus cafe tersebut) dan mengirimkan file PDF/PNG siap cetak langsung ke fitur chat/Inbox akun Ngopi pemilik cafe.  
3\. Pembuatan Ruang "Warung Digital":  
   Sistem membuat grup chat publik baru di aplikasi Ngopi dengan nama "Warung Kopi \[Nama Cafe\]" dan otomatis menjadikan pemilik cafe sebagai Admin.  
4\. Akses Dashboard:  
   Pemilik cafe langsung bisa login ke ngopi.top/merchant-dashboard (tanpa perlu daftar ulang).  
5\. Notifikasi Sukses:  
   Mengirim pesan selamat datang di aplikasi: "Selamat bergabung, \[Nama Cafe\]\! QR Code Anda sudah tersedia di chat ini. Anda bisa mulai mengatur promo di Dashboard."

\---

🤖 BAGIAN 4: PROMPT AI AGENT (Untuk Menjalankan Fitur Ini)

Berikut adalah prompt yang sudah direvisi yang bisa Anda copy-paste ke Antigravity IDE / Cursor:

\`\`\`markdown  
\# PROMPT: Fitur Digital MoU & Auto-Onboarding Merchant (Cafe) via In-App Pop-up

\#\# Tujuan  
Membuat halaman \`ngopi.top/partnership\` (hanya bisa diakses user yang login) di mana pemilik cafe bisa mengisi form dan menyetujui MoU. Setelah diajukan, sistem akan mengirimkan POP-UP REAL-TIME via WebSocket ke akun user tersebut untuk verifikasi. Setelah diverifikasi, QR Code otomatis dikirim ke Inbox/Chat Ngopi mereka.

\#\# 1\. Database Schema (Prisma)  
\`\`\`prisma  
model MerchantAgreement {  
  id            String   @id @default(cuid())  
  user\_id       String   @unique  
  username      String   // Diambil dari akun Ngopi yang login  
  cafe\_name     String  
  address       String  
  phone         String  
  agreement\_text String  // Snapshot teks MoU saat disetujui  
  is\_agreed     Boolean  @default(false)  
  signed\_at     DateTime?  
  qr\_token      String?  @unique // Token unik untuk QR Code  
  created\_at    DateTime @default(now())  
    
  user          User     @relation(fields: \[user\_id\], references: \[id\])  
}  
\`\`\`

2\. Backend Logic & WebSocket (API)

· Middleware Auth: Pastikan endpoint /api/partnership/\* dilindungi oleh JWT (hanya user login).  
· POST /api/partnership/submit: Menyimpan data form MoU.  
· POST /api/partnership/verify-sign:  
  · Menerima parameter konfirmasi dari frontend.  
  · Simpan is\_agreed \= true, signed\_at \= now().  
  · Generate qr\_token (menggunakan crypto.randomUUID()).  
  · Generate gambar QR Code menggunakan library qrcode.  
  · Fitur Kunci: Kirim pesan otomatis (System Message) ke chat room antara sistem dan user (atau ke Inbox user) yang berisi teks "Kerja sama berhasil\!" beserta lampiran file PDF/PNG QR Code tersebut.  
  · Ubah role user menjadi merchant.  
  · Buat grup chat publik otomatis "Warung Kopi \[Nama Cafe\]".  
  · Kirim event Socket.IO partnership:verified ke klien.

3\. Frontend UI (React)

· Buat halaman /partnership (proteksi route, redirect ke login jika belum masuk).  
· Multi-step form: (1) Isi Data \-\> (2) Baca MoU (Scrollable) \-\> (3) Centang Setuju \-\> (4) Klik "Ajukan Kerja Sama".  
· Saat tombol diklik: Tampilkan modal loading menunggu pop-up verifikasi.  
· Fitur Pop-up (WebSocket Listener): Dengarkan event Socket.IO. Jika ada event verifikasi, tampilkan modal SweetAlert / Dialog yang menampilkan ringkasan MoU dengan tombol besar "Verifikasi & Tandatangani".  
· Setelah tombol pop-up ditekan, panggil API /api/partnership/verify-sign, lalu arahkan ke halaman /merchant-dashboard atau buka chat inbox tempat QR Code dikirim.

Tugas Anda:

Implementasikan schema, endpoint API, Socket.IO listener, dan UI secara berurutan. Pastikan QR Code ter-generate dengan benar dan terkirim sebagai file (bukan hanya teks) di fitur chat/inbox aplikasi Ngopi.

\`\`\`

Dengan revisi ini, \*flow\*-nya menjadi sangat modern: Pemilik cafe tidak perlu buka email untuk memverifikasi atau mencari file. Semuanya terintegrasi langsung di dalam aplikasi \`ngopi.top\`\! ☕📲🚀