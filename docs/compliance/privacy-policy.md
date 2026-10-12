# Kebijakan Privasi (Privacy Policy) — Ngopi
**Versi Dokumen:** v3.0-2026  
**Tanggal Berlaku:** 12 Oktober 2026  
**Pengendali Data:** PT Ngopi Kreasi Digital  
**Kontak Pejabat Perlindungan Data (DPO):** dpo@ngopi.top  

---

## 1. Pendahuluan & Komitmen Privasi
Aplikasi **Ngopi** ("ngobrol paling intim", https://ngopi.top) berkomitmen penuh untuk melindungi hak privasi dan kerahasiaan data pribadi seluruh pengguna sesuai dengan ketentuan **Undang-Undang Republik Indonesia Nomor 27 Tahun 2022 tentang Perlindungan Data Pribadi (UU PDP)** serta **Peraturan Pemerintah Nomor 71 Tahun 2019 tentang Penyelenggaraan Sistem dan Transaksi Elektronik (PP PSTE)**.

## 2. Prinsip Pemrosesan Data Pribadi
Ngopi memproses data pribadi berdasarkan prinsip:
1. **Persetujuan Eksplisit (Consent)**: Pemrosesan dilakukan setelah pengguna memberikan persetujuan yang sah.
2. **Keterbatasan Tujuan**: Data hanya digunakan untuk penyediaan fitur komunikasi, permainan, musik warkop, dan ekosistem token BMC.
3. **Minimisasi Data**: Kami tidak mewajibkan nomor telepon seluler untuk pendaftaran.
4. **Keamanan Mutlak (E2EE)**: Pesan obrolan antar pengguna dienkripsi dari ujung ke ujung menggunakan kriptografi X25519 dan AES-256-GCM. Pihak Ngopi tidak dapat membaca pesan Anda.

## 3. Data Pribadi yang Kami Kumpulkan
1. **Data Identitas Akun**: Nama tampilan (*display name*), *username*, dan kata sandi yang di-hash (Argon2 / bcrypt).
2. **Data Aktivitas Warkop**: Riwayat partisipasi meja game, perolehan Poin Ngopi, dan status streak harian.
3. **Data Teknis & Jaringan**: Alamat IP sesi, *user agent*, dan kunci publik enkripsi X25519 perangkat.
4. **Data Jaringan Offline Mesh**: ID peer sementara dan catatan waktu terdeteksi untuk perutean paket offline Bluetooth LE.

## 4. Hak-Hak Subjek Data (Sesuai UU PDP)
Sebagai subjek data, Anda memiliki hak penuh yang dilindungi hukum:
- **Hak Mendapatkan Informasi (Pasal 5)**: Mengetahui kejelasan identitas pengendali dan tujuan pemrosesan data.
- **Hak Mengakses & Memperoleh Salinan Data (Pasal 7)**: Mengunduh arsip lengkap data pribadi Anda melalui fitur **Ekspor Data** (`GET /api/user/export`).
- **Hak Memperbaiki Kesalahan Data (Pasal 6)**: Mengubah profil dan data kapan saja.
- **Hak Menghapus & Menarik Persetujuan (Pasal 8 & 9)**: Meminta penghapusan akun dan pemusnahan data pribadi (*Right to be Forgotten*) melalui fitur **Hapus Akun** (`DELETE /api/user/delete`) dengan masa tenggang aman 30 hari (*grace period*).

## 5. Pengalihan dan Pihak Ketiga
Ngopi tidak pernah menjual, menyewakan, atau memperdagangkan data pribadi pengguna kepada pihak ketiga atau pengiklan mana pun. Integrasi eksternal dibatasi pada protokol blockchain terdesentralisasi (Bamboochain / BSC) saat pengguna melakukan konversi poin ke token BMC atas inisiatif pribadi.

## 6. Periode Retensi Data
- **Data Akun Aktif**: Disimpan selama akun aktif.
- **Akun Dihapus**: Disimpan dalam masa tenggang 30 hari (untuk mencegah penghapusan tidak disengaja), kemudian dihapus permanen secara otomatis dari basis data.
- **Pesan Offline Mesh**: Dihapus otomatis dari cache lokal setelah masa kedaluwarsa 7 hari (TTL).

## 7. Pemberitahuan Kegagalan Perlindungan Data Pribadi (Data Breach)
Jika terjadi insiden kebocoran atau kegagalan keamanan data, Ngopi wajib menyampaikan pemberitahuan resmi tertulis kepada pengguna yang terdampak dan kepada Kementerian Komunikasi dan Informatika / Lembaga Pengawas PDP dalam waktu **maksimal 3 x 24 jam (72 jam)** sesuai amanat Pasal 46 UU PDP.

## 8. Kontak Pejabat Perlindungan Data (DPO)
Untuk pelaksanaan hak subjek data atau pertanyaan privasi:
- **Email:** dpo@ngopi.top
- **Situs:** https://ngopi.top/privacy
