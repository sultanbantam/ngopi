import crypto from 'crypto';
import { Response } from 'express';
import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { prisma } from '../utils/prisma';
import { normalizeRole } from '../middleware/rbac.middleware';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';
const ACCESS_TOKEN_TTL = (process.env.ACCESS_TOKEN_TTL || '15m') as StringValue;
const REFRESH_TOKEN_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 30);
const isProduction = process.env.NODE_ENV === 'production';

type TokenUser = {
  id: string;
  username: string;
  role?: string | null;
};

export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

export const signAccessToken = (user: TokenUser) => jwt.sign(
  {
    id: user.id,
    username: user.username,
    role: normalizeRole(user.role),
    token_type: 'access',
  },
  JWT_SECRET,
  { expiresIn: ACCESS_TOKEN_TTL },
);

export const signMfaChallengeToken = (user: TokenUser) => jwt.sign(
  {
    id: user.id,
    username: user.username,
    role: normalizeRole(user.role),
    token_type: 'mfa_challenge',
  },
  JWT_SECRET,
  { expiresIn: '5m' },
);

export const createRefreshToken = async (user: TokenUser, metadata: { ip?: string | null; userAgent?: string | null } = {}, familyId?: string) => {
  const rawToken = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  const refreshToken = await prisma.refreshToken.create({
    data: {
      user_id: user.id,
      token_hash: hashToken(rawToken),
      family_id: familyId || crypto.randomUUID(),
      expires_at: expiresAt,
      created_ip: metadata.ip || null,
      user_agent: metadata.userAgent || null,
    },
  });

  return { rawToken, refreshToken };
};

export const issueTokenPair = async (user: TokenUser, metadata: { ip?: string | null; userAgent?: string | null } = {}) => {
  const accessToken = signAccessToken(user);
  const { rawToken } = await createRefreshToken(user, metadata);
  return { accessToken, refreshToken: rawToken };
};

export const rotateRefreshToken = async (rawToken: string, metadata: { ip?: string | null; userAgent?: string | null } = {}) => {
  const tokenHash = hashToken(rawToken);
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token_hash: tokenHash },
    include: { user: { select: { id: true, username: true, role: true } } },
  });

  if (!storedToken || storedToken.revoked_at || storedToken.expires_at <= new Date()) {
    throw new Error('Invalid refresh token');
  }

  const { rawToken: nextRefreshToken, refreshToken: nextStoredToken } = await createRefreshToken(storedToken.user, metadata, storedToken.family_id);
  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: {
      revoked_at: new Date(),
      replaced_by_token_id: nextStoredToken.id,
    },
  });

  return {
    user: storedToken.user,
    accessToken: signAccessToken(storedToken.user),
    refreshToken: nextRefreshToken,
  };
};

export const revokeRefreshToken = async (rawToken?: string | null) => {
  if (!rawToken) return;
  await prisma.refreshToken.updateMany({
    where: { token_hash: hashToken(rawToken), revoked_at: null },
    data: { revoked_at: new Date() },
  });
};

const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  path: '/',
};

export const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
  res.cookie('token', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie('refresh_token', refreshToken, { ...cookieOptions, maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000 });
};

export const clearAuthCookies = (res: Response) => {
  res.clearCookie('token', cookieOptions);
  res.clearCookie('refresh_token', cookieOptions);
  res.clearCookie('mfa_challenge', cookieOptions);
};

export const setMfaChallengeCookie = (res: Response, challengeToken: string) => {
  res.cookie('mfa_challenge', challengeToken, { ...cookieOptions, maxAge: 5 * 60 * 1000 });
};