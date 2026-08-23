// ============================================================
// AgentGate — Supabase PostgreSQL Client & Persistence Adapter
// Handles privileged server-side database operations for AgentGate
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import type { Order, Payment, AuditLog, UserPolicy } from '../types.js';
import type { TransactionAuthorization } from '../crypto/authorization.js';
import type { SpendingReservation } from '../crypto/budget-reservation.js';

export class SupabaseDatabaseService {
  private client: SupabaseClient | null = null;
  public isConnected: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    if (config.supabase.isConfigured) {
      try {
        this.client = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });
        this.isConnected = true;
        console.log('[Supabase] Privileged PostgreSQL client initialized successfully.');
      } catch (err: any) {
        console.warn('[Supabase] Could not initialize client, running in in-memory mode:', err?.message);
        this.client = null;
        this.isConnected = false;
      }
    } else {
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Health check for Supabase connection.
   */
  public async checkHealth(): Promise<{ status: 'healthy' | 'unconfigured' | 'unreachable'; message: string }> {
    if (!this.client || !config.supabase.isConfigured) {
      return { status: 'unconfigured', message: 'Supabase credentials not configured. Running in-memory store.' };
    }

    try {
      const { error } = await this.client.from('merchants').select('id').limit(1);
      if (error) {
        return { status: 'unreachable', message: error.message };
      }
      return { status: 'healthy', message: 'Supabase PostgreSQL connected & responsive.' };
    } catch (err: any) {
      return { status: 'unreachable', message: err?.message || 'Connection failed' };
    }
  }

  /**
   * Persist a cryptographically signed TransactionAuthorization.
   */
  public async persistAuthorization(auth: TransactionAuthorization): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.from('transaction_authorizations').upsert({
        authorization_id: auth.authorization_id,
        schema_version: auth.schema_version,
        user_id: auth.user_id,
        agent_id: auth.agent_id,
        merchant_id: auth.merchant_id,
        purpose: auth.purpose,
        category: auth.category,
        amount: auth.amount,
        currency: auth.currency,
        allowed_payment_methods: auth.allowed_payment_methods,
        policy_version: auth.policy_version,
        policy_hash: auth.policy_hash,
        request_hash: auth.request_hash,
        issued_at: auth.issued_at,
        expires_at: auth.expires_at,
        nonce: auth.nonce,
        key_id: auth.key_id,
        signature: auth.signature,
        status: 'active',
      });
    } catch (err: any) {
      console.error('[Supabase] Failed to persist transaction authorization:', err?.message);
    }
  }

  /**
   * Persist a consumed nonce to enforce atomic replay protection in PostgreSQL.
   */
  public async persistNonceConsumption(nonce: string, authorizationId: string): Promise<boolean> {
    if (!this.client) return true;

    try {
      const { error } = await this.client.from('authorization_nonces').insert({
        nonce,
        authorization_id: authorizationId,
        consumed_at: new Date().toISOString(),
      });

      return !error;
    } catch (err: any) {
      console.error('[Supabase] Failed to persist nonce consumption:', err?.message);
      return false;
    }
  }

  /**
   * Persist an atomic spending reservation.
   */
  public async persistReservation(res: SpendingReservation): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.from('spending_reservations').upsert({
        reservation_id: res.reservationId,
        user_id: res.userId,
        authorization_id: res.authorizationId,
        amount: res.amount,
        status: res.status,
        expires_at: new Date(res.expiresAt).toISOString(),
        committed_at: res.committedAt ? new Date(res.committedAt).toISOString() : null,
        released_at: res.releasedAt ? new Date(res.releasedAt).toISOString() : null,
      });
    } catch (err: any) {
      console.error('[Supabase] Failed to persist spending reservation:', err?.message);
    }
  }

  /**
   * Persist an order to PostgreSQL.
   */
  public async persistOrder(order: Order): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.from('orders').upsert({
        id: order.id,
        user_id: order.user_id,
        merchant_id: order.merchant_id,
        status: order.status,
        total_amount: order.total_amount,
        negotiated_amount: order.negotiated_amount,
        currency: order.currency,
        razorpay_order_id: order.razorpay_order_id,
        payment_id: order.payment_id,
        agent_session_id: order.agent_session_id,
        items: order.items,
        updated_at: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('[Supabase] Failed to persist order:', err?.message);
    }
  }

  /**
   * Persist a payment attempt.
   */
  public async persistPayment(payment: Payment): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.from('payment_attempts').upsert({
        id: payment.id,
        order_id: payment.order_id,
        razorpay_payment_id: payment.razorpay_payment_id,
        razorpay_order_id: payment.razorpay_order_id,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        failure_reason: payment.failure_reason,
        is_recovery_attempt: payment.is_recovery_attempt,
        recovery_attempt_number: payment.recovery_attempt_number,
      });
    } catch (err: any) {
      console.error('[Supabase] Failed to persist payment attempt:', err?.message);
    }
  }

  /**
   * Persist a tamper-evident audit event with SHA-256 hash chaining.
   */
  public async persistAuditEvent(log: AuditLog): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.from('audit_events').insert({
        id: log.id,
        event_hash: log.event_hash,
        previous_event_hash: log.previous_event_hash,
        session_id: log.session_id,
        user_id: log.user_id,
        merchant_id: log.merchant_id,
        agent_id: log.agent_id,
        action: log.action,
        requested_amount: log.requested_amount,
        approved_amount: log.approved_amount,
        reason: log.reason,
        policy_result: log.policy_result,
        policy_id: log.policy_id,
        policy_version: log.policy_version,
        policy_hash: log.policy_hash,
        request_hash: log.request_hash,
        authorization_id: log.authorization_id,
        nonce: log.nonce,
        key_id: log.key_id,
        payment_id: log.payment_id,
        order_id: log.order_id,
        result: log.result,
        verification_result: log.verification_result,
        reservation_result: log.reservation_result,
        timestamp: log.timestamp,
      });
    } catch (err: any) {
      console.error('[Supabase] Failed to persist audit event:', err?.message);
    }
  }
}

export const supabaseDb = new SupabaseDatabaseService();
