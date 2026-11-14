import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { normalizeRole, requireRoles, requireStaff, requireMerchant } from './rbac.middleware';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role?: string;
  };
}

export const verifyJWT = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const token = req.cookies?.token || bearerToken;

  if (!token) {
    res.status(401).json({ error: 'Access denied. No token provided.' });
    return;
  }

  try {
    const verifyOptions: jwt.VerifyOptions = {};
    if (process.env.JWT_ISSUER) verifyOptions.issuer = process.env.JWT_ISSUER;
    if (process.env.JWT_AUDIENCE) verifyOptions.audience = process.env.JWT_AUDIENCE;

    const decoded = jwt.verify(token, JWT_SECRET, verifyOptions) as {
      id?: unknown;
      username?: unknown;
      role?: string;
      token_type?: string;
    };

    if (!decoded || typeof decoded !== 'object' || typeof decoded.id !== 'string' || !decoded.id.trim()) {
      res.status(401).json({ error: 'Invalid token payload.' });
      return;
    }

    if (decoded.token_type && decoded.token_type !== 'access') {
      res.status(401).json({ error: 'Invalid token type.' });
      return;
    }

    req.user = {
      id: decoded.id.trim(),
      username: typeof decoded.username === 'string' ? decoded.username : '',
      role: normalizeRole(decoded.role),
    };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

export { requireRoles, requireStaff, requireMerchant };