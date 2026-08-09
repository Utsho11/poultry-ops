import { Router } from 'express';
import { BatchController } from '../controllers/batch.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

router.post('/', requireRole(['owner', 'manager']), BatchController.createBatch);
router.get('/', BatchController.getBatches);
router.get('/:id', BatchController.getBatchById);
router.put('/:id', requireRole(['owner', 'manager']), BatchController.updateBatch);
router.delete('/:id', requireRole(['owner']), BatchController.deleteBatch);

export default router;
