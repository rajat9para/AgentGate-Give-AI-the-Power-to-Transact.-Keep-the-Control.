// ============================================================
// AgentGate — Payment Policy Engine (Deterministic)
// Manages fallback chain and retry limits
// ============================================================

import type { PaymentMethod, UserPolicy } from '../types.js';
import { db } from '../db/database.js';

const MAX_RETRIES_PER_METHOD = 1;
const MAX_TOTAL_RECOVERY_ATTEMPTS = 3;

/**
 * Get the next payment method to try after a failure.
 */
export function getNextPaymentMethod(
  userId: string,
  failedMethod: PaymentMethod,
  attemptsSoFar: number
): { method: PaymentMethod | null; action: 'retry' | 'fallback' | 'payment_link' | 'stop'; reason: string } {
  const policy = db.getUserPolicy(userId);

  if (!policy) {
    return { method: null, action: 'stop', reason: 'No user policy found. Cannot recover payment.' };
  }

  if (attemptsSoFar >= MAX_TOTAL_RECOVERY_ATTEMPTS) {
    return { method: null, action: 'stop', reason: `Maximum recovery attempts (${MAX_TOTAL_RECOVERY_ATTEMPTS}) reached. Stopping safely.` };
  }

  const fallbackChain = policy.fallback_payments;
  const failedIndex = fallbackChain.indexOf(failedMethod);

  // Try the next method in the fallback chain
  for (let i = failedIndex + 1; i < fallbackChain.length; i++) {
    const nextMethod = fallbackChain[i];
    return {
      method: nextMethod,
      action: 'fallback',
      reason: `${failedMethod} failed. Falling back to authorized method: ${nextMethod}.`,
    };
  }

  // If no more methods, try payment link
  if (attemptsSoFar < MAX_TOTAL_RECOVERY_ATTEMPTS) {
    return {
      method: 'payment_link',
      action: 'payment_link',
      reason: `All direct payment methods exhausted. Generating a payment link as last resort.`,
    };
  }

  return {
    method: null,
    action: 'stop',
    reason: 'All authorized payment methods exhausted. No recovery possible. Stopping safely.',
  };
}

/**
 * Check if a payment method is authorized for the user.
 */
export function isPaymentMethodAuthorized(userId: string, method: PaymentMethod): boolean {
  const policy = db.getUserPolicy(userId);
  if (!policy) return false;
  return policy.fallback_payments.includes(method);
}

/**
 * Get the full fallback chain for a user.
 */
export function getPaymentFallbackChain(userId: string): PaymentMethod[] {
  const policy = db.getUserPolicy(userId);
  if (!policy) return [];
  return [...policy.fallback_payments];
}
