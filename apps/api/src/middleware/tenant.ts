import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export const resolveTenant = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.farmId) {
    return res.status(403).json({ error: 'Tenant context missing or unauthorized' });
  }
  req.farmId = req.user.farmId;
  next();
};
