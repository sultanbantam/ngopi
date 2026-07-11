import { Router } from 'express';
import { getFaqs } from '../controllers/platform.controller';
import { validateRequest } from '../middleware/validation';
import { faqQuerySchema } from '../utils/validation';

const router = Router();

router.get('/', validateRequest({ query: faqQuerySchema }), getFaqs);

export default router;