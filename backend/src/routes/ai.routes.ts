import { Router } from 'express';
import { queryAi } from '../controllers/ai.controller';
import { AgentController } from '../controllers/agent.controller';
import { verifyJWT } from '../middleware/auth.middleware';
import { requireMerchant } from '../middleware/rbac.middleware';
import { aiLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validation';
import { aiQuerySchema } from '../utils/validation';

const router = Router();

// Existing Bambupedia query
router.post('/query', verifyJWT, aiLimiter, validateRequest({ body: aiQuerySchema }), queryAi);

// ngopAI Autonomous Agent Routes (authenticated & rate-limited)
router.post('/agent/execute', verifyJWT, aiLimiter, AgentController.execute);
router.get('/agent/status', verifyJWT, aiLimiter, requireMerchant, AgentController.getStatus);
router.post('/agent/toggle', verifyJWT, aiLimiter, requireMerchant, AgentController.toggle);
router.post('/agent/chat', verifyJWT, aiLimiter, AgentController.chat);

export default router;