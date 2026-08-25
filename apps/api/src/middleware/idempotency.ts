// ============================================================
// AgentGate — HTTP Idempotency Middleware
// Prevents duplicate operations on network retries using Idempotency-Key
// ============================================================

import type { Request, Response, NextFunction } from 'express';

interface IdempotencyRecord {
  status: 'in_progress' | 'completed';
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  createdAt: number;
  expiresAt: number;
}

class IdempotencyManager {
  private cache: Map<string, IdempotencyRecord> = new Map();
  private defaultTtlMs: number = 24 * 60 * 60 * 1000; // 24 hours

  public get(key: string): IdempotencyRecord | undefined {
    const record = this.cache.get(key);
    if (!record) return undefined;
    if (Date.now() > record.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return record;
  }

  public setInProgress(key: string, ttlMs: number = this.defaultTtlMs): boolean {
    const existing = this.get(key);
    if (existing) {
      return false;
    }

    const now = Date.now();
    this.cache.set(key, {
      status: 'in_progress',
      statusCode: 200,
      headers: {},
      body: null,
      createdAt: now,
      expiresAt: now + ttlMs,
    });
    return true;
  }

  public complete(key: string, statusCode: number, headers: Record<string, string>, body: any): void {
    const existing = this.cache.get(key);
    const now = Date.now();
    this.cache.set(key, {
      status: 'completed',
      statusCode,
      headers,
      body,
      createdAt: existing ? existing.createdAt : now,
      expiresAt: (existing ? existing.createdAt : now) + this.defaultTtlMs,
    });
  }

  public remove(key: string): void {
    this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }
}

export const idempotencyManager = new IdempotencyManager();

/**
 * Express middleware that enforces HTTP idempotency on mutating endpoints (POST, PUT, PATCH).
 */
export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Only apply to mutating HTTP methods
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
    next();
    return;
  }

  const idempotencyKey =
    (req.headers['x-idempotency-key'] as string) ||
    (req.headers['idempotency-key'] as string) ||
    (req.headers['x-idempotent-key'] as string);

  if (!idempotencyKey || typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    next();
    return;
  }

  const cleanKey = `${req.method}:${req.baseUrl || ''}${req.path}:${idempotencyKey.trim()}`;
  const existing = idempotencyManager.get(cleanKey);

  if (existing) {
    if (existing.status === 'in_progress') {
      res.status(409).setHeader('Retry-After', 2).json({
        error: 'Conflict: A request with this Idempotency-Key is currently being processed. Please retry in a few seconds.',
        idempotency_key: idempotencyKey,
      });
      return;
    }

    if (existing.status === 'completed') {
      res.setHeader('X-Cache-Lookup', 'HIT');
      res.setHeader('X-Idempotent-Replay', 'true');
      res.status(existing.statusCode).json(existing.body);
      return;
    }
  }

  // Mark key in-progress
  idempotencyManager.setInProgress(cleanKey);

  // Intercept response to capture and cache completed payload
  const originalJson = res.json.bind(res);
  res.json = (body: any): Response => {
    idempotencyManager.complete(cleanKey, res.statusCode, {}, body);
    return originalJson(body);
  };

  next();
}
