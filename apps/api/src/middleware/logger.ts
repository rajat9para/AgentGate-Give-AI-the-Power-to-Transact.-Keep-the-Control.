// ============================================================
// AgentGate — Structured Logging & Correlation ID Middleware
// ============================================================

import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function requestCorrelationMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = (req.headers['x-request-id'] as string) || `req_${uuidv4().slice(0, 12)}`;
  req.headers['x-request-id'] = correlationId;
  res.setHeader('X-Request-ID', correlationId);

  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      timestamp: new Date().toISOString(),
      correlation_id: correlationId,
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      duration_ms: duration,
      user_agent: req.headers['user-agent'] || 'unknown',
      ip: req.ip || req.socket.remoteAddress,
    };

    // Output structured JSON log
    if (res.statusCode >= 500) {
      console.error(JSON.stringify({ level: 'ERROR', ...logData }));
    } else if (res.statusCode >= 400) {
      console.warn(JSON.stringify({ level: 'WARN', ...logData }));
    } else {
      console.log(JSON.stringify({ level: 'INFO', ...logData }));
    }
  });

  next();
}
