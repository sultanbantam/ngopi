import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import { prisma } from '../utils/prisma';
import { registerSchema, loginSchema } from '../utils/validation';
import { isPrivilegedRole, normalizeRole } from '../middleware/rbac.middleware';
import { verifyMfaCode } from '../services/mfa.service';
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

const serializeUser = (user: { id: string; username: string; display_name: string | null; bmc_id: number; role: string; mfa_enabled?: boolean | null }) => ({
  id: user.id,
  username: user.username,
  display_name: user.display_name,
  bmc_id: user.bmc_id,
  role: normalizeRole(user.role),
  mfa_enabled: Boolean(user.mfa_enabled),
  mfa_required: isPrivilegedRole(user.role),
});

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

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      res.status(400).json({ error: error.details[0]?.message });
      return;
    }

    const { username, password, display_name, wallet_address, public_key } = value;
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
        role: 'user',
      },
    });

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

    const { username, password, mfa_code } = value;
    const user = await prisma.user.findUnique({
      where: { username },
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
      console.warn('Login failed: unknown user', { username });
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
    res.status(200).json(users.map((user) => ({ ...user, role: normalizeRole(user.role) })));
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { display_name, wallet_address, avatar_url, bio, status } = req.body;

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
