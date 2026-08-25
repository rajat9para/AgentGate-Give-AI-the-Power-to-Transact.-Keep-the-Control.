// ============================================================
// AgentGate — Validation Middleware (Zod Edge Enforcement)
// ============================================================

import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';

/**
 * Validates req.body against a Zod schema.
 * Rejects with 400 Bad Request if validation fails.
 */
export function validateBody(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err: any) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: 'Bad Request: Input validation failed.',
          validation_errors: err.flatten().fieldErrors,
          issues: err.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        });
        return;
      }
      res.status(400).json({ error: 'Malformed request body.' });
    }
  };
}

/**
 * Validates req.query against a Zod schema.
 */
export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      (req.query as any) = schema.parse(req.query);
      next();
    } catch (err: any) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: 'Bad Request: Query parameter validation failed.',
          validation_errors: err.flatten().fieldErrors,
          issues: err.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        });
        return;
      }
      res.status(400).json({ error: 'Invalid query parameters.' });
    }
  };
}

/**
 * Validates req.params against a Zod schema.
 */
export function validateParams(schema: ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      (req.params as any) = schema.parse(req.params);
      next();
    } catch (err: any) {
      if (err instanceof ZodError) {
        res.status(400).json({
          error: 'Bad Request: URL parameter validation failed.',
          validation_errors: err.flatten().fieldErrors,
        });
        return;
      }
      res.status(400).json({ error: 'Invalid URL parameters.' });
    }
  };
}
