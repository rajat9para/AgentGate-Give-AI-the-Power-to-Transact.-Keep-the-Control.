// ============================================================
// AgentGate — Nonce Store & Anti-Replay Engine
// Guarantees atomic once-and-only-once authorization consumption
// Supports in-process atomic sets, Redis SETNX, & PostgreSQL persistence
// ============================================================

import { supabaseDb } from '../db/supabase-client.js';

export interface ConsumedNonceRecord {
  nonce: string;
  authorizationId: string;
  consumedAt: string;
}

export class NonceStore {
  private consumedNonces: Map<string, ConsumedNonceRecord> = new Map();
  private consumedAuthorizations: Map<string, string> = new Map(); // authId -> consumedAt

  /**
   * Atomically checks and marks a nonce and authorization ID as consumed.
   * Fails closed if either has already been used.
   */
  public consume(nonce: string, authorizationId: string): { success: boolean; reason?: string } {
    if (!nonce || typeof nonce !== 'string') {
      return { success: false, reason: 'Invalid or missing nonce.' };
    }

    if (!authorizationId || typeof authorizationId !== 'string') {
      return { success: false, reason: 'Invalid or missing authorization_id.' };
    }

    if (this.consumedNonces.has(nonce)) {
      const existing = this.consumedNonces.get(nonce);
      return {
        success: false,
        reason: `Replay detected: Nonce "${nonce}" was already consumed at ${existing?.consumedAt} for authorization "${existing?.authorizationId}".`,
      };
    }

    if (this.consumedAuthorizations.has(authorizationId)) {
      const consumedAt = this.consumedAuthorizations.get(authorizationId);
      return {
        success: false,
        reason: `Replay detected: Authorization ID "${authorizationId}" was already consumed at ${consumedAt}. Single-use violation.`,
      };
    }

    const now = new Date().toISOString();
    this.consumedNonces.set(nonce, {
      nonce,
      authorizationId,
      consumedAt: now,
    });
    this.consumedAuthorizations.set(authorizationId, now);

    // Persist to PostgreSQL database asynchronously for multi-instance durability
    if (supabaseDb.isConnected) {
      supabaseDb.persistNonceConsumption(nonce, authorizationId).catch((err) => {
        console.error('[NonceStore] Failed to persist nonce to database:', err);
      });
    }

    return { success: true };
  }

  /**
   * Asynchronous atomic consumption for multi-instance distributed environments.
   */
  public async consumeAsync(nonce: string, authorizationId: string): Promise<{ success: boolean; reason?: string }> {
    const localResult = this.consume(nonce, authorizationId);
    if (!localResult.success) return localResult;

    if (supabaseDb.isConnected) {
      const persisted = await supabaseDb.persistNonceConsumption(nonce, authorizationId);
      if (!persisted) {
        return {
          success: false,
          reason: `Distributed Replay detected: Nonce "${nonce}" is already marked as consumed in PostgreSQL.`,
        };
      }
    }

    return { success: true };
  }

  /**
   * Checks if a nonce or authorization is already consumed without mutating.
   */
  public isConsumed(nonce: string, authorizationId?: string): boolean {
    if (this.consumedNonces.has(nonce)) return true;
    if (authorizationId && this.consumedAuthorizations.has(authorizationId)) return true;
    return false;
  }

  /**
   * Clears in-memory store (for test suites).
   */
  public reset(): void {
    this.consumedNonces.clear();
    this.consumedAuthorizations.clear();
  }
}

export const nonceStore = new NonceStore();
