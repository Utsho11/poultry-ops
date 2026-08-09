import { Router } from 'express';
import { FarmController } from '../controllers/farm.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.post('/', FarmController.createFirm);
router.get('/', FarmController.getFarms);
router.get('/:id', FarmController.getFarmById);
router.put('/:id', requireRole(['owner', 'manager']), FarmController.updateFarm);
router.delete('/:id', requireRole(['owner']), FarmController.deleteFarm);

export default router;
