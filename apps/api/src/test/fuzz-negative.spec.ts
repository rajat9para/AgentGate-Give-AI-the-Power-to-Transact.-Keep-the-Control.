// ============================================================
// AgentGate — Negative & Fuzz Testing Suite (Vitest)
// Tests: Boundary Conditions, Malformed Payloads, Cross-User Access,
// Cryptographic Tampering, Replays, & Security Anomaly Lockouts
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../index.js';
import { db, initializeDatabase } from '../db/database.js';
import { authService } from '../auth/auth-service.js';
import { keyManager } from '../crypto/key-manager.js';
import { createTransactionAuthorization, verifyTransactionAuthorization, type TransactionRequest } from '../crypto/authorization.js';
import { nonceStore } from '../crypto/nonce-store.js';
import { budgetReservationEngine } from '../crypto/budget-reservation.js';
import type { UserPolicy } from '../types.js';

describe('Negative & Security Fuzz Testing', () => {
  beforeEach(() => {
    initializeDatabase();
    nonceStore.reset();
    budgetReservationEngine.reset();
  });

  describe('Boundary & Malformed Payloads', () => {
    it('rejects string values for numeric policy fields with 400 Bad Request', async () => {
      const token = authService.getDemoUserToken();
      const res = await request(app)
        .put('/api/buyer/policy')
        .set('Authorization', `Bearer ${token}`)
        .send({
          single_transaction_limit: 'five thousand',
        });

      expect(res.status).toBe(400);
      expect(res.body.validation_errors.single_transaction_limit).toBeDefined();
    });

    it('rejects massive integer overflow attempts', async () => {
      const token = authService.getDemoUserToken();
      const res = await request(app)
        .put('/api/buyer/policy')
        .set('Authorization', `Bearer ${token}`)
        .send({
          single_transaction_limit: 99999999999999,
        });

      expect(res.status).toBe(400);
    });

    it('rejects non-array types for allowed_categories', async () => {
      const token = authService.getDemoUserToken();
      const res = await request(app)
        .put('/api/buyer/policy')
        .set('Authorization', `Bearer ${token}`)
        .send({
          allowed_categories: 'running_shoes', // Should be array
        });

      expect(res.status).toBe(400);
      expect(res.body.validation_errors.allowed_categories).toBeDefined();
    });

    it('rejects negative refund ceilings on merchant policy', async () => {
      const res = await request(app)
        .put('/api/merchants/merchant-runpro/policy')
        .send({
          auto_refund_max: -1000,
        });

      expect(res.status).toBe(400);
      expect(res.body.validation_errors.auto_refund_max).toBeDefined();
    });
  });

  describe('Cross-User Resource Isolation', () => {
    it('forces caller to their own policy even if they request another user_id in query string', async () => {
      const buyer1Token = authService.generateUserToken({
        id: 'user_attacker_01',
        email: 'attacker@agentgate.io',
        role: 'buyer',
      });

      // Create policy for attacker
      db.createUserPolicy({
        user_id: 'user_attacker_01',
        single_transaction_limit: 1000,
        daily_limit: 2000,
        weekly_limit: 5000,
        autonomous_purchase: true,
        allowed_categories: ['running_shoes'],
        negotiation: true,
        fallback_payments: ['upi', 'card'],
        opportunity_alerts: true,
        max_opportunity_overshoot: 0.2,
        min_opportunity_improvement: 0.08,
      });

      // Attacker tries to view demo-buyer-001's policy
      const res = await request(app)
        .get('/api/buyer/policy?user_id=demo-buyer-001')
        .set('Authorization', `Bearer ${buyer1Token}`);

      expect(res.status).toBe(200);
      // Returned policy must be attacker's own policy, not victim's!
      expect(res.body.policy.user_id).toBe('user_attacker_01');
      expect(res.body.policy.daily_limit).toBe(2000);
    });
  });

  describe('Cryptographic Fuzzing & Tamper Rejection', () => {
    it('rejects tampered amount in signed TransactionAuthorization', () => {
      const requestPayload: TransactionRequest = {
        user_id: 'demo-buyer-001',
        agent_id: 'buyer-agent',
        merchant_id: 'merchant-runpro',
        amount: 5000,
        currency: 'INR',
        category: 'running_shoes',
        purpose: 'Buy shoes',
        payment_method: 'card',
      };

      const policy = db.getUserPolicy('demo-buyer-001')!;

      const auth = createTransactionAuthorization({
        user_id: requestPayload.user_id,
        agent_id: requestPayload.agent_id,
        purpose: requestPayload.purpose,
        merchant_id: requestPayload.merchant_id,
        category: requestPayload.category,
        amount: requestPayload.amount,
        allowed_payment_methods: ['card', 'upi'],
        policy,
        request: requestPayload,
      });

      // Attacker alters amount from 5000 to 500 without updating signature
      const tamperedAuth = {
        ...auth,
        amount: 500,
      };

      const verification = verifyTransactionAuthorization(tamperedAuth, {
        expectedRequest: requestPayload,
      });

      expect(verification.valid).toBe(false);
      expect(verification.reason?.toLowerCase()).toContain('signature');
    });

    it('rejects expired authorizations', () => {
      const requestPayload: TransactionRequest = {
        user_id: 'demo-buyer-001',
        agent_id: 'buyer-agent',
        merchant_id: 'merchant-runpro',
        amount: 5000,
        currency: 'INR',
        category: 'running_shoes',
        purpose: 'Buy shoes',
        payment_method: 'card',
      };

      const policy = db.getUserPolicy('demo-buyer-001')!;

      // Issue authorization with negative validity (already expired)
      const auth = createTransactionAuthorization({
        user_id: requestPayload.user_id,
        agent_id: requestPayload.agent_id,
        purpose: requestPayload.purpose,
        merchant_id: requestPayload.merchant_id,
        category: requestPayload.category,
        amount: requestPayload.amount,
        allowed_payment_methods: ['card', 'upi'],
        policy,
        request: requestPayload,
        validitySeconds: -10,
      });

      const verification = verifyTransactionAuthorization(auth, {
        expectedRequest: requestPayload,
        clockSkewToleranceSeconds: 0,
      });

      expect(verification.valid).toBe(false);
      expect(verification.reason).toContain('expired');
    });
  });
});
