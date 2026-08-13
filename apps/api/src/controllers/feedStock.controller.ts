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

  // Update feed stock entry
  static async updateFeedStock(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const parseResult = feedStockSchema.partial().safeParse(req.body);
      if (!parseResult.success) {
        return ResponseView.error(res, 'Validation failed', 400, parseResult.error.format());
      }

      const existing = await FeedStockModel.findOne({ _id: id, farmId: req.farmId });
      if (!existing) {
        return ResponseView.notFound(res, 'Feed stock entry not found');
      }

      const { category, bagPrice, bags, date, note } = parseResult.data;
      if (category !== undefined) existing.category = category as any;
      if (bagPrice !== undefined) existing.bagPrice = bagPrice;
      if (bags !== undefined) {
        existing.bags = bags;
        existing.totalKg = bags * 50;
      }
      if (existing.bags !== undefined && existing.bagPrice !== undefined) {
        existing.totalCost = existing.bags * existing.bagPrice;
      }
      if (date !== undefined) existing.date = date;
      if (note !== undefined) existing.note = note;

      await existing.save();
      return ResponseView.success(res, existing);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Delete feed stock entry
  static async deleteFeedStock(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const feedStock = await FeedStockModel.findOneAndDelete({ _id: id, farmId: req.farmId });
      if (!feedStock) {
        return ResponseView.notFound(res, 'Feed stock entry not found');
      }
      return ResponseView.success(res, { message: 'Feed stock entry deleted successfully', id });
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }
}

