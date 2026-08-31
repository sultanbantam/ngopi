import { NextFunction, Request, Response } from 'express';

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'mfa_code',
  'mfa_secret',
  'secret',
  'client_secret',
  'private_key',
]);

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const cleanString = (value: string) => value.replace(CONTROL_CHARS, '').trim();

const sanitizeInputValue = (value: unknown, key = ''): unknown => {
  if (typeof value === 'string') return SENSITIVE_KEYS.has(key) ? value : cleanString(value);
  if (Array.isArray(value)) return value.map((item) => sanitizeInputValue(item, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [childKey, sanitizeInputValue(childValue, childKey)]));
  }
  return value;
};

const encodeOutputValue = (value: unknown, key = ''): unknown => {
  if (typeof value === 'string') return SENSITIVE_KEYS.has(key) ? value : escapeHtml(value);
  if (Array.isArray(value)) return value.map((item) => encodeOutputValue(item, key));
  if (value instanceof Date) return value;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [childKey, encodeOutputValue(childValue, childKey)]));
  }
  return value;
};

export const sanitizeRequest = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body) req.body = sanitizeInputValue(req.body) as any;
  if (req.params) req.params = sanitizeInputValue(req.params) as any;
  next();
};

export const encodeJsonResponse = (_req: Request, res: Response, next: NextFunction): void => {
  const originalJson = res.json.bind(res);
  res.json = ((body?: unknown) => originalJson(encodeOutputValue(body))) as Response['json'];
  next();
};

export const isOriginAllowed = (origin?: string): boolean => {
  if (!origin) return true;

  const normalized = origin.trim().replace(/\/+$/, '').toLowerCase();

  const staticOrigins = new Set([
    'https://www.bamboochat.click',
    'https://bamboochat.click',
    'http://www.bamboochat.click',
    'http://bamboochat.click',
    'https://api.bamboochat.click',
    'http://api.bamboochat.click',
    'https://bamboochain.id',
    'https://www.bamboochain.id',
    'http://localhost',
    'capacitor://localhost',
    'ionic://localhost',
    'null',
  ]);

  if (staticOrigins.has(normalized)) return true;

  // Localhost on any port
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/.test(normalized)) {
    return true;
  }

  // Any bamboochat.click subdomain or domain
  if (/^https?:\/\/(?:[a-z0-9-]+\.)*bamboochat\.click$/.test(normalized)) {
    return true;
  }

  // Any bamboochain.id subdomain or domain
  if (/^https?:\/\/(?:[a-z0-9-]+\.)*bamboochain\.id$/.test(normalized)) {
    return true;
  }

  // Any vercel.app deployment
  if (/^https?:\/\/(?:[a-z0-9-]+\.)*vercel\.app$/.test(normalized)) {
    return true;
  }

  // Configured origins
  const configured = (process.env.CORS_ORIGINS || process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, '').toLowerCase())
    .filter(Boolean);

  return configured.includes(normalized);
};

export const getAllowedOrigins = () => {
  const configured = (process.env.CORS_ORIGINS || process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set([
    'https://www.bamboochat.click',
    'https://bamboochat.click',
    'https://api.bamboochat.click',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8081',
    'http://localhost:19006',
    ...configured,
  ]);
};

export const corsOrigin = (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
  if (isOriginAllowed(origin)) {
    callback(null, true);
  } else {
    console.warn('CORS blocked origin:', origin);
    callback(null, false);
  }
};