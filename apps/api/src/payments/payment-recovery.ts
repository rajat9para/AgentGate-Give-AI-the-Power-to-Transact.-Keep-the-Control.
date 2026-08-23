// ============================================================
// AgentGate — Payment Recovery Engine
// ============================================================

import type { PaymentMethod, Payment, PaymentRecoveryAttempt } from '../types.js';
import { db } from '../db/database.js';
import { getNextPaymentMethod } from '../policy/payment-policy.js';
import { simulatePayment, createRazorpayOrder, createPaymentLink } from './razorpay-service.js';
import { createAuditLog } from '../audit/audit-service.js';

interface RecoveryResult {
  success: boolean;
  finalMethod: PaymentMethod | null;
  payment: Payment | null;
  attempts: PaymentRecoveryAttempt[];
  message: string;
}

/**
 * Attempt to recover a failed payment using the user's fallback chain.
 */
export async function recoverPayment(
  userId: string,
  orderId: string,
  originalAmount: number,
  failedMethod: PaymentMethod,
  sessionId: string
): Promise<RecoveryResult> {
  const attempts: PaymentRecoveryAttempt[] = [];
  let currentMethod = failedMethod;
  let attemptNumber = 1;

  // Log the initial failure
  createAuditLog({
    agentId: 'recovery-agent',
    userId,
    merchantId: null,
    sessionId,
    action: 'payment_failed',
    requestedAmount: originalAmount,
    approvedAmount: null,
    reason: `Payment via ${failedMethod} failed. Initiating recovery.`,
    policyResult: 'AMBER',
    paymentId: null,
    orderId,
    result: 'failed',
  });

  while (attemptNumber <= 3) {
    const nextAction = getNextPaymentMethod(userId, currentMethod, attemptNumber);

    if (nextAction.action === 'stop' || !nextAction.method) {
      // No more recovery options
      createAuditLog({
        agentId: 'recovery-agent',
        userId,
        merchantId: null,
        sessionId,
        action: 'recovery_exhausted',
        requestedAmount: originalAmount,
        approvedAmount: null,
        reason: nextAction.reason,
        policyResult: 'RED',
        paymentId: null,
        orderId,
        result: 'failed',
      });

      return {
        success: false,
        finalMethod: null,
        payment: null,
        attempts,
        message: nextAction.reason,
      };
    }

    const recoveryMethod = nextAction.method;

    // Log recovery attempt
    createAuditLog({
      agentId: 'recovery-agent',
      userId,
      merchantId: null,
      sessionId,
      action: `recovery_attempt_${nextAction.action}`,
      requestedAmount: originalAmount,
      approvedAmount: null,
      reason: nextAction.reason,
      policyResult: 'AMBER',
      paymentId: null,
      orderId,
      result: 'pending',
    });

    if (nextAction.action === 'payment_link') {
      // Create payment link
      const link = await createPaymentLink(
        originalAmount,
        'INR',
        `AgentGate Order ${orderId}`,
        'Demo Buyer',
        'buyer@agentgate.demo'
      );

      const attempt = db.createRecoveryAttempt({
        payment_id: '',
        order_id: orderId,
        attempt_number: attemptNumber,
        method: 'payment_link',
        status: 'success',
        failure_reason: null,
      });
      attempts.push(attempt);

      const payment = db.createPayment({
        order_id: orderId,
        razorpay_payment_id: link.id,
        razorpay_order_id: null,
        amount: originalAmount,
        currency: 'INR',
        method: 'payment_link',
        status: 'created',
        failure_reason: null,
        is_recovery_attempt: true,
        recovery_attempt_number: attemptNumber,
      });

      return {
        success: true,
        finalMethod: 'payment_link',
        payment,
        attempts,
        message: `Payment link generated: ${link.short_url}`,
      };
    }

    // Try the fallback method
    const paymentResult = simulatePayment(recoveryMethod, originalAmount, false);

    const attempt = db.createRecoveryAttempt({
      payment_id: '',
      order_id: orderId,
      attempt_number: attemptNumber,
      method: recoveryMethod,
      status: paymentResult.success ? 'success' : 'failed',
      failure_reason: paymentResult.failureReason,
    });
    attempts.push(attempt);

    if (paymentResult.success) {
      const payment = db.createPayment({
        order_id: orderId,
        razorpay_payment_id: paymentResult.paymentId,
        razorpay_order_id: null,
        amount: originalAmount,
        currency: 'INR',
        method: recoveryMethod,
        status: 'captured',
        failure_reason: null,
        is_recovery_attempt: true,
        recovery_attempt_number: attemptNumber,
      });

      // Log success
      createAuditLog({
        agentId: 'recovery-agent',
        userId,
        merchantId: null,
        sessionId,
        action: 'recovery_success',
        requestedAmount: originalAmount,
        approvedAmount: originalAmount,
        reason: `Payment recovered using ${recoveryMethod}. Transaction ID: ${paymentResult.paymentId}`,
        policyResult: 'GREEN',
        paymentId: payment.id,
        orderId,
        result: 'success',
      });

      return {
        success: true,
        finalMethod: recoveryMethod,
        payment,
        attempts,
        message: `Payment recovered successfully using ${recoveryMethod}.`,
      };
    }

    currentMethod = recoveryMethod;
    attemptNumber++;
  }

  return {
    success: false,
    finalMethod: null,
    payment: null,
    attempts,
    message: 'All recovery attempts failed.',
  };
}
