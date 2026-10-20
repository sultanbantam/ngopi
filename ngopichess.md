Berikut adalah PROMPT\_NGOPI\_CHESS\_PRO.md — prompt lengkap untuk membangun kategori Catur Profesional dengan sistem level bot yang spesifik, poin taruhan (bisa minus), dan kepribadian bot. Prompt ini siap dijalankan di Antigravity IDE.

\---

\`\`\`markdown  
\# PROMPT: Fitur Catur Profesional (Bot Multi-Level & Sistem Poin Minus)

\#\# 0\. KONTEKS & ATURAN UTAMA

\- \*\*Aplikasi\*\*: Ngopi (https\://ngopi.top)  
\- \*\*Tujuan\*\*: Menambahkan kategori \*\*Catur Profesional\*\* di samping kategori \*\*Basic\*\* (sistem catur lama tidak boleh diubah/dirusak).  
\- \*\*Sistem Poin\*\*: User bisa menang atau kalah taruhan poin. Jika poin tidak cukup, saldo user \*\*boleh menjadi minus (-)\*\*.  
\- \*\*Level Bot\*\*: Terdiri dari 9 level (0-8), dengan nama karakter dan nilai taruhan poin yang berbeda-beda. Level 8 harus benar-benar selevel dengan Master Catur Dunia (menggunakan engine Stockfish dengan settingan maksimal).

\---

\#\# 1\. KONFIGURASI BOT (STOCKFISH PARAMETERS)

Gunakan \*\*Stockfish\*\* (via \`stockfish.js\` atau wrapper backend) untuk menggerakkan bot. Atur \*Skill Level\*, \*Depth\*, dan \*Time Limit\* sesuai tingkat kesulitan:

| Level | Nama Bot | Kelas | Menang/Kalah | Skill Level | Depth | Time (ms) | Elo Est. |  
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |  
| 0 | \*\*Tonah\*\* | Kelas Bulu | ±50 | 0 | 1 | 50 | \~600 |  
| 1 | \*\*Pe'i\*\* | Kelas Dasar | ±75 | 3 | 2 | 100 | \~1000 |  
| 2 | \*\*Juned\*\* | Kelas Menengah | ±100 | 7 | 4 | 300 | \~1400 |  
| 3 | \*\*To'ip\*\* | Kelas Atas | ±125 | 10 | 6 | 500 | \~1800 |  
| 4 | \*\*Su'eb\*\* | Kelas Diploma | ±150 | 13 | 8 | 800 | \~2000 |  
| 5 | \*\*Keting\*\* | Kelas Tinggi | ±175 | 16 | 10 | 1200 | \~2200 |  
| 6 | \*\*Gudal\*\* | Kelas Master | ±200 | 18 | 12 | 2000 | \~2400 |  
| 7 | \*\*Petoak\*\* | Kelas Doktor | ±500 | 20 | 15 | 3000 | \~2600 |  
| 8 | \*\*Messi\*\* | Kelas Professor | ±1000 | 20 | 20+ | 5000 | \~3000+ |

\*\*Catatan Penting\*\*: Level 8 (Messi) harus menggunakan settingan Stockfish tertinggi (depth 20+, endgame tablebase jika memungkinkan) agar benar-benar sulit dikalahkan (World Class).

\---

\#\# 2\. DATABASE SCHEMA (PRISMA)

Buat tabel untuk mencatat pertandingan dan profil bot.

\`\`\`prisma  
model ChessProMatch {  
  id              String   @id @default(cuid())  
  user\_id         String   @map("user\_id")  
  bot\_level       Int      @map("bot\_level")  
  bot\_name        String   @map("bot\_name")  
  result          String   // "win", "lose", "draw"  
  points\_changed  Int      // Positif jika menang, negatif jika kalah (misal: \-50)  
  user\_points\_before Int   @map("user\_points\_before")  
  user\_points\_after  Int   @map("user\_points\_after")  
  pgn             String?  // Simpan notasi langkah untuk replay  
  duration\_sec    Int  
  created\_at      DateTime @default(now())  
}

model BotChessProfile {  
  id              String   @id @default(cuid())  
  name            String   @unique // "Tonah", "Messi", dll  
  level           Int      @unique // 0-8  
  total\_matches   Int      @default(0)  
  total\_wins      Int      @default(0)  
  total\_losses    Int      @default(0)  
  updated\_at      DateTime @updatedAt  
}  
\`\`\`

Update Tabel Poin User (Jika sudah ada):  
Pastikan tipe data points di tabel UserPoints adalah Integer dan mengizinkan nilai negatif (di PostgreSQL/Prisma, Int secara default mengizinkan negatif).

\---

3\. LOGIKA BACKEND & POIN MINUS

A. Endpoint Memulai Game

· POST /api/chess/pro/start  
· Body: { bot\_level: number }  
· Response: { match\_id, fen, bot\_info }  
· Validasi: Tidak perlu mengecek apakah poin user cukup. User dengan 0 poin tetap boleh main.

B. Endpoint Menyelesaikan Game

· POST /api/chess/pro/finish  
· Body: { match\_id, result: "win" | "lose" | "draw", pgn }  
· Logika Poin:  
  \`\`\`typescript  
  const pointStakes \= \[50, 75, 100, 125, 150, 175, 200, 500, 1000\];  
  const stake \= pointStakes\[bot\_level\];  
    
  let pointsChanged \= 0;  
  if (result \=== 'win') pointsChanged \= stake;  
  else if (result \=== 'lose') pointsChanged \= \-stake;  
  // draw \= 0  
    
  // Update user points (bisa minus)  
  const newPoints \= user.current\_points \+ pointsChanged;  
  await prisma.userPoints.update({  
    where: { user\_id },  
    data: { balance: newPoints }  
  });  
  \`\`\`

C. Integrasi Stockfish (Backend)

· Gunakan library stockfish atau spawn proses stockfish di server.  
· Endpoint POST /api/chess/pro/move:  
  · Kirim FEN \+ langkah user ke Stockfish.  
  · Terima Best Move dari Stockfish dengan parameter (Skill, Depth, Time) sesuai level.  
  · Kembalikan langkah bot ke frontend.

\---

4\. UI/UX FRONTEND (React)

A. Halaman Pemilihan Mode

· Di menu Game \> Catur, tampilkan 2 pilihan tab/kartu:  
  1\. Basic (Main Biasa) \-\> Route ke sistem catur lama.  
  2\. Profesional (Taruhan Poin) \-\> Route ke sistem baru.

B. Halaman Pemilihan Lawan (Catur Profesional)

· Tampilkan daftar 9 bot dalam bentuk grid atau list yang scrollable.  
· Setiap kartu bot berisi:  
  · Avatar (bisa pakai emoji/ilustrasi catur).  
  · Nama Bot (Tonah, Pe'i, Juned, dll).  
  · Kelas (Bulu, Dasar, Menengah, dll).  
  · Taruhan Poin: \+50 / \-50 (warna hijau untuk plus, merah untuk minus).  
  · Tombol "Tantang".

C. Halaman Permainan (Papan Catur)

· Gunakan library react-chessboard.  
· Tampilkan informasi di atas papan:  
  · Lawan: Tonah (Kelas Bulu)  
  · Taruhan: ±50 Poin  
  · Poin Anda: 10 Poin (atau \-40 Poin jika minus)  
· Indikator loading saat bot berpikir ("Tonah sedang berpikir...").

D. Modal Hasil Akhir (Game Over)

· Jika Menang: Tampilkan animasi kemenangan \+ teks "+50 Poin".  
· Jika Kalah: Tampilkan "-50 Poin".  
· Jika Poin Menjadi Minus: Tampilkan peringatan khusus:   
  "Poin Anda sekarang \-10. Terus main dan menangkan kembali poin Anda\!"  
· Tombol "Main Lagi" dan "Kembali ke Lobi".

\---

5\. BOT PERSONALITY (Opsional, untuk menambah kesan "hidup")

Beri sedikit flavor text untuk setiap bot saat bermain:

· Tonah: "Ayo main, aku masih belajar nih..." (sering membuat langkah blunder).  
· Pe'i: "Jangan remehkan aku ya."  
· Juned: "Catur itu soal sabar."  
· To'ip: "Langkahmu sudah kubaca."  
· Su'eb: "Menarik... tapi kurang tajam."  
· Keting: "Kau bermain bagus, tapi belum cukup."  
· Gudal: "Skakmat dalam 10 langkah."  
· Petoak: "Analisis posisimu sudah selesai."  
· Messi: "Tidak ada yang bisa mengalahkanku di papan ini."

\---

6\. PERINTAH EKSEKUSI UNTUK AI AGENT

"Tugas Anda adalah menambahkan fitur 'Catur Profesional' tanpa merusak fitur 'Catur Basic' yang sudah ada.

Langkah Eksekusi:

1\. Database: Buat tabel ChessProMatch dan BotChessProfile. Pastikan field balance di tabel poin user mengizinkan angka negatif.  
2\. Backend \- Bot Engine: Setup Stockfish (pastikan binary stockfish atau stockfish.js terinstall). Buat fungsi untuk mengonfigurasi Skill Level, Depth, dan Time berdasarkan konfigurasi 9 level di atas.  
3\. Backend \- API: Buat endpoint /api/chess/pro/start, /api/chess/pro/move, dan /api/chess/pro/finish. Implementasikan logika penambahan/pengurangan poin taruhan, termasuk update ke database yang bisa minus.  
4\. Frontend \- UI: Buat halaman pemilihan lawan (menampilkan 9 bot dengan nama dan taruhan poinnya). Buat halaman papan catur yang menampilkan status taruhan poin.  
5\. Frontend \- Hasil: Buat modal kemenangan/kekalahan yang menampilkan perubahan poin secara jelas (termasuk peringatan jika poin menjadi minus).  
6\. Testing: Buat unit test untuk memastikan jika user kalah di Level 0 (Tonah), poinnya berkurang 50 dan bisa menjadi \-50.  
7\. Laporkan file apa saja yang dibuat/diubah setelah selesai."

\`\`\`

\---

\#\#\# 💡 Catatan Tambahan untuk Anda:  
1\. \*\*Kenapa Level 8 (Messi) begitu sulit?\*\* Stockfish dengan Skill Level 20, Depth 20+, dan waktu pikir 5 detik sudah tidak bisa dikalahkan oleh manusia biasa (Grandmaster pun akan kesulitan). Ini akan memberikan pengalaman "melawan dewa catur" yang sesungguhnya.  
2\. \*\*Kenapa Poin Bisa Minus?\*\* Ini adalah strategi psikologis (FOMO / \*Loss Aversion\*). Ketika pemain melihat poinnya menjadi \`-50\`, mereka akan terpicu untuk terus bermain dan menang untuk mengembalikan poinnya menjadi positif. (Pastikan ini diatur dengan bijak agar tidak membuat pemain frustrasi).  
3\. \*\*Integrasi dengan BMC\*\*: Kelak, jika poin sudah banyak, sistem ini bisa dihubungkan dengan konversi ke Token BMC (misal: 1000 poin \= 1 BMC).