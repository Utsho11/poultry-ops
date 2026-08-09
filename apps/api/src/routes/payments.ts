import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

router.get('/', PaymentController.getPayments);
router.post('/', requireRole(['owner', 'manager']), PaymentController.createPayment);

export default router;
