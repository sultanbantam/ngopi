import { Router } from 'express';
import { register, login, getUsers, updateProfile, bamboochainLogin, bamboochainCallback } from '../controllers/auth.controller';
import { verifyJWT } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/users', getUsers);
router.post('/profile', verifyJWT, updateProfile);

// BambooChain SSO
router.get('/bamboochain', bamboochainLogin);
router.get('/bamboochain/callback', bamboochainCallback);

export default router;
