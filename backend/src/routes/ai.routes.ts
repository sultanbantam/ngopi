import { Router } from 'express';
import { queryAi } from '../controllers/ai.controller';
import { verifyJWT } from '../middleware/auth.middleware';

const router = Router();

router.post('/query', verifyJWT, queryAi);

export default router;