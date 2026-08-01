import { Router, Response } from 'express';
import { reminderSchema } from '@poultry-ops/validation';
import { ReminderModel } from '../models/schemas';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

// Helper: Convert 12-hour AM/PM time string to 24-hour { hours, minutes }
function parse12HourTime(timeStr: string): { hours: number; minutes: number } {
  // Supports formats: "08:00 AM", "12:30 PM", "1:05 PM", "08:00"
  const cleaned = timeStr.trim().toUpperCase();
  const ampmMatch = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10);
    const m = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3];
    if (period === 'AM' && h === 12) h = 0;        // 12:xx AM → 0:xx
    if (period === 'PM' && h !== 12) h = h + 12;    // 1-11 PM → 13-23
    return { hours: h, minutes: m };
  }
  // Fallback: 24-hour format "HH:MM"
  const parts = cleaned.split(':');
  return {
    hours: parseInt(parts[0], 10) || 8,
    minutes: parseInt(parts[1], 10) || 0
  };
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
