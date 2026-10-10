Berikut adalah PROMPT.md lengkap yang mencakup review, evaluasi, perbaikan teknis, dan seluruh pengembangan fitur yang kita bahas. Simpan file ini sebagai PROMPT\_NGOPI\_MASTER.md dan jalankan ke AI Agent (Codex, Cursor, Windsurf) secara bertahap.

\---

\`\`\`markdown  
\# MASTER PROMPT: Ngopi — Review, Evaluasi & Pengembangan Fitur (v2.0)

\#\# 0\. KONTEKS PROYEK

\- \*\*Nama Aplikasi\*\*: Ngopi  
\- \*\*Tagline\*\*: "ngobrol paling intim"  
\- \*\*URL\*\*: https\://ngopi.top  
\- \*\*Asal\*\*: Kloningan dari BambooChat, dengan penyederhanaan UI/UX.  
\- \*\*Visi\*\*: Menjadi ruang komunikasi privat, tenang, dan bermakna bagi Gen Z & Gen Alpha, terinspirasi dari suasana "Warung Kopi" — tempat nongkrong santai tanpa tekanan media sosial.  
\- \*\*Tech Stack Eksisting\*\*: React (Web), Node.js \+ Express, Socket.IO, PostgreSQL, Prisma ORM.  
\- \*\*Integrasi\*\*: BMC Token (Bamboochain), AI Chatbot (NgopiCS), Alih Bahasa Live.

\*\*Peran AI Agent\*\*: Anda adalah \*\*Senior Full-Stack Developer \+ UX Engineer \+ Security Engineer\*\*. Tugas Anda adalah melakukan review teknis, memperbaiki bug kritis, dan mengimplementasikan fitur-fitur baru sesuai prioritas (Sprint 1–3).

\*\*Aturan Kerja\*\*:  
\- Kerjakan \*\*secara berurutan\*\* sesuai Sprint.  
\- Setiap fitur wajib memiliki \*\*unit test (Jest)\*\* dan \*\*logging\*\*.  
\- Semua data sensitif (pesan, bio) tetap dienkripsi (AES-256-GCM).  
\- Update \`README.md\` untuk setiap fitur baru.

\---

\# BAGIAN 1: REVIEW & EVALUASI (Audit Awal)

Lakukan audit terhadap kode dan UI eksisting, lalu perbaiki masalah berikut:

\#\# 1.1 Bug Kritis (WAJIB DIPERBAIKI SEGERA)

\#\#\# BUG-01: "Pesan tidak bisa didekripsi" (E2EE Key Exchange Gagal)  
\*\*Gejala\*\*: Muncul pesan error \`\*(Pesan tidak bisa didekripsi)\*\` pada chat.  
\*\*Penyebab\*\*: Kemungkinan besar pertukaran kunci publik (X25519) gagal, atau kunci privat klien hilang setelah refresh.  
\*\*Tindakan\*\*:  
\- Audit alur pertukaran kunci di \`src/services/encryption.service.ts\` (frontend) dan backend.  
\- Pastikan kunci privat disimpan di \*\*IndexedDB\*\* (bukan localStorage) agar persisten.  
\- Tambahkan mekanisme \*\*"Muat Ulang Kunci"\*\*:  
  \- Endpoint \`POST /api/keys/renegotiate\` untuk memicu ulang pertukaran kunci.  
  \- Tombol di UI chat jika dekripsi gagal: "🔄 Muat Ulang Kunci".  
\- Fallback: Jika dekripsi gagal, tampilkan banner: \*"Kunci enkripsi perlu diperbarui. Klik di sini."\*

\#\#\# BUG-02: Prompt "Save sign-in information?" Muncul Terus  
\*\*Gejala\*\*: Browser menawarkan menyimpan password setiap login.  
\*\*Tindakan\*\*: Tambahkan atribut \`autocomplete="off"\` pada form password, atau gunakan \`autocomplete="new-password"\` saat registrasi.

\#\#\# BUG-03: Ikon & Label yang Ambigu  
\*\*Gejala\*\*: Ada ikon yang tidak jelas fungsinya (misal ikon "D" di header).  
\*\*Tindakan\*\*: Audit semua ikon, tambahkan \*\*tooltip\*\* atau label teks saat hover/first-use. Ganti ikon yang tidak intuitif dengan ikon standar (Heroicons / Lucide).

\---

\#\# 1.2 Perbaikan UX (User Experience)

\#\#\# UX-01: Halaman Kosong yang Informatif  
\*\*Masalah\*\*: Halaman "Pesan", "Kontak", "Profil" sering kosong.  
\*\*Tindakan\*\*: Buat \*\*empty state\*\* yang ramah:  
\- Ilustrasi minimalis \+ pesan hangat (misal: \*"Belum ada obrolan. Yuk, mulai ngobrol dengan temanmu di Warung Kopi\!"\*).  
\- Tombol CTA: "Cari Teman" atau "Masuk Warung Kopi".

\#\#\# UX-02: Konsistensi Format Tanggal & Waktu  
\*\*Masalah\*\*: Format tanggal tidak konsisten (\`06.22\` vs \`06:22\`).  
\*\*Tindakan\*\*: Standarisasi:  
\- Hari ini → \`06:22\`  
\- Kemarin → \`Kemarin, 06:22\`  
\- Lebih dari 2 hari → \`29 Sep, 06:22\`

\#\#\# UX-03: Status Pesan (Read Receipt)  
\*\*Masalah\*\*: Status pesan tidak terlihat jelas.  
\*\*Tindakan\*\*: Tampilkan ikon centang (✓) untuk "sent", (✓✓) untuk "delivered", dan (✓✓ berwarna) untuk "read".

\#\#\# UX-04: Onboarding untuk Pengguna Baru  
\*\*Masalah\*\*: Setelah registrasi, pengguna langsung masuk tanpa panduan.  
\*\*Tindakan\*\*: Buat \*\*3-langkah onboarding modal\*\*:  
1\. "Selamat datang di Ngopi\! Di sini, obrolanmu aman dan tanpa nomor HP."  
2\. "Ini Warung Kopi — tempat nongkrong bareng komunitas."  
3\. "Cari teman atau buat Warung sendiri untuk ngobrol privat."  
Tambahkan tombol \*\*Skip\*\* dan \*\*Next\*\*.

\#\#\# UX-05: Feedback Visual pada Aksi  
\*\*Masalah\*\*: Tidak ada feedback saat kirim pesan, unggah file, atau saat loading.  
\*\*Tindakan\*\*:  
\- Tampilkan \*\*spinner\*\* saat mengirim file.  
\- Tampilkan \*\*progress bar\*\* saat mengunggah file besar.  
\- Animasi \*\*"pesan terkirim"\*\* (slide-up) untuk feedback cepat.

\---

\#\# 1.3 Halaman Legal & Keamanan

\#\#\# SEC-01: Halaman Kebijakan Privasi & Syarat Ketentuan  
\*\*Tindakan\*\*: Buat halaman statis:  
\- \`/privacy\` → Kebijakan Privasi (jelaskan E2EE, data tidak dijual, dll.)  
\- \`/terms\` → Syarat & Ketentuan  
\- Tautkan di footer dan menu profil.

\#\#\# SEC-02: HTTPS & WSS Wajib  
\*\*Tindakan\*\*: Pastikan semua koneksi (termasuk WebSocket) menggunakan HTTPS/WSS. Tambahkan HSTS header via NGINX.

\---

\# BAGIAN 2: PENGEMBANGAN FITUR BARU

Kerjakan fitur-fitur berikut sesuai Sprint. Setiap fitur mencakup \*\*Frontend, Backend, Database, dan Testing\*\*.

\---

\#\# SPRINT 1: SUASANA WARKOP (Quick Win)

\#\#\# FITUR-01: Jukebox Warung 🎶  
\*\*Deskripsi\*\*: Setiap "Warung" (Rumpun) memiliki \*\*playlist bersama\*\*. Semua anggota mendengarkan lagu yang sama secara sinkron.

\*\*Spesifikasi Teknis\*\*:  
\- \*\*Database\*\*:  
  \`\`\`prisma  
  model JukeboxTrack {  
    id          String   @id @default(cuid())  
    warung\_id   String   @map("warung\_id")  
    track\_uri   String   // Spotify URI atau YouTube Video ID  
    title       String  
    artist      String  
    thumbnail   String?  
    duration    Int      // detik  
    added\_by    String   @map("added\_by")  
    position    Int      // urutan di queue  
    is\_playing  Boolean  @default(false)  
    started\_at  DateTime?  
    created\_at  DateTime @default(now())  
  }

  model JukeboxVote {  
    id         String @id @default(cuid())  
    track\_id   String @map("track\_id")  
    user\_id    String @map("user\_id")  
    vote\_type  String // "skip" atau "like"  
    created\_at DateTime @default(now())  
  }  
\`\`\`

· Backend:  
  · Endpoint POST /api/jukebox/:warungId/queue → tambah lagu ke antrian (dari search Spotify/YouTube).  
  · Endpoint GET /api/jukebox/:warungId/now-playing → lagu yang sedang diputar.  
  · Endpoint POST /api/jukebox/:warungId/vote → vote skip/like.  
  · Socket.IO events:  
    · jukebox:track\_changed → broadcast ke semua anggota Warung saat lagu berganti.  
    · jukebox:sync → sinkronisasi posisi playback (setiap 5 detik).  
  · Aturan skip: Jika \>50% anggota vote skip, lagu otomatis dilewati.  
  · Integrasi: Gunakan Spotify Web Playback SDK atau YouTube IFrame API.  
· Frontend:  
  · Komponen JukeboxWidget.tsx → floating widget di Warung, menampilkan lagu yang diputar \+ progress bar.  
  · Tombol: Request Lagu, Vote Skip, Like, Lihat Antrian.  
  · Playlist modal: daftar lagu yang akan datang \+ siapa yang menambahkan.  
· Testing: Simulasi 5 user menambahkan lagu, verifikasi urutan dan sinkronisasi.

\---

FITUR-02: Ambient Sound 🔊

Deskripsi: Suara latar untuk menambah suasana Warung. Bisa diaktifkan per-user (hanya didengar sendiri).

Spesifikasi:

· Pilihan suara: Hujan, Kafe Ramai, Ombak, Hutan, Jangkrik Malam, Pasar Tradisional, Api Unggun.  
· Backend: Endpoint GET /api/ambient/list → daftar suara yang tersedia.  
· Frontend:  
  · Komponen AmbientPlayer.tsx → mini player di pojok Warung.  
  · Kontrol: play/pause, volume, pilih suara.  
  · Simpan preferensi di localStorage.  
· Aset: Gunakan file audio royalty-free (freesound.org atau Pixabay).

\---

FITUR-03: "Kopi" sebagai Reaksi ☕

Deskripsi: Tambahkan reaksi khas Ngopi pada pesan.

Spesifikasi:

· Daftar Reaksi Baru: ☕ (kopi), 🍵 (teh), 🚬 (kretek), 🎵 (lagu), 🍜 (mie), 🌙 (malam).  
· Backend: Tabel Reaction yang sudah ada, tinggal tambah emoji baru.  
· Frontend: Emoji picker dengan tab khusus "Warkop Reactions".

\---

FITUR-04: Mode "Ngobrol Malam" 🌙

Deskripsi: Tema gelap dengan lampu temaram, aktif otomatis setelah jam 21.00.

Spesifikasi:

· Frontend:  
  · Tema CSS baru: theme-night-warkop.  
  · Background: gradient gelap dengan vignette.  
  · Aksen: Warm amber (oranye temaram).  
  · Notifikasi: Suara lebih lembut (chime, bukan bell).  
· Backend: Tidak ada perubahan (cukup di frontend).  
· Pengaturan: Toggle di Profil → "Mode Ngobrol Malam: Auto / Manual / Off".

\---

SPRINT 2: SLOW & MEANINGFUL (Anti-Kejenuhan)

FITUR-05: Surat Kopi ✉️

Deskripsi: Pesan yang sengaja dikirim dengan jeda waktu (1 jam, 1 hari) atau saat penerima online.

Spesifikasi:

· Database:  
  \`\`\`prisma  
  model CoffeeLetter {  
    id             String   @id @default(cuid())  
    sender\_id      String   @map("sender\_id")  
    recipient\_id   String   @map("recipient\_id")  
    content        String   // Terenkripsi  
    scheduled\_at   DateTime @map("scheduled\_at")  
    delivery\_mode  String   // "scheduled", "when\_online"  
    delivered\_at   DateTime?  
    is\_opened      Boolean  @default(false)  
    created\_at     DateTime @default(now())  
  }  
  \`\`\`  
· Backend:  
  · Endpoint POST /api/letters → buat Surat Kopi baru.  
  · Cron job: setiap 5 menit, cek surat yang siap dikirim.  
  · Jika delivery\_mode \= "when\_online", kirim saat penerima terdeteksi online (via Socket.IO presence).  
· Frontend:  
  · Komponen CoffeeLetterComposer.tsx → UI seperti menulis surat (font serif, kertas vintage).  
  · Animasi: amplop tertutup, dibuka dengan efek slide.  
  · Notifikasi: "Kamu menerima Surat Kopi\! Buka sekarang?"

\---

FITUR-06: Mode Sepi 🌿

Deskripsi: Nonaktifkan notifikasi dari Warung tertentu tanpa keluar.

Spesifikasi:

· Database:  
  \`\`\`prisma  
  model WarungMute {  
    id         String   @id @default(cuid())  
    user\_id    String   @map("user\_id")  
    warung\_id  String   @map("warung\_id")  
    muted\_until DateTime? // Null \= selamanya  
    created\_at DateTime @default(now())  
  }  
  \`\`\`  
· Backend: Endpoint POST /api/warungs/:id/mute, DELETE /api/warungs/:id/mute.  
· Frontend: Toggle di pengaturan Warung. Status muncul "sedang menikmati kopi" (AFK).

\---

FITUR-07: Buku Tamu Warkop 📖

Deskripsi: Setiap Warung punya "buku tamu" berisi kesan-pesan dari anggota.

Spesifikasi:

· Database:  
  \`\`\`prisma  
  model GuestbookEntry {  
    id         String   @id @default(cuid())  
    warung\_id  String   @map("warung\_id")  
    user\_id    String   @map("user\_id")  
    content    String   // Terenkripsi  
    entry\_type String   // "quote", "puisi", "gambar"  
    created\_at DateTime @default(now())  
  }  
  \`\`\`  
· Backend: Endpoint CRUD /api/warungs/:id/guestbook.  
· Frontend: Halaman khusus "Buku Tamu" dengan tampilan seperti buku terbuka.

\---

FITUR-08: Jadwal Ngopi 🗓️

Deskripsi: Jadwalkan voice/video call komunitas dengan reminder otomatis.

Spesifikasi:

· Database:  
  \`\`\`prisma  
  model NgopiSchedule {  
    id          String   @id @default(cuid())  
    warung\_id   String   @map("warung\_id")  
    title       String  
    description String?  
    scheduled\_at DateTime @map("scheduled\_at")  
    call\_type   String   // "voice", "video"  
    created\_by  String   @map("created\_by")  
    is\_active   Boolean  @default(true)  
  }  
  \`\`\`  
· Backend: Endpoint CRUD /api/warungs/:id/schedules.  
· Cron: Kirim reminder 15 menit & 5 menit sebelum acara.  
· Frontend: Kalender mini di Warung \+ tombol "Ingatkan Saya".

\---

SPRINT 3: GAMIFIKASI & PERSONALISASI

FITUR-09: Streak Ngopi 🎯

Deskripsi: Streak untuk dua orang yang rutin ngobrol setiap hari.

Spesifikasi:

· Database:  
  \`\`\`prisma  
  model ChatStreak {  
    id            String   @id @default(cuid())  
    user\_a\_id     String   @map("user\_a\_id")  
    user\_b\_id     String   @map("user\_b\_id")  
    current\_streak Int     @default(0)  
    longest\_streak Int     @default(0)  
    last\_chat\_at  DateTime @map("last\_chat\_at")  
  }  
  \`\`\`  
· Backend:  
  · Cron harian: reset streak jika tidak ada chat dalam 24 jam.  
  · Update streak otomatis saat pesan dikirim.  
· Frontend:  
  · Tampilkan ikon api kecil (🔥) di header chat.  
  · Notifikasi: "Streak kalian sudah 30 hari\! Jangan putus ya ☕".

\---

FITUR-10: Lencana "Pengunjung Setia" 🏆

Deskripsi: Lencana untuk anggota yang sering hadir di Warung tertentu.

Spesifikasi:

· Kriteria:  
  · "Warga Tetap" → 30 hari berturut hadir.  
  · "Sultan Kopi" → Paling banyak traktir BMC.  
  · "Penjaga Warkop" → Paling banyak jawab pertanyaan.  
· Database: Tabel Badge dan UserBadge.  
· Frontend: Tampilkan lencana di profil dengan tooltip penjelasan.

\---

FITUR-11: Kartu "Tebak-tebakan Warkop" 🃏

Deskripsi: Mini-game di dalam Warung: kartu tebak-tebakan, trivia, atau kartu curhat.

Spesifikasi:

· Backend: Endpoint GET /api/games/cards?type=trivia → dapatkan kartu acak.  
· Frontend:  
  · Modal GameCard.tsx → tampilkan kartu dengan animasi flip.  
  · Tombol "Tarik Kartu Baru", "Bagikan ke Warung".  
· Kategori Kartu:  
  · "Curhat" → pertanyaan pemancing obrolan mendalam.  
  · "Trivia" → pertanyaan pengetahuan umum.  
  · "Tebak-tebakan" → lelucon ringan.

\---

FITUR-12: Meja Warkop 🖼️

Deskripsi: Setiap pengguna punya "meja" pribadi yang bisa dihias.

Spesifikasi:

· Database:  
  \`\`\`prisma  
  model ProfileTable {  
    id         String   @id @default(cuid())  
    user\_id    String   @unique  
    background String?  // URL gambar atau gradient  
    stickers   Json?    // Array of sticker objects  
    quote      String?  
    favorite\_track String? // URI lagu favorit  
    updated\_at DateTime @updatedAt  
  }  
  \`\`\`  
· Frontend:  
  · Halaman /meja/:username → tampilkan meja pengguna.  
  · Editor: drag & drop stiker, pilih background, tulis quote.

\---

FITUR-13: Tema Warung 🌈

Deskripsi: Admin Warung bisa memilih tema visual.

Spesifikasi:

· Pilihan Tema: Warkop Klasik (cokelat tua), Kafe Modern (minimalis), Kedai Malam (neon), Warung Desa (hijau).  
· Database: Field theme di tabel Warung.  
· Frontend: CSS variables per tema, mudah diganti.

\---

SPRINT 4: INTEGRASI BMC & NGOPI LIVE

FITUR-14: Traktir Kopi ☕ (BMC)

Deskripsi: Kirim BMC sebagai "traktiran" ke anggota Warung.

Spesifikasi:

· Backend: Endpoint POST /api/bmc/treat → kirim BMC ke semua anggota Warung.  
· Integrasi: Ethers.js untuk transfer BMC di Bamboochain.  
· Frontend:  
  · Tombol "Traktir Kopi" di Warung.  
  · Notifikasi publik: "X mentraktir kopi untuk semua\! ☕"  
  · Animasi: hujan emoji kopi.

\---

FITUR-15: Ngopi Live 🎵 (Fitur Unggulan)

Deskripsi: Semua anggota Warung mendengarkan lagu yang sama sambil voice call. Seperti duduk di warkop yang sama, mendengarkan radio bersama.

Spesifikasi:

· Kombinasi: Jukebox Warung \+ Voice Call.  
· Sinkronisasi: Posisi playback disinkronkan via Socket.IO.  
· Backend:  
  · Event ngopi\_live:start → host mulai sesi.  
  · Event ngopi\_live:sync → broadcast posisi lagu setiap 3 detik.  
  · Event ngopi\_live:end → akhiri sesi.  
· Frontend:  
  · UI khusus: tampilan lagu besar \+ daftar peserta voice call.  
  · Kontrol: Play/Pause (host only), Volume (per-user), Leave.  
· Testing: Simulasi 10 user di sesi Ngopi Live, verifikasi sinkronisasi audio.

\---

BAGIAN 3: STRUKTUR DATABASE (Tambahan)

Tambahkan model-model berikut ke schema.prisma:

· JukeboxTrack, JukeboxVote  
· CoffeeLetter  
· WarungMute  
· GuestbookEntry  
· NgopiSchedule  
· ChatStreak  
· Badge, UserBadge  
· ProfileTable  
· Update Warung dengan field theme, ambient\_sound

\---

BAGIAN 4: PRIORITAS EKSEKUSI

Sprint Fitur Estimasi  
0 (Audit) Perbaiki BUG-01 (E2EE), BUG-02, BUG-03, UX-01 s/d UX-05 1 minggu  
1 Jukebox Warung, Ambient Sound, Kopi Reaksi, Mode Ngobrol Malam 3 minggu  
2 Surat Kopi, Mode Sepi, Buku Tamu, Jadwal Ngopi 3 minggu  
3 Streak Ngopi, Lencana, Kartu Tebak-tebakan, Meja Warkop, Tema Warung 4 minggu  
4 Traktir Kopi (BMC), Ngopi Live 3 minggu

\---

BAGIAN 5: ATURAN UNTUK AI AGENT

1\. Mulai dari Sprint 0 — audit dan perbaiki bug terlebih dahulu sebelum menambah fitur.  
2\. Setiap fitur wajib memiliki unit test dan integration test.  
3\. Semua pesan & data sensitif WAJIB dienkripsi dengan AES-256-GCM.  
4\. Update README.md dan CHANGELOG.md untuk setiap sprint.  
5\. Gunakan feature flag (misal FEATURE\_JUKEBOX=true) untuk memudahkan rollback.  
6\. Jika ada keputusan arsitektur ambigu, pilih yang paling simpel dan mudah di-maintain.  
7\. Tampilkan console log yang jelas untuk debugging selama development.

\---

BAGIAN 6: PERINTAH EKSEKUSI

"Mulai dari BAGIAN 1 (Audit & Review). Perbaiki semua bug kritis (BUG-01, BUG-02, BUG-03) dan terapkan perbaikan UX (UX-01 s/d UX-05). Setelah itu, lanjutkan ke SPRINT 1: implementasikan Jukebox Warung, Ambient Sound, Reaksi Kopi, dan Mode Ngobrol Malam. Sertakan kode lengkap, skema database, endpoint API, dan komponen frontend. Beri saya laporan setelah setiap sprint selesai."

\---

Selamat membangun Ngopi — semoga menjadi ruang ngobrol paling intim untuk generasi baru\! ☕🌿

\`\`\`

\---

\#\#\# 🚀 Cara Menggunakan Prompt Ini

1\. \*\*Simpan\*\* file di atas sebagai \`PROMPT\_NGOPI\_MASTER.md\` di root project.  
2\. Buka \*\*Cursor / Windsurf / Codex\*\*, \*attach\* file ini ke komposer.  
3\. Berikan perintah:    
   \> \*"Jalankan Sprint 0 terlebih dahulu. Setelah selesai, lanjutkan ke Sprint 1."\*  
4\. Setelah setiap sprint selesai, minta AI untuk:  
   \> \*"Buat laporan singkat: apa yang sudah dikerjakan, apa yang perlu di-test manual, dan apa risiko yang perlu diperhatikan."\*

Prompt ini sudah sangat lengkap: mencakup \*\*review, evaluasi, perbaikan teknis, pengembangan fitur, database schema, prioritas sprint, dan aturan kerja\*\*. Dengan ini, Ngopi siap menjadi aplikasi obrolan yang tidak hanya fungsional, tetapi juga \*\*punya jiwa\*\* — seperti warkop sungguhan tempat orang datang untuk ngobrol, mendengarkan musik, dan merasa diterima. ☕🎶