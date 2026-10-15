Berikut adalah PROMPT\_NGOPI\_HT.md — prompt lengkap untuk mengintegrasikan teknologi HT (Handy Talky) ke dalam aplikasi Ngopi, memungkinkan komunikasi suara dan teks melalui radio VHF/UHF tanpa internet. Prompt ini dirancang untuk dijalankan oleh AI Agent (Antigravity IDE, Cursor, Windsurf) dan dapat digabungkan dengan prompt Ngopi lainnya.

\---

\`\`\`markdown  
\# PROMPT: Ngopi HT (Handy Talky) — Komunikasi Radio Tanpa Internet

\#\# 0\. KONTEKS & VISI

\- \*\*Aplikasi\*\*: Ngopi (https\://ngopi.top)  
\- \*\*Tujuan\*\*: Menambahkan mode komunikasi \*\*HT (Handy Talky)\*\* ke Ngopi, sehingga pengguna dapat mengirim pesan teks dan suara melalui radio VHF/UHF saat internet mati atau di daerah terpencil.  
\- \*\*Filosofi\*\*: Ngopi sebagai "Warung Kopi Digital" harus tetap bisa digunakan dalam kondisi darurat, bencana, atau aktivitas outdoor (pendakian, kemah, ekspedisi).  
\- \*\*Target Pengguna\*\*:   
  \- Pengguna dengan lisensi radio amatir (ORARI) atau KRAP.  
  \- Tim SAR, relawan bencana, komunitas outdoor.  
  \- Pengguna umum yang ingin komunikasi jarak jauh tanpa internet (dengan catatan legal).

\*\*Peringatan Hukum\*\*: Penggunaan frekuensi radio di Indonesia diatur oleh Kominfo. Pengguna \*\*WAJIB\*\* memiliki izin (IAR/KRAP) atau beroperasi di bawah pengawasan organisasi resmi (ORARI). Prompt ini hanya untuk keperluan teknis; kepatuhan hukum sepenuhnya tanggung jawab pengguna.

\---

\#\# 1\. ARSITEKTUR UMUM

\#\#\# 1.1 Dua Pendekatan Integrasi HT ke Smartphone

| Pendekatan | Metode | Kelebihan | Kekurangan |  
| :--- | :--- | :--- | :--- |  
| \*\*A. Akustik (Ribbit-style)\*\* | App mengubah data menjadi sinyal audio, dikirim via speaker HP ke mic HT. Sebaliknya, HT menerima sinyal, speaker HT ke mic HP. | Tidak perlu hardware tambahan. HP apa pun bisa. | Kecepatan sangat lambat (hanya teks). Rentan noise. |  
| \*\*B. Hardware Dongle (kv4p-style)\*\* | Dongle HT USB-C yang terhubung ke HP. App mengontrol dongle via USB serial. | Kecepatan lebih baik, bisa voice PTT. | Perlu beli hardware tambahan (\~\$30-50). |

\*\*Rekomendasi\*\*: Implementasikan \*\*keduanya\*\* sebagai opsi. Mulai dari Akustik (gratis, mudah diuji) lalu tambahkan dukungan Hardware.

\#\#\# 1.2 Protokol Data yang Didukung  
\- \*\*APRS (Automatic Packet Reporting System)\*\*: Untuk teks, GPS, cuaca. Standar radio amatir.  
\- \*\*DMR (Digital Mobile Radio)\*\*: Untuk voice dan teks digital. Lebih modern.  
\- \*\*AX.25\*\*: Protokol packet radio klasik (bisa digunakan untuk teks).  
\- \*\*Custom Audio FSK\*\*: Modulasi sederhana untuk teks (jika APRS tidak tersedia).

\#\#\# 1.3 Integrasi dengan Ngopi  
\- \*\*Mode HT\*\* diaktifkan dari menu "Pengaturan" → "Mode Offline" → "HT Radio".  
\- Pesan yang dikirim via HT akan \*\*disinkronkan\*\* ke server Ngopi saat internet kembali (store-and-forward).  
\- \*\*Grup HT\*\*: Pengguna bisa membuat "Warung HT" dengan frekuensi dan CTCSS/DCS yang disepakati.  
\- \*\*Peta HT\*\*: Tampilkan lokasi pengguna HT lain (jika mereka mengirim koordinat GPS via APRS).

\---

\#\# 2\. DATABASE SCHEMA (Tambahan)

\`\`\`prisma  
// Profil HT Pengguna  
model HTProfile {  
  id             String   @id @default(cuid())  
  user\_id        String   @unique @map("user\_id")  
  callsign       String?  // Tanda panggil (jika punya lisensi)  
  license\_type   String?  // "IAR", "KRAP", "ORARI", "none"  
  default\_freq   Float?   // Frekuensi default (MHz)  
  default\_ctcss  String?  // CTCSS/DCS tone  
  aprs\_ssid      String?  // SSID APRS (misal: "YF1ABC-7")  
  created\_at     DateTime @default(now())

  user           User     @relation(fields: \[user\_id\], references: \[id\])  
}

// Pesan HT (Store-and-Forward)  
model HTMessage {  
  id           String   @id @default(cuid())  
  sender\_id    String   @map("sender\_id")  
  recipient\_id String?  @map("recipient\_id")  // null \= broadcast  
  content      String   // Terenkripsi  
  freq         Float    // Frekuensi yang digunakan  
  protocol     String   // "APRS", "DMR", "FSK"  
  status       String   @default("pending") // "pending", "sent", "delivered", "failed"  
  created\_at   DateTime @default(now())  
  sent\_at      DateTime?  
  delivered\_at DateTime?  
}

// Grup HT (Warung HT)  
model HTGroup {  
  id            String   @id @default(cuid())  
  name          String  
  freq          Float  
  ctcss         String?  
  protocol      String   // "APRS", "DMR", "FSK"  
  creator\_id    String   @map("creator\_id")  
  members       Json     // \[{ user\_id, callsign }\]  
  is\_active     Boolean  @default(true)  
  created\_at    DateTime @default(now())  
}  
\`\`\`

\---

3\. IMPLEMENTASI TEKNIS

3.1 Pendekatan A: Akustik (Ribbit-style)

3.1.1 Modulasi & Demodulasi Audio

· Modulasi: Gunakan AFSK (Audio Frequency Shift Keying) atau FSK dengan frekuensi 1200 Hz dan 2200 Hz (standar APRS).  
· Library:  
  · Web/React Native: fsk-js, audio-fsk, atau implementasi manual dengan Web Audio API.  
  · Node.js: node-fsk, aprs-parser.  
· Alur:  
  1\. User mengetik pesan teks di Ngopi.  
  2\. App mengubah teks menjadi bitstream, lalu memodulasi menjadi sinyal audio.  
  3\. Speaker HP memutar sinyal audio, ditangkap oleh mikrofon HT.  
  4\. HT memancarkan sinyal radio.  
  5\. Di sisi penerima, HT menerima sinyal, speaker HT memutar audio.  
  6\. Mikrofon HP merekam audio, didemodulasi menjadi teks, ditampilkan di Ngopi.

3.1.2 Kontrol PTT (Push-to-Talk)

· Karena metode akustik tidak bisa mengontrol PTT HT secara otomatis, gunakan VOX (Voice Operated Exchange) pada HT.  
· User harus menekan tombol "Kirim" di Ngopi, lalu HT akan mendeteksi suara dan memancarkan.

3.1.3 Kode yang Harus Dibuat

\`\`\`typescript  
// services/ht/acousticModem.service.ts  
export class AcousticModem {  
  // Modulasi teks ke audio  
  static encode(text: string): AudioBuffer {  
    // 1\. Convert text to bitstream  
    // 2\. Apply FSK modulation (1200/2200 Hz)  
    // 3\. Return AudioBuffer  
  }

  // Demodulasi audio ke teks  
  static decode(audioBuffer: AudioBuffer): string {  
    // 1\. FFT analysis to detect frequencies  
    // 2\. Convert back to bitstream  
    // 3\. Decode to text  
  }  
}

// services/ht/htManager.service.ts  
export class HTManager {  
  async sendViaHT(message: string, freq: number) {  
    const audioBuffer \= AcousticModem.encode(message);  
    await AudioPlayer.play(audioBuffer);  
    // Simpan ke database sebagai pending  
    await saveHTMessage({ content: message, freq, status: 'pending' });  
  }

  async receiveFromHT(audioBuffer: AudioBuffer) {  
    const text \= AcousticModem.decode(audioBuffer);  
    // Tampilkan di UI, simpan ke database  
    await saveHTMessage({ content: text, status: 'delivered' });  
  }  
}  
\`\`\`

3.1.4 UI Frontend

· Tombol "Mode HT" di header chat.  
· Indikator Frekuensi: Tampilkan frekuensi yang digunakan.  
· Tombol PTT: Tekan dan tahan untuk merekam audio, lepas untuk mengirim.  
· Log HT: Daftar pesan yang dikirim/diterima via HT.

3.2 Pendekatan B: Hardware Dongle (kv4p-style)

3.2.1 Hardware yang Dibutuhkan

· kv4p HT: Modul radio open-source yang terhubung via USB-C. (https\://github.com/VanceVagell/kv4p-ht)  
· Alternatif: RTL-SDR \+ Baofeng dengan kabel data.

3.2.2 Komunikasi Serial

· Gunakan Web Serial API (untuk web) atau React Native Serial Port (untuk mobile).  
· Protokol: Kirim perintah AT-like untuk mengatur frekuensi, PTT, dan mengirim data.

3.2.3 Kode yang Harus Dibuat

\`\`\`typescript  
// services/ht/serialHT.service.ts  
export class SerialHT {  
  private port: SerialPort;

  async connect() {  
    this.port \= await navigator.serial.requestPort();  
    await this.port.open({ baudRate: 9600 });  
  }

  async setFrequency(freq: number) {  
    await this.port.write(\`FREQ \${freq}\\n\`);  
  }

  async sendText(text: string) {  
    await this.port.write(\`SEND \${text}\\n\`);  
  }

  async startPTT() {  
    await this.port.write(\`PTT ON\\n\`);  
  }

  async stopPTT() {  
    await this.port.write(\`PTT OFF\\n\`);  
  }  
}  
\`\`\`

3.2.4 UI Frontend

· Tombol "Hubungkan HT": Deteksi perangkat USB.  
· Panel Kontrol: Frekuensi, CTCSS, PTT, volume.  
· Indikator Koneksi: Status terhubung/tidak.

3.3 Integrasi APRS & DMR

· APRS: Gunakan library aprs-parser untuk encode/decode paket APRS. Kirim via audio FSK.  
· DMR: Gunakan library dmr-parser atau integrasi dengan hotspot DMR (misal: OpenSpot, MMDVM).  
· Store-and-Forward: Simpan pesan APRS/DMR di database, kirim ke server Ngopi saat online.

\---

4\. LEGAL & COMPLIANCE

4.1 Regulasi Indonesia

· IAR (Izin Amatir Radio): Untuk radio amatir (ORARI). Frekuensi 144-148 MHz (VHF) dan 430-440 MHz (UHF).  
· KRAP (Komunikasi Radio Antar Penduduk): Untuk umum. Frekuensi 477 MHz (CB).  
· ISR (Izin Stasiun Radio): Untuk stasiun radio tetap.  
· PSE Kominfo: Ngopi harus terdaftar sebagai PSE jika menyediakan fitur komunikasi.

4.2 Fitur Kepatuhan

· Verifikasi Lisensi: User harus memasukkan nomor lisensi (IAR/KRAP) untuk mengaktifkan mode HT.  
· Batas Daya: Batasi daya transmit (misal: maks 5W untuk HT portabel).  
· Log Transmisi: Catat semua transmisi untuk audit.  
· Disclaimer: Tampilkan peringatan hukum saat mengaktifkan mode HT.

4.3 Kerja Sama dengan ORARI

· Rekomendasi: Jalin kerja sama dengan ORARI (Organisasi Amatir Radio Indonesia) untuk:  
  · Validasi lisensi pengguna.  
  · Akses ke gateway APRS/DMR.  
  · Pelatihan dan edukasi.

\---

5\. TESTING & VALIDASI

5.1 Unit Test

· Test modulasi/demodulasi FSK (encode → decode → hasil sama).  
· Test parser APRS (encode paket → decode paket).  
· Test koneksi serial (mock SerialPort).

5.2 Integration Test

· Simulasi pengiriman pesan via audio loopback (speaker → mic).  
· Simulasi pengiriman via serial loopback (TX → RX).  
· Test store-and-forward: kirim pesan offline, online-kan, cek sinkronisasi.

5.3 Field Test

· Uji coba dengan HT asli (Baofeng, Yaesu, Icom).  
· Uji jangkauan: 1 km, 5 km, 10 km (tergantung medan).  
· Uji noise: di lingkungan bising, apakah pesan masih terbaca?

\---

6\. PRIORITAS EKSEKUSI

Sprint Task Estimasi  
Sprint 1 Modul Akustik (FSK encode/decode) \+ UI dasar 2 minggu  
Sprint 2 Integrasi APRS (encode/decode paket) 2 minggu  
Sprint 3 Dukungan Hardware Dongle (Web Serial) 2 minggu  
Sprint 4 Store-and-Forward \+ Sinkronisasi Server 1,5 minggu  
Sprint 5 Fitur Kepatuhan (Verifikasi Lisensi, Log) 1 minggu  
Sprint 6 Field Test & Optimasi 2 minggu

\---

7\. PERINTAH EKSEKUSI UNTUK AI AGENT

"Mulai dari Sprint 1: Implementasikan modul akustik untuk HT.

Langkah:

1\. Buat folder backend/src/ht/ dan frontend/src/ht/.  
2\. Implementasikan AcousticModem untuk encode/decode FSK (1200/2200 Hz).  
3\. Buat HTManager untuk mengelola pengiriman/penerimaan pesan HT.  
4\. Tambahkan UI "Mode HT" di frontend (tombol, indikator frekuensi, PTT).  
5\. Buat unit test untuk FSK (encode → decode → hasil sama).  
6\. Buat integration test dengan audio loopback.  
7\. Setelah Sprint 1 selesai, laporkan dan tunggu konfirmasi saya sebelum lanjut ke Sprint 2 (APRS)."

Untuk setiap sprint, sertakan:

· File yang dibuat/diubah.  
· Cara testing manual.  
· Risiko/edge case.  
· Catatan legal yang relevan.

\---

8\. CATATAN AKHIR

8.1 Referensi

· Ribbit: https\://github.com/ribbit-mobile/ribbit  
· kv4p HT: https\://github.com/VanceVagell/kv4p-ht  
· APRS: http\://www\.aprs.org/  
· DMR: https\://www\.dmr-marc.net/  
· ORARI: https\://orari.or.id/

8.2 Larangan

· ❌ Jangan gunakan frekuensi tanpa izin.  
· ❌ Jangan transmit daya berlebihan.  
· ❌ Jangan abaikan disclaimer hukum.  
· ❌ Jangan simpan data sensitif tanpa enkripsi.

8.3 Etika

· Hormati pengguna radio lain.  
· Jangan gunakan untuk kegiatan ilegal.  
· Bantu komunitas (SAR, bencana) dengan teknologi ini.

Selamat membangun\! Semoga fitur HT Ngopi bermanfaat untuk komunitas dan keadaan darurat. ☕📻🚨

\`\`\`

\---

\#\#\# 🚀 Cara Menggunakan

1\. \*\*Simpan\*\* file ini sebagai \`PROMPT\_NGOPI\_HT.md\` di root project Ngopi.  
2\. \*\*Gabungkan\*\* dengan prompt Ngopi lainnya (Master V3, AI Bots, dll.) saat memberikan instruksi ke AI Agent.  
3\. \*\*Beri perintah\*\*:  
   \> \*"Jalankan Sprint 1 (Modul Akustik HT) sesuai prompt ini. Setelah selesai, laporkan dan tunggu konfirmasi saya sebelum lanjut ke Sprint 2 (APRS)."\*  
4\. \*\*Setelah Sprint 1 selesai\*\*, review hasilnya, lalu perintahkan Sprint 2, dst.

\#\#\# 💡 Saran Tambahan  
\- \*\*Mulai dari Akustik\*\* karena tidak butuh hardware tambahan.  
\- \*\*Uji coba dengan HT murah\*\* (Baofeng UV-5R) sebelum investasi hardware mahal.  
\- \*\*Jalin kerja sama dengan ORARI\*\* untuk validasi lisensi dan akses gateway APRS.  
\- \*\*Sediakan mode "Emergency"\*\* yang otomatis mengaktifkan HT saat internet mati dan ada sinyal darurat.

Dengan prompt ini, Ngopi tidak hanya menjadi aplikasi chat, tetapi juga \*\*alat komunikasi tangguh\*\* yang bisa diandalkan dalam situasi darurat. Selamat berkarya\! ☕📻🚀