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
    user_id: null,
    cafe_name: 'Warkop Seduh Sahabat',
    address: 'Jl. Veteran No. 12, Jakarta Pusat',
    description: 'Warkop kopi nusantara tradisional dengan racikan kopi tubruk, jahe hangat, dan gorengan renyah.',
    phone: '0812-3456-7890',
    logo: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=300&q=80',
    banner_url: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&w=1200&q=80',
    qr_code_token: 'NGOPI_WARKOP_SEDUH',
    is_verified: true,
    review_status: 'approved',
    is_showcase: true,
    reward_points: 50,
    created_at: new Date('2026-01-01').toISOString(),
    updated_at: new Date('2026-01-01').toISOString(),
  },
  {
    id: 'm_kenangan_senja',
    user_id: null,
    cafe_name: 'Kopi Kenangan Senja',
    address: 'Jl. Gandaria Tengah II No. 5, Jakarta Selatan',
    description: 'Tempat ngopi santai bernuansa kayu jati tempo dulu dengan koneksi WiFi cepat dan area turnamen gapleh.',
    phone: '0813-9876-5432',
    logo: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=300&q=80',
    banner_url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=1200&q=80',
    qr_code_token: 'NGOPI_KENANGAN_SENJA',
    is_verified: true,
    review_status: 'approved',
    is_showcase: true,
    reward_points: 50,
    created_at: new Date('2026-01-02').toISOString(),
    updated_at: new Date('2026-01-02').toISOString(),
  },
  {
    id: 'm_barista_corner',
    user_id: null,
    cafe_name: 'Barista Corner Roastery',
    address: 'Jl. Dago Asri No. 8, Bandung',
    description: 'Specialty coffee roastery dengan biji kopi arabika pilihan dari Aceh Gayo dan Toraja.',
    phone: '0811-2233-4455',
    logo: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=300&q=80',
    banner_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80',
    qr_code_token: 'NGOPI_BARISTA_CORNER',
    is_verified: true,
    review_status: 'approved',
    is_showcase: true,
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
  /**
   * Centralized merchant management eligibility check (Stage B1A).
   * Requires non-showcase, verified, and explicitly approved profile.
   */
  public static isApprovedMerchantProfile(
    profile?: Pick<MerchantProfile, 'is_verified' | 'review_status' | 'is_showcase'> | null
  ): boolean {
    if (!profile) return false;
    if (profile.is_showcase === true) return false;
    if (profile.is_verified !== true) return false;
    if (profile.review_status !== 'approved') return false;
    return true;
  }

  private static readonly SHOWCASE_IDS = new Set([
    'm_warkop_sahabat',
    'm_kenangan_senja',
    'm_barista_corner',
  ]);

  private static normalizeLoadedProfile(p: MerchantProfile): MerchantProfile {
    if (this.SHOWCASE_IDS.has(p.id) || p.is_showcase) {
      return {
        ...p,
        user_id: null,
        is_showcase: true,
        is_verified: true,
        review_status: 'approved',
      };
    }
    return p;
  }

  private static loadData(): StoredMerchantData {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const content = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed: StoredMerchantData = JSON.parse(content);
        return {
          ...parsed,
          profiles: Array.isArray(parsed.profiles)
            ? parsed.profiles.map((p) => this.normalizeLoadedProfile(p))
            : [...DEFAULT_PROFILES],
        };
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
   * Public-only cafe lookup: returns ONLY showcase profiles or verified+approved non-deleted profiles.
   * Never returns pending or rejected applications.
   */
  public static async getPublicCafeByTokenOrId(tokenOrId: string): Promise<(MerchantProfile & { promos: MerchantPromo[] }) | null> {
    const profile = await this.getProfileByTokenOrId(tokenOrId);
    if (!profile || profile.deleted_at) {
      return null;
    }
    if (profile.is_showcase === true) {
      return profile;
    }
    if (this.isApprovedMerchantProfile(profile)) {
      return profile;
    }
    return null;
  }

  /**
   * Validate and sanitize supporting_docs metadata into safe JSON object or null.
   */
  public static sanitizeSupportingDocs(
    raw: unknown
  ): { valid: true; value: Record<string, string> | null } | { valid: false; error: string } {
    if (raw === undefined || raw === null || raw === '') {
      return { valid: true, value: null };
    }

    const unsafePattern = /(javascript:|data:|vbscript:|<\s*script)/i;

    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return { valid: true, value: null };
      if (trimmed.length > 2000 || unsafePattern.test(trimmed)) {
        return { valid: false, error: 'Dokumen pendukung mengandung konten tidak valid atau terlalu panjang.' };
      }
      return { valid: true, value: { reference_note: trimmed } };
    }

    if (typeof raw !== 'object' || Array.isArray(raw)) {
      return { valid: false, error: 'Format dokumen pendukung harus berupa objek metadata atau teks.' };
    }

    const entries = Object.entries(raw as Record<string, unknown>);
    if (entries.length > 8) {
      return { valid: false, error: 'Terlalu banyak field pada dokumen pendukung.' };
    }

    const allowedKeys = new Set(['reference_note', 'nib', 'document_url', 'instagram']);
    const sanitized: Record<string, string> = {};

    for (const [key, val] of entries) {
      if (!allowedKeys.has(key)) {
        return { valid: false, error: `Field dokumen pendukung tidak diizinkan: ${key}` };
      }
      if (val === undefined || val === null || val === '') continue;
      if (typeof val !== 'string') {
        return { valid: false, error: `Nilai dokumen pendukung untuk ${key} harus berupa teks.` };
      }
      const trimmedVal = val.trim();
      if (!trimmedVal) continue;
      if (trimmedVal.length > 1000 || unsafePattern.test(trimmedVal)) {
        return { valid: false, error: `Nilai dokumen pendukung untuk ${key} tidak aman atau terlalu panjang.` };
      }
      if (key === 'document_url' && !/^https?:\/\//i.test(trimmedVal)) {
        return { valid: false, error: 'URL dokumen pendukung harus menggunakan protokol http:// atau https://.' };
      }
      sanitized[key] = trimmedVal;
    }

    const serialized = JSON.stringify(sanitized);
    if (serialized.length > 4096) {
      return { valid: false, error: 'Ukuran metadata dokumen pendukung melebihi batas.' };
    }

    return { valid: true, value: Object.keys(sanitized).length > 0 ? sanitized : null };
  }

  /**
   * Submit a merchant registration application (Stage B1B / B1D).
   * - Validates required business fields.
   * - Rejects duplicate active pending applications (409) and already approved profiles (409).
   * - Rejects showcase profiles (403).
   * - Permits reapplication when rejected, preserving prior audit rows and recording 'resubmitted'.
   * - Always sets is_verified = false and NEVER promotes User.role.
   */
  public static async submitApplication(
    userId: string,
    payload: {
      cafe_name: string;
      business_category?: string;
      address?: string;
      description?: string;
      phone?: string;
      logo?: string;
      banner_url?: string;
      supporting_docs?: any;
      reward_points?: number;
    }
  ): Promise<{
    success: boolean;
    status?: 'pending' | 'approved';
    statusCode?: number;
    duplicatePending?: boolean;
    alreadyApproved?: boolean;
    profile?: MerchantProfile;
    error?: string;
  }> {
    if (!payload.cafe_name || !payload.cafe_name.trim()) {
      return { success: false, statusCode: 400, error: 'Nama cafe/warung tidak boleh kosong.' };
    }

    const docCheck = this.sanitizeSupportingDocs(payload.supporting_docs);
    if (!docCheck.valid) {
      return { success: false, statusCode: 400, error: docCheck.error };
    }
    const sanitizedDocs = docCheck.value;

    const tokenSlug = payload.cafe_name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '_')
      .slice(0, 16);
    const generatedToken = `NGOPI_${tokenSlug}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const rewardPoints = payload.reward_points && payload.reward_points > 0 ? payload.reward_points : 50;
    const now = new Date();

    try {
      const txResult = await prisma.$transaction(async (tx: any) => {
        const existing = await tx.merchantProfile.findUnique({ where: { user_id: userId } });

        if (existing?.is_showcase) {
          return {
            success: false as const,
            statusCode: 403,
            error: 'Profil showcase tidak dapat diubah atau diajukan ulang.',
          };
        }

        if (this.isApprovedMerchantProfile(existing)) {
          return {
            success: false as const,
            alreadyApproved: true,
            statusCode: 409,
            status: 'approved' as const,
            error: 'Akun Anda sudah berstatus merchant terverifikasi.',
          };
        }

        if (existing && existing.review_status === 'pending') {
          return {
            success: false as const,
            duplicatePending: true,
            statusCode: 409,
            status: 'pending' as const,
            error: 'Pengajuan merchant Anda sedang dalam proses tinjauan.',
          };
        }

        if (existing && existing.review_status === 'rejected') {
          const updated = await tx.merchantProfile.update({
            where: { id: existing.id },
            data: {
              cafe_name: payload.cafe_name.trim(),
              business_category: payload.business_category !== undefined ? payload.business_category : existing.business_category,
              address: payload.address !== undefined ? payload.address : existing.address,
              description: payload.description !== undefined ? payload.description : existing.description,
              phone: payload.phone !== undefined ? payload.phone : existing.phone,
              logo: payload.logo !== undefined ? payload.logo : existing.logo,
              banner_url: payload.banner_url !== undefined ? payload.banner_url : existing.banner_url,
              supporting_docs: payload.supporting_docs !== undefined ? sanitizedDocs : existing.supporting_docs,
              reward_points: rewardPoints,
              is_verified: false,
              review_status: 'pending',
              is_showcase: false,
              rejection_reason: null,
              reviewed_by: null,
              reviewed_at: null,
              submitted_at: now,
            },
          });

          await tx.merchantReviewAudit.create({
            data: {
              merchant_id: updated.id,
              actor_id: userId,
              action: 'resubmitted',
              from_status: 'rejected',
              to_status: 'pending',
              reason: null,
            },
          });

          return { success: true as const, profile: updated };
        }

        const finalToken = existing?.qr_code_token || generatedToken;
        const created = await tx.merchantProfile.create({
          data: {
            user_id: userId,
            cafe_name: payload.cafe_name.trim(),
            business_category: payload.business_category || null,
            address: payload.address || null,
            description: payload.description || null,
            phone: payload.phone || null,
            logo: payload.logo || null,
            banner_url: payload.banner_url || null,
            supporting_docs: sanitizedDocs,
            qr_code_token: finalToken,
            reward_points: rewardPoints,
            is_verified: false,
            review_status: 'pending',
            is_showcase: false,
            submitted_at: now,
          },
        });

        await tx.merchantReviewAudit.create({
          data: {
            merchant_id: created.id,
            actor_id: userId,
            action: 'submitted',
            from_status: null,
            to_status: 'pending',
            reason: null,
          },
        });

        return { success: true as const, profile: created };
      });

      if (!txResult.success) {
        return txResult;
      }

      const qrUrl = await this.generateQRDataUrl(txResult.profile.qr_code_token);
      return {
        success: true,
        status: 'pending',
        statusCode: 200,
        profile: { ...txResult.profile, qr_code_data_url: qrUrl },
      };
    } catch (_) {
      return { success: false, statusCode: 500, error: 'Gagal menyimpan pengajuan merchant ke database.' };
    }
  }

  /**
   * Update verified merchant profile (requires prior approval; never promotes User.role)
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
      if (!this.isApprovedMerchantProfile(existing)) {
        return { success: false, error: 'Profil merchant belum disetujui admin.' };
      }

      const finalToken = existing.qr_code_token || generatedToken;
      const profile = await prisma.merchantProfile.update({
        where: { user_id: userId },
        data: {
          cafe_name: payload.cafe_name.trim(),
          address: payload.address !== undefined ? payload.address : undefined,
          description: payload.description !== undefined ? payload.description : undefined,
          phone: payload.phone !== undefined ? payload.phone : undefined,
          logo: payload.logo !== undefined ? payload.logo : undefined,
          banner_url: payload.banner_url !== undefined ? payload.banner_url : undefined,
          reward_points: rewardPoints,
        },
      });

      const qrUrl = await this.generateQRDataUrl(profile.qr_code_token);
      return { success: true, profile: { ...profile, qr_code_data_url: qrUrl } };
    } catch (_) {
      return { success: false, error: 'Gagal memperbarui profil merchant.' };
    }
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
    const isCheckinEligible = Boolean(
      merchant &&
        merchant.is_verified === true &&
        (merchant.is_showcase === true || merchant.review_status === 'approved')
    );
    if (!merchant || !isCheckinEligible) {
      return {
        success: false,
        error: 'Kode QR Cafe tidak ditemukan atau belum terverifikasi. Pastikan kamu memindai QR resmi Cafe Partner Ngopi.',
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
   * Build dashboard payload for an approved, non-showcase merchant profile
   */
  private static async buildDashboardPayload(profile: MerchantProfile): Promise<MerchantDashboardData> {
    const qrUrl = profile.qr_code_data_url || (await this.generateQRDataUrl(profile.qr_code_token));
    const standingTableUrl = `https://ngopi.top/warung/${profile.qr_code_token}`;

    const data = this.loadData();
    const allMerchantCheckins = data.checkins.filter((c) => c.merchant_id === profile.id);
    const promos = data.promos.filter((p) => p.merchant_id === profile.id);

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
   * Get merchant dashboard statistics strictly by authenticated owner userId.
   * Never falls back to cafe ID, QR token, or showcase profiles.
   */
  public static async getDashboard(userId: string): Promise<MerchantDashboardData | null> {
    const profile = await this.getProfileByUserId(userId);
    if (!this.isApprovedMerchantProfile(profile)) {
      return null;
    }
    return this.buildDashboardPayload(profile!);
  }

  /**
   * Admin-only dashboard lookup by explicit merchantProfile.id (rejects showcase profiles)
   */
  public static async getDashboardByMerchantId(merchantId: string): Promise<MerchantDashboardData | null> {
    const profile = await this.getProfileByTokenOrId(merchantId);
    if (!this.isApprovedMerchantProfile(profile)) {
      return null;
    }
    return this.buildDashboardPayload(profile!);
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
      const dbMerchant = await prisma.merchantProfile.findUnique({ where: { id: merchantId } });
      if (dbMerchant) {
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
      }
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

  /**
   * Get authenticated user's own merchant application status and audit trail.
   */
  public static async getApplicationStatus(userId: string): Promise<{
    hasApplication: boolean;
    status: 'none' | 'pending' | 'approved' | 'rejected';
    profile: MerchantProfile | null;
    audits: any[];
  }> {
    const profile = await this.getProfileByUserId(userId);
    if (!profile) {
      return { hasApplication: false, status: 'none', profile: null, audits: [] };
    }

    let audits: any[] = [];
    try {
      audits = await prisma.merchantReviewAudit.findMany({
        where: { merchant_id: profile.id },
        orderBy: { created_at: 'desc' },
      });
    } catch (_) {
      audits = [];
    }

    const status = this.isApprovedMerchantProfile(profile)
      ? 'approved'
      : profile.review_status === 'rejected'
        ? 'rejected'
        : 'pending';

    return {
      hasApplication: true,
      status,
      profile,
      audits,
    };
  }

  /**
   * Admin-only: List merchant applications (excludes showcase profiles).
   */
  public static async listApplicationsForAdmin(status?: string): Promise<any[]> {
    const where: any = { is_showcase: false };
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      where.review_status = status;
    }

    return prisma.merchantProfile.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, username: true, email: true, role: true },
        },
        reviewAudits: {
          orderBy: { created_at: 'desc' },
        },
      },
      orderBy: [{ submitted_at: 'desc' }, { created_at: 'desc' }],
    });
  }

  /**
   * Admin-only: Get single merchant application detail + audit history.
   */
  public static async getApplicationDetailForAdmin(merchantId: string): Promise<any | null> {
    return prisma.merchantProfile.findUnique({
      where: { id: merchantId },
      include: {
        user: {
          select: { id: true, name: true, username: true, email: true, role: true },
        },
        reviewAudits: {
          orderBy: { created_at: 'desc' },
        },
      },
    });
  }

  /**
   * Admin-only: Atomically approve a pending merchant application.
   * - Rejects showcase profiles, non-pending applications, and self-approval.
   * - Promotes User.role to 'merchant' ONLY when current role === 'user' (preserves admin/superadmin).
   * - Records MerchantReviewAudit entry.
   */
  public static async approveApplication(
    merchantId: string,
    adminUserId: string
  ): Promise<{ success: boolean; statusCode: number; profile?: any; audit?: any; error?: string }> {
    try {
      return await prisma.$transaction(async (tx: any) => {
        const profile = await tx.merchantProfile.findUnique({ where: { id: merchantId } });
        if (!profile) {
          return { success: false, statusCode: 404, error: 'Pengajuan merchant tidak ditemukan.' };
        }
        if (profile.is_showcase) {
          return { success: false, statusCode: 403, error: 'Profil showcase read-only tidak dapat disetujui.' };
        }
        if (!profile.user_id) {
          return { success: false, statusCode: 400, error: 'Pengajuan merchant tidak memiliki pemilik user yang valid.' };
        }
        if (profile.user_id === adminUserId) {
          return { success: false, statusCode: 403, error: 'Admin tidak diperbolehkan menyetujui pengajuan miliknya sendiri.' };
        }
        if (profile.review_status !== 'pending') {
          return { success: false, statusCode: 409, error: 'Hanya pengajuan berstatus pending yang dapat disetujui.' };
        }

        const applicant = await tx.user.findUnique({
          where: { id: profile.user_id },
          select: { id: true, role: true },
        });
        if (!applicant) {
          return { success: false, statusCode: 404, error: 'Akun pemohon tidak ditemukan.' };
        }

        const now = new Date();
        const claimed = await tx.merchantProfile.updateMany({
          where: {
            id: profile.id,
            review_status: 'pending',
            is_showcase: false,
          },
          data: {
            review_status: 'approved',
            is_verified: true,
            is_showcase: false,
            reviewed_by: adminUserId,
            reviewed_at: now,
            rejection_reason: null,
          },
        });
        if (!claimed || claimed.count !== 1) {
          return { success: false, statusCode: 409, error: 'Pengajuan sudah diproses oleh admin lain.' };
        }

        const updatedProfile = await tx.merchantProfile.findUnique({ where: { id: profile.id } });

        const normalizedRole = String(applicant.role || '').trim().toLowerCase();
        if (normalizedRole === 'user') {
          await tx.user.update({
            where: { id: applicant.id },
            data: { role: 'merchant' },
          });
        }

        const audit = await tx.merchantReviewAudit.create({
          data: {
            merchant_id: profile.id,
            actor_id: adminUserId,
            action: 'approved',
            from_status: 'pending',
            to_status: 'approved',
            reason: null,
          },
        });

        return { success: true, statusCode: 200, profile: updatedProfile, audit };
      });
    } catch (_) {
      return { success: false, statusCode: 500, error: 'Gagal menyetujui pengajuan merchant.' };
    }
  }

  /**
   * Admin-only: Atomically reject a pending merchant application with mandatory reason.
   * - Rejects empty reason, showcase profiles, non-pending applications, and self-rejection.
   * - Keeps is_verified = false and never promotes User.role.
   * - Records MerchantReviewAudit entry.
   */
  public static async rejectApplication(
    merchantId: string,
    adminUserId: string,
    reason: string
  ): Promise<{ success: boolean; statusCode: number; profile?: any; audit?: any; error?: string }> {
    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
    if (!trimmedReason) {
      return { success: false, statusCode: 400, error: 'Alasan penolakan wajib diisi.' };
    }

    try {
      return await prisma.$transaction(async (tx: any) => {
        const profile = await tx.merchantProfile.findUnique({ where: { id: merchantId } });
        if (!profile) {
          return { success: false, statusCode: 404, error: 'Pengajuan merchant tidak ditemukan.' };
        }
        if (profile.is_showcase) {
          return { success: false, statusCode: 403, error: 'Profil showcase read-only tidak dapat ditolak.' };
        }
        if (profile.user_id && profile.user_id === adminUserId) {
          return { success: false, statusCode: 403, error: 'Admin tidak diperbolehkan menolak pengajuan miliknya sendiri.' };
        }
        if (profile.review_status !== 'pending') {
          return { success: false, statusCode: 409, error: 'Hanya pengajuan berstatus pending yang dapat ditolak.' };
        }

        const now = new Date();
        const claimed = await tx.merchantProfile.updateMany({
          where: {
            id: profile.id,
            review_status: 'pending',
            is_showcase: false,
          },
          data: {
            review_status: 'rejected',
            is_verified: false,
            is_showcase: false,
            reviewed_by: adminUserId,
            reviewed_at: now,
            rejection_reason: trimmedReason,
          },
        });
        if (!claimed || claimed.count !== 1) {
          return { success: false, statusCode: 409, error: 'Pengajuan sudah diproses oleh admin lain.' };
        }

        const updatedProfile = await tx.merchantProfile.findUnique({ where: { id: profile.id } });

        const audit = await tx.merchantReviewAudit.create({
          data: {
            merchant_id: profile.id,
            actor_id: adminUserId,
            action: 'rejected',
            from_status: 'pending',
            to_status: 'rejected',
            reason: trimmedReason,
          },
        });

        return { success: true, statusCode: 200, profile: updatedProfile, audit };
      });
    } catch (_) {
      return { success: false, statusCode: 500, error: 'Gagal menolak pengajuan merchant.' };
    }
  }
}
