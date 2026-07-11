import { NextFunction, Request, Response } from 'express';
import { prisma } from '../utils/prisma';

export const ROLES = ['user', 'agent_cs', 'admin', 'superadmin'] as const;
export type Role = typeof ROLES[number];

const ROLE_ALIASES: Record<string, Role> = {
  agent: 'agent_cs',
  cs: 'agent_cs',
};

export const normalizeRole = (role?: string | null): Role => {
  if (!role) return 'user';
  const normalized = role.toLowerCase();
  if ((ROLES as readonly string[]).includes(normalized)) return normalized as Role;
  return ROLE_ALIASES[normalized] || 'user';
};

export const hasRole = (actualRole: string | null | undefined, allowedRoles: readonly string[]) => {
  const normalized = normalizeRole(actualRole);
  return allowedRoles.map((role) => normalizeRole(role)).includes(normalized);
};

export const requireRole = (...allowedRoles: Role[]) => async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authReq = req as Request & { user?: { id?: string; role?: string } };
  if (!authReq.user?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    let role = authReq.user.role;
    if (!role) {
      const user = await prisma.user.findUnique({ where: { id: authReq.user.id }, select: { role: true } });
      role = user?.role || 'user';
    }

    const normalizedRole = normalizeRole(role);
    authReq.user.role = normalizedRole;

    if (!hasRole(normalizedRole, allowedRoles)) {
      res.status(403).json({ error: 'Forbidden. Insufficient role.' });
      return;
    }

    next();
  } catch (error) {
    console.error('RBAC role check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const requireRoles = (roles: Role[]) => requireRole(...roles);
export const requireStaff = requireRole('agent_cs', 'admin', 'superadmin');
export const requireAdmin = requireRole('admin', 'superadmin');
export const requireSuperadmin = requireRole('superadmin');
export const isPrivilegedRole = (role?: string | null) => hasRole(role, ['agent_cs', 'admin', 'superadmin']);