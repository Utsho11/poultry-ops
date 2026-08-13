import { Router } from 'express';
import { FeedStockController } from '../controllers/feedStock.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

router.get('/', requireRole(['owner', 'manager']), FeedStockController.getFeedStock);
router.post('/', requireRole(['owner', 'manager']), FeedStockController.createFeedStock);
router.put('/:id', requireRole(['owner', 'manager']), FeedStockController.updateFeedStock);
router.delete('/:id', requireRole(['owner']), FeedStockController.deleteFeedStock);

export default router;
