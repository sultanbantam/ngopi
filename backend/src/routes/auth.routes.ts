import { Router } from 'express';
import { register, login, getUsers, updateProfile, bamboochainLogin, bamboochainCallback, refreshSession, logout } from '../controllers/auth.controller';
import { setupMfa, verifyMfaSetup, disableMfa, verifyMfaLogin } from '../controllers/mfa.controller';
import { verifyJWT } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validation';
import { loginSchema, mfaCodeSchema, mfaLoginSchema, profileUpdateSchema, refreshTokenSchema, registerSchema } from '../utils/validation';

const router = Router();

router.post('/register', authLimiter, validateRequest({ body: registerSchema }), register);
router.post('/login', authLimiter, validateRequest({ body: loginSchema }), login);
router.post('/refresh', authLimiter, validateRequest({ body: refreshTokenSchema }), refreshSession);
router.post('/logout', validateRequest({ body: refreshTokenSchema }), logout);
router.post('/mfa/login/verify', authLimiter, validateRequest({ body: mfaLoginSchema }), verifyMfaLogin);
router.post('/mfa/setup', verifyJWT, setupMfa);
router.post('/mfa/verify', verifyJWT, validateRequest({ body: mfaCodeSchema }), verifyMfaSetup);
router.post('/mfa/disable', verifyJWT, validateRequest({ body: mfaCodeSchema }), disableMfa);
router.get('/users', verifyJWT, getUsers);
router.post('/profile', verifyJWT, validateRequest({ body: profileUpdateSchema }), updateProfile);

// BambooChain SSO
router.get('/bamboochain', bamboochainLogin);
router.get('/bamboochain/callback', bamboochainCallback);

export default router;