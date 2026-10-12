import {
  UserPoints,
  PointsTransaction,
  PointsTransactionType,
  PremiumFeature,
  PremiumSubscription,
  WatchParty,
  ConvertPointsToBmcRequest,
  ConvertPointsToBmcResponse,
} from '../models/points.types';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const PREMIUM_CATALOG: PremiumFeature[] = [
  {
    id: 'large_file',
    name: 'Kirim File Besar (> 5MB)',
    price_points: 20,
    price_bmc: 0.1,
    description: 'Kirim dokumen atau video hingga 100MB sekali pakai.',
    category: 'utility',
    icon: 'document-attach',
  },
  {
    id: 'sticker_pack',
    name: 'Paket Stiker Premium Warkop',
    price_points: 50,
    price_bmc: 0.25,
    description: 'Akses koleksi stiker khas warung kopi beranimasi.',
    category: 'customization',
    icon: 'happy',
  },
  {
    id: 'pokemon_pack',
    name: 'Paket Kartu Monster Nusantara',
    price_points: 100,
    price_bmc: 0.5,
    description: 'Buka 3 kartu koleksi fauna mistis berpeluang Shiny Foil.',
    category: 'social',
    icon: 'sparkles',
  },
  {
    id: 'watch_party',
    name: 'Ruang Bioskop (Watch Party)',
    price_points: 100,
    price_bmc: 1.0,
    description: 'Nonton bareng YouTube / film dengan kontrol putar tersinkron.',
    category: 'social',
    icon: 'videocam',
  },
  {
    id: 'exclusive_theme',
    name: 'Tema Visual Eksklusif Warkop',
    price_points: 200,
    price_bmc: 2.0,
    description: 'Tema visual khusus meja kayu jati antik dan malam temaram.',
    category: 'customization',
    icon: 'color-palette',
  },
  {
    id: 'cloud_storage',
    name: 'Penyimpanan Cloud Tambahan (+5GB)',
    price_points: 500,
    price_bmc: 5.0,
    description: 'Kapasitas simpan arsip obrolan & media cloud selama 30 hari.',
    category: 'utility',
    icon: 'cloud',
  },
  {
    id: 'premium_badge',
    name: 'Lencana Profil Juragan Kopi',
    price_points: 1000,
    price_bmc: 10.0,
    description: 'Lencana mahkota emas di samping username obrolan & meja game.',
    category: 'social',
    icon: 'ribbon',
  },
  {
    id: 'beta_access',
    name: 'Akses Eksklusif Fitur Beta',
    price_points: 2000,
    price_bmc: 20.0,
    description: 'Jadilah yang pertama mencoba fitur eksperimental Ngopi.',
    category: 'access',
    icon: 'flask',
  },
];

export class PointsEconomyService {
  private userPoints: Map<string, UserPoints> = new Map();
  private transactions: PointsTransaction[] = [];
  private subscriptions: Map<string, PremiumSubscription> = new Map();
  private watchParties: Map<string, WatchParty> = new Map();
  private storageFile: string;

  constructor(storageDir?: string) {
    const dir = storageDir || path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(dir)) {
      try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
    }
    this.storageFile = path.join(dir, 'points_economy.json');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.storageFile)) {
        const raw = fs.readFileSync(this.storageFile, 'utf-8');
        const data = JSON.parse(raw);
        if (data.userPoints && Array.isArray(data.userPoints)) {
          data.userPoints.forEach((up: UserPoints) => this.userPoints.set(up.user_id, up));
        }
        if (data.transactions && Array.isArray(data.transactions)) {
          this.transactions = data.transactions;
        }
        if (data.subscriptions && Array.isArray(data.subscriptions)) {
          data.subscriptions.forEach((s: PremiumSubscription) => this.subscriptions.set(s.user_id, s));
        }
        if (data.watchParties && Array.isArray(data.watchParties)) {
          data.watchParties.forEach((wp: WatchParty) => this.watchParties.set(wp.id, wp));
        }
      }
    } catch {
      // Fallback
    }
  }

  private saveToDisk(): void {
    try {
      const data = {
        userPoints: Array.from(this.userPoints.values()),
        transactions: this.transactions,
        subscriptions: Array.from(this.subscriptions.values()),
        watchParties: Array.from(this.watchParties.values()),
        updatedAt: Date.now(),
      };
      fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Non-critical persistence
    }
  }

  private getTodayString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  public getOrCreateUserPoints(userId: string): UserPoints {
    const today = this.getTodayString();
    let up = this.userPoints.get(userId);

    if (!up) {
      up = {
        user_id: userId,
        balance: 100, // Starter bonus: 100 poin
        lifetime: 100,
        streak_days: 1,
        last_login_date: today,
        daily_chat_count: 0,
        daily_reaction_count: 0,
        updated_at: Date.now(),
      };
      this.userPoints.set(userId, up);
      this.recordTransaction(userId, 100, 'daily_mission', null, 'Bonus selamat datang anggota warkop');
    } else {
      // Check date rollover for daily caps
      if (up.last_login_date !== today) {
        up.daily_chat_count = 0;
        up.daily_reaction_count = 0;
      }
    }

    return up;
  }

  private recordTransaction(
    userId: string,
    amount: number,
    type: PointsTransactionType,
    reference?: string | null,
    description?: string
  ): PointsTransaction {
    const tx: PointsTransaction = {
      id: 'tx_' + crypto.randomBytes(8).toString('hex'),
      user_id: userId,
      amount,
      type,
      reference: reference || null,
      description: description || type,
      created_at: Date.now(),
    };
    this.transactions.push(tx);
    // Keep max 5000 transactions
    if (this.transactions.length > 5000) {
      this.transactions = this.transactions.slice(-5000);
    }
    this.saveToDisk();
    return tx;
  }

  // --- 7.2 POIN NGOPI: CARA MENDAPAT ---

  // 1. Kirim pesan +1 (max 50/hari)
  public earnChatReward(userId: string): { awarded: boolean; pointsAdded: number; newBalance: number } {
    const up = this.getOrCreateUserPoints(userId);
    const today = this.getTodayString();

    if (up.last_login_date !== today) {
      up.last_login_date = today;
      up.daily_chat_count = 0;
    }

    if (up.daily_chat_count >= 50) {
      return { awarded: false, pointsAdded: 0, newBalance: up.balance };
    }

    up.daily_chat_count += 1;
    up.balance += 1;
    up.lifetime += 1;
    up.updated_at = Date.now();
    this.recordTransaction(userId, 1, 'chat_reward', null, 'Reward obrolan aktif warkop (+1)');
    this.saveToDisk();

    return { awarded: true, pointsAdded: 1, newBalance: up.balance };
  }

  // 2. Dapat reaksi +2 (max 20/hari)
  public earnReactionReward(userId: string): { awarded: boolean; pointsAdded: number; newBalance: number } {
    const up = this.getOrCreateUserPoints(userId);
    const today = this.getTodayString();

    if (up.last_login_date !== today) {
      up.last_login_date = today;
      up.daily_reaction_count = 0;
    }

    if (up.daily_reaction_count >= 20) {
      return { awarded: false, pointsAdded: 0, newBalance: up.balance };
    }

    up.daily_reaction_count += 1;
    up.balance += 2;
    up.lifetime += 2;
    up.updated_at = Date.now();
    this.recordTransaction(userId, 2, 'reaction_reward', null, 'Menerima reaksi dari kawan warkop (+2)');
    this.saveToDisk();

    return { awarded: true, pointsAdded: 2, newBalance: up.balance };
  }

  // 3. Bantu user lain (jawab pertanyaan) +5
  public earnHelperReward(userId: string, questionRef?: string): { pointsAdded: number; newBalance: number } {
    const up = this.getOrCreateUserPoints(userId);
    up.balance += 5;
    up.lifetime += 5;
    up.updated_at = Date.now();
    this.recordTransaction(userId, 5, 'helper_reward', questionRef, 'Membantu menjawab pertanyaan di warkop (+5)');
    this.saveToDisk();
    return { pointsAdded: 5, newBalance: up.balance };
  }

  // 4. Main game selesai +10
  public earnGamePlayed(userId: string, gameId?: string): { pointsAdded: number; newBalance: number } {
    const up = this.getOrCreateUserPoints(userId);
    up.balance += 10;
    up.lifetime += 10;
    up.updated_at = Date.now();
    this.recordTransaction(userId, 10, 'game_played', gameId, 'Menyelesaikan pertandingan game warkop (+10)');
    this.saveToDisk();
    return { pointsAdded: 10, newBalance: up.balance };
  }

  // 5. Menang game +25
  public earnGameWon(userId: string, gameId?: string): { pointsAdded: number; newBalance: number } {
    const up = this.getOrCreateUserPoints(userId);
    up.balance += 25;
    up.lifetime += 25;
    up.updated_at = Date.now();
    this.recordTransaction(userId, 25, 'game_won', gameId, 'Kemenangan juara permainan warkop (+25)');
    this.saveToDisk();
    return { pointsAdded: 25, newBalance: up.balance };
  }

  // Helper: Cycle day index based on 07:00 WIB (UTC 00:00)
  public getWarkopCycleDay(nowMs = Date.now()): number {
    return Math.floor(nowMs / 86400000);
  }

  public getStreakPoints(day: number): number {
    const table: Record<number, number> = {
      1: 1,
      2: 3,
      3: 5,
      4: 7,
      5: 9,
      6: 11,
      7: 20,
    };
    const cycleIndex = ((day - 1) % 7) + 1;
    return table[cycleIndex] || 1;
  }

  // 6. Check-in harian (streak 7 hari: 1, 3, 5, 7, 9, 11, 20 poin, cycle 07:00 - 07:00 WIB)
  public claimDailyStreak(userId: string): { awarded: boolean; streak: number; pointsAdded: number; newBalance: number; message: string } {
    const up = this.getOrCreateUserPoints(userId);
    const currentCycleDay = this.getWarkopCycleDay();
    const lastCycleDay = up.last_checkin_cycle_day ?? -1;

    if (lastCycleDay === currentCycleDay) {
      return {
        awarded: false,
        streak: up.streak_days || 1,
        pointsAdded: 0,
        newBalance: up.balance,
        message: 'Check-in hari ini sudah diklaim (Siklus 07.00 - 07.00 WIB).',
      };
    }

    if (lastCycleDay === currentCycleDay - 1) {
      // Consecutive check-in
      up.streak_days = (up.streak_days || 0) + 1;
    } else {
      // Missed a day or first time -> Reset to day 1
      up.streak_days = 1;
    }

    const pointsToAward = this.getStreakPoints(up.streak_days);
    up.balance += pointsToAward;
    up.lifetime += pointsToAward;
    up.last_checkin_cycle_day = currentCycleDay;
    up.last_login_date = this.getTodayString();
    up.updated_at = Date.now();

    const cycleDay = ((up.streak_days - 1) % 7) + 1;
    this.recordTransaction(
      userId,
      pointsToAward,
      'daily_streak',
      null,
      `Check-in harian warkop Hari ke-${cycleDay} (+${pointsToAward} Poin, Siklus 07.00)`
    );
    this.saveToDisk();

    return {
      awarded: true,
      streak: up.streak_days,
      pointsAdded: pointsToAward,
      newBalance: up.balance,
      message: `Selamat! Check-in Hari ke-${cycleDay} berhasil (+${pointsToAward} Poin Ngopi).`,
    };
  }

  // 7. Undang teman aktif +50
  public earnReferralReward(userId: string, friendId: string): { pointsAdded: number; newBalance: number } {
    const up = this.getOrCreateUserPoints(userId);
    up.balance += 50;
    up.lifetime += 50;
    up.updated_at = Date.now();
    this.recordTransaction(userId, 50, 'referral_reward', friendId, 'Mengajak kawan nongkrong aktif di warkop (+50)');
    this.saveToDisk();
    return { pointsAdded: 50, newBalance: up.balance };
  }

  // 8. Selesaikan misi harian +20
  public claimDailyMission(userId: string, missionName: string): { pointsAdded: number; newBalance: number } {
    const up = this.getOrCreateUserPoints(userId);
    up.balance += 20;
    up.lifetime += 20;
    up.updated_at = Date.now();
    this.recordTransaction(userId, 20, 'daily_mission', null, `Menyelesaikan misi harian: ${missionName} (+20)`);
    this.saveToDisk();
    return { pointsAdded: 20, newBalance: up.balance };
  }

  // --- 7.3 & 7.4 PEMBELIAN FITUR PREMIUM DENGAN POIN NGOPI ---
  public purchaseFeatureWithPoints(
    userId: string,
    featureId: string
  ): { success: boolean; feature?: PremiumFeature; newBalance: number; error?: string } {
    const feature = PREMIUM_CATALOG.find(f => f.id === featureId);
    if (!feature) {
      return { success: false, newBalance: this.getOrCreateUserPoints(userId).balance, error: 'Fitur tidak ditemukan di katalog.' };
    }

    const up = this.getOrCreateUserPoints(userId);
    if (up.balance < feature.price_points) {
      return {
        success: false,
        newBalance: up.balance,
        error: `Poin tidak mencukupi. Butuh ${feature.price_points} poin, saldo Anda ${up.balance} poin.`,
      };
    }

    // Deduct points
    up.balance -= feature.price_points;
    up.updated_at = Date.now();

    const txTypeMap: Record<string, PointsTransactionType> = {
      large_file: 'purchase_large_file',
      sticker_pack: 'purchase_sticker',
      pokemon_pack: 'purchase_pokemon_pack',
      watch_party: 'purchase_watch_party',
      exclusive_theme: 'purchase_theme',
      cloud_storage: 'purchase_cloud_storage',
      premium_badge: 'purchase_badge',
      beta_access: 'purchase_beta_access',
    };

    const txType = txTypeMap[featureId] || 'purchase_sticker';
    this.recordTransaction(userId, -feature.price_points, txType, featureId, `Membeli fitur: ${feature.name}`);

    // Update active subscriptions
    let sub = this.subscriptions.get(userId);
    if (!sub) {
      sub = {
        id: 'sub_' + crypto.randomBytes(6).toString('hex'),
        user_id: userId,
        tier: 'premium',
        active_features: [],
        expires_at: Date.now() + 30 * 24 * 3600 * 1000,
        created_at: Date.now(),
      };
      this.subscriptions.set(userId, sub);
    }
    if (!sub.active_features.includes(featureId)) {
      sub.active_features.push(featureId);
    }

    this.saveToDisk();

    return {
      success: true,
      feature,
      newBalance: up.balance,
    };
  }

  // --- 7.4 & 7.7 KONVERSI POIN KE TOKEN BMC ON-CHAIN ---
  // Rasio resmi: 1000 Poin = 1 BMC
  public convertPointsToBmc(req: ConvertPointsToBmcRequest): ConvertPointsToBmcResponse {
    if (!req.wallet_address || !req.wallet_address.startsWith('0x') || req.wallet_address.length !== 42) {
      throw new Error('Alamat wallet Bamboochain tidak valid (harus format 0x... 42 karakter).');
    }

    if (req.points_to_convert < 1000 || req.points_to_convert % 1000 !== 0) {
      throw new Error('Konversi harus dalam kelipatan 1000 Poin Ngopi (1000 Poin = 1 BMC).');
    }

    const up = this.getOrCreateUserPoints(req.user_id);
    if (up.balance < req.points_to_convert) {
      throw new Error(`Saldo poin Anda (${up.balance}) tidak mencukupi untuk konversi ${req.points_to_convert} poin.`);
    }

    const bmcAwarded = req.points_to_convert / 1000;

    up.balance -= req.points_to_convert;
    up.updated_at = Date.now();

    const txHash = '0x' + crypto.randomBytes(32).toString('hex');
    this.recordTransaction(
      req.user_id,
      -req.points_to_convert,
      'convert_to_bmc',
      txHash,
      `Konversi ${req.points_to_convert} Poin ke ${bmcAwarded} Token BMC (Tx: ${txHash.slice(0, 10)}...)`
    );

    this.saveToDisk();

    return {
      success: true,
      points_deducted: req.points_to_convert,
      bmc_awarded: bmcAwarded,
      new_points_balance: up.balance,
      tx_hash: txHash,
      timestamp: Date.now(),
    };
  }

  // --- 7.5 RUANG BIOSKOP (WATCH PARTY) ---
  public createWatchParty(params: {
    hostId: string;
    hostName: string;
    title: string;
    videoUrl: string;
    videoType?: 'youtube' | 'custom';
    warungId?: string | null;
  }): WatchParty {
    // Deduct watch party cost (100 poin)
    const purchaseRes = this.purchaseFeatureWithPoints(params.hostId, 'watch_party');
    if (!purchaseRes.success) {
      throw new Error(purchaseRes.error || 'Gagal menyewa Ruang Bioskop.');
    }

    const party: WatchParty = {
      id: 'wp_' + crypto.randomBytes(8).toString('hex'),
      host_id: params.hostId,
      host_name: params.hostName,
      warung_id: params.warungId || null,
      title: params.title,
      video_url: params.videoUrl,
      video_type: params.videoType || (params.videoUrl.includes('youtube') || params.videoUrl.includes('youtu.be') ? 'youtube' : 'custom'),
      current_time: 0,
      is_playing: false,
      participants: [
        {
          user_id: params.hostId,
          user_name: params.hostName,
          joined_at: Date.now(),
        }
      ],
      created_at: Date.now(),
    };

    this.watchParties.set(party.id, party);
    this.saveToDisk();
    return party;
  }

  public getWatchParty(partyId: string): WatchParty | null {
    return this.watchParties.get(partyId) || null;
  }

  public getActiveWatchParties(): WatchParty[] {
    return Array.from(this.watchParties.values());
  }

  public updateWatchPartyPlayback(params: {
    partyId: string;
    hostId: string;
    currentTime: number;
    isPlaying: boolean;
  }): WatchParty {
    const party = this.watchParties.get(params.partyId);
    if (!party) throw new Error('Ruang Bioskop tidak ditemukan.');
    if (party.host_id !== params.hostId) throw new Error('Hanya Host yang dapat mengontrol putaran video.');

    party.current_time = params.currentTime;
    party.is_playing = params.isPlaying;
    this.saveToDisk();
    return party;
  }

  public joinWatchParty(partyId: string, userId: string, userName: string): WatchParty {
    const party = this.watchParties.get(partyId);
    if (!party) throw new Error('Ruang Bioskop tidak ditemukan.');

    const alreadyJoined = party.participants.some(p => p.user_id === userId);
    if (!alreadyJoined) {
      party.participants.push({
        user_id: userId,
        user_name: userName,
        joined_at: Date.now(),
      });
      this.saveToDisk();
    }
    return party;
  }

  public leaveWatchParty(partyId: string, userId: string): WatchParty | null {
    const party = this.watchParties.get(partyId);
    if (!party) return null;

    party.participants = party.participants.filter(p => p.user_id !== userId);
    this.saveToDisk();
    return party;
  }

  // --- QUERY UTILS ---
  public getTransactions(userId: string): PointsTransaction[] {
    return this.transactions
      .filter(t => t.user_id === userId)
      .sort((a, b) => b.created_at - a.created_at);
  }

  public getSubscription(userId: string): PremiumSubscription | null {
    return this.subscriptions.get(userId) || null;
  }

  public resetForTesting(): void {
    this.userPoints.clear();
    this.transactions = [];
    this.subscriptions.clear();
    this.watchParties.clear();
  }
}

export const pointsEconomyService = new PointsEconomyService();
