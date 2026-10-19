import { Router } from 'express';
import { PartnershipController } from '../controllers/partnership.controller';

const router = Router();

// GET /api/partnership/status - Check existing MoU status of logged-in user
router.get('/status', PartnershipController.getStatus);

// POST /api/partnership/submit - Submit MoU registration and trigger WebSocket verification pop-up
router.post('/submit', PartnershipController.submit);

// POST /api/partnership/verify-sign - Verify & digital sign MoU, generate QR, create Warung group & onboard
router.post('/verify-sign', PartnershipController.verifySign);

export default router;
