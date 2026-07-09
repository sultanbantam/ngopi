import { Router } from 'express';
import { getFaqs } from '../controllers/platform.controller';

const router = Router();

router.get('/', getFaqs);

export default router;