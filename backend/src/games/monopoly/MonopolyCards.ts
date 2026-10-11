import { MonopolyCard } from './types';

export class MonopolyCards {
  public static readonly CHANCE_CARDS: MonopolyCard[] = [
    {
      id: 'ch_1',
      type: 'chance',
      title: 'Maju ke START',
      description: 'Langsung meluncur ke START dan ambil Rp 200!',
      action: { type: 'move', toPosition: 0 },
    },
    {
      id: 'ch_2',
      type: 'chance',
      title: 'Kopi Luwak Mewah',
      description: 'Maju langsung ke Kopi Luwak (Kotak 23).',
      action: { type: 'move', toPosition: 23 },
    },
    {
      id: 'ch_3',
      type: 'chance',
      title: 'Naik Kereta',
      description: 'Maju ke Stasiun Senen (Kotak 5).',
      action: { type: 'move', toPosition: 5 },
    },
    {
      id: 'ch_4',
      type: 'chance',
      title: 'Masuk Penjara!',
      description: 'Ditangkap ronda warkop! Langsung masuk penjara tanpa melewati START.',
      action: { type: 'jail' },
    },
    {
      id: 'ch_5',
      type: 'chance',
      title: 'Bebas Penjara',
      description: 'Simpan kartu ini. Gunakan untuk keluar dari penjara secara gratis.',
      action: { type: 'get_out_of_jail' },
    },
    {
      id: 'ch_6',
      type: 'chance',
      title: 'Dividen Usaha Warkop',
      description: 'Bisnis warung kopimu untung besar! Terima Rp 150.',
      action: { type: 'money', amount: 150 },
    },
    {
      id: 'ch_7',
      type: 'chance',
      title: 'Denda Tilang',
      description: 'Parkir sembarangan di depan warkop. Bayar denda Rp 50.',
      action: { type: 'money', amount: -50 },
    },
    {
      id: 'ch_8',
      type: 'chance',
      title: 'Traktir Seluruh Meja',
      description: 'Sedang berbaik hati! Bayar Rp 25 ke setiap pemain lain.',
      action: { type: 'pay_all', amountPerPlayer: 25 },
    },
    {
      id: 'ch_9',
      type: 'chance',
      title: 'Menang Undian Kopi',
      description: 'Nomor nota warkopmu keluar sebagai pemenang! Terima Rp 100.',
      action: { type: 'money', amount: 100 },
    },
    {
      id: 'ch_10',
      type: 'chance',
      title: 'Servis Kompor Gas',
      description: 'Reparasi peralatan dapur warkop. Bayar Rp 60.',
      action: { type: 'money', amount: -60 },
    },
    {
      id: 'ch_11',
      type: 'chance',
      title: 'Maju ke Mie Dok-Dok',
      description: 'Lapar malam-malam, langsung ke Mie Dok-Dok (Kotak 17).',
      action: { type: 'move', toPosition: 17 },
    },
    {
      id: 'ch_12',
      type: 'chance',
      title: 'Cashback Dompet Digital',
      description: 'Promo dompet digital masuk ke saldo. Dapat Rp 50.',
      action: { type: 'money', amount: 50 },
    },
    {
      id: 'ch_13',
      type: 'chance',
      title: 'Bayar Iuran Keamanan',
      description: 'Iuran pos ronda lingkungan warkop. Bayar Rp 40.',
      action: { type: 'money', amount: -40 },
    },
    {
      id: 'ch_14',
      type: 'chance',
      title: 'Arisan Warkop',
      description: 'Giliranmu dapat arisan! Tagih Rp 30 dari setiap pemain lain.',
      action: { type: 'collect_all', amountPerPlayer: 30 },
    },
    {
      id: 'ch_15',
      type: 'chance',
      title: 'Sponsor Acara Musik',
      description: 'Dapat dana sponsor live music akustik warkop. Terima Rp 80.',
      action: { type: 'money', amount: 80 },
    },
    {
      id: 'ch_16',
      type: 'chance',
      title: 'Mundur 3 Langkah',
      description: 'Ketinggalan dompet! Mundur 3 petak ke belakang.',
      action: { type: 'move', toPosition: -3 }, // Handled as relative in Rules
    },
  ];

  public static readonly COMMUNITY_CARDS: MonopolyCard[] = [
    {
      id: 'cc_1',
      type: 'community',
      title: 'Maju ke START',
      description: 'Langsung meluncur ke START dan ambil Rp 200!',
      action: { type: 'move', toPosition: 0 },
    },
    {
      id: 'cc_2',
      type: 'community',
      title: 'Pengembalian Pajak',
      description: 'Kelebihan bayar pajak tahun lalu dikembalikan. Terima Rp 100.',
      action: { type: 'money', amount: 100 },
    },
    {
      id: 'cc_3',
      type: 'community',
      title: 'Biaya Rumah Sakit',
      description: 'Sakit asam lambung karena kebanyakan ngopi. Bayar Rp 80.',
      action: { type: 'money', amount: -80 },
    },
    {
      id: 'cc_4',
      type: 'community',
      title: 'Ulang Tahun Warkop',
      description: 'Warkopmu berulang tahun! Terima kado Rp 20 dari setiap pemain.',
      action: { type: 'collect_all', amountPerPlayer: 20 },
    },
    {
      id: 'cc_5',
      type: 'community',
      title: 'Bebas Penjara',
      description: 'Kartu pengampunan dari Pak RT. Bebas dari penjara.',
      action: { type: 'get_out_of_jail' },
    },
    {
      id: 'cc_6',
      type: 'community',
      title: 'Langsung Masuk Penjara',
      description: 'Ketahuan main gapleh sampai pagi tanpa izin. Masuk penjara!',
      action: { type: 'jail' },
    },
    {
      id: 'cc_7',
      type: 'community',
      title: 'Bunga Tabungan Koperasi',
      description: 'Bunga simpan pinjam koperasi warkop cair. Terima Rp 50.',
      action: { type: 'money', amount: 50 },
    },
    {
      id: 'cc_8',
      type: 'community',
      title: 'Iuran Sampah Warkop',
      description: 'Bayar kebersihan dan retribusi sampah. Bayar Rp 50.',
      action: { type: 'money', amount: -50 },
    },
    {
      id: 'cc_9',
      type: 'community',
      title: 'Hadiah Lomba Catur',
      description: 'Juara 1 turnamen catur antar-warkop. Terima Rp 120.',
      action: { type: 'money', amount: 120 },
    },
    {
      id: 'cc_10',
      type: 'community',
      title: 'Konsultasi Bisnis',
      description: 'Memberi masukan resep racikan kopi viral. Terima honor Rp 45.',
      action: { type: 'money', amount: 45 },
    },
    {
      id: 'cc_11',
      type: 'community',
      title: 'Perbaikan WiFi',
      description: 'Router WiFi warkop tersambar petir. Patungan bayar Rp 60.',
      action: { type: 'money', amount: -60 },
    },
    {
      id: 'cc_12',
      type: 'community',
      title: 'Donasi Komunitas Santai',
      description: 'Membantu kas komunitas nongkrong. Bayar Rp 25.',
      action: { type: 'money', amount: -25 },
    },
    {
      id: 'cc_13',
      type: 'community',
      title: 'Jual Motor Bekas',
      description: 'Motor bebek warkop laku terjual. Terima Rp 150.',
      action: { type: 'money', amount: 150 },
    },
    {
      id: 'cc_14',
      type: 'community',
      title: 'Dapat Warisan Kakek',
      description: 'Dapat tanah kebun kopi dari kakek. Terima Rp 200.',
      action: { type: 'money', amount: 200 },
    },
    {
      id: 'cc_15',
      type: 'community',
      title: 'Patungan Nonton Bareng',
      description: 'Patungan sewa proyektor final bola. Bayar Rp 30.',
      action: { type: 'money', amount: -30 },
    },
    {
      id: 'cc_16',
      type: 'community',
      title: 'Pemeriksaan Rutin Kesehatan',
      description: 'Medical checkup gratis dan dapet subsidi. Terima Rp 30.',
      action: { type: 'money', amount: 30 },
    },
  ];

  public static drawChance(): MonopolyCard {
    const idx = Math.floor(Math.random() * this.CHANCE_CARDS.length);
    return this.CHANCE_CARDS[idx] || this.CHANCE_CARDS[0]!;
  }

  public static drawCommunity(): MonopolyCard {
    const idx = Math.floor(Math.random() * this.COMMUNITY_CARDS.length);
    return this.COMMUNITY_CARDS[idx] || this.COMMUNITY_CARDS[0]!;
  }
}
