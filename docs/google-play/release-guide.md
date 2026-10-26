# Panduan Lengkap Rilis Google Play Store — Ngopi 🚀

Panduan langkah demi langkah untuk mempublikasikan aplikasi **Ngopi** ke Google Play Store menggunakan **Expo EAS Build** dan **Google Play Console**.

---

## Ringkasan Konfigurasi Teknis Aplikasi
- **Package Name (Application ID):** `top.ngopi.app`
- **Versi Aplikasi (Version):** `1.0.0`
- **Version Code:** `1`
- **Format Berkas:** Android App Bundle (`.aab`)
- **Kebijakan Privasi URL:** `https://ngopi.top/privacy`
- **Mekanisme Hapus Akun:** `https://ngopi.top/privacy` atau di dalam menu aplikasi

---

## Langkah 1: Persiapan Akun & EAS CLI

### 1.1 Login ke Akun Expo / EAS
Buka terminal di folder `frontend/` dan jalankan:
```bash
cd frontend
npx eas-cli login
```
*Jika belum memiliki akun Expo, daftar gratis di [expo.dev](https://expo.dev).*

### 1.2 Inisialisasi Proyek EAS (Hanya pertama kali)
```bash
npx eas-cli project:init
```
Perintah ini akan menautkan aplikasi dengan akun Expo Anda dan memperbarui konfigurasi `projectId` secara otomatis.

---

## Langkah 2: Build Android App Bundle (`.aab`)

Google Play Store mewajibkan berkas format **Android App Bundle (.aab)** untuk aplikasi baru (bukan .apk).

Jalankan perintah build produksi cloud di Expo EAS:
```bash
npx eas-cli build --platform android --profile production
```

> **Tips Keystore Android:**
> Saat pertama kali menjalankan build ini, EAS CLI akan bertanya:
> `Generate a new Android Keystore?` -> Pilih **Yes (Generate a new keystore)**.
> EAS akan mengelola kunci penandatanganan aplikasi secara aman di cloud Expo (EAS Credentials).

Setelah proses build selesai (biasanya 5–10 menit), terminal akan menampilkan tautan untuk mengunduh berkas `.aab` (contoh: `application-production.aab`). Unduh berkas ini ke komputer Anda.

*(Opsional: Jika ingin mencoba instalasi langsung di ponsel fisik sebelum rilis, Anda bisa membuat APK menggunakan profil preview: `npx eas-cli build --platform android --profile preview`)*

---

## Langkah 3: Setup di Google Play Console

1. Masuk ke [Google Play Console](https://play.google.com/console).
2. Klik tombol **Buat Aplikasi (Create App)** di pojok kanan atas.
3. Isi informasi dasar:
   - **Nama Aplikasi:** `Ngopi - Ngobrol Paling Intim`
   - **Bahasa Default:** `Indonesia (id)`
   - **Aplikasi atau Game:** `Aplikasi`
   - **Gratis atau Berbayar:** `Gratis`
   - Centang persetujuan Deklarasi Kebijakan Pengembang & Hukum Ekspor AS.
   - Klik **Buat Aplikasi**.

---

## Langkah 4: Pengisian Konten Aplikasi (App Content)

Di menu bilah samping kiri Play Console, buka bagian **Kebijakan > Konten Aplikasi (App content)**:

1. **Kebijakan Privasi (Privacy Policy):**
   - Masukkan URL: `https://ngopi.top/privacy`
2. **Akses Aplikasi (App Access):**
   - Pilih: *Semua atau beberapa fungsi dibatasi* (karena membutuhkan akun masuk).
   - Tambahkan instruksi akun pengujian untuk tim peninjau Google Play:
     - Nama Akun: `demo_reviewer`
     - Kata Sandi: `WarkopNgopi2026!`
     - *(Pastikan akun demo ini terdaftar aktif di server database)*
3. **Iklan (Ads):**
   - Pilih: *Tidak, aplikasi saya tidak berisi iklan*.
4. **Rating Konten (Content Rating - IARC):**
   - Masukkan email pengembang (`dpo@ngopi.top` atau email Google Play Anda).
   - Pilih kategori: *Utilitas, Produktivitas, Komunikasi, atau Lainnya*.
   - Jawab kuisioner (Ngopi tidak memuat kekerasan fisik berdarah, diskriminasi, dsb.).
   - Rating yang dihasilkan umumnya adalah **Remaja (Teen 13+)** karena adanya fitur interaksi pengguna / chat daring.
5. **Sasaran Audiens (Target Audience):**
   - Centang usia: **13-15 tahun, 16-17 tahun, dan 18 tahun ke atas**.
   - Apakah aplikasi menarik bagi anak-anak? Pilih: *Tidak*.
6. **Aplikasi Berita (News Apps):**
   - Pilih: *Tidak*.
7. **Pelacakan Kontak & Status COVID-19:**
   - Pilih: *Bukan aplikasi pelacakan COVID-19*.
8. **Keamanan Data (Data Safety):**
   - Buka panduan lengkap di file `docs/google-play/data-safety.md`. Salin setiap jawaban ke formulir.
9. **Fitur Keuangan (Financial Features):**
   - Pilih: *Aplikasi tidak menyediakan layanan keuangan atau perbankan konvensional*.

---

## Langkah 5: Unggah Aset Listing Toko (Main Store Listing)

Buka menu **Kembangkan > Listing Toko Utama (Main Store Listing)**:

1. **Teks Listing Toko:**
   - Salin Judul, Deskripsi Singkat, dan Deskripsi Lengkap dari:
     `docs/google-play/store-listing.md`
2. **Aset Grafis (Tersedia di `docs/google-play/store-assets/`):**
   - **Ikon Aplikasi:** Unggah `docs/google-play/store-assets/app-icon-512x512.png` (512x512 px)
   - **Grafis Fitur:** Unggah `docs/google-play/store-assets/feature-graphic-1024x500.png` (1024x500 px)
   - **Tangkapan Layar Ponsel:** Unggah tangkapan layar dari folder `docs/google-play/store-assets/screenshots/` (minimal 2, disarankan 4–8 gambar).

---

## Langkah 6: Mengunggah Berkas .AAB & Mengirimkan Tinjauan

### Alur Peluncuran yang Direkomendasikan:
1. **Jalur Pengujian Internal (Internal Testing Track):**
   - Masuk ke **Pengujian > Pengujian Internal**.
   - Klik **Buat Rilis Baru (Create new release)**.
   - Unggah file `.aab` yang telah diunduh dari Langkah 2.
   - Masukkan Catatan Rilis (Release Notes):
     ```text
     Rilis perdana aplikasi Ngopi v1.0.0. Fitur obrolan privat E2EE, Jukebox Warung, dan game meja warkop.
     ```
   - Klik **Simpan** dan **Luncurkan ke Pengujian Internal**.
   - Tambahkan email Anda sendiri ke daftar penguji untuk mengunduh dan memverifikasi aplikasi langsung via Google Play Store link pribadi.

2. **Jalur Pengujian Tertutup (Closed Testing):**
   - *Catatan Penting Akun Pengembang Personal Baru:* Akun perorangan Google Play yang dibuat setelah November 2023 mewajibkan minimal **20 penguji opt-in selama minimal 14 hari berturut-turut** sebelum dapat mempublikasikan ke Produksi.
   - Jika akun Anda adalah akun perusahaan (Organisasi), persyaratan 20 penguji ini tidak berlaku.

3. **Rilis Produksi (Production):**
   - Setelah pengujian berhasil, promosikan rilis ke **Produksi (Production)**.
   - Klik **Tinjau Rilis** dan **Kirimkan untuk Peninjauan (Submit for review)**.
   - Peninjauan pertama Google biasanya memakan waktu 24 hingga 72 jam kerja.
