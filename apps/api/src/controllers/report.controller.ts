import { Response } from 'express';
import mongoose from 'mongoose';
import { DailyLogModel, ExpenseModel, BatchModel, SaleModel, FeedStockModel } from '../models/schemas';
import { AuthRequest } from '../middleware/auth';
import { ResponseView } from '../views/response.view';

function toObjectId(id: string) {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch (e) {
    return id;
  }
}

async function getAvgFeedCostPerKg(farmId: any): Promise<number> {
  const farmObjectId = toObjectId(farmId as string);
  const stockAgg = await FeedStockModel.aggregate([
    { $match: { $or: [{ farmId: farmObjectId }, { farmId }] } },
    { $group: { _id: null, totalCost: { $sum: '$totalCost' }, totalKg: { $sum: '$totalKg' } } }
  ]);

  if (stockAgg.length > 0 && stockAgg[0].totalKg > 0) {
    return stockAgg[0].totalCost / stockAgg[0].totalKg;
  }

  return 50; // Fallback: ৳50 / kg
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

      const avgFeedCostPerKg = await getAvgFeedCostPerKg(req.farmId);
      const calculatedFeedExpense = Math.round(logMetrics.totalFeedKg * avgFeedCostPerKg);

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

      const avgFeedCostPerKg = await getAvgFeedCostPerKg(req.farmId);
      const calculatedFeedExpense = Math.round(totalFeedKg * avgFeedCostPerKg);
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
}
