import { Router } from 'express';
import { MerchantController } from '../controllers/merchant.controller';

const router = Router();

// Public partner listings & cafe details
router.get('/partners', MerchantController.getPartners);
router.get('/cafe/:tokenOrId', MerchantController.getCafeDetails);

// User QR Check-in at Cafe Table (+50 points, 1x/day)
router.post('/checkin', MerchantController.checkin);

// Merchant Dashboard & Statistics
router.get('/dashboard', MerchantController.getDashboard);
router.get('/me', MerchantController.getMyProfile);

// Merchant Cafe Profile Registration & Updates
router.post('/profile', MerchantController.updateProfile);
router.post('/register', MerchantController.updateProfile);

// Merchant Promotions Management
router.post('/promo', MerchantController.addPromo);
router.delete('/promo/:promoId', MerchantController.deletePromo);

export default router;
