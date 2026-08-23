// ============================================================
// AgentGate — Audit Service
// ============================================================

import type { AuditLog, PolicyDecision } from '../types.js';
import { db } from '../db/database.js';

/**
 * Create an audit log entry for a money-related action.
 */
export function createAuditLog(params: {
  agentId: string;
  userId: string;
  merchantId: string | null;
  sessionId: string;
  action: string;
  requestedAmount: number | null;
  approvedAmount: number | null;
  reason: string;
  policyResult: PolicyDecision | null;
  paymentId: string | null;
  orderId: string | null;
  result: 'success' | 'failed' | 'blocked' | 'pending';
}): AuditLog {
  return db.createAuditLog({
    agent_id: params.agentId,
    user_id: params.userId,
    merchant_id: params.merchantId,
    session_id: params.sessionId,
    action: params.action,
    requested_amount: params.requestedAmount,
    approved_amount: params.approvedAmount,
    reason: params.reason,
    policy_id: null,
    policy_result: params.policyResult,
    payment_id: params.paymentId,
    order_id: params.orderId,
    timestamp: new Date().toISOString(),
    result: params.result,
  });
}

/**
 * Get full audit trail for a transaction/session.
 */
export function getAuditTrail(sessionId: string): AuditLog[] {
  return db.getAuditLogsBySession(sessionId);
}

/**
 * Get audit trail for a specific order.
 */
export function getOrderAuditTrail(orderId: string): AuditLog[] {
  return db.getAuditLogsByOrder(orderId);
}

/**
 * Get all audit logs.
 */
export function getAllAuditLogs(): AuditLog[] {
  return db.getAllAuditLogs();
}
