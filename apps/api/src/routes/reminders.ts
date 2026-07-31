import { Router, Response } from 'express';
import { reminderSchema } from '@poultry-ops/validation';
import { ReminderModel } from '../models/schemas';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

// Get reminders
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const reminders = await ReminderModel.find({ farmId: req.farmId }).sort({ createdAt: -1 });
    return res.json(reminders);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Create reminder
router.post('/', requireRole(['owner', 'manager']), async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = reminderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.format() });
    }

    const { batchId, type, message, dueDate, dueTime, repeat, cronExpression, assignedTo, channel } = parseResult.data;

    // Convert Date and Time to a friendly schedule representation
    const timeStr = dueTime || '08:00';
    const dateStr = dueDate || new Date().toISOString().split('T')[0];
    const repeatStr = repeat || 'none';

    // Auto-generate cron string if not provided
    const [hrs, mins] = timeStr.split(':');
    const generatedCron = cronExpression || `${mins || 0} ${hrs || 8} * * *`;

    const reminder = new ReminderModel({
      farmId: req.farmId,
      batchId: batchId || undefined,
      type: type || 'feed',
      message,
      dueDate: dateStr,
      dueTime: timeStr,
      repeat: repeatStr,
      cronExpression: generatedCron,
      assignedTo: assignedTo || [],
      channel: channel || ['push'],
      active: true,
      createdBy: req.user?.userId
    });

    await reminder.save();
    return res.status(201).json(reminder);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Toggle / Delete reminder
router.delete('/:id', requireRole(['owner', 'manager']), async (req: AuthRequest, res: Response) => {
  try {
    await ReminderModel.deleteOne({ _id: req.params.id, farmId: req.farmId });
    return res.json({ message: 'Reminder deleted' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
