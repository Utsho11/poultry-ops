import { Response } from 'express';
import mongoose from 'mongoose';
import { dailyLogSchema } from '@poultry-ops/validation';
import { DailyLogModel, BatchModel, FeedStockModel } from '../models/schemas';
import { AuthRequest } from '../middleware/auth';
import { ResponseView } from '../views/response.view';

export class LogController {
  // Get daily logs for active Firm
  static async getLogs(req: AuthRequest, res: Response) {
    try {
      const { batchId, from, to } = req.query;
      const query: any = { farmId: req.farmId };

      if (batchId) {
        let bObjId: any;
        try { bObjId = new mongoose.Types.ObjectId(batchId as string); } catch { bObjId = batchId; }
        query.$and = [{ $or: [{ batchId: bObjId }, { batchId: String(batchId) }] }];
      }
      if (from || to) {
        query.date = {};
        if (from) query.date.$gte = from as string;
        if (to) query.date.$lte = to as string;
      }

      const logs = await DailyLogModel.find(query)
        .sort({ date: -1 })
        .populate('recordedBy', 'name role')
        .populate('batchId', 'name breed type');

      return ResponseView.success(res, logs);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Create daily log entry
  static async createLog(req: AuthRequest, res: Response) {
    try {
      const parseResult = dailyLogSchema.safeParse(req.body);
      if (!parseResult.success) {
        return ResponseView.error(res, 'Validation failed', 400, parseResult.error.format());
      }

      const { batchId, date, eggCount, brokenEggCount, deadCount, feedGivenKg, waterGivenLiters, medicineGiven, notes } = parseResult.data;

      // Verify batch belongs to firm
      const batch = await BatchModel.findOne({ _id: batchId, farmId: req.farmId });
      if (!batch) {
        return ResponseView.notFound(res, 'Selected flock/batch not found');
      }

      // Check duplicate log for same date & batch
      const existingLog = await DailyLogModel.findOne({ farmId: req.farmId, batchId, date });
      if (existingLog) {
        return ResponseView.error(res, `A daily log entry already exists for batch '${batch.name}' on ${date}`, 409);
      }

      // Check feed stock availability
      if (feedGivenKg > 0) {
        const feedStockAgg = await FeedStockModel.aggregate([
          { $match: { farmId: new mongoose.Types.ObjectId(req.farmId as string) } },
          { $group: { _id: null, totalKg: { $sum: '$totalKg' } } }
        ]);
        const totalStockKg = feedStockAgg[0]?.totalKg || 0;

        const loggedFeedAgg = await DailyLogModel.aggregate([
          { $match: { farmId: new mongoose.Types.ObjectId(req.farmId as string) } },
          { $group: { _id: null, sum: { $sum: '$feedGivenKg' } } }
        ]);
        const totalUsedKg = loggedFeedAgg[0]?.sum || 0;
        const availableStockKg = Math.max(0, totalStockKg - totalUsedKg);

        if (totalStockKg > 0 && feedGivenKg > availableStockKg) {
          const availBags = (availableStockKg / 50).toFixed(1);
          return ResponseView.error(res, `Invalid Feed Amount! You entered ${feedGivenKg} kg feed, but available Store Feed Stock is only ${availableStockKg.toLocaleString()} kg (${availBags} Bags). Please add feed stock first.`);
        }
      }

      const log = new DailyLogModel({
        farmId: req.farmId,
        batchId,
        date,
        eggCount,
        brokenEggCount,
        deadCount,
        feedGivenKg,
        waterGivenLiters,
        medicineGiven,
        recordedBy: req.user?.userId,
        notes
      });

      await log.save();

      // Auto-update mortality count on batch
      if (deadCount > 0) {
        batch.currentCount = Math.max(0, batch.currentCount - deadCount);
        await batch.save();
      }

      return ResponseView.created(res, log);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Update daily log entry
  static async updateLog(req: AuthRequest, res: Response) {
    try {
      const parseResult = dailyLogSchema.partial().safeParse(req.body);
      if (!parseResult.success) {
        return ResponseView.error(res, 'Validation failed', 400, parseResult.error.format());
      }

      const log = await DailyLogModel.findOne({ _id: req.params.id, farmId: req.farmId });
      if (!log) {
        return ResponseView.notFound(res, 'Daily log record not found');
      }

      const oldDead = log.deadCount || 0;
      const { eggCount, brokenEggCount, deadCount, feedGivenKg, waterGivenLiters, medicineGiven, notes } = parseResult.data;

      // Check feed stock if updated
      if (feedGivenKg !== undefined && feedGivenKg > 0) {
        const feedStockAgg = await FeedStockModel.aggregate([
          { $match: { farmId: new mongoose.Types.ObjectId(req.farmId as string) } },
          { $group: { _id: null, totalKg: { $sum: '$totalKg' } } }
        ]);
        const totalStockKg = feedStockAgg[0]?.totalKg || 0;

        const loggedFeedAgg = await DailyLogModel.aggregate([
          { $match: { farmId: new mongoose.Types.ObjectId(req.farmId as string), _id: { $ne: log._id } } },
          { $group: { _id: null, sum: { $sum: '$feedGivenKg' } } }
        ]);
        const otherUsedKg = loggedFeedAgg[0]?.sum || 0;
        const availableStockKg = Math.max(0, totalStockKg - otherUsedKg);

        if (totalStockKg > 0 && feedGivenKg > availableStockKg) {
          const availBags = (availableStockKg / 50).toFixed(1);
          return ResponseView.error(res, `Invalid Feed Amount! You entered ${feedGivenKg} kg feed, but available Store Feed Stock is only ${availableStockKg.toLocaleString()} kg (${availBags} Bags).`);
        }
      }

      const newDead = deadCount !== undefined ? Number(deadCount) : oldDead;
      const deadDiff = newDead - oldDead;

      if (deadDiff !== 0 && log.batchId) {
        const batch = await BatchModel.findOne({ _id: log.batchId, farmId: req.farmId });
        if (batch) {
          batch.currentCount = Math.max(0, batch.currentCount - deadDiff);
          await batch.save();
        }
      }

      if (eggCount !== undefined) log.eggCount = Number(eggCount);
      if (brokenEggCount !== undefined) log.brokenEggCount = Number(brokenEggCount);
      if (deadCount !== undefined) log.deadCount = Number(deadCount);
      if (feedGivenKg !== undefined) log.feedGivenKg = Number(feedGivenKg);
      if (waterGivenLiters !== undefined) log.waterGivenLiters = Number(waterGivenLiters);
      if (medicineGiven !== undefined) log.medicineGiven = medicineGiven;
      if (notes !== undefined) log.notes = notes;

      await log.save();
      return ResponseView.success(res, log);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Delete daily log entry
  static async deleteLog(req: AuthRequest, res: Response) {
    try {
      const log = await DailyLogModel.findOne({ _id: req.params.id, farmId: req.farmId });
      if (!log) {
        return ResponseView.notFound(res, 'Daily log record not found');
      }

      if (log.deadCount > 0 && log.batchId) {
        const batch = await BatchModel.findOne({ _id: log.batchId, farmId: req.farmId });
        if (batch) {
          batch.currentCount += log.deadCount;
          await batch.save();
        }
      }

      await DailyLogModel.deleteOne({ _id: req.params.id, farmId: req.farmId });
      return ResponseView.success(res, { message: 'Daily log entry deleted successfully' });
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }
}
