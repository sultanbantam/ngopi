Berikut adalah PROMPT\_NGOPI\_TRUF\_PEKAI.md — prompt lengkap untuk mengganti sistem "Cangkulan" di game Truf PeKaI menjadi aturan Truf (Trick-Taking) yang sebenarnya.

Prompt ini dirancang untuk langsung dijalankan oleh AI Agent (Antigravity IDE, Cursor, Windsurf).

\---

\`\`\`markdown  
\# PROMPT: Rewrite Game "Truf PeKaI" — Sistem Trick-Taking (Bukan Cangkulan)

\#\# 0\. KONTEKS & MASALAH

\- \*\*Aplikasi\*\*: Ngopi (https\://ngopi.top)  
\- \*\*Game\*\*: Truf PeKaI (saat ini ada di menu Games).  
\- \*\*Masalah\*\*: Logika game saat ini salah. Sistem yang berjalan sekarang meniru permainan \*\*Cangkulan\*\* (mengumpulkan set kartu / Go-Fish), padahal seharusnya \*\*Truf\*\* (permainan trik / trick-taking dengan penawaran / bidding).  
\- \*\*Tujuan\*\*: Hapus total logika Cangkulan dan tulis ulang mesin game (Game Engine) \`TrufPeKaiGame.ts\` agar sesuai dengan aturan standar Truf Indonesia.

\---

\#\# 1\. ATURAN PERMAINAN TRUF YANG BENAR (WAJIB DIPATUHI)

\#\#\# A. Setup Awal  
\- \*\*Jumlah Pemain\*\*: Tepat \*\*4 orang\*\* (bisa manusia semua atau kombinasi dengan Bot).  
\- \*\*Kartu\*\*: 1 set kartu remi standar (52 kartu, tanpa Joker).  
\- \*\*Pembagian\*\*: Masing-masing pemain mendapat \*\*13 kartu\*\*.  
\- \*\*Urutan Nilai\*\*: 2 (terendah) \-\> 3 \-\> 4 \-\> 5 \-\> 6 \-\> 7 \-\> 8 \-\> 9 \-\> 10 \-\> J \-\> Q \-\> K \-\> A (tertinggi).

\#\#\# B. Fase 1: Penawaran (Bidding)  
\- Setiap pemain memilih \*\*1 kartu secara tertutup\*\* dari tangan mereka untuk dijadikan "tawaran".  
\- Angka pada kartu tersebut adalah target jumlah trik yang ingin mereka menangkan (misal: menaruh kartu '5' berarti target menang 5 trik; menaruh 'A' berarti target 1 trik, menaruh 'K' berarti target 13 trik).  
\- Setelah semua pemain memilih, kartu tawaran dibuka bersamaan.  
\- \*\*Penentuan Truf\*\*: \*Suit\* (kembang) dari kartu tawaran dengan \*\*nilai tertinggi\*\* otomatis menjadi \*\*Kembang Truf\*\* untuk ronde tersebut.  
\- Pemain dengan tawaran tertinggi menjadi \*\*Pemimpin (Leader)\*\* di trik pertama.

\#\#\# C. Fase 2: Mode Permainan (Main Atas / Main Bawah)  
\- Hitung total angka dari keempat kartu tawaran.  
\- Jika total \*\*\> 13\*\*: Mode \*\*Main Atas\*\*. Pemain berusaha menang sebanyak mungkin untuk mencapai target.  
\- Jika total \*\*\< 13\*\*: Mode \*\*Main Bawah\*\*. Pemain justru berusaha \*menghindari\* kemenangan (mengalah) agar tidak melebihi target.  
\- Jika total \*\*= 13\*\*: Permainan Batal (Void) dan harus di-\*shuffle\* ulang.

\#\#\# D. Fase 3: Jalannya Trik (Trick-Taking)  
\- Leader memainkan 1 kartu.  
\- Pemain lain \*\*WAJIB mengikuti kembang (suit)\*\* yang sama jika mereka memilikinya.  
\- Jika tidak punya kembang tersebut, pemain bebas memainkan kartu apa saja (buang kartu lain atau mainkan Truf).  
\- \*\*Aturan Spesial Truf (Sangat Penting)\*\*:   
  \- Jika pemain memainkan \*\*Kartu Truf\*\*, kartu tersebut harus diletakkan \*\*TERTUTUP\*\* (face down).  
  \- Kartu truf tertutup baru akan \*\*DIBUKA bersamaan\*\* setelah keempat pemain selesai menaruh kartu di meja.  
\- \*\*Pemenang Trik\*\*:   
  \- Jika tidak ada truf yang dimainkan, pemenangnya adalah kartu tertinggi dari kembang yang dimainkan di trik pertama.  
  \- Jika ada truf yang dimainkan, pemain dengan kartu truf tertinggi yang menang.  
\- Pemenang trik memimpin trik berikutnya.

\#\#\# E. Fase 4: Skor (Scoring)  
\- Setelah 13 trik selesai, hitung skor.  
\- \*\*Main Atas\*\*: Jika target tercapai, dapat poin positif (+target). Jika gagal, dapat poin negatif (-target).  
\- \*\*Main Bawah\*\*: Jika berhasil menghindar (jumlah trik yang didapat \<= target), dapat poin positif. Jika gagal, dapat poin negatif.

\---

\#\# 2\. STRUKTUR KODE & DATABASE

\#\#\# A. State Permainan (TypeScript Interface)  
\`\`\`typescript  
interface TrufState {  
  phase: 'bidding' | 'playing' | 'scoring';  
  hands: Map\<string, Card\[\]\>; // userId \-\> 13 kartu  
  bids: Map\<string, { card: Card, revealed: boolean }\>;  
  trickCards: Array\<{ userId: string, card: Card, isTrump: boolean, isFaceDown: boolean }\>;  
  currentLeaderId: string;  
  currentTurnId: string;  
  trumpSuit: Suit | null;  
  mode: 'main\_atas' | 'main\_bawah' | null;  
  tricksWon: Map\<string, number\>;  
  history: any\[\];  
}

interface Card {  
  suit: 'H' | 'D' | 'C' | 'S';  
  rank: '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A';  
  value: number; // 2 \= 2, ..., J \= 11, Q \= 12, K \= 13, A \= 14  
}  
\`\`\`

B. Logika Backend (TrufPeKaiGame.ts)

\`\`\`typescript  
// 1\. Fase Bidding  
public submitBid(userId: string, card: Card) {  
  // Validasi: Kartu harus ada di tangan user.  
  // Simpan ke state.bids.  
  // Jika semua 4 pemain sudah bid \-\> resolveBidding()  
}

private resolveBidding() {  
  // Cari bid tertinggi berdasarkan nilai \`card.value\`.  
  // Tentukan trumpSuit dari suit bid tertinggi.  
  // Hitung total bid. Tentukan mode (Atas/Bawah). Jika 13, reset game.  
  // Set currentTurnId \= pemilik bid tertinggi.  
  // Ubah phase \= 'playing'.  
}

// 2\. Fase Playing  
public playCard(userId: string, card: Card) {  
  // Validasi giliran (currentTurnId).  
  // Validasi: Jika bukan leader, dan punya suit yang diminta (ledSuit), WAJIB main suit tersebut.  
  // Jika kartu adalah Truf (card.suit \=== trumpSuit):  
  //   \- Set isFaceDown \= true (jika belum ada trik yang selesai).  
  // Tambahkan ke trickCards.  
  // Jika semua 4 pemain sudah main \-\> resolveTrick()  
}

private resolveTrick() {  
  // 1\. Buka semua kartu truf yang tertutup (reveal).  
  // 2\. Evaluasi kartu tertinggi. (Truf tertinggi menang, atau suit tertinggi jika tanpa truf).  
  // 3\. Tambah tricksWon pemenang.  
  // 4\. Kosongkan trickCards.  
  // 5\. Set currentLeaderId & currentTurnId ke pemenang trik.  
  // 6\. Jika 13 trik selesai \-\> phase \= 'scoring', hitung skor akhir.  
}  
\`\`\`

\---

3\. UI/UX FRONTEND (React)

A. Fase Bidding

· Tampilkan 13 kartu pemain.  
· Munculkan instruksi: "Pilih 1 kartu untuk tawaran (Bidding)".  
· Saat kartu diklik, kirim ke backend.  
· Tampilkan indikator loading / "Menunggu pemain lain...".  
· Setelah semua bid, munculkan Modal Animasi yang membuka 4 kartu tawaran, memperlihatkan Suit Truf (misal: "Truf: Hati ♥️"), dan memberitahu Mode (Atas/Bawah).

B. Fase Playing (Trik)

· Meja (Center): Tampilkan 4 slot kartu yang dimainkan.  
· Kartu Truf Tertutup: Jika pemain memainkan truf, tampilkan punggung kartu (biru/merah). Baru berubah jadi gambar asli saat trik selesai.  
· Indikator Turn: Sorot nama/avatar pemain yang sedang giliran.  
· Validasi UI: Nonaktifkan kartu yang tidak boleh dimainkan (jika melanggar aturan follow suit).  
· Animasi: Gunakan framer-motion saat kartu dilempar ke tengah meja.

C. Fase Scoring

· Tampilkan tabel hasil: Target vs Trik yang didapat.  
· Tampilkan siapa yang menang/rugi.  
· Tombol "Main Lagi".

\---

4\. BOT AI TRUF (Opsional untuk MVP)

· Jika ada slot kosong, isi dengan Bot.  
· Logika Bot dasar:  
  · Bidding: Acak kartu 2-5.  
  · Playing: Selalu mengikuti suit. Jika tidak punya, buang kartu terkecil. Jika Bot adalah Leader, buang kartu terbesar.

\---

5\. PERINTAH EKSEKUSI UNTUK AI AGENT

"Tugas Anda adalah mengganti total logika Game Truf PeKaI dari sistem Cangkulan menjadi sistem Trick-Taking (Truf standar).

Langkah Eksekusi:

1\. Cari file logika game Truf yang sekarang (kemungkinan bernama TrufGame.ts atau serupa).  
2\. Hapus atau rename file tersebut menjadi TrufPeKaiGame.ts (atau sesuaikan dengan registry).  
3\. Implementasikan State Machine dan Interface seperti yang dijelaskan di Bagian 2 di atas.  
4\. Tulis logika submitBid, resolveBidding, playCard, dan resolveTrick dengan ketat. Pastikan aturan "Kartu Truf Tertutup" diimplementasikan dengan benar (state isFaceDown \= true).  
5\. Perbaiki UI di Frontend (frontend/src/pages/games/truf/):  
   · Tambahkan UI Bidding.  
   · Ubah animasi meja untuk mendukung Face-Down Cards (kartu tertutup).  
6\. Buat unit test (truf.test.ts) untuk mensimulasikan satu putaran penuh (Bidding \-\> Main 13 Trik \-\> Skor).  
7\. Setelah selesai, jalankan build dan laporkan file apa saja yang diubah/dibuat."

\---

LAMPIRAN: CONTOH SKENARIO PENGUJIAN (TEST CASE)

1\. Bidding:  
   · P1 bid 2 Hati (2)  
   · P2 bid 10 Sekop (10)  
   · P3 bid 5 Keriting (5)  
   · P4 bid 3 Wajik (3)  
   · Total: 20 (\>13) \-\> Mode: Main Atas.  
   · Truf: Sekop (♠️) karena P2 menaruh nilai tertinggi (10).  
   · Leader: P2.  
2\. Trick 1:  
   · P2 main 5 Sekop.  
   · P3 tidak punya Sekop, main 2 Hati (Truf tidak mungkin karena trufnya Sekop). (Tunggu, jika truf Sekop, P3 buang Hati).  
   · P4 punya Sekop, main As Sekop.  
   · P1 tidak punya Sekop, main 4 Sekop (Truf? Tidak, 4 Sekop itu kembang Sekop, bukan truf tertutup. Aturan: kartu truf tertutup hanya berlaku jika dimainkan saat tidak punya kembang yang diminta). CATATAN PENTING: Aturan "Truf Tertutup" hanya berlaku saat pemain memainkan kartu Truf karena tidak memiliki kembang (suit) yang diminta. Jika Sekop adalah truf, dan P2 main Sekop, maka itu bukan "Truf Tertutup" (karena kembang yang diminta adalah Sekop). Jika P3 tidak punya Hati, dan memainkan Sekop, maka Sekop itu diletakkan tertutup.

\`\`\`

\#\#\# 🚀 Cara Menggunakan

1\. \*\*Copy\*\* seluruh teks di atas.  
2\. \*\*Simpan\*\* sebagai \`PROMPT\_NGOPI\_TRUF\_PEKAI.md\` di root project Ngopi.  
3\. Buka \*\*Antigravity IDE\*\*, \*attach\* file ini ke AI Agent.  
4\. Beri perintah:    
   \> \*"Jalankan perintah di PROMPT\_NGOPI\_TRUF\_PEKAI.md. Ganti total sistem Truf PeKaI menjadi sistem Trick-Taking. Laporkan jika sudah selesai dan siap di-test."\*

Dengan prompt ini, AI akan dipaksa untuk membuang logika "Cangkulan" dan membangun mesin Truf yang sesungguhnya, lengkap dengan fase \*Bidding\* dan aturan \*Kartu Truf Tertutup\*. ☕🃏🚀