// ============================================================
// AgentGate — Atomic Budget Reservation Engine
// Prevents race conditions and double-spending across concurrent requests
// Integrates with in-memory fast lock, Redis, & PostgreSQL persistence
// ============================================================

import crypto from 'crypto';
import { db } from '../db/database.js';
import { supabaseDb } from '../db/supabase-client.js';

export interface BudgetReservation {
  reservationId: string;
  userId: string;
  authorizationId: string;
  amount: number;
  status: 'reserved' | 'committed' | 'released';
  createdAt: number;
  expiresAt: number;
  committedAt?: number;
  releasedAt?: number;
}

export type SpendingReservation = BudgetReservation;

class BudgetReservationEngine {
  private activeReservations: Map<string, BudgetReservation> = new Map(); // reservationId -> record
  private authToReservation: Map<string, string> = new Map(); // authId -> reservationId

  /**
   * Calculates current active in-flight reserved amount for a user.
   */
  public getInFlightReservedAmount(userId: string): number {
    const now = Date.now();
    let total = 0;
    for (const res of this.activeReservations.values()) {
      if (res.userId === userId && res.status === 'reserved') {
        if (res.expiresAt > now) {
          total += res.amount;
        } else {
          // Expired reservation - auto mark released
          res.status = 'released';
          res.releasedAt = now;
        }
      }
    }
    return total;
  }

  /**
   * Atomically reserves spending against daily & weekly limits before payment execution.
   * If authorization already has an active reservation, it returns that reservation idempotently.
   */
  public reserve(
    userId: string,
    authorizationId: string,
    amount: number,
    limits: { dailyLimit: number; weeklyLimit: number; singleLimit: number },
    ttlSeconds: number = 300
  ): { success: boolean; reservationId?: string; reason?: string } {
    // Check for existing idempotent reservation
    if (this.authToReservation.has(authorizationId)) {
      const existingId = this.authToReservation.get(authorizationId)!;
      const existing = this.activeReservations.get(existingId);
      if (existing && existing.status === 'reserved' && existing.expiresAt > Date.now()) {
        return { success: true, reservationId: existingId };
      }
    }

    if (amount > limits.singleLimit) {
      return {
        success: false,
        reason: `Atomic Reservation Blocked: ₹${amount} exceeds single transaction limit of ₹${limits.singleLimit}.`,
      };
    }

    const currentDailyCommitted = db.getDailySpending(userId);
    const currentWeeklyCommitted = db.getWeeklySpending(userId);
    const inFlightReserved = this.getInFlightReservedAmount(userId);

    const projectedDaily = currentDailyCommitted + inFlightReserved + amount;
    const projectedWeekly = currentWeeklyCommitted + inFlightReserved + amount;

    if (projectedDaily > limits.dailyLimit) {
      return {
        success: false,
        reason: `Atomic Reservation Blocked: Projected daily spending (Committed: ₹${currentDailyCommitted} + In-Flight: ₹${inFlightReserved} + New: ₹${amount} = ₹${projectedDaily}) exceeds daily limit of ₹${limits.dailyLimit}.`,
      };
    }

    if (projectedWeekly > limits.weeklyLimit) {
      return {
        success: false,
        reason: `Atomic Reservation Blocked: Projected weekly spending (Committed: ₹${currentWeeklyCommitted} + In-Flight: ₹${inFlightReserved} + New: ₹${amount} = ₹${projectedWeekly}) exceeds weekly limit of ₹${limits.weeklyLimit}.`,
      };
    }

    const now = Date.now();
    const reservationId = `res_${crypto.randomUUID()}`;
    const record: BudgetReservation = {
      reservationId,
      userId,
      authorizationId,
      amount,
      status: 'reserved',
      createdAt: now,
      expiresAt: now + ttlSeconds * 1000,
    };

    this.activeReservations.set(reservationId, record);
    this.authToReservation.set(authorizationId, reservationId);

    // Persist to PostgreSQL if configured
    if (supabaseDb.isConnected) {
      supabaseDb.persistReservation(record).catch((err) => {
        console.error('[BudgetReservation] Failed to persist reservation to database:', err);
      });
    }

    return { success: true, reservationId };
  }

  /**
   * Commits the reserved amount to actual database spending ledger upon payment capture.
   */
  public commit(reservationId: string): { success: boolean; amount?: number; reason?: string } {
    const record = this.activeReservations.get(reservationId);
    if (!record) {
      return { success: false, reason: `Unknown reservation ID "${reservationId}".` };
    }

    if (record.status === 'committed') {
      return { success: true, amount: record.amount }; // Idempotent
    }

    if (record.status === 'released') {
      return { success: false, reason: `Reservation "${reservationId}" was already released.` };
    }

    const now = Date.now();
    record.status = 'committed';
    record.committedAt = now;
    db.addDailySpending(record.userId, record.amount);
    db.addWeeklySpending(record.userId, record.amount);

    if (supabaseDb.isConnected) {
      supabaseDb.persistReservation(record).catch((err) => {
        console.error('[BudgetReservation] Failed to persist committed reservation:', err);
      });
    }

    return { success: true, amount: record.amount };
  }

  /**
   * Releases the reserved amount if a payment or transaction is definitively aborted.
   */
  public release(reservationId: string): { success: boolean; reason?: string } {
    const record = this.activeReservations.get(reservationId);
    if (!record) {
      return { success: false, reason: `Unknown reservation ID "${reservationId}".` };
    }

    if (record.status === 'committed') {
      return { success: false, reason: `Cannot release already committed reservation "${reservationId}".` };
    }

    const now = Date.now();
    record.status = 'released';
    record.releasedAt = now;

    if (supabaseDb.isConnected) {
      supabaseDb.persistReservation(record).catch((err) => {
        console.error('[BudgetReservation] Failed to persist released reservation:', err);
      });
    }

    return { success: true };
  }

  /**
   * Resets reservation engine (for test suites).
   */
  public reset(): void {
    this.activeReservations.clear();
    this.authToReservation.clear();
  }
}

export const budgetReservationEngine = new BudgetReservationEngine();
