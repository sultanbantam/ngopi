import { Request, Response } from 'express';
import { MerchantService } from '../services/merchant.service';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

// Helper to extract user identity
const extractUser = (req: Request): { id: string; username: string } => {
  const reqUser = (req as any).user;
  if (reqUser?.id) {
    return {
      id: String(reqUser.id),
      username: String(reqUser.username || 'Pengunjung'),
    };
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const decoded: any = jwt.decode(token);
      if (decoded?.id) {
        return {
          id: String(decoded.id),
          username: String(decoded.username || 'Pengunjung'),
        };
      }
    } catch (_) {}
  }

  const userId =
    (req.headers['x-user-id'] as string) ||
    (req.body?.user_id as string) ||
    (req.body?.userId as string) ||
    (req.query.user_id as string) ||
    (req.query.userId as string) ||
    'guest_user';

  const username =
    (req.headers['x-user-name'] as string) ||
    (req.body?.username as string) ||
    (req.query.username as string) ||
    'Pengunjung Warkop';

  return { id: String(userId), username: String(username) };
};

export class MerchantController {
  /**
   * GET /api/merchant/partners
   * Public list of verified cafe partners
   */
  public static async getPartners(_req: Request, res: Response): Promise<void> {
    try {
      const partners = await MerchantService.listPartners();
      res.status(200).json({ success: true, count: partners.length, partners });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Gagal mengambil daftar cafe partner.' });
    }
  }

  /**
   * GET /api/merchant/cafe/:tokenOrId
   * Public cafe details and promotions
   */
  public static async getCafeDetails(req: Request, res: Response): Promise<void> {
    try {
      const tokenOrId = req.params.tokenOrId;
      if (!tokenOrId) {
        res.status(400).json({ success: false, error: 'Token atau ID cafe diperlukan.' });
        return;
      }

      const cafe = await MerchantService.getProfileByTokenOrId(tokenOrId);
      if (!cafe) {
        res.status(404).json({ success: false, error: 'Cafe partner tidak ditemukan.' });
        return;
      }

      res.status(200).json({ success: true, cafe });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Gagal memuat detail cafe.' });
    }
  }

  /**
   * POST /api/merchant/checkin
   * Scan QR Code / Enter Token at Cafe Table
   * Awards 50 Poin Ngopi (1x daily limit per cafe per user)
   */
  public static async checkin(req: Request, res: Response): Promise<void> {
    try {
      const user = extractUser(req);
      const token = req.body?.qr_code_token || req.body?.token || req.body?.qrToken;

      if (!token) {
        res.status(400).json({
          success: false,
          error: 'Token QR Code cafe wajib disertakan (contoh: NGOPI_WARKOP_SEDUH).',
        });
        return;
      }

      const result = await MerchantService.processCheckin(token, user.id, user.username);
      if (!result.success) {
        const statusCode = result.alreadyCheckedIn ? 429 : 400;
        res.status(statusCode).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Gagal memproses check-in.' });
    }
  }

  /**
   * GET /api/merchant/dashboard
   * Merchant Owner Dashboard (stats, check-ins, promos, standing QR card)
   */
  public static async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      const user = extractUser(req);
      const merchantIdQuery = req.query.merchant_id as string;
      const targetId = merchantIdQuery || user.id;

      let dashboardData = await MerchantService.getDashboard(targetId);

      // If no dashboard yet, check if there's a default/demo merchant or create initial
      if (!dashboardData && user.id) {
        dashboardData = await MerchantService.getDashboard('usr_partner_1');
      }

      if (!dashboardData) {
        res.status(404).json({
          success: false,
          error: 'Belum terdaftar sebagai Merchant Partner Cafe. Silakan daftarkan cafe Anda terlebih dahulu.',
        });
        return;
      }

      res.status(200).json({ success: true, dashboard: dashboardData });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Gagal memuat dashboard merchant.' });
    }
  }

  /**
   * GET /api/merchant/me
   * Get logged-in user's merchant profile
   */
  public static async getMyProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = extractUser(req);
      const profile = await MerchantService.getProfileByUserId(user.id);
      if (!profile) {
        res.status(404).json({ success: false, error: 'Profil merchant belum dibuat.' });
        return;
      }
      res.status(200).json({ success: true, profile });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Gagal memuat profil merchant.' });
    }
  }

  /**
   * POST /api/merchant/profile
   * Register or update cafe profile
   */
  public static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const user = extractUser(req);
      const { cafe_name, address, description, phone, logo, banner_url, reward_points } = req.body;

      if (!cafe_name || !String(cafe_name).trim()) {
        res.status(400).json({ success: false, error: 'Nama cafe/warung wajib diisi.' });
        return;
      }

      const result = await MerchantService.registerOrUpdateProfile(user.id, {
        cafe_name,
        address,
        description,
        phone,
        logo,
        banner_url,
        reward_points: Number(reward_points) || 50,
      });

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Gagal menyimpan profil cafe.' });
    }
  }

  /**
   * POST /api/merchant/promo
   * Add promotional banner / voucher for cafe
   */
  public static async addPromo(req: Request, res: Response): Promise<void> {
    try {
      const user = extractUser(req);
      let merchant = await MerchantService.getProfileByUserId(user.id);
      if (!merchant) {
        const merchantId = req.body.merchant_id;
        if (merchantId) {
          merchant = await MerchantService.getProfileByTokenOrId(merchantId);
        }
      }

      if (!merchant) {
        res.status(403).json({ success: false, error: 'Hanya merchant terdaftar yang dapat menambahkan promo.' });
        return;
      }

      const { title, description, discount, image_url, valid_until } = req.body;
      const result = await MerchantService.addPromo(merchant.id, {
        title,
        description,
        discount,
        image_url,
        valid_until,
      });

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.status(201).json(result);
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Gagal menambahkan promo.' });
    }
  }

  /**
   * DELETE /api/merchant/promo/:promoId
   * Delete promo
   */
  public static async deletePromo(req: Request, res: Response): Promise<void> {
    try {
      const user = extractUser(req);
      const promoId = req.params.promoId;
      let merchant = await MerchantService.getProfileByUserId(user.id);

      if (!merchant) {
        const merchantId = req.query.merchant_id as string;
        if (merchantId) {
          merchant = await MerchantService.getProfileByTokenOrId(merchantId);
        }
      }

      const merchantId = merchant?.id || 'm_warkop_sahabat';
      const result = await MerchantService.deletePromo(merchantId, promoId);
      res.status(200).json(result);
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Gagal menghapus promo.' });
    }
  }
}
