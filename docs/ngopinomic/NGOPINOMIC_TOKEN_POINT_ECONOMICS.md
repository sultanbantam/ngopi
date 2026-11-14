# NGOPINOMIC TOKEN & POINT ECONOMICS
## Model Ekonomi Tiga Instrumen, Identitas Premium, Afiliasi Bersih, dan Simulasi Skala

**Dokumen:** 2 dari 4 (Master Deliverables NGOPINOMIC)  
**Platform:** Ngopi (`https://ngopi.top`) | **Ekosistem:** BaMbooChain (`https://bamboochain.id`)  
**Status:** Desain Ekonomi & Parameter Konfigurasi Awal

---

## 1. Prinsip Pemisahan Tiga Instrumen Ekonomi

NGOPINOMIC memisahkan secara tegas tiga instrumen ekonomi agar tidak terjadi pencampuran saldo, salah tafsir nilai, maupun risiko kepatuhan regulasi:

| Instrumen | Sifat | Fungsi Utama | Batasan Tegas |
|---|---|---|---|
| **Poin Ngopi** | Poin loyalitas & apresiasi non-tunai | Hadiah aktivitas sah, penukaran fitur/identitas yang memenuhi syarat | **Bukan** Rupiah, **bukan** uang elektronik, **tidak** otomatis setara kas atau BMC |
| **BMC** | Token utilitas ekosistem BaMbooChain | Akses manfaat ekosistem, fitur premium, integrasi mitra BaMbooChain & BoomBoom yang disetujui | Terpisah dari Poin Ngopi & Rupiah; **bukan** alat pembayaran sah Rupiah & **bukan** produk investasi |
| **Rupiah (IDR)** | Mata uang resmi Republik Indonesia | Pembelian ID/Email Premium, layanan berbayar, penyelesaian komisi afiliasi yang memenuhi syarat | Diproses melalui Penyelenggara Jasa Pembayaran (PJP) berizin; tanpa penyimpanan kredensial pembayaran sensitif |

---

## 2. A. NGOPI POINTS (Poin Ngopi)

### 2.1 Aktivitas Perolehan yang Sah
1. Check-in harian (*daily streak*).
2. Bermain gim resmi Ngopi (hanya divalidasi oleh server meja permainan).
3. Mengundang pengguna baru (*referral* terverifikasi).
4. Menyelesaikan referral terverifikasi dengan transaksi atau aktivitas valid.
5. Menggunakan layanan Ngopi yang memenuhi syarat.
6. Berkontribusi pada konten atau kegiatan komunitas resmi.
7. Berpartisipasi dalam kampanye atau misi komunitas terjadwal.
8. Menyelesaikan tugas ekosistem yang disetujui admin.

### 2.2 Aturan Tata Kelola Poin Ngopi
- **Aturan Jelas & Tercatat:** Setiap perolehan dan pemakaian poin wajib menghasilkan satu entri transaksi pada buku besar *append-only* (`PointsTransaction`) dengan referensi unik dan *idempotency key*.
- **Anti-Duplikasi & Anti-Bot:** Permintaan ganda (*duplicate request*), skrip otomatis, akun palsu, atau manipulasi jam tidak dapat menghasilkan poin.
- **Tidak Otomatis Setara Rupiah / BMC:** Poin Ngopi tidak memiliki nilai tukar tetap terhadap Rupiah maupun BMC. Pencairan tunai tidak dijanjikan dan tidak diasumsikan.
- **Masa Berlaku & Penukaran:** Masa kedaluwarsa poin (jika diberlakukan) dan daftar katalog penukaran wajib diumumkan secara jelas di Pusat Aturan & Transparansi.
- **Kontrol Admin:** Administrator dapat mengubah batas harian perolehan poin, bobot kampanye, serta status aktif/nonaktif setiap jenis aktivitas dari Admin Control Center.

---

## 3. B. BMC (BaMbooChain Utility Token)

### 3.1 Utilitas yang Direncanakan
- Akses transaksi/layanan ekosistem BaMbooChain yang memenuhi syarat.
- Manfaat keanggotaan ekosistem dan fitur premium terpilih.
- Layanan *marketplace* ekosistem yang disetujui.
- Integrasi dukungan mitra BoomBoom dan BaMbooChain Academy/Tracker yang telah lolos verifikasi.

### 3.2 Batasan Kepatuhan BMC
- Saldo/manfaat BMC dicatat terpisah dari Poin Ngopi dan Rupiah.
- BMC tidak diasumsikan sebagai alat pembayaran resmi di Indonesia maupun produk investasi.
- Setiap aktivasi transaksi token, kustodi, pertukaran (*swap*), atau penukaran (*redemption*) **wajib** melalui mode konfigurasi terkendali (*controlled/configuration-only mode*) sampai tinjauan hukum Indonesia (OJK/Bappebti/BI sesuai kewenangan) selesai dan izin operasional terpenuhi.

---

## 4. C. RUPIAH (IDR)

Rupiah digunakan untuk:
- Pembelian **ID Ngopi Premium**.
- Pembelian **Email Ngopi Premium**.
- Pembelian layanan Ngopi atau paket merchant yang sah.
- Pembayaran layanan mitra resmi.
- Penyelesaian (*settlement*) komisi afiliasi apabila pengguna memilih opsi Rupiah dan memenuhi syarat program serta perpajakan.

Seluruh pemrosesan Rupiah wajib menggunakan penyedia jasa pembayaran (PJP) resmi yang patuh aturan Bank Indonesia, tanpa menyimpan nomor kartu, PIN, atau kredensial sensitif di basis data Ngopi.

---

## 5. D. EKONOMI IDENTITAS DIGITAL PREMIUM

### 5.1 Kategori Produk
1. **ID Ngopi Premium:** Identitas/handle/nomor pilihan unik (contoh: `kopi`, `warung`, `sultan`, `banten`).
2. **Email Ngopi Premium:** Alamat email pilihan `@ngopi.top` (contoh: `kopi@ngopi.top`, `warung@ngopi.top`, `sultan@ngopi.top`).

> **Jaminan Inklusivitas:** Identitas dasar gratis tetap selalu tersedia bagi setiap pengguna baru agar adopsi komunitas tidak terhambat.

### 5.2 Tingkatan Kelangkaan (*Rarity Tiers*) & Konfigurasi Harga
Harga **tidak boleh** di-hardcode permanen di aplikasi; seluruh harga disimpan di konfigurasi basis data dan dikelola dari Admin Control Center. Contoh parameter awal (*configurable defaults*):

| Rarity Tier | Contoh Pola | Harga Awal ID Premium (IDR) | Harga Awal Email Premium (IDR) | Opsi Poin Ngopi (Jika Aktif) |
|---|---|---|---|---|
| `Regular` | Nama umum / 5+ karakter | Rp25.000 | Rp25.000 | 2.500 Poin |
| `Silver` | Nama usaha / 4 karakter | Rp75.000 | Rp75.000 | 7.500 Poin |
| `Gold` | Kata populer (`kopi`, `warung`) | Rp250.000 | Rp250.000 | 25.000 Poin |
| `Platinum` | Kata ikonik (`sultan`, `banten`) | Rp750.000 | Rp750.000 | Tidak tersedia / Khusus |
| `Signature` | Identitas eksklusif / kurasi khusus | Rp2.000.000+ | Rp2.000.000+ | Tidak tersedia / Khusus |

### 5.3 Siklus Status Inventaris Tunggal
Setiap item inventaris ID/Email Premium memiliki tepat satu status aktif:
- `Available` — Tersedia untuk dipesan.
- `Reserved` — Sedang dikunci sementara dalam proses pembayaran (dengan batas waktu TTL).
- `Sold` — Pembayaran lunas, menunggu aktivasi final.
- `Active` — Dimiliki dan aktif digunakan oleh satu `user_id` terverifikasi.
- `Frozen` — Dibekukan sementara oleh admin karena sengketa, investigasi kecurangan, atau pelanggaran.
- `Returned` — Dikembalikan ke inventaris atau dilepas kembali sesuai kebijakan.

Sistem menerapkan *unique constraint* pada `(identity_type, normalized_value)` dan penguncian transaksi atomik DB untuk mencegah penjualan ganda atau transfer tidak sah.

---

## 6. E. EKONOMI AFILIASI DAN KOMISI

### 6.1 Tarif Default Terkonfigurasi (Bukan Hak Mutlak)
- **Direct Affiliate (Tingkat 1):** `20%`
- **Second-Level Referral (Tingkat 2):** `5%`
- **Ambassador Bonus:** hingga `5%`
- **Campaign Promoter:** dapat diatur `5%` – `10%`
- **Plafon Maksimal Total Komisi (*Max Total Cap*):** default `35%` dari **Pendapatan Bersih yang Dapat Dibagikan (Dasar Komisi Bersih)** (dapat diubah admin).

### 6.2 Rumus Wajib: Pendapatan Bersih yang Dapat Dibagikan (Dasar Komisi Bersih)

Semua komisi afiliasi **wajib** dihitung dari **Pendapatan Bersih yang Dapat Dibagikan (Dasar Komisi Bersih)**, **bukan** dari nilai transaksi kotor (*gross transaction value*).

```text
Pendapatan Bersih yang Dapat Dibagikan (Dasar Komisi Bersih) =
  Gross Revenue
  - Applicable Taxes
  - Payment and Service Fees
  - Infrastructure Costs Allocated to the Transaction
  - Refund / Chargeback (Cadangan Awal ATAU Refund Aktual — tidak boleh dipotong ganda)
  - Other Direct Operational Costs
  - Other Approved Transaction Costs
```

**Perlakuan Akuntansi Cadangan Refund vs Refund Aktual:**
- **Cadangan Refund/Chargeback (*Refund Reserve*):** Penyisihan persentase terukur (mis. `4%`) saat transaksi dicatat agar komisi berstatus `pending` tidak melebihi kapasitas kas bersih sebelum masa tunggu berakhir.
- **Refund/Chargeback Aktual (*Actual Refund*):** Apabila transaksi benar-benar dibatalkan atau dikembalikan, nilai transaksi dibalik penuh dan komisi terkait dibatalkan melalui entri pembalik (*reversal entry*) pada buku besar *append-only*. Cadangan refund tidak pernah dipotong dua kali terhadap transaksi yang sama.

Hanya nilai sisa positif (`> 0`) yang dapat menjadi dasar perhitungan komisi. Jika hasilnya `<= 0`, maka total komisi adalah `Rp0`.

### 6.3 Contoh Perhitungan Resmi

- **Gross Transaction:** `Rp100.000`
- **Pengurangan Terdokumentasi (Ilustratif):**
  - Applicable Taxes: `Rp10.000`
  - Payment / Service Fees: `Rp2.000`
  - Infrastructure Allocation: `Rp3.000`
  - Refund / Chargeback Reserve: `Rp5.000`
  - Other Direct Operational Costs: `Rp10.000`
  - **Total Pengurangan:** `Rp30.000`
- **Pendapatan Bersih yang Dapat Dibagikan (Dasar Komisi Bersih):** `Rp100.000 - Rp30.000 = Rp70.000`
- **Direct Affiliate Rate (20%):** `20% × Rp70.000 = Rp14.000` (bukan `20% × Rp100.000 = Rp20.000`).

### 6.4 Sebelas Aturan Wajib Perhitungan Komisi
1. Gunakan biaya aktual atau metode alokasi biaya yang disetujui, bukan potongan sewenang-wenang.
2. Dokumentasikan metode alokasi biaya secara jelas di aturan sistem.
3. Jangan pernah memotong komponen biaya yang sama dua kali (*no double deduction*).
4. Jika *Net Distributable Revenue* bernilai nol atau negatif, komisi = `0`.
5. Komisi dicatat berstatus `pending` sampai transaksi selesai (*settled*) dan masa tunggu *refund/chargeback* berakhir.
6. Transaksi yang dibatalkan, di-*refund*, terindikasi fraud, atau dibalik (*reversed*) **tidak** menghasilkan komisi yang dapat dibayarkan.
7. Pembatalan/pembalikan wajib dicatat sebagai entri buku besar baru (*reversal entry*), tidak boleh menghapus catatan historis.
8. Jika beberapa kategori komisi berlaku pada satu transaksi, totalnya wajib mematuhi batas maksimal (*max total commission rate*) yang dikonfigurasi.
9. Tidak mengizinkan rantai komisi perekrutan bertingkat tanpa batas (*unlimited multi-level*).
10. Komisi wajib berasal dari transaksi produk atau layanan nyata, bukan semata-mata dari pendaftaran anggota baru.
11. Rincian dasar perhitungan (nilai kotor, pengurangan, dasar bersih, persentase, dan hasil komisi) ditampilkan secara transparan kepada pengguna.

---

## 7. F. OPSI PENCAIRAN KOMISI AFILIASI

Pengguna afiliasi dapat memilih preferensi penerimaan komisi yang memenuhi syarat:
1. **Rupiah (IDR):** Masuk ke saldo komisi terverifikasi untuk penarikan sesuai batas minimum, verifikasi identitas, dan ketentuan pajak/hukum.
2. **Poin Ngopi:** Dikonversi ke Poin Ngopi sesuai rasio program yang ditetapkan admin (dengan pemberitahuan tegas bahwa Poin Ngopi tidak setara uang tunai).

---

## 8. G. SIMULASI KEUANGAN (ASUMSI KONFIGURABLE VS DATA AKTUAL)

> **Catatan Penting:** Seluruh angka di bawah ini adalah **simulasi berbasis asumsi awal (*illustrative projection*)**, bukan data keuangan aktual dan bukan proyeksi pendapatan yang dijamin.

### Asumsi Dasar Simulasi (Dapat Diubah Admin)
- Konversi pembeli ID Ngopi Premium: `3%` dari total pengguna, rata-rata harga kotor `Rp120.000`.
- Konversi pembeli Email Ngopi Premium: `2%` dari total pengguna, rata-rata harga kotor `Rp100.000`.
- Struktur biaya rata-rata terhadap Gross Revenue:
  - Pajak: `11%`
  - Biaya pembayaran & layanan: `2%`
  - Alokasi infrastruktur: `3%`
  - Cadangan *refund/chargeback*: `4%`
  - Biaya operasional langsung lain: `10%`
  - Total pengurangan: `30%` → **Net Distributable Revenue = 70% dari Gross Revenue**.
- Rata-rata rasio komisi efektif dari Net Distributable Revenue (gabungan transaksi dengan dan tanpa afiliator): `22%` dari Net Distributable Revenue.
- Poin Ngopi diterbitkan rata-rata `150 poin/pengguna aktif/bulan` (akumulasi tahunan disimulasikan per periode), tingkat penukaran (*redemption*) `35%`.
- Aktivitas utilitas BMC (mode uji/proyeksi transaksi fitur): rata-rata `5%` pengguna berinteraksi dengan manfaat BMC per periode.

### Tabel Simulasi Skala Pengguna (Per Periode / Siklus Pertumbuhan)

| Metrik (IDR kecuali disebut) | 1.000 Pengguna | 10.000 Pengguna | 100.000 Pengguna | 1.000.000 Pengguna |
|---|---|---|---|---|
| **Pembeli ID Premium (3%)** | 30 trx | 300 trx | 3.000 trx | 30.000 trx |
| **Penjualan ID Premium (Gross)** | Rp3.600.000 | Rp36.000.000 | Rp360.000.000 | Rp3.600.000.000 |
| **Pembeli Email Premium (2%)** | 20 trx | 200 trx | 2.000 trx | 20.000 trx |
| **Penjualan Email Premium (Gross)** | Rp2.000.000 | Rp20.000.000 | Rp200.000.000 | Rp2.000.000.000 |
| **Total Gross Revenue** | **Rp5.600.000** | **Rp56.000.000** | **Rp560.000.000** | **Rp5.600.000.000** |
| **Pajak & Biaya Transaksi (13%)** | -Rp728.000 | -Rp7.280.000 | -Rp72.800.000 | -Rp728.000.000 |
| **Alokasi Infrastruktur (3%)** | -Rp168.000 | -Rp1.680.000 | -Rp16.800.000 | -Rp168.000.000 |
| **Cadangan Refund (4%)** | -Rp224.000 | -Rp2.240.000 | -Rp22.400.000 | -Rp224.000.000 |
| **Biaya Ops Langsung Lain (10%)** | -Rp560.000 | -Rp5.600.000 | -Rp56.000.000 | -Rp560.000.000 |
| **Net Distributable Revenue (70%)** | **Rp3.920.000** | **Rp39.200.000** | **Rp392.000.000** | **Rp3.920.000.000** |
| **Komisi Afiliasi Efektif (22% NDR)** | Rp862.400 | Rp8.624.000 | Rp86.240.000 | Rp862.400.000 |
| **Pendapatan Bersih Platform (78% NDR)** | **Rp3.057.600** | **Rp30.576.000** | **Rp305.760.000** | **Rp3.057.600.000** |
| **Poin Ngopi Diterbitkan** | 150.000 poin | 1.500.000 poin | 15.000.000 poin | 150.000.000 poin |
| **Poin Ngopi Ditukar (35%)** | 52.500 poin | 525.000 poin | 5.250.000 poin | 52.500.000 poin |
| **Pengguna Aktif Utilitas BMC (5%)** | 50 akun | 500 akun | 5.000 akun | 50.000 akun |

Semua angka di atas wajib dibedakan dari **Data Keuangan Aktual** yang ditarik langsung dari `LedgerTransaction`, `CommissionTransaction`, `PointsTransaction`, dan `IdentityOrder` di basis data produksi.

