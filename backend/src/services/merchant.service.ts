import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import QRCode from 'qrcode';
import {
  MerchantProfile,
  MerchantPromo,
  MerchantCheckin,
  MerchantDashboardData,
  MerchantDashboardStats,
} from '../models/merchant.types';
import { prisma } from '../utils/prisma';
import { PointsManager } from '../utils/pointsManager';

const DATA_FILE = path.join(__dirname, '../../uploads/merchants_data.json');

interface StoredMerchantData {
  profiles: MerchantProfile[];
  promos: MerchantPromo[];
  checkins: MerchantCheckin[];
}

const DEFAULT_PROFILES: MerchantProfile[] = [
  {
    id: 'm_warkop_sahabat',
    user_id: 'usr_partner_1',
    cafe_name: 'Warkop Seduh Sahabat',
    address: 'Jl. Veteran No. 12, Jakarta Pusat',
    description: 'Warkop kopi nusantara tradisional dengan racikan kopi tubruk, jahe hangat, dan gorengan renyah.',
    phone: '0812-3456-7890',
    logo: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=300&q=80',
    banner_url: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1200&q=80',
    qr_code_token: 'NGOPI_WARKOP_SEDUH',
    is_verified: true,
    reward_points: 50,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-01-01').toISOString(),
  },
  {
    id: 'm_kenangan_senja',
    user_id: 'usr_partner_2',
    cafe_name: 'Kopi Kenangan Senja',
    address: 'Jl. Gandaria Tengah II No. 5, Jakarta Selatan',
    description: 'Tempat ngopi santai bernuansa kayu jati tempo dulu dengan koneksi WiFi cepat dan area turnamen gapleh.',
    phone: '0813-9876-5432',
    logo: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=300&q=80',
    banner_url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=80',
    qr_code_token: 'NGOPI_KENANGAN_SENJA',
    is_verified: true,
    reward_points: 50,
    created_at: new Date('2026-01-02').toISOString(),
    updated_at: new Date('2026-01-02').toISOString(),
  },
  {
    id: 'm_barista_corner',
    user_id: 'usr_partner_3',
    cafe_name: 'Barista Corner Roastery',
    address: 'Jl. Dago Asri No. 8, Bandung',
    description: 'Specialty coffee roastery dengan biji kopi arabika pilihan dari Aceh Gayo dan Toraja.',
    phone: '0811-2233-4455',
    logo: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=300&q=80',
    banner_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    qr_code_token: 'NGOPI_BARISTA_CORNER',
    is_verified: true,
    reward_points: 50,
    created_at: new Date('2026-01-03').toISOString(),
    updated_at: new Date('2026-01-03').toISOString(),
  },
];

const DEFAULT_PROMOS: MerchantPromo[] = [
  {
    id: 'prm_1',
    merchant_id: 'm_warkop_sahabat',
    title: 'Diskon 20% Kopi Tubruk Robusta',
    description: 'Tunjukkan akun Ngopi kamu ke kasir dan dapatkan diskon 20% setiap pembelian Kopi Tubruk.',
    discount: '20%',
    image_url: 'https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&w=600&q=80',
    valid_until: new Date(Date.now() + 30 * 86400000).toISOString(),
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'prm_2',
    merchant_id: 'm_kenangan_senja',
    title: 'Beli 2 Es Kopi Susu Gula Aren Gratis 1',
    description: 'Kumpul bareng teman turnamen gapleh, pesan 2 gelas dapat bonus 1 gelas!',
    discount: 'Beli 2 Gratis 1',
    image_url: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=600&q=80',
    valid_until: new Date(Date.now() + 25 * 86400000).toISOString(),
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'prm_3',
    merchant_id: 'm_barista_corner',
    title: 'Free Butter Croissant',
    description: 'Gratis 1 Butter Croissant hangat untuk setiap check-in pertama di Barista Corner.',
    discount: 'Gratis Snack',
    image_url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80',
    valid_until: new Date(Date.now() + 15 * 86400000).toISOString(),
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

export class MerchantService {
  private static loadData(): StoredMerchantData {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const content = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(content);
      }
    } catch (e) {
      console.warn('Failed to load merchant data file:', e);
    }
    return {
      profiles: [...DEFAULT_PROFILES],
      promos: [...DEFAULT_PROMOS],
      checkins: [],
    };
  }

  private static saveData(data: StoredMerchantData): void {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Failed to save merchant data file:', e);
    }
  }

  /**
   * Helper to generate QR code data URL
   */
  public static async generateQRDataUrl(token: string): Promise<string> {
    try {
      return await QRCode.toDataURL(token, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 320,
        color: {
          dark: '#3d2616',
          light: '#fbf8f3',
        },
      });
    } catch (e) {
      return '';
    }
  }

  /**
   * Get all partner cafes
   */
  public static async listPartners(): Promise<Array<MerchantProfile & { promos: MerchantPromo[]; totalCheckins: number }>> {
    const data = this.loadData();
    const result = await Promise.all(
      data.profiles.map(async (p) => {
        const promos = data.promos.filter((pr) => pr.merchant_id === p.id && pr.is_active);
        const checkinsCount = data.checkins.filter((c) => c.merchant_id === p.id).length;
        const qrUrl = p.qr_code_data_url || (await this.generateQRDataUrl(p.qr_code_token));
        return {
          ...p,
          qr_code_data_url: qrUrl,
          promos,
          totalCheckins: checkinsCount,
        };
      })
    );
    return result;
  }

  /**
   * Find merchant profile by user_id
   */
  public static async getProfileByUserId(userId: string): Promise<MerchantProfile | null> {
    try {
      const dbProfile = await prisma.merchantProfile.findUnique({
        where: { user_id: userId },
      });
      if (dbProfile) {
        const qrUrl = await this.generateQRDataUrl(dbProfile.qr_code_token);
        return { ...dbProfile, qr_code_data_url: qrUrl };
      }
    } catch (_) {}

    const data = this.loadData();
    const profile = data.profiles.find((p) => p.user_id === userId);
    if (profile) {
      const qrUrl = profile.qr_code_data_url || (await this.generateQRDataUrl(profile.qr_code_token));
      return { ...profile, qr_code_data_url: qrUrl };
    }
    return null;
  }

  /**
   * Find merchant profile by QR token or ID
   */
  public static async getProfileByTokenOrId(tokenOrId: string): Promise<(MerchantProfile & { promos: MerchantPromo[] }) | null> {
    const tokenClean = tokenOrId.trim();
    try {
      const dbProfile = await prisma.merchantProfile.findFirst({
        where: {
          OR: [{ qr_code_token: tokenClean }, { id: tokenClean }],
        },
        include: { promos: true },
      });
      if (dbProfile) {
        const qrUrl = await this.generateQRDataUrl(dbProfile.qr_code_token);
        return {
          ...dbProfile,
          qr_code_data_url: qrUrl,
          promos: dbProfile.promos || [],
        };
      }
    } catch (_) {}

    const data = this.loadData();
    const profile = data.profiles.find(
      (p) => p.qr_code_token.toLowerCase() === tokenClean.toLowerCase() || p.id === tokenClean
    );
    if (profile) {
      const qrUrl = profile.qr_code_data_url || (await this.generateQRDataUrl(profile.qr_code_token));
      const promos = data.promos.filter((pr) => pr.merchant_id === profile.id && pr.is_active);
      return {
        ...profile,
        qr_code_data_url: qrUrl,
        promos,
      };
    }
    return null;
  }

  /**
   * Register or update merchant profile
   */
  public static async registerOrUpdateProfile(
    userId: string,
    payload: {
      cafe_name: string;
      address?: string;
      description?: string;
      phone?: string;
      logo?: string;
      banner_url?: string;
      reward_points?: number;
    }
  ): Promise<{ success: boolean; profile?: MerchantProfile; error?: string }> {
    if (!payload.cafe_name || !payload.cafe_name.trim()) {
      return { success: false, error: 'Nama cafe/warung tidak boleh kosong.' };
    }

    const tokenSlug = payload.cafe_name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '_')
      .slice(0, 16);
    const generatedToken = `NGOPI_${tokenSlug}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const rewardPoints = payload.reward_points && payload.reward_points > 0 ? payload.reward_points : 50;

    // Try DB first
    try {
      const existing = await prisma.merchantProfile.findUnique({ where: { user_id: userId } });
      const finalToken = existing?.qr_code_token || generatedToken;
      const profile = await prisma.merchantProfile.upsert({
        where: { user_id: userId },
        create: {
          user_id: userId,
          cafe_name: payload.cafe_name.trim(),
          address: payload.address || null,
          description: payload.description || null,
          phone: payload.phone || null,
          logo: payload.logo || null,
          banner_url: payload.banner_url || null,
          qr_code_token: finalToken,
          reward_points: rewardPoints,
          is_verified: true,
        },
        update: {
          cafe_name: payload.cafe_name.trim(),
          address: payload.address !== undefined ? payload.address : undefined,
          description: payload.description !== undefined ? payload.description : undefined,
          phone: payload.phone !== undefined ? payload.phone : undefined,
          logo: payload.logo !== undefined ? payload.logo : undefined,
          banner_url: payload.banner_url !== undefined ? payload.banner_url : undefined,
          reward_points: rewardPoints,
        },
      });

      // Update user role to merchant
      await prisma.user.update({
        where: { id: userId },
        data: { role: 'merchant' },
      }).catch(() => {});

      const qrUrl = await this.generateQRDataUrl(profile.qr_code_token);
      return { success: true, profile: { ...profile, qr_code_data_url: qrUrl } };
    } catch (_) {}

    // File-based fallback
    const data = this.loadData();
    const existingIndex = data.profiles.findIndex((p) => p.user_id === userId);
    let updatedProfile: MerchantProfile;

    if (existingIndex >= 0) {
      updatedProfile = {
        ...data.profiles[existingIndex],
        cafe_name: payload.cafe_name.trim(),
        address: payload.address ?? data.profiles[existingIndex].address,
        description: payload.description ?? data.profiles[existingIndex].description,
        phone: payload.phone ?? data.profiles[existingIndex].phone,
        logo: payload.logo ?? data.profiles[existingIndex].logo,
        banner_url: payload.banner_url ?? data.profiles[existingIndex].banner_url,
        reward_points: rewardPoints,
        updated_at: new Date().toISOString(),
      };
      data.profiles[existingIndex] = updatedProfile;
    } else {
      updatedProfile = {
        id: `m_${crypto.randomUUID().slice(0, 8)}`,
        user_id: userId,
        cafe_name: payload.cafe_name.trim(),
        address: payload.address || null,
        description: payload.description || null,
        phone: payload.phone || null,
        logo: payload.logo || null,
        banner_url: payload.banner_url || null,
        qr_code_token: generatedToken,
        is_verified: true,
        reward_points: rewardPoints,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      data.profiles.push(updatedProfile);
    }

    this.saveData(data);
    const qrUrl = await this.generateQRDataUrl(updatedProfile.qr_code_token);
    return { success: true, profile: { ...updatedProfile, qr_code_data_url: qrUrl } };
  }

  /**
   * Merchant check-in process
   * Rule: QR token must match, maximum 1 check-in per user per cafe per calendar day.
   * Awards: 50 Poin Ngopi (or merchant configured reward points)
   */
  public static async processCheckin(
    qrToken: string,
    userId: string,
    username = 'Pelanggan Warkop'
  ): Promise<{
    success: boolean;
    error?: string;
    pointsAwarded?: number;
    newTotalPoints?: number;
    merchant?: MerchantProfile;
    alreadyCheckedIn?: boolean;
    message?: string;
  }> {
    if (!qrToken || !qrToken.trim()) {
      return { success: false, error: 'Token QR Code tidak boleh kosong.' };
    }
    if (!userId) {
      return { success: false, error: 'User ID diperlukan untuk check-in.' };
    }

    const merchant = await this.getProfileByTokenOrId(qrToken);
    if (!merchant) {
      return {
        success: false,
        error: 'Kode QR Cafe tidak ditemukan atau sudah tidak berlaku. Pastikan kamu memindai QR resmi Cafe Partner Ngopi.',
      };
    }

    const pointsToAward = merchant.reward_points || 50;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Try DB check first
    try {
      const todayDbCheckin = await prisma.merchantCheckin.findFirst({
        where: {
          merchant_id: merchant.id,
          user_id: userId,
          created_at: {
            gte: new Date(todayStart),
          },
        },
      });

      if (todayDbCheckin) {
        return {
          success: false,
          alreadyCheckedIn: true,
          error: `Kamu sudah check-in di ${merchant.cafe_name} hari ini! Silakan datang lagi besok untuk mengumpulkan poin berikutnya.`,
          merchant,
        };
      }

      await prisma.merchantCheckin.create({
        data: {
          merchant_id: merchant.id,
          user_id: userId,
          username,
          points: pointsToAward,
          note: `Check-in di meja ${merchant.cafe_name}`,
        },
      });

      // Award points
      const updatedPts = PointsManager.addPoints(username, pointsToAward);
      try {
        const { pointsEconomyService } = require('./points.service');
        if (pointsEconomyService && typeof pointsEconomyService.addDirectPoints === 'function') {
          pointsEconomyService.addDirectPoints(userId, pointsToAward, `Check-in di ${merchant.cafe_name}`);
        }
      } catch (_) {}

      return {
        success: true,
        pointsAwarded: pointsToAward,
        newTotalPoints: updatedPts,
        merchant,
        message: `Selamat! Kamu berhasil check-in di ${merchant.cafe_name} dan mendapatkan +${pointsToAward} Poin Ngopi ☕🎉`,
      };
    } catch (_) {}

    // File-based fallback check
    const data = this.loadData();
    const existingCheckin = data.checkins.find((c) => {
      if (c.merchant_id !== merchant.id) return false;
      if (c.user_id !== userId && c.username !== username) return false;
      const checkinTime = new Date(c.created_at).getTime();
      return checkinTime >= todayStart;
    });

    if (existingCheckin) {
      return {
        success: false,
        alreadyCheckedIn: true,
        error: `Kamu sudah check-in di ${merchant.cafe_name} hari ini! Silakan datang lagi besok untuk mengumpulkan poin berikutnya.`,
        merchant,
      };
    }

    const newCheckin: MerchantCheckin = {
      id: `chk_${crypto.randomUUID().slice(0, 8)}`,
      merchant_id: merchant.id,
      user_id: userId,
      username,
      points: pointsToAward,
      note: `Check-in di meja ${merchant.cafe_name}`,
      created_at: new Date().toISOString(),
    };
    data.checkins.unshift(newCheckin);
    this.saveData(data);

    // Award points
    const updatedPts = PointsManager.addPoints(username, pointsToAward);
    try {
      const { pointsEconomyService } = require('./points.service');
      if (pointsEconomyService && typeof pointsEconomyService.addDirectPoints === 'function') {
        pointsEconomyService.addDirectPoints(userId, pointsToAward, `Check-in di ${merchant.cafe_name}`);
      }
    } catch (_) {}

    return {
      success: true,
      pointsAwarded: pointsToAward,
      newTotalPoints: updatedPts,
      merchant,
      message: `Selamat! Kamu berhasil check-in di ${merchant.cafe_name} dan mendapatkan +${pointsToAward} Poin Ngopi ☕🎉`,
    };
  }

  /**
   * Get merchant dashboard statistics and live data
   */
  public static async getDashboard(userIdOrMerchantId: string): Promise<MerchantDashboardData | null> {
    let profile = await this.getProfileByUserId(userIdOrMerchantId);
    if (!profile) {
      profile = await this.getProfileByTokenOrId(userIdOrMerchantId);
    }
    if (!profile) {
      return null;
    }

    const qrUrl = profile.qr_code_data_url || (await this.generateQRDataUrl(profile.qr_code_token));
    const standingTableUrl = `https://ngopi.top/warung/${profile.qr_code_token}`;

    const data = this.loadData();
    const allMerchantCheckins = data.checkins.filter((c) => c.merchant_id === profile!.id);
    const promos = data.promos.filter((p) => p.merchant_id === profile!.id);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const todayCheckins = allMerchantCheckins.filter(
      (c) => new Date(c.created_at).getTime() >= todayStart
    ).length;

    const uniqueVisitors = new Set(allMerchantCheckins.map((c) => c.user_id || c.username)).size;
    const totalPointsGiven = allMerchantCheckins.reduce((acc, c) => acc + (c.points || 0), 0);

    const stats: MerchantDashboardStats = {
      totalCheckins: allMerchantCheckins.length,
      todayCheckins,
      totalPointsGiven,
      uniqueVisitors,
      activePromosCount: promos.filter((p) => p.is_active).length,
    };

    return {
      profile: { ...profile, qr_code_data_url: qrUrl },
      stats,
      recentCheckins: allMerchantCheckins.slice(0, 20),
      promos,
      qrCodeDataUrl: qrUrl,
      standingTableUrl,
    };
  }

  /**
   * Add promo
   */
  public static async addPromo(
    merchantId: string,
    payload: {
      title: string;
      description: string;
      discount?: string;
      image_url?: string;
      valid_until: string;
    }
  ): Promise<{ success: boolean; promo?: MerchantPromo; error?: string }> {
    if (!payload.title || !payload.title.trim()) {
      return { success: false, error: 'Judul promo tidak boleh kosong.' };
    }
    if (!payload.description || !payload.description.trim()) {
      return { success: false, error: 'Deskripsi promo tidak boleh kosong.' };
    }

    const data = this.loadData();
    const newPromo: MerchantPromo = {
      id: `prm_${crypto.randomUUID().slice(0, 8)}`,
      merchant_id: merchantId,
      title: payload.title.trim(),
      description: payload.description.trim(),
      discount: payload.discount || null,
      image_url: payload.image_url || null,
      valid_until: payload.valid_until || new Date(Date.now() + 30 * 86400000).toISOString(),
      is_active: true,
      created_at: new Date().toISOString(),
    };

    data.promos.unshift(newPromo);
    this.saveData(data);

    try {
      await prisma.merchantPromo.create({
        data: {
          merchant_id: merchantId,
          title: newPromo.title,
          description: newPromo.description,
          discount: newPromo.discount,
          image_url: newPromo.image_url,
          valid_until: new Date(newPromo.valid_until),
          is_active: true,
        },
      });
    } catch (_) {}

    return { success: true, promo: newPromo };
  }

  /**
   * Delete promo
   */
  public static async deletePromo(merchantId: string, promoId: string): Promise<{ success: boolean; error?: string }> {
    const data = this.loadData();
    const idx = data.promos.findIndex((p) => p.id === promoId && p.merchant_id === merchantId);
    if (idx >= 0) {
      data.promos.splice(idx, 1);
      this.saveData(data);
    }
    try {
      await prisma.merchantPromo.deleteMany({
        where: { id: promoId, merchant_id: merchantId },
      });
    } catch (_) {}
    return { success: true };
  }
}
