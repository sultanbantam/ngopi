# Rencana Keberlangsungan Bisnis (Business Continuity Plan) & DRP
**Standar Kepatuhan:** ISO 22301 & ISO/IEC 27001 Control A.8.14  
**Tahun:** 2026 | **Pengendali:** PT Ngopi Kreasi Digital  

---

## 1. Tujuan
Memastikan keberlanjutan operasional layanan komunikasi dan komunitas Ngopi saat terjadi gangguan katastropik, pemadaman listrik massal, putusnya jaringan internet pusat, atau kegagalan pusat data.

## 2. Parameter Target Pemulihan (RTO & RPO)
- **Recovery Time Objective (RTO)**: Target waktu sistem kembali menyala adalah **< 2 jam** untuk layanan obrolan utama dan **< 4 jam** untuk seluruh ekosistem game dan Web3.
- **Recovery Point Objective (RPO)**: Maksimum data hilang adalah **< 15 menit** melalui replikasi *Point-in-Time Recovery* (PITR) pada database.

## 3. Strategi Keberlangsungan Khusus: Bluetooth Mesh Offline Fallback
Salah satu keunggulan arsitektur Ngopi dalam BCP adalah **kemampuan bertahan tanpa internet (Offline Survivability)**:
1. Saat jaringan internet pusat mengalami pemadaman (blackout), pengguna di warung kopi tetap dapat berkomunikasi secara lokal melalui jaringan **Bluetooth Low Energy (BLE) Mesh P2P**.
2. Fitur *Store-and-Forward* menampung pesan transaksi lokal hingga koneksi internet server kembali pulih.
3. Sinkronisasi otomatis batch (`POST /api/mesh/sync`) secara aman merekonsiliasi percakapan offline ke database pusat saat jaringan menyala kembali.

## 4. Disaster Recovery Site (DRS)
- Replikasi basis data aktif ke penyedia komputasi cloud sekunder di wilayah geografis berbeda (multi-region availability).
- Pengalihan DNS otomatis via Cloudflare health-check routing saat server primer tidak merespons dalam 60 detik.
