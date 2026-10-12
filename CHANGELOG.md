# CHANGELOG — Ngopi (v3.0)

## [Ngopi v3.0 - Sprint 9] - 2026-10-12

### Anti-Spam & Moderasi AI: Pertahanan Berlapis (Defense in Depth) (ngopiv3.md)
- **Sprint 9: Anti-Spam & Moderasi AI**:
  - **Arsitektur Pertahanan 5 Lapis (`moderation.types.ts` & `moderation.service.ts`)**:
    - **Lapisan 1: Rate Limiting Sisi Server**:
      - Throttling pesan chat: Maksimum 10 pesan/detik (burst anti-flooding), 60 pesan/menit, dan 500 pesan/jam.
      - Throttling perpindahan warkop: Maksimum 3 join warkop/menit (anti room-hopping).
      - Throttling upload file: Maksimum 20 upload/jam.
    - **Lapisan 2: Filter Heuristik Pre-AI & Deduplikasi Hash**:
      - Deteksi multi-link: Pemblokiran pesan dengan 3+ link web sekaligus.
      - Deteksi repetisi karakter: Pemblokiran string karakter berulang >= 20 karakter identik berurutan (`aaaaaaaaa...`).
      - Deteksi karakter zero-width: Pencegahan bypass filter via karakter tak terlihat (`\u200B-\u200D\uFEFF`).
      - Deteksi pengulangan kata berulang 3x berurutan.
      - Mention spam: Maksimum 5 mention `@user` per pesan.
      - Emoji flood: Maksimum 30 emoji dalam satu pesan.
      - Deduplikasi SHA-256 Hash: Cache deteksi pesan duplikat identik dalam rentang waktu 5 menit. Memblokir pengiriman lebih dari 3 kali.
    - **Lapisan 3: Agen AI Klasifikasi Konten (Toxicity & Harassment)**:
      - Klasifikasi semantik konten berbahasa Indonesia untuk mendeteksi bahaya:
        - Promosi Judi Slot Online / Togel liar (`judi slot`, `slot gacor`, `zeus slot`, dll).
        - Konten seksual eksplisit & prostitusi online (`open bo`, `vcs`, `bokep`, dll).
        - Ujaran kebencian & pelecehan (`hate speech`).
        - Penipuan finansial & scam.
      - Skor probabilitas keyakinan AI dengan aksi tindakan terarah.
    - **Lapisan 4: Matriks Eskalasi Pelanggaran Progresif**:
      - Pelanggaran ke-1: **Peringatan Ringan (Warning)**.
      - Pelanggaran ke-2: **Pembisuan Sementara (Mute 1 Jam)**.
      - Pelanggaran ke-3: **Dikeluarkan dari Warkop (Kick)**.
      - Pelanggaran ke-4: **Pembekuan Akun Sementara (Ban 7 Hari)**.
      - Pelanggaran Kritis Berulang / Bot Judi: **Daftar Hitam Permanen (Blacklist)** berbasis User ID & IP Address.
    - **Lapisan 5: Pipeline Moderasi Real-time Server & Integrasi Socket.IO**:
      - Pengecekan terintegrasi langsung pada `chat.handler.ts` saat `send_message` dan `join_room`.
      - Penolakan pesan dengan event real-time `moderation_blocked` dan detail alasan.
  - **Layanan REST API Moderasi (`moderation.routes.ts`)**:
    - `POST /api/moderation/check`: Pemeriksaan pre-flight teks pesan terhadap 5 lapisan filter.
    - `POST /api/moderation/report`: Pelaporan pengguna atau pesan mencurigakan oleh anggota warkop.
    - `GET /api/moderation/status/me`: Pengecekan status hukuman aktif (mute, ban, blacklist, riwayat peringatan).
    - `GET /api/moderation/status/:userId`: Pengecekan status moderasi pengguna tertentu bagi admin.
    - `GET /api/moderation/queue`: Antrean laporan pending untuk ditinjau (*Review Queue*).
    - `POST /api/moderation/queue/:id/resolve`: Penyelesaian laporan oleh admin (warning, mute, kick, ban, blacklist, dismiss).
    - `GET /api/moderation/blacklist`, `POST /api/moderation/blacklist`, `DELETE /api/moderation/blacklist/:userId`: Manajemen daftar hitam pengguna & IP.
    - Mounted di `backend/src/index.ts` pada `/api/moderation`.
  - **Unit Test Komprehensif**:
    - 9 test cases lulus 100% (`tests/moderation.test.ts`), memverifikasi rate limiting, aturan heuristik pre-AI, SHA-256 hash flood protection, klasifikasi AI judi & toxic, eskalasi penalti progresif, pipeline server-side `moderateMessage`, pelaporan pengguna, serta manajemen blacklist & pembersihan berkala cache hash.
  - **Komponen UI Frontend (`ModerationAlertModal.tsx`)**:
    - Modal popup interaktif dengan lencana tingkat hukuman (Warning, Mute, Kick, Ban, Blacklist) dan penjelasan dari AI.
    - Formulir dialog pelaporan pengguna yang terintegrasi langsung ke backend REST API.
    - Terpasang secara global pada [`frontend/app/(main)/_layout.tsx`](file:///c:/Users/dummy/Documents/Projects/ngopi/frontend/app/(main)/_layout.tsx).

### Kepatuhan Regulasi Indonesia: UU PDP No. 27/2022, PSE Kominfo & ISO 27001 (ngopiv3.md)
- **Sprint 8: Kepatuhan Regulasi & Perlindungan Data Pribadi**:
  - **Paket Kebijakan Tata Kelola Legal & Kepatuhan (`docs/compliance/`)**:
    - `privacy-policy.md`: Kebijakan Privasi komprehensif mengacu pada UU PDP No. 27/2022, perlakuan data identitas, minimisasi data (tanpa nomor HP), dan pemrosesan transparan.
    - `terms-of-service.md`: Ketentuan Layanan penggunaan warkop digital, kepatuhan etika, dan batasan tanggung jawab.
    - `data-protection-policy.md`: Standar operasional prosedur internal perlindungan data pribadi dan peran Pejabat Perlindungan Data (DPO).
    - `information-security-policy.md`: Kebijakan Keamanan Informasi berstandar SNI ISO/IEC 27001:2022.
    - `incident-response-plan.md`: SOP Tim Tanggap Insiden Keamanan Siber (CSIRT) dengan kewajiban notifikasi kebocoran data dalam **3 x 24 jam (72 jam)** ke Kominfo & subjek data (UU PDP Pasal 46).
    - `business-continuity-plan.md`: Rencana Keberlangsungan Bisnis (BCP/DRP) dengan keunggulan ketahanan jaringan offline Bluetooth LE Mesh.
    - `statement-of-applicability.md`: Statement of Applicability (SoA) untuk kontrol keamanan ISO 27001:2022 (A.5.15, A.8.12, A.8.14, A.8.16, A.8.24, dll).
    - `gap-assessment.md`: Hasil evaluasi kesiapan kepatuhan skor **96/100 (SIAP & PATUH PENUH)**.
  - **Layanan Backend & Hak Subjek Data (`compliance.service.ts` & `compliance.routes.ts`)**:
    - **Consent Management**: Pencatatan persetujuan eksplisit pengguna dengan timestamp, alamat IP, dan pelacakan versi kebijakan (`POST /api/compliance/consent` & `GET /api/compliance/consent/status`).
    - **Hak Portabilitas & Akses Data (Pasal 7 & 8)**: Endpoint `GET /api/user/export` untuk mengunduh seluruh data pengguna (profil, riwayat Poin Ngopi, kartu TCG, event, audit trail) dalam arsip JSON terstruktur.
    - **Hak Penghapusan / Right to be Forgotten (Pasal 9)**: Endpoint `DELETE /api/user/delete` dengan masa tenggang aman (*grace period*) 30 hari dan pembatalan pemulihan (`POST /api/user/cancel-deletion`).
    - **Pencatatan Audit Trail Immutable (ISO 27001 A.8.16)**: Pelacakan seluruh aksi sensitif (`CONSENT_GRANTED`, `DATA_EXPORT`, `ACCOUNT_DELETE_REQUESTED`, `ACCOUNT_DELETE_CANCELLED`).
    - **Sistem Deteksi Insiden & Notifikasi 3x24 Jam**: Pelaporan insiden keamanan dengan kalkulasi otomatis tenggat waktu notifikasi 72 jam ke Kominfo dan DPO (`dpo@ngopi.top`).
  - **API REST Endpoints**:
    - Mounted pada `/api/compliance` dan alias `/api/user`.
  - **Unit Test Komprehensif**: 8 test cases lulus 100% (`tests/compliance.test.ts`), memvalidasi consent lifecycle, re-consent versi baru, data export, 30-day grace period delete, pembatalan penghapusan, audit logging, dan 72-hour breach deadline.
  - **UI Frontend**:
    - `ConsentBannerModal.tsx`: Modal persetujuan eksplisit saat pertama kali masuk ke aplikasi.
    - `PrivacyModal.tsx`: Tampilan tab Kebijakan Privasi, Ketentuan Layanan, dan Hak Data (tombol Ekspor Data JSON & Hapus Akun 30 Hari).
    - Terpasang global pada root layout [`_layout.tsx`](file:///c:/Users/dummy/Documents/Projects/ngopi/frontend/app/(main)/_layout.tsx).

## [Ngopi v3.0 - Sprint 7] - 2026-10-12

### Ekonomi BMC: Fitur Premium, Poin Ngopi & Ruang Bioskop (ngopiv3.md)
- **Sprint 7: Ekonomi BMC (Fitur Premium & Poin Ngopi)**:
  - **Arsitektur Dua Lapis Ekonomi (`points.types.ts` & `points.service.ts`)**:
    - **Lapis 1 — Poin Ngopi (Off-Chain)**: Mata uang reward aktivitas interaksi di warkop digital.
    - **Lapis 2 — Token BMC (On-Chain di Bamboochain)**: Token crypto desentralisasi nyata untuk transaksi premium dan likuiditas Web3.
  - **Mekanisme Perolehan Poin Komunitas**:
    - Kirim pesan obrolan: `+1 Poin` (dibatasi maksimum 50 poin/hari).
    - Mendapatkan reaksi teman: `+2 Poin` (dibatasi maksimum 20 poin/hari).
    - Membantu kawan warkop (tanya-jawab): `+5 Poin`.
    - Menyelesaikan pertandingan game: `+10 Poin`.
    - Memenangkan game warkop: `+25 Poin`.
    - Login harian berturut-turut (*Daily Streak*): `+5 Poin x Hari Streak`.
    - Mengajak teman aktif (*Referral*): `+50 Poin`.
    - Menyelesaikan misi harian: `+20 Poin`.
  - **Katalog Fitur Premium Warkop**:
    - Kirim File Besar (>5MB): 20 Poin / 0.1 BMC.
    - Paket Stiker Premium Warkop: 50 Poin / 0.25 BMC.
    - Paket Kartu Monster TCG (Booster Gacha): 100 Poin / 0.5 BMC.
    - Ruang Bioskop (*Watch Party*): 100 Poin / 1.0 BMC.
    - Tema Visual Eksklusif Kayu Jati: 200 Poin / 2.0 BMC.
    - Penyimpanan Cloud Tambahan (+5GB / 30 Hari): 500 Poin / 5.0 BMC.
    - Lencana Profil Juragan Kopi: 1.000 Poin / 10.0 BMC.
    - Akses Eksklusif Fitur Beta: 2.000 Poin / 20.0 BMC.
  - **Bridge Konversi Poin ke Token BMC On-Chain**:
    - Konversi otomatis kelipatan 1.000 Poin = 1 Token BMC.
    - Validasi format wallet address Bamboochain (`0x...` 42 karakter), pemotongan saldo aman, dan pencatatan audit log transaksi.
  - **Ruang Bioskop (Watch Party)**:
    - Nonton bareng video / YouTube tersinkronisasi.
    - Kontrol playback eksklusif Host (Play, Pause, Seek).
    - Manajemen peserta join/leave dan sinkronisasi penonton warkop.
  - **API REST Endpoints (`bmc.routes.ts`)**:
    - `GET /api/bmc/points/me` — Cek saldo, streak login, dan status langganan.
    - `GET /api/bmc/points/transactions` — Riwayat transaksi & mutasi poin.
    - `POST /api/bmc/points/streak/claim` — Klaim reward streak harian.
    - `POST /api/bmc/points/earn` — Trigger perolehan poin dari berbagai aktivitas.
    - `GET /api/bmc/premium/catalog` — Daftar katalog fitur premium.
    - `POST /api/bmc/premium/buy` — Pembelian fitur menggunakan Poin Ngopi.
    - `POST /api/bmc/points/convert` — Bridge konversi Poin ke Token BMC Bamboochain.
    - `POST /api/bmc/watch-party/create` — Sewa dan inisialisasi Ruang Bioskop (100 Poin).
    - `GET /api/bmc/watch-party/list` & `GET /api/bmc/watch-party/:id` — Daftar & detail ruang bioskop aktif.
    - `POST /api/bmc/watch-party/:id/control` — Kontrol putar playback oleh host.
    - `POST /api/bmc/watch-party/:id/join` & `leave` — Masuk dan keluar ruang bioskop.
  - **Unit Test Komprehensif**: 10 test cases lulus 100% (`tests/points_economy.test.ts`), menguji inisialisasi starter bonus, batas harian chat & reaksi, reward game & helper, streak multiplier, validasi pembelian, bridge BMC on-chain, dan kontrol playback bioskop.
  - **UI Frontend (`PointsHubModal.tsx`)**:
    - Modal interaktif 4 tab (Poin & Misi, Katalog Premium, Tukar BMC, dan Bioskop Warkop).
    - Integrasi tombol koin emas (🪙) di header lobi permainan `games/index.tsx`.

## [Ngopi v3.0 - Sprint 6] - 2026-10-12

### Komunikasi Offline & Jaringan Mesh Bluetooth (ngopiv3.md)
- **Sprint 6: Mode Offline via Bluetooth (Mesh Networking)**:
  - **Model & Protokol Mesh (`mesh.types.ts`)**:
    - Entitas `MeshPeer` (peer_id, display_name, last_seen, public_key, hop_count, signal_strength, verified).
    - Entitas `MeshMessage` (id, sender_id, recipient_id, content terenkripsi E2EE, created_at, delivered, ttl 7 hari, route, file metadata).
    - Struktur paket `MeshPacket` untuk multi-hop routing (`PEER_ANNOUNCE`, `CHAT_MESSAGE`, `MESSAGE_ACK`, `SYNC_BATCH`) dengan pencegahan loop rute (`visited_peers`) dan batas hop TTL (max 5 hops).
  - **Engine Jaringan & Routing Server (`mesh.service.ts`)**:
    - Multi-hop packet routing (Local delivery, Broadcast warkop, Multi-hop relay forward).
    - **Store-and-Forward**: Penampungan pesan offline saat penerima belum terjangkau, otomatis diteruskan saat perangkat penerima masuk ke jaringan mesh.
    - **Pencegahan Loop & Deduplikasi**: Deteksi duplikasi paket via cache ID dan pencegahan infinite loop (`visited_peers`).
    - **Anti-Spam Rate Limiter**: Pembatasan ketat maksimum 10 pesan per menit per peer sesuai aturan Sprint 6.7.
    - **Verifikasi Peer Anti-MITM**: Penghitungan sidik jari SHA-256 kunci publik untuk verifikasi keaslian teman warkop.
    - **Pembersihan TTL**: Pruning otomatis pesan lokal yang telah melewati batas usia 7 hari.
    - **Sinkronisasi Otomatis Cloud (`syncOfflineBatch`)**: Penyimpanan otomatis pesan offline ke database pusat saat koneksi internet kembali pulih.
  - **API REST Endpoints (`mesh.routes.ts`)**:
    - `GET /api/mesh/peers` — Mendapatkan daftar peer terdeteksi di sekitar.
    - `POST /api/mesh/peers/announce` — Memancarkan keberadaan perangkat dan mengambil antrean store-and-forward.
    - `POST /api/mesh/verify` — Verifikasi identitas peer via sidik jari kunci publik.
    - `POST /api/mesh/packet` — Pemrosesan dan routing paket multi-hop.
    - `POST /api/mesh/sync` — Sinkronisasi kumpulan pesan offline ke server.
    - `GET /api/mesh/messages` — Riwayat pesan mesh lokal.
    - `GET /api/mesh/stats` — Diagnostik jaringan mesh aktif.
  - **Unit Test Komprehensif**: 14 test cases lulus 100% (`tests/mesh.test.ts`), menguji discovery, sorting hop, verifikasi sidik jari, pengiriman lokal, drop duplikasi, drop loop, drop TTL kadaluarsa, multi-hop relay, store-and-forward queue & flush, anti-spam rate limiter, dan server batch sync.
  - **Frontend UI & State Management**:
    - `meshManager.ts`: Modul P2P mesh bus lokal (BroadcastChannel/Web Bluetooth), persistensi lokal, pendeteksi online/offline otomatis, dan antrean pengiriman.
    - `OfflineBanner.tsx`: Banner status offline permanen di seluruh aplikasi dengan jumlah peer terdeteksi dan tombol beralih cepat.
    - `MeshPeerModal.tsx`: Tampilan daftar peer terdekat dengan indikator hop (1 Hop 🟢, 2 Hop 🟡, 3+ Hop 🔵), kekuatan sinyal RSSI, tombol verifikasi QR/sidik jari, form broadcast offline warkop, dan tombol sinkronisasi server.
    - Integrasi `chat/[id].tsx`: Pengiriman pesan otomatis menggunakan mesh offline saat koneksi socket terputus atau mode offline aktif.

## [Ngopi v3.0 - Sprint 5] - 2026-10-12

### Sistem Undangan & Penjadwalan Event Game (ngopiv3.md)
- **Sprint 5: Sistem Undangan Event Game (GameEvent & Undangan Komunitas)**:
  - **Model Data & Skema Penjadwalan (`event.types.ts`)**:
    - Entitas `GameEvent` & `GameEventInvitation` mencakup gameType (Gapleh, Catur, UNO, Ular Tangga, Monopoli, Pokemon TCG, Remi, Poker, Bridge, Truf), hostId, scheduledAt, durasi perkiraan, kapasitas pemain, status (scheduled, ongoing, completed, cancelled), dan tableId integrasi.
    - Status respon undangan: `pending`, `accepted`, `declined` dengan timestamp respon.
  - **Service & Business Logic (`event.service.ts`)**:
    - Pembuatan agenda pertandingan warkop dengan validasi rentang waktu masa depan, kuota partisipan, dan pesan undangan kustom.
    - Sistem respon undangan (`respondInvitation`) dengan proteksi hak akses dan kuota pemain.
    - Pembatalan agenda (`cancelEvent`) eksklusif oleh host.
    - **Otomatisasi Meja Permainan (`startEvent`)**: Menghubungkan langsung `EventService` ke `TableManager.createTable()` saat waktu bertanding tiba; meja server-authoritative otomatis diinisialisasi dan tableId disimpan ke record event.
    - **Pemberitahuan & Reminder Otomatis**: Integrasi Socket.IO real-time (`event:new_invitation`, `event:invitation_responded`, `event:started`, `event:reminder`) dengan scheduler pengingat agenda pertandingan 15 menit & 60 menit sebelum mulai.
  - **API REST Endpoints (`event.routes.ts`)**:
    - `POST /api/events`: Buat agenda pertandingan baru dan sebar undangan.
    - `GET /api/events/my`: Mengambil daftar agenda yang di-host oleh pengguna saat ini.
    - `GET /api/events/invited`: Mengambil daftar undangan pertandingan masuk.
    - `GET /api/events/:id`: Detail agenda pertandingan dan daftar konfirmasi kehadiran peserta.
    - `PATCH /api/events/:id/respond`: Konfirmasi kehadiran (terima / tolak undangan).
    - `POST /api/events/:id/start`: Peluncuran event oleh host (auto-create meja game).
    - `DELETE /api/events/:id`: Pembatalan agenda pertandingan.
  - **Unit Test Komprehensif**: 30 test cases lulus 100% (`tests/event.test.ts`), menguji validasi parameter, alur penerimaan/penolakan undangan, proteksi non-host, integrasi pembuatan meja `TableManager`, transisi status, dan pembersihan agenda.
  - **UI Frontend**:
    - Komponen `GameEventModal.tsx`:
      - Tab **Agenda Saya**: Kartu agenda aktif, hitung mundur (countdown timer) interaktif, status kehadiran peserta, dan tombol "Mulai Pertandingan" untuk host.
      - Tab **Undangan Masuk**: Tampilan undangan dari teman warkop dengan tombol respon cepat (Terima ✅ / Tolak ❌).
      - Tab **Buat Agenda**: Form pembuatan event lengkap dengan preset waktu cepat ("Nanti Malam", "Besok Siang", "Akhir Pekan"), pemilih jenis permainan, batas pemain, dan pencarian/penambahan peserta.
    - Integrasi tombol kalender event (📅) di header `games/index.tsx` dengan navigasi mulus langsung ke arena meja saat event dimulai.

## [Ngopi v3.0 - Sprint 3 & Sprint 4] - 2026-10-12

### Permainan & Ekosistem Digital (ngopiv3.md)
- **Sprint 4: Permainan Pokemon (Kartu Koleksi Nusantara Monsters & Battle Stadium)**:
  - **Katalog Monster Orisinal**: 18 monster orisinal bertema Nusantara & fauna mistis (`PokemonCatalog.ts`) dengan 6 elemen (🔥 Api, 💧 Air, 🌍 Tanah, ⚡ Listrik, 🌿 Tumbuhan, 🔮 Psikis) dan 4 tingkat kelangkaan (Biasa, Langka, Epik, Legenda).
  - **Mekanisme Shiny Foil**: Peluang 6% mendapatkan varian berkilau dengan bonus stat HP dan Serangan +10%.
  - **Matriks Keunggulan Elemen**: Perhitungan kelemahan & keunggulan elemen server-authoritative (`PokemonRules.ts`): Api unggul lawan Tumbuhan (1.5x), Air unggul lawan Api (1.5x), Listrik unggul lawan Air (1.5x), Tanah unggul lawan Listrik (1.5x), Tumbuhan unggul lawan Tanah (1.5x), serta Psikis penembus pertahanan fisik.
  - **Engine Duel 1-on-1**: Sistem pertarungan server-authoritative (`PokemonGame.ts`) dengan 3 monster per tim (1 aktif, 2 cadangan), aksi Serang Cepat, Jurus Elemen, pergantian monster cadangan (Switch), status Knockout (💀), serta Bot AI otonom adaptif.
  - **Layanan Koleksi, Gacha Booster Pack & Bursa Tukar Kartu**:
    - `PokemonService.ts` untuk penyimpanan persisten koleksi pemain, pemberian tim pemula (starter team) gratis, pembukaan Booster Pack (100 Poin Ngopi) berpeluang kartu Legenda, dan sistem bursa tukar kartu (Trade) antar pemain warkop.
    - REST Endpoints: `GET /api/pokemon/cards`, `GET /api/pokemon/collection`, `POST /api/pokemon/packs/open`, `GET /api/pokemon/trades`, `POST /api/pokemon/trade/create`, `PATCH /api/pokemon/trade/:id/respond`, `POST /api/pokemon/battle/challenge`, dan `POST /api/pokemon/battle/:id/action`.
  - **Unit Test Komprehensif**: 42 test cases lulus 100% (`tests/pokemon.test.ts`), mencakup integritas katalog, keunggulan elemen, damage formula, KO auto-switch, bot moves, gacha drop rates, dan siklus pertukaran kartu.
  - **UI Frontend**:
    - Komponen `PokemonHubModal.tsx`: Binder album koleksi dengan filter elemen & kelangkaan, animasi pembukaan paket booster (Gacha reveal ✨), dan pasar penukaran kartu aktif.
    - Arena pertarungan terintegrasi di `games/[id].tsx`: Split-screen monster lawan vs monster pemain, bilah indikator HP dinamis, badge tipe elemen, indikator cadangan tim, pengumuman aksi langsung, dan tombol komando taktis.
    - Tombol pintasan langsung di lobi `games/index.tsx` dan tab Monster TCG.

- **Sprint 3: Permainan Monopoli (Fast 24-Square Edition)**:
  - Papan persegi perimeter 24 kotak (`MonopolyBoard.ts`), 16 Kartu Dana Umum & 16 Kartu Kesempatan (`MonopolyCards.ts`).
  - Mekanisme pembelian properti, pembayaran sewa, pembangunan rumah/hotel, denda penjara, dan mode mata uang kasual maupun BMC token.
  - Bot AI otonom penilai properti dan keputusan dadu.
  - 25 Unit Test lulus 100% (`tests/monopoly.test.ts`).
  - Tampilan papan interaktif perimeter 4 sisi di `games/[id].tsx`.

## [Ngopi v3.0 - Sprint 1 & Sprint 2] - 2026-10-11

### Permainan & Ekosistem Digital (ngopiv3.md)
- **Sprint 1: Permainan UNO**:
  - Implementasi deck resmi 108 kartu (`UnoDeck.ts`), aturan pencocokan (`UnoRules.ts`), dan engine permainan server-authoritative (`UnoGame.ts`).
  - Mekanisme shout UNO! dan catch UNO! untuk pemain yang lupa teriak saat memegang 1 kartu.
  - Keamanan anti-cheat: Kartu tangan pemain lawan disamarkan oleh server dan hanya dikirim jumlahnya.
  - Bot AI otonom untuk permainan kartu UNO.
  - 32 Unit Test lulus 100%.
  - UI Frontend kartu UNO berwarna, action bar, dan modal pemilih warna Wild Card.
- **Sprint 2: Permainan Ular Tangga**:
  - Implementasi papan 100 kotak (`SnakeLadderBoard.ts`) dengan 10 tangga resmi dan 10 ular resmi sesuai spesifikasi `ngopiv3.md`.
  - Engine permainan server-authoritative (`SnakeLadderGame.ts`), dadu acak 1-6 anti-cheat, aturan mantul (bounce back) jika berlebih dari kotak 100, dan bonus roll saat dadu 6.
  - 15 Unit Test lulus 100%.
  - Tampilan papan grid 10x10 serpentine, indikator tangga 🪜 & ular 🐍, pion pemain, dan tombol lempar dadu interaktif.
- **Fitur Klasemen (Leaderboard 4 Kategori)**:
  - Endpoint `GET /api/leaderboard` dan tracking aktivitas warkop.
  - Komponen `LeaderboardModal.tsx` dengan podium medali 🥇🥈🥉 (Peraih Poin Terbanyak, Musik Terpopuler, Radio Terbanyak Dipilih, dan Game Terfavorit).
- **Peningkatan Game Catur (Cantur)**:
  - Pilihan warna bidak (Putih, Hitam, Acak) saat pembuatan meja dan tombol Balik Papan (Flip Perspective).
  - 3 Tingkat kesulitan Bot AI (Pemula, Menengah, Master dengan Minimax 2-ply + Alpha-Beta Pruning + Positional Piece-Square Tables).
  - Poin kemenangan adaptif (+15 Pemula, +35 Menengah, +60 Master, +50 Manusia).
- **Perbaikan Autentikasi & Meja Permainan**:
  - Pelonggaran skema regex login dan pencarian case-insensitive username serta fallback display name.
  - Perbaikan status meja selesai dan fitur ambil alih kursi bot ("Gabung (Ganti Bot 🤖)") di lobi game.

## [Sprint 0 & Sprint 1] - 2026-10-10

### Bagian 1: Audit & Review (Sprint 0)
- **BUG-01 (E2EE Key Renegotiation)**:
  - Membuat endpoint `POST /api/keys/renegotiate` dan `GET /api/keys/:userId` untuk menyinkronkan kunci publik antar pasangan chat.
  - Menambahkan banner peringatan *"⚠️ Kunci enkripsi perlu diperbarui"* dan tombol inline *"🔄 Muat Ulang Kunci"* pada bubble chat jika pesan gagal didekripsi.
  - Menambahkan event socket `keys:updated` dan `keys:renegotiate` agar chat partner dapat langsung membaca pesan terenkripsi tanpa perlu refresh browser.
- **BUG-02 (Password Auto-save Prompt)**:
  - Menambahkan atribut `autoComplete="off"` dan `textContentType="none"` pada form login.
  - Menambahkan atribut `autoComplete="new-password"` pada form registrasi.
- **BUG-03 (Audit Ikon & Aksesibilitas)**:
  - Menstandarisasi ikon dengan label aksesibilitas (`accessibilityLabel` dan `title`) pada panggilan suara, video, pencarian, dan lampiran berkas.
- **UX-01 (Empty States)**:
  - Membuat komponen reusable `EmptyState.tsx` dengan ilustrasi hangat kopi dan tombol CTA sapaan.
  - Mengintegrasikannya pada ruang obrolan, daftar warkop, dan tab kontak.
- **UX-02 (Format Tanggal & Waktu)**:
  - Membuat utility `dateFormat.ts`: Hari ini (`06:22`), Kemarin (`Kemarin, 06:22`), dan older (`29 Sep, 06:22`).
- **UX-03 (Status Pesan / Read Receipt)**:
  - Menampilkan centang `✓` (terkirim) dan `✓✓` berwarna aksen kopi (terbaca).
- **UX-04 (Onboarding Pengguna Baru)**:
  - Membuat komponen `OnboardingModal.tsx` dengan 3 langkah pengenalan ruang privat, warkop, dan navigasi aplikasi.
- **SEC-01 (Halaman Legal)**:
  - Memperbarui `/privacy` (Kebijakan Privasi E2EE murni tanpa nomor HP) dan `/terms` (Syarat & Ketentuan warkop).
  - Menautkan halaman legal di footer login, registrasi, dan menu drawer.
- **SEC-02 (HTTPS & WSS CSP)**:
  - Memperbarui Helmet CSP dan security CORS middleware backend untuk mengizinkan `ngopi.top`, `api.ngopi.top`, dan `wss://api.ngopi.top`.

### Bagian 2: Suasana Warkop (Sprint 1)
- **FITUR-01 (Jukebox Warung 🎶)**:
  - Menambahkan model `JukeboxTrack` dan `JukeboxVote` di Prisma schema.
  - Membuat endpoint `GET /api/jukebox/:warungId/now-playing`, `POST /api/jukebox/:warungId/queue`, dan `POST /api/jukebox/:warungId/vote`.
  - Mengimplementasikan widget floating `JukeboxWidget.tsx` dengan kontrol putar, progress bar, request lagu, like, dan vote skip (>3 suara skip otomatis berganti lagu).
- **FITUR-02 (Ambient Sound 🔊)**:
  - Membuat endpoint `GET /api/ambient/list` dengan suara Hujan Rintik, Kafe Ramai, Ombak, Hutan Senja, Jangkrik Malam, dan Api Unggun.
  - Membuat komponen mini player `AmbientPlayer.tsx` dengan pemutar audio loop, selektor suasana, dan volume slider yang tersimpan di `localStorage`.
- **FITUR-03 (Reaksi Khas Warkop ☕)**:
  - Menambahkan reaksi ☕ (kopi), 🍵 (teh), 🚬 (kretek), 🎵 (lagu), 🍜 (mie), dan 🌙 (malam) ke emoji picker di chat room dan toolbar warkop.
- **FITUR-04 (Mode Ngobrol Malam 🌙)**:
  - Membuat hook `useNightMode` dengan pengaturan `auto` (aktif otomatis 21:00-05:00), `on`, dan `off`.
  - Menambahkan tombol pengubah tema malam di menu pengaturan akun.
