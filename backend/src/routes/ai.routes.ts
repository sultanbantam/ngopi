import { Router } from 'express';
import { queryAi } from '../controllers/ai.controller';
import { AgentController } from '../controllers/agent.controller';
import { verifyJWT } from '../middleware/auth.middleware';
import { aiLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validation';
import { aiQuerySchema } from '../utils/validation';

const router = Router();

// Existing Bambupedia query
router.post('/query', verifyJWT, aiLimiter, validateRequest({ body: aiQuerySchema }), queryAi);

// ngopAI Autonomous Agent Routes (Dubai Chamber Digital Competition)
router.post('/agent/execute', AgentController.execute);
router.get('/agent/status', AgentController.getStatus);
router.post('/agent/toggle', AgentController.toggle);
router.post('/agent/chat', AgentController.chat);

export default router;