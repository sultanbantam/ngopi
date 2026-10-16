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

  public static getRandomBanter(botId: string, type: 'turn' | 'win' | 'pass'): string {
    const banter = BOT_BANTERS[botId] || DEFAULT_BOT_BANTER;
    const quotes = type === 'turn' ? banter.turnQuotes : type === 'win' ? banter.winQuotes : banter.passQuotes;
    if (!quotes || quotes.length === 0) return '';
    return quotes[Math.floor(Math.random() * quotes.length)]!;
  }

  public static getRandomEmote(botId: string): string {
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
  turnQuotes: ['Giliran saya ya...', 'Buang satu kartu dulu ☕', 'Sambil ngopi santai...'],
  winQuotes: ['Mantap menang! ☕🎉', 'Alhamdulillah bungkus!'],
  passQuotes: ['Lewat dulu ya...', 'Pas, gak ada kartu cocok.'],
  emotes: ['☕', '👏', '😂'],
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
