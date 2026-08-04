import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { DailyLogModel, ExpenseModel, BatchModel, HealthRecordModel, SaleModel, CustomerModel } from '../models/schemas';
import { authenticate, AuthRequest } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

// Helper to construct ObjectId or fallback
function toObjectId(id: string) {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch (e) {
    return id;
  }
}

// 1. Aggregated Summary Report (All Farm Roles)
router.get('/summary', async (req: AuthRequest, res: Response) => {
  try {
    const { batchId, from, to } = req.query;
    const farmObjectId = toObjectId(req.farmId as string);

    const logMatch: any = { $or: [{ farmId: farmObjectId }, { farmId: req.farmId }] };
    if (batchId) {
      const bObjId = toObjectId(batchId as string);
      logMatch.$and = [{ $or: [{ batchId: bObjId }, { batchId: String(batchId) }] }];
    }
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

    // Calculate ALL-TIME cumulative eggs logged for farm
    const allTimeEggAgg = await DailyLogModel.aggregate([
      { $match: { $or: [{ farmId: farmObjectId }, { farmId: req.farmId }] } },
      { $group: { _id: null, sum: { $sum: '$eggCount' }, brokenSum: { $sum: '$brokenEggCount' } } }
    ]);
    const allTimeEggCount = allTimeEggAgg[0]?.sum || 0;
    const allTimeBrokenCount = allTimeEggAgg[0]?.brokenSum || 0;

    // Calculate Expenses
    const expenseMatch: any = { $or: [{ farmId: farmObjectId }, { farmId: req.farmId }] };
    if (batchId) {
      const bObjId = toObjectId(batchId as string);
      expenseMatch.$and = [{ $or: [{ batchId: bObjId }, { batchId: String(batchId) }] }];
    }
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

    // Calculate Sales & Revenue Income (Egg & Chicken)
    const saleMatch: any = { $or: [{ farmId: farmObjectId }, { farmId: req.farmId }] };
    if (batchId) {
      const bObjId = toObjectId(batchId as string);
      saleMatch.$and = [{ $or: [{ batchId: bObjId }, { batchId: String(batchId) }] }];
    }
    if (from || to) {
      saleMatch.date = {};
      if (from) saleMatch.date.$gte = from;
      if (to) saleMatch.date.$lte = to;
    }

    const salesAgg = await SaleModel.aggregate([
      { $match: saleMatch },
      {
        $group: {
          _id: '$itemType',
          totalIncome: { $sum: '$totalAmount' },
          totalQuantity: { $sum: '$quantity' }
        }
      }
    ]);

    let totalIncome = 0;
    let totalEggsSold = 0;
    let totalChickensSold = 0;

    salesAgg.forEach((item) => {
      totalIncome += item.totalIncome;
      if (item._id === 'egg') totalEggsSold = item.totalQuantity;
      if (item._id === 'chicken') totalChickensSold = item.totalQuantity;
    });

    // Current unsold egg inventory stock (Good eggs ONLY - excludes broken eggs)
    const currentEggCount = Math.max(0, (allTimeEggCount - allTimeBrokenCount) - totalEggsSold);

    // Count distinct logged days to compute average daily performance
    const distinctDaysAgg = await DailyLogModel.aggregate([
      { $match: logMatch },
      { $group: { _id: '$date' } },
      { $count: 'totalDays' }
    ]);
    const distinctLogDays = distinctDaysAgg[0]?.totalDays || 1;

    const batchQuery: any = { $or: [{ farmId: farmObjectId }, { farmId: req.farmId }] };
    if (batchId) {
      const bObjId = toObjectId(batchId as string);
      batchQuery._id = bObjId;
    }

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

    // Laying rate includes ALL produced eggs (good + broken)
    const avgDailyEggs = logMetrics.totalEggs / distinctLogDays;
    const eggLayingRate = currentBirdCount > 0
      ? Number(((avgDailyEggs / currentBirdCount) * 100).toFixed(1))
      : 0;

    const avgDailyFeedKg = logMetrics.totalFeedKg / distinctLogDays;
    const feedPerChickenGrams = currentBirdCount > 0
      ? Number(((avgDailyFeedKg * 1000) / currentBirdCount).toFixed(1))
      : 0;

    const feedPerChickenPercentage = Number(((feedPerChickenGrams / 110) * 100).toFixed(1));

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
      birdStats: { initialBirdCount, currentBirdCount },
      allTimeEggCount,
      currentEggCount,
      totalIncome,
      totalEggsSold,
      totalChickensSold,
      eggLayingRate,
      feedPerChickenGrams,
      feedPerChickenPercentage
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 2. Daily Field Report (Includes Day Count & Laying Rate)
router.get('/daily', async (req: AuthRequest, res: Response) => {
  try {
    const { batchId, from, to } = req.query;
    const farmObjectId = toObjectId(req.farmId as string);

    const logMatch: any = { $or: [{ farmId: farmObjectId }, { farmId: req.farmId }] };
    if (batchId) {
      const bObjId = toObjectId(batchId as string);
      logMatch.$and = [{ $or: [{ batchId: bObjId }, { batchId: String(batchId) }] }];
    }
    if (from || to) {
      logMatch.date = {};
      if (from) logMatch.date.$gte = from;
      if (to) logMatch.date.$lte = to;
    }

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

    const expenseMatch: any = { $or: [{ farmId: farmObjectId }, { farmId: req.farmId }] };
    if (batchId) {
      const bObjId = toObjectId(batchId as string);
      expenseMatch.$and = [{ $or: [{ batchId: bObjId }, { batchId: String(batchId) }] }];
    }
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
          amount: { $sum: '$amount' }
        }
      }
    ]);

    const saleMatch: any = { $or: [{ farmId: farmObjectId }, { farmId: req.farmId }] };
    if (batchId) {
      const bObjId = toObjectId(batchId as string);
      saleMatch.$and = [{ $or: [{ batchId: bObjId }, { batchId: String(batchId) }] }];
    }
    if (from || to) {
      saleMatch.date = {};
      if (from) saleMatch.date.$gte = from;
      if (to) saleMatch.date.$lte = to;
    }

    const dailySales = await SaleModel.aggregate([
      { $match: saleMatch },
      {
        $group: {
          _id: { date: '$date', itemType: '$itemType' },
          totalAmount: { $sum: '$totalAmount' },
          totalQuantity: { $sum: '$quantity' }
        }
      }
    ]);

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
        totalExpenses: 0,
        feedExpense: 0,
        medicineExpense: 0,
        laborExpense: 0,
        utilityExpense: 0,
        equipmentExpense: 0,
        otherExpense: 0,
        totalIncome: 0,
        eggSalesRevenue: 0,
        chickenSalesRevenue: 0,
        eggsSold: 0,
        chickensSold: 0,
        netProfit: 0
      };
    });

    dailyExpenses.forEach((item) => {
      const d = item._id.date;
      const cat = item._id.category;
      const amount = item.amount;

      if (!resultMap[d]) {
        resultMap[d] = {
          date: d,
          eggCount: 0,
          brokenEggCount: 0,
          deadCount: 0,
          feedGivenKg: 0,
          waterGivenLiters: 0,
          totalExpenses: 0,
          feedExpense: 0,
          medicineExpense: 0,
          laborExpense: 0,
          utilityExpense: 0,
          equipmentExpense: 0,
          otherExpense: 0,
          totalIncome: 0,
          eggSalesRevenue: 0,
          chickenSalesRevenue: 0,
          eggsSold: 0,
          chickensSold: 0,
          netProfit: 0
        };
      }

      if (cat === 'feed') resultMap[d].feedExpense += amount;
      else if (cat === 'medicine') resultMap[d].medicineExpense += amount;
      else if (cat === 'labor') resultMap[d].laborExpense += amount;
      else if (cat === 'utility') resultMap[d].utilityExpense += amount;
      else if (cat === 'equipment') resultMap[d].equipmentExpense += amount;
      else resultMap[d].otherExpense += amount;

      resultMap[d].totalExpenses += amount;
    });

    dailySales.forEach((item) => {
      const d = item._id.date;
      const itemType = item._id.itemType;
      const amount = item.totalAmount;
      const qty = item.totalQuantity;

      if (!resultMap[d]) {
        resultMap[d] = {
          date: d,
          eggCount: 0,
          brokenEggCount: 0,
          deadCount: 0,
          feedGivenKg: 0,
          waterGivenLiters: 0,
          totalExpenses: 0,
          feedExpense: 0,
          medicineExpense: 0,
          laborExpense: 0,
          utilityExpense: 0,
          equipmentExpense: 0,
          otherExpense: 0,
          totalIncome: 0,
          eggSalesRevenue: 0,
          chickenSalesRevenue: 0,
          eggsSold: 0,
          chickensSold: 0,
          netProfit: 0
        };
      }

      if (itemType === 'egg') {
        resultMap[d].eggSalesRevenue += amount;
        resultMap[d].eggsSold += qty;
      } else if (itemType === 'chicken') {
        resultMap[d].chickenSalesRevenue += amount;
        resultMap[d].chickensSold += qty;
      }

      resultMap[d].totalIncome += amount;
    });

    // Calculate net profit for each day
    Object.values(resultMap).forEach((item: any) => {
      item.netProfit = item.totalIncome - item.totalExpenses;
    });

    // Calculate active birds & batch start date for Day Count & Laying Rate %
    let activeBirds = 0;
    let batchStartDate: Date | string | null = null;

    if (batchId) {
      const bObjId = toObjectId(batchId as string);
      const b = await BatchModel.findOne({ _id: bObjId });
      if (b) {
        activeBirds = b.currentCount || b.initialCount;
        batchStartDate = b.startDate;
      }
    } else {
      const batches = await BatchModel.find({ $or: [{ farmId: farmObjectId }, { farmId: req.farmId }] });
      activeBirds = batches.reduce((acc, b) => acc + (b.currentCount || b.initialCount), 0);
    }

    // Sort items by date ascending first to compute rateDiff & trends
    const sortedAsc = Object.values(resultMap).sort((a: any, b: any) => a.date.localeCompare(b.date));

    let prevRate: number | null = null;
    const reportWithMetrics = sortedAsc.map((item: any) => {
      // Laying rate includes ALL produced eggs (good + broken)
      const layingRate = activeBirds > 0 ? Number(((item.eggCount / activeBirds) * 100).toFixed(1)) : 0;
      
      let dayNumber = null;
      let formattedAge = null;

      if (batchStartDate) {
        const start = new Date(batchStartDate);
        const logDate = new Date(item.date);
        start.setHours(0, 0, 0, 0);
        logDate.setHours(0, 0, 0, 0);
        const diffDays = Math.max(0, Math.floor((logDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        dayNumber = diffDays + 1;
        const w = Math.floor(diffDays / 7);
        const d = diffDays % 7;
        formattedAge = w === 0 ? `${d}d` : d === 0 ? `${w}w` : `${w}w ${d}d`;
      }

      // Calculate shift in laying percentage compared to previous day
      let rateDiff = 0;
      let rateTrend: 'up' | 'down' | 'same' = 'same';
      if (prevRate !== null) {
        rateDiff = Number((layingRate - prevRate).toFixed(1));
        if (rateDiff > 0) rateTrend = 'up';
        else if (rateDiff < 0) rateTrend = 'down';
      }
      prevRate = layingRate;

      return {
        ...item,
        eggLayingRate: layingRate,
        rateDiff,
        rateTrend,
        dayNumber,
        formattedAge
      };
    });

    // Re-sort descending (newest date first) for presentation
    const report = reportWithMetrics.sort((a, b) => b.date.localeCompare(a.date));
    return res.json(report);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 3. Batch-Based Report
router.get('/batch-breakdown', async (req: AuthRequest, res: Response) => {
  try {
    const farmObjectId = toObjectId(req.farmId as string);
    const batches = await BatchModel.find({ $or: [{ farmId: farmObjectId }, { farmId: req.farmId }] }).sort({ createdAt: -1 });

    const batchReports = await Promise.all(
      batches.map(async (batch) => {
        const bObjId = batch._id;
        const bMatch = { $or: [{ batchId: bObjId }, { batchId: String(bObjId) }] };

        const logAgg = await DailyLogModel.aggregate([
          { $match: bMatch },
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
          { $match: bMatch },
          { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalExpenses = expAgg[0]?.total || 0;

        const saleAgg = await SaleModel.aggregate([
          { $match: bMatch },
          { $group: { _id: null, totalIncome: { $sum: '$totalAmount' } } }
        ]);
        const totalIncome = saleAgg[0]?.totalIncome || 0;

        const healthCount = await HealthRecordModel.countDocuments(bMatch);

        const mortalityCount = batch.initialCount - batch.currentCount;
        const mortalityRate = batch.initialCount > 0 ? Number(((mortalityCount / batch.initialCount) * 100).toFixed(2)) : 0;
        const costPerBird = batch.currentCount > 0 ? Number((totalExpenses / batch.currentCount).toFixed(2)) : 0;
        const costPerEgg = logs.totalEggs > 0 ? Number((totalExpenses / logs.totalEggs).toFixed(2)) : 0;
        const FCR = logs.totalEggs > 0 ? Number((logs.totalFeedKg / (logs.totalEggs / 12)).toFixed(3)) : 0;

        const distinctDaysAgg = await DailyLogModel.aggregate([
          { $match: bMatch },
          { $group: { _id: '$date' } },
          { $count: 'totalDays' }
        ]);
        const distinctLogDays = distinctDaysAgg[0]?.totalDays || 1;

        const avgDailyEggs = logs.totalEggs / distinctLogDays;
        const avgDailyFeedKg = logs.totalFeedKg / distinctLogDays;

        const eggLayingRate = batch.currentCount > 0
          ? Number(((avgDailyEggs / batch.currentCount) * 100).toFixed(1))
          : 0;

        const feedPerChickenGrams = batch.currentCount > 0
          ? Number(((avgDailyFeedKg * 1000) / batch.currentCount).toFixed(1))
          : 0;

        const feedPerChickenPercentage = Number(((feedPerChickenGrams / 110) * 100).toFixed(1));

        // Batch Age calculation in Weeks and Days
        const start = new Date(batch.startDate);
        const now = new Date();
        start.setHours(0, 0, 0, 0);
        now.setHours(0, 0, 0, 0);
        const diffDays = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        const ageWeeks = Math.floor(diffDays / 7);
        const ageDays = diffDays % 7;
        const dayNumber = diffDays + 1;
        const formattedAge = ageWeeks === 0 ? `${ageDays} days` : ageDays === 0 ? `${ageWeeks} weeks` : `${ageWeeks} weeks, ${ageDays} days`;

        return {
          batchId: batch._id,
          batchName: batch.name,
          breed: batch.breed,
          type: batch.type,
          shed: batch.shed || 'Main Shed',
          status: batch.status,
          startDate: batch.startDate,
          ageWeeks,
          ageDays,
          dayNumber,
          formattedAge,
          initialCount: batch.initialCount,
          currentCount: batch.currentCount,
          mortalityCount,
          mortalityRate,
          totalEggs: logs.totalEggs,
          totalBrokenEggs: logs.totalBrokenEggs,
          totalFeedKg: logs.totalFeedKg,
          totalWaterLiters: logs.totalWaterLiters,
          totalExpenses,
          totalIncome,
          netProfit: totalIncome - totalExpenses,
          costPerBird,
          costPerEgg,
          feedConversionRatio: FCR,
          eggLayingRate,
          feedPerChickenGrams,
          feedPerChickenPercentage,
          healthRecordCount: healthCount
        };
      })
    );

    return res.json(batchReports);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 4. Dedicated Batch-Wise Dashboard Endpoint (6 Sections)
router.get('/batch-dashboard/:batchId', async (req: AuthRequest, res: Response) => {
  try {
    const farmObjectId = toObjectId(req.farmId as string);
    const batchObjectId = toObjectId(req.params.batchId);

    const batch = await BatchModel.findOne({
      _id: batchObjectId,
      $or: [{ farmId: farmObjectId }, { farmId: req.farmId }]
    });

    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const bMatch = {
      $and: [
        { $or: [{ farmId: farmObjectId }, { farmId: req.farmId }] },
        { $or: [{ batchId: batchObjectId }, { batchId: String(req.params.batchId) }] }
      ]
    };

    // Calculate Batch Age in Weeks and Days
    const start = new Date(batch.startDate);
    const now = new Date();
    start.setHours(0, 0, 0, 0);
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.max(0, Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const ageWeeks = Math.floor(diffDays / 7);
    const ageDays = diffDays % 7;
    const dayNumber = diffDays + 1;
    const formattedAge = ageWeeks === 0 ? `${ageDays} days` : ageDays === 0 ? `${ageWeeks} weeks` : `${ageWeeks} weeks, ${ageDays} days`;

    const batchWithAge = {
      ...batch.toObject(),
      ageWeeks,
      ageDays,
      dayNumber,
      formattedAge
    };

    // Daily Logs aggregation for batch
    const logAgg = await DailyLogModel.aggregate([
      { $match: bMatch },
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

    // Expenses aggregation by category for batch
    const expenseAgg = await ExpenseModel.aggregate([
      { $match: bMatch },
      { $group: { _id: '$category', totalAmount: { $sum: '$amount' } } }
    ]);

    const costByCategory: Record<string, number> = {
      feed: 0, medicine: 0, labor: 0, utility: 0, equipment: 0, other: 0
    };
    let totalExpenses = 0;
    expenseAgg.forEach((item) => {
      costByCategory[item._id] = item.totalAmount;
      totalExpenses += item.totalAmount;
    });

    // Sales aggregation for batch
    const salesAgg = await SaleModel.aggregate([
      { $match: bMatch },
      {
        $group: {
          _id: '$itemType',
          totalIncome: { $sum: '$totalAmount' },
          totalQuantity: { $sum: '$quantity' }
        }
      }
    ]);

    let totalIncome = 0;
    let totalEggsSold = 0;
    let totalChickensSold = 0;

    salesAgg.forEach((item) => {
      totalIncome += item.totalIncome;
      if (item._id === 'egg') totalEggsSold = item.totalQuantity;
      if (item._id === 'chicken') totalChickensSold = item.totalQuantity;
    });

    // Distinct logging days for averages
    const distinctDaysAgg = await DailyLogModel.aggregate([
      { $match: bMatch },
      { $group: { _id: '$date' } },
      { $count: 'totalDays' }
    ]);
    const distinctLogDays = distinctDaysAgg[0]?.totalDays || 1;

    const mortalityCount = batch.initialCount - batch.currentCount;
    const mortalityRate = batch.initialCount > 0 ? Number(((mortalityCount / batch.initialCount) * 100).toFixed(2)) : 0;
    const costPerBird = batch.currentCount > 0 ? Number((totalExpenses / batch.currentCount).toFixed(2)) : 0;
    const costPerEgg = logs.totalEggs > 0 ? Number((totalExpenses / logs.totalEggs).toFixed(2)) : 0;
    const FCR = logs.totalEggs > 0 ? Number((logs.totalFeedKg / (logs.totalEggs / 12)).toFixed(3)) : 0;

    // Laying rate includes ALL produced eggs (good + broken)
    const avgDailyEggs = logs.totalEggs / distinctLogDays;
    const avgDailyFeedKg = logs.totalFeedKg / distinctLogDays;

    const eggLayingRate = batch.currentCount > 0
      ? Number(((avgDailyEggs / batch.currentCount) * 100).toFixed(1))
      : 0;

    const feedPerChickenGrams = batch.currentCount > 0
      ? Number(((avgDailyFeedKg * 1000) / batch.currentCount).toFixed(1))
      : 0;

    const feedPerChickenPercentage = Number(((feedPerChickenGrams / 110) * 100).toFixed(1));

    // Daily trend history for this batch
    const dailyLogs = await DailyLogModel.find(bMatch)
      .sort({ date: -1 })
      .limit(14);

    const recentSales = await SaleModel.find(bMatch)
      .sort({ date: -1 })
      .limit(5);

    const recentExpenses = await ExpenseModel.find(bMatch)
      .sort({ date: -1 })
      .limit(5);

    return res.json({
      batch: batchWithAge,
      eggSection: {
        totalEggs: logs.totalEggs,
        totalBrokenEggs: logs.totalBrokenEggs,
        goodEggs: Math.max(0, logs.totalEggs - logs.totalBrokenEggs),
        eggLayingRate
      },
      mortalitySection: {
        totalDead: logs.totalDead,
        mortalityCount,
        mortalityRate,
        initialCount: batch.initialCount,
        currentCount: batch.currentCount
      },
      expenseSection: {
        totalExpenses,
        costByCategory,
        costPerBird,
        costPerEgg,
        recentExpenses
      },
      sellSection: {
        totalEggsSold,
        totalChickensSold,
        recentSales
      },
      incomeSection: {
        totalIncome,
        totalExpenses,
        netProfit: totalIncome - totalExpenses,
        profitMargin: totalIncome > 0 ? Number((((totalIncome - totalExpenses) / totalIncome) * 100).toFixed(1)) : 0
      },
      foodSection: {
        totalFeedKg: logs.totalFeedKg,
        totalWaterLiters: logs.totalWaterLiters,
        feedPerChickenGrams,
        feedPerChickenPercentage,
        feedConversionRatio: FCR
      },
      dailyLogs
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// 5. Dues & Customer Outstanding Summary Report
router.get('/dues', async (req: AuthRequest, res: Response) => {
  try {
    const customersWithDue = await CustomerModel.find({
      farmId: req.farmId,
      totalDue: { $gt: 0 }
    }).sort({ totalDue: -1 });

    const totalOutstandingDue = customersWithDue.reduce((sum, c) => sum + c.totalDue, 0);
    const topDueCustomers = customersWithDue.slice(0, 5);

    return res.json({
      totalOutstandingDue: Number(totalOutstandingDue.toFixed(2)),
      customerCountWithDue: customersWithDue.length,
      topDueCustomers,
      customers: customersWithDue
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
