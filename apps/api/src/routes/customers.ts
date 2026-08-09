import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

router.get('/', CustomerController.getCustomers);
router.post('/', requireRole(['owner', 'manager']), CustomerController.createCustomer);

export default router;
