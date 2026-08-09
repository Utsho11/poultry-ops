import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export const resolveTenant = (req: AuthRequest, res: Response, next: NextFunction) => {
  const headerFarmId = req.headers['x-farm-id'] as string;
  const farmId = headerFarmId || req.user?.farmId;

  if (!farmId) {
    return res.status(403).json({ error: 'Firm context missing. Please select or create a Firm.' });
  }

  req.farmId = farmId;
  next();
};
