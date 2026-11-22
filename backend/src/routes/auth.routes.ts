import { Router } from 'express';
import {
  register,
  login,
  getUsers,
  updateProfile,
  bamboochainLogin,
  bamboochainCallback,
  refreshSession,
  logout,
  getCaptchaChallenge,
  forgotPassword,
  resetPassword,
  setRecoveryOptions,
  piLogin,
} from '../controllers/auth.controller';
import { setupMfa, verifyMfaSetup, disableMfa, verifyMfaLogin } from '../controllers/mfa.controller';
import { verifyJWT } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validation';
import { loginSchema, mfaCodeSchema, mfaLoginSchema, profileUpdateSchema, refreshTokenSchema, registerSchema } from '../utils/validation';

const router = Router();

router.get('/captcha', getCaptchaChallenge);
router.post('/register', authLimiter, validateRequest({ body: registerSchema }), register);
router.post('/login', authLimiter, validateRequest({ body: loginSchema }), login);
router.post('/pi', authLimiter, piLogin);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.post('/recovery-settings', verifyJWT, setRecoveryOptions);
router.post('/refresh', validateRequest({ body: refreshTokenSchema }), refreshSession);
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