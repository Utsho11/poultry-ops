import { Router, Response } from 'express';
import { ReminderModel } from '../models/schemas';
import { reminderSchema } from '@poultry-ops/validation';
import { authenticate, AuthRequest } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

// Helper to parse 12-hour time "08:30 AM" or "02:15 PM" to 24-hour hours/minutes
function parse12HourTime(timeStr: string): { hours: number; minutes: number } {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    // Fallback if already 24h
    const parts = timeStr.split(':');
    return { hours: parseInt(parts[0] || '8', 10), minutes: parseInt(parts[1] || '0', 10) };
  }
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return { hours, minutes };
}

// Get reminders
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const reminders = await ReminderModel.find({ farmId: req.farmId }).sort({ createdAt: -1 });
    return res.json(reminders);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Create reminder — all roles (owner, manager, worker) can create
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const parseResult = reminderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.format() });
    }

    const { batchId, type, message, dueDate, dueTime, repeat, cronExpression, assignedTo, channel } = parseResult.data;

    // Store the display-friendly time (e.g. "08:30 AM")
    const timeStr = dueTime || '08:00 AM';
    const dateStr = dueDate || new Date().toISOString().split('T')[0];
    const repeatStr = repeat || 'none';

    // Parse the 12-hour time to 24-hour for valid cron generation
    const { hours, minutes } = parse12HourTime(timeStr);
    const generatedCron = cronExpression || `${minutes} ${hours} * * *`;

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

// Delete reminder — all roles can delete their farm's reminders
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    await ReminderModel.deleteOne({ _id: req.params.id, farmId: req.farmId });
    return res.json({ message: 'Reminder deleted' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
