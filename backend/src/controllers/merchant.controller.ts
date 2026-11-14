import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { MerchantService } from '../services/merchant.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { hasRole } from '../middleware/rbac.middleware';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

const sanitizePublicMerchant = (merchant: any) => {
  if (!merchant) return null;
  return {
    id: merchant.id,
    cafe_name: merchant.cafe_name,
    business_category: merchant.business_category ?? null,
    address: merchant.address ?? null,
    description: merchant.description ?? null,
    phone: merchant.phone ?? null,
    logo: merchant.logo ?? null,
    banner_url: merchant.banner_url ?? null,
    qr_code_token: merchant.qr_code_token,
    qr_code_data_url: merchant.qr_code_data_url ?? null,
    is_verified: Boolean(merchant.is_verified),
    is_showcase: Boolean(merchant.is_showcase),
    reward_points: merchant.reward_points ?? 50,
    ...(Array.isArray(merchant.promos) ? { promos: merchant.promos } : {}),
    ...(typeof merchant.totalCheckins === 'number' ? { totalCheckins: merchant.totalCheckins } : {}),
    created_at: merchant.created_at,
    updated_at: merchant.updated_at,
  };
};

export class MerchantController {
  /**
   * GET /api/merchant/partners
   * Public read-only list of verified cafe partners / showcase
   */
  public static async getPartners(_req: Request, res: Response): Promise<void> {
    try {
      const partners = await MerchantService.listPartners();
      const publicPartners = partners
        .filter((p) => !p.deleted_at && (p.is_showcase === true || MerchantService.isApprovedMerchantProfile(p)))
        .map(sanitizePublicMerchant);
      res.status(200).json({
        success: true,
        count: publicPartners.length,
        partners: publicPartners,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Gagal mengambil daftar cafe partner.' });
    }
  }

  /**
   * GET /api/merchant/cafe/:tokenOrId
   * Public read-only cafe details and promotions
   */
  public static async getCafeDetails(req: Request, res: Response): Promise<void> {
    try {
      const tokenOrId = typeof req.params.tokenOrId === 'string' ? req.params.tokenOrId.trim() : '';
      if (!tokenOrId) {
        res.status(400).json({ success: false, error: 'Token atau ID cafe diperlukan.' });
        return;
      }

      const cafe = await MerchantService.getPublicCafeByTokenOrId(tokenOrId);
      if (!cafe) {
        res.status(404).json({ success: false, error: 'Cafe partner tidak ditemukan.' });
        return;
      }

      res.status(200).json({ success: true, cafe: sanitizePublicMerchant(cafe) });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Gagal memuat detail cafe.' });
    }
  }

  /**
   * POST /api/merchant/checkin
   * Restricted public check-in operation.
   * Never trusts caller-supplied userId/username; uses verified JWT if provided or server-derived guest key.
   */
  public static async checkin(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
      const token = req.cookies?.token || bearerToken;

      let actorId: string;
      let actorUsername: string;

      if (token) {
        try {
          const verifyOptions: jwt.VerifyOptions = {};
          if (process.env.JWT_ISSUER) verifyOptions.issuer = process.env.JWT_ISSUER;
          if (process.env.JWT_AUDIENCE) verifyOptions.audience = process.env.JWT_AUDIENCE;

          const decoded = jwt.verify(token, JWT_SECRET, verifyOptions) as {
            id?: unknown;
            username?: unknown;
            token_type?: string;
          };
          if (!decoded || typeof decoded.id !== 'string' || !decoded.id.trim()) {
            res.status(401).json({ success: false, error: 'Invalid token payload.' });
            return;
          }
          if (decoded.token_type && decoded.token_type !== 'access') {
            res.status(401).json({ success: false, error: 'Invalid token type.' });
            return;
          }
          actorId = decoded.id.trim();
          actorUsername = typeof decoded.username === 'string' && decoded.username.trim()
            ? decoded.username.trim()
            : 'Member Ngopi';
        } catch {
          res.status(401).json({ success: false, error: 'Invalid or expired token.' });
          return;
        }
      } else {
        const ipHash = crypto.createHash('sha256').update(String(req.ip || 'unknown')).digest('hex').slice(0, 12);
        actorId = `guest_${ipHash}`;
        actorUsername = 'Pengunjung Tamu';
      }

      const qrToken = req.body?.qr_code_token || req.body?.token || req.body?.qrToken;
      if (typeof qrToken !== 'string' || !qrToken.trim() || qrToken.trim().length > 128) {
        res.status(400).json({
          success: false,
          error: 'Token QR Code cafe wajib disertakan dan valid.',
        });
        return;
      }

      const result = await MerchantService.processCheckin(qrToken.trim(), actorId, actorUsername);
      if (!result.success) {
        const statusCode = result.alreadyCheckedIn ? 429 : 400;
        res.status(statusCode).json({
          ...result,
          merchant: sanitizePublicMerchant(result.merchant),
        });
        return;
      }

      res.status(200).json({
        ...result,
        merchant: sanitizePublicMerchant(result.merchant),
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Gagal memproses check-in.' });
    }
  }

  /**
   * GET /api/merchant/dashboard
   * Approved Merchant Owner Dashboard (no fallback to usr_partner_1)
   */
  public static async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      const authUser = (req as AuthRequest).user;
      if (!authUser?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const isAdmin = hasRole(authUser.role, ['admin', 'superadmin']);
      const requestedMerchantId = typeof req.query.merchant_id === 'string' ? req.query.merchant_id.trim() : '';

      if (requestedMerchantId && !isAdmin) {
        const ownProfile = await MerchantService.getProfileByUserId(authUser.id);
        if (!ownProfile || ownProfile.id !== requestedMerchantId) {
          res.status(403).json({ success: false, error: 'Forbidden: tidak boleh mengakses dashboard merchant lain.' });
          return;
        }
      }

      const dashboardData =
        isAdmin && requestedMerchantId
          ? await MerchantService.getDashboardByMerchantId(requestedMerchantId)
          : await MerchantService.getDashboard(authUser.id);

      if (!dashboardData) {
        const ownProfile = isAdmin && requestedMerchantId
          ? await MerchantService.getProfileByTokenOrId(requestedMerchantId)
          : await MerchantService.getProfileByUserId(authUser.id);

        if (ownProfile?.is_showcase) {
          res.status(403).json({
            success: false,
            error: 'Profil showcase bersifat read-only dan tidak memiliki akses dashboard.',
          });
          return;
        }

        if (ownProfile && !MerchantService.isApprovedMerchantProfile(ownProfile)) {
          res.status(403).json({
            success: false,
            status: ownProfile.review_status || 'pending',
            error: 'Profil merchant belum disetujui admin.',
          });
          return;
        }

        res.status(404).json({
          success: false,
          error: 'Profil merchant tidak ditemukan.',
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
   * Get authenticated user's current merchant authorization & application status
   */
  public static async getMyProfile(req: Request, res: Response): Promise<void> {
    try {
      const authUser = (req as AuthRequest).user;
      if (!authUser?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const profile = await MerchantService.getProfileByUserId(authUser.id);
      if (!profile || profile.is_showcase) {
        res.status(200).json({
          success: true,
          role: authUser.role || 'user',
          status: 'none',
          profile: null,
        });
        return;
      }

      const status = MerchantService.isApprovedMerchantProfile(profile)
        ? 'approved'
        : profile.review_status === 'rejected'
          ? 'rejected'
          : 'pending';

      res.status(200).json({
        success: true,
        role: authUser.role || 'user',
        status,
        profile,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Gagal memuat profil merchant.' });
    }
  }

  /**
   * POST /api/merchant/register
   * Submit merchant registration application (pending approval; never promotes User.role)
   */
  public static async registerApplication(req: Request, res: Response): Promise<void> {
    try {
      const authUser = (req as AuthRequest).user;
      if (!authUser?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { cafe_name, business_category, address, description, phone, logo, banner_url, supporting_docs, reward_points } = req.body || {};
      if (!cafe_name || !String(cafe_name).trim()) {
        res.status(400).json({ success: false, error: 'Nama cafe/warung wajib diisi.' });
        return;
      }

      const result = await MerchantService.submitApplication(authUser.id, {
        cafe_name,
        business_category,
        address,
        description,
        phone,
        logo,
        banner_url,
        supporting_docs,
        reward_points: Number(reward_points) || 50,
      });

      if (!result.success) {
        res.status(result.statusCode || 400).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Gagal mengajukan pendaftaran merchant.' });
    }
  }

  /**
   * POST /api/merchant/profile
   * Update approved merchant's own cafe profile
   */
  public static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const authUser = (req as AuthRequest).user;
      if (!authUser?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { cafe_name, address, description, phone, logo, banner_url, reward_points } = req.body || {};
      if (!cafe_name || !String(cafe_name).trim()) {
        res.status(400).json({ success: false, error: 'Nama cafe/warung wajib diisi.' });
        return;
      }

      const existing = await MerchantService.getProfileByUserId(authUser.id);
      if (!MerchantService.isApprovedMerchantProfile(existing)) {
        res.status(403).json({
          success: false,
          error: 'Hanya merchant yang sudah disetujui yang dapat memperbarui profil dashboard.',
        });
        return;
      }

      const result = await MerchantService.registerOrUpdateProfile(authUser.id, {
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
   * Add promotional banner / voucher for authenticated merchant's own verified cafe
   */
  public static async addPromo(req: Request, res: Response): Promise<void> {
    try {
      const authUser = (req as AuthRequest).user;
      if (!authUser?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const merchant = await MerchantService.getProfileByUserId(authUser.id);
      if (!merchant || !MerchantService.isApprovedMerchantProfile(merchant)) {
        res.status(403).json({ success: false, error: 'Hanya merchant terdaftar dan terverifikasi yang dapat menambahkan promo.' });
        return;
      }

      const requestedMerchantId = req.body?.merchant_id;
      if (requestedMerchantId && String(requestedMerchantId) !== merchant.id && !hasRole(authUser.role, ['admin', 'superadmin'])) {
        res.status(403).json({ success: false, error: 'Forbidden: tidak boleh menambahkan promo untuk merchant lain.' });
        return;
      }

      const { title, description, discount, image_url, valid_until } = req.body || {};
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
   * Delete promo belonging to authenticated merchant's own verified cafe
   */
  public static async deletePromo(req: Request, res: Response): Promise<void> {
    try {
      const authUser = (req as AuthRequest).user;
      if (!authUser?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const promoId = typeof req.params.promoId === 'string' ? req.params.promoId.trim() : '';
      if (!promoId) {
        res.status(400).json({ success: false, error: 'ID promo diperlukan.' });
        return;
      }

      const merchant = await MerchantService.getProfileByUserId(authUser.id);
      if (!merchant || !MerchantService.isApprovedMerchantProfile(merchant)) {
        res.status(403).json({ success: false, error: 'Hanya merchant terverifikasi yang dapat menghapus promo.' });
        return;
      }

      const requestedMerchantId = req.query.merchant_id as string | undefined;
      if (requestedMerchantId && requestedMerchantId !== merchant.id && !hasRole(authUser.role, ['admin', 'superadmin'])) {
        res.status(403).json({ success: false, error: 'Forbidden: tidak boleh menghapus promo milik merchant lain.' });
        return;
      }

      const result = await MerchantService.deletePromo(merchant.id, promoId);
      res.status(200).json(result);
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Gagal menghapus promo.' });
    }
  }

  /**
   * GET /api/merchant/application/status
   * Returns authenticated user's own merchant application status and review audits.
   */
  public static async getApplicationStatus(req: Request, res: Response): Promise<void> {
    try {
      const authUser = (req as AuthRequest).user;
      if (!authUser?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const data = await MerchantService.getApplicationStatus(authUser.id);
      res.status(200).json({
        success: true,
        role: authUser.role || 'user',
        ...data,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Gagal memuat status pengajuan merchant.' });
    }
  }

  /**
   * GET /api/merchant/admin/applications
   * Admin/superadmin: list merchant applications (optionally filtered by ?status=pending|approved|rejected).
   */
  public static async listAdminApplications(req: Request, res: Response): Promise<void> {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : undefined;
      if (status && !['pending', 'approved', 'rejected'].includes(status)) {
        res.status(400).json({ success: false, error: 'Parameter status tidak valid.' });
        return;
      }

      const applications = await MerchantService.listApplicationsForAdmin(status);
      res.status(200).json({ success: true, applications });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Gagal memuat daftar pengajuan merchant.' });
    }
  }

  /**
   * GET /api/merchant/admin/applications/:merchantId
   * Admin/superadmin: view single merchant application detail and audit history.
   */
  public static async getAdminApplicationDetail(req: Request, res: Response): Promise<void> {
    try {
      const merchantId = typeof req.params.merchantId === 'string' ? req.params.merchantId.trim() : '';
      if (!merchantId) {
        res.status(400).json({ success: false, error: 'ID pengajuan merchant diperlukan.' });
        return;
      }

      const application = await MerchantService.getApplicationDetailForAdmin(merchantId);
      if (!application) {
        res.status(404).json({ success: false, error: 'Pengajuan merchant tidak ditemukan.' });
        return;
      }

      res.status(200).json({ success: true, application });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Gagal memuat detail pengajuan merchant.' });
    }
  }

  /**
   * POST /api/merchant/admin/applications/:merchantId/approve
   * Admin/superadmin: atomically approve pending merchant application.
   */
  public static async approveApplication(req: Request, res: Response): Promise<void> {
    try {
      const authUser = (req as AuthRequest).user;
      if (!authUser?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const merchantId = typeof req.params.merchantId === 'string' ? req.params.merchantId.trim() : '';
      if (!merchantId) {
        res.status(400).json({ success: false, error: 'ID pengajuan merchant diperlukan.' });
        return;
      }

      const result = await MerchantService.approveApplication(merchantId, authUser.id);
      if (!result.success) {
        res.status(result.statusCode).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Gagal menyetujui pengajuan merchant.' });
    }
  }

  /**
   * POST /api/merchant/admin/applications/:merchantId/reject
   * Admin/superadmin: atomically reject pending merchant application with mandatory reason.
   */
  public static async rejectApplication(req: Request, res: Response): Promise<void> {
    try {
      const authUser = (req as AuthRequest).user;
      if (!authUser?.id) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const merchantId = typeof req.params.merchantId === 'string' ? req.params.merchantId.trim() : '';
      if (!merchantId) {
        res.status(400).json({ success: false, error: 'ID pengajuan merchant diperlukan.' });
        return;
      }

      const reason = typeof req.body?.reason === 'string' ? req.body.reason : '';
      const result = await MerchantService.rejectApplication(merchantId, authUser.id, reason);
      if (!result.success) {
        res.status(result.statusCode).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || 'Gagal menolak pengajuan merchant.' });
    }
  }
}
