import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const requestCounts: Record<string, RateLimitRecord> = {};

// Periodic cleanup of expired rate limit records to prevent memory leak
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [k, rec] of Object.entries(requestCounts)) {
      if (now > rec.resetTime) {
        delete requestCounts[k];
      }
    }
  }, 5 * 60 * 1000).unref?.();
}

/**
 * Lightweight in-memory rate limiter for sensitive authentication endpoints.
 * @param maxRequests Maximum allowed requests in the time window (default: 20)
 * @param windowMs Time window in milliseconds (default: 1 minute)
 */
export const authRateLimiter = (maxRequests = 20, windowMs = 60 * 1000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const clientIp = Array.isArray(rawIp) ? rawIp[0] : String(rawIp).split(',')[0].trim();
    const key = `auth_${clientIp}`;
    const now = Date.now();

    const record = requestCounts[key];

    if (!record || now > record.resetTime) {
      requestCounts[key] = { count: 1, resetTime: now + windowMs };
      return next();
    }

    record.count++;

    if (record.count > maxRequests) {
      return res.status(429).json({
        error: 'Too many authentication attempts. Please wait a moment before trying again.'
      });
    }

    next();
  };
};
