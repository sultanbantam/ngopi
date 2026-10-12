# Kebijakan Perlindungan Data Pribadi (Data Protection Policy)
**Standar Kepatuhan:** UU No. 27/2022 (UU PDP) & PP No. 71/2019 (PP PSTE)  
**Dokumen Internal & Eksternal Organisasi**  
**Versi:** 3.0-2026 | **Klasifikasi:** Dokumen Tata Kelola Kepatuhan  

---

## 1. Tujuan Kebijakan
Menetapkan tata kelola operasional dan teknis bagi seluruh karyawan, sistem, dan pengembang PT Ngopi Kreasi Digital dalam memperlakukan, menyimpan, dan memproses data pribadi pengguna secara aman, sah, dan akuntabel.

## 2. Struktur Tata Kelola & Peran DPO
1. **Pejabat Perlindungan Data (Data Protection Officer - DPO)**:
   - Bertanggung jawab memantau kepatuhan pemrosesan data terhadap UU PDP.
   - Menjadi titik kontak tunggal bagi subjek data dan otoritas pengawas Kominfo.
   - Mengawasi pelaksanaan Penilaian Dampak Perlindungan Data (DPIA).
2. **Tim Rekayasa Perangkat Lunak (Engineering)**:
   - Menerapkan prinsip *Privacy by Design* dan *Privacy by Default* pada seluruh fitur baru.
   - Memastikan enkripsi end-to-end (E2EE) tidak memiliki *backdoor*.

## 3. Prosedur Pemenuhan Hak Subjek Data (SLA Pemenuhan)
1. **Permintaan Akses & Ekspor Data (`GET /api/user/export`)**:
   - Pemenuhan otomatis instan via endpoint terenkripsi (maksimal SLA 1 x 24 jam jika ada kendala sistem).
2. **Permintaan Koreksi Data**:
   - Pengguna dapat memperbarui display name dan avatar langsung dari menu profil secara real-time.
3. **Permintaan Penghapusan Data (`DELETE /api/user/delete`)**:
   - Akun masuk masa tenggang 30 hari.
   - Jika pengguna tidak membatalkan dalam 30 hari, seluruh relasi database dipurging permanen secara otomatis (*hard delete*).

## 4. Keamanan Teknis Perlindungan Data (Technical Safeguards)
- **Kriptografi Komunikasi**: X25519 Elliptic Curve Diffie-Hellman + TweetNaCl untuk negosiasi kunci obrolan, dan AES-256-GCM untuk enkripsi simetris konten pesan.
- **Kriptografi At-Rest**: Data token rahasia dan session disimpan terenkripsi.
- **Pencatatan Audit Trail**: Setiap akses terhadap data pribadi dicatat dalam tabel audit log (`AuditLogEntry`) yang tidak dapat dimanipulasi (*immutable logs*).
- **Pembatasan Akses Karyawan**: Akses basis data produksi dibatasi hanya kepada authorized DevOps dengan otentikasi multi-faktor (MFA).

## 5. Pelatihan & Disiplin Organisasi
Seluruh pengembang dan staf operasional diwajibkan mengikuti pelatihan kesadaran privasi data tahunan mengenai regulasi perlindungan data pribadi dan sanksi pidana/denda UU PDP.
