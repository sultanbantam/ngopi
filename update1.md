Berikut adalah PROMPT\_NGOPI\_GAPLEH\_v3\_FINAL.md — gabungan lengkap dari semua permintaan sebelumnya \+ 2 revisi baru (Level Gapleh & HT Offline). Siap copy-paste ke Antigravity IDE.

\---

\`\`\`markdown  
\# PROMPT: Ngopi Gapleh v3 Final — Level System, HT Offline, Share Sosmed, Bot & Panduan

\#\# 0\. KONTEKS

\- \*\*Aplikasi\*\*: Ngopi (https\://ngopi.top)  
\- \*\*Tujuan\*\*: Update game Gapleh dengan \*\*sistem level\*\*, tambah fitur viral (share sosmed), \*\*HT yang berfungsi tanpa internet\*\*, bot multi-level, dan panduan HT & P3K.  
\- \*\*Aturan Kerja\*\*: Kerjakan per Task. Test setiap task sebelum lanjut. Tunggu konfirmasi user.

\---

\# TASK 1: UPDATE ATURAN & SISTEM POIN GAPLEH

\#\# 1.1 Definisi Jenis Kemenangan

| Istilah | Definisi | Poin |  
| :--- | :--- | :--- |  
| \*\*Gapleh Biasa\*\* | Pemain habiskan SEMUA kartunya duluan, sementara pemain lain masih punya kartu. | \*\*50 poin\*\* |  
| \*\*Digapleh\*\* | Permainan BUNTU. Semua pemain masih punya kartu, tapi tidak ada yang bisa jalan. Pemenang: paling banyak memainkan kartu. | \*\*75 poin\*\* |  
| \*\*Nutup Balak 6\*\* | Habiskan kartu terakhir dengan Balak 6 (6-6). | \*\*500 poin\*\* |  
| \*\*Nutup Balak 0\*\* | Habiskan kartu terakhir dengan Balak 0 (0-0). | \*\*500 poin\*\* |

\#\# 1.2 Aturan Pembukaan Kartu Pertama  
\- \*\*TIDAK BOLEH\*\* membuka dengan:  
  \- ❌ Balak 6 (6-6)  
  \- ❌ Balak 0 (0-0)  
\- \*\*Kartu selain itu DIPERBOLEHKAN\*\* untuk dibuka duluan.  
\- \*\*Alasan\*\*: Balak 6 & 0 adalah kartu penutup.

\#\# 1.3 Aturan Kartu Nutup (Balak 6 & Balak 0\)  
\- \*\*Kapan boleh dimainkan?\*\*  
  \- Hanya jika sudah \*\*tidak ada langkah lain\*\* (kartu tidak cocok dengan kepala/ekor).  
  \- ATAU jika pemain tinggal menyisakan 1 kartu.  
\- \*\*Syarat nutup\*\*:  
  \- Semua kartu habis (gapleh), ATAU  
  \- Permainan buntu dengan Balak 6/0 sebagai kartu terakhir.

\#\# 1.4 Bonus Poin  
| Bonus | Syarat | Multiplier |  
| :--- | :--- | :--- |  
| \*\*Streak\*\* | Menang 3x berturut-turut | x1.5 |  
| \*\*First Time Nutup\*\* | Pertama kali nutup balak 6/0 | x3 (one-time) |  
| \*\*Sisa Kartu Lawan\*\* | Setiap kartu lawan yang tersisa (khusus gapleh biasa) | \+5 poin/kartu |  
| \*\*Lawan \>5 Kartu\*\* | Setiap lawan dengan \>5 kartu | \+10 poin bonus |

\#\# 1.5 Contoh Perhitungan  
\- \*\*Gapleh Biasa\*\*: Pemenang habiskan kartu. Lawan sisa 3 & 5 kartu.  
  \- Poin: 50 \+ (3x5) \+ (5x5) \= \*\*90 poin\*\*.  
\- \*\*Digapleh\*\*: \*\*75 poin\*\* (flat).  
\- \*\*Nutup Balak 6 \+ Streak 3x\*\*: 500 x 1.5 \= \*\*750 poin\*\*.  
\- \*\*First Time Nutup Balak 0\*\*: 500 x 3 \= \*\*1500 poin\*\* (one-time).

\---

\# TASK 2: SISTEM LEVEL GAPLEH (REVISI BARU)

\#\# 2.1 Konsep Level

Main Gapleh sekarang dibagi menjadi \*\*2 level\*\* (dan akan ditambah di masa depan):

| Level | Nama | Jumlah Pemain | Deskripsi |  
| :--- | :--- | :--- | :--- |  
| \*\*Level 1\*\* | \*\*Gapleh Klasik\*\* | 2-4 pemain (2-3 manusia \+ bot) | Sistem yang sudah ada sekarang. Cocok untuk pemula. |  
| \*\*Level 2\*\* | \*\*Gapleh Rame\*\* | \*\*4 pemain (WAJIB)\*\* | Mode 4 orang sekaligus. Bisa main dengan bot dengan pilihan nama bot. |

\*\*Aturan\*\*:  
\- User bebas memilih level saat akan bermain.  
\- Level 1 \= sistem yang sekarang (tidak diubah).  
\- Level 2 \= mode baru khusus 4 pemain.

\#\# 2.2 Level 2: Gapleh Rame (4 Pemain)

\#\#\# Spesifikasi Teknis  
\- \*\*Jumlah pemain\*\*: 4 orang (bisa kombinasi manusia \+ bot).  
\- \*\*Pembagian kartu\*\*: 28 kartu ÷ 4 pemain \= 7 kartu per pemain.  
\- \*\*Tidak ada deck sisa\*\* (semua kartu dibagikan).  
\- \*\*Urutan main\*\*: searah jarum jam.

\#\#\# Pilihan Bot di Level 2  
Saat user memilih main dengan bot, tampilkan \*\*daftar bot dengan nama karakter\*\* yang bisa dipilih.

\*\*Daftar Bot Level 2 (Contoh)\*\*:

| Bot ID | Nama Karakter | Kepribadian | Level Kesulitan |  
| :--- | :--- | :--- | :--- |  
| \`gapleh\_2\_budi\` | Budi | Pemalu, sering salah | Kelas Bulu |  
| \`gapleh\_2\_asep\` | Asep | Ramah, main santai | Kelas Warung |  
| \`gapleh\_2\_rudi\` | Rudi | Serius, kadang blunder | Kelas Kampung |  
| \`gapleh\_2\_deni\` | Deni | Cerdas, sering jebakan | Kelas Kota |  
| \`gapleh\_2\_jago\` | Bang Jago | Agresif, susah ditebak | Kelas Jagal |  
| \`gapleh\_2\_maestro\` | Sang Maestro | Tenang, mematikan | Kelas Dunia |

\*\*UI Pemilihan Bot\*\*:  
\`\`\`

\+------------------------------------------+

|  Pilih Lawan Main (Level 2 \- Gapleh Rame)|  
\+------------------------------------------+

|                                          |

|  Anda: \[Avatar\] @username                |

|                                          |

|  Pilih 3 lawan:                          |

|                                          |

|  \[✓\] Budi (Kelas Bulu) — Pemula          |

|  \[ \] Asep (Kelas Warung) — Kasual        |

|  \[ \] Rudi (Kelas Kampung) — Menengah     |

|  \[✓\] Deni (Kelas Kota) — Mahir           |

|  \[ \] Bang Jago (Kelas Jagal) — Expert    |

|  \[ \] Sang Maestro (Kelas Dunia) — Juara  |

|                                          |

|  Total terpilih: 2/3                     |

|  \[    Mulai Permainan    \]               |  
\+------------------------------------------+

\`\`\`

\*\*Aturan Bot di Level 2\*\*:  
\- Bisa pilih 1-3 bot (sisanya manusia jika ada).  
\- Bot memiliki \*\*kepribadian\*\* dan \*\*gaya main\*\* berbeda.  
\- Bot bisa "ngobrol" (chat sederhana) di meja.  
\- Bot juga dapat poin jika menang (disimpan di \`BotProfile\`).

\#\#\# Database Schema (Tambahan)  
\`\`\`prisma  
model GaplehLevel {  
  id          String   @id @default(cuid())  
  level       Int      @unique  // 1, 2  
  name        String   // "Gapleh Klasik", "Gapleh Rame"  
  min\_players Int  
  max\_players Int  
  description String  
  is\_active   Boolean  @default(true)  
}

model GaplehMatchV2 {  
  id              String   @id @default(cuid())  
  level           Int      @default(1)  // 1 atau 2  
  user\_id         String   @map("user\_id")  
  opponent\_ids    String\[\] @map("opponent\_ids")  // Bisa manusia atau bot  
  bot\_ids         String\[\] @map("bot\_ids")       // Daftar bot yang dipilih  
  result          String   // "win", "lose", "draw"  
  win\_type        String?  // "gapleh\_biasa", "digapleh", "nutup\_balak6", "nutup\_balak0"  
  points\_earned   Int      @default(0)  
  base\_points     Int      @default(0)  
  bonus\_points    Int      @default(0)  
  is\_first\_nutup  Boolean  @default(false)  
  streak\_count    Int      @default(0)  
  opponent\_cards\_left Json?  
  duration\_sec    Int  
  moves\_count     Int  
  created\_at      DateTime @default(now())  
}  
\`\`\`

UI Frontend Level 2

· Header: "Gapleh Rame (Level 2\) — 4 Pemain"  
· Layout: 4 pemain di 4 sisi meja (atas, bawah, kiri, kanan).  
· Indikator giliran: Panah/highlight pada pemain yang giliran.  
· Counter kartu: Jumlah kartu setiap pemain ditampilkan.  
· Chat & Emote: Setiap bot bisa kirim emote \+ chat sederhana.

\---

TASK 3: FITUR SHARE SOSMED (VIRAL HOOK)

3.1 Deskripsi

Saat pemain nutup Balak 6/0 atau digapleh, muncul modal share dengan:

· Screenshot otomatis momen kemenangan.  
· Hook singkat (bisa di-copy).  
· Tombol share: Instagram, TikTok, WhatsApp, X, Facebook.

3.2 Hook Generator (Random)

Balak 6 (Nutup Sakti)

\`\`\`  
\- "NUTUP PAKAI BALAK 6\! 💀🔥 \[username\] baru aja bikin lawan nelangsa di Ngopi\!"  
\- "BALAK 6\! Gapleh dalam 3 menit\! Siapa yang berani lawan aku? 😎 \#NgopiGapleh"  
\- "5️⃣0️⃣0️⃣ POIN\! Nutup pakai Balak 6 di Ngopi\! Ini namanya gapleh kelas jagal 🐐"  
\- "GAK NYANGKA\! Balak 6 nutup gapleh\! Cobain di ngopi.top ☕🁫"  
\- "Sumpah, ini gapleh paling epic\! Nutup pakai Balak 6, auto 500 poin\! 🎯"  
\`\`\`

Balak 0 (Nutup Zero)

\`\`\`  
\- "BALAK 0\! Nutup zero, 500 poin melayang\! 🎯 Siapa lawan? \#Ngopi"  
\- "0️⃣ BALAK 0\! NUTUP\! Momen paling mematikan di Gapleh Ngopi\! ☕🔥"  
\- "NUTUP ZERO\! Nih bukti kalau Ngopi itu bukan sekadar aplikasi chat\! 😎"  
\- "500 POIN\! Balak 0 nutup gapleh\! Yang mau main, ngopi.top\! 🁫"  
\- "Zero to hero\! Balak 0 nutup gapleh\! 💀🔥"  
\`\`\`

Digapleh (Buntu tapi Menang)

\`\`\`  
\- "BUKAN GAPLEH BIASA\! Ini DIGAPLEH\! \+75 poin\! 🁫🔒"  
\- "DIGAPLEH\! Buntu tapi menang\! Cuma di Ngopi\! ☕"  
\- "Semua masih punya kartu, tapi gak ada yang bisa jalan\! DIGAPLEH\! 🔒"  
\`\`\`

Streak Nutup

\`\`\`  
\- "NUTUP TERUS\! Streak 5x nutup di Ngopi\! Aku GAPLEH JAGAL\! 🐐"  
\- "Balak 6 \+ Balak 0 \= mimpi buruk lawan\! Streak 10x di Ngopi\! 💀"  
\- "500 poin x10 \= 5.000 poin\! Aku raja gapleh Ngopi\! 👑"  
\`\`\`

First Time Nutup

\`\`\`  
\- "PERTAMA KALI NUTUP BALAK 6\! 1.500 POIN\! 🎉 Ini momen bersejarah\!"  
\- "Baru pertama kali main, langsung nutup balak 0\! 1.500 poin\! 🁫🔥"  
\`\`\`

3.3 Desain Kartu Share (9:16 vertikal)

\`\`\`  
\+--------------------------------------+  
|  🁫 NUTUP BALAK 6\! 🔥                |  
|  \[Screenshot papan gapleh\]           |  
|  @username\_baru\_nutup\!               |  
|  \+500 POIN                           |  
|  Streak: 3x | Total Poin: 12.500     |  
|  Cobain di: ngopi.top                |  
|  \#NgopiGapleh \#GaplehIndonesia       |  
\+--------------------------------------+  
\`\`\`

4 Template Desain:

1\. Neon Cyberpunk: Warna neon, glitch.  
2\. Retro Warkop: Cokelat kopi, vintage.  
3\. Modern Minimalist: Putih bersih, font sans-serif.  
4\. Cinematic Dramatic: Gelap, spotlight, efek emas.

3.4 Backend Endpoint

\`\`\`  
POST /api/gapleh/share  
Body: { match\_id, hook\_template\_id, design\_template }  
Response: { image\_url, caption, hashtags, share\_links }  
\`\`\`

3.5 Frontend Implementation

· Library: html-to-image untuk generate gambar dari DOM.  
· Upload ke server → dapat URL publik.  
· Web Share API untuk mobile.  
· Deep link: WhatsApp (wa.me/?text=), X (twitter.com/intent/tweet), Facebook (facebook.com/sharer).

\---

TASK 4: BOT GAPLEH DAPAT POIN

4.1 Deskripsi

Bot yang menang juga mendapat poin seperti user. Poin disimpan di profil bot.

4.2 Bot Naik Level

Bot bisa naik level: Level 1 → Level 2 → ... → Level 6 berdasarkan kemenangan.

· Level 6 dengan 100x menang \= badge "Bot Legendaris".

4.3 Database Schema

\`\`\`prisma  
model BotProfile {  
  id              String   @id @default(cuid())  
  bot\_id          String   @unique  // "gapleh\_2\_budi", "gapleh\_2\_maestro"  
  name            String  
  level           Int      @default(1)  
  total\_points    Int      @default(0)  
  total\_wins      Int      @default(0)  
  total\_losses    Int      @default(0)  
  badges          String\[\]  
  updated\_at      DateTime @updatedAt  
}  
\`\`\`

4.4 Poin Bot Berdasarkan Level

Level Bot Poin Menang Poin Kalah Poin Seri  
1 (Bulu) 10 1 3  
2 (Warung) 25 3 8  
3 (Kampung) 50 5 15  
4 (Kota) 100 10 30  
5 (Jagal) 250 25 75  
6 (Dunia) 1000 100 300

\---

TASK 5: HT (HANDY TALKY) YANG BERFUNGSI TANPA INTERNET ⭐

5.1 Tantangan Utama

Masalah: ngopi.top adalah aplikasi web. Jika internet mati, browser tidak bisa memuat halaman dari server. Bagaimana HT tetap bisa dipakai?

Solusi: Kombinasi 3 teknologi kunci:

1\. PWA (Progressive Web App) \+ Service Worker → Aplikasi di-cache di browser, bisa dibuka offline.  
2\. Web Bluetooth API / Web Serial API → Browser bisa berkomunikasi langsung dengan hardware HT (dongle Bluetooth/USB).  
3\. Web Audio API → Untuk metode akustik (speaker HP ↔ mic HT) tanpa hardware tambahan.

5.2 Arsitektur HT Offline

\`\`\`  
┌─────────────────────────────────────────────┐  
│           BROWSER (ngopi.top)               │  
│                                             │  
│  ┌───────────────────────────────────┐      │  
│  │  PWA (Service Worker Cache)       │      │  
│  │  \- HTML/CSS/JS di-cache           │      │  
│  │  \- UI tetap bisa dibuka offline   │      │  
│  └───────────────────────────────────┘      │  
│                                             │  
│  ┌───────────────────────────────────┐      │  
│  │  Web Bluetooth API                │      │  
│  │  → Connect ke HT dengan Bluetooth │      │  
│  └───────────────────────────────────┘      │  
│                                             │  
│  ┌───────────────────────────────────┐      │  
│  │  Web Serial API                   │      │  
│  │  → Connect ke HT via USB dongle   │      │  
│  └───────────────────────────────────┘      │  
│                                             │  
│  ┌───────────────────────────────────┐      │  
│  │  Web Audio API                    │      │  
│  │  → FSK modulation (akustik)       │      │  
│  └───────────────────────────────────┘      │  
│                                             │  
└─────────────────────────────────────────────┘  
                    ↕  
        ┌───────────────────────┐  
        │   HT (Hardware Radio) │  
        │   VHF/UHF Transceiver │  
        └───────────────────────┘  
                    ↕  
              (Gelombang Radio)  
                    ↕  
        ┌───────────────────────┐  
        │   HT Penerima Lain    │  
        └───────────────────────┘  
\`\`\`

5.3 Implementasi PWA (WAJIB untuk Offline)

5.3.1 Manifest & Service Worker

Buat file manifest.json:

\`\`\`json  
{  
  "name": "Ngopi \- Warung Kopi Digital",  
  "short\_name": "Ngopi",  
  "start\_url": "/",  
  "display": "standalone",  
  "background\_color": "\#3E2723",  
  "theme\_color": "\#8B5E3C",  
  "icons": \[  
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },  
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }  
  \],  
  "permissions": \["bluetooth", "serial", "microphone"\]  
}  
\`\`\`

Buat service-worker.js:

\`\`\`javascript  
const CACHE\_NAME \= 'ngopi-v3';  
const URLS\_TO\_CACHE \= \[  
  '/',  
  '/chat',  
  '/warung',  
  '/games/gapleh',  
  '/guides/ht',  
  '/guides/first-aid',  
  '/offline.html',  
  // ... semua asset penting  
\];

self.addEventListener('install', (event) \=\> {  
  event.waitUntil(  
    caches.open(CACHE\_NAME).then((cache) \=\> cache.addAll(URLS\_TO\_CACHE))  
  );  
});

self.addEventListener('fetch', (event) \=\> {  
  event.respondWith(  
    caches.match(event.request).then((response) \=\> {  
      return response || fetch(event.request).catch(() \=\> caches.match('/offline.html'));  
    })  
  );  
});  
\`\`\`

5.3.2 Registrasi Service Worker

\`\`\`typescript  
// frontend/src/serviceWorkerRegistration.ts  
export function register() {  
  if ('serviceWorker' in navigator) {  
    window.addEventListener('load', () \=\> {  
      navigator.serviceWorker.register('/service-worker.js')  
        .then((reg) \=\> console.log('SW registered:', reg))  
        .catch((err) \=\> console.error('SW error:', err));  
    });  
  }  
}  
\`\`\`

5.4 Implementasi Web Bluetooth (untuk HT dengan Bluetooth)

5.4.1 Kode Koneksi

\`\`\`typescript  
// services/ht/bluetoothHT.service.ts  
export class BluetoothHT {  
  private device: BluetoothDevice | null \= null;  
  private characteristic: BluetoothRemoteGATTCharacteristic | null \= null;

  async connect() {  
    this.device \= await navigator.bluetooth.requestDevice({  
      filters: \[  
        { services: \['0000ffe0-0000-1000-8000-00805f9b34fb'\] }, // UUID umum HT  
      \],  
      optionalServices: \['battery\_service'\],  
    });

    const server \= await this.device.gatt?.connect();  
    const service \= await server?.getPrimaryService('0000ffe0-0000-1000-8000-00805f9b34fb');  
    this.characteristic \= await service?.getCharacteristic('0000ffe1-0000-1000-8000-00805f9b34fb');

    // Listen untuk data masuk  
    await this.characteristic?.startNotifications();  
    this.characteristic?.addEventListener('characteristicvaluechanged', (event) \=\> {  
      const value \= (event.target as BluetoothRemoteGATTCharacteristic).value;  
      const text \= new TextDecoder().decode(value);  
      this.onReceive(text);  
    });  
  }

  async sendText(text: string) {  
    const encoder \= new TextEncoder();  
    await this.characteristic?.writeValue(encoder.encode(text));  
  }

  onReceive(text: string) {  
    console.log('HT Received:', text);  
    // Tampilkan di UI Ngopi  
  }  
}  
\`\`\`

5.4.2 Kompatibilitas

· Chrome/Edge (Android & Desktop): ✅ Support Web Bluetooth  
· Safari (iOS): ❌ Tidak support Web Bluetooth (harus pakai Web Serial atau akustik)  
· Firefox: ⚠️ Support terbatas (butuh flag)

5.5 Implementasi Web Serial (untuk HT dengan Dongle USB)

\`\`\`typescript  
// services/ht/serialHT.service.ts  
export class SerialHT {  
  private port: SerialPort | null \= null;  
  private reader: ReadableStreamDefaultReader | null \= null;

  async connect() {  
    this.port \= await (navigator as any).serial.requestPort();  
    await this.port.open({ baudRate: 9600 });

    // Baca data dari HT  
    const textDecoder \= new TextDecoderStream();  
    this.port.readable.pipeTo(textDecoder.writable);  
    this.reader \= textDecoder.readable.getReader();  
    this.readLoop();  
  }

  async readLoop() {  
    while (true) {  
      const { value, done } \= await this.reader\!.read();  
      if (done) break;  
      if (value) this.onReceive(value);  
    }  
  }

  async sendText(text: string) {  
    const writer \= this.port\!.writable.getWriter();  
    const encoder \= new TextEncoder();  
    await writer.write(encoder.encode(\`SEND \${text}\\n\`));  
    writer.releaseLock();  
  }

  async startPTT() {  
    const writer \= this.port\!.writable.getWriter();  
    await writer.write(new TextEncoder().encode('PTT ON\\n'));  
    writer.releaseLock();  
  }

  async stopPTT() {  
    const writer \= this.port\!.writable.getWriter();  
    await writer.write(new TextEncoder().encode('PTT OFF\\n'));  
    writer.releaseLock();  
  }

  onReceive(text: string) {  
    console.log('HT Received:', text);  
  }  
}  
\`\`\`

5.6 Implementasi Mode Akustik (Tanpa Hardware Tambahan)

5.6.1 FSK Modulation

\`\`\`typescript  
// services/ht/acousticModem.service.ts  
export class AcousticModem {  
  private static FREQ\_MARK \= 1200;   // Hz (bit 1\)  
  private static FREQ\_SPACE \= 2200;  // Hz (bit 0\)  
  private static SAMPLE\_RATE \= 44100;

  // Encode teks → audio  
  static encode(text: string): AudioBuffer {  
    const ctx \= new AudioContext();  
    const bitstream \= this.textToBits(text);  
    const samplesPerBit \= this.SAMPLE\_RATE / 1200; // 1200 baud  
    const totalSamples \= bitstream.length \* samplesPerBit;  
    const buffer \= ctx.createBuffer(1, totalSamples, this.SAMPLE\_RATE);  
    const data \= buffer.getChannelData(0);

    let sampleIndex \= 0;  
    for (const bit of bitstream) {  
      const freq \= bit \=== 1 ? this.FREQ\_MARK : this.FREQ\_SPACE;  
      for (let i \= 0; i \< samplesPerBit; i++) {  
        data\[sampleIndex++\] \= Math.sin(2 \* Math.PI \* freq \* (sampleIndex / this.SAMPLE\_RATE));  
      }  
    }

    return buffer;  
  }

  // Decode audio → teks  
  static async decode(audioBuffer: AudioBuffer): Promise\<string\> {  
    const data \= audioBuffer.getChannelData(0);  
    const samplesPerBit \= this.SAMPLE\_RATE / 1200;  
    const bitstream: number\[\] \= \[\];

    for (let i \= 0; i \< data.length; i \+= samplesPerBit) {  
      const segment \= data.slice(i, i \+ samplesPerBit);  
      const freq \= this.detectFrequency(segment);  
      bitstream.push(freq \> 1700 ? 1 : 0); // Threshold 1700 Hz  
    }

    return this.bitsToText(bitstream);  
  }

  private static detectFrequency(samples: Float32Array): number {  
    // Zero-crossing detection  
    let crossings \= 0;  
    for (let i \= 1; i \< samples.length; i++) {  
      if (samples\[i \- 1\] \< 0 && samples\[i\] \>= 0\) crossings++;  
    }  
    return (crossings \* this.SAMPLE\_RATE) / samples.length;  
  }

  private static textToBits(text: string): number\[\] {  
    const bits: number\[\] \= \[\];  
    for (const char of text) {  
      const code \= char.charCodeAt(0);  
      for (let i \= 7; i \>= 0; i--) {  
        bits.push((code \>\> i) & 1);  
      }  
    }  
    return bits;  
  }

  private static bitsToText(bits: number\[\]): string {  
    let text \= '';  
    for (let i \= 0; i \< bits.length; i \+= 8\) {  
      const byte \= bits.slice(i, i \+ 8).reduce((acc, bit) \=\> (acc \<\< 1\) | bit, 0);  
      if (byte) text \+= String.fromCharCode(byte);  
    }  
    return text;  
  }  
}  
\`\`\`

5.6.2 Cara Kerja Mode Akustik

1\. User mengetik pesan di Ngopi (mode offline).  
2\. App encode teks → audio FSK.  
3\. Speaker HP memutar audio → ditangkap mic HT.  
4\. HT transmit via radio.  
5\. HT penerima → speaker HT → mic HP penerima.  
6\. App decode audio → teks → tampilkan di Ngopi.

5.7 HTManager (Orkestrator)

\`\`\`typescript  
// services/ht/htManager.service.ts  
export class HTManager {  
  private mode: 'bluetooth' | 'serial' | 'acoustic' | 'none' \= 'none';  
  private bluetooth: BluetoothHT | null \= null;  
  private serial: SerialHT | null \= null;

  async init(mode: string) {  
    this.mode \= mode as any;  
    switch (mode) {  
      case 'bluetooth':  
        this.bluetooth \= new BluetoothHT();  
        await this.bluetooth.connect();  
        break;  
      case 'serial':  
        this.serial \= new SerialHT();  
        await this.serial.connect();  
        break;  
      case 'acoustic':  
        // Tidak butuh koneksi, cukup AudioContext  
        break;  
    }  
  }

  async sendMessage(text: string) {  
    // Simpan ke IndexedDB untuk sinkronisasi nanti  
    await this.saveToLocalDB({ text, status: 'pending', timestamp: Date.now() });

    switch (this.mode) {  
      case 'bluetooth':  
        await this.bluetooth?.sendText(text);  
        break;  
      case 'serial':  
        await this.serial?.sendText(text);  
        break;  
      case 'acoustic':  
        const buffer \= AcousticModem.encode(text);  
        await this.playAudio(buffer);  
        break;  
    }  
  }

  private async playAudio(buffer: AudioBuffer) {  
    const ctx \= new AudioContext();  
    const source \= ctx.createBufferSource();  
    source.buffer \= buffer;  
    source.connect(ctx.destination);  
    source.start();  
  }

  private async saveToLocalDB(data: any) {  
    // Simpan ke IndexedDB untuk sinkronisasi saat online  
    const db \= await openDB('ngopi-ht', 1);  
    await db.put('messages', data);  
  }

  // Sinkronisasi saat online kembali  
  async syncToServer() {  
    if (\!navigator.onLine) return;  
    const db \= await openDB('ngopi-ht', 1);  
    const pending \= await db.getAll('messages');  
    for (const msg of pending) {  
      await fetch('/api/ht/sync', {  
        method: 'POST',  
        body: JSON.stringify(msg),  
      });  
      await db.delete('messages', msg.id);  
    }  
  }  
}

// Auto-sync saat online  
window.addEventListener('online', () \=\> {  
  new HTManager().syncToServer();  
});  
\`\`\`

5.8 UI Mode HT Offline

5.8.1 Halaman HT

\`\`\`  
\+------------------------------------------+  
|  📻 Mode HT (Handy Talky)                |  
\+------------------------------------------+  
|  Status: ● Offline Mode Aktif            |  
|  Koneksi: Bluetooth HT (Baofeng UV-5R)   |  
|  Frekuensi: 145.500 MHz                  |  
|  CTCSS: OFF                              |  
\+------------------------------------------+  
|  \[Pesan Terakhir\]                        |  
|  @user1: "Halo, posisi di mana?" 11:23   |  
|  @user2: "Di posko, aman." 11:24         |  
\+------------------------------------------+  
|  \[Ketik pesan...\]              \[Kirim\]   |  
|  \[🎤 PTT\]  \[📻 Scan\]  \[⚙️ Setting\]       |  
\+------------------------------------------+  
|  📶 3 peer terdeteksi di sekitar         |  
|  📥 5 pesan menunggu sinkronisasi        |  
\+------------------------------------------+  
\`\`\`

5.8.2 Indikator Offline

· Banner merah: "📡 Mode Offline Aktif — HT Siap Digunakan"  
· Badge di header: "OFFLINE"  
· Notifikasi: "Pesan Anda akan disinkronkan saat online kembali."

5.8.3 Pilihan Mode HT

\`\`\`  
\+------------------------------------------+  
|  Pilih Mode HT                           |  
\+------------------------------------------+  
|  \[📶\] Bluetooth                          |  
|       Untuk HT dengan Bluetooth built-in |  
|       (Chrome/Edge Android)              |  
|                                          |  
|  \[🔌\] Serial (USB Dongle)                |  
|       Untuk kv4p HT atau dongle USB      |  
|       (Chrome/Edge Desktop)              |  
|                                          |  
|  \[🔊\] Akustik (Tanpa Hardware)           |  
|       Speaker HP ↔ Mic HT                |  
|       (Semua browser, semua device)      |  
|                                          |  
|  \[❌\] Nonaktifkan                        |  
\+------------------------------------------+  
\`\`\`

5.9 Batasan & Catatan Penting

5.9.1 Batasan Teknis

Aspek Batasan  
Web Bluetooth Tidak support di iOS Safari  
Web Serial Hanya Chrome/Edge Desktop  
Akustik Sangat lambat (\~10 karakter/detik), rentan noise  
Jangkauan HT 1-20 km (tergantung daya & medan)  
Baterai Boros saat transmit terus-menerus  
Legalitas Wajib IAR/KRAP/ORARI

5.9.2 Fallback Strategy

1\. Jika browser tidak support Web Bluetooth/Serial → Gunakan mode akustik.  
2\. Jika akustik tidak memungkinkan → Tampilkan pesan "Gunakan HT manual".  
3\. Jika tidak ada HT fisik → Simpan pesan di IndexedDB, kirim saat online.

5.9.3 PWA Installation

Untuk pengalaman terbaik, user harus install Ngopi sebagai PWA:

· Android: Chrome → Menu → "Add to Home Screen"  
· iOS: Safari → Share → "Add to Home Screen"  
· Desktop: Chrome → Address bar icon → "Install"

Setelah di-install, Ngopi bisa dibuka tanpa internet.

5.9.4 Sinkronisasi Saat Online

\`\`\`typescript  
// Saat user kembali online  
async function syncOfflineMessages() {  
  const pending \= await getPendingMessages();  
  for (const msg of pending) {  
    await fetch('https\://api.ngopi.top/api/ht/sync', {  
      method: 'POST',  
      body: JSON.stringify(msg),  
    });  
  }  
  await clearPendingMessages();  
}  
\`\`\`

5.10 Database Schema (HT)

\`\`\`prisma  
model HTProfile {  
  id             String   @id @default(cuid())  
  user\_id        String   @unique @map("user\_id")  
  callsign       String?  
  license\_type   String?  
  default\_freq   Float?  
  default\_ctcss  String?  
  aprs\_ssid      String?  
  preferred\_mode String   @default("acoustic")  // "bluetooth", "serial", "acoustic"  
  created\_at     DateTime @default(now())  
}

model HTMessage {  
  id           String   @id @default(cuid())  
  sender\_id    String   @map("sender\_id")  
  recipient\_id String?  @map("recipient\_id")  
  content      String  
  freq         Float  
  protocol     String   // "APRS", "DMR", "FSK"  
  mode         String   // "bluetooth", "serial", "acoustic"  
  status       String   @default("pending")  
  created\_at   DateTime @default(now())  
  sent\_at      DateTime?  
  delivered\_at DateTime?  
}  
\`\`\`

\---

TASK 6: PANDUAN HT (HANDY TALKY)

6.1 Struktur Konten

\`\`\`  
📻 PANDUAN HT (Handy Talky) — Ngopi  
├── 1\. Pengenalan HT (VHF vs UHF, daya, frekuensi)  
├── 2\. Legalitas di Indonesia (IAR, KRAP, ORARI, sanksi)  
├── 3\. Cara Menggunakan HT di Ngopi  
│   ├── Install Ngopi sebagai PWA  
│   ├── Aktifkan Mode Offline  
│   ├── Pilih Mode HT (Bluetooth/Serial/Akustik)  
│   ├── Mengatur Frekuensi & CTCSS  
│   └── Mengirim Pesan via HT  
├── 4\. Etika Berkomunikasi Radio (CQ, callsign, sopan)  
├── 5\. Frekuensi Penting di Indonesia  
├── 6\. APRS (Automatic Packet Reporting)  
└── 7\. Emergency Mode (MAYDAY, kontak SAR)  
\`\`\`

6.2 Contoh Isi (Section 3\)

\`\`\`markdown  
\# Cara Menggunakan HT di Ngopi (Mode Offline)

\#\# 3.1 Install Ngopi sebagai PWA  
1\. Buka https\://ngopi.top di Chrome/Safari.  
2\. Klik menu → "Add to Home Screen" / "Install App".  
3\. Ngopi akan terinstall seperti aplikasi native.  
4\. Setelah terinstall, Ngopi bisa dibuka \*\*tanpa internet\*\*.

\#\# 3.2 Aktifkan Mode Offline  
1\. Buka Ngopi (dari home screen).  
2\. Masuk ke \*\*Pengaturan\*\* → \*\*Mode Offline\*\*.  
3\. Aktifkan \*\*Mode HT\*\*.  
4\. Pilih mode koneksi:  
   \- \*\*Bluetooth\*\* (Android dengan HT Bluetooth)  
   \- \*\*Serial\*\* (Desktop dengan dongle USB)  
   \- \*\*Akustik\*\* (semua device, tanpa hardware)

\#\# 3.3 Mengatur Frekuensi  
\- Default: \*\*145.500 MHz\*\* (Simplex VHF).  
\- Ubah sesuai kesepakatan komunitas.  
\- \*\*CTCSS/DCS\*\*: Aktifkan jika ada interferensi.

\#\# 3.4 Mengirim Pesan  
\- \*\*Teks\*\*: Ketik → klik "Kirim via HT".  
\- \*\*Voice\*\*: Tekan-tahan PTT → bicara → lepas.  
\- \*\*Emergency\*\*: Klik SOS → kirim posisi GPS \+ pesan darurat.

\#\# 3.5 Sinkronisasi  
\- Saat online kembali, semua pesan HT otomatis disinkronkan ke server.  
\- Cek status di \*\*📥 Pesan Menunggu Sinkronisasi\*\*.  
\`\`\`

\---

TASK 7: PANDUAN P3K (PERTOLONGAN PERTAMA)

7.1 Struktur Konten

\`\`\`  
🚨 PANDUAN P3K & DARURAT — Ngopi  
├── 1\. Prinsip Dasar P3K (DRSABCD, 112/119/115)  
├── 2\. Kecelakaan Lalu Lintas  
├── 3\. Luka Bakar (derajat 1/2/3)  
├── 4\. Serangan Jantung & Henti Napas (CPR)  
├── 5\. Tersedak (Heimlich)  
├── 6\. Pendarahan (tekan langsung, tourniquet)  
├── 7\. Tenggelam  
├── 8\. Bencana Alam (gempa, banjir, longsor, tsunami)  
├── 9\. Evakuasi & Shelter  
└── 10\. Kontak Darurat Indonesia (112, 119, 115, 113, BNPB, PMI)  
\`\`\`

7.2 Emergency Mode

Tombol SOS yang otomatis:

1\. Kirim lokasi GPS ke kontak darurat & frekuensi HT darurat.  
2\. Notifikasi ke grup "Warung Kopi Darurat".  
3\. Tampilkan panduan P3K relevan.  
4\. Buka akses ke frekuensi HT darurat.

7.3 Database Schema

\`\`\`prisma  
model EmergencyContact {  
  id          String   @id @default(cuid())  
  user\_id     String   @map("user\_id")  
  name        String  
  phone       String  
  relation    String  
  is\_primary  Boolean  @default(false)  
  created\_at  DateTime @default(now())  
}

model EmergencyLog {  
  id          String   @id @default(cuid())  
  user\_id     String   @map("user\_id")  
  type        String   // "accident", "medical", "disaster"  
  latitude    Float?  
  longitude   Float?  
  description String?  
  status      String   @default("active")  
  responded\_by String\[\]  
  created\_at  DateTime @default(now())  
}  
\`\`\`

\---

TASK 8: INTEGRASI DI UI NGOPI

8.1 Menu Utama (Dropdown)

\`\`\`  
📻 Panduan HT  
🚨 P3K Darurat  
🁫 Gapleh (Level 1 & Level 2\)  
\`\`\`

8.2 Halaman Gapleh

· Pilihan Level: Level 1 (Klasik) atau Level 2 (Rame \- 4 pemain).  
· Pilihan Bot: Saat main dengan bot, pilih nama karakter.  
· Tombol Share: Muncul otomatis saat nutup/digapleh.  
· Leaderboard: Top 10 pemain (human \+ bot).  
· Badge: "Jagal Gapleh", "Nutup Master", "Digapleh Hunter".

8.3 Mode Offline Indicator

· Banner: "📡 Mode Offline Aktif — HT Siap"  
· Badge di header: "OFFLINE"  
· Notifikasi: "Pesan akan disinkronkan saat online."

\---

TASK 9: PRIORITAS EKSEKUSI

Sprint Task Estimasi  
Sprint 1 Update aturan gapleh (poin 50/75/500) 1 minggu  
Sprint 2 Sistem Level Gapleh (Level 1 & 2, pilih bot) 2 minggu  
Sprint 3 Fitur Share Sosmed \+ Hook \+ Desain Kartu 1,5 minggu  
Sprint 4 Bot Gapleh dapat poin \+ leaderboard 1 minggu  
Sprint 5 PWA \+ Service Worker (fondasi offline) 1,5 minggu  
Sprint 6 HT Offline: Web Bluetooth 1,5 minggu  
Sprint 7 HT Offline: Web Serial (dongle USB) 1,5 minggu  
Sprint 8 HT Offline: Mode Akustik (FSK) 2 minggu  
Sprint 9 HTManager \+ Sinkronisasi \+ UI 1,5 minggu  
Sprint 10 Panduan HT (konten \+ UI) 1 minggu  
Sprint 11 Panduan P3K (konten \+ UI \+ Offline) 2 minggu  
Sprint 12 Emergency Mode \+ Testing 1,5 minggu

\---

TASK 10: PERINTAH EKSEKUSI UNTUK AI AGENT

"Mulai dari Sprint 1: Update aturan & sistem poin Gapleh.

Langkah:

1\. Update GaplehRules.ts:  
   · Kartu pertama TIDAK BOLEH balak 6 atau balak 0\.  
   · Balak 6 & 0 hanya boleh dimainkan sebagai nutup.  
2\. Update GaplehGame.ts:  
   · Gapleh biasa: 50 poin.  
   · Digapleh (buntu): 75 poin.  
   · Nutup balak 6/0: 500 poin.  
   · Bonus streak x1.5, first time nutup x3.  
3\. Implementasikan checkDigapleh() dan determineDigaplehWinner().  
4\. Update database schema: GaplehMatch, UserGaplehStats, BotProfile, GaplehLevel, GaplehMatchV2.  
5\. Bot juga dapat poin (tersimpan di BotProfile).  
6\. Buat unit test sesuai skenario.  
7\. Setelah Sprint 1 selesai, laporkan dan tunggu konfirmasi saya."

Setelah Sprint 1 selesai, lanjutkan ke Sprint 2 (Sistem Level Gapleh), dst.

Untuk setiap sprint, sertakan:

· File yang dibuat/diubah.  
· Cara testing manual.  
· Risiko/edge case.  
· Screenshot UI (jika ada).

\---

TASK 11: CATATAN AKHIR

11.1 HT Offline — Kunci Sukses

1\. PWA wajib — tanpa PWA, HT tidak akan berfungsi offline.  
2\. Test di berbagai browser — Web Bluetooth hanya di Chrome/Edge.  
3\. Fallback ke akustik — jika Bluetooth/Serial tidak tersedia.  
4\. Sinkronisasi otomatis — saat online kembali.  
5\. Legalitas — user wajib punya lisensi IAR/KRAP.

11.2 Level Gapleh — User-Friendly

· Level 1 \= sistem lama (tidak diubah).  
· Level 2 \= 4 pemain \+ pilih bot dengan nama karakter.  
· User bebas memilih level saat akan bermain.

11.3 Viralitas

· Hook share pendek (max 100 karakter).  
· Desain kartu aesthetic.  
· Hashtag konsisten: \#NgopiGapleh \#GaplehIndonesia \#NutupBalak6 \#Digapleh.

11.4 Validasi Konten

· P3K → Validasi dengan PMI/RSUP.  
· HT → Validasi dengan ORARI.  
· Frekuensi darurat → 145.000 MHz (VHF), 433.000 MHz (UHF).

11.5 Larangan

· ❌ Jangan gunakan frekuensi HT ilegal.  
· ❌ Jangan gunakan aset berhak cipta.  
· ❌ Jangan hardcode secret/API key.  
· ❌ Jangan deploy tanpa testing.

\---

Selamat membangun\! Semoga Ngopi semakin bermanfaat bagi warga Indonesia\! ☕🁫📻🚨

\`\`\`

\---

\#\#\# 🚀 Cara Menggunakan

1\. \*\*Copy\*\* seluruh isi file di atas.  
2\. \*\*Simpan\*\* sebagai \`PROMPT\_NGOPI\_GAPLEH\_v3\_FINAL.md\` di root project Ngopi.  
3\. \*\*Buka Antigravity IDE\*\*, \*attach\* file ini ke AI Agent.  
4\. \*\*Beri perintah\*\*:  
   \> \*"Jalankan Sprint 1 dari PROMPT\_NGOPI\_GAPLEH\_v3\_FINAL.md. Setelah selesai, laporkan dan tunggu konfirmasi saya sebelum lanjut ke Sprint 2."\*  
5\. \*\*Setelah setiap sprint selesai\*\*, review hasilnya, lalu perintahkan sprint berikutnya.

\#\#\# 💡 Ringkasan Revisi v3

| Sebelumnya | Setelah Revisi v3 |  
| :--- | :--- |  
| Gapleh hanya 1 mode | \*\*Gapleh Level 1 (Klasik) & Level 2 (Rame \- 4 pemain)\*\* |  
| Bot tidak bisa dipilih namanya | \*\*Bot bisa dipilih dengan nama karakter\*\* |  
| HT hanya dijelaskan konsep | \*\*HT sekarang bisa berfungsi offline via PWA \+ Web Bluetooth/Serial/Akustik\*\* |  
| Belum ada PWA | \*\*PWA \+ Service Worker untuk offline-first\*\* |

\#\#\# 🎯 Kunci Jawaban: Bagaimana HT Berfungsi Tanpa Internet?

\*\*3 lapisan solusi\*\*:  
1\. \*\*PWA (Progressive Web App)\*\* → Aplikasi di-cache di browser, bisa dibuka offline.  
2\. \*\*Web Bluetooth / Web Serial API\*\* → Browser bisa komunikasi langsung dengan hardware HT.  
3\. \*\*Web Audio API\*\* → Mode akustik (speaker HP ↔ mic HT) tanpa hardware tambahan.

Dengan kombinasi ini, \`ngopi.top\` bisa berfungsi sebagai \*\*aplikasi HT\*\* meskipun tidak ada internet — selama user sudah \*\*install sebagai PWA\*\* dan punya \*\*HT fisik\*\* atau \*\*dongle HT\*\*.

Semoga membantu\! ☕📻🚀