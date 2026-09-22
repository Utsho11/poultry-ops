import { Router } from 'express';
import { BatchController } from '../controllers/batch.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';
import { verifyPasswordConfirmation } from '../middleware/password';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

router.post('/', requireRole(['owner', 'manager']), verifyPasswordConfirmation, BatchController.createBatch);
router.get('/', BatchController.getBatches);
router.get('/:id', BatchController.getBatchById);
router.put('/:id', requireRole(['owner', 'manager']), BatchController.updateBatch);
router.patch('/:id/assign-workers', requireRole(['owner', 'manager']), BatchController.assignWorkers);
router.post('/:id/close', requireRole(['owner', 'manager']), verifyPasswordConfirmation, BatchController.closeBatch);
router.delete('/:id', requireRole(['owner']), verifyPasswordConfirmation, BatchController.deleteBatch);

export default router;
