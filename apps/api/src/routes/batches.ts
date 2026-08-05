import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { createBatchSchema } from '@poultry-ops/validation';
import { BatchModel, UserModel, DailyLogModel, HealthRecordModel, ExpenseModel, SaleModel } from '../models/schemas';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

// Get all batches for farm (Workers see only their assignable batches)
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const statusFilter = req.query.status as string;
    const query: any = { farmId: req.farmId };
    if (statusFilter) {
      query.status = statusFilter;
    }

    // Filter for worker role: only see assigned batches (or unassigned/all if assignedWorkerIds empty)
    if (req.user?.role === 'worker') {
      query.$or = [
        { assignedWorkerIds: req.user.userId },
        { assignedWorkerIds: { $exists: false } },
        { assignedWorkerIds: { $size: 0 } }
      ];
    }

    const batches = await BatchModel.find(query).sort({ createdAt: -1 });
    return res.json(batches);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Create new batch (Owner/Manager only - Password verification required)
router.post('/', requireRole(['owner', 'manager']), async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = createBatchSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.format() });
    }

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password verification required to create a batch' });
    }

    // Verify Password
    const currentUser = await UserModel.findById(req.user?.userId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User account not found' });
    }

    const isPasswordValid = await bcrypt.compare(password, currentUser.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Incorrect password! Security verification failed.' });
    }

    const { name, breed, type, startDate, initialCount, shed } = parseResult.data;
    const { assignedWorkerIds } = req.body;

    const batch = new BatchModel({
      farmId: req.farmId,
      name,
      breed,
      type,
      startDate: new Date(startDate),
      initialCount,
      currentCount: initialCount,
      shed,
      status: 'active',
      assignedWorkerIds: assignedWorkerIds || []
    });

    await batch.save();
    return res.status(201).json(batch);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Assign or remove workers to/from batch (Owner/Manager only)
router.patch('/:id/assign-workers', requireRole(['owner', 'manager']), async (req: AuthRequest, res: Response) => {
  try {
    const { workerIds } = req.body;
    if (!Array.isArray(workerIds)) {
      return res.status(400).json({ error: 'workerIds must be an array of user IDs' });
    }

    const batch = await BatchModel.findOne({ _id: req.params.id, farmId: req.farmId });
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    batch.assignedWorkerIds = workerIds as any;
    await batch.save();
    return res.json(batch);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Close batch (Owner/Manager only - Password verification required)
router.post('/:id/close', requireRole(['owner', 'manager']), async (req: AuthRequest, res: Response) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password security verification required to close a batch' });
    }

    // Verify Password
    const currentUser = await UserModel.findById(req.user?.userId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User account not found' });
    }

    const isPasswordValid = await bcrypt.compare(password, currentUser.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Incorrect password! Security verification failed.' });
    }

    const batch = await BatchModel.findOne({ _id: req.params.id, farmId: req.farmId });
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    batch.status = 'closed';
    batch.closedAt = new Date();
    await batch.save();
    return res.json(batch);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Delete batch and clean up associated records (Owner/Manager only - Password verification required)
router.delete('/:id', requireRole(['owner', 'manager']), async (req: AuthRequest, res: Response) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password security verification required to delete a batch' });
    }

    // Verify Password
    const currentUser = await UserModel.findById(req.user?.userId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User account not found' });
    }

    const isPasswordValid = await bcrypt.compare(password, currentUser.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Incorrect password! Security verification failed.' });
    }

    const batchId = req.params.id;
    const batch = await BatchModel.findOne({ _id: batchId, farmId: req.farmId });
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found or unauthorized' });
    }

    // Clean up associated batch records
    await Promise.all([
      DailyLogModel.deleteMany({ farmId: req.farmId, batchId }),
      HealthRecordModel.deleteMany({ farmId: req.farmId, batchId }),
      ExpenseModel.deleteMany({ farmId: req.farmId, batchId }),
      SaleModel.updateMany({ farmId: req.farmId, batchId }, { $unset: { batchId: 1 } })
    ]);

    await BatchModel.deleteOne({ _id: batchId, farmId: req.farmId });
    return res.json({ message: `Flock '${batch.name}' and associated records deleted successfully`, deletedBatchId: batchId });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
