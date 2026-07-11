import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/settings.controller';
import { verifyJWT } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation';
import { settingsSchema } from '../utils/validation';

const router = Router();

router.use(verifyJWT);
router.get('/', getSettings);
router.post('/', validateRequest({ body: settingsSchema }), updateSettings);

export default router;