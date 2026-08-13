import { Response } from 'express';
import mongoose from 'mongoose';
import { expenseSchema } from '@poultry-ops/validation';
import { ExpenseModel, BatchModel } from '../models/schemas';
import { AuthRequest } from '../middleware/auth';
import { ResponseView } from '../views/response.view';

export class ExpenseController {
  // Get expenses for active Firm
  static async getExpenses(req: AuthRequest, res: Response) {
    try {
      const { batchId, category, from, to } = req.query;
      const query: any = { farmId: req.farmId };

      if (batchId) {
        let bObjId: any;
        try { bObjId = new mongoose.Types.ObjectId(batchId as string); } catch { bObjId = batchId; }
        query.$and = [{ $or: [{ batchId: bObjId }, { batchId: String(batchId) }] }];
      }
      if (category) query.category = category;
      if (from || to) {
        query.date = {};
        if (from) query.date.$gte = from;
        if (to) query.date.$lte = to;
      }

      const expenses = await ExpenseModel.find(query)
        .populate('workerId', 'name email phone')
        .sort({ date: -1 });

      return ResponseView.success(res, expenses);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Create expense
  static async createExpense(req: AuthRequest, res: Response) {
    try {
      const parseResult = expenseSchema.safeParse(req.body);
      if (!parseResult.success) {
        return ResponseView.error(res, 'Validation failed', 400, parseResult.error.format());
      }

      const { batchId, workerId, category, amount, currency, date, note, receiptUrl } = parseResult.data;
      const { feedBags, feedKg } = req.body;

      if (category === 'labor') {
        if (!batchId) {
          return ResponseView.error(res, 'Batch selection is required for labor expenses.');
        }
        const batch = await BatchModel.findOne({ _id: batchId, farmId: req.farmId });
        if (!batch) {
          return ResponseView.notFound(res, 'Selected batch not found.');
        }
        if (!batch.assignedWorkerIds || batch.assignedWorkerIds.length === 0) {
          return ResponseView.error(res, 'Cannot add labor expense to this batch because no workers are assigned. Please assign a worker first.');
        }
        if (!workerId) {
          return ResponseView.error(res, 'Worker selection is required for labor expenses.');
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
        workerId: category === 'labor' ? workerId : undefined,
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
      return ResponseView.created(res, expense);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Edit expense
  static async updateExpense(req: AuthRequest, res: Response) {
    try {
      const parseResult = expenseSchema.partial().safeParse(req.body);
      if (!parseResult.success) {
        return ResponseView.error(res, 'Validation failed', 400, parseResult.error.format());
      }

      const expense = await ExpenseModel.findOne({ _id: req.params.id, farmId: req.farmId });
      if (!expense) {
        return ResponseView.notFound(res, 'Expense record not found');
      }

      const { batchId, workerId, category, amount, date, note } = parseResult.data;
      const { feedBags, feedKg } = req.body;

      if (category === 'labor' && batchId) {
        const batch = await BatchModel.findOne({ _id: batchId, farmId: req.farmId });
        if (!batch || !batch.assignedWorkerIds || batch.assignedWorkerIds.length === 0) {
          return ResponseView.error(res, 'Cannot assign labor expense to a batch without assigned workers.');
        }
      }

      if (batchId !== undefined) expense.batchId = batchId as any;
      if (workerId !== undefined) expense.workerId = workerId as any;
      if (category !== undefined) expense.category = category as any;
      if (amount !== undefined) expense.amount = Number(amount);
      if (date !== undefined) expense.date = date;
      if (note !== undefined) expense.note = note;
      if (feedBags !== undefined) expense.feedBags = Number(feedBags);
      if (feedKg !== undefined) expense.feedKg = Number(feedKg);

      await expense.save();
      return ResponseView.success(res, expense);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Delete expense
  static async deleteExpense(req: AuthRequest, res: Response) {
    try {
      const expense = await ExpenseModel.findOne({ _id: req.params.id, farmId: req.farmId });
      if (!expense) {
        return ResponseView.notFound(res, 'Expense record not found');
      }

      await ExpenseModel.deleteOne({ _id: req.params.id, farmId: req.farmId });
      return ResponseView.success(res, { message: 'Expense record deleted successfully' });
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }
}
