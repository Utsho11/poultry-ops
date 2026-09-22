import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

router.get('/summary', ReportController.getSummaryReport);
router.get('/daily', requireRole(['owner', 'manager']), ReportController.getDailyReport);
router.get('/batch-dashboard/:batchId', ReportController.getBatchDashboard);
router.get('/activity-log', requireRole(['owner', 'manager']), ReportController.getActivityLog);
router.get('/export', requireRole(['owner', 'manager']), ReportController.exportReport);

export default router;

