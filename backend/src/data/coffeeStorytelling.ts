export interface CoffeeStory {
  id: string;
  keywords: string[];
  title: string;
  origin: string;
  story: string;
}

export interface FeatureQnA {
  id: string;
  keywords: string[];
  title: string;
  answer: string;
}

export const COFFEE_STORIES: CoffeeStory[] = [
  {
    id: 'gayo',
    keywords: ['gayo', 'aceh gayo', 'kopi aceh', 'takengon'],
    title: '☕ Kopi Aceh Gayo — Mutiara Hijau dari Tanah Rencong',
    origin: 'Dataran Tinggi Gayo, Aceh Tengah (1.200 - 1.600 mdpl)',
    story:
      'Tumbuh subur di lereng perbukitan sejuk sekitar Danau Laut Tawar, Aceh Gayo adalah salah satu kopi arabika organik paling tersohor di dunia. ' +
      'Karakternya sangat kaya: keasaman bersih (clean acidity), semburat aroma rempah-rempah herbal, serta aftertaste manis buah persik dan karamel. ' +
      'Petani Gayo merawat pohon kopi di bawah naungan pohon lamtoro dan alpukat, menciptakan ekosistem alami yang menjaga cita rasa legendarisnya sejak puluhan tahun silam.',
  },
  {
    id: 'mandailing',
    keywords: ['mandailing', 'lintong', 'kopi sumatera', 'toba', 'sidikalang'],
    title: '☕ Kopi Mandailing & Lintong — Legenda Body Pekat Tanah Batak',
    origin: 'Mandailing Natal & Lintong Nihuta, Sumatera Utara',
    story:
      'Dikenal dunia sejak abad ke-19, Kopi Mandailing diproses dengan metode khas "Giling Basah" (wet hulled). ' +
      'Metode ini menghasilkan karakter yang sangat unik: body tebal yang mantap di lidah, aroma earthy yang hangat, sentuhan cokelat pekat (dark chocolate), dan rempah pala. ' +
      'Sangat nikmat diseduh manual maupun dijadikan racikan kopi susu kental warkop.',
  },
  {
    id: 'toraja',
    keywords: ['toraja', 'kalosi', 'sapan', 'kopi toraja', 'sulawesi'],
    title: '☕ Kopi Toraja Kalosi — Keanggunan Floral dari Bumi Lakipadada',
    origin: 'Tana Toraja & Enrekang, Sulawesi Selatan (1.400 - 2.100 mdpl)',
    story:
      'Ditanam di lereng pegunungan batu terjal Toraja, biji kopi Kalosi dan Sapan terkenal dengan aroma floral semerbak bunga kopi liar dan buah ceri hitam. ' +
      'Tingkat keasamannya seimbang dengan sentuhan rasa kayu manis (cinnamon) dan kapulaga. ' +
      'Bagi para pecinta seduh filter seperti V60 atau French Press, Toraja selalu memberikan ketenangan aroma yang magis.',
  },
  {
    id: 'kintamani',
    keywords: ['kintamani', 'kopi bali', 'bali kintamani', 'batur'],
    title: '☕ Kopi Bali Kintamani — Kesegaran Jeruk dari Lereng Gunung Batur',
    origin: 'Kintamani, Bangli, Bali (1.200 - 1.500 mdpl)',
    story:
      'Keunikan terbesar Kopi Kintamani lahir dari kearifan lokal sistem "Subak Abian", di mana pohon kopi ditanam berdampingan dengan kebun pohon jeruk Bali. ' +
      'Hal ini menghasilkan aroma alami sitrus yang segar (citrusy orange notes), body medium yang ringan, dan aftertaste manis madu. ' +
      'Sangat menyegarkan diminum dingin (Japanese Ice Drip) saat siang hari terik di warung.',
  },
  {
    id: 'bajawa',
    keywords: ['bajawa', 'flores', 'kopi flores', 'ngada'],
    title: '☕ Kopi Flores Bajawa — Cokelat Manis dari Lembah Vulkanik',
    origin: 'Dataran Tinggi Ngada, Flores, NTT (1.200 - 1.800 mdpl)',
    story:
      'Dipelihara di atas tanah vulkanik subur Gunung Inerie yang kaya mineral alami. ' +
      'Flores Bajawa memanjakan lidah dengan aroma tembakau manis (sweet tobacco), kacang hazelnut panggang, serta lelehan cokelat susu. ' +
      'Tingkat keasaman yang rendah menjadikannya favorit banyak penikmat kopi yang menyukai seduhan lembut di perut.',
  },
  {
    id: 'wamena',
    keywords: ['wamena', 'papua', 'kopi wamena', 'baliem'],
    title: '☕ Kopi Papua Wamena — Keaslian Organik Lembah Baliem',
    origin: 'Lembah Baliem, Pegunungan Tengah Papua (1.600 - 2.000 mdpl)',
    story:
      'Ditanam tanpa pupuk sintetis maupun pestisida kimia oleh masyarakat adat Dani di lembah pegunungan terpencil Papua. ' +
      'Kopi Wamena memiliki aroma wangi semerbak, body halus bertekstur sutra, serta perpaduan rasa cokelat, kacang almond, dan rempah lembut tanpa rasa asam yang menusuk.',
  },
  {
    id: 'dampit',
    keywords: ['dampit', 'malang', 'kopi malang', 'robusta dampit', 'robusta jawa'],
    title: '☕ Robusta Dampit Malang — Primadona Warkop Jawa Timur',
    origin: 'Lereng Gunung Semeru, Dampit, Malang Selatan, Jawa Timur',
    story:
      'Inilah rajanya robusta ekspor Indonesia! Ditanam di ketinggian 800-900 mdpl di lereng Semeru, Robusta Dampit memiliki rasa gurih karamel, body sangat tebal, aroma cokelat pekat, dan pahit yang bersih. ' +
      'Cocok sekali untuk cangkir kopi tubruk panas peneman obrolan malam hingga subuh.',
  },
  {
    id: 'kopi_joss',
    keywords: ['kopi joss', 'kopi jos', 'arang', 'kopi arang', 'jogja', 'yogyakarta'],
    title: '🔥 Kopi Joss Yogyakarta — Sensasi Arang Membara Angkringan',
    origin: 'Angkringan Stasiun Tugu, DI Yogyakarta',
    story:
      'Lahir dari warung Lik Man di dekat Stasiun Tugu tahun 1960-an. Sepotong arang kayu mendidih membara dari tungku anglo langsung dicemplungkan ke cangkir kopi hitam manis. ' +
      'Suara mendesir "Jooosss!" menghasilkan asap wangi yang khas. Karbon aktif dari arang diyakini mengikat asam dan kafein berlebih, membuat kopi terasa lebih lembut, bebas kembung, dan beraroma karamel smokey.',
  },
  {
    id: 'kopi_lelet',
    keywords: ['kopi lelet', 'lelet', 'lasem', 'rembang', 'batik kopi'],
    title: '🎨 Kopi Lelet Rembang & Lasem — Seni Melukis Ampas Kopi Nusantara',
    origin: 'Kabupaten Rembang & Lasem, Jawa Tengah',
    story:
      'Kopi robusta dihaluskan hingga bertekstur selembut bedak bayi. Setelah air kopi habis diseruput, ampas pekat di dasar cangkir dicampur sedikit susu kental manis sebagai "tinta". ' +
      'Pengunjung warung menggunakan tusuk gigi untuk "melelet" (membatik dan menggambar ornamen cantik) di permukaan batang rokok mereka. Sebuah perpaduan unik antara tradisi ngopi dan seni lukis rakyat!',
  },
  {
    id: 'kopi_tubruk',
    keywords: ['kopi tubruk', 'tubruk', 'seduh tubruk', 'cara seduh'],
    title: '☕ Kopi Tubruk — Kejujuran Rasa Seduhan Asli Rakyat Nusantara',
    origin: 'Seluruh Penjuru Kepulauan Indonesia',
    story:
      'Cara paling sederhana namun paling jujur dalam menikmati kopi: bubuk kopi giling halus langsung diseduh air panas mendidih (95°C) di dalam cangkir tanpa filter saringan apapun. ' +
      'Diamkan 4 menit hingga ampasnya tenggelam ke dasar cangkir, lalu nikmati seruputan pekat hangat perlahan-lahan. Filosofi tubruk adalah menerima segala kelebihan dan kekurangan kopi apa adanya.',
  },
  {
    id: 'kopi_tarik',
    keywords: ['kopi tarik', 'tarik aceh', 'kopi saring', 'ulee kareng'],
    title: '☕ Kopi Tarik Aceh — Aksi Teatrikal Ceret Kuningan & Buih Lembut',
    origin: 'Banda Aceh & Pesisir Selat Malaka',
    story:
      'Diseduh menggunakan saringan kain panjang berpori rapat dan ceret kuningan. Barista warkop Aceh mengangkat saringan tinggi-tinggi melayang bolak-balik dengan ritme terlatih. ' +
      'Proses penarikan ini mendinginkan kopi ke temperatur pas minum sekaligus melarutkan oksigen sehingga menghasilkan buih (crema busa) lembut nan gurih.',
  },
  {
    id: 'kopi_talua',
    keywords: ['kopi talua', 'kopi telur', 'minang', 'bukittinggi', 'padang'],
    title: '☕ Kopi Talua Minang — Stamina Hangat Cita Rasa Tiga Lapis',
    origin: 'Ranah Minangkabau, Sumatera Barat',
    story:
      'Kuning telur ayam kampung segar dikocok bersama susu kental manis dan sedikit kayu manis hingga berubah menjadi busa kental putih kecokelatan. ' +
      'Kemudian disiram kopi robusta mendidih panas! Di dalam gelas kaca, terbentuk 3 gradasi warna menakjubkan: busa di atas, seduhan kopi di tengah, dan endapan manis di bawah. Gurih bertenaga tanpa rasa amis!',
  },
];

export const FEATURE_QNA: FeatureQnA[] = [
  {
    id: 'poin_warkop',
    keywords: ['poin', 'poin warkop', 'cara dapat poin', 'checkin', 'absen', 'tambah poin'],
    title: '⭐ Cara Mendapat Poin Warkop di Ngopi.top',
    answer:
      'Kamu bisa kumpulkan Poin Warkop dengan beragam aktivitas asyik:\n' +
      '1. 📅 Check-in Harian (Streak 7 Hari): Jam 07:00 - 07:00 WIB berikutnya.\n' +
      '   - Hari 1 = 1 Poin\n' +
      '   - Hari 2 = 3 Poin\n' +
      '   - Hari 3 = 5 Poin\n' +
      '   - Hari 4 = 7 Poin\n' +
      '   - Hari 5 = 9 Poin\n' +
      '   - Hari 6 = 11 Poin\n' +
      '   - Hari 7 = 20 Poin! (Jika bolos akan reset ke Hari 1)\n' +
      '2. 👥 Ajak Teman (Referral): Bagikan kode referral kamu, dapat +50 Poin saat teman bergabung!\n' +
      '3. 🏆 Menang Permainan: Menangkan mabar Domino, Catur, UNO, Pokemon dll (+50 Poin/kemenangan)!\n' +
      '4. 💡 Jawab Tebak-tebakan WarkopBot di chat: Penjawab tercepat dapat +10 Poin!\n' +
      'Poin bisa ditukar menjadi token BaMbooChain (BMC) atau voucher menarik di menu Katalog!',
  },
  {
    id: 'bmc_token',
    keywords: ['bmc', 'token bmc', 'bamboochain', 'tukar bmc', 'bridge', 'crypto', 'wallet'],
    title: '🪙 Token BaMbooChain (BMC) & Penukaran Poin',
    answer:
      'Token BMC adalah aset kripto resmi di jaringan BaMbooChain.\n' +
      '• Kurs Konversi: 1.000 Poin Warkop = 1 Token BMC.\n' +
      '• Cara Tukar: Buka menu "Ekonomi & BMC", masukkan alamat dompet BaMbooChain kamu (0x...), lalu tekan Konversi.\n' +
      '• Syarat: Pastikan akunmu terhubung atau memiliki dompet di web bamboochain.id untuk melihat saldo BMC hasil penukaran.',
  },
  {
    id: 'daftar_game',
    keywords: ['game', 'daftar game', 'main apa', 'permainan', 'mabar', 'meja'],
    title: '🎮 Daftar Meja Game Santai di Ngopi.top',
    answer:
      'Ada beragam game warkop seru untuk mabar maupun tanding vs Bot:\n' +
      '• Kartu & Domino: Gapleh Domino Balak, UNO Card, Remi Klasik, Poker Meja, Truf PekaI, Bridge Warkop.\n' +
      '• Papan & Strategi: Catur Santai, Ular Tangga, Monopoli Warkop, Mahyong, Halma, Daku (Congklak).\n' +
      '• Ketangkasan & Duel: Pokemon Duel Battle, Karambol Meja, Billiard Warkop.\n' +
      'Semua game dilengkapi bot otomatis pintar kalau lagi santai sendirian!',
  },
  {
    id: 'bioskop_warkop',
    keywords: ['bioskop', 'nonton bareng', 'nobar', 'youtube', 'video'],
    title: '🎬 Ruang Bioskop Warkop (Nonton Bareng)',
    answer:
      'Fitur Bioskop Warkop memungkinkan kamu nobar video YouTube bersama kawan-kawan warkop secara real-time!\n' +
      'Play, pause, dan durasi seek video tersinkronisasi otomatis antar layar penonton menggunakan Socket.IO, jadi ekspresi ketawa dan komentarnya barengan serasa nonton TV di warkop sungguhan!',
  },
  {
    id: 'jukebox_suasana',
    keywords: ['jukebox', 'lagu', 'musik', 'suasana', 'ambient', 'hujan'],
    title: '🎵 Jukebox & Suasana Warung Kopi',
    answer:
      '• Jukebox: Putar lagu favorit atau tambahkan antrian musik bersama pengunjung warkop lain.\n' +
      '• Suasana Warkop: Hidupkan audio ambient gerimis hujan di atap seng, deburan ombak, kafe hangat, atau suara jangkrik malam untuk menemani kerja & santaimu.',
  },
  {
    id: 'privasi_e2ee',
    keywords: ['privasi', 'aman', 'e2ee', 'enkripsi', 'keamanan', 'sadap'],
    title: '🔒 Keamanan & Privasi Pesan Pribadi (E2EE)',
    answer:
      'Semua percakapan pribadi 1-on-1 di Ngopi dilindungi teknologi enkripsi ujung-ke-ujung (End-to-End Encryption). Kunci rahasia hanya tersimpan di perangkat HP/laptop kamu, sehingga server Ngopi pun tidak bisa membaca isi pesanmu.',
  },
];

export function findCoffeeStoryOrQnA(text: string): string | null {
  const clean = text.toLowerCase().trim();

  // 1. Check Coffee Stories
  for (const item of COFFEE_STORIES) {
    if (item.keywords.some((k) => clean.includes(k))) {
      return (
        `${item.title}\n` +
        `📍 Asal: ${item.origin}\n\n` +
        `${item.story}\n\n` +
        `💡 Tanya kopi lainnya seperti: Gayo, Mandailing, Toraja, Kintamani, Bajawa, Wamena, Dampit, Kopi Joss, Kopi Lelet, Kopi Tarik, Kopi Talua, atau Kopi Tubruk!`
      );
    }
  }

  // 2. General Coffee Question
  if (
    clean.includes('kopi indonesia') ||
    clean.includes('macam kopi') ||
    clean.includes('jenis kopi') ||
    clean.includes('rekomendasi kopi') ||
    clean.includes('cerita kopi')
  ) {
    return (
      `☕ Nusantara adalah surga kopi dunia! Beberapa kopi legendaris Indonesia:\n` +
      `1. Aceh Gayo: Aroma herbal segar & asam bersih.\n` +
      `2. Mandailing & Lintong: Body tebal & earthy chocolate.\n` +
      `3. Toraja Kalosi: Wangi floral semerbak & kayu manis.\n` +
      `4. Bali Kintamani: Unik rasa sitrus jeruk segar.\n` +
      `5. Flores Bajawa: Lembut manis tembakau & hazelnut.\n` +
      `6. Robusta Dampit Malang: Gurih pekat juara warkop.\n` +
      `7. Tradisi Unik: Kopi Joss (arang menyala), Kopi Lelet (lukis rokok), Kopi Tarik Aceh, & Kopi Talua (telur).\n\n` +
      `Sebutkan nama salah satu kopi di atas untuk mendengar kisah lengkapnya!`
    );
  }

  // 3. Feature QnA
  for (const q of FEATURE_QNA) {
    if (q.keywords.some((k) => clean.includes(k))) {
      return `${q.title}\n\n${q.answer}`;
    }
  }

  // 4. App general inquiry
  if (
    clean.includes('aplikasi ngopi') ||
    clean.includes('apa itu ngopi') ||
    clean.includes('fitur ngopi') ||
    clean.includes('ngopi.top')
  ) {
    return (
      `☕ Selamat datang di Ngopi (https://ngopi.top)!\n` +
      `Platform nongkrong digital bernuansa Warung Kopi Indonesia:\n` +
      `• Mabar Game Tradisional & Modern (Domino, Catur, UNO, Monopoli, Pokemon duel, Mahyong, Karambol, Billiard dll)\n` +
      `• Bioskop Warkop (Nonton YouTube bersama real-time)\n` +
      `• Jukebox Musik & Audio Suasana Warkop\n` +
      `• Chat terenkripsi E2EE, Poin Harian, & Integrasi Token BaMbooChain (BMC).\n\n` +
      `Ketik hal yang ingin kamu tanyakan seperti "poin warkop", "tukar bmc", "daftar game", atau tanya cerita seputar kopi!`
    );
  }

  return null;
}
