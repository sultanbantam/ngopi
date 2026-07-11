import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { normalizeRole, requireRoles, requireStaff } from './rbac.middleware';

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
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string; role?: string; token_type?: string };
    if (decoded.token_type && decoded.token_type !== 'access') {
      res.status(401).json({ error: 'Invalid token type.' });
      return;
    }

    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: normalizeRole(decoded.role),
    };
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token.' });
  }
};

export { requireRoles, requireStaff };