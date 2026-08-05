import { Router, Response } from 'express';
import { dailyLogSchema } from '@poultry-ops/validation';
import { DailyLogModel, BatchModel, ExpenseModel } from '../models/schemas';
import { authenticate, AuthRequest } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

// Get daily logs for a batch (or all batches)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { batchId, from, to } = req.query;
    const query: any = { farmId: req.farmId };

    if (batchId) query.batchId = batchId;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = from;
      if (to) query.date.$lte = to;
    }

    const logs = await DailyLogModel.find(query).sort({ date: -1 }).populate('recordedBy', 'name role');
    return res.json(logs);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Submit daily log
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = dailyLogSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.format() });
    }

    const { batchId, date, eggCount, brokenEggCount, deadCount, feedGivenKg, waterGivenLiters, medicineGiven, notes } = parseResult.data;

    // Verify batch belongs to tenant
    const batch = await BatchModel.findOne({ _id: batchId, farmId: req.farmId });
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found or unauthorized' });
    }

    // Check if log already exists for this date + batch
    const existingLog = await DailyLogModel.findOne({ farmId: req.farmId, batchId, date });
    if (existingLog) {
      return res.status(409).json({ error: `A daily log entry already exists for batch '${batch.name}' on ${date}` });
    }

    // Check Feed Stock availability limit
    if (feedGivenKg > 0) {
      const feedStockAgg = await ExpenseModel.aggregate([
        { $match: { farmId: req.farmId, category: 'feed' } },
        {
          $group: {
            _id: null,
            totalKg: { $sum: '$feedKg' },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]);
      let totalStockKg = feedStockAgg[0]?.totalKg || 0;
      if (totalStockKg === 0 && (feedStockAgg[0]?.totalAmount || 0) > 0) {
        totalStockKg = Math.round((feedStockAgg[0].totalAmount / 2500) * 50);
      }

      // Sum all previously logged feed
      const loggedFeedAgg = await DailyLogModel.aggregate([
        { $match: { farmId: req.farmId } },
        { $group: { _id: null, sum: { $sum: '$feedGivenKg' } } }
      ]);
      const totalUsedKg = loggedFeedAgg[0]?.sum || 0;
      const availableStockKg = Math.max(0, totalStockKg - totalUsedKg);

      if (totalStockKg > 0 && feedGivenKg > availableStockKg) {
        const availBags = (availableStockKg / 50).toFixed(1);
        return res.status(400).json({
          error: `Invalid Feed Amount! You entered ${feedGivenKg} kg feed, but available Store Feed Stock is only ${availableStockKg.toLocaleString()} kg (${availBags} Bags). Please buy/add feed stock first.`
        });
      }
    }

    // Create log
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

    // Auto-update batch bird count if dead birds reported
    if (deadCount > 0) {
      batch.currentCount = Math.max(0, batch.currentCount - deadCount);
      await batch.save();
    }

    return res.status(201).json(log);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
