import { Response } from 'express';
import { createBatchSchema } from '@poultry-ops/validation';
import { BatchModel, FarmModel, DailyLogModel, HealthRecordModel, ExpenseModel, SaleModel } from '../models/schemas';
import { AuthRequest } from '../middleware/auth';
import { ResponseView } from '../views/response.view';

export class BatchController {
  // Create Batch under Firm
  static async createBatch(req: AuthRequest, res: Response) {
    try {
      const parseResult = createBatchSchema.safeParse(req.body);
      if (!parseResult.success) {
        return ResponseView.error(res, 'Validation failed', 400, parseResult.error.format());
      }

      const { name, breed, type, startDate, initialCount } = parseResult.data;

      // Find firm to check animal type fallback
      const firm = await FarmModel.findById(req.farmId);
      const batchType = type || (firm?.animalType === 'broiler' ? 'broiler' : 'layer');

      const batch = new BatchModel({
        farmId: req.farmId,
        name,
        breed,
        type: batchType,
        startDate: new Date(startDate),
        initialCount,
        currentCount: initialCount,
        status: 'active'
      });

      await batch.save();
      return ResponseView.created(res, batch);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message || 'Failed to create batch', error);
    }
  }

  // Get Batches for active Firm
  static async getBatches(req: AuthRequest, res: Response) {
    try {
      const { status } = req.query;
      const query: any = { farmId: req.farmId };
      if (status) query.status = status;

      const batches = await BatchModel.find(query)
        .populate('assignedWorkerIds', 'name email phone role')
        .sort({ createdAt: -1 });

      return ResponseView.success(res, batches);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Get Batch by ID
  static async getBatchById(req: AuthRequest, res: Response) {
    try {
      const batch = await BatchModel.findOne({ _id: req.params.id, farmId: req.farmId })
        .populate('assignedWorkerIds', 'name email phone role');

      if (!batch) {
        return ResponseView.notFound(res, 'Flock/Batch not found');
      }
      return ResponseView.success(res, batch);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Update Batch
  static async updateBatch(req: AuthRequest, res: Response) {
    try {
      const { name, breed, type, startDate, initialCount, currentCount, status, assignedWorkerIds } = req.body;
      const batch = await BatchModel.findOne({ _id: req.params.id, farmId: req.farmId });

      if (!batch) {
        return ResponseView.notFound(res, 'Flock/Batch not found');
      }

      if (name !== undefined) batch.name = name;
      if (breed !== undefined) batch.breed = breed;
      if (type !== undefined) batch.type = type;
      if (startDate !== undefined) batch.startDate = new Date(startDate);
      if (initialCount !== undefined) batch.initialCount = Number(initialCount);
      if (currentCount !== undefined) batch.currentCount = Number(currentCount);
      if (status !== undefined) {
        batch.status = status;
        if (status === 'closed') batch.closedAt = new Date();
      }
      if (assignedWorkerIds !== undefined) batch.assignedWorkerIds = assignedWorkerIds;

      await batch.save();
      return ResponseView.success(res, batch);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Delete Batch (with cascade cleanup of linked records)
  static async deleteBatch(req: AuthRequest, res: Response) {
    try {
      const batchId = req.params.id;
      const batch = await BatchModel.findOne({ _id: batchId, farmId: req.farmId });
      if (!batch) {
        return ResponseView.notFound(res, 'Flock/Batch not found');
      }

      // Cascade delete daily logs and health records linked to this batch, and unset references in expenses/sales
      await Promise.all([
        DailyLogModel.deleteMany({ batchId, farmId: req.farmId }),
        HealthRecordModel.deleteMany({ batchId, farmId: req.farmId }),
        ExpenseModel.updateMany({ batchId, farmId: req.farmId }, { $unset: { batchId: 1 } }),
        SaleModel.updateMany({ batchId, farmId: req.farmId }, { $unset: { batchId: 1 } }),
        BatchModel.deleteOne({ _id: batchId, farmId: req.farmId })
      ]);

      return ResponseView.success(res, { message: 'Flock/Batch and associated logs deleted successfully' });
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }
}
