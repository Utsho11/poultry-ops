import { Response } from 'express';
import { feedStockSchema } from '@poultry-ops/validation';
import { FeedStockModel } from '../models/schemas';
import { AuthRequest } from '../middleware/auth';
import { ResponseView } from '../views/response.view';

export class FeedStockController {
  // Get feed stock entries for active Firm
  static async getFeedStock(req: AuthRequest, res: Response) {
    try {
      const feedStocks = await FeedStockModel.find({ farmId: req.farmId }).sort({ date: -1 });
      return ResponseView.success(res, feedStocks);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Add feed stock
  static async createFeedStock(req: AuthRequest, res: Response) {
    try {
      const parseResult = feedStockSchema.safeParse(req.body);
      if (!parseResult.success) {
        return ResponseView.error(res, 'Validation failed', 400, parseResult.error.format());
      }

      const { category, bagPrice, bags, date, note } = parseResult.data;

      const totalKg = bags * 50;
      const totalCost = bags * bagPrice;

      const feedStock = new FeedStockModel({
        farmId: req.farmId,
        category,
        bagPrice,
        bags,
        totalKg,
        totalCost,
        date,
        note,
        recordedBy: req.user?.userId
      });

      await feedStock.save();
      return ResponseView.created(res, feedStock);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }
}
