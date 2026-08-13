import { Response } from 'express';
import { createFarmSchema } from '@poultry-ops/validation';
import { FarmModel, UserModel, BatchModel, DailyLogModel, ExpenseModel, SaleModel, FeedStockModel, CustomerModel, PaymentModel, HealthRecordModel } from '../models/schemas';
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

  // Get single Firm by ID (with ownership/membership check)
  static async getFarmById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const farm = await FarmModel.findById(id);
      if (!farm) {
        return ResponseView.notFound(res, 'Firm not found');
      }

      const isOwner = farm.ownerId && farm.ownerId.toString() === userId;
      const isMember = req.user?.farmId && req.user.farmId.toString() === farm._id.toString();
      if (!isOwner && !isMember) {
        return ResponseView.forbidden(res, 'You do not have access to this firm');
      }

      return ResponseView.success(res, farm);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Update Firm Details (Owner/Manager only)
  static async updateFarm(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const { name, animalType, date, location } = req.body;

      const farm = await FarmModel.findById(id);
      if (!farm) {
        return ResponseView.notFound(res, 'Firm not found');
      }

      const isOwner = farm.ownerId && farm.ownerId.toString() === userId;
      if (!isOwner) {
        return ResponseView.forbidden(res, 'Only the firm owner can update firm details');
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

  // Delete Firm (Owner only, with complete cascade deletion of tenant data)
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

      // Cascade delete all tenant records
      await Promise.all([
        BatchModel.deleteMany({ farmId: id }),
        DailyLogModel.deleteMany({ farmId: id }),
        ExpenseModel.deleteMany({ farmId: id }),
        SaleModel.deleteMany({ farmId: id }),
        FeedStockModel.deleteMany({ farmId: id }),
        CustomerModel.deleteMany({ farmId: id }),
        PaymentModel.deleteMany({ farmId: id }),
        HealthRecordModel.deleteMany({ farmId: id }),
        UserModel.updateMany({ activeFarmId: id }, { $unset: { activeFarmId: 1 } }),
        UserModel.updateMany({ farmId: id }, { $unset: { farmId: 1 } }),
        FarmModel.deleteOne({ _id: id })
      ]);

      return ResponseView.success(res, { message: 'Firm and all associated data deleted successfully' });
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }
}
