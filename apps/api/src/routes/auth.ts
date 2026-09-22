import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimit';

const router = Router();

router.post('/register', authRateLimiter(), AuthController.register);
router.post('/register-farm', authRateLimiter(), AuthController.registerFarm);
router.post('/login', authRateLimiter(), AuthController.login);
router.get('/me', authenticate, AuthController.me);
router.post('/switch-firm', authenticate, AuthController.switchFirm);

export default router;
