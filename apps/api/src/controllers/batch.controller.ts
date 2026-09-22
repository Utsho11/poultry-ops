import { Response } from 'express';
import mongoose from 'mongoose';
import { createBatchSchema } from '@poultry-ops/validation';
import { BatchModel, BatchWorkerModel, FarmModel, DailyLogModel, HealthRecordModel, ExpenseModel, SaleModel } from '../models/schemas';
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

      const { name, breed, type, shed, startDate, initialCount, assignedWorkerIds } = parseResult.data as any;

      // Find firm to check animal type fallback
      const firm = await FarmModel.findById(req.farmId);
      const batchType = type || (firm?.animalType === 'broiler' ? 'broiler' : 'layer');

      const batch = new BatchModel({
        farmId: req.farmId,
        name,
        breed,
        type: batchType,
        shed,
        startDate: new Date(startDate),
        initialCount,
        currentCount: initialCount,
        status: 'active'
      });

      await batch.save();

      // Create foreign key junction assignments in BatchWorker collection
      if (assignedWorkerIds && Array.isArray(assignedWorkerIds) && assignedWorkerIds.length > 0) {
        const validWorkerIds = assignedWorkerIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validWorkerIds.length > 0) {
          await BatchWorkerModel.insertMany(
            validWorkerIds.map(wId => ({
              farmId: req.farmId,
              batchId: batch._id,
              workerId: wId
            })),
            { ordered: false }
          );
        }
      }

      // Fetch workers from junction table to populate response
      const assignments = await BatchWorkerModel.find({ batchId: batch._id, farmId: req.farmId })
        .populate('workerId', 'name email phone role');
      const batchObj: any = batch.toObject();
      const workers = assignments.map(a => a.workerId).filter(Boolean);
      batchObj.assignedWorkers = workers;
      batchObj.assignedWorkerIds = workers;

      return ResponseView.created(res, batchObj);
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

      const batches = await BatchModel.find(query).sort({ createdAt: -1 });

      // Fetch assignments for all returned batches from BatchWorker collection
      const batchIds = batches.map(b => b._id);
      const assignments = await BatchWorkerModel.find({ batchId: { $in: batchIds }, farmId: req.farmId })
        .populate('workerId', 'name email phone role');

      const assignmentsByBatch = new Map<string, any[]>();
      assignments.forEach(a => {
        const bIdStr = String(a.batchId);
        if (!assignmentsByBatch.has(bIdStr)) {
          assignmentsByBatch.set(bIdStr, []);
        }
        if (a.workerId) {
          assignmentsByBatch.get(bIdStr)!.push(a.workerId);
        }
      });

      const responseBatches = batches.map(b => {
        const bObj: any = b.toObject();
        const workers = assignmentsByBatch.get(String(b._id)) || [];
        bObj.assignedWorkers = workers;
        bObj.assignedWorkerIds = workers;
        return bObj;
      });

      return ResponseView.success(res, responseBatches);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Get Batch by ID
  static async getBatchById(req: AuthRequest, res: Response) {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return ResponseView.notFound(res, 'Flock/Batch not found');
      }

      const batch = await BatchModel.findOne({ _id: req.params.id, farmId: req.farmId });

      if (!batch) {
        return ResponseView.notFound(res, 'Flock/Batch not found');
      }

      const assignments = await BatchWorkerModel.find({ batchId: batch._id, farmId: req.farmId })
        .populate('workerId', 'name email phone role');
      const batchObj: any = batch.toObject();
      const workers = assignments.map(a => a.workerId).filter(Boolean);
      batchObj.assignedWorkers = workers;
      batchObj.assignedWorkerIds = workers;

      return ResponseView.success(res, batchObj);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Update Batch
  static async updateBatch(req: AuthRequest, res: Response) {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return ResponseView.notFound(res, 'Flock/Batch not found');
      }

      const { name, breed, type, shed, startDate, initialCount, currentCount, status } = req.body;
      const workerIdsInput = req.body.assignedWorkerIds !== undefined ? req.body.assignedWorkerIds : req.body.workerIds;
      const batch = await BatchModel.findOne({ _id: req.params.id, farmId: req.farmId });

      if (!batch) {
        return ResponseView.notFound(res, 'Flock/Batch not found');
      }

      if (name !== undefined) batch.name = name;
      if (breed !== undefined) batch.breed = breed;
      if (type !== undefined) batch.type = type;
      if (shed !== undefined) batch.shed = shed;
      if (startDate !== undefined) batch.startDate = new Date(startDate);
      if (initialCount !== undefined) batch.initialCount = Number(initialCount);
      if (currentCount !== undefined) batch.currentCount = Number(currentCount);
      if (status !== undefined) {
        batch.status = status;
        if (status === 'closed') batch.closedAt = new Date();
      }

      await batch.save();

      // Update foreign key junction assignments in BatchWorker collection
      if (workerIdsInput !== undefined && Array.isArray(workerIdsInput)) {
        await BatchWorkerModel.deleteMany({ batchId: batch._id, farmId: req.farmId });
        const validWorkerIds = workerIdsInput.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validWorkerIds.length > 0) {
          await BatchWorkerModel.insertMany(
            validWorkerIds.map(wId => ({
              farmId: req.farmId,
              batchId: batch._id,
              workerId: wId
            })),
            { ordered: false }
          );
        }
      }

      const assignments = await BatchWorkerModel.find({ batchId: batch._id, farmId: req.farmId })
        .populate('workerId', 'name email phone role');
      const batchObj: any = batch.toObject();
      const workers = assignments.map(a => a.workerId).filter(Boolean);
      batchObj.assignedWorkers = workers;
      batchObj.assignedWorkerIds = workers;

      return ResponseView.success(res, batchObj);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Assign Workers endpoint (PATCH /batches/:id/assign-workers)
  static async assignWorkers(req: AuthRequest, res: Response) {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return ResponseView.notFound(res, 'Flock/Batch not found');
      }

      const batch = await BatchModel.findOne({ _id: req.params.id, farmId: req.farmId });
      if (!batch) {
        return ResponseView.notFound(res, 'Flock/Batch not found');
      }

      const workerIds = req.body.workerIds !== undefined ? req.body.workerIds : req.body.assignedWorkerIds;
      if (workerIds !== undefined && Array.isArray(workerIds)) {
        await BatchWorkerModel.deleteMany({ batchId: batch._id, farmId: req.farmId });
        const validWorkerIds = workerIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validWorkerIds.length > 0) {
          await BatchWorkerModel.insertMany(
            validWorkerIds.map(wId => ({
              farmId: req.farmId,
              batchId: batch._id,
              workerId: wId
            })),
            { ordered: false }
          );
        }
      }

      const assignments = await BatchWorkerModel.find({ batchId: batch._id, farmId: req.farmId })
        .populate('workerId', 'name email phone role');
      const batchObj: any = batch.toObject();
      const workers = assignments.map(a => a.workerId).filter(Boolean);
      batchObj.assignedWorkers = workers;
      batchObj.assignedWorkerIds = workers;

      return ResponseView.success(res, batchObj);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Close Batch
  static async closeBatch(req: AuthRequest, res: Response) {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return ResponseView.notFound(res, 'Flock/Batch not found');
      }

      const batch = await BatchModel.findOne({ _id: req.params.id, farmId: req.farmId });
      if (!batch) {
        return ResponseView.notFound(res, 'Flock/Batch not found');
      }

      batch.status = 'closed';
      batch.closedAt = new Date();
      await batch.save();

      return ResponseView.success(res, batch);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  // Delete Batch (with cascade cleanup of linked records and junction collection)
  static async deleteBatch(req: AuthRequest, res: Response) {
    try {
      const batchId = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(batchId)) {
        return ResponseView.notFound(res, 'Flock/Batch not found');
      }

      const batch = await BatchModel.findOne({ _id: batchId, farmId: req.farmId });
      if (!batch) {
        return ResponseView.notFound(res, 'Flock/Batch not found');
      }

      // Cascade delete daily logs, health records, batch worker assignments, and unset references in expenses/sales
      await Promise.all([
        DailyLogModel.deleteMany({ batchId, farmId: req.farmId }),
        HealthRecordModel.deleteMany({ batchId, farmId: req.farmId }),
        BatchWorkerModel.deleteMany({ batchId, farmId: req.farmId }),
        ExpenseModel.updateMany({ batchId, farmId: req.farmId }, { $unset: { batchId: 1 } }),
        SaleModel.updateMany({ batchId, farmId: req.farmId }, { $unset: { batchId: 1 } }),
        BatchModel.deleteOne({ _id: batchId, farmId: req.farmId })
      ]);

      return ResponseView.success(res, { message: 'Flock/Batch and associated records deleted successfully' });
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }
}

