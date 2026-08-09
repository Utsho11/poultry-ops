import { Response } from 'express';
import { createFarmSchema } from '@poultry-ops/validation';
import { FarmModel, UserModel } from '../models/schemas';
import { AuthRequest, generateToken } from '../middleware/auth';
import { ResponseView } from '../views/response.view';

export class FarmController {
  // Create New Firm
  static async createFirm(req: AuthRequest, res: Response) {
    try {
      const parseResult = createFarmSchema.safeParse(req.body);
      if (!parseResult.success) {
        return ResponseView.error(res, 'Validation failed', 400, parseResult.error.format());
      }

      const { name, animalType, date, location, timezone } = parseResult.data;
      const userId = req.user?.userId;

      if (!userId) {
        return ResponseView.unauthorized(res, 'User context missing');
      }

      const farm = new FarmModel({
        name,
        animalType,
        date: date ? new Date(date) : new Date(),
        location,
        ownerId: userId,
        timezone: timezone || 'Asia/Dhaka',
        plan: 'pro'
      });

      await farm.save();

      // Set user's active farm ID
      const user = await UserModel.findById(userId);
      if (user) {
        user.activeFarmId = farm._id as any;
        if (!user.farmId) user.farmId = farm._id as any;
        await user.save();
      }

      const token = generateToken({
        userId: userId,
        farmId: (farm._id as any).toString(),
        role: user?.role || 'owner',
        email: user?.email || '',
        name: user?.name || ''
      });

      return ResponseView.created(res, {
        farm,
        accessToken: token,
        user: {
          userId: userId,
          farmId: (farm._id as any).toString(),
          name: user?.name,
          email: user?.email,
          phone: user?.phone,
          role: user?.role,
          farmName: farm.name,
          animalType: farm.animalType
        }
      });
    } catch (error: any) {
      return ResponseView.serverError(res, error.message || 'Failed to create firm', error);
    }
  }

  // List all Firms for User
  static async getFarms(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const farms = await FarmModel.find({
        $or: [
          { ownerId: userId },
          { _id: req.user?.farmId }
        ]
      }).sort({ createdAt: -1 });

      return ResponseView.success(res, farms);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Get single Firm by ID
  static async getFarmById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const farm = await FarmModel.findById(id);
      if (!farm) {
        return ResponseView.notFound(res, 'Firm not found');
      }
      return ResponseView.success(res, farm);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Update Firm Details
  static async updateFarm(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { name, animalType, date, location } = req.body;

      const farm = await FarmModel.findById(id);
      if (!farm) {
        return ResponseView.notFound(res, 'Firm not found');
      }

      if (name !== undefined) farm.name = name;
      if (animalType !== undefined) farm.animalType = animalType;
      if (date !== undefined) farm.date = new Date(date);
      if (location !== undefined) farm.location = location;

      await farm.save();
      return ResponseView.success(res, farm);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Delete Firm (Owner only)
  static async deleteFarm(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const farm = await FarmModel.findById(id);
      if (!farm) {
        return ResponseView.notFound(res, 'Firm not found');
      }

      if (farm.ownerId.toString() !== req.user?.userId) {
        return ResponseView.forbidden(res, 'Only the firm owner can delete this firm');
      }

      await FarmModel.deleteOne({ _id: id });
      return ResponseView.success(res, { message: 'Firm deleted successfully' });
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }
}
