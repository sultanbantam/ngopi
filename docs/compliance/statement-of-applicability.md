# Statement of Applicability (SoA) — ISO/IEC 27001:2022
**Organisasi:** PT Ngopi Kreasi Digital  
**Lingkup Sertifikasi:** Platform Aplikasi Komunikasi & Ekosistem Digital Ngopi  
**Tanggal Evaluasi:** 12 Oktober 2026  

---

| No. Kontrol | Nama Kontrol Keamanan (ISO 27001:2022) | Status | Justifikasi Penerapan & Bukti Teknis |
| :--- | :--- | :--- | :--- |
| **A.5.15** | Kontrol Akses (Access Control) | Diterapkan | Otentikasi berbasis token JWT, verifikasi password ber-hash, otorisasi per-room chat. |
| **A.5.24** | Manajemen Insiden Keamanan Informasi | Diterapkan | SOP Incident Response Plan dengan notifikasi 3x24 jam UU PDP (`reportSecurityIncident`). |
| **A.5.31** | Kepatuhan Hukum, Peraturan & Kontraktual | Diterapkan | Kepatuhan terhadap UU No. 27/2022 (UU PDP) dan pendaftaran PSE Lingkup Privat PP 71/2019. |
| **A.5.34** | Privasi & Perlindungan Data Pribadi | Diterapkan | Consent banner, fitur ekspor JSON (`/api/user/export`), dan penghapusan grace period 30 hari. |
| **A.8.2** | Hak Istimewa Akses (Privileged Access) | Diterapkan | Akses admin console dilindungi otentikasi ketat dan audit trail. |
| **A.8.7** | Perlindungan Terhadap Malware | Diterapkan | Sanitasi file upload, validasi MIME type, pemindaian lampiran. |
| **A.8.12** | Pencegahan Kebocoran Data (DLP) | Diterapkan | Enkripsi end-to-end menyeluruh (X25519 & AES-GCM), server tidak menyimpan kunci privat. |
| **A.8.13** | Pencadangan Informasi (Backup) | Diterapkan | Snapshot database otomatis berkala dengan replikasi lintas region. |
| **A.8.14** | Redundansi Fasilitas Pemrosesan Informasi | Diterapkan | Arsitektur Bluetooth LE Mesh darurat saat koneksi internet terputus. |
| **A.8.16** | Pemantauan & Pencatatan Log (Logging) | Diterapkan | Audit log tersimpan pada sistem kepatuhan (`complianceService.logAudit`). |
| **A.8.20** | Keamanan Jaringan | Diterapkan | HTTPS TLS 1.3, WebSocket WSS, pembatasan rate limit anti-DDoS. |
| **A.8.24** | Penggunaan Kriptografi | Diterapkan | Standar industri TweetNaCl, CryptoJS, X25519, AES-256-GCM. |
| **A.8.28** | Pengodean yang Aman (Secure Coding) | Diterapkan | Validasi skema input (Zod), ORM Prisma anti-SQLi, Helmet security headers. |
