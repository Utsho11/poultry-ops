import { Router, Response } from 'express';
import { expenseSchema } from '@poultry-ops/validation';
import { ExpenseModel } from '../models/schemas';
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

    const { batchId, category, amount, currency, date, note, receiptUrl } = parseResult.data;

    const expense = new ExpenseModel({
      farmId: req.farmId,
      batchId,
      category,
      amount,
      currency: currency || 'BDT',
      date,
      note,
      receiptUrl,
      recordedBy: req.user?.userId
    });

    await expense.save();
    return res.status(201).json(expense);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
