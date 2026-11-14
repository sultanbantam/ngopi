import { Request, Response } from 'express';
import { PartnershipService } from '../services/partnership.service';
import { AuthRequest } from '../middleware/auth.middleware';

export class PartnershipController {
  /**
   * GET /api/partnership/status
   */
  public static async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const authUser = (req as AuthRequest).user;
      if (!authUser?.id) {
        res.status(401).json({ success: false, error: 'Silakan login terlebih dahulu untuk mengakses menu Kemitraan.' });
        return;
      }

      const agreement = await PartnershipService.getAgreementByUserId(authUser.id);
      if (!agreement) {
        res.status(200).json({ success: true, has_agreement: false, username: authUser.username });
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
      const authUser = (req as AuthRequest).user;
      if (!authUser?.id) {
        res.status(401).json({ success: false, error: 'Sesi login tidak valid. Silakan login terlebih dahulu.' });
        return;
      }

      const { owner_name, cafe_name, address, phone, commercial_model } = req.body || {};

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
        userId: authUser.id,
        username: authUser.username || 'Pengunjung',
        owner_name: String(owner_name || authUser.username || 'Pengunjung').trim(),
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
      const authUser = (req as AuthRequest).user;
      if (!authUser?.id) {
        res.status(401).json({ success: false, error: 'Sesi login tidak valid. Silakan login terlebih dahulu.' });
        return;
      }

      const result = await PartnershipService.verifyAndSignAgreement(authUser.id);
      res.status(result.statusCode || (result.success ? 200 : 400)).json(result);
    } catch (e: any) {
      console.error('[PartnershipController] verifySign error:', e);
      res.status(500).json({ success: false, error: e?.message || 'Gagal menandatangani MoU kemitraan.' });
    }
  }
}
