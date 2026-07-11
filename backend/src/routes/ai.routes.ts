import { Router } from 'express';
import { queryAi } from '../controllers/ai.controller';
import { verifyJWT } from '../middleware/auth.middleware';
import { aiLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validation';
import { aiQuerySchema } from '../utils/validation';

const router = Router();

router.post('/query', verifyJWT, aiLimiter, validateRequest({ body: aiQuerySchema }), queryAi);

export default router;