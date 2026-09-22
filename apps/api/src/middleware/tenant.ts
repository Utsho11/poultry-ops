import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from './auth';
import { FarmModel } from '../models/schemas';

export const resolveTenant = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const headerFarmId = req.headers['x-farm-id'] as string;
    const tokenFarmId = req.user?.farmId;
    const farmId = headerFarmId || tokenFarmId;

    if (!farmId) {
      return res.status(403).json({ error: 'Firm context missing. Please select or create a Firm.' });
    }

    // If client specifies an x-farm-id that differs from token's farmId, enforce strict ownership/membership check
    if (headerFarmId) {
      if (!mongoose.Types.ObjectId.isValid(headerFarmId)) {
        return res.status(400).json({ error: 'Invalid firm identifier format' });
      }

      if (headerFarmId !== tokenFarmId) {
        if (req.user?.role === 'owner') {
          const isOwner = await FarmModel.exists({ _id: headerFarmId, ownerId: req.user.userId });
          if (!isOwner) {
            return res.status(403).json({ error: 'Unauthorized: You do not have permission to access this firm' });
          }
        } else {
          return res.status(403).json({ error: 'Unauthorized: Workers and managers cannot switch firm context' });
        }
      }
    }

    req.farmId = farmId;
    next();
  } catch (error: any) {
    return res.status(500).json({ error: 'Error resolving firm context: ' + error.message });
  }
};

