import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { MerchantController } from '../controllers/merchant.controller';
import { verifyJWT } from '../middleware/auth.middleware';
import { requireDbUser, requireDbMerchant, requireDbAdmin } from '../middleware/rbac.middleware';

const router = Router();

const checkinLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Terlalu banyak permintaan check-in. Coba lagi sebentar.' },
});

// Public Read-Only Showcase & Restricted Check-in
router.get('/partners', MerchantController.getPartners);
router.get('/cafe/:tokenOrId', MerchantController.getCafeDetails);
router.post('/checkin', checkinLimiter, MerchantController.checkin);

// Authenticated User Merchant Status & Pending Application
router.get('/me', verifyJWT, requireDbUser, MerchantController.getMyProfile);
router.get('/application/status', verifyJWT, requireDbUser, MerchantController.getApplicationStatus);
router.post('/register', verifyJWT, requireDbUser, MerchantController.registerApplication);

// Admin / Superadmin Merchant Review Queue Routes
router.get('/admin/applications', verifyJWT, requireDbAdmin, MerchantController.listAdminApplications);
router.get('/admin/applications/:merchantId', verifyJWT, requireDbAdmin, MerchantController.getAdminApplicationDetail);
router.post('/admin/applications/:merchantId/approve', verifyJWT, requireDbAdmin, MerchantController.approveApplication);
router.post('/admin/applications/:merchantId/reject', verifyJWT, requireDbAdmin, MerchantController.rejectApplication);

// Protected Merchant Management Routes (DB-backed role + approved merchant)
router.get('/dashboard', verifyJWT, requireDbMerchant, MerchantController.getDashboard);
router.post('/profile', verifyJWT, requireDbMerchant, MerchantController.updateProfile);
router.post('/promo', verifyJWT, requireDbMerchant, MerchantController.addPromo);
router.delete('/promo/:promoId', verifyJWT, requireDbMerchant, MerchantController.deletePromo);

export default router;
