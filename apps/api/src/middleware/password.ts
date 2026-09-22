import { Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { AuthRequest } from './auth';
import { UserModel } from '../models/schemas';
import { ResponseView } from '../views/response.view';

/**
 * Middleware to verify that the requesting user provides their valid account password
 * for high-security operations (e.g., flock creation, flock closure, flock deletion).
 */
export const verifyPasswordConfirmation = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const password = req.body?.password || (req.headers['x-password'] as string);

    if (!password || typeof password !== 'string' || password.trim() === '') {
      return ResponseView.error(res, 'Account password is required for security verification', 400);
    }

    if (!req.user?.userId) {
      return ResponseView.unauthorized(res, 'User session invalid');
    }

    const user = await UserModel.findById(req.user.userId);
    if (!user || !user.passwordHash) {
      return ResponseView.unauthorized(res, 'User account not found');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return ResponseView.error(res, 'Incorrect password! Security check failed.', 401);
    }

    next();
  } catch (error: any) {
    return ResponseView.serverError(res, 'Password verification failed', error);
  }
};
