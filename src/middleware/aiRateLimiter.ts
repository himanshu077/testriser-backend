import { Request, Response, NextFunction } from 'express';
import { openaiService } from '../services/openaiService';

const HTTP_STATUS = {
  TOO_MANY_REQUESTS: 429,
  SERVER_ERROR: 500,
};

/**
 * AI Rate Limiter Middleware
 * Checks if user/session has exceeded their daily AI question limit
 */
export async function aiRateLimiter(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).user?.id;
    const userTier = (req as any).user?.subscriptionTier || 'free';
    const sessionId = req.body.sessionId || req.query.sessionId;

    // Check rate limiting
    const rateLimit = await openaiService.handleRateLimiting(userId, sessionId as string, userTier);

    if (!rateLimit.allowed) {
      return res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        success: false,
        error: 'Daily AI question limit exceeded',
        message: `You have used all ${rateLimit.limit} questions for today. Upgrade your plan for more questions.`,
        data: {
          limit: rateLimit.limit,
          remaining: rateLimit.remaining,
          tier: userTier,
        },
      });
    }

    // Attach rate limit info to request for logging
    (req as any).rateLimit = rateLimit;

    next();
  } catch (error: any) {
    console.error('Rate limiter error:', error);
    // On error, allow the request to proceed (fail open)
    next();
  }
}

/**
 * IP-based rate limiter for anonymous users
 * Simple in-memory implementation (for production, use Redis)
 */
const ipRequestCounts = new Map<string, { count: number; resetTime: number }>();

export function ipRateLimiter(requestsPerHour: number = 10) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    // Get or create IP record
    let ipRecord = ipRequestCounts.get(ip);

    if (!ipRecord || now > ipRecord.resetTime) {
      // Reset counter
      ipRecord = {
        count: 1,
        resetTime: now + oneHour,
      };
      ipRequestCounts.set(ip, ipRecord);
      return next();
    }

    // Increment counter
    ipRecord.count++;

    if (ipRecord.count > requestsPerHour) {
      return res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        success: false,
        error: 'Rate limit exceeded',
        message: `Too many requests from this IP. Please try again later.`,
        data: {
          limit: requestsPerHour,
          resetTime: new Date(ipRecord.resetTime).toISOString(),
        },
      });
    }

    next();
  };
}

/**
 * Cleanup old IP records periodically (run every hour)
 */
setInterval(
  () => {
    const now = Date.now();
    for (const [ip, record] of ipRequestCounts.entries()) {
      if (now > record.resetTime) {
        ipRequestCounts.delete(ip);
      }
    }
  },
  60 * 60 * 1000
); // Clean up every hour
