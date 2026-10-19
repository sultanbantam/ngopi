import { Request, Response } from 'express';
import { PartnershipService } from '../services/partnership.service';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

const extractUser = (req: Request): { id: string; username: string } | null => {
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
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (decoded?.id) {
        return {
          id: String(decoded.id),
          username: String(decoded.username || 'Pengunjung'),
        };
      }
    } catch (_) {
      try {
        const decoded: any = jwt.decode(token);
        if (decoded?.id) {
          return {
            id: String(decoded.id),
            username: String(decoded.username || 'Pengunjung'),
          };
        }
      } catch {}
    }
  }

  const fallbackId = (req.headers['x-user-id'] as string) || (req.body?.userId as string) || (req.query?.userId as string);
  const fallbackUsername = (req.headers['x-user-name'] as string) || (req.body?.username as string) || (req.query?.username as string);

  if (fallbackId && fallbackId !== 'guest_user') {
    return { id: String(fallbackId), username: String(fallbackUsername || fallbackId) };
  }

  return null;
};

export class PartnershipController {
  /**
   * GET /api/partnership/status
   */
  public static async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const user = extractUser(req);
      if (!user) {
        res.status(401).json({ success: false, error: 'Silakan login terlebih dahulu untuk mengakses menu Kemitraan.' });
        return;
      }

      const agreement = await PartnershipService.getAgreementByUserId(user.id);
      if (!agreement) {
        res.status(200).json({ success: true, has_agreement: false, username: user.username });
        return;
      }

      res.status(200).json({
        success: true,
        has_agreement: true,
        is_agreed: agreement.is_agreed,
        agreement,
      });
    } catch (e: any) {
      console.error('[PartnershipController] getStatus error:', e);
      res.status(500).json({ success: false, error: e?.message || 'Gagal memuat status kemitraan.' });
    }
  }

  /**
   * POST /api/partnership/submit
   */
  public static async submit(req: Request, res: Response): Promise<void> {
    try {
      const user = extractUser(req);
      if (!user) {
        res.status(401).json({ success: false, error: 'Sesi login tidak valid. Silakan login terlebih dahulu.' });
        return;
      }

      const { owner_name, cafe_name, address, phone, commercial_model } = req.body;

      if (!cafe_name || !String(cafe_name).trim()) {
        res.status(400).json({ success: false, error: 'Nama Cafe wajib diisi.' });
        return;
      }
      if (!address || !String(address).trim()) {
        res.status(400).json({ success: false, error: 'Alamat lengkap Cafe wajib diisi.' });
        return;
      }
      if (!phone || !String(phone).trim()) {
        res.status(400).json({ success: false, error: 'Nomor Telepon/WhatsApp pemilik wajib diisi.' });
        return;
      }

      const result = await PartnershipService.submitAgreement({
        userId: user.id,
        username: user.username,
        owner_name: String(owner_name || user.username).trim(),
        cafe_name: String(cafe_name).trim(),
        address: String(address).trim(),
        phone: String(phone).trim(),
        commercial_model: commercial_model === 'model_b' ? 'model_b' : 'model_a',
      });

      res.status(200).json({
        success: true,
        message: 'Draft MoU berhasil disiapkan. Silakan verifikasi tanda tangan digital pada pop-up akun Anda.',
        agreement: result.agreement,
      });
    } catch (e: any) {
      console.error('[PartnershipController] submit error:', e);
      res.status(500).json({ success: false, error: e?.message || 'Gagal mengajukan kerja sama kemitraan.' });
    }
  }

  /**
   * POST /api/partnership/verify-sign
   */
  public static async verifySign(req: Request, res: Response): Promise<void> {
    try {
      const user = extractUser(req);
      if (!user) {
        res.status(401).json({ success: false, error: 'Sesi login tidak valid. Silakan login terlebih dahulu.' });
        return;
      }

      const result = await PartnershipService.verifyAndSignAgreement(user.id);
      res.status(200).json(result);
    } catch (e: any) {
      console.error('[PartnershipController] verifySign error:', e);
      res.status(500).json({ success: false, error: e?.message || 'Gagal menandatangani MoU kemitraan.' });
    }
  }
}
