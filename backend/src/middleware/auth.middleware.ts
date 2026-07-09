import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_fallback';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role?: string;
  };
}

export const verifyJWT = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access denied. No token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; username: string; role?: string };
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token.' });
  }
};

export const requireRoles = (roles: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      let role = req.user.role;

      if (!role) {
        const user = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { role: true },
        });
        role = user?.role;
        if (role) req.user.role = role;
      }

      if (!role || !roles.includes(role)) {
        res.status(403).json({ error: 'Forbidden. Staff access required.' });
        return;
      }

      next();
    } catch (error) {
      console.error('Role check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

export const requireStaff = requireRoles(['admin', 'agent']);