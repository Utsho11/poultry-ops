import { Response } from 'express';
import mongoose from 'mongoose';
import { healthRecordSchema } from '@poultry-ops/validation';
import { HealthRecordModel, BatchModel } from '../models/schemas';
import { AuthRequest } from '../middleware/auth';
import { ResponseView } from '../views/response.view';

export class HealthController {
  static async getHealthRecords(req: AuthRequest, res: Response) {
    try {
      const { batchId } = req.query;
      const query: any = { farmId: req.farmId };
      if (batchId) {
        if (!mongoose.Types.ObjectId.isValid(batchId as string)) {
          return ResponseView.success(res, []);
        }
        query.batchId = batchId;
      }

      const records = await HealthRecordModel.find(query).sort({ date: -1 });
      return ResponseView.success(res, records);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  static async createHealthRecord(req: AuthRequest, res: Response) {
    try {
      const parseResult = healthRecordSchema.safeParse(req.body);
      if (!parseResult.success) {
        return ResponseView.error(res, 'Validation failed', 400, parseResult.error.format());
      }

      const { batchId, date, type, description, medicineUsed, performedBy, cost, attachmentUrls } = parseResult.data;

      if (batchId) {
        if (!mongoose.Types.ObjectId.isValid(batchId)) {
          return ResponseView.notFound(res, 'Invalid flock/batch ID');
        }
        const batch = await BatchModel.findOne({ _id: batchId, farmId: req.farmId });
        if (!batch) {
          return ResponseView.notFound(res, 'Selected flock/batch not found in this firm');
        }
      }

      const record = new HealthRecordModel({
        farmId: req.farmId,
        batchId,
        date,
        type,
        description,
        medicineUsed,
        performedBy,
        cost,
        attachmentUrls,
        createdBy: req.user?.userId
      });

      await record.save();
      return ResponseView.created(res, record);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  static async updateHealthRecord(req: AuthRequest, res: Response) {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return ResponseView.notFound(res, 'Health record not found');
      }

      const parseResult = healthRecordSchema.partial().safeParse(req.body);
      if (!parseResult.success) {
        return ResponseView.error(res, 'Validation failed', 400, parseResult.error.format());
      }

      const record = await HealthRecordModel.findOne({ _id: req.params.id, farmId: req.farmId });
      if (!record) {
        return ResponseView.notFound(res, 'Health record not found');
      }

      const { batchId, date, type, description, medicineUsed, performedBy, cost, attachmentUrls } = parseResult.data;

      if (batchId !== undefined) {
        if (batchId) {
          if (!mongoose.Types.ObjectId.isValid(batchId)) {
            return ResponseView.notFound(res, 'Invalid flock/batch ID');
          }
          const batch = await BatchModel.findOne({ _id: batchId, farmId: req.farmId });
          if (!batch) {
            return ResponseView.notFound(res, 'Selected flock/batch not found in this firm');
          }
        }
        record.batchId = batchId as any;
      }
      if (date !== undefined) record.date = date;
      if (type !== undefined) record.type = type;
      if (description !== undefined) record.description = description;
      if (medicineUsed !== undefined) record.medicineUsed = medicineUsed;
      if (performedBy !== undefined) record.performedBy = performedBy;
      if (cost !== undefined) record.cost = cost;
      if (attachmentUrls !== undefined) record.attachmentUrls = attachmentUrls;

      await record.save();
      return ResponseView.success(res, record);
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }

  static async deleteHealthRecord(req: AuthRequest, res: Response) {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return ResponseView.notFound(res, 'Health record not found');
      }

      const record = await HealthRecordModel.findOneAndDelete({ _id: req.params.id, farmId: req.farmId });
      if (!record) {
        return ResponseView.notFound(res, 'Health record not found');
      }
      return ResponseView.success(res, { message: 'Health record deleted successfully', id: req.params.id });
    } catch (error: any) {
      return ResponseView.serverError(res, error.message);
    }
  }
}
