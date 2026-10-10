# CHANGELOG — Ngopi (v2.0)

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
