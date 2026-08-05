import { Router, Response } from 'express';
import { AuthRequest, requireRole } from '../middleware/auth';
import { FeedStockModel, DailyLogModel, ExpenseModel } from '../models/schemas';
import { feedStockSchema } from '@poultry-ops/validation';

const router = Router();

// Get feed stock purchases and overall inventory summary
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const farmId = req.farmId;

    // Fetch all feed stock entries
    const entries = await FeedStockModel.find({ farmId }).sort({ date: -1, createdAt: -1 });

    // Aggregate total purchased kg and cost by category
    const categoryAgg = await FeedStockModel.aggregate([
      { $match: { farmId } },
      {
        $group: {
          _id: '$category',
          totalBags: { $sum: '$bags' },
          totalKg: { $sum: '$totalKg' },
          totalCost: { $sum: '$totalCost' }
        }
      }
    ]);

    // Aggregate total logged feed consumed across all daily logs
    const loggedFeedAgg = await DailyLogModel.aggregate([
      { $match: { farmId } },
      { $group: { _id: null, sum: { $sum: '$feedGivenKg' } } }
    ]);
    const totalUsedKg = loggedFeedAgg[0]?.sum || 0;

    let totalPurchasedKg = 0;
    let totalPurchasedCost = 0;

    const categorySummary: Record<string, { bags: number; totalKg: number; totalCost: number }> = {
      layer_starter: { bags: 0, totalKg: 0, totalCost: 0 },
      layer_grower: { bags: 0, totalKg: 0, totalCost: 0 },
      layer_layer_1: { bags: 0, totalKg: 0, totalCost: 0 },
      broiler_starter: { bags: 0, totalKg: 0, totalCost: 0 },
      broiler_grower: { bags: 0, totalKg: 0, totalCost: 0 },
      broiler_finisher: { bags: 0, totalKg: 0, totalCost: 0 }
    };

    categoryAgg.forEach((item: any) => {
      totalPurchasedKg += item.totalKg;
      totalPurchasedCost += item.totalCost;
      if (categorySummary[item._id]) {
        categorySummary[item._id] = {
          bags: item.totalBags,
          totalKg: item.totalKg,
          totalCost: item.totalCost
        };
      }
    });

    const availableKg = Math.max(0, totalPurchasedKg - totalUsedKg);
    const availableBags = Number((availableKg / 50).toFixed(1));

    return res.json({
      entries,
      summary: {
        totalPurchasedKg,
        totalPurchasedCost,
        totalUsedKg,
        availableKg,
        availableBags,
        categorySummary
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Add feed stock purchase
router.post('/', requireRole(['owner', 'manager']), async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = feedStockSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0]?.message || 'Validation failed';
      return res.status(400).json({ error: `Validation error: ${issue}` });
    }

    const { category, bagPrice, bags, date, note } = parseResult.data;

    const totalKg = bags * 50; // 50kg per bag rule
    const totalCost = bags * bagPrice;

    const entry = new FeedStockModel({
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

    await entry.save();

    // Automatically record as a feed expense
    const expense = new ExpenseModel({
      farmId: req.farmId,
      category: 'feed',
      amount: totalCost,
      currency: 'BDT',
      date,
      note: `Feed Stock Purchase: ${bags} Bags (${totalKg} kg) of ${category.toUpperCase().replace(/_/g, ' ')} @ ৳${bagPrice}/bag${note ? `. ${note}` : ''}`,
      recordedBy: req.user?.userId
    });
    await expense.save();

    return res.status(201).json(entry);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Delete feed stock entry
router.delete('/:id', requireRole(['owner', 'manager']), async (req: AuthRequest, res: Response) => {
  try {
    const entry = await FeedStockModel.findOneAndDelete({ _id: req.params.id, farmId: req.farmId });
    if (!entry) return res.status(404).json({ error: 'Feed stock entry not found' });
    return res.json({ message: 'Feed stock entry deleted' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
