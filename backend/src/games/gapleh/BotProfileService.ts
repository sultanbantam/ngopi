import { prisma } from '../../utils/prisma';

export interface BotProfileData {
  id?: string;
  bot_id: string;
  name: string;
  title: string;
  personality: string;
  level: number; // 1 to 6
  total_points: number;
  total_wins: number;
  total_losses: number;
  total_draws?: number;
  badges: string[];
}

// Points table per bot level as defined in Task 4.4
export const BOT_LEVEL_POINTS: Record<number, { win: number; lose: number; draw: number; title: string }> = {
  1: { win: 10, lose: 1, draw: 3, title: 'Kelas Bulu' },
  2: { win: 25, lose: 3, draw: 8, title: 'Kelas Warung' },
  3: { win: 50, lose: 5, draw: 15, title: 'Kelas Kampung' },
  4: { win: 100, lose: 10, draw: 30, title: 'Kelas Kota' },
  5: { win: 250, lose: 25, draw: 75, title: 'Kelas Jagal' },
  6: { win: 1000, lose: 100, draw: 300, title: 'Kelas Dunia' },
};

export const INITIAL_BOT_PROFILES: BotProfileData[] = [
  {
    bot_id: 'gapleh_2_budi',
    name: 'Gelideg',
    title: 'Kelas Bulu',
    personality: 'Pemalu, sering salah',
    level: 1,
    total_points: 0,
    total_wins: 0,
    total_losses: 0,
    badges: [],
  },
  {
    bot_id: 'gapleh_2_asep',
    name: 'Mangmad',
    title: 'Kelas Warung',
    personality: 'Ramah, main santai',
    level: 2,
    total_points: 0,
    total_wins: 0,
    total_losses: 0,
    badges: [],
  },
  {
    bot_id: 'gapleh_2_rudi',
    name: 'Mangsante',
    title: 'Kelas Kampung',
    personality: 'Serius, kadang blunder',
    level: 3,
    total_points: 0,
    total_wins: 0,
    total_losses: 0,
    badges: [],
  },
  {
    bot_id: 'gapleh_2_deni',
    name: 'Hamlihi',
    title: 'Kelas Kota',
    personality: 'Cerdas, sering jebakan',
    level: 4,
    total_points: 0,
    total_wins: 0,
    total_losses: 0,
    badges: [],
  },
  {
    bot_id: 'gapleh_2_jago',
    name: 'Sodung',
    title: 'Kelas Jagal',
    personality: 'Agresif, susah ditebak',
    level: 5,
    total_points: 0,
    total_wins: 0,
    total_losses: 0,
    badges: [],
  },
  {
    bot_id: 'gapleh_2_maestro',
    name: 'Daman',
    title: 'Kelas Dunia',
    personality: 'Tenang, mematikan',
    level: 6,
    total_points: 0,
    total_wins: 0,
    total_losses: 0,
    badges: [],
  },
];

export class BotProfileService {
  private static profiles: Map<string, BotProfileData> = new Map();

  static {
    this.initProfiles();
  }

  public static initProfiles(): void {
    this.profiles.clear();
    for (const bot of INITIAL_BOT_PROFILES) {
      this.profiles.set(bot.bot_id, { ...bot, badges: [...bot.badges] });
    }
  }

  public static async loadProfilesFromDb(): Promise<void> {
    try {
      if ((prisma as any)?.botProfile?.findMany) {
        const rows = await (prisma as any).botProfile.findMany();
        for (const r of rows) {
          if (this.profiles.has(r.bot_id)) {
            const p = this.profiles.get(r.bot_id)!;
            p.level = r.level;
            p.total_points = r.total_points;
            p.total_wins = r.total_wins;
            p.total_losses = r.total_losses;
            p.badges = r.badges || [];
          }
        }
      }
    } catch {}
  }

  public static getBotProfile(botId: string): BotProfileData {
    if (!this.profiles.has(botId)) {
      // Create ad-hoc bot profile if unknown
      const newBot: BotProfileData = {
        bot_id: botId,
        name: botId,
        title: 'Kelas Warung',
        personality: 'Santai',
        level: 1,
        total_points: 0,
        total_wins: 0,
        total_losses: 0,
        badges: [],
      };
      this.profiles.set(botId, newBot);
    }
    return this.profiles.get(botId)!;
  }

  public static getAllProfiles(): BotProfileData[] {
    return Array.from(this.profiles.values());
  }

  public static recordBotMatch(
    botId: string,
    result: 'win' | 'lose' | 'draw'
  ): { profile: BotProfileData; pointsAwarded: number; leveledUp: boolean; newBadge?: string } {
    const profile = this.getBotProfile(botId);
    const pointRule = BOT_LEVEL_POINTS[profile.level] || BOT_LEVEL_POINTS[1]!;

    const pointsAwarded = pointRule[result];
    profile.total_points += pointsAwarded;

    let leveledUp = false;
    let newBadge: string | undefined;

    if (result === 'win') {
      profile.total_wins += 1;

      // Level progression check based on total wins
      const previousLevel = profile.level;
      if (profile.total_wins >= 100) {
        profile.level = 6;
      } else if (profile.total_wins >= 60) {
        profile.level = 5;
      } else if (profile.total_wins >= 30) {
        profile.level = 4;
      } else if (profile.total_wins >= 15) {
        profile.level = 3;
      } else if (profile.total_wins >= 5) {
        profile.level = 2;
      }

      if (profile.level > previousLevel) {
        leveledUp = true;
        profile.title = BOT_LEVEL_POINTS[profile.level]?.title || profile.title;
      }

      // Check special badge: 100 wins at Level 6 -> "Bot Legendaris" (Task 4.2)
      if (profile.level === 6 && profile.total_wins >= 100 && !profile.badges.includes('Bot Legendaris')) {
        profile.badges.push('Bot Legendaris');
        newBadge = 'Bot Legendaris';
      }
    } else if (result === 'lose') {
      profile.total_losses += 1;
    } else if (result === 'draw') {
      profile.total_draws = (profile.total_draws || 0) + 1;
    }

    // Persist to database if available
    try {
      if ((prisma as any)?.botProfile?.upsert) {
        (prisma as any).botProfile.upsert({
          where: { bot_id: profile.bot_id },
          update: {
            level: profile.level,
            total_points: profile.total_points,
            total_wins: profile.total_wins,
            total_losses: profile.total_losses,
            badges: profile.badges,
          },
          create: {
            bot_id: profile.bot_id,
            name: profile.name,
            level: profile.level,
            total_points: profile.total_points,
            total_wins: profile.total_wins,
            total_losses: profile.total_losses,
            badges: profile.badges,
          },
        }).catch((err: any) => {
          // If table not migrated in test db or similar, quietly ignore
        });
      }
    } catch {}

    return { profile, pointsAwarded, leveledUp, newBadge };
  }

  public static getRandomBanter(botId: string, type: 'turn' | 'win' | 'pass', gameType?: string): string {
    const normalizedGame = gameType?.toLowerCase();
    const gameBanter = normalizedGame && GAME_SPECIFIC_BANTERS[normalizedGame];
    if (gameBanter) {
      const quotes = type === 'turn' ? gameBanter.turnQuotes : type === 'win' ? gameBanter.winQuotes : gameBanter.passQuotes;
      if (quotes && quotes.length > 0) {
        return quotes[Math.floor(Math.random() * quotes.length)]!;
      }
    }

    const isCardGame = ['gapleh', 'remi', 'truf', 'bridge', 'poker', 'uno'].includes(normalizedGame || '');
    const banter = BOT_BANTERS[botId] || DEFAULT_BOT_BANTER;
    let quotes = type === 'turn' ? banter.turnQuotes : type === 'win' ? banter.winQuotes : banter.passQuotes;
    if (!isCardGame && quotes) {
      quotes = quotes.filter(q => !/kartu|balak|truf|remi|jagal|koleksi biji/i.test(q));
    }
    if (!quotes || quotes.length === 0) {
      return type === 'turn' ? 'Giliran saya ya... ☕' : type === 'win' ? 'Alhamdulillah menang! ☕🎉' : 'Lewat dulu ya... ☕';
    }
    return quotes[Math.floor(Math.random() * quotes.length)]!;
  }

  public static getRandomEmote(botId: string, gameType?: string): string {
    const normalizedGame = gameType?.toLowerCase();
    const gameBanter = normalizedGame && GAME_SPECIFIC_BANTERS[normalizedGame];
    if (gameBanter && gameBanter.emotes && gameBanter.emotes.length > 0) {
      return gameBanter.emotes[Math.floor(Math.random() * gameBanter.emotes.length)]!;
    }
    const banter = BOT_BANTERS[botId] || DEFAULT_BOT_BANTER;
    if (!banter.emotes || banter.emotes.length === 0) return '☕';
    return banter.emotes[Math.floor(Math.random() * banter.emotes.length)]!;
  }
}

export interface BotBanterData {
  turnQuotes: string[];
  winQuotes: string[];
  passQuotes: string[];
  emotes: string[];
}

export const DEFAULT_BOT_BANTER: BotBanterData = {
  turnQuotes: ['Giliran saya ya...', 'Sambil ngopi santai... ☕', 'Fokus langkah dulu nih...'],
  winQuotes: ['Mantap menang! ☕🎉', 'Alhamdulillah bungkus!'],
  passQuotes: ['Lewat dulu ya...', 'Pas dulu sejenak...'],
  emotes: ['☕', '👏', '😂'],
};

export const GAME_SPECIFIC_BANTERS: Record<string, BotBanterData> = {
  monopoly: {
    turnQuotes: [
      'Giliran saya kocok dadu ya... 🎲',
      'Beli properti dulu biar aset nambah 🏢',
      'Tanah strategis warkop harus dibeli ini ☕',
      'Semoga dapat angka hoki dan gak mampir ke komplek mahal 😅',
      'Bangun rumah dulu, siap-siap narik sewa! 🏠',
      'Investasi masa depan di warkop digital 💼',
      'Lempar dadu dulu lur, bismillah hoki 🎲',
      'Sambil ngopi santai, pantau pasar properti ☕',
    ],
    winQuotes: [
      'Monopoli dikuasai! Juragan properti warkop sejati! 🏢👑🎉',
      'Alhamdulillah borong semua komplek warkop! 💰🔥',
      'Sewa properti mengalir deras, kemenangan mutlak! 🏆',
    ],
    passQuotes: [
      'Lewat dulu, simpan modal kas warkop 💸',
      'Gak beli tanah dulu, tunggu putaran berikutnya ☕',
      'Aduh kena penjara, lewat giliran ya... 🚔',
    ],
    emotes: ['🏢', '💰', '🎲', '☕'],
  },
  catur: {
    turnQuotes: [
      'Kalkulasi posisi dulu, jangan sampai blunder ♟️',
      'Kuda melompat dengan anggun ♞',
      'Menteri siap bermanuver di sayap raja ♛',
      'Fokus perwira tengah sambil seruput kopi ☕',
      'Taktik skakmat mulai disusun pelan-pelan... 🤔',
    ],
    winQuotes: [
      'Skakmat! Permainan yang luar biasa kawan! ♟️👑',
      'Pertahanan runtuh! Kemenangan telak di atas papan catur! 🏆',
    ],
    passQuotes: [
      'Posisi bertahan dulu ya, tahan gempuran...',
      'Remis nih kayaknya kalau begini...',
    ],
    emotes: ['♟️', '👑', '🤔', '☕'],
  },
  snake_ladder: {
    turnQuotes: [
      'Bismillah lempar dadu, jangan kena kepala ular! 🎲🐍',
      'Incar kotak tangga biar langsung meluncur ke atas 🪜✨',
      'Kocok dadu dulu sambil ngopi ☕🎲',
      'Awas ekor ular di depan mata... 😅',
    ],
    winQuotes: [
      'Tembus kotak 100! Juara Ular Tangga Warkop! 🪜🎉🏆',
      'Hoki maksimal melesat ke puncak! Mantap! 🌟',
    ],
    passQuotes: [
      'Yah kena patuk ular, turun lagi deh 🐍😢',
      'Lewat dulu, lagi istirahat di bawah...',
    ],
    emotes: ['🎲', '🪜', '🐍', '☕'],
  },
  ludo: {
    turnQuotes: [
      'Kocok angka 6 dong biar pion keluar kandang! 🎲',
      'Maju pelan-pelan yang penting pion gak dimakan lawan 🎯',
      'Pion meluncur ke jalur aman sambil ngopi ☕',
      'Awas pionmu di depan, siap ditabrak! 😈',
    ],
    winQuotes: [
      'Semua pion masuk segitiga akhir! Juara Ludo! 🏆🎉',
      'Kemenangan telak, semua pion pulang selamat! 👑',
    ],
    passQuotes: [
      'Belum dapet angka 6, sabar dulu di kandang 😅',
      'Gak bisa gerak, lewat giliran ya...',
    ],
    emotes: ['🎲', '🎯', '🏠', '☕'],
  },
  karambol: {
    turnQuotes: [
      'Bidik striker ke koin merah dulu 🎯',
      'Pukulan pantul sudut warkop! 🎱',
      'Bedak karambol licin, tembakan akurat nih!',
      'Fokus bidik lubang sudut sambil ngopi ☕',
    ],
    winQuotes: [
      'Koin merah bungkus! Juara karambol warkop malam ini! 🏆🔥',
      'Tembakan terakhir masuk bersih! Kemenangan mutlak! 👑',
    ],
    passQuotes: [
      'Meleset dikit, giliranmu lur...',
      'Foul dikit, lewat dulu...',
    ],
    emotes: ['🎯', '🔥', '☕'],
  },
  billiard: {
    turnQuotes: [
      'Kapur stik dulu biar pukulan gak culas 🎱',
      'Pukulan bola sasaran ke lubang sudut...',
      'Fokus sudut pantul, santai sambil ngopi ☕',
      'Break bola pembuka yang mantap!',
    ],
    winQuotes: [
      'Bola 8 masuk bersih! Game over, mantap kawan! 🎱👑',
      'Pukulan master tak terbendung! 🏆',
    ],
    passQuotes: [
      'Foul, bola di tanganmu...',
      'Gak masuk, giliranmu...',
    ],
    emotes: ['🎱', '🎯', '☕'],
  },
  daku: {
    turnQuotes: [
      'Koleksi biji ke lumbung sendiri 🐚',
      'Putaran biji jangan sampai mati di lubang kosong!',
      'Hitung langkah biji congklak dulu...',
      'Lumbung warkop mulai terisi penuh ☕',
    ],
    winQuotes: [
      'Lumbung penuh biji kemenangan! Juara Congklak! 🐚🏆',
      'Strategi putaran biji sempurna! 👑',
    ],
    passQuotes: [
      'Biji habis di lubang kosong, giliranmu...',
    ],
    emotes: ['🐚', '👑', '☕'],
  },
  uno: {
    turnQuotes: [
      'Keluarkan warna yang cocok dulu nih 🎨',
      'Awas kena Draw 4 ya teman-teman! 😈',
      'Ubah warna dulu biar pada pusing 🔄',
      'Sisa sedikit lagi nih kartuku... 🎴',
    ],
    winQuotes: [
      'UNO! Kartu habis telak, bungkus kawan! 🎉🏆',
      'Draw 4 terakhir mengunci kemenangan! 🔥',
    ],
    passQuotes: [
      'Gak ada warna cocok, tarik kartu dulu...',
    ],
    emotes: ['🎴', '🔥', '😂', '☕'],
  },
  gapleh: {
    turnQuotes: [
      'Giliran saya ya...',
      'Keluarkan kartu andalan warkop dulu nih 🁫',
      'Sambil ngopi santai, pasang balak ☕',
      'Hitung batu dulu biar gak kena kunci...',
    ],
    winQuotes: [
      'GAPLEH! Habis kalian semua di tanganku! 🔥🎉',
      'Alhamdulillah bungkus! Traktiran kopi buat semua! ☕😎',
    ],
    passQuotes: [
      'Lewat dulu lur, kartunya lagi ngeteh ☕',
      'Pas ya, buntu nih...',
    ],
    emotes: ['🁫', '☕', '🔥', '👏'],
  },
  remi: {
    turnQuotes: [
      'Giliran saya ya...',
      'Buang satu kartu dulu ☕',
      'Susun seri dan tris dulu...',
      'Sambil ngopi santai ☕',
    ],
    winQuotes: [
      'Remi turun kartu semua! Menang telak! 🏆🃏',
      'Bungkus! Kartu rapi tanpa sisa! 🎉',
    ],
    passQuotes: [
      'Lewat dulu ya...',
      'Ambil kartu cangkulan dulu...',
    ],
    emotes: ['🃏', '☕', '👏'],
  },
  truf: {
    turnQuotes: [
      'Giliran saya ya...',
      'Keluarkan kembang pembuka ♠️',
      'Truf siap mengunci trik ini! 🎯',
      'Hitung trik dulu biar capai target bid...',
    ],
    winQuotes: [
      'Target trik tercapai! Kontrak Truf sukses! 🏆🎉',
      'Menang telak ronde ini! Mantap tim! 👑',
    ],
    passQuotes: [
      'Gak punya kembang yang sama, buang kartu kecil...',
    ],
    emotes: ['♠️', '♥️', '🎯', '☕'],
  },
  bridge: {
    turnQuotes: [
      'Giliran saya ya...',
      'Analisis kartu dan tawaran partner...',
      'Mainkan kartu sesuai taktik kontrak...',
      'Sambil ngopi santai ☕',
    ],
    winQuotes: [
      'Kontrak Bridge tercapai sempurna! 🏆🃏',
    ],
    passQuotes: [
      'Pass! Giliran partner.',
    ],
    emotes: ['🃏', '☕', '👏'],
  },
  poker: {
    turnQuotes: [
      'Check atau Raise nih ya... 🤔',
      'Pasang chip dulu sambil ngopi ☕',
      'Kartu bagus jangan sampai kebaca lawan 😎',
      'All in gak nih bos? 🔥',
    ],
    winQuotes: [
      'Pot kemenangan disapu bersih! Royal flush! 🏆💰',
      'Menang gertak atau menang kartu, yang penting untung! 😎🔥',
    ],
    passQuotes: [
      'Fold dulu, kartu ampas...',
      'Check aja santai...',
    ],
    emotes: ['💰', '😎', '🔥', '☕'],
  },
};

export const BOT_BANTERS: Record<string, BotBanterData> = {
  gapleh_2_budi: {
    turnQuotes: [
      'Eh, giliran aku ya? Sebentar bingung...',
      'Aduh, salah buang kartu gak ya...',
      'Semoga kartuku bener nih 😅',
      'Deg-degan main sama senior warkop...',
    ],
    winQuotes: [
      'Wah, beneran menang?! Rezeki anak soleh! 🙏',
      'Alhamdulillah, padahal tadi asal buang 😅',
    ],
    passQuotes: [
      'Aduh lewat dulu, gak punya kartu cocok...',
      'Lewat ya masbro, buntu nih...',
    ],
    emotes: ['😅', '🙏', '☕'],
  },
  gapleh_2_asep: {
    turnQuotes: [
      'Santai lur, seruput kopi dulu biar adem ☕',
      'Tarik mang! Main santai yang penting silaturahmi.',
      'Keluarkan kartu andalan warkop dulu nih.',
      'Sambil nunggu gorengan anget, buang dulu satu.',
    ],
    winQuotes: [
      'Kopi abis, kartu abis! Mantap lur! ☕😎',
      'Alhamdulillah, traktiran kopi buat semuanya!',
    ],
    passQuotes: [
      'Lewat dulu lur, kartunya lagi ngeteh.',
      'Pas ya, nikmatin kopi dulu sejenak ☕',
    ],
    emotes: ['☕', '👍', '😎'],
  },
  gapleh_2_rudi: {
    turnQuotes: [
      'Fokus bro, jangan sampai lengah!',
      'Hitung-hitung dulu nih biar gak blunder...',
      'Balak keluar berapa ya tadi? Harus teliti.',
      'Awas jangan dipancing ke sudut!',
    ],
    winQuotes: [
      'Taktik kampung terbukti ampuh! Menang telak!',
      'Sesuai kalkulasi, kemenangan kita amankan!',
    ],
    passQuotes: [
      'Waduh kena kunci! Lewat dulu...',
      'Buntu di saya, pas!',
    ],
    emotes: ['🤔', '😤', '👏'],
  },
  gapleh_2_deni: {
    turnQuotes: [
      'Udah kebaca semua alur kartumu bro 😎',
      'Jebakan siap dipasang, perhatikan kepala dan ekor!',
      'Main cantik ala kota, jangan panik.',
      'Langkah berikutnya bakal bikin kalian pusing.',
    ],
    winQuotes: [
      'Checkmate! Eh salah, GAPLEH! Kena jebakan kan 😎🔥',
      'Trik kelas kota gak pernah gagal!',
    ],
    passQuotes: [
      'Sengaja lewat, taktik pura-pura lemah 😏',
      'Pas dulu, tunggu momen yang tepat.',
    ],
    emotes: ['😎', '🔥', '👏'],
  },
  gapleh_2_jago: {
    turnQuotes: [
      'Mana lawan?! Lemah amat nih warkop!',
      'Awas kena jagal! Jangan nangis ya!',
      'Gua bantai habis meja ini! 🔥',
      'Siap-siap nutup nih bos, senggol dong!',
    ],
    winQuotes: [
      'JAGAL TELAK! Habis kalian semua di tanganku! 💀🔥',
      'Ini baru namanya main gapleh! Minggir semua! 🐐',
    ],
    passQuotes: [
      'Cuma lewat sekali doang, jangan seneng dulu!',
      'Pas! Awas giliran gua berikutnya!',
    ],
    emotes: ['🔥', '💀', '💩'],
  },
  gapleh_2_maestro: {
    turnQuotes: [
      'Langkah yang sangat menarik...',
      'Permainan ini sebenarnya sudah berakhir sejak putaran kedua.',
      'Ketenangan pikiran melahirkan kemenangan mutlak.',
      'Setiap kartu memiliki takdirnya masing-masing.',
    ],
    winQuotes: [
      'Kemenangan adalah sebuah kepastian. Permainan yang indah. 👑🎯',
      'Daman menutup simfoni gapleh hari ini.',
    ],
    passQuotes: [
      'Lewat. Kesabaran adalah bagian dari strategi agung.',
      'Biarkan papan berkembang, saya pas.',
    ],
    emotes: ['👑', '🎯', '☕'],
  },
};
