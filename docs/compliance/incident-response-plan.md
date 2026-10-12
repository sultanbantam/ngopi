# Rencana Tanggap Insiden Keamanan Siber (Incident Response Plan)
**Standar Regulasi:** UU PDP No. 27/2022 Pasal 46 & ISO/IEC 27035  
**Klasifikasi:** Standar Operasional Prosedur Darurat Siber (SOP)  
**Tahun:** 2026 | **Pengendali:** PT Ngopi Kreasi Digital  

---

## 1. Tujuan dan Ruang Lingkup
Memberikan panduan tindakan sistematis dan cepat bagi Tim Tanggap Insiden Keamanan Siber (CSIRT) Ngopi dalam mengidentifikasi, mengisolasi, memitigasi, dan memulihkan insiden kebocoran data pribadi atau peretasan infrastruktur sistem.

## 2. Tim Tanggap Insiden (Incident Response Team)
- **Komandan Insiden (Incident Commander)**: CTO / Head of Engineering.
- **Pejabat Perlindungan Data (DPO)**: Penanggung jawab notifikasi regulasi dan komunikasi publik.
- **Lead Security Analyst**: Investigasi forensik digital dan isolasi vektor serangan.
- **Lead DevOps Engineer**: Pemulihan sistem dan audit integritas cadangan data.

## 3. Fase Tanggap Insiden
### Fase 1: Identifikasi & Triase (Jam ke-0 s.d. 6)
1. Deteksi anomali melalui sistem monitoring log atau laporan pihak ketiga.
2. Penentuan tingkat keparahan insiden (Rendah / Sedang / Tinggi / Kritis).
3. Penerbitan tiket insiden darurat internal (`reportSecurityIncident`).

### Fase 2: Penahanan & Isolasi (Jam ke-6 s.d. 18)
1. Isolasi server atau node yang terkompromi dari jaringan utama.
2. Rotasi darurat seluruh credential, database secret, API key, dan JWT secret.
3. Pemblokiran IP penyerang pada level firewall/Cloudflare.

### Fase 3: Pemulihan & Pembersihan (Jam ke-18 s.d. 36)
1. Penutupan celah keamanan (*patching vulnerabilities*).
2. Verifikasi integritas data dari snapshot cadangan bersih terakhir.
3. Uji penetrasi kilat sebelum mengembalikan sistem ke lalu lintas publik.

### Fase 4: Notifikasi Wajib 3 x 24 Jam (Jam ke-36 s.d. 72)
Sesuai **Pasal 46 UU No. 27/2022 (UU PDP)**, jika kegagalan perlindungan data pribadi melibatkan data pribadi pengguna:
1. Pengendali data wajib menyampaikan pemberitahuan tertulis kepada:
   - **Kementerian Komunikasi dan Informatika / Lembaga Pengawas PDP**: Laporan teknis rincian insiden, jumlah data terdampak, dan langkah mitigasi yang telah diambil.
   - **Pengguna Terdampak**: Pemberitahuan transparan melalui email / banner aplikasi mengenai data apa yang berpotensi terdampak dan langkah pencegahan yang harus dilakukan (misal: ubah password).
2. **Batas Waktu Maksimal**: Paling lambat **3 x 24 jam (72 jam)** sejak insiden terkonfirmasi.

### Fase 5: Evaluasi Pasca-Insiden (Post-Mortem)
Penyusunan laporan evaluasi menyeluruh (*Lessons Learned Report*) dalam waktu 7 hari kerja untuk mencegah kejadian serupa terulang kembali.
