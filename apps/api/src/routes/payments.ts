import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

router.get('/', requireRole(['owner', 'manager']), PaymentController.getPayments);
router.post('/', requireRole(['owner', 'manager']), PaymentController.createPayment);
router.delete('/:id', requireRole(['owner']), PaymentController.deletePayment);

export default router;
