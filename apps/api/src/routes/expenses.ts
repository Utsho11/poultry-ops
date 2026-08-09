import { Router } from 'express';
import { ExpenseController } from '../controllers/expense.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

router.get('/', requireRole(['owner', 'manager']), ExpenseController.getExpenses);
router.post('/', requireRole(['owner', 'manager']), ExpenseController.createExpense);
router.put('/:id', requireRole(['owner', 'manager']), ExpenseController.updateExpense);
router.delete('/:id', requireRole(['owner']), ExpenseController.deleteExpense);

export default router;
