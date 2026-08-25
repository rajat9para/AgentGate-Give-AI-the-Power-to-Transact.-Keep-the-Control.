// ============================================================
// AgentGate — Auth Routes & Token Issuance Endpoints
// ============================================================

import { Router, type Request, type Response } from 'express';
import { authService } from './auth-service.js';
import { requireAuth, requireUserSession } from './auth-middleware.js';
import { db } from '../db/database.js';

export const authRouter = Router();

/**
 * POST /api/auth/token
 * Issues a User Session Token.
 */
authRouter.post('/token', (req: Request, res: Response) => {
  const { user_id, email, name, role } = req.body;
  const targetUserId = user_id || 'demo-buyer-001';

  let user = db.getUser(targetUserId);
  if (!user) {
    user = {
      id: targetUserId,
      email: email || `${targetUserId}@agentgate.demo`,
      name: name || 'Demo Buyer',
      role: (role as any) || 'buyer',
      created_at: new Date().toISOString(),
    };
    db.createUser(user);
  }

  const token = authService.generateUserToken(user);

  res.json({
    token,
    type: 'Bearer',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

/**
 * POST /api/auth/agent-token
 * Issues a scoped, short-lived Agent Session Token for an authenticated user.
 */
authRouter.post('/agent-token', requireAuth, (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { agent_id, scopes, expires_in_seconds } = req.body;

  const agentSession = authService.generateAgentSessionToken({
    userId,
    agentId: agent_id || 'buyer-agent',
    scopes: Array.isArray(scopes) ? scopes : ['buyer:intent', 'buyer:execute', 'policy:read', 'history:read'],
    expiresInSeconds: typeof expires_in_seconds === 'number' ? expires_in_seconds : 3600,
  });

  res.json({
    token: agentSession.token,
    type: 'Bearer',
    agent_id: agent_id || 'buyer-agent',
    session_id: agentSession.sessionId,
    scopes: agentSession.scopes,
    expires_at: agentSession.expiresAt,
    user_id: userId,
  });
});

/**
 * GET /api/auth/me
 * Returns current authenticated identity and token claims.
 */
authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({
    authenticated: true,
    user: req.user,
  });
});
