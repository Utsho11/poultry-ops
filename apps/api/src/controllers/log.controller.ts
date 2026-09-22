import { Response } from 'express';
import mongoose from 'mongoose';
import { dailyLogSchema } from '@poultry-ops/validation';
import { DailyLogModel, BatchModel, FeedStockModel, ExpenseModel } from '../models/schemas';
import { AuthRequest } from '../middleware/auth';
import { ResponseView } from '../views/response.view';

export class LogController {
  // Get daily logs for active Firm
  static async getLogs(req: AuthRequest, res: Response) {
    try {
      const { batchId, from, to, page, limit } = req.query;
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

      let logQuery = DailyLogModel.find(query)
        .sort({ date: -1 })
        .populate('recordedBy', 'name role')
        .populate('batchId', 'name breed type');

      if (limit) {
        const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
        const pageNum = Math.max(1, parseInt(page as string) || 1);
        logQuery = logQuery.skip((pageNum - 1) * limitNum).limit(limitNum);
      }

      const logs = await logQuery;
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

      // Check that log date is not earlier than batch start date
      const batchStartDateStr = new Date(batch.startDate).toISOString().split('T')[0];
      if (date < batchStartDateStr) {
        return ResponseView.error(
          res,
          `Log date (${date}) cannot be earlier than flock start date (${batchStartDateStr})`,
          400
        );
      }

      // Check duplicate log for same date & batch
      const existingLog = await DailyLogModel.findOne({ farmId: req.farmId, batchId, date });
      if (existingLog) {
        return ResponseView.error(res, `A daily log entry already exists for batch '${batch.name}' on ${date}`, 409);
      }

      // Check feed stock availability (combining FeedStock deliveries and Feed Expenses)
      if (feedGivenKg > 0) {
        const [feedStockAgg, feedExpenseAgg] = await Promise.all([
          FeedStockModel.aggregate([
            { $match: { farmId: new mongoose.Types.ObjectId(req.farmId as string) } },
            { $group: { _id: null, totalKg: { $sum: '$totalKg' } } }
          ]),
          ExpenseModel.aggregate([
            { $match: { farmId: new mongoose.Types.ObjectId(req.farmId as string), category: 'feed' } },
            { $group: { _id: null, totalKg: { $sum: { $ifNull: ['$feedKg', { $multiply: ['$feedBags', 50] }] } } } }
          ])
        ]);
        const totalStockKg = (feedStockAgg[0]?.totalKg || 0) + (feedExpenseAgg[0]?.totalKg || 0);

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

      // Auto-update mortality count and lastLogDate on batch
      let batchModified = false;
      if (deadCount > 0) {
        batch.currentCount = Math.max(0, batch.currentCount - deadCount);
        batchModified = true;
      }
      if (!batch.lastLogDate || date > batch.lastLogDate) {
        batch.lastLogDate = date;
        batchModified = true;
      }
      if (batchModified) {
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

      // Restrict workers to editing logs entered today; managers and owners can edit historical logs
      const todayStr = new Date().toISOString().split('T')[0];
      if (req.user?.role === 'worker' && log.date !== todayStr) {
        return ResponseView.forbidden(res, 'Workers can only edit daily logs on the day of entry. Please ask a manager or owner.');
      }

      const oldDead = log.deadCount || 0;
      const { date, eggCount, brokenEggCount, deadCount, feedGivenKg, waterGivenLiters, medicineGiven, notes } = parseResult.data;

      // Validate date against batch start date if updated
      if (date && date !== log.date && log.batchId) {
        const batch = await BatchModel.findOne({ _id: log.batchId, farmId: req.farmId });
        if (batch && batch.startDate) {
          const batchStartDateStr = new Date(batch.startDate).toISOString().split('T')[0];
          if (date < batchStartDateStr) {
            return ResponseView.error(res, `Log date (${date}) cannot be earlier than flock start date (${batchStartDateStr})`, 400);
          }
        }
        log.date = date;
      }

      // Check feed stock if updated (combining FeedStock deliveries and Feed Expenses)
      if (feedGivenKg !== undefined && feedGivenKg > 0) {
        const [feedStockAgg, feedExpenseAgg] = await Promise.all([
          FeedStockModel.aggregate([
            { $match: { farmId: new mongoose.Types.ObjectId(req.farmId as string) } },
            { $group: { _id: null, totalKg: { $sum: '$totalKg' } } }
          ]),
          ExpenseModel.aggregate([
            { $match: { farmId: new mongoose.Types.ObjectId(req.farmId as string), category: 'feed' } },
            { $group: { _id: null, totalKg: { $sum: { $ifNull: ['$feedKg', { $multiply: ['$feedBags', 50] }] } } } }
          ])
        ]);
        const totalStockKg = (feedStockAgg[0]?.totalKg || 0) + (feedExpenseAgg[0]?.totalKg || 0);

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

      await DailyLogModel.deleteOne({ _id: req.params.id, farmId: req.farmId });

      if (log.batchId) {
        const batch = await BatchModel.findOne({ _id: log.batchId, farmId: req.farmId });
        if (batch) {
          if (log.deadCount > 0) {
            batch.currentCount += log.deadCount;
          }
          // Re-sync latest log date for this batch
          const latestLog = await DailyLogModel.findOne({ farmId: req.farmId, batchId: log.batchId }).sort({ date: -1 });
          batch.lastLogDate = latestLog?.date || undefined;
          await batch.save();
        }
      }

      return ResponseView.success(res, { message: 'Daily log entry deleted successfully' });
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }
}
