# NGOPINOMIC — STAGING TEST PLAN

**Tujuan:** Memvalidasi seluruh alur NGOPINOMIC pada lingkungan staging terpisah (PostgreSQL staging + API staging + Frontend staging) sebelum pertimbangan rilis produksi.

## 1. Prasyarat Lingkungan Staging
- Database PostgreSQL staging terpisah dari produksi (`DATABASE_URL` staging).
- Jalankan `npx prisma migrate deploy` pada database staging.
- Set `NGOPINOMIC_ALLOW_MOCK_PAYMENT=true` **khusus** pada environment staging (dilarang di produksi sebelum PJP resmi terhubung).
- Pastikan `bmc_utility_enabled=false` (mode `configuration_only`).

## 2. Skenario Uji Integrasi Staging
1. **Migrasi & Idempoten:** Verifikasi seluruh 18 tabel `ngopinomic_*` terbentuk dan `prisma migrate status` bersih.
2. **Identitas & Anti-Duplikasi:** Login 2 akun uji (`user_normal`, `user_admin`), buka `/ngopinomic`, pastikan masing-masing mendapat tepat 1 `UserIdentity` (`ngp_...`) tanpa duplikasi saat refresh.
3. **Poin & Idempotensi:** Klik "Check-in Harian (+10)" 2x berturut-turut; pastikan saldo hanya bertambah `+10` dan permintaan kedua berstatus idempoten.
4. **Referral & Komisi Bersih:** Daftarkan kode referral `user_normal` di akun uji lain, lakukan pembelian dengan `mock_test_provider`, verifikasi `CommissionTransaction` berstatus `pending` dan dihitung dari **Pendapatan Bersih yang Dapat Dibagikan (Dasar Komisi Bersih)**.
5. **Concurrence / Race Condition:** Simulasikan 2 request paralel untuk ID Premium yang sama; pastikan hanya 1 yang berhasil (`Active`) dan 1 ditolak.
6. **Reversal & Refund:** Panggil `POST /api/ngopinomic/admin/transactions/:txId/reverse` sebagai admin; pastikan terbentuk entri `refund_reversal` baru dan komisi `pending` kembali ke `0`.
7. **Keamanan & RBAC:** Coba akses `/api/ngopinomic/admin/config` dengan JWT `user` biasa → wajib `403`.
8. **Tampilan Desktop & Mobile (Responsive):** Uji `/ngopinomic` dan `/admin/ngopinomic` pada viewport desktop (`1280px`) dan mobile (`375px`) — pastikan kartu grid membungkus rapi (*flexWrap*), teks terbaca jelas, dan tombol tidak terpotong.
9. **Regresi Fitur Eksisting:** Verifikasi Chat, Ngopi Mail internal, Game Catur/Gapleh, dan Merchant Dashboard tetap berjalan normal.

