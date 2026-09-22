import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

router.get('/', requireRole(['owner', 'manager']), CustomerController.getCustomers);
router.post('/', requireRole(['owner', 'manager']), CustomerController.createCustomer);
router.put('/:id', requireRole(['owner', 'manager']), CustomerController.updateCustomer);
router.delete('/:id', requireRole(['owner']), CustomerController.deleteCustomer);

export default router;
