// ============================================================
// AgentGate — Rate Limiting Middleware (In-Memory Sliding Window)
// Protects sensitive AI endpoints, webhooks, and crypto endpoints
// ============================================================

import type { Request, Response, NextFunction } from 'express';

interface RateLimitBucket {
  count: number;
  resetTime: number;
}

const ipBuckets = new Map<string, RateLimitBucket>();

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  const { windowMs, maxRequests, message = 'Too many requests, please try again later.' } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${req.baseUrl || ''}${req.path}:${ip}`;
    const now = Date.now();

    const bucket = ipBuckets.get(key);

    if (!bucket || now > bucket.resetTime) {
      ipBuckets.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', maxRequests - 1);
      return next();
    }

    if (bucket.count >= maxRequests) {
      const retryAfterSeconds = Math.ceil((bucket.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      return res.status(429).json({
        error: message,
        retry_after_seconds: retryAfterSeconds,
      });
    }

    bucket.count++;
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', maxRequests - bucket.count);
    next();
  };
}

// Pre-configured rate limiters
export const aiIntentRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 requests / min
  message: 'AI agent request rate limit exceeded. Please wait a moment before sending another prompt.',
});

export const webhookRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 120, // 120 webhook events / min
  message: 'Webhook intake rate limit exceeded.',
});
