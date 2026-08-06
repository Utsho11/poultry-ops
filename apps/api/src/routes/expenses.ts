import { Router, Response } from 'express';
import { expenseSchema } from '@poultry-ops/validation';
import { ExpenseModel, BatchModel } from '../models/schemas';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

// Get expenses (Owner / Manager)
router.get('/', requireRole(['owner', 'manager']), async (req: AuthRequest, res: Response) => {
  try {
    const { batchId, category, from, to } = req.query;
    const query: any = { farmId: req.farmId };

    if (batchId) query.batchId = batchId;
    if (category) query.category = category;
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = from;
      if (to) query.date.$lte = to;
    }

    const expenses = await ExpenseModel.find(query).sort({ date: -1 });
    return res.json(expenses);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Create expense
router.post('/', requireRole(['owner', 'manager']), async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = expenseSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.format() });
    }

    const { batchId, category, amount, currency, date, note, receiptUrl, feedBags, feedKg } = req.body;

    // Check worker assignment for labor expenses
    if (category === 'labor') {
      if (!batchId) {
        return res.status(400).json({ error: 'Batch selection is required for labor expenses.' });
      }
      const batch = await BatchModel.findOne({ _id: batchId, farmId: req.farmId });
      if (!batch) {
        return res.status(404).json({ error: 'Selected batch not found.' });
      }
      if (!batch.assignedWorkerIds || batch.assignedWorkerIds.length === 0) {
        return res.status(400).json({
          error: 'Cannot add labor expense to this batch because no workers are assigned to this flock/batch. Please assign a worker to the batch first.'
        });
      }
    }

    let computedBags = feedBags ? Number(feedBags) : undefined;
    let computedKg = feedKg ? Number(feedKg) : undefined;
    if (category === 'feed' && computedBags && !computedKg) {
      computedKg = computedBags * 50;
    }

    const expense = new ExpenseModel({
      farmId: req.farmId,
      batchId,
      category,
      amount,
      currency: currency || 'BDT',
      date,
      note,
      receiptUrl,
      feedBags: computedBags,
      feedKg: computedKg,
      recordedBy: req.user?.userId
    });

    await expense.save();
    return res.status(201).json(expense);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
