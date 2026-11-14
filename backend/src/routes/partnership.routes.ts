import { Router } from 'express';
import { PartnershipController } from '../controllers/partnership.controller';
import { verifyJWT } from '../middleware/auth.middleware';
import { requireDbUser } from '../middleware/rbac.middleware';

const router = Router();

// All partnership agreement operations require verified JWT + DB-backed user resolution
router.use(verifyJWT, requireDbUser);

// GET /api/partnership/status - Check existing MoU status of logged-in user
router.get('/status', PartnershipController.getStatus);

// POST /api/partnership/submit - Submit MoU registration and trigger WebSocket verification pop-up
router.post('/submit', PartnershipController.submit);

// POST /api/partnership/verify-sign - Verify & digital sign MoU (keeps merchant application pending)
router.post('/verify-sign', PartnershipController.verifySign);

export default router;
