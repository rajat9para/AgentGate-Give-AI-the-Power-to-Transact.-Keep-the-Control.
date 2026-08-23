// ============================================================
// AgentGate — Centralized Error Handling & Timeout Middleware
// ============================================================

import type { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

export function requestTimeoutMiddleware(req: Request, res: Response, next: NextFunction) {
  const timeoutMs = config.requestTimeoutMs || 30000;
  res.setTimeout(timeoutMs, () => {
    if (!res.headersSent) {
      res.status(504).json({
        error: 'Gateway Timeout',
        message: `Request exceeded maximum timeout of ${timeoutMs}ms`,
      });
    }
  });
  next();
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl || req.url,
    method: req.method,
  });
}

export function centralizedErrorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const correlationId = (req.headers['x-request-id'] as string) || 'unknown';
  const statusCode = err.status || err.statusCode || 500;

  console.error(`[ErrorHandler] [${correlationId}] Unhandled exception:`, {
    message: err.message,
    stack: config.nodeEnv === 'development' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method,
  });

  if (!res.headersSent) {
    res.status(statusCode).json({
      error: err.name || 'InternalServerError',
      message: config.nodeEnv === 'production' && statusCode === 500
        ? 'An unexpected error occurred. Please contact support with the correlation ID.'
        : err.message || 'Internal Server Error',
      correlation_id: correlationId,
    });
  }
}
