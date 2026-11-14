# NGOPINOMIC SYSTEM ARCHITECTURE
## Arsitektur Teknis Terintegrasi di Atas Repositori Ngopi

**Dokumen:** 3 dari 4 (Master Deliverables NGOPINOMIC)  
**Platform:** Ngopi (`https://ngopi.top` / `https://api.ngopi.top`)

---

## 1. Hasil Inspeksi Arsitektur Repositori Ngopi Saat Ini

Berdasarkan inspeksi langsung terhadap kode sumber repositori:
- **Frontend Framework:** Expo (`~57.0.31`) + Expo Router (`~57.0.29`) + React (`19.2.3`) + React Native (`0.86.3`) + React Native Web (`^0.21.2`) di `frontend/app/`. Menggunakan tema terpusat `coffee` (`frontend/src/theme/coffee.ts`) dan helper sesi `getAuthHeaders()` / `API_URL` (`frontend/src/utils/api.ts`, `session.ts`).
- **Backend Framework:** Node.js + TypeScript + Express (`^5.2.1`) di `backend/src/index.ts`, dilengkapi `helmet`, `cors`, `cookie-parser`, `express-rate-limit`, `sanitizeRequest`, dan `encodeJsonResponse`.
- **Database & ORM:** PostgreSQL 16 dengan Prisma (`^7.8.0`) dan `@prisma/adapter-pg` (`backend/src/utils/prisma.ts`, `backend/prisma/schema.prisma`).
- **Autentikasi & Otorisasi:** JWT access/refresh token melalui `verifyJWT` (`backend/src/middleware/auth.middleware.ts`) dan otorisasi berbasis basis data `requireDbRole` / `requireAdmin` / `requireSuperadmin` (`backend/src/middleware/rbac.middleware.ts`). Peran pengguna: `user`, `merchant`, `agent_cs`, `admin`, `superadmin`.
- **Model User Saat Ini:** Model `User` di `schema.prisma` memiliki `id` (UUID), `username` (unik), `display_name`, `role`, `mfa_enabled`, `public_key`, `wallet_address`, `bmc_id` (`autoincrement`), serta relasi ke `MerchantProfile`, `MerchantAgreement`, `GamePlayer`, `RefreshToken`, dll.
- **Modul Eksisting Terkait:**
  - **Identitas & Mail (`telecom.service.ts`, `telecom.routes.ts`):** Sudah memiliki tabel `NgopiIdentity`, `IdentityPackage`, `IdentityOrder`, `VipIdentityRequest`, `IdentityAuditLog`, `NgopiMail`, `NgopiMailRecipient`.
  - **Poin Ngopi (`points.service.ts`, `bmc.routes.ts`):** Saat ini menyimpan `UserPoints` dan `PointsTransaction` di memori + berkas JSON (`data/points_economy.json`). NGOPINOMIC meningkatkan lapisan ini menjadi buku besar PostgreSQL *append-only* yang teraudit tanpa memutus endpoint gim/poin yang sudah ada.
  - **Blockchain / BMC (`bmc.controller.ts`, `utils/blockchain.ts`, `ethers`):** Membaca saldo on-chain `wallet_address` dan klaim airdrop.
  - **Chat, Call, Game & Merchant:** `message.routes.ts`, `group.routes.ts`, `sockets/index.ts`, `game.routes.ts`, `merchant.routes.ts`, `partnership.routes.ts`.
- **Arsitektur Deployment:** Backend di Contabo VPS (`PM2 ngopi-api` + PostgreSQL 16 Docker), Frontend Web di Vercel (`https://ngopi.top`).

---

## 2. A. Empat Belas Modul Inti NGOPINOMIC

1. **Ngopi Identity Engine:** Mengelola identitas dasar gratis (`UserIdentity`) dan menyinkronkan dengan `User` + `NgopiIdentity` eksisting tanpa duplikasi.
2. **Premium Identity Marketplace:** Mengelola inventaris `PremiumIdentityInventory` dengan rarity tier (`Regular`, `Silver`, `Gold`, `Platinum`, `Signature`), harga dinamis dari konfigurasi admin, dan status terkunci (`Available`, `Reserved`, `Sold`, `Active`, `Frozen`, `Returned`).
3. **Ngopi Email Identity:** Mengelola kepemilikan alamat `@ngopi.top` (`EmailIdentity`) dan integrasi ke `NgopiMail`.
4. **Ngopi Points Engine:** Buku besar poin loyalitas berbasis PostgreSQL (`PointsAccount`, `PointsTransaction`) dengan *idempotency key*, batas harian, dan pemisahan mutlak dari Rupiah/BMC.
5. **Referral Engine:** Mengelola tautan undangan unik, registrasi hubungan referral (`ReferralRelationship`) maks. 2 tingkat untuk komisi, serta anti-self-referral & anti-circular-referral.
6. **Affiliate Commission Engine:** Menghitung komisi **hanya** dari *Net Distributable Revenue*, menerapkan *commission cap*, masa tunggu (`pending` → `settled`), serta pembalikan (`reversed`) jika terjadi refund/chargeback.
7. **Wallet and Ledger Engine:** Buku besar *append-only* (`WalletAccount`, `LedgerTransaction`, `LedgerEntry`) untuk mencatat pergerakan Rupiah/komisi, poin, dan audit rekonsiliasi saldo.
8. **BMC Integration Gateway:** Gerbang utilitas BMC (`BmcTransaction`) dalam mode konfigurasi/terkendali (`configuration-only / gated`) hingga tinjauan hukum selesai.
9. **Community and Cooperative Engine:** Mengelola keanggotaan komunitas & koperasi (`CommunityMembership`) secara terpisah dari hak milik perusahaan/yayasan.
10. **BoomBoom Integration Gateway:** Antarmuka autentikasi identitas lintas aplikasi (`EcosystemApplication`, `UserConsent`) untuk peran Penumpang, Pengemudi, Kurir, Pengirim, Penerima, dan Mitra Usaha/Logistik.
11. **Fraud Detection Engine:** Pencatatan `FraudEvent`, deteksi duplikasi idempotensi, lonjakan klaim tidak wajar, self-referral, dan pembekuan sementara.
12. **Admin Control Center:** Panel admin berbasis `requireDbRole('admin', 'superadmin')` untuk mengatur harga, tarif komisi, aturan poin, biaya alokasi, dan mode BMC dengan `AdminAuditLog` wajib.
13. **User NGOPINOMIC Dashboard:** Antarmuka sederhana berbahasa Indonesia (`frontend/app/(main)/ngopinomic.tsx`) tanpa istilah blockchain/akuntansi rumit.
14. **Rules and Transparency Center:** Halaman/bagian aturan yang menjelaskan Poin Ngopi, rumus Dasar Komisi Bersih, privasi identitas, dan pemberitahuan non-investasi.

---

## 3. B. Arsitektur Identitas & Integrasi Ekosistem (OAuth 2.1 / OIDC)

Ngopi ID bertindak sebagai **Identity Provider (IdP)** tunggal untuk ekosistem:
- Ngopi Chat & Ngopi Mail
- BoomBoom (Transportasi & Logistik)
- BaMbooChain Marketplace, BaMbooChain Academy, Bamboo Tracker
- Events & Games

### Mekanisme Keamanan Lintas Aplikasi:
- **Standar:** OAuth 2.1 Authorization Code + PKCE & OpenID Connect (OIDC) *scoped claims*.
- **Scoped Access Token & Consent:** Setiap aplikasi terdaftar di `EcosystemApplication` dengan `allowed_scopes` (misal: `identity:basic`, `identity:email`, `boomboom:profile`). Pengguna memberikan persetujuan eksplisit di `UserConsent` dan dapat mencabut izin (`revoked_at`) kapan saja.
- **Data Minimization:** Aplikasi mitra tidak pernah menerima daftar kontak, riwayat obrolan, saldo dompet, atau data pribadi lain di luar scope yang disetujui.

---

## 4. C. Arsitektur Integrasi BoomBoom

BoomBoom terhubung melalui **BoomBoom Identity Gateway** untuk peran:
- `passenger`, `driver`, `courier`, `sender`, `receiver`, `logistics_partner`.

**Batas Tanggung Jawab Tegas:**
- Ngopi ID menyediakan **autentikasi & identitas dasar** (`user_identity_id`, `ngopi_id`, `display_name`, status aktif).
- Ngopi ID **tidak** memberikan otorisasi operasional mengemudi/kurir secara otomatis. BoomBoom wajib memvalidasi izin operasional, KYC pengemudi, SIM/STNK, asuransi, dan keselamatan di sistem BoomBoom sendiri.

---

## 5. D. Desain Basis Data & Buku Besar *Append-Only*

Seluruh model baru ditambahkan ke `backend/prisma/schema.prisma` menggunakan konvensi PostgreSQL/Prisma eksisting:

- `UserIdentity`: 1-to-1 per `user_id` (constraint `@unique` mencegah duplikasi Ngopi ID), menyimpan `ngopi_id`, `basic_email`, `tier`, `status`.
- `PremiumIdentityInventory`: Inventaris ID & Email Premium dengan `@@unique([category, normalized_value])`, `rarity_tier`, `price_idr`, `price_points`, `status` (`Available` | `Reserved` | `Sold` | `Active` | `Frozen` | `Returned`), `owner_user_id`, `reserved_by_user_id`, `reserved_until`.
- `EmailIdentity`: Kepemilikan aktif `@ngopi.top` per `user_id` dan referensi inventaris.
- `PointsAccount` & `PointsTransaction`: Saldo poin terpisah + riwayat transaksi *append-only* dengan `idempotency_key @unique` dan `reference_code @unique`.
- `AffiliateProfile` & `ReferralRelationship`: Kode referral unik per user, `payout_preference` (`rupiah` | `points`), dan relasi `referrer_id` → `referred_user_id` (`@unique` agar satu user tidak bisa punya banyak referrer).
- `CommissionRule` & `CommissionTransaction`: Aturan tarif & alokasi biaya dari DB, serta transaksi komisi yang menyimpan `gross_amount_idr`, `deductions_json`, `net_distributable_idr`, `rate_bps`, `commission_amount_idr`, `status` (`pending` | `settled` | `reversed`), dan `reversal_of_id`.
- `WalletAccount`, `LedgerTransaction`, `LedgerEntry`: Buku besar transaksi *double-entry / append-only* dengan `idempotency_key @unique`, `reference_code @unique`, `debit_idr` / `credit_idr` atau unit instrumen yang terpisah (`instrument`: `IDR` | `POINTS` | `BMC`).
- `BmcTransaction`: Catatan aktivitas utilitas BMC (mode konfigurasi/terkendali).
- `CommunityMembership`: Status keanggotaan komunitas/koperasi (`member_tier`, `cooperative_status`).
- `EcosystemApplication` & `UserConsent`: Aplikasi mitra & izin scope pengguna.
- `FraudEvent` & `AdminAuditLog`: Log anomali kecurangan dan log audit perubahan aturan admin (`actor_id`, `previous_value`, `new_value`, `reason`).

### Jaminan Integritas:
- Seluruh kalkulasi ekonomi & saldo berjalan di dalam `prisma.$transaction(...)` di backend.
- Tidak ada endpoint yang menerima saldo atau nominal komisi langsung dari frontend.
- Pembatalan transaksi selalu menulis entri pembalik baru, tidak pernah `DELETE` atau `UPDATE` histori ledger.

---

## 6. E. Desain API NGOPINOMIC (`/api/ngopinomic/*`)

Semua endpoint terautentikasi menggunakan `verifyJWT` (+ `requireDbRole('admin', 'superadmin')` untuk rute admin) dan rate limiter:

- `GET /api/ngopinomic/dashboard` — Ringkasan sederhana User NGOPINOMIC Dashboard (identitas, poin, komisi saya, manfaat BMC, link referral, keanggotaan, riwayat transaksi, aturan).
- `GET /api/ngopinomic/rules` — Aturan transparan Poin Ngopi, rumus Dasar Komisi Bersih, dan kebijakan perlindungan pengguna.
- `GET /api/ngopinomic/marketplace/identities` — Daftar inventaris ID & Email Ngopi Premium (`Available`, tier, harga).
- `POST /api/ngopinomic/marketplace/reserve` — Reservasi sementara ID/Email Premium (atomik DB).
- `POST /api/ngopinomic/marketplace/purchase` — Pembelian/penukaran ID/Email Premium (`rupiah` simulasi PJP terverifikasi / `points` ledger) yang memicu kalkulasi komisi berbasis *Net Distributable Revenue* jika ada referrer.
- `GET /api/ngopinomic/points/history` — Riwayat `PointsTransaction` dari ledger PostgreSQL.
- `POST /api/ngopinomic/points/claim` — Klaim aktivitas poin sah (mis. `daily_checkin`) dengan `idempotency_key`.
- `POST /api/ngopinomic/referral/register` — Mendaftarkan kode referral pengundang (menolak self-referral & duplikasi).
- `PATCH /api/ngopinomic/affiliate/preference` — Mengubah preferensi pencairan (`rupiah` | `points`).
- `GET /api/ngopinomic/affiliate/commissions` — Rincian komisi & transparansi perhitungan Dasar Komisi Bersih.
- `GET /api/ngopinomic/bmc/status` — Status gerbang manfaat BMC (menampilkan mode konfigurasi/terkendali).
- `POST /api/ngopinomic/ecosystem/consent` — Memberi atau mencabut izin `UserConsent` aplikasi ekosistem (mis. BoomBoom).
- `POST /api/ngopinomic/boomboom/authorize-identity` — Validasi identitas & scope izin BoomBoom (mengembalikan identitas terbatas + penegasan `operational_authorized: false`).
- **Admin Control Center (`/api/ngopinomic/admin/*`):**
  - `GET /api/ngopinomic/admin/config` — Ambil seluruh aturan komisi, harga tier, dan status BMC.
  - `PUT /api/ngopinomic/admin/commission-rules` — Ubah tarif/cap/alokasi biaya (wajib `reason`, dicatat ke `AdminAuditLog`).
  - `POST /api/ngopinomic/admin/inventory` — Tambah/kelola item inventaris ID/Email Premium & harga.
  - `POST /api/ngopinomic/admin/transactions/:txId/reverse` — Proses refund/reversal transaksi & pembalikan komisi otomatis.
  - `GET /api/ngopinomic/admin/audit-logs` — Lihat `AdminAuditLog` dan `FraudEvent`.

