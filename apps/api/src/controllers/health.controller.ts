import { Response } from 'express';
import { healthRecordSchema } from '@poultry-ops/validation';
import { HealthRecordModel } from '../models/schemas';
import { AuthRequest } from '../middleware/auth';
import { ResponseView } from '../views/response.view';

export class HealthController {
  static async getHealthRecords(req: AuthRequest, res: Response) {
    try {
      const { batchId } = req.query;
      const query: any = { farmId: req.farmId };
      if (batchId) query.batchId = batchId;

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
}
