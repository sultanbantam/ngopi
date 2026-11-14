# NGOPINOMIC — STAGING UAT RESULTS

**Tanggal Eksekusi:** 2026-11-14  
**Lingkungan Staging:**
- **Database:** PostgreSQL 16 terisolasi (`ngopi-pg-stage-b2` / `127.0.0.1:5439/ngopi_ngopinomic_staging`)
- **Migrasi:** `7` migrasi termasuk `20261114140000_ngopinomic_foundation` (`Database schema is up to date!`, `18` tabel `ngopinomic_*` terverifikasi)
- **Konfigurasi:** `NGOPINOMIC_ALLOW_MOCK_PAYMENT=true` (khusus staging), `bmc_utility_enabled=false`
- **Akun Uji:** `uat_user_normal` (`role: user`), `uat_user_normal_2` (`role: user`), `uat_user_admin` (`role: admin`)

## Hasil Skenario UAT

| Skenario | Deskripsi | Hasil | Bukti / Catatan Aktual |
|---|---|---|---|
| **UAT-1** | Login & pembuatan `UserIdentity` tanpa duplikasi + status BMC nonaktif | **PASS** | `ngp_uat_user_normal_28` dibuat sekali; pemanggilan ulang mengembalikan ID yang sama; `bmc_utility_enabled: false`. |
| **UAT-2** | Check-in harian dua kali berturut-turut | **PASS** | Permintaan ke-1 `+10` poin; permintaan ke-2 `idempotent: true`; saldo akhir tepat `10`. |
| **UAT-3** | Referral dua akun & anti-self-referral | **PASS** | Self-referral ditolak (`HTTP 400`); referral `uat_user_normal` → `uat_user_normal_2` berhasil (`HTTP 200`). |
| **UAT-4 & 5** | Pembelian ID Premium (`kopi`) dengan `mock_test_provider` & verifikasi NDR | **PASS** | Harga Rp250.000 → NDR 70% = `Rp175.000` → Komisi langsung 20% = `Rp35.000` (`status: pending`). *(Mock payment bukan transaksi nyata).* |
| **UAT-6** | Dua pembelian paralel bersamaan pada satu ID (`warung`) | **PASS** | `Promise.all` dua akun: tepat `1` berhasil (`HTTP 200`), `1` ditolak. |
| **UAT-7** | Reservasi & pembatalan reservasi (`sultan`) | **PASS** | Status berubah `Available → Reserved → Available`. |
| **UAT-8** | Reversal transaksi & komisi oleh admin | **PASS** | `POST /admin/transactions/:txId/reverse` menghasilkan `refund_reversal` & menurunkan `pending_idr` menjadi `0`. |
| **UAT-9** | Akses endpoint admin oleh akun biasa (`uat_user_normal`) | **PASS** | `GET /api/ngopinomic/admin/config` mengembalikan `HTTP 403`. |
| **UAT-10** | Build responsif web (`/ngopinomic`, `/admin/ngopinomic`) | **PASS** | `tsc --noEmit` 0 error; `expo export -p web` berhasil (`1103` modul); layout memakai `flexWrap`, `minWidth`, `ScrollView` untuk desktop 1280px & mobile 375px. |
| **UAT-11** | Regresi fitur Ngopi eksisting | **PASS** | `points_economy.test.ts` (10/10), `compliance.test.ts` (8/8), `merchant.test.ts` (7/7), `catur.test.ts`, dan `gapleh_partnership.test.ts` lulus. |

