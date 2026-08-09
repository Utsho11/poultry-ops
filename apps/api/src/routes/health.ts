import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

router.get('/', HealthController.getHealthRecords);
router.post('/', requireRole(['owner', 'manager']), HealthController.createHealthRecord);

export default router;
