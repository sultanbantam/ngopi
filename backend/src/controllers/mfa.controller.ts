import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth.middleware';
import { generateMfaSecret, getOtpAuthUrl, encryptMfaSecret, verifyMfaCode } from '../services/mfa.service';
import { issueTokenPair, setAuthCookies } from '../services/token.service';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

export const setupMfa = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const secret = generateMfaSecret();
    const otpauthUrl = getOtpAuthUrl(user.username, secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfa_secret_encrypted: encryptMfaSecret(secret),
        mfa_enabled: false,
        mfa_verified_at: null,
      },
    });

    console.info('MFA setup initialized', { user_id: user.id });
    res.status(200).json({ otpauth_url: otpauthUrl, qr_code_data_url: qrCodeDataUrl });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const verifyMfaSetup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const code = String(req.body?.code || '');
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, mfa_secret_encrypted: true } });
    if (!user?.mfa_secret_encrypted || !verifyMfaCode(user.mfa_secret_encrypted, code)) {
      res.status(400).json({ error: 'Invalid MFA code' });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { mfa_enabled: true, mfa_verified_at: new Date() },
    });

    console.info('MFA enabled', { user_id: user.id });
    res.status(200).json({ message: 'MFA enabled' });
  } catch (error) {
    console.error('MFA verify error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const disableMfa = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const code = String(req.body?.code || '');
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, mfa_enabled: true, mfa_secret_encrypted: true } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.mfa_enabled && !verifyMfaCode(user.mfa_secret_encrypted, code)) {
      res.status(400).json({ error: 'Invalid MFA code' });
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { mfa_enabled: false, mfa_secret_encrypted: null, mfa_verified_at: null },
    });

    console.info('MFA disabled', { user_id: user.id });
    res.status(200).json({ message: 'MFA disabled' });
  } catch (error) {
    console.error('MFA disable error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const verifyMfaLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const challengeToken = String(req.body?.challenge_token || req.cookies?.mfa_challenge || '');
    const code = String(req.body?.code || '');
    if (!challengeToken || !code) {
      res.status(400).json({ error: 'challenge_token and code are required' });
      return;
    }

    const decoded = jwt.verify(challengeToken, JWT_SECRET) as { id: string; token_type?: string };
    if (decoded.token_type !== 'mfa_challenge') {
      res.status(401).json({ error: 'Invalid MFA challenge' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, username: true, role: true, display_name: true, bmc_id: true, mfa_secret_encrypted: true },
    });

    if (!user || !verifyMfaCode(user.mfa_secret_encrypted, code)) {
      res.status(401).json({ error: 'Invalid MFA code' });
      return;
    }

    const tokens = await issueTokenPair(user, { ip: req.ip || null, userAgent: req.get('user-agent') || null });
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    res.clearCookie('mfa_challenge');

    console.info('MFA login success', { user_id: user.id });
    res.status(200).json({
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        bmc_id: user.bmc_id,
        role: user.role,
      },
      token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });
  } catch (error) {
    console.error('MFA login verify error:', error);
    res.status(401).json({ error: 'Invalid or expired MFA challenge' });
  }
};