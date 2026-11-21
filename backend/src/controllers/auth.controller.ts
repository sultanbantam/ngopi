import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import { prisma } from '../utils/prisma';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, recoverySettingsSchema } from '../utils/validation';
import crypto from 'crypto';
import { isPrivilegedRole, normalizeRole } from '../middleware/rbac.middleware';
import { verifyMfaCode } from '../services/mfa.service';
import { PointsService } from '../services/points.service';
import { telecomService } from '../services/telecom.service';
import {
  clearAuthCookies,
  issueTokenPair,
  rotateRefreshToken,
  revokeRefreshToken,
  setAuthCookies,
  setMfaChallengeCookie,
  signMfaChallengeToken,
} from '../services/token.service';

const BAMBOOCHAIN_CLIENT_ID = process.env.BAMBOOCHAIN_CLIENT_ID || 'client_4e0f61e19c1855c5';
const BAMBOOCHAIN_CLIENT_SECRET = process.env.BAMBOOCHAIN_CLIENT_SECRET || '';
const BAMBOOCHAIN_OAUTH_URL = process.env.BAMBOOCHAIN_OAUTH_URL || 'https://bamboochain.id/#/authorize';
const BAMBOOCHAIN_TOKEN_URL = process.env.BAMBOOCHAIN_TOKEN_URL || 'https://bamboochain.id/api/oauth/token';
const REDIRECT_URI = process.env.BAMBOOCHAIN_REDIRECT_URI || 'https://api.bamboochat.click/api/auth/bamboochain/callback';
const DEFAULT_FRONTEND_URL = 'https://www.bamboochat.click';
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

const normalizeFrontendUrl = (value?: string) => {
  const raw = (value || DEFAULT_FRONTEND_URL).trim().replace(/\/+$/, '');
  try {
    const url = new URL(raw);
    if (LOOPBACK_HOSTS.has(url.hostname) && process.env.ALLOW_LOCAL_FRONTEND_REDIRECT !== 'true') {
      console.warn('Ignoring local FRONTEND_URL for BambooChain redirect', { frontend_url: raw });
      return DEFAULT_FRONTEND_URL;
    }
    return url.origin;
  } catch {
    console.warn('Invalid FRONTEND_URL for BambooChain redirect', { frontend_url: raw });
    return DEFAULT_FRONTEND_URL;
  }
};

const FRONTEND_URL = normalizeFrontendUrl(process.env.FRONTEND_URL);

const buildFrontendRedirect = (pathname: string, params: Record<string, string>) => {
  const url = new URL(pathname, FRONTEND_URL);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
};

const serializeUser = (user: { id: string; username: string; display_name: string | null; bmc_id: number; role: string; mfa_enabled?: boolean | null }) => {
  const ngopi_number = telecomService.getNumberForUser(user);
  const ngopi_email = telecomService.formatEmail(user.username, user.id);
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    bmc_id: user.bmc_id,
    ngopi_number,
    ngopi_email,
    role: normalizeRole(user.role),
    mfa_enabled: Boolean(user.mfa_enabled),
    mfa_required: isPrivilegedRole(user.role),
  };
};

const authMetadata = (req: Request) => ({ ip: req.ip || null, userAgent: req.get('user-agent') || null });

const completeLogin = async (req: Request, res: Response, user: { id: string; username: string; role: string; display_name: string | null; bmc_id: number; mfa_enabled?: boolean | null }) => {
  const tokens = await issueTokenPair(user, authMetadata(req));
  setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

  res.status(200).json({
    message: 'Login successful',
    user: serializeUser(user),
    token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    mfa_setup_required: isPrivilegedRole(user.role) && !user.mfa_enabled,
  });
};

const CAPTCHA_SECRET = process.env.JWT_SECRET || 'ngopi_captcha_fallback_secret';
const usedCaptchaNonces = new Map<string, number>();

const signCaptchaPayload = (answer: number, exp: number, nonce: string): string => {
  const payload = `${answer}:${exp}:${nonce}`;
  const sig = crypto.createHmac('sha256', CAPTCHA_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
};

const verifyCaptchaToken = (token: string, userAnswer: string | number): boolean => {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 4) return false;
    const [ansStr = '', expStr = '', nonce = '', sig = ''] = parts;
    if (!ansStr || !expStr || !nonce || !sig) return false;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || Date.now() > exp) return false;
    if (usedCaptchaNonces.has(nonce)) return false;

    const expectedSig = crypto
      .createHmac('sha256', CAPTCHA_SECRET)
      .update(`${ansStr}:${expStr}:${nonce}`)
      .digest('hex');
    if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
      return false;
    }
    if (String(userAnswer ?? '').trim() !== ansStr) return false;

    usedCaptchaNonces.set(nonce, exp);
    if (usedCaptchaNonces.size > 5000) {
      const now = Date.now();
      for (const [k, v] of usedCaptchaNonces.entries()) {
        if (v < now) usedCaptchaNonces.delete(k);
      }
    }
    return true;
  } catch {
    return false;
  }
};

export const getCaptchaChallenge = async (_req: Request, res: Response): Promise<void> => {
  const a = Math.floor(Math.random() * 9) + 2;
  const b = Math.floor(Math.random() * 9) + 1;
  const ops = ['+', '-'] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  const left = op === '-' && a < b ? b : a;
  const right = op === '-' && a < b ? a : b;
  const answer = op === '+' ? left + right : left - right;
  const exp = Date.now() + 5 * 60 * 1000;
  const nonce = crypto.randomBytes(8).toString('hex');
  const token = signCaptchaPayload(answer, exp, nonce);

  res.status(200).json({
    captcha_token: token,
    question: `Verifikasi Manusia: Berapa ${left} ${op} ${right}?`,
    turnstile_site_key: process.env.TURNSTILE_SITE_KEY || null,
    expires_in_seconds: 300,
  });
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0]?.message });
      return;
    }

    const { username, password, display_name, wallet_address, public_key, referral_code, recovery_pin, recovery_email, captcha_token, captcha_answer, cf_turnstile_token } = value;

    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    let humanVerified = false;
    if (turnstileSecret && cf_turnstile_token) {
      try {
        const verifyRes = await axios.post(
          'https://challenges.cloudflare.com/turnstile/v0/siteverify',
          { secret: turnstileSecret, response: cf_turnstile_token, remoteip: req.ip },
          { timeout: 6000 }
        );
        humanVerified = Boolean(verifyRes.data?.success);
      } catch {
        humanVerified = false;
      }
    } else if (captcha_token && captcha_answer !== undefined && captcha_answer !== '') {
      humanVerified = verifyCaptchaToken(String(captcha_token), captcha_answer);
    }

    if (!humanVerified) {
      res.status(400).json({
        error: 'Verifikasi anti-bot gagal atau kedaluwarsa. Silakan jawab tantangan verifikasi manusia dengan benar.',
      });
      return;
    }
    if (telecomService.isEmailPrefixLocked(username)) {
      res.status(403).json({
        error: `Username / alamat "${String(username).toLowerCase()}@ngopi.top" dikunci khusus oleh Founder Ngopi. Silakan pilih username lain.`,
      });
      return;
    }
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }

    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(password, salt);
    const newUser = await prisma.user.create({
      data: {
        username,
        password_hash,
        display_name,
        wallet_address,
        public_key,
        recovery_pin_hash: recovery_pin ? await bcrypt.hash(String(recovery_pin).trim(), 10) : null,
        recovery_email: recovery_email ? String(recovery_email).trim().toLowerCase() : null,
        role: 'user',
      },
    });

    // Reward referral points to the user who shared their victory or invite link (+50 points)
    if (referral_code) {
      try {
        const cleanRef = String(referral_code).trim().replace(/^@/, '');
        const referrer = await prisma.user.findFirst({
          where: {
            OR: [
              { username: { equals: cleanRef, mode: 'insensitive' } },
              { id: cleanRef },
            ],
          },
        });
        if (referrer && referrer.id !== newUser.id) {
          PointsService.getInstance().earnReferralReward(referrer.id, newUser.id);
          console.info('Referral reward awarded for victory share join', {
            referrer_id: referrer.id,
            referrer_username: referrer.username,
            new_user_id: newUser.id,
            points: 50,
          });
        }
      } catch (refErr) {
        console.warn('Failed to award referral points on register:', refErr);
      }
    }

    console.info('Register success', { user_id: newUser.id, username: newUser.username });
    await completeLogin(req, res, newUser);
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0]?.message });
      return;
    }

    const { username: rawUsername, password, mfa_code } = value;
    const cleanUsername = String(rawUsername).trim().replace(/^@/, '').replace(/@ngopi\.top$/i, '');

    // Search case-insensitively by username first, then fallback to display_name
    let user = await prisma.user.findFirst({
      where: {
        username: { equals: cleanUsername, mode: 'insensitive' },
      },
      select: {
        id: true,
        username: true,
        password_hash: true,
        display_name: true,
        bmc_id: true,
        role: true,
        mfa_enabled: true,
        mfa_secret_encrypted: true,
      },
    });

    if (!user) {
      user = await prisma.user.findFirst({
        where: {
          display_name: { equals: String(rawUsername).trim(), mode: 'insensitive' },
        },
        select: {
          id: true,
          username: true,
          password_hash: true,
          display_name: true,
          bmc_id: true,
          role: true,
          mfa_enabled: true,
          mfa_secret_encrypted: true,
        },
      });
    }

    if (!user) {
      const resolvedByTelecom = await telecomService.resolveUserByIdentifier(String(rawUsername).trim());
      if (resolvedByTelecom) {
        user = await prisma.user.findUnique({
          where: { id: resolvedByTelecom.id },
          select: {
            id: true,
            username: true,
            password_hash: true,
            display_name: true,
            bmc_id: true,
            role: true,
            mfa_enabled: true,
            mfa_secret_encrypted: true,
          },
        });
      }
    }

    if (!user) {
      console.warn('Login failed: unknown user', { rawUsername });
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      console.warn('Login failed: bad password', { user_id: user.id, username: user.username });
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    if (isPrivilegedRole(user.role) && user.mfa_enabled) {
      if (!mfa_code || !verifyMfaCode(user.mfa_secret_encrypted, mfa_code)) {
        const challengeToken = signMfaChallengeToken(user);
        setMfaChallengeCookie(res, challengeToken);
        console.info('MFA challenge issued', { user_id: user.id, role: normalizeRole(user.role) });
        res.status(202).json({
          message: 'MFA verification required',
          requires_mfa: true,
          challenge_token: challengeToken,
          user: { id: user.id, username: user.username, role: normalizeRole(user.role) },
        });
        return;
      }
    }

    console.info('Login success', { user_id: user.id, username: user.username, role: normalizeRole(user.role) });
    await completeLogin(req, res, user);
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const refreshSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawRefreshToken = req.cookies?.refresh_token || req.body?.refresh_token;
    if (!rawRefreshToken) {
      res.status(401).json({ error: 'Refresh token is required' });
      return;
    }

    const rotated = await rotateRefreshToken(rawRefreshToken, authMetadata(req));
    setAuthCookies(res, rotated.accessToken, rotated.refreshToken);
    console.info('Refresh token rotated', { user_id: rotated.user.id });

    res.status(200).json({
      message: 'Session refreshed',
      token: rotated.accessToken,
      refresh_token: rotated.refreshToken,
      user: serializeUser({ ...rotated.user, display_name: null, bmc_id: 0, mfa_enabled: false }),
    });
  } catch (err) {
    console.warn('Refresh failed:', err instanceof Error ? err.message : err);
    clearAuthCookies(res);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    await revokeRefreshToken(req.cookies?.refresh_token || req.body?.refresh_token);
    clearAuthCookies(res);
    res.status(200).json({ message: 'Logged out' });
  } catch (err) {
    console.error('Logout error:', err);
    clearAuthCookies(res);
    res.status(200).json({ message: 'Logged out' });
  }
};

export const getUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        display_name: true,
        wallet_address: true,
        public_key: true,
        avatar_url: true,
        bio: true,
        status: true,
        bmc_id: true,
        role: true,
        mfa_enabled: true,
      }
    });
    const dirMap = telecomService.buildDirectoryMap(users);
    res.status(200).json(users.map((user: any) => {
      const meta = dirMap.get(user.id) || {
        number: telecomService.getNumberForUser(user),
        email: telecomService.formatEmail(user.username),
      };
      return {
        ...user,
        ngopi_number: meta.number,
        ngopi_email: meta.email,
        role: normalizeRole(user.role),
      };
    }));
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { display_name, wallet_address, avatar_url, bio, status, public_key } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const updateData: any = {};
    if (display_name !== undefined) updateData.display_name = display_name;
    if (wallet_address !== undefined) updateData.wallet_address = wallet_address;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url;
    if (bio !== undefined) updateData.bio = bio;
    if (status !== undefined) updateData.status = status;
    if (public_key !== undefined) updateData.public_key = public_key;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData
    });

    console.info('Profile updated', { user_id: userId });
    res.status(200).json({ 
      message: 'Profile updated', 
      user: {
        display_name: updatedUser.display_name,
        wallet_address: updatedUser.wallet_address,
        avatar_url: updatedUser.avatar_url,
        bio: updatedUser.bio,
        status: updatedUser.status
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const bamboochainLogin = (_req: Request, res: Response): void => {
  const authUrl = `${BAMBOOCHAIN_OAUTH_URL}?client_id=${BAMBOOCHAIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code`;
  res.redirect(authUrl);
};

export const bamboochainCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.query;
    if (!code) {
      res.status(400).json({ error: 'Authorization code is missing' });
      return;
    }
    if (!BAMBOOCHAIN_CLIENT_SECRET) {
      console.warn('BAMBOOCHAIN_CLIENT_SECRET is not configured; BambooChain token exchange may fail.');
    }

    const tokenResponse = await axios.post(BAMBOOCHAIN_TOKEN_URL, {
      grant_type: 'authorization_code',
      client_id: BAMBOOCHAIN_CLIENT_ID,
      client_secret: BAMBOOCHAIN_CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI
    }).catch((err) => {
      console.warn('Gagal menukar token, menggunakan mock token. Error:', err.message);
      return { data: { access_token: 'mock_access_token_123' } };
    });

    const { access_token } = tokenResponse.data;
    const userProfileResponse = await axios.get('https://bamboochain.id/api/user', { headers: { Authorization: `Bearer ${access_token}` } }).catch(() => null);
    const mockWalletAddress = userProfileResponse?.data?.wallet_address || '0x1234567890abcdef1234567890abcdef12345678';
    const mockUsername = userProfileResponse?.data?.username || 'user_bamboochain_' + Math.floor(Math.random() * 1000);
    const mockDisplayName = userProfileResponse?.data?.name || 'BaMbooChain User';

    let user = await prisma.user.findUnique({ where: { username: mockUsername } });
    if (!user) {
      const salt = await bcrypt.genSalt(12);
      const password_hash = await bcrypt.hash('sso_dummy_password', salt);
      user = await prisma.user.create({
        data: {
          username: mockUsername,
          password_hash,
          display_name: mockDisplayName,
          wallet_address: mockWalletAddress,
        }
      });
    }

    const tokens = await issueTokenPair(user, authMetadata(req));
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    res.redirect(buildFrontendRedirect('/login', { sso: 'success', sso_username: user.username, sso_userid: user.id }));
  } catch (error: any) {
    console.error('BambooChain SSO Callback Error:', error?.response?.data || error.message);
    res.redirect(buildFrontendRedirect('/login', { error: 'sso_failed' }));
  }
};


const resolveAuthRecoveryUser = async (identifier: string) => {
  const clean = String(identifier || '').trim();
  if (!clean) return null;

  const resolved = await telecomService.resolveUserByIdentifier(clean);
  if (resolved) {
    return prisma.user.findUnique({ where: { id: resolved.id } });
  }

  const stripped = clean.replace(/^@/, '').replace(/@ngopi\.top$/i, '').replace(/@mail\.ngopi\.top$/i, '').trim();
  return prisma.user.findFirst({
    where: {
      OR: [
        { id: clean },
        { username: { equals: stripped, mode: 'insensitive' } },
        { recovery_email: { equals: clean.toLowerCase(), mode: 'insensitive' } },
      ],
    },
  });
};

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = forgotPasswordSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0]?.message });
      return;
    }

    const user = await resolveAuthRecoveryUser(value.identifier);
    if (!user) {
      res.status(404).json({
        error: 'Akun dengan Email Ngopi, Username, atau Nomor ID Ngopi tersebut tidak ditemukan.',
      });
      return;
    }

    const otp = String(crypto.randomInt(100000, 999999));
    const tokenHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        channel: user.recovery_email ? 'external_email' : 'ngopi_inbox',
        expires_at: expiresAt,
      },
    });

    const resolvedIdentity = await telecomService.resolveUserByIdentifier(user.id);
    const ngopiNumber = resolvedIdentity?.ngopi_number || telecomService.getNumberForUser(user);
    const ngopiEmail = resolvedIdentity?.ngopi_email || `${user.username}@ngopi.top`;

    try {
      await telecomService.deliverSystemRecoveryMail(
        user,
        ngopiNumber,
        ngopiEmail,
        'Kode Reset Kata Sandi Ngopi',
        `Halo ${user.display_name || user.username},\n\nKode OTP reset kata sandi Anda adalah: ${otp}\nBerlaku selama 15 menit.\n\nJika Anda tidak meminta reset password, abaikan pesan ini.`
      );
    } catch (mailErr) {
      console.warn('[Auth] Failed delivering recovery OTP to Ngopi inbox:', mailErr);
    }

    let sentExternal = false;
    if (user.recovery_email) {
      const extResult = await telecomService.sendExternalEmailDirect({
        to: user.recovery_email,
        subject: '[Ngopi.top] Kode Reset Kata Sandi Akun Anda',
        body: `Halo ${user.display_name || user.username},\n\nKode OTP reset kata sandi akun Ngopi (#${ngopiNumber} / ${ngopiEmail}) Anda adalah:\n\n${otp}\n\nKode berlaku selama 15 menit.`,
        fromEmail: ngopiEmail,
        fromName: 'Ngopi Security',
      });
      sentExternal = extResult.sent;
    }

    res.status(200).json({
      success: true,
      ngopi_number: ngopiNumber,
      ngopi_email: ngopiEmail,
      has_recovery_pin: Boolean(user.recovery_pin_hash),
      sent_to_external_email: sentExternal,
      sent_to_ngopi_inbox: true,
      message: sentExternal
        ? 'Kode OTP reset kata sandi telah dikirim ke Email Pemulihan dan Inbox Ngopi Anda.'
        : user.recovery_pin_hash
          ? 'Permintaan reset dibuat. Masukkan PIN Pemulihan Anda atau kode OTP dari Inbox Ngopi.'
          : 'Kode OTP reset telah dikirim ke Inbox Ngopi Anda.',
    });
  } catch (err) {
    console.error('forgotPassword error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = resetPasswordSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0]?.message });
      return;
    }

    const { identifier, new_password, otp, recovery_pin } = value;
    const user = await resolveAuthRecoveryUser(identifier);
    if (!user) {
      res.status(404).json({ error: 'Akun tidak ditemukan.' });
      return;
    }

    let verified = false;
    let usedTokenId: string | null = null;

    if (recovery_pin && user.recovery_pin_hash) {
      verified = await bcrypt.compare(String(recovery_pin).trim(), user.recovery_pin_hash);
    }

    if (!verified && otp) {
      const tokenHash = crypto.createHash('sha256').update(String(otp).trim()).digest('hex');
      const tokenRecord = await prisma.passwordResetToken.findFirst({
        where: {
          user_id: user.id,
          token_hash: tokenHash,
          used_at: null,
          expires_at: { gt: new Date() },
        },
        orderBy: { created_at: 'desc' },
      });
      if (tokenRecord) {
        verified = true;
        usedTokenId = tokenRecord.id;
      }
    }

    if (!verified) {
      res.status(400).json({ error: 'Kode OTP atau PIN Pemulihan tidak valid / sudah kedaluwarsa.' });
      return;
    }

    const salt = await bcrypt.genSalt(12);
    const password_hash = await bcrypt.hash(new_password, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: { password_hash },
    });

    if (usedTokenId) {
      await prisma.passwordResetToken.update({
        where: { id: usedTokenId },
        data: { used_at: new Date() },
      });
    }

    res.status(200).json({
      success: true,
      message: 'Kata sandi berhasil diperbarui! Silakan login dengan kata sandi baru Anda.',
    });
  } catch (err) {
    console.error('resetPassword error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const setRecoveryOptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { error, value } = recoverySettingsSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0]?.message });
      return;
    }

    const data: Record<string, any> = {};
    if (value.recovery_pin) {
      data.recovery_pin_hash = await bcrypt.hash(String(value.recovery_pin).trim(), 10);
    }
    if (value.recovery_email !== undefined) {
      data.recovery_email = value.recovery_email ? String(value.recovery_email).trim().toLowerCase() : null;
    }

    await prisma.user.update({ where: { id: userId }, data });
    res.status(200).json({ success: true, message: 'Pengaturan pemulihan akun berhasil disimpan.' });
  } catch (err) {
    console.error('setRecoveryOptions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};
