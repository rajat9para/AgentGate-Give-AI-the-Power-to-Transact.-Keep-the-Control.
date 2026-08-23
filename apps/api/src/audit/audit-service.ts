// ============================================================
// AgentGate — Tamper-Evident Audit Ledger
// Implements cryptographic SHA-256 hash chaining across all audit events
// ============================================================

import type { AuditLog, PolicyDecision } from '../types.js';
import { db } from '../db/database.js';
import { canonicalStringify, sha256 } from '../crypto/canonical.js';

export interface AuditLogInput {
  agent_id: string;
  user_id: string;
  merchant_id: string | null;
  session_id: string;
  action: string;
  requested_amount: number | null;
  approved_amount: number | null;
  reason: string;
  policy_id?: string | null;
  policy_result?: PolicyDecision | null;
  payment_id?: string | null;
  order_id?: string | null;
  result: 'success' | 'failed' | 'blocked' | 'pending';
  authorization_id?: string | null;
  policy_version?: number | null;
  policy_hash?: string | null;
  request_hash?: string | null;
  nonce?: string | null;
  key_id?: string | null;
  verification_result?: string | null;
  reservation_result?: string | null;
}

export interface AuditChainVerificationResult {
  valid: boolean;
  totalEvents: number;
  brokenIndex?: number;
  reason?: string;
}

class AuditService {
  private lastEventHash: string = 'GENESIS';

  constructor() {
    this.recomputeLastHash();
  }

  private recomputeLastHash(): void {
    const all = db.getAllAuditLogs().sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    if (all.length > 0) {
      this.lastEventHash = all[all.length - 1].event_hash || 'GENESIS';
    } else {
      this.lastEventHash = 'GENESIS';
    }
  }

  /**
   * Computes the cryptographic event hash for an audit log entry given its previous hash.
   */
  public computeEventHash(logWithoutHash: Omit<AuditLog, 'event_hash'>, previousEventHash: string): string {
    const canonicalPayload = canonicalStringify({
      id: logWithoutHash.id,
      agent_id: logWithoutHash.agent_id,
      user_id: logWithoutHash.user_id,
      merchant_id: logWithoutHash.merchant_id,
      session_id: logWithoutHash.session_id,
      action: logWithoutHash.action,
      requested_amount: logWithoutHash.requested_amount,
      approved_amount: logWithoutHash.approved_amount,
      reason: logWithoutHash.reason,
      policy_id: logWithoutHash.policy_id,
      policy_result: logWithoutHash.policy_result,
      payment_id: logWithoutHash.payment_id,
      order_id: logWithoutHash.order_id,
      timestamp: logWithoutHash.timestamp,
      result: logWithoutHash.result,
      authorization_id: logWithoutHash.authorization_id || null,
      policy_version: logWithoutHash.policy_version || null,
      policy_hash: logWithoutHash.policy_hash || null,
      request_hash: logWithoutHash.request_hash || null,
      nonce: logWithoutHash.nonce || null,
      key_id: logWithoutHash.key_id || null,
      verification_result: logWithoutHash.verification_result || null,
      reservation_result: logWithoutHash.reservation_result || null,
      previous_event_hash: previousEventHash,
    });

    return sha256(canonicalPayload);
  }

  /**
   * Logs a new event and cryptographically chains it to the previous event hash.
   */
  public log(input: AuditLogInput): AuditLog {
    this.recomputeLastHash();
    const previousHash = this.lastEventHash;
    const timestamp = new Date().toISOString();

    const partialLog: Omit<AuditLog, 'event_hash'> = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      agent_id: input.agent_id,
      user_id: input.user_id,
      merchant_id: input.merchant_id,
      session_id: input.session_id,
      action: input.action,
      requested_amount: input.requested_amount,
      approved_amount: input.approved_amount,
      reason: input.reason,
      policy_id: input.policy_id || null,
      policy_result: input.policy_result || null,
      payment_id: input.payment_id || null,
      order_id: input.order_id || null,
      timestamp,
      result: input.result,
      previous_event_hash: previousHash,
      authorization_id: input.authorization_id || null,
      policy_version: input.policy_version || null,
      policy_hash: input.policy_hash || null,
      request_hash: input.request_hash || null,
      nonce: input.nonce || null,
      key_id: input.key_id || null,
      verification_result: input.verification_result || null,
      reservation_result: input.reservation_result || null,
    };

    const eventHash = this.computeEventHash(partialLog, previousHash);
    const completeLog: AuditLog = {
      ...partialLog,
      event_hash: eventHash,
    };

    db.createAuditLog(completeLog);
    this.lastEventHash = eventHash;
    return completeLog;
  }

  /**
   * Verifies the cryptographic integrity of the entire audit chain.
   * Detects: field tampering, event deletions, insertions, and reorderings.
   */
  public verifyChain(logsToVerify?: AuditLog[]): AuditChainVerificationResult {
    const logs = logsToVerify
      ? [...logsToVerify]
      : db.getAllAuditLogs().sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (logs.length === 0) {
      return { valid: true, totalEvents: 0 };
    }

    let expectedPrevHash = 'GENESIS';

    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];

      // Verify previous_event_hash link
      if (log.previous_event_hash !== expectedPrevHash) {
        return {
          valid: false,
          totalEvents: logs.length,
          brokenIndex: i,
          reason: `Chain broken at event #${i} (${log.id}): expected previous_event_hash "${expectedPrevHash}", but found "${log.previous_event_hash}". Possible event deletion, insertion, or reordering.`,
        };
      }

      // Recompute and verify current event_hash
      const computedHash = this.computeEventHash(log, log.previous_event_hash);
      if (log.event_hash !== computedHash) {
        return {
          valid: false,
          totalEvents: logs.length,
          brokenIndex: i,
          reason: `Tampering detected at event #${i} (${log.id}): stored event_hash "${log.event_hash}" does not match recomputed hash "${computedHash}". Record payload was modified.`,
        };
      }

      expectedPrevHash = log.event_hash;
    }

    return {
      valid: true,
      totalEvents: logs.length,
    };
  }

  public getTrailBySession(sessionId: string): AuditLog[] {
    return db.getAuditLogsBySession(sessionId);
  }

  public getTrailByOrder(orderId: string): AuditLog[] {
    return db.getAuditLogsByOrder(orderId);
  }

  public getAll(): AuditLog[] {
    return db.getAllAuditLogs();
  }

  public resetGenesis(): void {
    this.lastEventHash = 'GENESIS';
  }
}

export const auditService = new AuditService();

/**
 * Legacy functional adapter for backward compatibility.
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
  authorizationId?: string | null;
}): AuditLog {
  return auditService.log({
    agent_id: params.agentId,
    user_id: params.userId,
    merchant_id: params.merchantId,
    session_id: params.sessionId,
    action: params.action,
    requested_amount: params.requestedAmount,
    approved_amount: params.approvedAmount,
    reason: params.reason,
    policy_result: params.policyResult,
    payment_id: params.paymentId,
    order_id: params.orderId,
    result: params.result,
    authorization_id: params.authorizationId || null,
  });
}

export function getAuditTrail(sessionId: string): AuditLog[] {
  return auditService.getTrailBySession(sessionId);
}

export function getOrderAuditTrail(orderId: string): AuditLog[] {
  return auditService.getTrailByOrder(orderId);
}

export function getAllAuditLogs(): AuditLog[] {
  return auditService.getAll();
}

export function verifyAuditChain(logs?: AuditLog[]): AuditChainVerificationResult {
  return auditService.verifyChain(logs);
}
