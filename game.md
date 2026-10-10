Ide yang sangat brilian\! Menambahkan permainan kartu dan papan di Ngopi bukan hanya fitur, tetapi jiwa dari konsep "Warung Kopi" itu sendiri. Di warkop sungguhan, orang datang bukan cuma untuk ngobrol, tapi juga untuk main gapleh, remi, bridge, truf, poker, dan catur sambil ngopi. Ini akan menjadi differentiator terbesar Ngopi dibanding aplikasi chat lain.

Berikut adalah PROMPT\_NGOPI\_GAMES.md yang lengkap dan siap dijalankan oleh AI Agent Anda.

\---

\`\`\`markdown  
\# MASTER PROMPT: Modul Permainan "Meja Warkop" — Ngopi Games

\#\# 0\. VISI & KONTEKS

\*\*Visi\*\*: Menghadirkan pengalaman "ngopi sambil main" secara online. Setiap permainan berlangsung di \*\*"Meja"\*\* (Table) yang bisa disaksikan (spectator), dilengkapi \*\*voice chat\*\* agar suasana warkop terasa nyata.

\*\*Prinsip Desain\*\*:  
1\. \*\*Server-Authoritative\*\*: Semua logika permainan (kocok kartu, validasi langkah) terjadi di server. Klien hanya menampilkan state. Ini mencegah cheat.  
2\. \*\*Reconnection-Friendly\*\*: Jika pemain terputus, mereka bisa kembali ke meja tanpa kehilangan posisi.  
3\. \*\*Social-First\*\*: Setiap meja punya ruang chat dan voice call terintegrasi.  
4\. \*\*BMC-Friendly\*\*: Chip poker bisa menggunakan token BMC sebagai nilai (opsional, mode kasual vs mode BMC).  
5\. \*\*Mobile-First\*\*: UI harus nyaman dimainkan di layar HP.

\*\*Tech Stack\*\*:  
\- \*\*Backend\*\*: Node.js \+ Socket.IO (sudah ada) \+ Redis (untuk state game)  
\- \*\*Frontend\*\*: React \+ Framer Motion (animasi kartu) \+ Tailwind CSS  
\- \*\*Library Rekomendasi\*\*:  
  \- Catur: \`chess.js\` (logika) \+ \`react-chessboard\` (UI)  
  \- Poker: \`pokersolver\` (evaluasi tangan)  
  \- Kartu Remi/Bridge/Truf: Custom logic (buat engine sendiri)  
  \- Gapleh: Custom logic  
\- \*\*Voice Chat\*\*: WebRTC (sudah ada di Ngopi)  
\- \*\*Animasi\*\*: Framer Motion untuk kartu terbang, kocokan, dll.

\---

\# BAGIAN 1: INFRASTRUKTUR BERSAMA (Shared Game Engine)

Sebelum membuat game individual, bangun fondasi ini terlebih dahulu.

\#\# 1.1 Database Schema

\`\`\`prisma  
// Meja Permainan (Table)  
model GameTable {  
  id            String   @id @default(cuid())  
  warung\_id     String?  @map("warung\_id") // Bisa terikat ke Warung Kopi tertentu  
  game\_type     String   @map("game\_type") // "gapleh", "remi", "bridge", "truf", "poker", "catur"  
  name          String  
  max\_players   Int      @map("max\_players")  
  min\_players   Int      @map("min\_players")  
  status        String   @default("waiting") // "waiting", "playing", "finished"  
  is\_private    Boolean  @default(false) @map("is\_private")  
  password      String?  // Untuk meja privat  
  config        Json?    // Konfigurasi khusus (misal: blind poker, waktu per turn)  
  host\_id       String   @map("host\_id")  
  created\_at    DateTime @default(now()) @map("created\_at")  
  started\_at    DateTime? @map("started\_at")  
  finished\_at   DateTime? @map("finished\_at")

  players       GamePlayer\[\]  
  spectators    GameSpectator\[\]  
  game\_state    GameState?  
}

// Pemain di Meja  
model GamePlayer {  
  id           String   @id @default(cuid())  
  table\_id     String   @map("table\_id")  
  user\_id      String   @map("user\_id")  
  seat\_number  Int      @map("seat\_number")  
  team         String?  // Untuk Bridge/Remi yang pakai tim (A/B)  
  chip\_balance Float    @default(0) @map("chip\_balance") // Untuk poker  
  is\_ready     Boolean  @default(false) @map("is\_ready")  
  is\_active    Boolean  @default(true) @map("is\_active") // False jika sudah keluar/selesai  
  joined\_at    DateTime @default(now()) @map("joined\_at")

  user         User     @relation(fields: \[user\_id\], references: \[id\])  
  table        GameTable @relation(fields: \[table\_id\], references: \[id\])  
}

// Penonton (Spectator)  
model GameSpectator {  
  id         String   @id @default(cuid())  
  table\_id   String   @map("table\_id")  
  user\_id    String   @map("user\_id")  
  joined\_at  DateTime @default(now()) @map("joined\_at")  
}

// State Permainan (Disimpan di Redis, tapi di-backup ke DB untuk recovery)  
model GameState {  
  id           String   @id @default(cuid())  
  table\_id     String   @unique @map("table\_id")  
  state\_data   Json     // Snapshot state lengkap (kartu, giliran, skor, dll)  
  turn\_player  String?  @map("turn\_player") // User ID yang sedang giliran  
  turn\_deadline DateTime? @map("turn\_deadline")  
  round\_number Int      @default(1) @map("round\_number")  
  updated\_at   DateTime @updatedAt @map("updated\_at")  
}

// Riwayat Pertandingan  
model GameHistory {  
  id           String   @id @default(cuid())  
  table\_id     String   @map("table\_id")  
  winner\_ids   String\[\] @map("winner\_ids")  
  loser\_ids    String\[\] @map("loser\_ids")  
  score\_data   Json     // Skor akhir  
  duration\_sec Int      @map("duration\_sec")  
  finished\_at  DateTime @default(now()) @map("finished\_at")  
}  
\`\`\`

1.2 Socket.IO Events (Namespace: /games)

Semua event menggunakan namespace /games agar terpisah dari chat.

Client → Server:

Event Payload Deskripsi  
table:create { gameType, maxPlayers, isPrivate, config } Buat meja baru  
table:join { tableId, password? } Gabung ke meja  
table:leave { tableId } Keluar dari meja  
table:ready { tableId } Tandai siap  
table:start { tableId } Host mulai permainan  
table:spectate { tableId } Jadi penonton  
game:action { tableId, action, payload } Kirim aksi (main kartu, gerak catur, dll)  
game:chat { tableId, message } Chat di meja  
game:emote { tableId, emote } Kirim reaksi cepat (👏, 😂, ☕)

Server → Client:

Event Payload Deskripsi  
table:state { table, players, spectators } Update state meja  
table:player\_joined { player } Ada pemain baru  
table:player\_left { userId } Ada pemain keluar  
game:started { initialState } Permainan dimulai  
game:state\_update { state } Update state (kirim ke pemain & penonton)  
game:your\_turn { deadline, validMoves? } Giliran Anda  
game:action\_result { success, error? } Hasil aksi  
game:finished { winners, scores } Permainan selesai  
game:chat\_message { sender, message } Pesan chat baru

1.3 Struktur Folder Backend

\`\`\`  
backend/src/games/  
├── engine/  
│   ├── BaseGame.ts          \# Abstract class untuk semua game  
│   ├── GameRegistry.ts      \# Registry untuk register game  
│   └── types.ts             \# Type definitions bersama  
├── gapleh/  
│   ├── GaplehGame.ts        \# Logika permainan  
│   ├── GaplehRules.ts       \# Validasi langkah  
│   └── types.ts  
├── remi/  
│   ├── RemiGame.ts  
│   ├── RemiRules.ts  
│   └── types.ts  
├── bridge/  
│   └── ...  
├── truf/  
│   └── ...  
├── poker/  
│   ├── PokerGame.ts  
│   ├── PokerHandEvaluator.ts  \# Gunakan pokersolver  
│   └── types.ts  
├── catur/  
│   ├── ChessGame.ts           \# Gunakan chess.js  
│   └── types.ts  
├── TableManager.ts            \# Manajemen meja (create, join, leave)  
├── MatchmakingService.ts      \# Auto-matchmaking  
└── sockets/  
    └── gameSocket.ts          \# Handler Socket.IO untuk games  
\`\`\`

1.4 BaseGame.ts (Abstract Class)

\`\`\`typescript  
export abstract class BaseGame {  
  abstract readonly gameType: string;  
  abstract readonly minPlayers: number;  
  abstract readonly maxPlayers: number;

  protected state: any;  
  protected players: GamePlayer\[\];

  constructor(players: GamePlayer\[\], config: any) {  
    this.players \= players;  
    this.state \= this.initializeState(config);  
  }

  abstract initializeState(config: any): any;  
  abstract handleAction(userId: string, action: string, payload: any): ActionResult;  
  abstract getStateForPlayer(userId: string): any; // Sembunyikan info rahasia  
  abstract getStateForSpectator(): any;  
  abstract isFinished(): boolean;  
  abstract getResults(): GameResult;

  // Helper: validasi apakah giliran user  
  protected isPlayerTurn(userId: string): boolean {  
    return this.state.currentTurn \=== userId;  
  }  
}  
\`\`\`

1.5 Aturan Keamanan (Anti-Cheat)

1\. Kartu Pemain Lain Tidak Pernah Dikirim ke Klien: Server hanya mengirim kartu milik pemain yang bersangkutan. Kartu lawan hanya dikirim sebagai jumlah (misal: "7 kartu").  
2\. Validasi Server-Side: Setiap aksi divalidasi ulang di server. Klien hanya mengirim niat ("saya mau buang kartu 5 hati"), bukan hasil akhir.  
3\. Timeout Otomatis: Jika pemain tidak bergerak dalam X detik, sistem otomatis "pass" atau "fold".  
4\. Rate Limiting: Maksimal 5 aksi per detik per pemain untuk mencegah spam.  
5\. Reconnection: State disimpan di Redis dengan TTL 1 jam. Jika pemain reconnect, state dipulihkan.

\---

BAGIAN 2: MODUL PERMAINAN (6 Game)

GAME-01: GAPLEH (Domino) 🁫

Deskripsi: Permainan domino tradisional Indonesia. 2-4 pemain, 28 kartu domino (0-0 sampai 6-6).

Aturan:

· Setiap pemain dapat 7 kartu (4 pemain) atau 4 kartu (2 pemain).  
· Pemain dengan kartu tertinggi (6-6) mulai duluan (atau berdasarkan undian).  
· Pemain bergiliran menempelkan kartu yang cocok dengan ujung terbuka di meja.  
· Jika tidak punya kartu cocok, pemain "pass".  
· Pemenang: Habiskan semua kartu duluan, atau skor tertinggi saat permainan buntu.

Logika Spesifik:

· Representasi kartu: \[a, b\] di mana a, b ∈ {0..6}  
· Papan: array kartu yang sudah dimainkan, dengan "kepala" dan "ekor"  
· Validasi langkah: kartu harus cocok dengan kepala\[0\] atau ekor\[1\]

UI:

· Kartu domino ditampilkan sebagai gambar dengan titik-titik.  
· Meja oval di tengah, kartu tersusun berurutan.  
· Animasi: kartu "ditempel" ke ujung papan.

\---

GAME-02: REMI (Rummy) 🃏

Deskripsi: Permainan kartu 4 pemain, menggunakan 2 set kartu remi (108 kartu termasuk joker).

Aturan:

· Setiap pemain dapat 11 kartu.  
· Tujuan: membentuk set (3-4 kartu sama) atau run (3+ kartu berurutan).  
· Pemain mengambil kartu dari deck atau buangan, lalu membuang 1 kartu.  
· Pemain bisa "melantai" (menurunkan semua set/run) jika sudah lengkap.  
· Skor: pemain yang menang dapat 0, lainnya dihitung dari sisa kartu.

Logika Spesifik:

· Representasi kartu: { suit: 'H'|'D'|'C'|'S', rank: 1..13, deck: 1|2 }  
· Validasi set: minimal 3 kartu dengan rank sama, suit berbeda.  
· Validasi run: minimal 3 kartu berurutan dengan suit sama.  
· Melantai: semua kartu di tangan sudah membentuk set/run valid.

\---

GAME-03: BRIDGE 🌉

Deskripsi: Permainan kartu 4 pemain, 2 tim (North-South vs East-West). Kompleks, butuh bidding.

Aturan:

· 52 kartu, 13 per pemain.  
· Fase 1: Bidding (menentukan kontrak).  
· Fase 2: Playing (memenangkan trick).  
· Skor berdasarkan kontrak dan jumlah trick yang dimenangkan.

Logika Spesifik:

· Bidding system: 1♣, 1♦, 1♥, 1♠, 1NT, 2♣ dst.  
· Trump suit ditentukan oleh bid tertinggi.  
· Setiap trick: 4 kartu dimainkan, suit tertinggi (atau trump) menang.  
· Tim: North-South vs East-West (berdasarkan seat number).

Catatan: Bridge sangat kompleks. Untuk MVP, implementasikan versi sederhana tanpa bidding lanjutan (misal: "kontrak otomatis").

\---

GAME-04: TRUF (Trick-Taking) 🎴

Deskripsi: Permainan kartu 4 pemain, mirip Bridge tapi lebih sederhana. Cocok untuk pemula.

Aturan:

· 52 kartu, 13 per pemain.  
· Tidak ada bidding. Trump suit ditentukan dengan membuka 1 kartu dari deck.  
· Pemain bergiliran main kartu. Harus mengikuti suit jika punya.  
· Pemain dengan kartu tertinggi (atau trump) menang trick.  
· Pemenang: yang paling banyak menang trick.

Logika Spesifik:

· Sama seperti Bridge tapi tanpa fase bidding.  
· Simple dan cepat dimainkan.

\---

GAME-05: POKER ♠️

Deskripsi: Texas Hold'em Poker. 2-9 pemain.

Aturan:

· Setiap pemain dapat 2 kartu (hole cards).  
· 5 kartu komunitas dibuka bertahap (flop, turn, river).  
· Fase taruhan: pre-flop, flop, turn, river.  
· Aksi: check, bet, call, raise, fold, all-in.  
· Pemenang: kombinasi terbaik dari 5 kartu (2 hole \+ 3 community).

Logika Spesifik:

· Gunakan pokersolver untuk evaluasi tangan.  
· Chip balance per pemain (bisa menggunakan BMC atau chip virtual).  
· Blind structure: small blind, big blind, naik setiap X menit.  
· Side pot untuk all-in.

Integrasi BMC (Opsional):

· Mode "Kasual" → chip virtual gratis.  
· Mode "BMC" → chip dibeli dengan BMC, pemenang dapat BMC.

\---

GAME-06: CATUR (Chess) ♟️

Deskripsi: Catur standar internasional. 2 pemain.

Aturan:

· Papan 8x8, 16 bidak per pemain.  
· Langkah valid: pion, kuda, benteng, gajah, ratu, raja.  
· Skak, skakmat, en passant, castling, promosi pion.  
· Waktu: blitz (5 menit), rapid (15 menit), klasik (60 menit).

Logika Spesifik:

· Gunakan library chess.js di backend untuk validasi.  
· Frontend: react-chessboard untuk UI.  
· Timer per pemain, hitung mundur.  
· PGN export untuk riwayat.

\---

BAGIAN 3: UI/UX "MEJA WARKOP"

3.1 Halaman Lobby Permainan

· Tabs: Gapleh | Remi | Bridge | Truf | Poker | Catur  
· Kartu Meja: Menampilkan meja yang tersedia (publik) dengan info:  
  · Nama meja, host, jumlah pemain (2/4), status (waiting/playing)  
  · Tombol "Gabung" atau "Tonton"  
· Tombol "+ Buat Meja Baru" → modal untuk konfigurasi meja.

3.2 Halaman Meja Permainan

Layout:

\`\`\`  
\+--------------------------------------------------+  
|  ← Kembali  |  Meja: "Ngopi Bareng"  |  👥 4/4  |  
\+--------------------------------------------------+  
|                                                  |  
|              \[ AREA PERMAINAN \]                  |  
|         (Kartu/Papan ditampilkan di sini)        |  
|                                                  |  
\+--------------------------------------------------+  
|  \[Pemain 1\]  \[Pemain 2\]  \[Pemain 3\]  \[Pemain 4\] |  
|   (avatar)    (avatar)    (avatar)    (avatar)   |  
\+--------------------------------------------------+  
|  💬 Chat  |  🎤 Voice  |  😀 Emote  |  👁️ Spect  |  
\+--------------------------------------------------+  
|  \[Kartu di Tangan Anda\]                          |  
\+--------------------------------------------------+  
\`\`\`

3.3 Fitur Sosial di Meja

· Voice Chat: Otomatis aktif saat pemain join (bisa di-mute).  
· Chat Teks: Kolom chat di samping.  
· Emote Cepat: Tombol emoji besar (👏, 😂, ☕, 🔥, 💩) yang muncul melayang di meja.  
· Spectator Mode: Penonton bisa melihat semua kartu (mode "God View") atau hanya kartu terbuka.  
· "Traktir Kopi": Kirim BMC ke pemain lain sebagai bentuk sportivitas.

3.4 Integrasi "Warung Kopi"

· Setiap Warung bisa memiliki "Meja Tetap" (permanent table) yang selalu tersedia.  
· Ada Leaderboard Warung untuk game tertentu.  
· Turnamen Mingguan: Setiap Sabtu malam, turnamen poker/catur dengan hadiah BMC.

\---

BAGIAN 4: PRIORITAS & SPRINT

Sprint Fitur Estimasi  
Sprint 1 Infrastruktur Game Engine (BaseGame, TableManager, Socket.IO namespace, DB schema) 2 minggu  
Sprint 2 Gapleh (paling sederhana, cocok untuk testing) \+ Lobby UI 2 minggu  
Sprint 3 Catur (gunakan chess.js, cepat) \+ Truf 2 minggu  
Sprint 4 Remi \+ Poker (dengan pokersolver) 3 minggu  
Sprint 5 Bridge (paling kompleks) \+ Turnamen & Leaderboard 3 minggu  
Sprint 6 Integrasi BMC (mode taruhan), Spectator, Replay 2 minggu

Rekomendasi Urutan: Mulai dari Gapleh dan Catur karena keduanya punya aturan yang jelas dan library pendukung. Setelah infrastruktur stabil, baru tambah game lain.

\---

BAGIAN 5: PROMPT EKSEKUSI UNTUK AI AGENT

"Mulai dari Sprint 1: Bangun Infrastruktur Game Engine.

1\. Buat folder backend/src/games/ dengan struktur yang sudah ditentukan.  
2\. Implementasikan BaseGame.ts sebagai abstract class.  
3\. Buat TableManager.ts untuk CRUD meja (create, join, leave, list).  
4\. Tambahkan schema Prisma untuk GameTable, GamePlayer, GameSpectator, GameState, GameHistory.  
5\. Setup Socket.IO namespace /games dengan semua event yang terdaftar.  
6\. Buat endpoint REST untuk lobby: GET /api/games/tables?type=gapleh, POST /api/games/tables, DELETE /api/games/tables/:id.  
7\. Implementasikan satu game sederhana: Gapleh sebagai proof-of-concept.  
8\. Buat UI Lobby dan UI Meja Permainan (dengan placeholder untuk area permainan).

Setelah Sprint 1 selesai, beri saya laporan: file apa saja yang dibuat, cara menjalankan, dan apa yang perlu di-test. Lanjutkan ke Sprint 2 hanya setelah saya konfirmasi."\*\*

\---

BAGIAN 6: CATATAN AKHIR

· Jangan reinvent the wheel: Gunakan chess.js untuk catur, pokersolver untuk poker. Hemat waktu.  
· Test dengan bot: Buat bot sederhana untuk menguji game sebelum ada pemain nyata.  
· Mobile-first: Pastikan kartu bisa di-tap dengan nyaman di layar HP 5 inci.  
· Animasi halus: Gunakan Framer Motion untuk kartu terbang, kocokan, dan transisi.  
· Suara: Tambahkan sound effect (kartu di-kocok, catur dimainkan) untuk pengalaman imersif.  
· Privasi: Kartu pemain lain TIDAK PERNAH dikirim ke klien. Ini prinsip nomor satu.

Selamat membangun "Meja Warkop" — semoga Ngopi menjadi tempat nongkrong digital paling seru di Indonesia\! ☕🃏♟️

\`\`\`

\---

\#\#\# 🚀 Cara Menggunakan

1\. Simpan file di atas sebagai \`PROMPT\_NGOPI\_GAMES.md\` di root project.  
2\. Buka Cursor / Windsurf / Codex, \*attach\* file ini.  
3\. Berikan perintah:    
   \> \*"Mulai dari Sprint 1\. Bangun infrastruktur game engine terlebih dahulu, lalu implementasikan Gapleh sebagai proof-of-concept. Sertakan kode lengkap, schema database, dan cara testing."\*  
4\. Setelah Sprint 1 selesai, minta laporan, lalu lanjutkan ke Sprint 2\.

\#\#\# 💡 Tips Tambahan

\- \*\*Untuk testing cepat\*\*: Sebelum ada pemain nyata, buat \*\*bot AI sederhana\*\* yang bisa main Gapleh atau Catur. Ini akan sangat membantu debugging.  
\- \*\*Untuk monetisasi\*\*: Mode poker dengan BMC bisa menjadi sumber pendapatan (fee meja 5%).  
\- \*\*Untuk viralitas\*\*: Buat \*\*"Meja Publik"\*\* yang bisa ditonton siapa saja, seperti live streaming. Ini akan menarik banyak pengguna.

Dengan fitur ini, Ngopi bukan lagi sekadar aplikasi chat, tetapi \*\*platform sosial lengkap\*\* yang menghidupkan kembali budaya warkop Indonesia di era digital. Selamat berkarya\! ☕🎮