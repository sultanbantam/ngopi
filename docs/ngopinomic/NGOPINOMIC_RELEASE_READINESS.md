# NGOPINOMIC — RELEASE READINESS ASSESSMENT

**Tanggal:** 2026-11-14  
**Keputusan Staging:** **GO FOR STAGING**  
**Keputusan Produksi:** **NO-GO FOR PRODUCTION** *(hingga prasyarat eksternal & hukum terpenuhi)*

---

## 1. Fitur yang Sudah Berfungsi (Teruji di Staging DB)
- `UserIdentity` 1-to-1 per user tanpa duplikasi (`ngp_...`) + Email dasar `@ngopi.top`.
- `PointsAccount` & `PointsTransaction` *append-only* berbasis PostgreSQL (check-in harian +10 poin 1x/hari, batas harian 500 poin, *idempotency key*, *points reversal*).
- `ReferralRelationship` 2 tingkat (anti-self-referral & anti-circular-referral).
- `CommissionTransaction` & `WalletAccount` + `LedgerTransaction`/`LedgerEntry` *append-only* dengan perhitungan **Pendapatan Bersih yang Dapat Dibagikan (Dasar Komisi Bersih)**, cap default `35%`, dan *refund reversal*.
- Marketplace ID & Email Premium (`Available`, `Reserved`, `Sold`, `Active`, `Frozen`, `Returned`), anti-penjualan ganda paralel, reservasi & pembatalan.
- Dashboard `/ngopinomic` dan Admin Control Center `/admin/ngopinomic` (konfigurasi aturan, inventaris, transaksi/reversal, dan `AdminAuditLog`).
- Gerbang integrasi BoomBoom berbasis `UserConsent` (`operational_authorized: false`).

## 2. Fitur yang Sengaja Belum Aktif
- Pembayaran Rupiah produksi via PJP berizin Bank Indonesia (staging memakai `mock_test_provider` non-nyata).
- Pencairan komisi Rupiah ke rekening bank.
- Mailbox eksternal SMTP/IMAP untuk Ngopi Mail (saat ini pesan internal & alias identitas).
- Utilitas token BMC (`bmc_utility_enabled = false`, mode `configuration_only`).
- Otorisasi operasional pengemudi/kurir BoomBoom.

## 3. Status Migrasi & Lingkungan Staging
- **Database Staging:** `127.0.0.1:5439/ngopi_ngopinomic_staging` (PostgreSQL 16 terisolasi, bukan produksi).
- **Migrasi:** `7` migrasi termasuk `20261114140000_ngopinomic_foundation` — `Database schema is up to date!`.
- **Produksi:** Tidak disentuh sama sekali (`ngopi.top`, `api.ngopi.top`, DB produksi, dan PM2 produksi tidak diubah).

## 4. Temuan Tersisa & Risiko Eksternal
- **AUD-05 (Medium):** SMTP/IMAP eksternal belum tersedia.
- **AUD-06 (Low):** Tautan pintas sidebar utama ke `/ngopinomic` belum dibuka untuk publik.
- **Risiko Eksternal:** Ketergantungan integrasi PJP berizin BI, infrastruktur email eksternal (jika dibutuhkan), serta tinjauan hukum Indonesia (PSE, UU PDP, PPh/PPN komisi, Koperasi, OJK/Bappebti untuk BMC).

## 5. Langkah Konkret Menuju Rilis Produksi
1. Selesaikan tinjauan hukum Indonesia untuk skema afiliasi, perpajakan, koperasi, dan BMC.
2. Integrasikan Penyedia Jasa Pembayaran (PJP) resmi berizin Bank Indonesia dan hapus/nonaktifkan `NGOPINOMIC_ALLOW_MOCK_PAYMENT` di produksi.
3. Putuskan apakah Ngopi Mail memerlukan server SMTP/IMAP eksternal atau tetap pesan internal + alias.
4. Setelah disetujui: backup DB produksi, jalankan `prisma migrate deploy` pada DB produksi, deploy backend & frontend, lalu uji smoke test produksi.

