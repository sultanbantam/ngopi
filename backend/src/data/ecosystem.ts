export type EcosystemFaqSeed = {
  question: string;
  answer: string;
  keywords: string[];
};

export type EcosystemPlatformSeed = {
  name: string;
  display_name: string;
  description: string;
  website_url: string;
  icon: string;
  aliases: string[];
  faqs: EcosystemFaqSeed[];
};

export const ECOSYSTEM_PLATFORMS: EcosystemPlatformSeed[] = [
  {
    name: 'bamboochain',
    display_name: 'Bamboochain ID',
    description: 'Blockchain ekosistem Bambu untuk identitas, wallet, BMC, dan akses layanan on-chain.',
    website_url: 'https://bamboochain.id',
    icon: 'BC',
    aliases: ['bamboochain.id', 'bamboo chain', 'chain', 'wallet', 'bmc', 'dompet'],
    faqs: [
      {
        question: 'Bagaimana cara daftar akun Bamboochain?',
        answer: 'Buka bamboochain.id, pilih daftar atau masuk, lalu ikuti verifikasi akun. Setelah akun aktif, hubungkan wallet agar layanan BMC dan akses token-gated dapat digunakan.',
        keywords: ['daftar', 'registrasi', 'akun', 'login', 'verifikasi'],
      },
      {
        question: 'Bagaimana cara menghubungkan wallet ke BambooChat?',
        answer: 'Di BambooChat buka menu akun, pilih Atur Alamat Dompet, lalu masukkan alamat wallet BEP20 yang sama dengan akun Bamboochain Anda.',
        keywords: ['wallet', 'dompet', 'alamat', 'bep20', 'hubungkan'],
      },
      {
        question: 'Apa itu BMC?',
        answer: 'BMC adalah token utilitas ekosistem Bambu yang digunakan untuk akses fitur, token gating rumpun, reward, dan aktivitas komunitas sesuai kebijakan platform.',
        keywords: ['bmc', 'token', 'utilitas', 'reward', 'gating'],
      },
      {
        question: 'Bagaimana cara topup BMC?',
        answer: 'Topup BMC dilakukan dari wallet yang didukung Bamboochain. Pastikan jaringan dan alamat tujuan benar sebelum mengirim transaksi.',
        keywords: ['topup', 'isi saldo', 'deposit', 'bmc', 'transaksi'],
      },
      {
        question: 'Kenapa saldo BMC belum masuk?',
        answer: 'Periksa status transaksi, jaringan yang digunakan, dan alamat wallet. Jika transaksi sukses tetapi saldo belum tampil, tunggu sinkronisasi atau buat tiket CS dengan hash transaksi.',
        keywords: ['saldo', 'belum masuk', 'pending', 'hash', 'sinkronisasi'],
      },
      {
        question: 'Bagaimana melihat riwayat transaksi?',
        answer: 'Riwayat transaksi dapat dilihat dari dashboard wallet Bamboochain atau explorer yang terhubung. Simpan hash transaksi saat melapor ke CS.',
        keywords: ['riwayat', 'history', 'transaksi', 'explorer', 'hash'],
      },
      {
        question: 'Apakah private key disimpan BambooChat?',
        answer: 'Tidak. BambooChat hanya menyimpan data profil dan alamat publik yang Anda masukkan. Jangan pernah membagikan private key atau seed phrase kepada siapa pun.',
        keywords: ['private key', 'seed phrase', 'keamanan', 'wallet', 'rahasia'],
      },
      {
        question: 'Bagaimana memulihkan akun Bamboochain?',
        answer: 'Gunakan mekanisme pemulihan resmi di bamboochain.id. Jika terkait BambooChat, buat tiket CS dan sertakan username serta alamat wallet publik.',
        keywords: ['pulih', 'recovery', 'lupa', 'akun', 'wallet'],
      },
      {
        question: 'Apa fungsi token gated group?',
        answer: 'Token gated group membatasi akses rumpun berdasarkan minimum saldo BMC pada wallet pengguna, sehingga komunitas eksklusif dapat dikelola otomatis.',
        keywords: ['token gated', 'rumpun', 'grup', 'akses', 'minimum saldo'],
      },
      {
        question: 'Ke mana melapor masalah transaksi Bamboochain?',
        answer: 'Buat tiket CS dengan platform Bamboochain, jelaskan masalah, alamat wallet, waktu transaksi, dan hash transaksi bila tersedia.',
        keywords: ['lapor', 'masalah', 'tiket', 'transaksi', 'cs'],
      },
    ],
  },
  {
    name: 'bamboogame',
    display_name: 'Bamboo Game',
    description: 'Platform gaming ekosistem Bambu untuk permainan, reward, event, dan aset in-game.',
    website_url: 'https://bamboogame.click',
    icon: 'BG',
    aliases: ['bamboogame.click', 'bamboo game', 'game', 'gaming', 'play'],
    faqs: [
      {
        question: 'Bagaimana cara mulai bermain di Bamboo Game?',
        answer: 'Masuk ke bamboogame.click, pilih game yang tersedia, hubungkan akun ekosistem Bambu bila diminta, lalu ikuti instruksi mulai bermain pada halaman game.',
        keywords: ['main', 'mulai', 'game', 'login', 'akun'],
      },
      {
        question: 'Apakah Bamboo Game membutuhkan BMC?',
        answer: 'Sebagian event atau fitur dapat memakai BMC sebagai akses atau reward. Detail kebutuhan token selalu ditampilkan pada halaman game atau event.',
        keywords: ['bmc', 'akses', 'event', 'reward', 'token'],
      },
      {
        question: 'Apa itu token in-game?',
        answer: 'Token in-game adalah aset atau poin yang berlaku di dalam permainan. Nilai, penukaran, dan masa berlaku mengikuti aturan masing-masing game.',
        keywords: ['token in-game', 'poin', 'aset', 'reward', 'penukaran'],
      },
      {
        question: 'Kenapa reward game belum diterima?',
        answer: 'Reward biasanya diproses setelah validasi skor atau event selesai. Jika melewati estimasi waktu, buat tiket CS dengan nama game, username, dan bukti skor.',
        keywords: ['reward', 'hadiah', 'belum diterima', 'skor', 'event'],
      },
      {
        question: 'Bagaimana melaporkan bug game?',
        answer: 'Buat tiket Bamboo Game, sertakan nama game, perangkat, browser atau versi aplikasi, langkah reproduksi, dan screenshot bila ada.',
        keywords: ['bug', 'error', 'lapor', 'screenshot', 'perangkat'],
      },
      {
        question: 'Apakah akun Bamboo Game sama dengan BambooChat?',
        answer: 'Akun dapat memakai identitas ekosistem yang sama bila integrasi tersedia. Jika login gagal, pastikan akun Bamboochain atau BambooChat Anda masih aktif.',
        keywords: ['akun', 'login', 'bamboochat', 'sso', 'integrasi'],
      },
      {
        question: 'Bagaimana mengikuti turnamen atau event?',
        answer: 'Buka halaman event di Bamboo Game, baca syarat peserta, periode event, dan mekanisme klaim reward sebelum bergabung.',
        keywords: ['turnamen', 'event', 'kompetisi', 'syarat', 'reward'],
      },
      {
        question: 'Kenapa game terasa lambat?',
        answer: 'Periksa koneksi internet, tutup tab berat, gunakan browser terbaru, dan coba refresh. Jika tetap lambat, laporkan detail perangkat lewat tiket.',
        keywords: ['lambat', 'lag', 'browser', 'koneksi', 'performa'],
      },
      {
        question: 'Apakah aset game bisa dipindahkan ke wallet?',
        answer: 'Aset yang mendukung on-chain transfer akan memiliki tombol klaim atau withdraw resmi. Jangan mengirim aset ke alamat yang tidak didukung.',
        keywords: ['aset', 'withdraw', 'wallet', 'klaim', 'transfer'],
      },
      {
        question: 'Bagaimana reset progres game?',
        answer: 'Reset progres hanya tersedia untuk game tertentu. Buat tiket Bamboo Game jika perlu bantuan reset atau pemulihan progres.',
        keywords: ['reset', 'progres', 'save', 'pemulihan', 'game'],
      },
    ],
  },
  {
    name: 'xignalx',
    display_name: 'XignalX',
    description: 'Platform sinyal, data, dan insight ekosistem Bambu untuk membantu pemantauan informasi.',
    website_url: 'https://xignalx.click',
    icon: 'XX',
    aliases: ['xignalx.click', 'xignal', 'signal', 'sinyal', 'data', 'insight'],
    faqs: [
      {
        question: 'Apa itu XignalX?',
        answer: 'XignalX adalah platform sinyal dan data ekosistem Bambu. Gunakan informasi di dalamnya sebagai referensi, bukan satu-satunya dasar keputusan finansial.',
        keywords: ['xignalx', 'sinyal', 'data', 'insight', 'referensi'],
      },
      {
        question: 'Bagaimana membaca sinyal di XignalX?',
        answer: 'Perhatikan sumber data, indikator, waktu pembaruan, dan catatan risiko yang ditampilkan bersama sinyal.',
        keywords: ['membaca', 'sinyal', 'indikator', 'update', 'risiko'],
      },
      {
        question: 'Apakah sinyal XignalX adalah rekomendasi investasi?',
        answer: 'Tidak. Sinyal adalah informasi analitis. Pengguna tetap bertanggung jawab atas keputusan masing-masing dan perlu mempertimbangkan risiko.',
        keywords: ['rekomendasi', 'investasi', 'risiko', 'disclaimer', 'analisis'],
      },
      {
        question: 'Kenapa data XignalX terlambat update?',
        answer: 'Keterlambatan dapat terjadi karena sumber data, jaringan, atau proses sinkronisasi. Refresh halaman dan laporkan bila data tidak berubah lama.',
        keywords: ['data', 'terlambat', 'update', 'sinkronisasi', 'refresh'],
      },
      {
        question: 'Bagaimana mengatur notifikasi sinyal?',
        answer: 'Masuk ke pengaturan XignalX, pilih kategori sinyal, lalu aktifkan notifikasi untuk kanal yang didukung.',
        keywords: ['notifikasi', 'alert', 'pengaturan', 'kategori', 'sinyal'],
      },
      {
        question: 'Apa arti confidence pada sinyal?',
        answer: 'Confidence menggambarkan tingkat kecocokan indikator dalam model XignalX. Nilai tinggi tidak menjamin hasil, tetapi menunjukkan sinyal lebih konsisten dengan data.',
        keywords: ['confidence', 'skor', 'indikator', 'model', 'akurasi'],
      },
      {
        question: 'Bagaimana melaporkan data yang salah?',
        answer: 'Buat tiket XignalX dan sertakan nama indikator, waktu data, screenshot, serta perbandingan sumber bila tersedia.',
        keywords: ['data salah', 'lapor', 'indikator', 'screenshot', 'sumber'],
      },
      {
        question: 'Apakah XignalX punya API?',
        answer: 'Ketersediaan API mengikuti paket dan kebijakan platform. Hubungi CS untuk kebutuhan integrasi data atau akses developer.',
        keywords: ['api', 'developer', 'integrasi', 'akses', 'data'],
      },
      {
        question: 'Bagaimana memilih kategori sinyal?',
        answer: 'Pilih kategori berdasarkan kebutuhan informasi Anda, lalu baca definisi indikator dan periode data sebelum mengaktifkan alert.',
        keywords: ['kategori', 'alert', 'periode', 'indikator', 'pilih'],
      },
      {
        question: 'Kenapa saya tidak menerima alert?',
        answer: 'Pastikan notifikasi browser atau aplikasi aktif, kategori sudah dipilih, dan tidak ada filter yang membatasi alert.',
        keywords: ['alert', 'notifikasi', 'tidak masuk', 'filter', 'browser'],
      },
    ],
  },
  {
    name: 'votiva',
    display_name: 'Votiva',
    description: 'Platform voting dan governance untuk proposal, jajak pendapat, dan keputusan komunitas.',
    website_url: 'https://votiva.click',
    icon: 'VT',
    aliases: ['votiva.click', 'vote', 'voting', 'governance', 'poll', 'proposal'],
    faqs: [
      {
        question: 'Apa itu Votiva?',
        answer: 'Votiva adalah platform voting dan governance untuk membuat proposal, mengadakan voting, dan melihat hasil keputusan komunitas.',
        keywords: ['votiva', 'voting', 'governance', 'proposal', 'komunitas'],
      },
      {
        question: 'Bagaimana cara membuat voting?',
        answer: 'Masuk ke Votiva, pilih buat voting, isi judul, deskripsi, opsi, periode, dan aturan pemilih, lalu publikasikan jika data sudah benar.',
        keywords: ['buat voting', 'poll', 'opsi', 'periode', 'publikasi'],
      },
      {
        question: 'Bagaimana cara ikut memilih?',
        answer: 'Buka halaman voting aktif, pastikan akun atau wallet memenuhi syarat, pilih opsi, lalu konfirmasi pilihan sebelum periode berakhir.',
        keywords: ['memilih', 'vote', 'syarat', 'wallet', 'konfirmasi'],
      },
      {
        question: 'Apakah vote bisa diubah?',
        answer: 'Kemampuan mengubah vote tergantung aturan voting. Jika voting mengunci pilihan, vote yang sudah dikirim tidak dapat diubah.',
        keywords: ['ubah vote', 'edit', 'pilihan', 'aturan', 'terkunci'],
      },
      {
        question: 'Kenapa saya tidak bisa vote?',
        answer: 'Periksa periode voting, syarat pemilih, koneksi wallet, dan status akun. Jika semua sesuai tetapi gagal, buat tiket Votiva.',
        keywords: ['tidak bisa vote', 'gagal', 'periode', 'syarat', 'wallet'],
      },
      {
        question: 'Bagaimana melihat hasil voting?',
        answer: 'Hasil voting tersedia pada halaman detail voting. Beberapa voting menampilkan hasil setelah periode selesai sesuai aturan pembuat.',
        keywords: ['hasil', 'result', 'voting', 'periode', 'detail'],
      },
      {
        question: 'Apa itu proposal governance?',
        answer: 'Proposal governance adalah usulan keputusan yang dapat dibahas dan dipilih oleh komunitas atau pemegang hak suara.',
        keywords: ['proposal', 'governance', 'usulan', 'keputusan', 'hak suara'],
      },
      {
        question: 'Bagaimana mencegah vote ganda?',
        answer: 'Votiva menerapkan aturan identitas, akun, atau wallet sesuai konfigurasi voting untuk membatasi satu pemilih pada satu suara.',
        keywords: ['vote ganda', 'anti fraud', 'identitas', 'wallet', 'aturan'],
      },
      {
        question: 'Apakah voting bersifat publik?',
        answer: 'Visibilitas voting bergantung pengaturan pembuat. Ada voting publik, terbatas komunitas, atau hanya untuk pemegang syarat tertentu.',
        keywords: ['publik', 'privat', 'komunitas', 'akses', 'visibilitas'],
      },
      {
        question: 'Bagaimana melaporkan voting bermasalah?',
        answer: 'Buat tiket Votiva dengan link voting, deskripsi masalah, waktu kejadian, dan screenshot bila tersedia.',
        keywords: ['lapor', 'masalah', 'voting', 'screenshot', 'link'],
      },
    ],
  },
  {
    name: 'aichitect',
    display_name: 'Aichitect',
    description: 'Platform AI dan arsitektur untuk membuat konsep, desain, prompt, dan workflow kreatif.',
    website_url: 'https://aichitect.click',
    icon: 'AI',
    aliases: ['aichitect.click', 'ai chitect', 'ai', 'arsitektur', 'desain', 'generate'],
    faqs: [
      {
        question: 'Apa itu Aichitect?',
        answer: 'Aichitect adalah platform AI untuk membantu membuat konsep desain, prompt, arsitektur ide, dan workflow kreatif dalam ekosistem Bambu.',
        keywords: ['aichitect', 'ai', 'desain', 'arsitektur', 'prompt'],
      },
      {
        question: 'Bagaimana generate desain di Aichitect?',
        answer: 'Masuk ke Aichitect, pilih mode desain, tulis prompt yang jelas, tentukan gaya atau kebutuhan, lalu jalankan generate.',
        keywords: ['generate', 'desain', 'prompt', 'mode', 'gaya'],
      },
      {
        question: 'Bagaimana membuat prompt yang baik?',
        answer: 'Jelaskan tujuan, konteks, gaya, batasan, ukuran, dan contoh referensi. Prompt yang spesifik biasanya menghasilkan output lebih relevan.',
        keywords: ['prompt', 'tips', 'spesifik', 'konteks', 'referensi'],
      },
      {
        question: 'Kenapa hasil AI tidak sesuai?',
        answer: 'Coba perjelas prompt, kurangi instruksi yang saling bertentangan, dan gunakan iterasi. Jika terjadi error sistem, buat tiket Aichitect.',
        keywords: ['hasil', 'tidak sesuai', 'prompt', 'iterasi', 'error'],
      },
      {
        question: 'Apakah hasil Aichitect bisa digunakan komersial?',
        answer: 'Hak penggunaan mengikuti ketentuan layanan Aichitect dan sumber input yang Anda gunakan. Periksa lisensi sebelum penggunaan komersial.',
        keywords: ['komersial', 'lisensi', 'hak pakai', 'terms', 'output'],
      },
      {
        question: 'Bagaimana menyimpan hasil desain?',
        answer: 'Gunakan tombol simpan atau unduh pada halaman hasil. Jika unduhan gagal, ulangi proses atau buat tiket dengan detail proyek.',
        keywords: ['simpan', 'unduh', 'download', 'hasil', 'proyek'],
      },
      {
        question: 'Apakah Aichitect mendukung revisi?',
        answer: 'Ya, gunakan fitur iterasi atau revisi bila tersedia. Tambahkan instruksi perubahan yang konkret agar AI memahami arah revisi.',
        keywords: ['revisi', 'iterasi', 'ubah', 'instruksi', 'desain'],
      },
      {
        question: 'Bagaimana mengatasi limit generate?',
        answer: 'Limit generate mengikuti paket atau kebijakan platform. Tunggu reset kuota atau hubungi CS untuk opsi peningkatan akses.',
        keywords: ['limit', 'kuota', 'generate', 'paket', 'akses'],
      },
      {
        question: 'Apakah saya boleh mengunggah referensi?',
        answer: 'Unggah referensi hanya jika Anda memiliki hak pakai dan tidak berisi data sensitif. Ikuti batas ukuran file yang ditentukan platform.',
        keywords: ['unggah', 'referensi', 'file', 'hak pakai', 'sensitif'],
      },
      {
        question: 'Bagaimana melaporkan output bermasalah?',
        answer: 'Buat tiket Aichitect dan sertakan prompt, mode, waktu generate, serta screenshot output agar tim dapat mengecek konteksnya.',
        keywords: ['output', 'masalah', 'lapor', 'prompt', 'screenshot'],
      },
    ],
  },
  {
    name: 'whaleofsavu',
    display_name: 'Whale of Savu',
    description: 'Komunitas dan inisiatif sosial ekosistem Bambu yang berfokus pada edukasi, konservasi, dan kolaborasi.',
    website_url: 'https://whaleofsavu.org',
    icon: 'WS',
    aliases: ['whaleofsavu.org', 'whale of savu', 'savu', 'komunitas', 'sosial', 'konservasi'],
    faqs: [
      {
        question: 'Apa itu Whale of Savu?',
        answer: 'Whale of Savu adalah inisiatif komunitas dalam ekosistem Bambu yang mendukung edukasi, konservasi, dan kolaborasi sosial.',
        keywords: ['whale of savu', 'komunitas', 'inisiatif', 'edukasi', 'konservasi'],
      },
      {
        question: 'Bagaimana bergabung dengan komunitas Whale of Savu?',
        answer: 'Kunjungi whaleofsavu.org atau kanal komunitas resmi, lalu ikuti panduan pendaftaran relawan, anggota, atau kolaborator.',
        keywords: ['bergabung', 'komunitas', 'relawan', 'anggota', 'kolaborator'],
      },
      {
        question: 'Apa kegiatan utama Whale of Savu?',
        answer: 'Kegiatan dapat mencakup edukasi publik, kampanye konservasi, kolaborasi komunitas, publikasi informasi, dan program sosial.',
        keywords: ['kegiatan', 'edukasi', 'kampanye', 'konservasi', 'program'],
      },
      {
        question: 'Bagaimana menjadi relawan?',
        answer: 'Isi formulir atau hubungi kanal resmi Whale of Savu, sebutkan minat, lokasi, dan ketersediaan waktu Anda.',
        keywords: ['relawan', 'volunteer', 'formulir', 'minat', 'lokasi'],
      },
      {
        question: 'Apakah ada donasi untuk Whale of Savu?',
        answer: 'Jika program donasi aktif, gunakan tautan resmi di whaleofsavu.org. Hindari transfer ke rekening atau wallet yang tidak diumumkan resmi.',
        keywords: ['donasi', 'rekening', 'wallet', 'resmi', 'program'],
      },
      {
        question: 'Bagaimana mengusulkan kolaborasi?',
        answer: 'Buat tiket Whale of Savu atau hubungi kanal resmi dengan proposal singkat, tujuan kolaborasi, jadwal, dan kontak penanggung jawab.',
        keywords: ['kolaborasi', 'proposal', 'kerja sama', 'jadwal', 'kontak'],
      },
      {
        question: 'Bagaimana mendapatkan materi edukasi?',
        answer: 'Materi edukasi tersedia melalui website atau kanal komunitas resmi jika sudah dipublikasikan. Buat tiket jika membutuhkan materi khusus.',
        keywords: ['materi', 'edukasi', 'publikasi', 'website', 'dokumen'],
      },
      {
        question: 'Apakah kegiatan Whale of Savu tersedia online?',
        answer: 'Sebagian kegiatan dapat berlangsung online melalui webinar, diskusi komunitas, atau publikasi digital sesuai jadwal program.',
        keywords: ['online', 'webinar', 'diskusi', 'jadwal', 'digital'],
      },
      {
        question: 'Bagaimana melaporkan informasi palsu tentang Whale of Savu?',
        answer: 'Laporkan melalui tiket Whale of Savu dengan link, screenshot, dan sumber informasi agar tim dapat memverifikasi.',
        keywords: ['informasi palsu', 'hoaks', 'lapor', 'screenshot', 'verifikasi'],
      },
      {
        question: 'Di mana melihat pengumuman resmi?',
        answer: 'Pengumuman resmi dapat dilihat di whaleofsavu.org dan kanal komunitas yang ditautkan dari website tersebut.',
        keywords: ['pengumuman', 'resmi', 'website', 'kanal', 'komunitas'],
      },
    ],
  },
];

export const PLATFORM_NAMES = ECOSYSTEM_PLATFORMS.map((platform) => platform.name);

export const getPlatformDirectoryText = () =>
  ECOSYSTEM_PLATFORMS.map(
    (platform, index) =>
      `${index + 1}. ${platform.display_name} (${platform.website_url}) - ${platform.description}`
  ).join('\n');