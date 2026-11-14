# NGOPINOMIC — KNOWN LIMITATIONS & COMPLIANCE GATES

Dokumen ini mencatat seluruh keterbatasan teknis dan fitur yang **sengaja belum diaktifkan** pada rilis awal NGOPINOMIC.

1. **Pembayaran Rupiah (PJP Resmi Belum Terhubung):**
   - Belum terintegrasi dengan Penyedia Jasa Pembayaran (PJP) berizin Bank Indonesia (QRIS/VA/e-wallet produksi).
   - Di staging/testing hanya tersedia `mock_test_provider` (jika `NGOPINOMIC_ALLOW_MOCK_PAYMENT=true` atau `NODE_ENV=test`) yang **bukan pembayaran nyata**.
   - Pencairan komisi Rupiah ke rekening bank pengguna **belum diaktifkan**.

2. **Email Ngopi Eksternal (SMTP/IMAP Belum Operasional):**
   - Ngopi Mail saat ini hanya berfungsi sebagai **sistem pesan internal aplikasi** berbasis database (`ngopi_mails`, `ngopi_mail_recipients`) dan **alias identitas internal**.
   - Pengiriman dan penerimaan email ke/dari penyedia eksternal (Gmail, Outlook, dll.) melalui SMTP/IMAP **belum tersedia** dan **belum diuji**.

3. **Token Utilitas BMC (`configuration_only`):**
   - Gerbang BMC berada pada mode `configuration_only` (`bmc_utility_enabled = false`).
   - Penukaran Poin Ngopi ↔ BMC, transfer token, atau fitur kustodi aset digital **tidak aktif** sampai tinjauan hukum Indonesia (OJK/Bappebti) selesai.

4. **Integrasi Operasional BoomBoom:**
   - Endpoint `/api/ngopinomic/boomboom/authorize-identity` hanya menyediakan autentikasi identitas berbasis `UserConsent` dan secara eksplisit mengembalikan `operational_authorized: false`.
   - Verifikasi pengemudi/kurir (SIM, STNK, asuransi, keselamatan) tetap sepenuhnya menjadi tanggung jawab sistem BoomBoom.

5. **Istilah ID Ngopi:**
   - **ID Ngopi** (`ngp_...`) adalah pengenal komunitas internal di platform Ngopi/BaMbooChain, **bukan** nomor SIM, KTP, maupun nomor telepon seluler resmi.

6. **Navigasi UI Utama:**
   - Halaman `/ngopinomic` dan `/admin/ngopinomic` sudah dibangun dan teruji pada build web, namun tombol pintas di sidebar utama belum dibuka untuk publik sampai UAT staging selesai.

