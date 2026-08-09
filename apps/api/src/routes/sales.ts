import { Router } from 'express';
import { SaleController } from '../controllers/sale.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

router.get('/', SaleController.getSales);
router.post('/', requireRole(['owner', 'manager']), SaleController.createSale);
router.delete('/:id', requireRole(['owner']), SaleController.deleteSale);

export default router;
