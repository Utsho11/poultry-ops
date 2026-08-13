import { Response } from 'express';
import mongoose from 'mongoose';
import { DailyLogModel, ExpenseModel, BatchModel, SaleModel, FeedStockModel, HealthRecordModel, PaymentModel } from '../models/schemas';
import { AuthRequest } from '../middleware/auth';
import { ResponseView } from '../views/response.view';

function toObjectId(id: string) {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch (e) {
    return id;
  }
}

interface FeedLot {
  date: string;
  totalKg: number;
  remainingKg: number;
  costPerKg: number;
}

/**
 * Calculates feed expense using FIFO (First-In, First-Out) inventory costing.
 * Fetches all feed purchases (from FeedStock or Expense category 'feed') sorted by date ASC.
 * Consumes feed lot by lot starting from the oldest available stock.
 */
async function calculateFifoFeedCost(
  farmId: any,
  targetBatchId?: string,
  dateFrom?: string,
  dateTo?: string
): Promise<{ totalFeedExpense: number; avgCostPerKg: number }> {
  const farmObjectId = toObjectId(farmId as string);

  // 1. Fetch all feed purchases for the farm sorted by date ASC (oldest first)
  const feedStockRecords = await FeedStockModel.find({
    $or: [{ farmId: farmObjectId }, { farmId }]
  }).sort({ date: 1, createdAt: 1 });

  const feedExpenseRecords = await ExpenseModel.find({
    $or: [{ farmId: farmObjectId }, { farmId }],
    category: 'feed'
  }).sort({ date: 1, createdAt: 1 });

  const lots: FeedLot[] = [];

  feedStockRecords.forEach(fs => {
    const costPerKg = fs.totalKg > 0 ? fs.totalCost / fs.totalKg : (fs.bagPrice ? fs.bagPrice / 50 : 50);
    lots.push({
      date: fs.date,
      totalKg: fs.totalKg,
      remainingKg: fs.totalKg,
      costPerKg
    });
  });

  feedExpenseRecords.forEach(fe => {
    const kg = fe.feedKg || (fe.feedBags ? fe.feedBags * 50 : 0);
    if (kg > 0) {
      const costPerKg = fe.amount / kg;
      lots.push({
        date: fe.date,
        totalKg: kg,
        remainingKg: kg,
        costPerKg
      });
    }
  });

  lots.sort((a, b) => a.date.localeCompare(b.date));

  // If no purchase records exist, fallback to ৳50 / kg
  if (lots.length === 0) {
    const defaultCostPerKg = 50;
    const logMatch: any = { $or: [{ farmId: farmObjectId }, { farmId }] };
    if (targetBatchId) {
      const bObjId = toObjectId(targetBatchId);
      logMatch.$and = [{ $or: [{ batchId: bObjId }, { batchId: String(targetBatchId) }] }];
    }
    if (dateFrom || dateTo) {
      logMatch.date = {};
      if (dateFrom) logMatch.date.$gte = dateFrom;
      if (dateTo) logMatch.date.$lte = dateTo;
    }
    const logAgg = await DailyLogModel.aggregate([
      { $match: logMatch },
      { $group: { _id: null, totalKg: { $sum: '$feedGivenKg' } } }
    ]);
    const totalKg = logAgg[0]?.totalKg || 0;
    return {
      totalFeedExpense: Math.round(totalKg * defaultCostPerKg),
      avgCostPerKg: defaultCostPerKg
    };
  }

  // 2. Fetch all daily logs across the farm chronologically by date ASC
  const allFarmLogs = await DailyLogModel.find({
    $or: [{ farmId: farmObjectId }, { farmId }]
  }).sort({ date: 1, createdAt: 1 });

  const logFifoCosts = new Map<string, number>();
  let currentLotIdx = 0;

  for (const log of allFarmLogs) {
    const logKg = log.feedGivenKg || 0;
    if (logKg <= 0) {
      logFifoCosts.set(String(log._id), 0);
      continue;
    }

    let neededKg = logKg;
    let logCost = 0;

    while (neededKg > 0 && currentLotIdx < lots.length) {
      const currentLot = lots[currentLotIdx];
      if (currentLot.remainingKg <= 0) {
        currentLotIdx++;
        continue;
      }

      const takeKg = Math.min(neededKg, currentLot.remainingKg);
      logCost += takeKg * currentLot.costPerKg;
      currentLot.remainingKg -= takeKg;
      neededKg -= takeKg;

      if (currentLot.remainingKg <= 0) {
        currentLotIdx++;
      }
    }

    if (neededKg > 0) {
      const lastPrice = lots[lots.length - 1]?.costPerKg || 50;
      logCost += neededKg * lastPrice;
    }

    logFifoCosts.set(String(log._id), logCost);
  }

  // 3. Filter target logs if targetBatchId or date filters are provided
  let filteredTotalCost = 0;
  let filteredTotalKg = 0;

  for (const log of allFarmLogs) {
    let match = true;
    if (targetBatchId) {
      const bStr = String(targetBatchId);
      const logBStr = String(log.batchId);
      if (logBStr !== bStr) match = false;
    }
    if (dateFrom && log.date < dateFrom) match = false;
    if (dateTo && log.date > dateTo) match = false;

    if (match) {
      const cost = logFifoCosts.get(String(log._id)) || 0;
      filteredTotalCost += cost;
      filteredTotalKg += log.feedGivenKg || 0;
    }
  }

  const effectiveAvgCost = filteredTotalKg > 0 ? filteredTotalCost / filteredTotalKg : (lots[lots.length - 1]?.costPerKg || 50);

  return {
    totalFeedExpense: Math.round(filteredTotalCost),
    avgCostPerKg: Number(effectiveAvgCost.toFixed(2))
  };
}

export class ReportController {
  // 1. Aggregated Summary Report
  static async getSummaryReport(req: AuthRequest, res: Response) {
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

      const allTimeEggAgg = await DailyLogModel.aggregate([
        { $match: { $or: [{ farmId: farmObjectId }, { farmId: req.farmId }] } },
        { $group: { _id: null, sum: { $sum: '$eggCount' }, brokenSum: { $sum: '$brokenEggCount' } } }
      ]);
      const allTimeEggCount = allTimeEggAgg[0]?.sum || 0;
      const allTimeBrokenCount = allTimeEggAgg[0]?.brokenSum || 0;

      const { totalFeedExpense: calculatedFeedExpense, avgCostPerKg: avgFeedCostPerKg } = await calculateFifoFeedCost(
        req.farmId,
        batchId ? String(batchId) : undefined,
        from ? String(from) : undefined,
        to ? String(to) : undefined
      );

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
            total: { $sum: '$amount' }
          }
        }
      ]);

      const costByCategory: Record<string, number> = {
        feed: calculatedFeedExpense,
        medicine: 0,
        labor: 0,
        utility: 0,
        equipment: 0,
        other: 0
      };

      expenseAgg.forEach((item) => {
        if (item._id && costByCategory[item._id] !== undefined) {
          costByCategory[item._id] += item.total;
        }
      });

      const totalOtherCost = Object.entries(costByCategory)
        .filter(([cat]) => cat !== 'feed')
        .reduce((sum, [, val]) => sum + val, 0);

      const totalCost = calculatedFeedExpense + totalOtherCost;

      const batchMatch: any = { $or: [{ farmId: farmObjectId }, { farmId: req.farmId }], status: 'active' };
      if (batchId) {
        const bObjId = toObjectId(batchId as string);
        batchMatch._id = bObjId;
      }

      const batches = await BatchModel.find(batchMatch);
      const totalInitialBirds = batches.reduce((sum, b) => sum + b.initialCount, 0);
      const totalCurrentBirds = batches.reduce((sum, b) => sum + b.currentCount, 0);

      const mortalityRate = totalInitialBirds > 0
        ? Number(((logMetrics.totalDead / totalInitialBirds) * 100).toFixed(2))
        : 0;

      const costPerEgg = logMetrics.totalEggs > 0
        ? Number((totalCost / logMetrics.totalEggs).toFixed(2))
        : 0;

      const costPerBird = totalCurrentBirds > 0
        ? Number((totalCost / totalCurrentBirds).toFixed(2))
        : 0;

      const feedStockAgg = await FeedStockModel.aggregate([
        { $match: { $or: [{ farmId: farmObjectId }, { farmId: req.farmId }] } },
        { $group: { _id: null, totalKg: { $sum: '$totalKg' }, totalBags: { $sum: '$bags' }, totalCost: { $sum: '$totalCost' } } }
      ]);
      const purchasedFeedKg = feedStockAgg[0]?.totalKg || 0;
      const purchasedFeedBags = feedStockAgg[0]?.totalBags || 0;

      const allLogsAgg = await DailyLogModel.aggregate([
        { $match: { $or: [{ farmId: farmObjectId }, { farmId: req.farmId }] } },
        { $group: { _id: null, totalUsedKg: { $sum: '$feedGivenKg' } } }
      ]);
      const totalUsedFeedKg = allLogsAgg[0]?.totalUsedKg || 0;
      const availableFeedStockKg = Math.max(0, purchasedFeedKg - totalUsedFeedKg);
      const availableFeedStockBags = Number((availableFeedStockKg / 50).toFixed(1));

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

      const sales = await SaleModel.find(saleMatch);
      let totalIncome = 0;
      let totalEggsSold = 0;
      let totalChickensSold = 0;

      sales.forEach((s) => {
        totalIncome += s.totalAmount || 0;
        if (s.items && s.items.length > 0) {
          s.items.forEach(item => {
            if (item.type === 'egg') totalEggsSold += item.quantity || 0;
            if (item.type === 'chicken') totalChickensSold += item.birdCount || item.quantity || 0;
          });
        } else {
          if (s.itemType === 'egg') totalEggsSold += s.quantity || 0;
          if (s.itemType === 'chicken') totalChickensSold += s.quantity || 0;
        }
      });

      const currentEggCount = Math.max(0, allTimeEggCount - allTimeBrokenCount - totalEggsSold);

      const eggLayingRate = totalCurrentBirds > 0
        ? Number(((logMetrics.totalEggs / totalCurrentBirds) * 100).toFixed(1))
        : 0;

      const feedPerChickenGrams = totalCurrentBirds > 0
        ? Math.round((logMetrics.totalFeedKg * 1000) / totalCurrentBirds)
        : 0;

      const feedPerChickenPercentage = Number(((feedPerChickenGrams / 110) * 100).toFixed(1));

      return ResponseView.success(res, {
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
        allTimeEggCount,
        currentEggCount,
        purchasedFeedKg,
        purchasedFeedBags,
        availableFeedStockKg,
        availableFeedStockBags,
        totalIncome,
        totalEggsSold,
        totalChickensSold,
        totalCurrentBirds,
        eggLayingRate,
        feedPerChickenGrams,
        feedPerChickenPercentage
      });
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // 2. Date-wise Daily Report
  static async getDailyReport(req: AuthRequest, res: Response) {
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

      const dailySales = await SaleModel.find(saleMatch);
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

        resultMap[d].totalExpenses += amount;
        if (cat === 'feed') resultMap[d].feedExpense += amount;
        else if (cat === 'medicine') resultMap[d].medicineExpense += amount;
        else if (cat === 'labor') resultMap[d].laborExpense += amount;
        else if (cat === 'utility') resultMap[d].utilityExpense += amount;
        else if (cat === 'equipment') resultMap[d].equipmentExpense += amount;
        else resultMap[d].otherExpense += amount;
      });

      dailySales.forEach((sale) => {
        const d = sale.date;
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

        resultMap[d].totalIncome += sale.totalAmount || 0;

        if (sale.items && sale.items.length > 0) {
          sale.items.forEach(item => {
            if (item.type === 'egg') {
              resultMap[d].eggSalesRevenue += item.subtotal || 0;
              resultMap[d].eggsSold += item.quantity || 0;
            } else if (item.type === 'chicken') {
              resultMap[d].chickenSalesRevenue += item.subtotal || 0;
              resultMap[d].chickensSold += item.birdCount || item.quantity || 0;
            }
          });
        }
      });

      const reportList = Object.values(resultMap).sort((a, b) => b.date.localeCompare(a.date));
      reportList.forEach((entry: any) => {
        entry.netProfit = entry.totalIncome - entry.totalExpenses;
      });

      return ResponseView.success(res, reportList);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // 3. Batch Dashboard Metrics
  static async getBatchDashboard(req: AuthRequest, res: Response) {
    try {
      const { batchId } = req.params;
      const farmObjectId = toObjectId(req.farmId as string);
      const batchObjectId = toObjectId(batchId);

      const batch = await BatchModel.findOne({
        _id: { $in: [batchObjectId, batchId] },
        $or: [{ farmId: farmObjectId }, { farmId: req.farmId }]
      }).populate('assignedWorkerIds', 'name email phone role');

      if (!batch) {
        return ResponseView.notFound(res, 'Batch not found');
      }

      // Fetch batch logs
      const logs = await DailyLogModel.find({
        $or: [{ batchId: batchObjectId }, { batchId }]
      }).sort({ date: -1 });

      // Fetch batch sales
      const sales = await SaleModel.find({
        $or: [{ batchId: batchObjectId }, { batchId }]
      }).sort({ date: -1 });

      // Fetch batch expenses
      const expenses = await ExpenseModel.find({
        $or: [{ batchId: batchObjectId }, { batchId }]
      }).sort({ date: -1 });

      // Aggregations
      let totalEggs = 0;
      let totalBrokenEggs = 0;
      let totalDead = 0;
      let totalFeedKg = 0;
      let totalWaterLiters = 0;

      logs.forEach(l => {
        totalEggs += l.eggCount || 0;
        totalBrokenEggs += l.brokenEggCount || 0;
        totalDead += l.deadCount || 0;
        totalFeedKg += l.feedGivenKg || 0;
        totalWaterLiters += l.waterGivenLiters || 0;
      });

      let totalIncome = 0;
      let totalEggsSold = 0;
      let totalChickensSold = 0;

      sales.forEach(s => {
        totalIncome += s.totalAmount || 0;
        if (s.items && s.items.length > 0) {
          s.items.forEach(item => {
            if (item.type === 'egg') totalEggsSold += item.quantity || 0;
            if (item.type === 'chicken') totalChickensSold += item.birdCount || item.quantity || 0;
          });
        } else {
          if (s.itemType === 'egg') totalEggsSold += s.quantity || 0;
          if (s.itemType === 'chicken') totalChickensSold += s.quantity || 0;
        }
      });

      let totalExpenses = 0;
      expenses.forEach(e => {
        totalExpenses += e.amount || 0;
      });

      const { totalFeedExpense: calculatedFeedExpense, avgCostPerKg: avgFeedCostPerKg } = await calculateFifoFeedCost(
        req.farmId,
        batchId
      );
      const grandTotalCost = totalExpenses + calculatedFeedExpense;

      const mortalityRate = batch.initialCount > 0
        ? Number(((totalDead / batch.initialCount) * 100).toFixed(2))
        : 0;

      const eggLayingRate = batch.currentCount > 0
        ? Number(((totalEggs / batch.currentCount) * 100).toFixed(1))
        : 0;

      const costPerEgg = totalEggs > 0 ? Number((grandTotalCost / totalEggs).toFixed(2)) : 0;

      const latestLog = logs[0];
      const latestLogSection = {
        date: latestLog?.date || 'N/A',
        totalEggs: latestLog?.eggCount || 0,
        brokenEggs: latestLog?.brokenEggCount || 0,
        layingRate: eggLayingRate,
        feedKg: latestLog?.feedGivenKg || 0,
        feedPerBirdGrams: batch.currentCount > 0 ? Math.round(((latestLog?.feedGivenKg || 0) * 1000) / batch.currentCount) : 0,
        waterLiters: latestLog?.waterGivenLiters || 0,
        deadCount: latestLog?.deadCount || 0
      };

      const eggSection = {
        totalEggs,
        totalBrokenEggs,
        eggLayingRate,
        goodEggs: Math.max(0, totalEggs - totalBrokenEggs)
      };

      const mortalitySection = {
        totalDead,
        mortalityRate,
        currentCount: batch.currentCount,
        initialCount: batch.initialCount
      };

      const expenseSection = {
        totalExpenses: grandTotalCost,
        calculatedFeedExpense,
        otherExpenses: totalExpenses,
        costByCategory: {
          feed: calculatedFeedExpense,
          medicine: 0,
          labor: 0,
          utility: 0,
          equipment: 0,
          other: totalExpenses
        },
        costPerEgg,
        costPerBird: batch.currentCount > 0 ? Number((grandTotalCost / batch.currentCount).toFixed(2)) : 0
      };

      const sellSection = {
        totalEggsSold,
        totalChickensSold
      };

      const incomeSection = {
        totalIncome,
        netProfit: totalIncome - grandTotalCost
      };

      const foodSection = {
        totalFeedKg,
        totalWaterLiters,
        avgFeedPerChickenGrams: batch.currentCount > 0 ? Math.round((totalFeedKg * 1000) / batch.currentCount) : 0
      };

      return ResponseView.success(res, {
        batch,
        latestLogSection,
        eggSection,
        mortalitySection,
        expenseSection,
        sellSection,
        incomeSection,
        foodSection,
        metrics: {
          totalEggs,
          totalBrokenEggs,
          totalDead,
          totalFeedKg,
          totalWaterLiters,
          totalIncome,
          totalEggsSold,
          totalChickensSold,
          totalExpenses: grandTotalCost,
          netProfit: totalIncome - grandTotalCost,
          mortalityRate,
          eggLayingRate,
          costPerEgg
        },
        logs,
        sales,
        expenses
      });
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Unified Activity Log (Last 50 activities across the farm)
  static async getActivityLog(req: AuthRequest, res: Response) {
    try {
      const farmId = req.farmId;

      const [logs, sales, expenses, feedStocks, batches, healthRecords, payments] = await Promise.all([
        DailyLogModel.find({ farmId })
          .populate('recordedBy', 'name email')
          .populate('batchId', 'name breed')
          .sort({ createdAt: -1 })
          .limit(50),
        SaleModel.find({ farmId })
          .populate('recordedBy', 'name email')
          .populate('batchId', 'name')
          .populate('customerId', 'name phone')
          .sort({ createdAt: -1 })
          .limit(50),
        ExpenseModel.find({ farmId })
          .populate('recordedBy', 'name email')
          .populate('batchId', 'name')
          .populate('workerId', 'name')
          .sort({ createdAt: -1 })
          .limit(50),
        FeedStockModel.find({ farmId })
          .populate('recordedBy', 'name email')
          .sort({ createdAt: -1 })
          .limit(50),
        BatchModel.find({ farmId })
          .sort({ createdAt: -1 })
          .limit(50),
        HealthRecordModel.find({ farmId })
          .populate('createdBy', 'name email')
          .populate('batchId', 'name')
          .sort({ createdAt: -1 })
          .limit(50),
        PaymentModel.find({ farmId })
          .populate('recordedBy', 'name email')
          .populate('customerId', 'name phone')
          .sort({ createdAt: -1 })
          .limit(50)
      ]);

      const activities: any[] = [];

      // Map daily logs
      for (const log of logs) {
        const batchName = (log.batchId as any)?.name || 'Flock';
        const eggText = log.eggCount > 0 ? `${log.eggCount} eggs` : '';
        const feedText = log.feedGivenKg > 0 ? `${log.feedGivenKg}kg feed` : '';
        const deadText = log.deadCount > 0 ? `${log.deadCount} dead` : '';
        const details = [eggText, feedText, deadText].filter(Boolean).join(', ');

        activities.push({
          type: 'log',
          description: `Daily log recorded for ${batchName}${details ? ` (${details})` : ''}`,
          user: (log.recordedBy as any)?.name || 'Worker',
          timestamp: log.createdAt || log.date,
          metadata: { id: log._id, date: log.date, batchName }
        });
      }

      // Map sales
      for (const sale of sales) {
        const custName = sale.customerName || (sale.customerId as any)?.name || 'Walk-in Customer';
        activities.push({
          type: 'sale',
          description: `Sale invoice of ৳${sale.totalAmount.toLocaleString()} to ${custName} (${sale.status.toUpperCase()})`,
          user: (sale.recordedBy as any)?.name || 'Staff',
          timestamp: sale.createdAt || sale.date,
          metadata: { id: sale._id, amount: sale.totalAmount, status: sale.status }
        });
      }

      // Map expenses
      for (const exp of expenses) {
        const catName = exp.category.toUpperCase();
        const batchName = (exp.batchId as any)?.name ? ` for ${(exp.batchId as any).name}` : '';
        activities.push({
          type: 'expense',
          description: `Expense of ৳${exp.amount.toLocaleString()} logged (${catName}${batchName})${exp.note ? `: ${exp.note}` : ''}`,
          user: (exp.recordedBy as any)?.name || 'Staff',
          timestamp: exp.createdAt || exp.date,
          metadata: { id: exp._id, amount: exp.amount, category: exp.category }
        });
      }

      // Map feed stocks
      for (const fs of feedStocks) {
        const catFormatted = fs.category.replace(/_/g, ' ');
        activities.push({
          type: 'feed_stock',
          description: `Feed purchased: ${fs.bags} bags of ${catFormatted} (৳${fs.totalCost?.toLocaleString() || 0})`,
          user: (fs.recordedBy as any)?.name || 'Staff',
          timestamp: fs.createdAt || fs.date,
          metadata: { id: fs._id, bags: fs.bags, totalCost: fs.totalCost }
        });
      }

      // Map batches
      for (const b of batches) {
        activities.push({
          type: 'batch',
          description: `Flock created: '${b.name}' (${b.breed}, ${b.initialCount} birds)`,
          user: 'Admin',
          timestamp: b.createdAt || b.startDate,
          metadata: { id: b._id, name: b.name, breed: b.breed, count: b.initialCount }
        });
      }

      // Map health records
      for (const h of healthRecords) {
        const batchName = (h.batchId as any)?.name || 'Flock';
        activities.push({
          type: 'health',
          description: `Health record (${h.type.toUpperCase()}) on ${batchName}: ${h.description}`,
          user: (h.createdBy as any)?.name || h.performedBy || 'Vet',
          timestamp: h.createdAt || h.date,
          metadata: { id: h._id, type: h.type }
        });
      }

      // Map payments
      for (const p of payments) {
        const custName = p.customerName || (p.customerId as any)?.name || 'Customer';
        activities.push({
          type: 'payment',
          description: `Payment received: ৳${p.amount.toLocaleString()} from ${custName} via ${p.method.toUpperCase()}`,
          user: (p.recordedBy as any)?.name || 'Staff',
          timestamp: p.createdAt || p.date,
          metadata: { id: p._id, amount: p.amount, method: p.method }
        });
      }

      // Sort all combined activities by timestamp DESC and return the last 50
      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const last50 = activities.slice(0, 50);

      return ResponseView.success(res, last50);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }
}
