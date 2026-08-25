// ============================================================
// AgentGate — Rate Limiting & Anomaly Throttling Middleware
// Provides per-user, per-endpoint, and security anomaly rate limiting
// ============================================================

import type { Request, Response, NextFunction } from 'express';

interface RateLimitBucket {
  count: number;
  resetTime: number;
}

const rateLimitBuckets = new Map<string, RateLimitBucket>();
const securityViolationBuckets = new Map<string, { count: number; lockedUntil: number }>();

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
  useUserId?: boolean;
  message?: string;
}) {
  const {
    windowMs,
    maxRequests,
    keyPrefix = 'rl',
    useUserId = true,
    message = 'Too many requests, please try again later.',
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket.remoteAddress ||
      'unknown';
    const userId = useUserId && req.user?.userId ? req.user.userId : '';
    const identifier = userId ? `user:${userId}` : `ip:${ip}`;
    const key = `${keyPrefix}:${req.baseUrl || ''}${req.path}:${identifier}`;
    const now = Date.now();

    // Check if client is in security anomaly cool-down
    const securityLock = securityViolationBuckets.get(identifier);
    if (securityLock && now < securityLock.lockedUntil) {
      const lockSecondsRemaining = Math.ceil((securityLock.lockedUntil - now) / 1000);
      res.setHeader('Retry-After', lockSecondsRemaining);
      res.status(429).json({
        error: 'Security Anomaly Lockout: Multiple security verification failures detected from your client. Temporarily throttled.',
        retry_after_seconds: lockSecondsRemaining,
      });
      return;
    }

    const bucket = rateLimitBuckets.get(key);

    if (!bucket || now > bucket.resetTime) {
      rateLimitBuckets.set(key, {
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

/**
 * Records a cryptographic or policy security violation for anomaly detection.
 * If 5 violations occur within 5 minutes, client is placed in 15-minute cool-down.
 */
export function recordSecurityViolation(req: Request): void {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.ip ||
    req.socket.remoteAddress ||
    'unknown';
  const userId = req.user?.userId ? req.user.userId : '';
  const identifier = userId ? `user:${userId}` : `ip:${ip}`;
  const now = Date.now();

  const record = securityViolationBuckets.get(identifier) || { count: 0, lockedUntil: 0 };
  record.count++;

  if (record.count >= 5) {
    record.lockedUntil = now + 15 * 60 * 1000; // 15 minutes lockout
    console.warn(`🚨 [Security Alert] Anomaly threshold exceeded for ${identifier}. Lockout enforced for 15 minutes.`);
  }

  securityViolationBuckets.set(identifier, record);
}

// Pre-configured rate limiters
export const aiIntentRateLimiter = createRateLimiter({
  keyPrefix: 'ai_intent',
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 requests / min
  message: 'AI agent request rate limit exceeded. Please wait a moment before sending another prompt.',
});

export const policyMutationRateLimiter = createRateLimiter({
  keyPrefix: 'policy_mut',
  windowMs: 60 * 1000,
  maxRequests: 15,
  message: 'Policy update rate limit exceeded.',
});

export const purchaseExecutionRateLimiter = createRateLimiter({
  keyPrefix: 'purchase_exec',
  windowMs: 60 * 1000,
  maxRequests: 20,
  message: 'Purchase transaction rate limit exceeded.',
});

export const authRateLimiter = createRateLimiter({
  keyPrefix: 'auth',
  windowMs: 60 * 1000,
  maxRequests: 20,
  useUserId: false,
  message: 'Authentication rate limit exceeded. Please try again later.',
});

export const webhookRateLimiter = createRateLimiter({
  keyPrefix: 'webhook',
  windowMs: 60 * 1000,
  maxRequests: 120, // 120 webhook events / min
  useUserId: false,
  message: 'Webhook intake rate limit exceeded.',
});
