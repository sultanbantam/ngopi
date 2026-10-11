Berikut adalah PROMPT\_NGOPI\_MASTER\_V3.md — gabungan lengkap dari semua pengembangan Ngopi: Infrastruktur Game, 9 Permainan (termasuk UNO, Ular Tangga, Monopoli, Pokemon), Sistem Undangan Event, Mode Offline Bluetooth, Ekonomi BMC & Poin, Kepatuhan Regulasi, dan Anti-Spam.

Simpan file ini di root project Ngopi dan jalankan ke AI Agent di Antigravity IDE.

\---

\`\`\`markdown  
\# MASTER PROMPT: Ngopi v3.0 — Ekosistem Digital Lengkap (Games, Web3, Compliance, Security)

\#\# 0\. KONTEKS & VISI PROYEK

\- \*\*Aplikasi\*\*: Ngopi (https\://ngopi.top)  
\- \*\*Tagline\*\*: "ngobrol paling intim"  
\- \*\*Visi\*\*: Menjadi "Warung Kopi Digital" — ruang komunikasi privat, tenang, dan bermakna bagi Gen Z & Gen Alpha, dengan ekosistem lengkap: chat, game, musik, ekonomi token, dan komunitas.  
\- \*\*Tech Stack\*\*: React (Web), Node.js \+ Express, Socket.IO, PostgreSQL \+ Prisma, Redis, Ethers.js (BMC), WebRTC.  
\- \*\*Peran AI Agent\*\*: Anda adalah \*\*Senior Full-Stack Developer \+ Security Engineer \+ Blockchain Developer \+ Compliance Officer\*\*. Kerjakan setiap task secara berurutan, dengan testing di setiap langkah.

\*\*Aturan Kerja\*\*:  
\- Kerjakan \*\*satu sprint per satu sprint\*\*. Tunggu konfirmasi sebelum lanjut.  
\- Setiap fitur wajib punya \*\*unit test\*\* (Jest) dan \*\*logging\*\* (Winston).  
\- Semua data sensitif dienkripsi (AES-256-GCM).  
\- Update \`README.md\` dan \`CHANGELOG.md\` setiap sprint.  
\- Gunakan environment variables untuk semua konfigurasi.

\---

\# DAFTAR SPRINT (Roadmap Lengkap)

| Sprint | Fokus | Estimasi |  
| :--- | :--- | :--- |  
| \*\*Sprint 1\*\* | Permainan UNO | 2 minggu |  
| \*\*Sprint 2\*\* | Permainan Ular Tangga | 1,5 minggu |  
| \*\*Sprint 3\*\* | Permainan Monopoli | 3 minggu |  
| \*\*Sprint 4\*\* | Permainan Pokemon (Kartu Koleksi) | 3 minggu |  
| \*\*Sprint 5\*\* | Sistem Undangan Event Game | 2,5 minggu |  
| \*\*Sprint 6\*\* | Mode Offline via Bluetooth (Mesh Networking) | 3 minggu |  
| \*\*Sprint 7\*\* | Ekonomi BMC: Fitur Premium & Poin Ngopi | 2,5 minggu |  
| \*\*Sprint 8\*\* | Kepatuhan Regulasi (UU PDP, PSE, ISO 27001\) | 3 minggu |  
| \*\*Sprint 9\*\* | Anti-Spam & Moderasi AI | 2 minggu |

\---

\# SPRINT 1: PERMAINAN UNO

\#\# 1.1 Deskripsi  
Permainan kartu UNO untuk 2-10 pemain. Pemain harus menghabiskan kartu duluan dengan mencocokkan warna atau angka.

\#\# 1.2 Aturan  
\- Deck 108 kartu (4 warna \+ Wild). Setiap pemain dapat 7 kartu.  
\- Kartu aksi: Skip, Reverse, Draw Two, Wild, Wild Draw Four.  
\- \*\*UNO\!\*\*: Klik tombol dalam 3 detik setelah sisa 1 kartu, jika tidak kena penalti 2 kartu.  
\- Pemenang: Habiskan kartu duluan.

\#\# 1.3 File Backend  
\`\`\`

backend/src/games/uno/  
├── UnoGame.ts          \# extends BaseGame  
├── UnoRules.ts         \# Validasi langkah  
├── UnoDeck.ts          \# Konstruksi & shuffle  
└── types.ts

\`\`\`

\#\# 1.4 Anti-Cheat  
\- Kartu pemain lain TIDAK PERNAH dikirim ke klien (hanya jumlah).  
\- Wild Draw Four divalidasi: pemain benar-benar tidak punya kartu warna saat ini.

\#\# 1.5 UI Frontend  
\- Kartu di tengah meja, kartu pemain di bawah.  
\- Animasi Framer Motion (kartu terbang).  
\- Tombol "UNO\!" besar saat sisa 1 kartu.  
\- Modal pilih warna setelah Wild.

\---

\# SPRINT 2: PERMAINAN ULAR TANGGA

\#\# 2.1 Aturan  
\- Papan 100 kotak. Tangga naik, ular turun.  
\- Tangga: 2→38, 7→14, 8→31, 15→26, 21→42, 28→84, 36→44, 51→67, 71→91, 78→98.  
\- Ular: 16→6, 46→25, 49→11, 62→19, 64→60, 74→53, 89→68, 92→88, 95→75, 99→80.  
\- Lempar dadu 1-6, harus tepat di 100 untuk menang.

\#\# 2.2 File Backend  
\`\`\`

backend/src/games/snake\_ladder/  
├── SnakeLadderGame.ts  
├── SnakeLadderBoard.ts  
└── types.ts

\`\`\`

\#\# 2.3 UI Frontend  
\- Papan grid 10x10 dengan SVG tangga & ular.  
\- Pion \= avatar user, warna berbeda.  
\- Animasi dadu roll \+ pion bergerak step-by-step.

\---

\# SPRINT 3: PERMAINAN MONOPOLI

\#\# 3.1 Aturan (MVP Sederhana)  
\- Papan 24 kotak (versi cepat). Uang awal 1500\.  
\- Aksi: Lempar dadu, beli properti, bayar sewa, ambil kartu Chance, masuk penjara.  
\- Bangun rumah/hotel jika punya 1 grup warna.  
\- Bangkrut \= tersingkir. Pemenang: pemain terakhir.

\#\# 3.2 File Backend  
\`\`\`

backend/src/games/monopoly/  
├── MonopolyGame.ts  
├── MonopolyBoard.ts  
├── MonopolyCards.ts    \# 16 Chance \+ 16 Community  
├── MonopolyRules.ts  
└── types.ts

\`\`\`

\#\# 3.3 Mode BMC (Opsional)  
\- Mode "Kasual": uang virtual.  
\- Mode "BMC": uang \= token BMC (via ethers.js, transfer on-chain).

\#\# 3.4 UI Frontend  
\- Papan persegi 4 sisi.  
\- Panel pemain: uang, properti, posisi.  
\- Modal dialog: beli properti, bayar sewa, bangun rumah.

\---

\# SPRINT 4: PERMAINAN POKEMON (KARTU KOLEKSI)

\#\# 4.1 Deskripsi  
Permainan kartu koleksi dan battle berbasis Pokemon. Pemain menangkap, melatih, dan bertarung dengan Pokemon.

\#\# 4.2 Konsep  
\- \*\*Kartu Pokemon\*\*: Setiap kartu punya \`name\`, \`type\` (Api/Air/Tanah/Listrik/dll), \`hp\`, \`attack\`, \`defense\`, \`rarity\` (Common/Rare/Epic/Legendary).  
\- \*\*Koleksi\*\*: Pemain mengumpulkan kartu dari:  
  \- Aktivitas harian (chat, main game) → hadiah kartu acak.  
  \- Membeli paket dengan Poin Ngopi/BMC.  
  \- Turnamen di Warung Kopi.  
\- \*\*Battle\*\*: 1-on-1, setiap pemain bawa 3 kartu. Turn-based.  
\- \*\*Tukar Kartu\*\*: Pemain bisa tukar kartu dengan pemain lain (dengan konfirmasi kedua pihak).

\#\# 4.3 Database Schema  
\`\`\`prisma  
model PokemonCard {  
  id          String   @id @default(cuid())  
  name        String  
  type        String   // "fire", "water", "earth", "electric", "grass", "psychic"  
  hp          Int  
  attack      Int  
  defense     Int  
  rarity      String   // "common", "rare", "epic", "legendary"  
  image\_url   String  
  description String?  
}

model UserPokemonCollection {  
  id         String   @id @default(cuid())  
  user\_id    String   @map("user\_id")  
  card\_id    String   @map("card\_id")  
  quantity   Int      @default(1)  
  is\_shiny   Boolean  @default(false)  // Varitas khusus  
  acquired\_at DateTime @default(now()) @map("acquired\_at")

  @@unique(\[user\_id, card\_id\])  
}

model PokemonBattle {  
  id           String   @id @default(cuid())  
  player\_a\_id  String   @map("player\_a\_id")  
  player\_b\_id  String   @map("player\_b\_id")  
  winner\_id    String?  @map("winner\_id")  
  battle\_log   Json     // Riwayat aksi battle  
  status       String   @default("ongoing")  // "ongoing", "finished"  
  created\_at   DateTime @default(now()) @map("created\_at")  
  finished\_at  DateTime? @map("finished\_at")  
}

model PokemonTrade {  
  id           String   @id @default(cuid())  
  initiator\_id String   @map("initiator\_id")  
  receiver\_id  String   @map("receiver\_id")  
  offer\_cards  Json     // \[{ card\_id, quantity }\]  
  request\_cards Json    // \[{ card\_id, quantity }\]  
  status       String   @default("pending")  // "pending", "accepted", "declined", "cancelled"  
  created\_at   DateTime @default(now()) @map("created\_at")  
}  
\`\`\`

4.4 Backend Endpoints

· GET /api/pokemon/cards → Daftar semua kartu (katalog).  
· GET /api/pokemon/collection → Koleksi user.  
· POST /api/pokemon/packs/open → Buka paket (butuh Poin Ngopi).  
· POST /api/pokemon/battle/challenge → Tantang pemain lain.  
· POST /api/pokemon/battle/:id/action → Aksi battle (attack, switch, item).  
· POST /api/pokemon/trade/create → Buat tawaran tukar.  
· PATCH /api/pokemon/trade/:id/respond → Terima/tolak tukar.

4.5 UI Frontend

· Koleksi: Grid kartu dengan filter (tipe, rarity).  
· Battle: Layout split-screen, HP bar di atas, log aksi di bawah.  
· Turnamen: Bracket visual, timer per match.  
· Tukar: Modal dengan dua kolom (kartu Anda vs kartu mereka).

4.6 Catatan Hukum

⚠️ PENTING: Pokemon adalah merek dagang Nintendo/The Pokemon Company. Untuk menghindari pelanggaran hak cipta:

· Gunakan karakter original dengan gaya visual mirip (misal: "Bamboo Monsters" atau "Nusantara Creatures").  
· Desain kartu custom, bukan art resmi Pokemon.  
· Nama: hindari "Pikachu", "Charizard", dll. Gunakan nama orisinal (misal: "Kelinci Petir", "Naga Api").

\---

SPRINT 5: SISTEM UNDANGAN EVENT GAME

5.1 Deskripsi

Fitur undangan untuk agenda/event main game bareng. Setiap undangan berisi game, waktu, Warung, dan pesan personal.

5.2 Database Schema

\`\`\`prisma  
model GameEvent {  
  id            String   @id @default(cuid())  
  host\_id       String   @map("host\_id")  
  warung\_id     String?  @map("warung\_id")  
  game\_type     String   @map("game\_type")  
  title         String  
  description   String?  
  scheduled\_at  DateTime @map("scheduled\_at")  
  duration\_min  Int      @default(60)  
  max\_players   Int      @default(4)  
  is\_private    Boolean  @default(false)  
  status        String   @default("scheduled")  
  table\_id      String?  
  created\_at    DateTime @default(now())  
}

model GameEventInvitation {  
  id          String   @id @default(cuid())  
  event\_id    String   @map("event\_id")  
  invitee\_id  String   @map("invitee\_id")  
  message     String?  
  status      String   @default("pending")  
  responded\_at DateTime?  
  created\_at  DateTime @default(now())

  @@unique(\[event\_id, invitee\_id\])  
}  
\`\`\`

5.3 Backend Endpoints

· POST /api/events → Buat event.  
· GET /api/events/my, GET /api/events/invited → Daftar event.  
· PATCH /api/events/:id/respond → Terima/tolak.  
· POST /api/events/:id/start → Mulai event (auto-create GameTable).

5.4 Socket.IO Events

· event:new\_invitation, event:invitation\_responded, event:reminder, event:started.

5.5 UI Frontend

· Halaman "Event Saya": Tabs (Akan Datang, Undangan, Selesai).  
· Form "Buat Event" dengan date picker & multi-select peserta.  
· Halaman "Detail Event": daftar peserta \+ countdown timer.  
· Notifikasi badge & push.

\---

SPRINT 6: MODE OFFLINE VIA BLUETOOTH (Mesh Networking)

6.1 Deskripsi

Saat internet mati, Ngopi tetap berfungsi di area terbatas melalui jaringan mesh peer-to-peer via Bluetooth LE dan Wi-Fi Direct.

6.2 Teknologi

· Bluetooth Low Energy (BLE) Mesh untuk chat jarak dekat (\< 100m per hop).  
· Wi-Fi Direct untuk transfer file besar antar perangkat.  
· Multi-hop routing: Pesan bisa diteruskan lewat perangkat lain untuk jangkauan lebih luas.  
· Store-and-Forward: Pesan tertunda dikirim saat perangkat terhubung kembali.

6.3 Library Rekomendasi

· React Native: react-native-ble-plx, react-native-ble-mesh, react-native-wifi-p2p.  
· Web (experimental): Web Bluetooth API, WebRTC Data Channel (dengan signaling manual via QR code).

6.4 Arsitektur

\`\`\`  
\[User A\] ←BLE→ \[User B\] ←BLE→ \[User C\] ←BLE→ \[User D\]  
                 ↓  
         (Saat online kembali)  
                 ↓  
            \[Server Ngopi\]  
\`\`\`

6.5 Database Schema (Local \- SQLite/IndexedDB)

\`\`\`sql  
CREATE TABLE mesh\_peers (  
  peer\_id TEXT PRIMARY KEY,  
  display\_name TEXT,  
  last\_seen INTEGER,  
  public\_key TEXT  
);

CREATE TABLE mesh\_messages (  
  id TEXT PRIMARY KEY,  
  sender\_id TEXT,  
  recipient\_id TEXT,  
  content TEXT,       \-- Terenkripsi E2EE  
  created\_at INTEGER,  
  delivered INTEGER DEFAULT 0,  
  ttl INTEGER          \-- Time-to-live (max 7 hari)  
);  
\`\`\`

6.6 Fitur

· Pesan Offline: Kirim teks ke peer terdekat, teruskan via mesh.  
· File Kecil: Foto/dokumen \< 1MB via BLE.  
· File Besar: Video \> 1MB via Wi-Fi Direct (harus dekat).  
· Auto-Sync: Saat online, semua pesan mesh dikirim ke server untuk sinkronisasi.  
· Indikator: Badge "Offline Mode" \+ jumlah peer terdeteksi.

6.7 Keamanan

· E2EE tetap berlaku di mesh (X25519 \+ AES-GCM).  
· Peer verification via QR code scan saat pertama connect.  
· Anti-spam: Batasi jumlah pesan per peer (10/menit).

6.8 UI Frontend

· Banner "Mode Offline Aktif" di atas.  
· Halaman "Peer Terdekat": daftar perangkat di sekitar.  
· Indikator jangkauan (1 hop, 2 hop, dll).

\---

SPRINT 7: EKONOMI BMC — FITUR PREMIUM & POIN NGOPI

7.1 Konsep Dua Lapis

1\. Poin Ngopi (Off-Chain): Mata uang internal untuk reward aktivitas.  
2\. Token BMC (On-Chain): Token nyata di Bamboochain untuk transaksi & premium.

7.2 Poin Ngopi — Cara Mendapat

Aktivitas Poin  
Kirim pesan \+1 (max 50/hari)  
Dapat reaksi \+2 (max 20/hari)  
Bantu user lain (jawab pertanyaan) \+5  
Main game (selesai) \+10  
Menang game \+25  
Login harian (streak) \+5 x streak  
Undang teman (yang aktif) \+50  
Selesaikan misi harian \+20

7.3 Poin Ngopi — Cara Pakai

· Beli paket kartu Pokemon (100 poin/paket).  
· Beli stiker premium (50 poin).  
· Buka fitur premium sementara (misal: kirim file besar 1x \= 20 poin).  
· Konversi ke BMC: 1000 poin \= 1 BMC (rasio bisa disesuaikan).

7.4 Fitur Premium (Bayar dengan Poin/BMC)

Fitur Harga Deskripsi  
Kirim File Besar 20 poin / 0.1 BMC File \> 5MB  
Penyimpanan Tambahan 500 poin / 5 BMC / bulan Cloud storage \+5GB  
Ruang Bioskop 100 poin / 1 BMC Nonton film bareng (sinkron)  
Tema Eksklusif 200 poin Tema visual Warung  
Badge Premium 1000 poin Badge di profil  
Akses Beta Fitur 2000 poin Coba fitur baru lebih dulu

7.5 Ruang Bioskop (Watch Party)

· Fitur: Nonton film/YouTube bareng dengan sinkronisasi playback.  
· Teknologi: WebRTC untuk video stream \+ Socket.IO untuk sinkronisasi kontrol.  
· Kontrol: Host bisa play/pause/seek, semua peserta mengikuti.  
· Chat Real-time: Kolom chat di samping video.  
· Voice Chat: Opsional, bisa ngobrol sambil nonton.

7.6 Database Schema

\`\`\`prisma  
model UserPoints {  
  user\_id    String   @id @map("user\_id")  
  balance    Int      @default(0)  
  lifetime   Int      @default(0)  // Total poin yang pernah didapat  
  updated\_at DateTime @updatedAt @map("updated\_at")  
}

model PointsTransaction {  
  id         String   @id @default(cuid())  
  user\_id    String   @map("user\_id")  
  amount     Int      // Positif \= dapat, Negatif \= pakai  
  type       String   // "chat\_reward", "game\_reward", "purchase", "convert\_to\_bmc"  
  reference  String?  // ID terkait (misal: game\_id)  
  created\_at DateTime @default(now())  
}

model PremiumSubscription {  
  id         String   @id @default(cuid())  
  user\_id    String   @unique @map("user\_id")  
  tier       String   // "free", "premium", "pro"  
  expires\_at DateTime  
  created\_at DateTime @default(now())  
}

model WatchParty {  
  id          String   @id @default(cuid())  
  host\_id     String   @map("host\_id")  
  warung\_id   String?  @map("warung\_id")  
  video\_url   String  
  video\_type  String   // "youtube", "custom"  
  current\_time Float   @default(0)  
  is\_playing  Boolean  @default(false)  
  participants Json    // \[{ user\_id, joined\_at }\]  
  created\_at  DateTime @default(now())  
}  
\`\`\`

7.7 Integrasi Blockchain (BMC)

· Gunakan ethers.js untuk:  
  · Cek saldo BMC user (via RPC Bamboochain).  
  · Transfer BMC saat konversi poin (on-chain).  
  · Verify signature untuk login/transaksi.  
· Smart Contract (Solidity di Bamboochain):  
  \`\`\`solidity  
  contract NgopiRewards {  
    mapping(address \=\> uint256) public points;  
      
    function convertPointsToBMC(uint256 amount) external {  
      require(points\[msg.sender\] \>= amount \* 1000, "Insufficient points");  
      points\[msg.sender\] \-= amount \* 1000;  
      // Transfer BMC ke user  
      BMC.transfer(msg.sender, amount);  
    }  
  }  
  \`\`\`

7.8 UI Frontend

· Halaman Poin: saldo, riwayat transaksi, cara dapat poin.  
· Halaman Premium: daftar fitur premium, tombol beli.  
· Ruang Bioskop: layout split (video \+ chat).  
· Halaman Konversi: pilih jumlah poin → konversi ke BMC.

\---

SPRINT 8: KEPATUHAN REGULASI (UU PDP, PSE, ISO 27001\)

8.1 Regulasi Wajib Indonesia

A. UU PDP (UU No. 27/2022) — Perlindungan Data Pribadi

Kewajiban:

1\. Consent: Dapatkan persetujuan eksplisit sebelum mengumpulkan data.  
2\. Transparansi: Jelaskan data apa yang dikumpulkan dan untuk apa.  
3\. Hak Subjek Data: User berhak akses, koreksi, hapus, dan ekspor data.  
4\. Keamanan: Enkripsi data (sudah diterapkan via E2EE).  
5\. Notifikasi Kebocoran: Lapor ke user & Kominfo dalam 3x24 jam jika terjadi breach.  
6\. DPO (Data Protection Officer): Tunjuk DPO jika memproses data dalam skala besar.

Implementasi:

· Buat halaman Kebijakan Privasi (/privacy) dan Syarat & Ketentuan (/terms).  
· Endpoint GET /api/user/export → ekspor data user (JSON).  
· Endpoint DELETE /api/user/delete → hapus akun & data (dengan grace period 30 hari).  
· Consent banner saat pertama kali login.

B. PP 71/2019 & Pendaftaran PSE Kominfo

Kewajiban:

· Daftar sebagai Penyelenggara Sistem Elektronik (PSE) di https\://pse.kominfo.go.id.  
· Kategori: PSE Lingkup Privat (karena bukan layanan publik pemerintah).  
· Dokumen yang dibutuhkan:  
  · Akta pendirian perusahaan (PT/CV).  
  · NIB (Nomor Induk Berusaha).  
  · Kebijakan Privasi & Syarat Ketentuan.  
  · Dokumen teknis sistem (arsitektur, keamanan).

Timeline: 14 hari kerja setelah pendaftaran.

C. Standar Sukarela: ISO 27001 / SNI ISO 27001

Kewajiban:

· Gap assessment untuk lihat celah keamanan.  
· Susun Kebijakan Keamanan Informasi.  
· Buat Statement of Applicability (SoA).  
· Audit internal \+ audit eksternal oleh badan sertifikasi.

Kontrol ISO 27001 yang Relevan untuk Ngopi:

· A.8.2: Klasifikasi informasi  
· A.8.3: Manajemen hak akses  
· A.8.13: Backup & recovery  
· A.8.16: Logging & monitoring  
· A.8.24: Enkripsi data  
· A.8.28: Secure coding

8.2 Dokumen yang Harus Dibuat

\`\`\`  
docs/compliance/  
├── privacy-policy.md           \# Kebijakan Privasi  
├── terms-of-service.md         \# Syarat & Ketentuan  
├── data-protection-policy.md   \# Kebijakan Perlindungan Data  
├── information-security-policy.md  \# Kebijakan Keamanan Informasi  
├── incident-response-plan.md   \# Rencana Tanggap Insiden  
├── business-continuity-plan.md \# Rencana Keberlangsungan Bisnis  
├── statement-of-applicability.md   \# SoA (ISO 27001\)  
└── gap-assessment.md           \# Hasil gap assessment  
\`\`\`

8.3 Implementasi Teknis

· Consent Management: Simpan persetujuan user di database dengan timestamp.  
· Data Export: Endpoint untuk ekspor semua data user (chat, profil, transaksi).  
· Data Deletion: Soft delete → hard delete setelah 30 hari.  
· Audit Log: Catat semua akses data pribadi (untuk audit).  
· Breach Notification: Sistem alert otomatis jika anomali terdeteksi.

\---

SPRINT 9: ANTI-SPAM & MODERASI AI

9.1 Tujuan

Mencegah bot spam, flooding, dan konten berbahaya seperti era MIRC, tanpa harus selalu ada admin yang join Warung Kopi.

9.2 Lapisan Pertahanan (Defense in Depth)

Lapisan 1: Rate Limiting (Server-Side)

\`\`\`javascript  
// Konfigurasi per user  
const rateLimits \= {  
  messages\_per\_second: 10,  
  messages\_per\_minute: 60,  
  messages\_per\_hour: 500,  
  warung\_joins\_per\_minute: 3,  
  file\_uploads\_per\_hour: 20,  
};  
\`\`\`

· Gunakan express-rate-limit \+ Redis store.  
· Jika user melebihi batas → slow down (delay response) atau block sementara.

Lapisan 2: Filter Pre-AI (Aturan Sederhana)

\`\`\`javascript  
// Deteksi pola spam  
const spamPatterns \= \[  
  /(https?:\\/\\/\[^\\s\]+){3,}/,           // 3+ link dalam 1 pesan  
  /(.)\\1{20,}/,                         // Karakter berulang 20+ kali  
  /\[\\u200B-\\u200D\\uFEFF\]/g,            // Zero-width characters  
  /(\\b\\w+\\b)\\s+\\1\\s+\\1/i,              // Kata yang sama 3x  
\];  
\`\`\`

· Hash Detection: Hash setiap pesan. Jika hash sama dikirim \> 3x dalam 5 menit, blokir (O(1) lookup via Redis).  
· Mention Spam: Max 5 mention per pesan.  
· Emoji Spam: Max 30 emoji per pesan.

Lapisan 3: Agen AI Moderasi

· Klasifikasi Konten: Gunakan model AI (OpenAI Moderation API atau model lokal) untuk deteksi:  
  · Ujaran kebencian  
  · Konten seksual  
  · Kekerasan  
  · Spam/scam  
· Confidence Threshold:  
  · 0.9 → Auto-block.  
  · 0.7-0.9 → Flag untuk review manual (masuk queue).  
  · \< 0.7 → Lolos.  
· Mode Degradasi: Jika AI kewalahan, switch ke "rules-only mode" (hanya lapisan 1 & 2).

Lapisan 4: Tindakan Moderasi

Pelanggaran Tindakan  
Ringan (1x) Warning (notifikasi ke user)  
Sedang (2x) Mute 1 jam dari Warung  
Berat (3x) Kick dari Warung  
Sangat Berat Ban 7 hari dari aplikasi  
Berulang/Kriminal Blacklist permanen (user \+ IP \+ device fingerprint)

Lapisan 5: Moderasi Tanpa Harus Join Warung

· Server-Side Moderasi: Semua pesan melewati middleware moderasi sebelum sampai ke Warung.  
· AI Agent Moderasi: Berjalan di background, tidak perlu jadi member Warung.  
· Global Blacklist: User yang di-blacklist di satu Warung bisa otomatis di-blacklist di semua Warung (opsional, tergantung kebijakan).

9.3 Database Schema

\`\`\`prisma  
model ModerationAction {  
  id           String   @id @default(cuid())  
  user\_id      String   @map("user\_id")  
  warung\_id    String?  @map("warung\_id")  
  action\_type  String   // "warning", "mute", "kick", "ban", "blacklist"  
  reason       String  
  severity     String   // "low", "medium", "high", "critical"  
  evidence     Json?    // Snapshot pesan/konten pelanggaran  
  expires\_at   DateTime?  
  issued\_by    String?  @map("issued\_by")  // null \= auto (AI/server)  
  created\_at   DateTime @default(now())  
}

model Blacklist {  
  id          String   @id @default(cuid())  
  user\_id     String   @unique @map("user\_id")  
  ip\_address  String?  
  device\_id   String?  
  reason      String  
  is\_permanent Boolean @default(true)  
  created\_at  DateTime @default(now())  
}

model SpamHashCache {  
  hash         String   @id  
  count        Int      @default(1)  
  first\_seen   DateTime @default(now())  
  last\_seen    DateTime @default(now())  
  user\_id      String   @map("user\_id")  
}  
\`\`\`

9.4 Backend Middleware

\`\`\`typescript  
// middleware/moderation.middleware.ts  
export async function moderateMessage(req, res, next) {  
  const { content, userId, warungId } \= req.body;  
    
  // Layer 1: Rate limit (sudah via express-rate-limit)  
    
  // Layer 2: Pre-AI filter  
  if (isSpamByRules(content)) {  
    return recordViolation(userId, 'spam\_rules', content);  
  }  
    
  const hash \= hashContent(content);  
  if (await isDuplicateSpam(hash, userId)) {  
    return recordViolation(userId, 'duplicate\_spam', content);  
  }  
    
  // Layer 3: AI moderation  
  const aiResult \= await classifyContent(content);  
  if (aiResult.confidence \> 0.9 && aiResult.isHarmful) {  
    return recordViolation(userId, 'ai\_flagged', content, aiResult);  
  }  
    
  // Simpan log untuk audit  
  await logMessage({ content, userId, warungId, aiScore: aiResult.confidence });  
    
  next();  
}  
\`\`\`

9.5 AI Moderation Service

\`\`\`typescript  
// services/moderation.service.ts  
export async function classifyContent(content: string) {  
  // Gunakan OpenAI Moderation API atau model lokal  
  const response \= await openai.moderations.create({ input: content });  
  const result \= response.results\[0\];  
    
  return {  
    isHarmful: result.flagged,  
    categories: result.categories,  
    confidence: Math.max(...Object.values(result.category\_scores)),  
  };  
}  
\`\`\`

9.6 UI Frontend

· Notifikasi Warning: Munculkan modal saat user kena warning.  
· Halaman "Status Akun": Tampilkan riwayat pelanggaran & sanksi.  
· Tombol "Laporkan": User bisa laporkan pesan/user lain → masuk ke queue moderasi.  
· Dashboard Admin: Panel untuk review queue, kelola ban/blacklist.

9.7 Cron Jobs

· Setiap 5 menit: Bersihkan cache SpamHashCache yang \> 1 jam.  
· Setiap 1 jam: Auto-unban user yang masa bannya habis.  
· Setiap hari: Generate laporan moderasi (jumlah pelanggaran, top spammer).

\---

BAGIAN 10: PRIORITAS & EKSEKUSI

10.1 Urutan Sprint (Rekomendasi)

1\. Sprint 1-3: Game dasar (UNO, Ular Tangga, Monopoli) — ini yang paling cepat viral.  
2\. Sprint 4: Pokemon — daya tarik besar, tapi butuh waktu.  
3\. Sprint 5: Undangan Event — memperkuat komunitas.  
4\. Sprint 6: Bluetooth Mesh — pembeda unik, tapi kompleks.  
5\. Sprint 7: Ekonomi BMC — mesin monetisasi.  
6\. Sprint 8: Compliance — wajib untuk operasi legal di Indonesia.  
7\. Sprint 9: Anti-Spam — krusial saat user sudah banyak.

10.2 Milestone

Milestone Target Indikator  
Beta Sprint 1-3 selesai 100 user, 3 game aktif  
Growth Sprint 4-5 selesai 1.000 user, event rutin  
Monetization Sprint 6-7 selesai Revenue dari BMC, 10.000 user  
Compliance Sprint 8 selesai PSE terdaftar, UU PDP compliant  
Scale Sprint 9 selesai 100.000 user, moderasi otomatis

\---

BAGIAN 11: PERINTAH EKSEKUSI UNTUK ANTIGRAVITY IDE

"Mulai dari Sprint 1: Implementasikan game UNO secara lengkap.

Langkah:

1\. Buat folder backend/src/games/uno/ dengan file lengkap.  
2\. Implementasikan logika UNO (deck 108, kartu aksi, UNO\!, anti-cheat).  
3\. Daftarkan ke GameRegistry.ts.  
4\. Buat UI frontend dengan animasi Framer Motion.  
5\. Buat unit test (min 15 test case).  
6\. Setelah UNO selesai, laporkan dan tunggu konfirmasi saya.

Setelah konfirmasi, lanjutkan ke Sprint 2 (Ular Tangga), dst.

Untuk setiap sprint, sertakan:

· File yang dibuat/diubah.  
· Cara testing manual.  
· Apa yang perlu di-test otomatis.  
· Risiko/edge case yang perlu diperhatikan.

Jangan lompat sprint. Jangan gabungkan sprint. Satu sprint per satu."

\---

BAGIAN 12: CATATAN AKHIR

12.1 Prinsip Utama

1\. Privacy First: E2EE di semua komunikasi, termasuk mesh.  
2\. Anti-Cheat: Server-authoritative untuk semua game.  
3\. User-Friendly: UI harus bisa dipakai oleh nenek & anak SD.  
4\. Compliance: Patuhi UU PDP sejak hari pertama.  
5\. Scalable: Arsitektur harus siap untuk 1 juta user.

12.2 Referensi

· Bitchat: https\://github.com/permissionlesstech/bitchat (referensi BLE mesh).  
· Signal Protocol: Untuk E2EE.  
· chess.js, pokersolver: Library game.  
· Kominfo PSE: https\://pse.kominfo.go.id

12.3 Larangan

· ❌ Jangan gunakan aset berhak cipta (Pokemon resmi, logo Nintendo).  
· ❌ Jangan hardcode secret/API key.  
· ❌ Jangan kirim kartu lawan ke klien (anti-cheat).  
· ❌ Jangan abaikan consent user (UU PDP).  
· ❌ Jangan deploy tanpa testing.

Selamat membangun ekosistem Ngopi\! Semoga menjadi Warung Kopi Digital terbaik di Indonesia\! ☕🚀

\`\`\`

\---

\#\#\# 🚀 Cara Menggunakan

1\. \*\*Simpan\*\* file ini sebagai \`PROMPT\_NGOPI\_MASTER\_V3.md\` di root project Ngopi.  
2\. \*\*Buka Antigravity IDE\*\*, \*attach\* file ini ke Agent.  
3\. \*\*Beri perintah\*\*:  
   \> \*"Jalankan Sprint 1 (UNO) sesuai prompt ini. Setelah selesai, laporkan dan tunggu konfirmasi saya."\*  
4\. \*\*Setelah Sprint 1 selesai\*\*, review hasilnya, lalu perintahkan:  
   \> \*"Sprint 1 OK. Lanjutkan ke Sprint 2 (Ular Tangga)."\*  
5\. \*\*Ulangi\*\* untuk Sprint 3-9.

\#\#\# 💡 Saran Praktis  
\- \*\*Fokus 1 sprint per minggu\*\* agar tidak overload.  
\- \*\*Test setiap sprint\*\* sebelum lanjut.  
\- \*\*Dokumentasikan\*\* setiap keputusan teknis di \`CHANGELOG.md\`.  
\- \*\*Review legal\*\* untuk Sprint 4 (Pokemon) dan Sprint 8 (Compliance) dengan ahli hukum.

Prompt ini adalah \*\*blueprint lengkap\*\* untuk Ngopi v3.0. Dengan menjalankan semua sprint, Ngopi bukan hanya aplikasi chat, tetapi \*\*ekosistem digital lengkap\*\* yang aman, seru, dan bernilai. Selamat berkarya\! ☕🎮🔒🚀