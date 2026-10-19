Ide yang sangat brilian\! Mengintegrasikan Ngopi (sebagai aplikasi chat/komunitas digital) dengan Cafe fisik adalah strategi "Phygital" (Physical \+ Digital) yang bisa mendatangkan traffic ke cafe teman Anda dan menambah pengguna aktif ke Ngopi.

Untuk meyakinkan teman Anda, jangan hanya bilang "Ini aplikasi chat". Jelaskan bahwa Ngopi adalah "Alat Loyalitas Pelanggan & Komunitas" untuk cafe mereka.

Berikut adalah panduan langkah demi langkah, fitur yang bisa diintegrasikan, dan cara pitching (menawarkan) ke teman Anda.

\---

🎯 1\. Value Proposition (Apa Untungnya buat Cafe Teman Anda?)

Sebelum mengajak, siapkan "amunisi" ini:

1\. Meningkatkan Repeat Order (Kunjungan Ulang): Pelanggan akan datang lagi untuk check-in di Ngopi dan mengumpulkan poin.  
2\. Gratis Promosi & Notifikasi: Cafe bisa broadcast promo langsung ke HP pelanggan yang ada di sekitar cafe.  
3\. Event Gathering (Anti-Sepi): Bikin turnamen Gapleh/Catur offline di cafe, tapi matchmaking dan leaderboard-nya lewat aplikasi Ngopi.  
4\. Pembayaran Modern (Web3): Cafe bisa menerima pembayaran pakai Token BMC atau Poin Ngopi.

\---

🛠️ 2\. Fitur yang Perlu Dibangun di Ngopi (Integrasi Teknis)

Untuk merealisasikan ini, Anda perlu menambahkan fitur khusus "Ngopi for Business" di ngopi.top:

A. Fitur "Cafe / Warung Partner" di Aplikasi

· Verified Cafe Channel: Buat ruang khusus (seperti Warung Kopi digital) khusus untuk cafe tersebut. Pelanggan bisa join untuk lihat menu, promo, dan chat dengan barista.  
· Cafe Dashboard (Web Admin): Teman Anda bisa login di web untuk mengatur menu, mengirim siaran promo, dan melihat statistik pelanggan.

B. Fitur "Check-in & Loyalty" (Stempel Digital)

· QR Code di Meja Cafe: Di setiap meja ada QR Code. Pelanggan scan pakai aplikasi Ngopi.  
· Reward Poin: Setiap scan (maksimal 1x sehari), pelanggan dapat 50 Poin Ngopi.  
· Redeem: Tukar 500 Poin dengan 1 gelas Kopi Susu gratis (sistem validasi di kasir).

C. Fitur "Order & Pay" (Opsional tapi Keren)

· Pesan dari Meja: Pelanggan scan QR, pesan menu, dan bayar via Ngopi (pakai QRIS, e-wallet, atau Token BMC).  
· Panggil Barista: Tombol darurat di aplikasi "Panggil Pelayan / Minta Bill".

D. Integrasi Game dengan Cafe

· Offline Tournament: Tombol di aplikasi "Turnamen Gapleh di \[Nama Cafe\]". Aplikasi mendata siapa yang hadir, membuat bagan pertandingan, dan menampilkan skor secara real-time.

\---

🤝 3\. Langkah Eksekusi (Cara Mengajak Teman Anda)

Berikut adalah script atau cara Anda mempresentasikannya:

Langkah 1: Buat "Pilot Project" (Uji Coba di 1 Cafe)  
Jangan ajak semua teman Anda sekaligus. Pilih 1 cafe milik teman yang paling dekat dan antusias dengan teknologi.

"Bro, gue lagi bangun ekosistem Ngopi. Gue mau pakai cafe lu sebagai pilot project pertama. Gue bikinin sistem poin digital dan komunitas gapleh di aplikasi. Pelanggan lu bakal dateng lebih sering buat kumpulin poin. Gue gratis-in buat lu, asal mau jadi tempat uji coba."

Langkah 2: Siapkan Plakat QR Code  
Buat desain standing table kecil yang ditaruh di meja cafe. Isinya:

· "Scan untuk dapet Kopi Gratis & Main Gapleh bareng komunitas"  
· QR Code yang mengarah ke ngopi.top/warung/\[namacafe\]

Langkah 3: Berikan "Merchant Dashboard"  
Tunjukkan ke teman Anda (sang pemilik cafe) bahwa mereka punya kontrol. Mereka bisa melihat data:

· "Hari ini ada 50 orang check-in di cafe lu."  
· "Promo 'Diskon 10% jam 3 sore' berhasil diklik 30 orang."  
· Data ini yang bikin pemilik cafe cinta sama aplikasi Anda.

Langkah 4: Buat Event "Ngopi Bareng Komunitas"  
Atur jadwal setiap minggu atau dua minggu sekali. Misalnya: "Jumat Malam: Turnamen Gapleh di \[Nama Cafe\]. Juara 1 dapat 1000 Poin Ngopi \+ Kopi Gratis 1 Bulan." Pemilik cafe pasti senang karena cafe-nya penuh pada jam sepi (weekday nights).

\---

💰 4\. Model Bisnis (Biar Sama-Sama Untung)

Bagaimana Anda dan Cafe ini menghasilkan uang?

1\. Komisi F\&B (Opsional): Jika pelanggan pesan makanan/minuman via Ngopi, Ngopi ambil komisi kecil (misal 2-5%).  
2\. Langganan Fitur Premium (Merchant): Gratis di awal, tapi jika cafe sudah banyak transaksi, mereka bayar langganan (atau bayar pakai Token BMC).  
3\. Cross-Promotion: Setiap pengguna baru Ngopi yang daftar via QR Code Cafe, Cafe dapat fee (misal Rp 2.000 / user).

\---

🚀 Status Implementasi Fitur "Merchant Cafe Integration" di Ngopi:

✅ **STATUS: SELESAI DIIMPLEMENTASIKAN (100% COMPLETE & TESTED)**

### A. Backend & Database
1. ✅ **Role `merchant`**:
   - Ditambahkan pada enum/role sistem di [rbac.middleware.ts](file:///C:/Users/dummy/Documents/Projects/ngopi/backend/src/middleware/rbac.middleware.ts) & [auth.middleware.ts](file:///C:/Users/dummy/Documents/Projects/ngopi/backend/src/middleware/auth.middleware.ts).
   - Middleware `requireMerchant` tersedia untuk memproteksi aksi manajerial cafe.
2. ✅ **Schema Prisma & Database**:
   - `MerchantProfile` (id, user_id, cafe_name, address, phone, logo, banner_url, qr_code_token, reward_points) di [schema.prisma](file:///C:/Users/dummy/Documents/Projects/ngopi/backend/prisma/schema.prisma).
   - `MerchantPromo` (id, merchant_id, title, description, discount, valid_until, is_active).
   - `MerchantCheckin` (id, merchant_id, user_id, username, points, note, created_at).
   - Multi-layer persistence: Terintegrasi dengan Prisma PostgreSQL dan fallback otomatis file JSON (`uploads/merchants_data.json`) saat mode offline/standalone.
3. ✅ **Service & Endpoints REST API**:
   - [merchant.service.ts](file:///C:/Users/dummy/Documents/Projects/ngopi/backend/src/services/merchant.service.ts), [merchant.controller.ts](file:///C:/Users/dummy/Documents/Projects/ngopi/backend/src/controllers/merchant.controller.ts), dan [merchant.routes.ts](file:///C:/Users/dummy/Documents/Projects/ngopi/backend/src/routes/merchant.routes.ts) terpasang di `/api/merchant`:
     - `GET /api/merchant/partners`: Mengambil daftar cafe partner resmi & promo aktif.
     - `GET /api/merchant/cafe/:tokenOrId`: Halaman publik cafe untuk melihat profil, promo, dan menu.
     - `POST /api/merchant/checkin`: Validasi token QR meja cafe, menambah 50 Poin Ngopi ke akun pengguna dengan aturan ketat **maksimal 1x sehari per cafe partner per user**.
     - `GET /api/merchant/dashboard`: Statistik kunjungan hari ini, total check-in, poin terdistribusi, data pengunjung terkini, dan plakat meja QR siap cetak.
     - `POST /api/merchant/profile`: Pendaftaran atau pembaruan profil cafe oleh pemilik.
     - `POST /api/merchant/promo` & `DELETE /api/merchant/promo/:promoId`: Tambah dan hapus promo voucher kasir.
4. ✅ **Pengujian Otomatis (Unit/Integration Tests)**:
   - File test [merchant.test.ts](file:///C:/Users/dummy/Documents/Projects/ngopi/backend/tests/merchant.test.ts) lulus 100% (7 test scenarios mencakup: daftar partner, detail cafe, check-in dapat 50 poin, penolakan check-in ganda di hari yang sama, registrasi cafe, pembuatan dashboard, dan promo).

---

### B. Frontend & User Interface
1. ✅ **Komponen Check-in Meja Cafe**:
   - [CafeCheckinModal.tsx](file:///C:/Users/dummy/Documents/Projects/ngopi/frontend/src/components/CafeCheckinModal.tsx):
     - Modal interaktif untuk memindai token QR meja cafe.
     - Menampilkan daftar cafe partner terdekat, opsi input token manual/pindai, notifikasi perolehan +50 Poin kopi, dan pencegahan check-in berulang di hari yang sama.
2. ✅ **Halaman / Modal "Warung [Nama Cafe]"**:
   - [CafePartnerModal.tsx](file:///C:/Users/dummy/Documents/Projects/ngopi/frontend/src/components/CafePartnerModal.tsx):
     - Menampilkan nama cafe partner, badge verified, banner & logo cafe, alamat, kontak barista/pelayan.
     - Menampilkan voucher promo aktif yang bisa langsung ditunjukkan ke kasir.
     - Tombol cepat: *"Check-in di Meja Cafe Ini (+50 Poin)"*.
     - Rekomendasi menu andalan warkop.
   - Route URL: [frontend/app/(main)/warung/[id].tsx](file:///C:/Users/dummy/Documents/Projects/ngopi/frontend/app/(main)/warung/[id].tsx) (bisa dibuka via `ngopi.top/warung/:qrToken`).
3. ✅ **Halaman Merchant Dashboard (Pemilik Cafe)**:
   - [MerchantDashboardModal.tsx](file:///C:/Users/dummy/Documents/Projects/ngopi/frontend/src/components/MerchantDashboardModal.tsx):
     - Web UI khusus teman Anda (pemilik cafe).
     - Menampilkan 4 metrik live: Check-in Hari Ini, Total Kunjungan, Poin Dibagikan, Pelanggan Unik.
     - **Plakat Meja QR Code (Standing Table Card)**: Menampilkan QR Code beresolusi tinggi dengan instruksi *"Scan di meja ini untuk dapat Kopi Gratis & Main Gapleh"*, tombol salin link, dan tombol cetak plakat.
     - Manajemen Promo: Tambah dan hapus voucher diskon cafe.
     - Live Feed Pengunjung: Melihat username pelanggan yang baru saja check-in.
     - Pengaturan Cafe: Ubah nama cafe, alamat, deskripsi, dan reward poin.
   - Route URL: [frontend/app/(main)/merchant/index.tsx](file:///C:/Users/dummy/Documents/Projects/ngopi/frontend/app/(main)/merchant/index.tsx).
4. ✅ **Integrasi ke Warung Kopi Ngopi**:
   - Terintegrasi di [warkop.tsx](file:///C:/Users/dummy/Documents/Projects/ngopi/frontend/app/(main)/warkop.tsx):
     - Quick Chip: `☕ Check-in Cafe (+50)` di bilah aksi cepat ruang obrolan warkop.
     - Drawer Menu: Kartu fitur *Check-in Cafe Partner* dan *Merchant Dashboard (Bisnis Cafe)*.
     - [PointsHubModal.tsx](file:///C:/Users/dummy/Documents/Projects/ngopi/frontend/src/components/PointsHubModal.tsx): Kartu misi *Check-in Meja Cafe Partner (+50 Poin)* di ringkasan saldo poin.

---

☕🤝🚀 Dengan integrasi ini, Ngopi resmi memiliki kapabilitas **Phygital (Physical + Digital)** untuk menghubungkan cafe fisik teman Anda dengan ekosistem poin & turnamen komunitas Ngopi!