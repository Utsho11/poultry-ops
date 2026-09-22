import { Router } from 'express';
import { SaleController } from '../controllers/sale.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

router.get('/', requireRole(['owner', 'manager']), SaleController.getSales);
router.post('/', requireRole(['owner', 'manager']), SaleController.createSale);
router.put('/:id', requireRole(['owner', 'manager']), SaleController.updateSale);
router.delete('/:id', requireRole(['owner']), SaleController.deleteSale);

export default router;
