import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authenticate } from '../middleware/auth';
import { resolveTenant } from '../middleware/tenant';

const router = Router();

router.use(authenticate);
router.use(resolveTenant);

router.get('/summary', ReportController.getSummaryReport);
router.get('/daily', ReportController.getDailyReport);
router.get('/batch-dashboard/:batchId', ReportController.getBatchDashboard);
router.get('/activity-log', ReportController.getActivityLog);

export default router;
