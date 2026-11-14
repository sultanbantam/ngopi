# NGOPINOMIC MASTER IMPLEMENTATION PLAN
## Rencana Eksekusi Bertahap di Repositori Ngopi

**Dokumen:** 4 dari 4 (Master Deliverables NGOPINOMIC)  
**Target Repositori:** `c:/Users/dummy/Documents/Projects/ngopi`

---

## 1. Prinsip Eksekusi & Pelestarian Fitur Eksisting

1. **Incremental & Non-Destructive:** Seluruh modul NGOPINOMIC ditambahkan sebagai modul baru (`/api/ngopinomic/*`, `frontend/app/(main)/ngopinomic.tsx`, dll.) tanpa mengubah rute autentikasi (`/api/auth`), peran Founder `#0` (`superadmin`), chat, panggilan, gim, maupun alur merchant yang sudah lulus uji produksi.
2. **Database-First Ledger:** Menggunakan PostgreSQL + Prisma 7 (`backend/prisma/schema.prisma`) untuk seluruh saldo poin, inventaris identitas premium, komisi, buku besar, dan log audit.
3. **Strict Separation:** `PointsAccount` (Poin Ngopi), `WalletAccount` (Rupiah / Komisi), dan `BmcTransaction` (Manfaat BMC) disimpan dan dihitung secara terpisah.

---

## 2. Peta Perubahan Repositori

### A. Basis Data & Migrasi (`backend/prisma/`)
- `backend/prisma/schema.prisma` — Tambah model NGOPINOMIC:
  - `UserIdentity`
  - `PremiumIdentityInventory`
  - `EmailIdentity`
  - `PointsAccount`
  - `PointsTransaction`
  - `AffiliateProfile`
  - `ReferralRelationship`
  - `CommissionRule`
  - `CommissionTransaction`
  - `WalletAccount`
  - `LedgerTransaction`
  - `LedgerEntry`
  - `BmcTransaction`
  - `CommunityMembership`
  - `EcosystemApplication`
  - `UserConsent`
  - `FraudEvent`
  - `AdminAuditLog`
- `backend/prisma/migrations/20261114140000_ngopinomic_foundation/migration.sql` — SQL migrasi terstruktur untuk seluruh tabel dan indeks unik NGOPINOMIC.

### B. Backend Services (`backend/src/services/ngopinomic/`)
1. `ngopinomicLedger.service.ts` — Mesin buku besar *append-only*, *idempotency key*, pembuatan transaksi ganda/tercatat, pembalikan (*reversal*), dan verifikasi rekonsiliasi saldo.
2. `ngopinomicEconomy.service.ts` — Kalkulator wajib **Net Distributable Revenue** (mengurangi pajak, biaya payment, infrastruktur, cadangan refund, biaya ops lain; mencegah double deduction; hasil `<= 0` -> komisi `0`), penegakan *commission cap*, serta manajemen *PointsAccount*, *ReferralRelationship*, dan *CommissionTransaction*.
3. `ngopinomicMarketplace.service.ts` — Manajemen inventaris `PremiumIdentityInventory`, alur `Available -> Reserved -> Sold -> Active`, proteksi anti-penjualan ganda, dan pembelian/penukaran.
4. `ngopinomicEcosystem.service.ts` — Gerbang BMC (mode konfigurasi/terkendali), registrasi aplikasi ekosistem (`EcosystemApplication`), persetujuan `UserConsent`, dan antarmuka identitas BoomBoom (`authorizeIdentity`).
5. `ngopinomicAdmin.service.ts` — Konfigurasi harga & tarif komisi, pembuatan `AdminAuditLog`, pencatatan `FraudEvent`, serta pembalikan transaksi/refund.

### C. Backend Routes & Controller (`backend/src/routes/ngopinomic.routes.ts`)
- Terpasang di `backend/src/index.ts` pada path `/api/ngopinomic`.
- Seluruh endpoint terproteksi `verifyJWT`, rate limiter, dan `requireDbRole('admin', 'superadmin')` untuk endpoint `/api/ngopinomic/admin/*`.

### D. Frontend Pages & Components (`frontend/`)
- `frontend/app/(main)/ngopinomic.tsx` — **Dashboard NGOPINOMIC** sederhana berbahasa Indonesia dengan 9 kartu utama:
  1. ID Ngopi Saya
  2. Email Ngopi Saya
  3. Poin Ngopi Saya
  4. Komisi Saya (dengan rincian transparan Dasar Komisi Bersih)
  5. Manfaat BMC Saya
  6. Tautan Undang Teman
  7. Keanggotaan Komunitas
  8. Riwayat Transaksi
  9. Aturan & Bantuan + Marketplace ID/Email Ngopi Premium
- `frontend/app/(main)/admin/ngopinomic.tsx` — Panel Admin Control Center NGOPINOMIC (konfigurasi tarif komisi, tambah inventaris premium, audit log, dan simulasi/reversal).
- Tautan navigasi aman di `frontend/app/(main)/_layout.tsx` atau menu utama tanpa mengganggu tata letak chat/game yang sudah ada.

### E. Pengujian Otomatis (`backend/tests/ngopinomic.test.ts`)
Menguji ke-15 kriteria penerimaan wajib:
1. Pengguna eksisting tidak menerima duplikasi Ngopi ID.
2. Identitas premium tidak dapat dijual dua kali.
3. Poin tidak dapat digandakan melalui permintaan duplikat (*idempotency*).
4. Relasi referral tidak dapat dimanipulasi (anti-self-referral, anti-duplikasi).
5. Komisi dihitung dari *Net Distributable Revenue*, bukan nilai kotor.
6. *Net Distributable Revenue* nol atau negatif menghasilkan komisi nol.
7. Refund/reversal membalik entri komisi terkait lewat entri baru (*append-only*).
8. Tarif afiliasi mematuhi *commission cap* yang dikonfigurasi.
9. Pengguna tidak dapat memodifikasi saldo poin atau komisi miliknya sendiri.
10. Pengguna biasa tidak dapat mengakses endpoint admin (`403 Forbidden`).
11. Seluruh transaksi memiliki referensi unik.
12. Riwayat ledger dapat diaudit (*append-only*).
13. Transaksi gagal tidak menciptakan saldo inkonsisten.
14. Integrasi BoomBoom mematuhi izin scope aplikasi (`UserConsent`) dan tidak memberi otorisasi operasional otomatis.
15. Fitur eksisting Ngopi tetap berjalan dan lulus regresi.

---

## 3. Rencana Tahapan & Kriteria Penerimaan

| Fase | Ruang Lingkup | Kriteria Selesai |
|---|---|---|
| **Phase 1 — Foundation** | Schema Prisma, migrasi SQL, `UserIdentity` tanpa duplikat, Dashboard dasar | Schema tervalidasi, `UserIdentity` unik per user |
| **Phase 2 — Community Economy** | Ledger *append-only*, Points Engine, Referral Engine, Affiliate NDR Engine | 11 aturan NDR & idempotensi teruji |
| **Phase 3 — Marketplace** | Inventaris ID & Email Premium, 5 rarity tier, alur reservasi & pembelian | Anti-penjualan ganda & pencatatan komisi teruji |
| **Phase 4 — Ecosystem Integration** | BMC mode terkendali, BoomBoom Identity Gateway & `UserConsent` | Scope izin & batas otorisasi teruji |
| **Phase 5 — Admin & Quality** | Admin Control Center, `AdminAuditLog`, `FraudEvent`, test suite & build | Semua test pass, frontend & backend build bersih |

---

## 4. Persyaratan Deployment Lokal & Produksi

- **Lokal:** Jalankan `npx prisma validate`, `npx prisma generate`, test suite `npx tsx tests/ngopinomic.test.ts`, serta build frontend (`npm run build` di `frontend/`).
- **Produksi (Hanya setelah otorisasi eksplisit):** Backup database, `npx prisma migrate deploy`, build & restart PM2 `ngopi-api`, dan deploy frontend Vercel. **Tidak** dijalankan otomatis dalam fase implementasi lokal ini.

