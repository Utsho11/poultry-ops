import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { DailyLogModel, ExpenseModel, BatchModel, HealthRecordModel } from '../models/schemas';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

// 1. Aggregated Summary Report
router.get('/summary', requireRole(['owner', 'manager']), async (req: AuthRequest, res: Response) => {
  try {
    const { batchId, from, to } = req.query;
    const farmObjectId = new mongoose.Types.ObjectId(req.farmId as string);

    const logMatch: any = { farmId: farmObjectId };
    if (batchId) logMatch.batchId = new mongoose.Types.ObjectId(batchId as string);
    if (from || to) {
      logMatch.date = {};
      if (from) logMatch.date.$gte = from;
      if (to) logMatch.date.$lte = to;
    }

    const logAgg = await DailyLogModel.aggregate([
      { $match: logMatch },
      {
        $group: {
          _id: null,
          totalEggs: { $sum: '$eggCount' },
          totalBrokenEggs: { $sum: '$brokenEggCount' },
          totalDead: { $sum: '$deadCount' },
          totalFeedKg: { $sum: '$feedGivenKg' },
          totalWaterLiters: { $sum: '$waterGivenLiters' }
        }
      }
    ]);

    const logMetrics = logAgg[0] || {
      totalEggs: 0,
      totalBrokenEggs: 0,
      totalDead: 0,
      totalFeedKg: 0,
      totalWaterLiters: 0
    };

    const expenseMatch: any = { farmId: farmObjectId };
    if (batchId) expenseMatch.batchId = new mongoose.Types.ObjectId(batchId as string);
    if (from || to) {
      expenseMatch.date = {};
      if (from) expenseMatch.date.$gte = from;
      if (to) expenseMatch.date.$lte = to;
    }

    const expenseAgg = await ExpenseModel.aggregate([
      { $match: expenseMatch },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const costByCategory: Record<string, number> = {
      feed: 0, medicine: 0, labor: 0, utility: 0, equipment: 0, other: 0
    };

    let totalCost = 0;
    expenseAgg.forEach((item) => {
      costByCategory[item._id] = item.totalAmount;
      totalCost += item.totalAmount;
    });

    const batchQuery: any = { farmId: farmObjectId };
    if (batchId) batchQuery._id = new mongoose.Types.ObjectId(batchId as string);

    const batches = await BatchModel.find(batchQuery);
    const initialBirdCount = batches.reduce((acc, b) => acc + b.initialCount, 0);
    const currentBirdCount = batches.reduce((acc, b) => acc + b.currentCount, 0);

    const mortalityRate = initialBirdCount > 0
      ? Number(((logMetrics.totalDead / initialBirdCount) * 100).toFixed(2))
      : 0;

    const costPerBird = currentBirdCount > 0
      ? Number((totalCost / currentBirdCount).toFixed(2))
      : 0;

    const costPerEgg = logMetrics.totalEggs > 0
      ? Number((totalCost / logMetrics.totalEggs).toFixed(2))
      : 0;

    const FCR = logMetrics.totalEggs > 0
      ? Number((logMetrics.totalFeedKg / (logMetrics.totalEggs / 12)).toFixed(3))
      : 0;

    return res.json({
      totalEggs: logMetrics.totalEggs,
      totalBrokenEggs: logMetrics.totalBrokenEggs,
      totalDead: logMetrics.totalDead,
      mortalityRate,
      totalFeedKg: logMetrics.totalFeedKg,
      totalWaterLiters: logMetrics.totalWaterLiters,
      totalCost,
      costByCategory,
      costPerEgg,
      costPerBird,
      feedConversionRatio: FCR,
      birdStats: { initialBirdCount, currentBirdCount }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 2. Daily Field Report (Date-by-Date Breakdown of Feed, Meds, Yield, Expenses)
router.get('/daily', requireRole(['owner', 'manager']), async (req: AuthRequest, res: Response) => {
  try {
    const { batchId, from, to } = req.query;
    const farmObjectId = new mongoose.Types.ObjectId(req.farmId as string);

    const logMatch: any = { farmId: farmObjectId };
    if (batchId) logMatch.batchId = new mongoose.Types.ObjectId(batchId as string);
    if (from || to) {
      logMatch.date = {};
      if (from) logMatch.date.$gte = from;
      if (to) logMatch.date.$lte = to;
    }

    // Daily Logs by Date
    const dailyLogs = await DailyLogModel.aggregate([
      { $match: logMatch },
      {
        $group: {
          _id: '$date',
          eggCount: { $sum: '$eggCount' },
          brokenEggCount: { $sum: '$brokenEggCount' },
          deadCount: { $sum: '$deadCount' },
          feedGivenKg: { $sum: '$feedGivenKg' },
          waterGivenLiters: { $sum: '$waterGivenLiters' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Daily Expenses by Date & Category
    const expenseMatch: any = { farmId: farmObjectId };
    if (batchId) expenseMatch.batchId = new mongoose.Types.ObjectId(batchId as string);
    if (from || to) {
      expenseMatch.date = {};
      if (from) expenseMatch.date.$gte = from;
      if (to) expenseMatch.date.$lte = to;
    }

    const dailyExpenses = await ExpenseModel.aggregate([
      { $match: expenseMatch },
      {
        $group: {
          _id: { date: '$date', category: '$category' },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    // Map daily data
    const resultMap: Record<string, any> = {};

    dailyLogs.forEach((item) => {
      const d = item._id;
      resultMap[d] = {
        date: d,
        eggCount: item.eggCount,
        brokenEggCount: item.brokenEggCount,
        deadCount: item.deadCount,
        feedGivenKg: item.feedGivenKg,
        waterGivenLiters: item.waterGivenLiters,
        feedExpense: 0,
        medicineExpense: 0,
        laborExpense: 0,
        utilityExpense: 0,
        equipmentExpense: 0,
        otherExpense: 0,
        totalExpense: 0
      };
    });

    dailyExpenses.forEach((item) => {
      const d = item._id.date;
      const cat = item._id.category;
      const amount = item.totalAmount;

      if (!resultMap[d]) {
        resultMap[d] = {
          date: d,
          eggCount: 0,
          brokenEggCount: 0,
          deadCount: 0,
          feedGivenKg: 0,
          waterGivenLiters: 0,
          feedExpense: 0,
          medicineExpense: 0,
          laborExpense: 0,
          utilityExpense: 0,
          equipmentExpense: 0,
          otherExpense: 0,
          totalExpense: 0
        };
      }

      if (cat === 'feed') resultMap[d].feedExpense += amount;
      else if (cat === 'medicine') resultMap[d].medicineExpense += amount;
      else if (cat === 'labor') resultMap[d].laborExpense += amount;
      else if (cat === 'utility') resultMap[d].utilityExpense += amount;
      else if (cat === 'equipment') resultMap[d].equipmentExpense += amount;
      else resultMap[d].otherExpense += amount;

      resultMap[d].totalExpense += amount;
    });

    const report = Object.values(resultMap).sort((a, b) => a.date.localeCompare(b.date));
    return res.json(report);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 3. Batch-Based Report (Comparative performance per batch)
router.get('/batch-breakdown', requireRole(['owner', 'manager']), async (req: AuthRequest, res: Response) => {
  try {
    const farmObjectId = new mongoose.Types.ObjectId(req.farmId as string);
    const batches = await BatchModel.find({ farmId: farmObjectId }).sort({ createdAt: -1 });

    const batchReports = await Promise.all(
      batches.map(async (batch) => {
        const batchObjId = batch._id;

        const logAgg = await DailyLogModel.aggregate([
          { $match: { farmId: farmObjectId, batchId: batchObjId } },
          {
            $group: {
              _id: null,
              totalEggs: { $sum: '$eggCount' },
              totalBrokenEggs: { $sum: '$brokenEggCount' },
              totalDead: { $sum: '$deadCount' },
              totalFeedKg: { $sum: '$feedGivenKg' },
              totalWaterLiters: { $sum: '$waterGivenLiters' }
            }
          }
        ]);

        const logs = logAgg[0] || { totalEggs: 0, totalBrokenEggs: 0, totalDead: 0, totalFeedKg: 0, totalWaterLiters: 0 };

        const expAgg = await ExpenseModel.aggregate([
          { $match: { farmId: farmObjectId, batchId: batchObjId } },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);

        const totalExpenses = expAgg[0]?.total || 0;
        const healthCount = await HealthRecordModel.countDocuments({ farmId: farmObjectId, batchId: batchObjId });

        const mortalityCount = batch.initialCount - batch.currentCount;
        const mortalityRate = batch.initialCount > 0 ? Number(((mortalityCount / batch.initialCount) * 100).toFixed(2)) : 0;
        const costPerBird = batch.currentCount > 0 ? Number((totalExpenses / batch.currentCount).toFixed(2)) : 0;
        const costPerEgg = logs.totalEggs > 0 ? Number((totalExpenses / logs.totalEggs).toFixed(2)) : 0;
        const FCR = logs.totalEggs > 0 ? Number((logs.totalFeedKg / (logs.totalEggs / 12)).toFixed(3)) : 0;

        return {
          batchId: batch._id,
          batchName: batch.name,
          breed: batch.breed,
          type: batch.type,
          shed: batch.shed || 'Main Shed',
          status: batch.status,
          startDate: batch.startDate,
          initialCount: batch.initialCount,
          currentCount: batch.currentCount,
          mortalityCount,
          mortalityRate,
          totalEggs: logs.totalEggs,
          totalBrokenEggs: logs.totalBrokenEggs,
          totalFeedKg: logs.totalFeedKg,
          totalWaterLiters: logs.totalWaterLiters,
          totalExpenses,
          costPerBird,
          costPerEgg,
          feedConversionRatio: FCR,
          healthRecordCount: healthCount
        };
      })
    );

    return res.json(batchReports);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 4. Monthly Report (Aggregated trends by YYYY-MM)
router.get('/monthly', requireRole(['owner', 'manager']), async (req: AuthRequest, res: Response) => {
  try {
    const { year } = req.query;
    const currentYear = year ? String(year) : new Date().getFullYear().toString();
    const farmObjectId = new mongoose.Types.ObjectId(req.farmId as string);

    // Monthly Logs
    const monthlyLogs = await DailyLogModel.aggregate([
      {
        $match: {
          farmId: farmObjectId,
          date: { $regex: `^${currentYear}` }
        }
      },
      {
        $group: {
          _id: { $substr: ['$date', 0, 7] }, // YYYY-MM
          totalEggs: { $sum: '$eggCount' },
          totalBrokenEggs: { $sum: '$brokenEggCount' },
          totalDead: { $sum: '$deadCount' },
          totalFeedKg: { $sum: '$feedGivenKg' },
          totalWaterLiters: { $sum: '$waterGivenLiters' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Monthly Expenses
    const monthlyExpenses = await ExpenseModel.aggregate([
      {
        $match: {
          farmId: farmObjectId,
          date: { $regex: `^${currentYear}` }
        }
      },
      {
        $group: {
          _id: {
            month: { $substr: ['$date', 0, 7] },
            category: '$category'
          },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    const resultMap: Record<string, any> = {};

    monthlyLogs.forEach((item) => {
      const m = item._id;
      resultMap[m] = {
        month: m,
        totalEggs: item.totalEggs,
        totalBrokenEggs: item.totalBrokenEggs,
        totalDead: item.totalDead,
        totalFeedKg: item.totalFeedKg,
        totalWaterLiters: item.totalWaterLiters,
        totalExpenses: 0,
        feedExpense: 0,
        medicineExpense: 0,
        laborExpense: 0,
        utilityExpense: 0,
        equipmentExpense: 0,
        otherExpense: 0,
        costPerEgg: 0,
        feedConversionRatio: 0
      };
    });

    monthlyExpenses.forEach((item) => {
      const m = item._id.month;
      const cat = item._id.category;
      const amount = item.totalAmount;

      if (!resultMap[m]) {
        resultMap[m] = {
          month: m,
          totalEggs: 0,
          totalBrokenEggs: 0,
          totalDead: 0,
          totalFeedKg: 0,
          totalWaterLiters: 0,
          totalExpenses: 0,
          feedExpense: 0,
          medicineExpense: 0,
          laborExpense: 0,
          utilityExpense: 0,
          equipmentExpense: 0,
          otherExpense: 0,
          costPerEgg: 0,
          feedConversionRatio: 0
        };
      }

      if (cat === 'feed') resultMap[m].feedExpense += amount;
      else if (cat === 'medicine') resultMap[m].medicineExpense += amount;
      else if (cat === 'labor') resultMap[m].laborExpense += amount;
      else if (cat === 'utility') resultMap[m].utilityExpense += amount;
      else if (cat === 'equipment') resultMap[m].equipmentExpense += amount;
      else resultMap[m].otherExpense += amount;

      resultMap[m].totalExpenses += amount;
    });

    // Compute derived metrics for each month
    const months = Object.values(resultMap).sort((a, b) => a.month.localeCompare(b.month));
    months.forEach((m) => {
      m.costPerEgg = m.totalEggs > 0 ? Number((m.totalExpenses / m.totalEggs).toFixed(2)) : 0;
      m.feedConversionRatio = m.totalEggs > 0 ? Number((m.totalFeedKg / (m.totalEggs / 12)).toFixed(3)) : 0;
    });

    return res.json(months);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
