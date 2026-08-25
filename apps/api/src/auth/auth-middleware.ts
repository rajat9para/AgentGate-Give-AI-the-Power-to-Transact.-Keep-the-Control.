// ============================================================
// AgentGate — Authentication & Authorization Middleware
// Enforces caller identity verification and permission scopes
// ============================================================

import type { Request, Response, NextFunction } from 'express';
import { authService, type AuthClaims } from './auth-service.js';
import { config } from '../config.js';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthClaims;
      rawToken?: string;
    }
  }
}

/**
 * Extracts Bearer token from Authorization header or cookies.
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // Also support custom agent token header
  const agentTokenHeader = req.headers['x-agent-session-token'];
  if (typeof agentTokenHeader === 'string' && agentTokenHeader.trim()) {
    return agentTokenHeader.trim();
  }

  return null;
}

/**
 * Core Authentication Middleware.
 * Decodes and cryptographically validates JWT token.
 * Populates req.user with verified claims.
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (token) {
    const result = authService.verifyToken(token);
    if (!result.valid || !result.claims) {
      res.status(401).json({
        error: 'Unauthorized: Invalid or expired authorization token.',
        details: result.error,
      });
      return;
    }

    req.user = result.claims;
    req.rawToken = token;
    next();
    return;
  }

  // Fallback for demo/development environments if enabled
  if (config.demoMode || config.nodeEnv === 'development' || config.nodeEnv === 'test') {
    const explicitUserId = (req.headers['x-agentgate-user-id'] as string) || (req.body?.user_id as string) || (req.query?.user_id as string) || 'demo-buyer-001';
    
    // Synthesize verified demo identity
    req.user = {
      type: 'user_session',
      userId: explicitUserId,
      email: `${explicitUserId}@agentgate.demo`,
      role: 'buyer',
      name: 'Demo Buyer',
    };
    next();
    return;
  }

  res.status(401).json({
    error: 'Unauthorized: Missing Authorization header (Bearer <token>).',
  });
}

/**
 * Strict authentication guard: fails closed with 401 if user is not authenticated.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !req.user.userId) {
    authenticateToken(req, res, () => {
      if (!req.user || !req.user.userId) {
        res.status(401).json({ error: 'Unauthorized: Authentication required.' });
        return;
      }
      next();
    });
    return;
  }
  next();
}

/**
 * Enforces that only direct human user sessions can access this endpoint.
 * Blocks agent session tokens from mutating security boundaries or critical limits.
 */
export function requireUserSession(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.type !== 'user_session') {
      res.status(403).json({
        error: 'Forbidden: This action requires a direct human user session and cannot be performed by an autonomous agent token.',
      });
      return;
    }
    next();
  });
}

/**
 * Enforces that an agent session has the specified permission scope.
 */
export function requireScope(requiredScope: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    requireAuth(req, res, () => {
      if (req.user?.type === 'user_session') {
        // User session has all scopes
        next();
        return;
      }

      if (req.user?.type === 'agent_session') {
        if (req.user.scopes.includes(requiredScope) || req.user.scopes.includes('*')) {
          next();
          return;
        }

        res.status(403).json({
          error: `Forbidden: Agent session lacks required scope "${requiredScope}".`,
          granted_scopes: req.user.scopes,
        });
        return;
      }

      res.status(401).json({ error: 'Unauthorized' });
    });
  };
}
