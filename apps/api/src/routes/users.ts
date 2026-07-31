import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { createUserSchema } from '@poultry-ops/validation';
import { UserModel, BatchModel } from '../models/schemas';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

// List team users in farm
router.get('/', requireRole(['owner', 'manager']), async (req: AuthRequest, res: Response) => {
  try {
    const users = await UserModel.find({ farmId: req.farmId }).select('-passwordHash');
    return res.json(users);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Helper for adding user
const handleAddUser = async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = createUserSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.format() });
    }

    const { name, email, password, role, phone } = parseResult.data;

    const existing = await UserModel.findOne({ farmId: req.farmId, email });
    if (existing) {
      return res.status(400).json({ error: 'A user with this email already exists in your farm' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = new UserModel({
      farmId: req.farmId,
      name,
      email,
      passwordHash,
      role,
      phone,
      isActive: true
    });

    await user.save();
    return res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      isActive: user.isActive
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

// Add new user (POST / or POST /invite)
router.post('/', requireRole(['owner', 'manager']), handleAddUser);
router.post('/invite', requireRole(['owner', 'manager']), handleAddUser);

// Toggle active status
router.patch('/:id/toggle-active', requireRole(['owner']), async (req: AuthRequest, res: Response) => {
  try {
    const user = await UserModel.findOne({ _id: req.params.id, farmId: req.farmId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.isActive = !user.isActive;
    await user.save();
    return res.json({ _id: user._id, isActive: user.isActive });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Delete user: delete from DB and remove from all assigned batches (keep batch info intact)
router.delete('/:id', requireRole(['owner']), async (req: AuthRequest, res: Response) => {
  try {
    const userIdToDelete = req.params.id;

    // Prevent owner from deleting themselves
    if (userIdToDelete === req.user?.userId) {
      return res.status(400).json({ error: 'Owner cannot delete their own account' });
    }

    const user = await UserModel.findOne({ _id: userIdToDelete, farmId: req.farmId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // 1. Remove worker from all assigned batches
    await BatchModel.updateMany(
      { farmId: req.farmId },
      { $pull: { assignedWorkerIds: userIdToDelete } }
    );

    // 2. Delete user document from DB
    await UserModel.deleteOne({ _id: userIdToDelete, farmId: req.farmId });

    return res.json({ message: 'User deleted from DB and unassigned from all batches', deletedUserId: userIdToDelete });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
