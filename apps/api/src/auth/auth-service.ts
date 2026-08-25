// ============================================================
// AgentGate — Authentication & Identity Service
// Handles cryptographically verified User JWTs & Scoped Agent Session Tokens
// ============================================================

import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';

export interface UserAuthClaims {
  type: 'user_session';
  userId: string;
  email: string;
  role: 'buyer' | 'merchant' | 'admin';
  name?: string;
  iat?: number;
  exp?: number;
}

export interface AgentAuthClaims {
  type: 'agent_session';
  userId: string;
  agentId: string;
  sessionId: string;
  role: 'buyer';
  scopes: string[]; // e.g. ['buyer:intent', 'buyer:execute', 'policy:read']
  iat?: number;
  exp?: number;
}

export type AuthClaims = UserAuthClaims | AgentAuthClaims;

export interface TokenVerificationResult {
  valid: boolean;
  claims?: AuthClaims;
  error?: string;
}

class AuthService {
  private jwtSecret: string;

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || process.env.SUPABASE_JWT_SECRET || 'agentgate-production-jwt-hmac-sha256-secret-key-2026';
  }

  /**
   * Generates a signed User Session Token for authenticated users.
   */
  public generateUserToken(user: { id: string; email: string; name?: string; role?: 'buyer' | 'merchant' | 'admin' }, expiresIn: string = '7d'): string {
    const payload: Omit<UserAuthClaims, 'iat' | 'exp'> = {
      type: 'user_session',
      userId: user.id,
      email: user.email,
      name: user.name || user.email,
      role: user.role || 'buyer',
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn } as jwt.SignOptions);
  }

  /**
   * Generates a short-lived, permission-scoped Agent Session Token.
   * AI Agents hold ONLY this token to execute tasks on behalf of a user.
   */
  public generateAgentSessionToken(params: {
    userId: string;
    agentId?: string;
    sessionId?: string;
    scopes?: string[];
    expiresInSeconds?: number;
  }): { token: string; sessionId: string; expiresAt: string; scopes: string[] } {
    const {
      userId,
      agentId = 'buyer-agent',
      sessionId = `sess_${uuidv4()}`,
      scopes = ['buyer:intent', 'buyer:execute', 'policy:read', 'history:read'],
      expiresInSeconds = 3600, // 1 hour default TTL
    } = params;

    const expiresAtMs = Date.now() + expiresInSeconds * 1000;
    const payload: Omit<AgentAuthClaims, 'iat' | 'exp'> = {
      type: 'agent_session',
      userId,
      agentId,
      sessionId,
      role: 'buyer',
      scopes,
    };

    const token = jwt.sign(payload, this.jwtSecret, {
      expiresIn: expiresInSeconds,
    });

    return {
      token,
      sessionId,
      expiresAt: new Date(expiresAtMs).toISOString(),
      scopes,
    };
  }

  /**
   * Verifies and decodes a JWT token.
   * Fails closed on signature mismatch, expiration, or malformed claims.
   */
  public verifyToken(token: string): TokenVerificationResult {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Missing or empty authorization token.' };
    }

    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      if (!decoded || !decoded.userId || !decoded.type) {
        return { valid: false, error: 'Malformed token payload: missing userId or type.' };
      }

      if (decoded.type !== 'user_session' && decoded.type !== 'agent_session') {
        return { valid: false, error: `Invalid token type "${decoded.type}".` };
      }

      return {
        valid: true,
        claims: decoded as AuthClaims,
      };
    } catch (err: any) {
      if (err instanceof jwt.TokenExpiredError) {
        return { valid: false, error: 'Authorization token has expired. Please re-authenticate.' };
      }
      return { valid: false, error: `Token verification failed: ${err.message || 'Invalid signature'}` };
    }
  }

  /**
   * Helper to fetch or create a default demo user token.
   */
  public getDemoUserToken(userId: string = 'demo-buyer-001'): string {
    const user = db.getUser(userId) || {
      id: userId,
      email: `${userId}@agentgate.demo`,
      name: 'Demo Buyer',
      role: 'buyer' as const,
      created_at: new Date().toISOString(),
    };

    return this.generateUserToken(user, '30d');
  }
}

export const authService = new AuthService();
