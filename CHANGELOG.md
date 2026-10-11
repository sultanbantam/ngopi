# CHANGELOG — Ngopi (v3.0)

## [Ngopi v3.0 - Sprint 1 & Sprint 2] - 2026-10-11

### Permainan & Ekosistem Digital (ngopiv3.md)
- **Sprint 1: Permainan UNO**:
  - Implementasi deck resmi 108 kartu (`UnoDeck.ts`), aturan pencocokan (`UnoRules.ts`), dan engine permainan server-authoritative (`UnoGame.ts`).
  - Mekanisme shout UNO! dan catch UNO! untuk pemain yang lupa teriak saat memegang 1 kartu.
  - Keamanan anti-cheat: Kartu tangan pemain lawan disamarkan oleh server dan hanya dikirim jumlahnya.
  - Bot AI otonom untuk permainan kartu UNO.
  - 32 Unit Test lulus 100%.
  - UI Frontend kartu UNO berwarna, action bar, dan modal pemilih warna Wild Card.
- **Sprint 2: Permainan Ular Tangga**:
  - Implementasi papan 100 kotak (`SnakeLadderBoard.ts`) dengan 10 tangga resmi dan 10 ular resmi sesuai spesifikasi `ngopiv3.md`.
  - Engine permainan server-authoritative (`SnakeLadderGame.ts`), dadu acak 1-6 anti-cheat, aturan mantul (bounce back) jika berlebih dari kotak 100, dan bonus roll saat dadu 6.
  - 15 Unit Test lulus 100%.
  - Tampilan papan grid 10x10 serpentine, indikator tangga 🪜 & ular 🐍, pion pemain, dan tombol lempar dadu interaktif.
- **Fitur Klasemen (Leaderboard 4 Kategori)**:
  - Endpoint `GET /api/leaderboard` dan tracking aktivitas warkop.
  - Komponen `LeaderboardModal.tsx` dengan podium medali 🥇🥈🥉 (Peraih Poin Terbanyak, Musik Terpopuler, Radio Terbanyak Dipilih, dan Game Terfavorit).
- **Peningkatan Game Catur (Cantur)**:
  - Pilihan warna bidak (Putih, Hitam, Acak) saat pembuatan meja dan tombol Balik Papan (Flip Perspective).
  - 3 Tingkat kesulitan Bot AI (Pemula, Menengah, Master dengan Minimax 2-ply + Alpha-Beta Pruning + Positional Piece-Square Tables).
  - Poin kemenangan adaptif (+15 Pemula, +35 Menengah, +60 Master, +50 Manusia).
- **Perbaikan Autentikasi & Meja Permainan**:
  - Pelonggaran skema regex login dan pencarian case-insensitive username serta fallback display name.
  - Perbaikan status meja selesai dan fitur ambil alih kursi bot ("Gabung (Ganti Bot 🤖)") di lobi game.

## [Sprint 0 & Sprint 1] - 2026-10-10

### Bagian 1: Audit & Review (Sprint 0)
- **BUG-01 (E2EE Key Renegotiation)**:
  - Membuat endpoint `POST /api/keys/renegotiate` dan `GET /api/keys/:userId` untuk menyinkronkan kunci publik antar pasangan chat.
  - Menambahkan banner peringatan *"⚠️ Kunci enkripsi perlu diperbarui"* dan tombol inline *"🔄 Muat Ulang Kunci"* pada bubble chat jika pesan gagal didekripsi.
  - Menambahkan event socket `keys:updated` dan `keys:renegotiate` agar chat partner dapat langsung membaca pesan terenkripsi tanpa perlu refresh browser.
- **BUG-02 (Password Auto-save Prompt)**:
  - Menambahkan atribut `autoComplete="off"` dan `textContentType="none"` pada form login.
  - Menambahkan atribut `autoComplete="new-password"` pada form registrasi.
- **BUG-03 (Audit Ikon & Aksesibilitas)**:
  - Menstandarisasi ikon dengan label aksesibilitas (`accessibilityLabel` dan `title`) pada panggilan suara, video, pencarian, dan lampiran berkas.
- **UX-01 (Empty States)**:
  - Membuat komponen reusable `EmptyState.tsx` dengan ilustrasi hangat kopi dan tombol CTA sapaan.
  - Mengintegrasikannya pada ruang obrolan, daftar warkop, dan tab kontak.
- **UX-02 (Format Tanggal & Waktu)**:
  - Membuat utility `dateFormat.ts`: Hari ini (`06:22`), Kemarin (`Kemarin, 06:22`), dan older (`29 Sep, 06:22`).
- **UX-03 (Status Pesan / Read Receipt)**:
  - Menampilkan centang `✓` (terkirim) dan `✓✓` berwarna aksen kopi (terbaca).
- **UX-04 (Onboarding Pengguna Baru)**:
  - Membuat komponen `OnboardingModal.tsx` dengan 3 langkah pengenalan ruang privat, warkop, dan navigasi aplikasi.
- **SEC-01 (Halaman Legal)**:
  - Memperbarui `/privacy` (Kebijakan Privasi E2EE murni tanpa nomor HP) dan `/terms` (Syarat & Ketentuan warkop).
  - Menautkan halaman legal di footer login, registrasi, dan menu drawer.
- **SEC-02 (HTTPS & WSS CSP)**:
  - Memperbarui Helmet CSP dan security CORS middleware backend untuk mengizinkan `ngopi.top`, `api.ngopi.top`, dan `wss://api.ngopi.top`.

### Bagian 2: Suasana Warkop (Sprint 1)
- **FITUR-01 (Jukebox Warung 🎶)**:
  - Menambahkan model `JukeboxTrack` dan `JukeboxVote` di Prisma schema.
  - Membuat endpoint `GET /api/jukebox/:warungId/now-playing`, `POST /api/jukebox/:warungId/queue`, dan `POST /api/jukebox/:warungId/vote`.
  - Mengimplementasikan widget floating `JukeboxWidget.tsx` dengan kontrol putar, progress bar, request lagu, like, dan vote skip (>3 suara skip otomatis berganti lagu).
- **FITUR-02 (Ambient Sound 🔊)**:
  - Membuat endpoint `GET /api/ambient/list` dengan suara Hujan Rintik, Kafe Ramai, Ombak, Hutan Senja, Jangkrik Malam, dan Api Unggun.
  - Membuat komponen mini player `AmbientPlayer.tsx` dengan pemutar audio loop, selektor suasana, dan volume slider yang tersimpan di `localStorage`.
- **FITUR-03 (Reaksi Khas Warkop ☕)**:
  - Menambahkan reaksi ☕ (kopi), 🍵 (teh), 🚬 (kretek), 🎵 (lagu), 🍜 (mie), dan 🌙 (malam) ke emoji picker di chat room dan toolbar warkop.
- **FITUR-04 (Mode Ngobrol Malam 🌙)**:
  - Membuat hook `useNightMode` dengan pengaturan `auto` (aktif otomatis 21:00-05:00), `on`, dan `off`.
  - Menambahkan tombol pengubah tema malam di menu pengaturan akun.
