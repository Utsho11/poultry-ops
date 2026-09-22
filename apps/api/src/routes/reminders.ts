import { Router } from 'express';
import { ReminderController } from '../controllers/reminder.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

router.get('/', ReminderController.getReminders);
router.post('/', requireRole(['owner', 'manager']), ReminderController.createReminder);
router.put('/:id', requireRole(['owner', 'manager']), ReminderController.updateReminder);
router.delete('/:id', requireRole(['owner', 'manager']), ReminderController.deleteReminder);

export default router;
