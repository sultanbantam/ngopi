# NGOPINOMIC — PRE-RELEASE AUDIT & STAGING READINESS

**Tanggal Audit:** 2026-11-14  
**Lingkup:** Modul NGOPINOMIC (Backend Services, API Routes, Prisma Schema/Migration, Frontend Dashboard & Admin Control Center)  
**Sifat Audit:** Audit Internal Kode Sumber & Pengujian Otomatis *(bukan audit keamanan pihak ketiga independen)*  
**Keputusan Rekomendasi Staging:** **GO UNTUK STAGING** *(setelah seluruh temuan Critical & High pada audit ini diperbaiki dan diuji ulang; **NO-GO UNTUK PRODUKSI** sampai PJP Rupiah, SMTP/IMAP, dan tinjauan hukum Indonesia selesai).*

---

## 1. Ringkasan Temuan & Status Perbaikan (Critical / High / Medium / Low)

| ID | Tingkat | Area | Deskripsi Temuan | Status |
|---|---|---|---|---|
| **AUD-01** | **CRITICAL** | Pembayaran Rupiah Marketplace | `POST /api/ngopinomic/marketplace/purchase` sebelumnya mengizinkan pembelian `payment_method: "rupiah"` tanpa verifikasi konfirmasi dari Penyedia Jasa Pembayaran (PJP). | **FIXED** — Ditambahkan `verifyRupiahPaymentConfirmation()` pada `ngopinomicMarketplace.service.ts`. Pembelian Rupiah ditolak kecuali ada tanda tangan HMAC PJP valid atau `mock_test_provider` yang hanya aktif di mode `NODE_ENV=test` / `NGOPINOMIC_ALLOW_MOCK_PAYMENT=true`. |
| **AUD-02** | **HIGH** | Race Condition Pembelian Identitas | Pada `purchasePremiumIdentity`, pengurangan poin (`redeemPoints`) sebelumnya dijalankan sebelum penguncian atomik inventaris (`updateMany`), berisiko membuat saldo tidak konsisten di luar rollback DB penuh. | **FIXED** — Penguncian atomik `updateMany` dipindahkan **sebelum** `redeemPoints` dan diuji dengan `Promise.allSettled` dua pembeli bersamaan (tepat 1 berhasil). |
| **AUD-03** | **HIGH** | Batas Perolehan Poin Harian & Reversal | `earnPoints` belum menegakkan batas perolehan harian lintas aktivitas dan belum memiliki fungsi pembalik poin (*points reversal*). | **FIXED** — Ditambahkan `DAILY_POINTS_EARN_CAP = 500` dengan pencatatan `FraudEvent` (`daily_points_cap_exceeded`) serta `reversePointsTransaction()` *append-only*. |
| **AUD-04** | **MEDIUM** | Rate Limiting & Lifecycle Reservasi | Endpoint mutasi `/api/ngopinomic/*` baru mengandalkan limiter global, dan belum ada endpoint pembatalan reservasi/pengembalian inventaris. | **FIXED** — Ditambahkan `ngopinomicWriteLimiter` (60 req/menit), `POST /marketplace/cancel-reservation`, dan `POST /admin/inventory/:id/return`. |
| **AUD-05** | **MEDIUM** | Email Ngopi Eksternal (SMTP/IMAP) | Ngopi Mail saat ini beroperasi sebagai pesan internal DB (`ngopi_mails`, `ngopi_mail_recipients`), bukan server SMTP/IMAP eksternal. | **OPEN (KNOWN LIMITATION)** — Didokumentasikan tegas; tidak diklaim sebagai mailbox eksternal operasional. |
| **AUD-06** | **LOW** | Navigasi Sidebar Utama | Halaman `/ngopinomic` dan `/admin/ngopinomic` belum ditautkan sebagai tombol pintas permanen di menu utama agar tidak mengubah layout produksi sebelum staging. | **OPEN (STAGING TASK)** — Dapat diakses langsung via URL `/ngopinomic` dan `/admin/ngopinomic`, tautan menu ditambahkan setelah UAT staging. |

---

## 2. Audit per Domain

### B. Transaksi dan Komisi
- Seluruh komisi dihitung melalui `calculateNetDistributableRevenue()` dari **Pendapatan Bersih yang Dapat Dibagikan (Dasar Komisi Bersih)** (`Gross - Pajak - Biaya Pembayaran - Alokasi Infrastruktur - Cadangan/Refund Aktual tanpa pemotongan ganda - Biaya Ops Langsung`).
- Hasil `<= 0` menghasilkan komisi `0`.
- `max_total_cap_bps` default `3500` (35%) ditegakkan secara ketat.
- Pembatalan/refund dicatat lewat `processTransactionReversal()` sebagai entri baru (`refund_reversal`, `status = 'reversed'`) pada buku besar *append-only*, tidak pernah menghapus catatan historis.
- **Mock Payment Notice:** `mock_test_provider` hanya digunakan untuk pengujian dan **bukan pembayaran Rupiah nyata**.

### C. Poin Ngopi (Normal, Pengguna Nakal, & Bot)
- **Pengguna Normal:** Check-in harian (`+10` poin, 1x/hari), penukaran identitas yang memenuhi syarat, dan riwayat transparan.
- **Pengguna Nakal:** Permintaan *self-referral*, registrasi referral ganda, maupun spoofing `activity_code`/`amount` di endpoint ditolak (`400`/`403`) dan dicatat ke `FraudEvent`.
- **Bot / Duplikasi:** Permintaan ganda dengan `idempotency_key` sama diblokir; percobaan melebihi `DAILY_POINTS_EARN_CAP` (`500`/hari) ditolak.

### D. Marketplace Identitas & Kejelasan Istilah ID Ngopi
- Normalisasi nilai (`trim().toLowerCase()`) + *unique constraint* `(category, normalized_value)` mencegah duplikasi (`kopi` vs `KOPI`).
- Siklus status lengkap: `Available`, `Reserved` (dengan `reserved_until` TTL), `Sold`, `Active`, `Frozen`, `Returned`.
- **Klarifikasi Tegas:** **ID Ngopi** adalah *handle* komunitas internal ekosistem (`ngp_...`), **bukan** nomor SIM, KTP, maupun nomor telepon seluler.

### E. Audit Email Ngopi (Pemisahan Tegas)
1. **Alamat Identitas Internal:** `username@ngopi.top` (`UserIdentity.basic_email`) — aktif untuk identitas internal.
2. **Alias Email Premium:** `EmailIdentity` (`kopi@ngopi.top`, dll.) — kepemilikan tercatat di inventaris internal.
3. **Mailbox Eksternal (SMTP/IMAP):** **BELUM TERSEDIA / BELUM OPERASIONAL**. Belum ada MTA/SMTP/IMAP untuk kirim/terima email dari Gmail/Outlook/domain eksternal.

### F. Audit Keamanan
- Autentikasi JWT terverifikasi (`verifyJWT`) + resolusi user & role langsung dari PostgreSQL (`prisma.user.findUnique`, `requireDbRole('admin', 'superadmin')`).
- Pencegahan IDOR: seluruh operasi menggunakan `req.user.id` terverifikasi, bukan parameter body/query.
- Rate limit: global `apiLimiter` + `ngopinomicWriteLimiter` (60/menit).
- Input validation, sanitasi global (`sanitizeRequest`), *append-only ledger*, *idempotency key*, dan *UserConsent* lintas aplikasi (`boomboom` dengan `operational_authorized: false`).

### G. Simulasi Ekonomi (Ilustrasi — Bukan Data Aktual)
Menggunakan asumsi dari `NGOPINOMIC_TOKEN_POINT_ECONOMICS.md` (3% pembeli ID Premium @ Rp120.000, 2% Email Premium @ Rp100.000, total potongan 30% → Dasar Komisi Bersih 70%, rata-rata komisi efektif 22% dari Dasar Komisi Bersih):

| Skala Pengguna | Gross Revenue | Pajak & Biaya (13%) | Infra (3%) | Cadangan Refund (4%) | Ops Lain (10%) | Dasar Komisi Bersih (70%) | Komisi Afiliasi (22% NDR) | Bersih Platform | Poin Diterbitkan |
|---|---|---|---|---|---|---|---|---|---|
| **1.000** | Rp5.600.000 | Rp728.000 | Rp168.000 | Rp224.000 | Rp560.000 | **Rp3.920.000** | Rp862.400 | **Rp3.057.600** | 150.000 |
| **10.000** | Rp56.000.000 | Rp7.280.000 | Rp1.680.000 | Rp2.240.000 | Rp5.600.000 | **Rp39.200.000** | Rp8.624.000 | **Rp30.576.000** | 1.500.000 |
| **100.000** | Rp560.000.000 | Rp72.800.000 | Rp16.800.000 | Rp22.400.000 | Rp56.000.000 | **Rp392.000.000** | Rp86.240.000 | **Rp305.760.000** | 15.000.000 |
| **1.000.000** | Rp5.600.000.000 | Rp728.000.000 | Rp168.000.000 | Rp224.000.000 | Rp560.000.000 | **Rp3.920.000.000** | Rp862.400.000 | **Rp3.057.600.000** | 150.000.000 |

---

## 3. Bukti Pengujian & Rekomendasi

- `npx prisma validate` → **PASS**
- `backend/tests/ngopinomic.test.ts` → **PASS (15/15)** termasuk uji mock payment gate, race condition `Promise.allSettled`, daily cap, points reversal, NDR, cap 35%, dan RBAC `403`.
- `backend/tests/points_economy.test.ts`, `compliance.test.ts`, `merchant.test.ts` → **PASS (100%)**.
- `frontend`: `npx tsc --noEmit` → **PASS (0 error)** & `npm run build` (`expo export -p web`) → **PASS**.

**Rekomendasi:** **GO FOR STAGING** (pada database & server staging terpisah dengan `NGOPINOMIC_ALLOW_MOCK_PAYMENT=true` hanya di staging/testing). **NO-GO FOR PRODUCTION** hingga integrasi PJP resmi, SMTP/IMAP, dan peninjauan hukum selesai.

