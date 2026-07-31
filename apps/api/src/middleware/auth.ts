import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@poultry-ops/types';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    farmId: string;
    role: UserRole;
    email: string;
    name: string;
  };
  farmId?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'poultryops_super_secret_jwt_key_2026';

export const generateToken = (payload: { userId: string; farmId: string; role: UserRole; email: string; name: string }) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    req.farmId = decoded.farmId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: requires ${allowedRoles.join(' or ')} role` });
    }
    next();
  };
};
