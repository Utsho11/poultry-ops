import { Router } from 'express';
import { LogController } from '../controllers/log.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

router.get('/', LogController.getLogs);
router.post('/', LogController.createLog);
router.put('/:id', requireRole(['owner', 'manager']), LogController.updateLog);
router.delete('/:id', requireRole(['owner', 'manager']), LogController.deleteLog);

export default router;
