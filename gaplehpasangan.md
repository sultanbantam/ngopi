# PROMPT.md — Pengembangan Gapleh Berpasangan di Ngopi

## Peran Agent

Anda adalah senior full-stack engineer, game developer, product designer, dan QA engineer. Anda bekerja pada aplikasi Ngopi yang sudah berjalan di https://ngopi.top/, khususnya halaman Meja Warkop dan game Gapleh.

Tugas Anda adalah **memeriksa implementasi yang sudah ada, lalu menambahkan mode Gapleh Berpasangan** tanpa merusak mode Gapleh Individu yang saat ini sudah berfungsi.

Jangan langsung menulis ulang seluruh modul. Pelajari struktur repository, framework, database, autentikasi, sistem meja, state permainan, bot, perhitungan skor, dan pola UI yang sudah dipakai. Ikuti arsitektur dan konvensi proyek yang ada.

## Konteks Produk Saat Ini

- Halaman daftar permainan: `https://ngopi.top/games`
- Halaman meja permainan menggunakan pola URL seperti `/games/tbl_<id>`.
- Game Gapleh individu sudah tersedia.
- Meja menampilkan hingga empat kursi, status pemain/bot, tombol siap dan mulai main, papan domino, kartu di tangan pemain, tombol pass, serta modal hasil.
- Pada mode individu saat ini, contoh modal hasil menampilkan poin per pemain dan pemenang pada kondisi “Gaple Buntu”. Pertahankan perilaku mode individu yang sudah ada, termasuk aturan poin menang **50 poin**, kecuali setelah pemeriksaan kode ditemukan bahwa nilai tersebut dikonfigurasi di tempat lain.
- Antarmuka memakai nuansa Warkop Ngopi: gelap, aksen cokelat/kopi, papan hijau, ramah, responsif, dan konsisten dengan UI yang ada.

## Sasaran Pengembangan

Tambahkan pilihan **Gapleh Individu** dan **Gapleh Berpasangan**. Mode individu tetap bekerja seperti sekarang. Mode berpasangan harus mendukung:
1. Pemilihan gaya permainan: **Gaya Kampung** atau **Gaya Pertandingan/Turnamen**.
2. Memilih pasangan dari pengguna yang tersedia atau mengundang pasangan.
3. Memilih pasangan manusia atau bot; lawan juga dapat diisi manusia atau bot.
4. Aturan menang/kalah dan penghitungan skor yang eksplisit, konsisten, dapat diuji, dan ditampilkan dengan transparan.
5. Ringkasan hasil yang menjelaskan mengapa suatu pasangan menang/kalah dan bagaimana poin dihitung.

**Catatan penting tentang aturan:** aturan gapleh berbeda antarwilayah dan penyelenggara. Jangan mengklaim bahwa satu rumus adalah aturan nasional resmi jika tidak ada regulasi resmi yang dapat diverifikasi. Implementasikan aturan sebagai *ruleset* yang jelas dan dapat dikonfigurasi. Beri label “Preset Turnamen Ngopi” untuk aturan bawaan turnamen, bukan “aturan nasional resmi”. Bila repository sudah memiliki aturan turnamen terdokumentasi, gunakan dan pertahankan sumber tersebut.

---

# BAGIAN A — PENGALAMAN MEMBUAT MEJA

## 1. Alur pembuatan meja

Saat pengguna memilih Gapleh, sediakan pilihan mode:

- **Individu** — empat pemain bersaing sendiri-sendiri. Pertahankan sistem yang sudah ada.
- **Berpasangan** — dua tim, masing-masing terdiri dari dua pemain.

Jika memilih Berpasangan, tampilkan konfigurasi berikut:

### Gaya permainan
- **Gaya Kampung** — aturan sederhana, mudah dipahami, cocok untuk main santai.
- **Gaya Pertandingan/Turnamen** — aturan dan skor lebih terstruktur, dengan target pertandingan serta pencatatan hasil per putaran.

Tampilkan ringkasan aturan sebelum meja dibuat. Sediakan tautan/tombol “Lihat Aturan” agar pemain memahami cara menang, cara menentukan pemenang saat buntu, dan cara menghitung poin.

### Komposisi pemain
Sediakan pilihan yang mudah dipahami:
- Saya + pasangan yang diundang vs 2 pemain lain.
- Saya + bot vs 2 pemain/bot lain.
- Saya dan 3 bot, dengan penempatan tim yang jelas.
- Meja privat dengan kode/link undangan.
- Jika didukung sistem saat ini, meja publik untuk mencari pemain.

Jangan membuat alur yang menjanjikan fitur undangan atau presence yang belum didukung backend. Implementasikan sesuai kemampuan autentikasi, realtime, dan database yang ditemukan. Jika undangan belum tersedia, buat mekanisme undangan meja berbasis kode/link yang aman dan sesuai arsitektur proyek.

## 2. Memilih atau mengundang pasangan

- Tampilkan daftar pengguna yang benar-benar dapat diundang berdasarkan mekanisme presence/online yang tersedia. Jangan mengarang status online.
- Cari pengguna berdasarkan nama/username jika fitur pencarian pengguna tersedia.
- Pengundang dapat memilih kursi pasangan, lalu mengirim undangan.
- Undangan mempunyai status: menunggu, diterima, ditolak, kedaluwarsa, atau dibatalkan.
- Tampilkan notifikasi yang sesuai dengan pola notifikasi aplikasi.
- Pemain yang menerima undangan dapat menerima atau menolak sebelum pertandingan dimulai.
- Pastikan satu pengguna tidak dapat menempati dua kursi pada meja yang sama.
- Jika pasangan keluar sebelum pertandingan dimulai, kursi menjadi kosong dan dapat diundang kembali.
- Jika pasangan terputus saat pertandingan berlangsung, gunakan mekanisme reconnect yang sudah ada. Jangan langsung mengubah pasangan atau memindahkan kartu tanpa aturan yang jelas.

## 3. Memilih bot

Sediakan pilihan yang jelas:
- **Pasangan saya: pemain / bot**
- **Lawan: pemain / bot**

Dukung konfigurasi tim berikut sejauh arsitektur meja memungkinkan:
- Tim A: pengguna + pengguna; Tim B: pengguna + pengguna.
- Tim A: pengguna + bot; Tim B: pengguna + pengguna/bot.
- Tim A: pengguna + pengguna; Tim B: bot + bot.
- Tim A: pengguna + bot; Tim B: pengguna + bot.

Bot harus menempati kursi dan mengikuti aturan permainan yang sama dengan manusia. Jangan membuat bot mengetahui kartu lawan atau menggunakan informasi tersembunyi yang tidak boleh diketahui pemain. Strategi bot minimal:
1. Memainkan batu yang sah.
2. Jika ada beberapa pilihan, mempertimbangkan jumlah mata, angka yang masih tersedia pada ujung meja, dan risiko permainan buntu.
3. Dalam mode pasangan, sebisa mungkin mempertimbangkan peluang membantu rekan setim berdasarkan informasi yang sah dari jalannya permainan.
4. Jika tidak ada batu sah, melakukan pass sesuai aturan.
5. Mematuhi giliran dan batas waktu yang sama seperti pemain lain.

## 4. Posisi duduk dan tim

Untuk empat kursi, tempatkan pasangan secara berselang-seling agar giliran berjalan A1, B1, A2, B2 (atau urutan yang konsisten dengan engine saat ini). Contoh:
- Kursi 1: Tim A / Pemain A1
- Kursi 2: Tim B / Pemain B1
- Kursi 3: Tim A / Pemain A2
- Kursi 4: Tim B / Pemain B2

Tampilkan indikator Tim A/Tim B atau warna/badge tim yang jelas, nama pasangan, status siap, status bot/manusia, dan giliran saat ini. Jangan hanya mengandalkan warna; sertakan label teks atau ikon yang aksesibel.

---

# BAGIAN B — ATURAN INTI GAME

## 5. Aturan dasar yang harus konsisten

- Gunakan satu set domino standar double-six, 28 batu, dari 0–0 sampai 6–6.
- Empat pemain masing-masing menerima 7 batu jika mode permainan saat ini memakai pembagian standar tersebut.
- Validasi semua gerakan di server/backend bila arsitektur mendukung server-authoritative game state. Klien tidak boleh menjadi sumber kebenaran tunggal untuk kartu, giliran, atau hasil.
- Batu hanya dapat dipasang jika salah satu ujungnya cocok dengan salah satu ujung terbuka rangkaian.
- Orientasi batu harus disesuaikan secara visual dengan angka yang cocok.
- Pass hanya boleh dilakukan jika pemain tidak memiliki batu yang sah, kecuali aturan existing secara eksplisit menyatakan variasi lain.
- Putaran selesai saat seorang pemain menghabiskan batu atau permainan buntu.
- Definisi **buntu** harus konsisten: seluruh pemain tidak dapat melakukan gerakan sah sesuai aturan pass yang dipilih. Pastikan kondisi buntu tidak terdeteksi terlalu cepat hanya karena satu pemain pass.
- Tangani balak, kartu ganda, batu terakhir, disconnect, reconnect, dan kondisi seri secara deterministik.
- Validasi bahwa tidak ada batu duplikat/hilang dan total batu tetap 28 selama satu putaran, dengan pengecualian batu yang telah dimainkan.
- Jangan mengubah urutan giliran atau kepemilikan kartu melalui aksi klien yang tidak sah.

## 6. Perhitungan mata batu

Nilai mata sebuah batu adalah jumlah kedua ujungnya:
- 6–6 = 12
- 6–2 = 8
- 3–4 = 7
- 0–5 = 5
- 0–0 = 0

Jumlah mata sisa pemain adalah total nilai semua batu yang masih dipegang pemain tersebut. Jumlah mata sisa tim adalah jumlah mata sisa kedua anggota tim.

Tampilkan perhitungan dengan jelas pada layar hasil. Jangan menyamakan **mata batu tersisa** dengan **poin pertandingan**; keduanya adalah konsep berbeda.

---

# BAGIAN C — PRESET GAYA KAMPUNG

## 7. Aturan dan skor Gaya Kampung

Gunakan preset yang sederhana dan jelaskan sebagai **Preset Kampung Ngopi**, yang bisa disesuaikan oleh pemilik meja sebelum permainan dimulai.

Aturan bawaan yang direkomendasikan:
1. Tim menang langsung jika salah satu anggotanya menghabiskan semua batu.
2. Jika permainan buntu, jumlahkan mata batu tersisa kedua anggota setiap tim.
3. Tim dengan jumlah mata tersisa lebih rendah menjadi pemenang putaran.
4. Jika jumlah mata kedua tim sama, putaran seri dan tidak ada poin kemenangan.
5. Tim pemenang mendapatkan **50 poin pertandingan untuk setiap anggota tim**. Tim lawan mendapatkan 0 poin kemenangan.
6. Jika buntu, tampilkan juga jumlah mata sisa tiap tim. Jangan menambahkan mata batu lawan ke poin kemenangan secara otomatis dalam preset ini.
7. Opsi variasi: pemilik meja dapat memilih mode “Poin berdasarkan mata lawan tersisa”, dengan aturan: tim pemenang memperoleh poin sebesar jumlah mata tersisa tim lawan. Pilihan ini harus dijelaskan sebelum mulai dan tidak boleh tercampur dengan mode 50 poin tetap.

Contoh A — Tim A menang karena batu habis:
- A1 menghabiskan batu.
- Tim B masih memiliki total 18 mata.
- Tim A menang.
- Skor pertandingan: A1 +50, A2 +50; B1 +0, B2 +0.

Contoh B — Putaran buntu:
- Tim A tersisa 14 mata.
- Tim B tersisa 22 mata.
- Tim A menang karena 14 lebih kecil daripada 22.
- Skor pertandingan: A1 +50, A2 +50; B1 +0, B2 +0.

Contoh C — Buntu dan mata sama:
- Tim A tersisa 18 mata.
- Tim B tersisa 18 mata.
- Putaran seri; tidak ada poin kemenangan.
- Tampilkan “Seri: jumlah mata tersisa kedua tim sama”.

Skor +50 di atas adalah **poin leaderboard Ngopi untuk kemenangan putaran**, bukan nilai mata domino. Pertahankan nilai kemenangan 50 poin pada mode individu yang sudah ada. Jika sistem saat ini mempunyai ekonomi poin, XP, ranking, atau reward lain, periksa dampaknya dan jangan memberikan reward ganda.

---

# BAGIAN D — PRESET PERTANDINGAN/TURNAMEN

## 8. Prinsip preset turnamen

Buat **Preset Turnamen Ngopi**, bukan klaim aturan nasional resmi. Preset ini harus deterministik dan mendukung pencatatan hasil per putaran. Jika ditemukan peraturan turnamen resmi tertentu dalam dokumentasi repository atau sumber yang telah disetujui pemilik produk, jadikan ruleset terpisah dengan nama dan sumber yang jelas.

Konfigurasi bawaan yang direkomendasikan:
- Pertandingan terdiri dari beberapa putaran.
- Target skor default **250 poin per tim**, dapat dikonfigurasi sebelum meja dimulai.
- Untuk tiap putaran, jumlahkan mata batu tersisa dua anggota masing-masing tim.
- Jika pemain menghabiskan batu, timnya menang putaran; catat total mata sisa tim lawan sebagai nilai putaran.
- Jika permainan buntu, tim dengan jumlah mata tersisa paling rendah menang putaran; nilai putaran untuk tim pemenang adalah selisih jumlah mata sisa tim lawan dikurangi mata sisa tim pemenang.
- Jika nilai mata sisa sama saat buntu, putaran seri dengan nilai 0.
- Tambahkan nilai putaran ke total skor tim pemenang. Tim lawan tidak mendapat nilai putaran.
- Tim pertama yang mencapai atau melampaui target 250 poin memenangkan pertandingan. Jika satu putaran membuat kedua tim memenuhi target karena aturan lain yang ditemukan di repository, gunakan aturan tie-break yang eksplisit; jangan mengarang hasil.
- Jika aturan turnamen yang telah diverifikasi di repository bertentangan dengan preset rekomendasi ini, pertahankan aturan existing atau minta konfirmasi pemilik produk sebelum menggantinya.

Contoh hitung preset turnamen:
- Tim A menghabiskan batu dan Tim B memiliki 26 mata tersisa: Tim A memperoleh 26 poin putaran.
- Pada putaran buntu, Tim A tersisa 12 mata dan Tim B tersisa 20 mata: Tim A menang putaran dengan selisih 8, sehingga memperoleh 8 poin.
- Jika kedua tim tersisa 16 mata: seri, skor putaran 0.
- Akumulasi poin tiap tim ditampilkan terpisah dari leaderboard/XP akun.

**Peringatan implementasi:** rumus ini merupakan rekomendasi produk untuk preset turnamen Ngopi. Jangan menyebutnya sebagai satu-satunya rumus turnamen nasional. Buat rules engine agar rumus dapat diganti tanpa menulis ulang UI dan logika permainan.

## 9. Pilihan konfigurasi tambahan turnamen

Jika mudah diterapkan dan tidak mengganggu mode existing, sediakan:
- Target skor: 100 / 150 / 200 / 250 / kustom.
- Cara nilai putaran: “total mata lawan tersisa” atau “selisih mata saat buntu”.
- Seri: tidak ada poin atau putaran ulang.
- Jumlah putaran atau batas waktu, jika didukung.
- Ringkasan aturan sebelum tombol “Mulai Main”.

Semua pengaturan harus tersimpan pada meja/pertandingan dan tidak boleh berubah di tengah pertandingan kecuali pertandingan di-reset oleh host sebelum mulai.

---

# BAGIAN E — PENJELASAN MENANG/KALAH

## 10. Modal hasil yang informatif

Perbarui modal “Permainan Selesai” agar untuk mode pasangan menampilkan:

- Pemenang: Tim A atau Tim B, beserta nama kedua anggota.
- Alasan menang: “Salah satu anggota Tim A menghabiskan batu”, atau “Permainan buntu; mata tersisa Tim A 14, Tim B 22”.
- Rincian mata batu tersisa setiap pemain.
- Total mata sisa tiap tim.
- Rumus poin yang digunakan.
- Poin putaran yang didapat setiap tim.
- Akumulasi skor pertandingan, khususnya preset turnamen.
- Status pertandingan: menang, kalah, atau seri.
- Tombol “Main Lagi” dan “Kembali ke Meja Warkop” sesuai pola navigasi existing.

Contoh teks:
> Tim A menang karena permainan buntu. Tim A memiliki 14 mata tersisa, sedangkan Tim B memiliki 22 mata tersisa. Berdasarkan Preset Kampung Ngopi, tim dengan mata tersisa lebih rendah menang. Tim A memperoleh 50 poin kemenangan untuk masing-masing anggota.

Jangan hanya menampilkan “Pemenang poin terendah” tanpa menjelaskan apakah angka itu mata batu tersisa atau poin pertandingan.

---

# BAGIAN F — DATA, KEAMANAN, DAN KOMPATIBILITAS

## 11. Model data dan state

Sesuaikan dengan model yang sudah ada, tetapi pastikan konsep berikut tersimpan secara konsisten:
- `gameMode`: individual / partnership
- `ruleset`: village / tournament
- `teamId` untuk setiap kursi/pemain
- `seatIndex` dan urutan giliran
- `playerType`: human / bot
- `inviteStatus` dan identitas pengundang/penerima bila undangan didukung
- `roundNumber`, `roundStatus`, `roundWinnerTeamId`
- mata batu tersisa tiap pemain dan tiap tim
- poin putaran tiap tim
- total skor pertandingan tiap tim
- konfigurasi ruleset yang digunakan pada saat pertandingan dibuat
- log gerakan yang diperlukan untuk audit dan rekoneksi

Nama field di atas adalah konsep, bukan keharusan untuk mengganti nama schema existing. Ikuti pola proyek dan lakukan migrasi database yang aman jika diperlukan.

## 12. Keamanan dan fairness

- Jangan mempercayai skor atau pemenang yang dikirim klien. Hitung ulang pada server/backend atau lapisan authoritative yang sesuai.
- Jangan mengirim isi kartu pemain ke klien pemain lain.
- Validasi kursi, tim, giliran, batu yang dimainkan, dan kondisi pass.
- Cegah pemain bergabung ke kursi penuh atau menggunakan undangan milik pengguna lain.
- Pastikan bot hanya memiliki akses ke kartu bot dan informasi publik permainan.
- Hindari perubahan yang merusak meja/pertandingan lama.
- Gunakan transaksi/atomic update bila tersedia untuk mencegah dua gerakan bersamaan.
- Jangan menambahkan sistem taruhan uang atau transaksi uang. Poin adalah skor permainan/leaderboard sesuai kebijakan aplikasi.
- Jangan menampilkan informasi privat pengguna yang tidak dibutuhkan.

## 13. Realtime dan kondisi tepi

Uji dan tangani:
- Dua pemain menekan mulai secara bersamaan.
- Pemain keluar sebelum atau saat pertandingan.
- Koneksi terputus lalu tersambung kembali.
- Bot berada pada giliran yang benar.
- Tidak ada gerakan legal dan semua pemain pass.
- Batu terakhir dimainkan.
- Poin sama saat permainan buntu.
- Permainan baru dimulai ulang.
- Host meninggalkan meja.
- Pemain mencoba mengirim gerakan ilegal atau berulang.
- Browser refresh ketika pertandingan berlangsung.

Gunakan sistem realtime/persistensi yang telah dipakai proyek. Jangan menambah layanan eksternal baru tanpa kebutuhan dan persetujuan.

---

# BAGIAN G — UI/UX

## 14. Desain antarmuka

Pertahankan bahasa Indonesia dan identitas visual Ngopi:
- Tema gelap bernuansa kopi.
- Papan hijau dan batu domino yang kontras.
- Tata letak adaptif desktop dan mobile.
- Tombol besar dan jelas untuk “Pilih Pasangan”, “Undang”, “Pilih Bot”, “Lihat Aturan”, “Siap”, dan “Mulai Main”.
- Tim A dan Tim B dibedakan dengan label/badge, bukan warna saja.
- Status giliran dan status pass harus terlihat.
- Pada mode pasangan, tampilkan nama rekan setim dan lawan secara jelas.
- Gunakan dialog konfirmasi untuk meninggalkan pertandingan jika dapat menyebabkan kekalahan/forfeit.
- Jangan menutupi batu atau tombol aksi penting dengan pemutar radio atau elemen floating yang sudah ada; periksa responsivitas layout.

Jangan menghapus fitur suara, chat, reaksi emoji, musik/radio, atau fitur meja lain yang sudah berjalan, kecuali memang ada konflik teknis yang dibuktikan dan perubahan disetujui.

---

# BAGIAN H — MIGRASI DAN KUALITAS KODE

## 15. Strategi implementasi

Lakukan secara bertahap:
1. Audit repository dan petakan entry point game, model data, state, engine aturan, bot, UI meja, hasil pertandingan, dan sistem skor.
2. Tuliskan ringkasan temuan serta file yang akan diubah.
3. Buat rules engine untuk memisahkan logika individu, kampung, dan turnamen dari komponen UI.
4. Tambahkan mode pasangan dan pemetaan kursi ke tim.
5. Tambahkan perhitungan skor berbasis ruleset.
6. Tambahkan pemilihan/invitasi pasangan dan konfigurasi bot sesuai infrastruktur yang ada.
7. Perbarui UI hasil dan ringkasan aturan.
8. Tambahkan migrasi database yang kompatibel bila diperlukan.
9. Jalankan lint, typecheck, unit test, integration test, dan build yang tersedia.
10. Perbaiki regresi sebelum menyatakan selesai.

Jangan berhenti setelah membuat mockup atau tombol UI. Pastikan alur permainan nyata bekerja dari pembuatan meja hingga hasil dan skor tersimpan.

## 16. Pengujian minimum wajib

Buat unit test untuk:
- Validasi gerakan batu.
- Penghitungan nilai batu dan jumlah mata sisa pemain/tim.
- Menang karena batu habis.
- Buntu dengan mata tim berbeda.
- Buntu dengan mata tim sama.
- Kampung: kemenangan memberikan 50 poin kepada masing-masing anggota tim pemenang.
- Turnamen: total mata lawan tersisa, selisih mata saat buntu, seri, akumulasi skor, dan kondisi mencapai target.
- Mode individu tetap memberikan 50 poin untuk menang seperti sebelumnya.
- Tim tersusun berselang-seling dengan benar.
- Bot tidak bermain di luar giliran.
- Pass hanya sah jika tidak ada gerakan legal.
- Satu batu tidak dapat dimainkan dua kali.
- Refresh/reconnect tidak menggandakan poin.
- Satu putaran hanya dihitung satu kali.

Gunakan contoh test yang eksplisit:
1. Kampung, Tim A menang karena batu habis; Tim B tersisa 18 mata → A1 +50, A2 +50, B1 +0, B2 +0.
2. Kampung, buntu: Tim A 14 mata, Tim B 22 mata → Tim A menang, kedua anggota Tim A masing-masing +50.
3. Kampung, buntu: Tim A 18 mata, Tim B 18 mata → seri, 0 poin kemenangan.
4. Turnamen, Tim A menang dengan menghabiskan batu, Tim B tersisa 26 mata → Tim A +26 skor putaran.
5. Turnamen, buntu: Tim A 12 mata, Tim B 20 mata → Tim A +8 skor putaran.
6. Turnamen, buntu: kedua tim 16 mata → skor putaran 0.
7. Mode individu lama diuji sebagai regresi.

## 17. Kriteria penerimaan

Fitur dianggap selesai hanya jika:
- Pengguna dapat memilih Individu atau Berpasangan.
- Mode individu lama tidak rusak.
- Pengguna dapat memilih Gaya Kampung atau Preset Turnamen Ngopi.
- Tim dan posisi duduk jelas dan benar.
- Pemain dapat memilih pasangan manusia atau bot sesuai kemampuan sistem.
- Undangan, jika diimplementasikan, memiliki alur status yang nyata, bukan tombol dekoratif.
- Pemenang setiap putaran ditentukan dengan aturan yang konsisten.
- Perhitungan mata, poin putaran, dan skor pertandingan dipisahkan dengan benar.
- Modal hasil menjelaskan alasan menang/kalah dan perhitungan poin.
- Skor tidak terduplikasi ketika halaman refresh atau event realtime terulang.
- Test, lint, typecheck, dan build yang tersedia lulus; jika ada yang gagal karena masalah existing, dokumentasikan dengan bukti.
- Dokumentasikan file yang diubah, migrasi, asumsi aturan, cara menguji, dan hal yang belum selesai.

## 18. Instruksi akhir kepada agent

Mulai dengan audit kode. Jangan mengasumsikan framework, database, autentikasi, atau sistem realtime sebelum memeriksanya. Pertahankan gaya kode dan fitur existing. Utamakan perubahan kecil yang aman, tes yang dapat diulang, dan aturan yang transparan.

Jika menemukan ketidakjelasan yang berpengaruh besar pada kompatibilitas atau hasil skor, jangan diam-diam memilih aturan yang merusak data lama. Pilih preset yang dijelaskan di prompt ini, dokumentasikan asumsi, dan buat aturan mudah dikonfigurasi. Jika perubahan memerlukan keputusan produk yang tidak dapat disimpulkan dari prompt ini, laporkan pertanyaan spesifik tersebut sebelum melakukan perubahan destruktif.
