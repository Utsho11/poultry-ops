import { Router, Response } from 'express';
import { healthRecordSchema } from '@poultry-ops/validation';
import { HealthRecordModel } from '../models/schemas';
import { authenticate, AuthRequest } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

// Get health records
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const { batchId } = req.query;
    const query: any = { farmId: req.farmId };
    if (batchId) query.batchId = batchId;

    const records = await HealthRecordModel.find(query).sort({ date: -1 });
    return res.json(records);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Create health record
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = healthRecordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.format() });
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
      cost: cost || 0,
      attachmentUrls: attachmentUrls || [],
      createdBy: req.user?.userId
    });

    await record.save();
    return res.status(201).json(record);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
