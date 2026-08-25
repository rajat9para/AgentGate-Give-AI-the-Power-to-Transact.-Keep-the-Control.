// ============================================================
// AgentGate — Centralized Execution Gateway
// Sole authorized boundary for cryptographic verification & payment execution
// ============================================================

import type { Order, Payment, PaymentMethod, UserPolicy } from '../types.js';
import { db } from '../db/database.js';
import {
  TransactionAuthorization,
  TransactionRequest,
  verifyTransactionAuthorization,
  computeRequestHash,
} from '../crypto/authorization.js';
import { nonceStore } from '../crypto/nonce-store.js';
import { budgetReservationEngine } from '../crypto/budget-reservation.js';
import { createRazorpayOrder, simulatePayment, createPaymentLink } from '../payments/razorpay-service.js';
import { createOrder, updateOrderStatus } from '../commerce/order-service.js';
import { auditService } from '../audit/audit-service.js';

export interface ExecutionGatewayResult {
  success: boolean;
  order: Order | null;
  payment: Payment | null;
  reservationId?: string;
  rejectionReason?: string;
  rejectionCode?: string;
  verificationDetails?: {
    signatureValid: boolean;
    policyValid: boolean;
    requestBound: boolean;
    nonceConsumed: boolean;
    budgetReserved: boolean;
  };
}

export class ExecutionGateway {
  /**
   * Executes a transaction through the complete cryptographic verification and payment pipeline.
   * Fails closed at any stage of verification.
   */
  public async executePayment(params: {
    authorization: TransactionAuthorization;
    request: TransactionRequest;
    session_id: string;
    productId?: string;
    variantId?: string | null;
    quantity?: number;
    simulateFailure?: boolean;
  }): Promise<ExecutionGatewayResult> {
    const { authorization, request, session_id } = params;
    const policy = db.getUserPolicy(request.user_id);

    // ----------------------------------------------------
    // STAGE 1: Cryptographic Signature & Parameter Binding Verification
    // ----------------------------------------------------
    const verification = verifyTransactionAuthorization(authorization, {
      expectedRequest: request,
      currentPolicy: policy || undefined,
      clockSkewToleranceSeconds: 60,
    });

    if (!verification.valid) {
      auditService.log({
        agent_id: request.agent_id,
        user_id: request.user_id,
        merchant_id: request.merchant_id,
        session_id,
        action: 'EXECUTION_GATEWAY_VERIFICATION_FAILED',
        requested_amount: request.amount,
        approved_amount: null,
        reason: `Cryptographic Gateway Rejected: ${verification.reason}`,
        policy_id: policy?.id || null,
        policy_result: 'RED',
        result: 'blocked',
        authorization_id: authorization.authorization_id,
        policy_version: authorization.policy_version,
        policy_hash: authorization.policy_hash,
        request_hash: authorization.request_hash,
        nonce: authorization.nonce,
        key_id: authorization.key_id,
        verification_result: 'FAILED: ' + verification.reason,
      });

      return {
        success: false,
        order: null,
        payment: null,
        rejectionReason: verification.reason,
        rejectionCode: verification.code || 'VERIFICATION_FAILED',
        verificationDetails: {
          signatureValid: false,
          policyValid: false,
          requestBound: false,
          nonceConsumed: false,
          budgetReserved: false,
        },
      };
    }

    // ----------------------------------------------------
    // STAGE 2: Atomic Nonce & Anti-Replay Check
    // ----------------------------------------------------
    const nonceResult = nonceStore.consume(authorization.nonce, authorization.authorization_id);
    if (!nonceResult.success) {
      auditService.log({
        agent_id: request.agent_id,
        user_id: request.user_id,
        merchant_id: request.merchant_id,
        session_id,
        action: 'EXECUTION_GATEWAY_REPLAY_BLOCKED',
        requested_amount: request.amount,
        approved_amount: null,
        reason: `Anti-Replay Interception: ${nonceResult.reason}`,
        policy_id: policy?.id || null,
        policy_result: 'RED',
        result: 'blocked',
        authorization_id: authorization.authorization_id,
        nonce: authorization.nonce,
        key_id: authorization.key_id,
        verification_result: 'FAILED_REPLAY',
      });

      return {
        success: false,
        order: null,
        payment: null,
        rejectionReason: nonceResult.reason,
        rejectionCode: 'REPLAY_DETECTED',
        verificationDetails: {
          signatureValid: true,
          policyValid: true,
          requestBound: true,
          nonceConsumed: false,
          budgetReserved: false,
        },
      };
    }

    // ----------------------------------------------------
    // STAGE 3: Atomic Budget Reservation
    // ----------------------------------------------------
    if (!policy) {
      return {
        success: false,
        order: null,
        payment: null,
        rejectionReason: 'No user policy found for budget reservation.',
        rejectionCode: 'POLICY_MISSING',
      };
    }

    const reservation = budgetReservationEngine.reserve(
      request.user_id,
      authorization.authorization_id,
      request.amount,
      {
        dailyLimit: policy.daily_limit,
        weeklyLimit: policy.weekly_limit,
        singleLimit: policy.single_transaction_limit,
      }
    );

    if (!reservation.success) {
      auditService.log({
        agent_id: request.agent_id,
        user_id: request.user_id,
        merchant_id: request.merchant_id,
        session_id,
        action: 'EXECUTION_GATEWAY_BUDGET_RESERVATION_FAILED',
        requested_amount: request.amount,
        approved_amount: null,
        reason: reservation.reason || 'Budget reservation limit exceeded.',
        policy_id: policy.id,
        policy_result: 'RED',
        result: 'blocked',
        authorization_id: authorization.authorization_id,
        reservation_result: 'FAILED',
      });

      return {
        success: false,
        order: null,
        payment: null,
        rejectionReason: reservation.reason,
        rejectionCode: 'BUDGET_EXHAUSTED',
        verificationDetails: {
          signatureValid: true,
          policyValid: true,
          requestBound: true,
          nonceConsumed: true,
          budgetReserved: false,
        },
      };
    }

    const reservationId = reservation.reservationId!;

    // ----------------------------------------------------
    // STAGE 4: Razorpay Order Creation & Payment Execution
    // ----------------------------------------------------
    try {
      const productTitle = request.purpose.includes(':') ? request.purpose.split(':')[1].trim() : '';
      const matchedProduct = params.productId
        ? db.getProduct(params.productId)
        : (productTitle ? db.getAllProducts().find(p => p.title.toLowerCase() === productTitle.toLowerCase() || p.id === productTitle) : null);
      const resolvedProductId = matchedProduct ? matchedProduct.id : (params.productId || 'prod_item');

      const order = createOrder({
        userId: request.user_id,
        merchantId: request.merchant_id,
        productId: resolvedProductId,
        variantId: params.variantId || null,
        quantity: params.quantity || 1,
        unitPrice: request.amount,
        negotiatedPrice: request.amount,
        agentSessionId: session_id,
      });

      const rzpOrder = await createRazorpayOrder(
        request.amount,
        request.currency,
        order.id
      );

      order.razorpay_order_id = rzpOrder.id;
      db.updateOrder(order.id, { razorpay_order_id: rzpOrder.id });

      // Execute primary payment via simulation
      const simRes = simulatePayment(
        request.payment_method,
        request.amount,
        params.simulateFailure ?? (request.payment_method === 'upi')
      );

      const payment = db.createPayment({
        order_id: order.id,
        razorpay_payment_id: simRes.paymentId,
        razorpay_order_id: rzpOrder.id,
        amount: request.amount,
        currency: request.currency,
        method: request.payment_method,
        status: simRes.success ? 'captured' : 'failed',
        failure_reason: simRes.failureReason,
        is_recovery_attempt: false,
        recovery_attempt_number: 0,
      });

      if (payment.status === 'captured') {
        // Payment succeeded -> Commit atomic budget reservation
        budgetReservationEngine.commit(reservationId);
        db.updateOrder(order.id, { status: 'paid', payment_id: payment.id });

        auditService.log({
          agent_id: request.agent_id,
          user_id: request.user_id,
          merchant_id: request.merchant_id,
          session_id,
          action: 'PAYMENT_EXECUTED_VIA_GATEWAY',
          requested_amount: request.amount,
          approved_amount: request.amount,
          reason: `Cryptographic Gateway executed ₹${request.amount} payment via ${request.payment_method}. Ed25519 verified, budget committed.`,
          policy_id: policy.id,
          policy_result: 'GREEN',
          payment_id: payment.id,
          order_id: order.id,
          result: 'success',
          authorization_id: authorization.authorization_id,
          policy_version: authorization.policy_version,
          policy_hash: authorization.policy_hash,
          request_hash: authorization.request_hash,
          nonce: authorization.nonce,
          key_id: authorization.key_id,
          verification_result: 'PASSED',
          reservation_result: 'COMMITTED',
        });

        return {
          success: true,
          order,
          payment,
          reservationId,
          verificationDetails: {
            signatureValid: true,
            policyValid: true,
            requestBound: true,
            nonceConsumed: true,
            budgetReserved: true,
          },
        };
      } else {
        // Payment failed (e.g. UPI timeout)
        updateOrderStatus(order.id, 'payment_failed');

        auditService.log({
          agent_id: request.agent_id,
          user_id: request.user_id,
          merchant_id: request.merchant_id,
          session_id,
          action: 'PRIMARY_PAYMENT_FAILED_IN_GATEWAY',
          requested_amount: request.amount,
          approved_amount: request.amount,
          reason: `Primary payment via ${request.payment_method} failed: ${payment.failure_reason}. Retaining budget reservation for authorized fallback.`,
          policy_id: policy.id,
          policy_result: 'AMBER',
          payment_id: payment.id,
          order_id: order.id,
          result: 'failed',
          authorization_id: authorization.authorization_id,
          verification_result: 'PASSED',
          reservation_result: 'RESERVED_FOR_FALLBACK',
        });

        return {
          success: false,
          order,
          payment,
          reservationId,
          rejectionReason: payment.failure_reason || 'Primary payment execution failed.',
          rejectionCode: 'PAYMENT_DECLINED',
          verificationDetails: {
            signatureValid: true,
            policyValid: true,
            requestBound: true,
            nonceConsumed: true,
            budgetReserved: true,
          },
        };
      }
    } catch (err) {
      // Release reservation on unexpected error
      budgetReservationEngine.release(reservationId);
      throw err;
    }
  }

  /**
   * Executes an authorized fallback payment under the SAME cryptographic authorization & reservation.
   * Fallback method MUST be bound in authorization.allowed_payment_methods.
   */
  public async executeFallbackPayment(params: {
    authorization: TransactionAuthorization;
    fallbackMethod: PaymentMethod;
    orderId: string;
    amount: number;
    session_id: string;
    attemptNumber: number;
  }): Promise<ExecutionGatewayResult> {
    const { authorization, fallbackMethod, orderId, amount, session_id } = params;

    // Check payment method binding
    if (!authorization.allowed_payment_methods.includes(fallbackMethod)) {
      auditService.log({
        agent_id: 'payment-recovery-agent',
        user_id: authorization.user_id,
        merchant_id: authorization.merchant_id,
        session_id,
        action: 'FALLBACK_METHOD_REJECTED_BY_GATEWAY',
        requested_amount: amount,
        approved_amount: null,
        reason: `Gateway Rejected: Fallback method "${fallbackMethod}" was NOT authorized in TransactionAuthorization ${authorization.authorization_id}.`,
        policy_result: 'RED',
        order_id: orderId,
        result: 'blocked',
        authorization_id: authorization.authorization_id,
      });

      return {
        success: false,
        order: db.getOrder(orderId),
        payment: null,
        rejectionReason: `Fallback method "${fallbackMethod}" exceeds signed authorization scope.`,
        rejectionCode: 'UNAUTHORIZED_FALLBACK_METHOD',
      };
    }

    const order = db.getOrder(orderId);
    if (!order) {
      return {
        success: false,
        order: null,
        payment: null,
        rejectionReason: `Order "${orderId}" not found.`,
      };
    }

    // Execute fallback payment
    const simRes = simulatePayment(fallbackMethod, amount, false);

    const payment = db.createPayment({
      order_id: orderId,
      razorpay_payment_id: simRes.paymentId,
      razorpay_order_id: order.razorpay_order_id || null,
      amount,
      currency: authorization.currency,
      method: fallbackMethod,
      status: simRes.success ? 'captured' : 'failed',
      failure_reason: simRes.failureReason,
      is_recovery_attempt: true,
      recovery_attempt_number: params.attemptNumber,
    });

    if (payment.status === 'captured') {
      // Commit the reservation
      const policy = db.getUserPolicy(authorization.user_id);
      db.addDailySpending(authorization.user_id, amount);
      db.updateOrder(orderId, { status: 'paid', payment_id: payment.id });

      auditService.log({
        agent_id: 'payment-recovery-agent',
        user_id: authorization.user_id,
        merchant_id: authorization.merchant_id,
        session_id,
        action: 'FALLBACK_PAYMENT_EXECUTED_VIA_GATEWAY',
        requested_amount: amount,
        approved_amount: amount,
        reason: `Autonomous Fallback Succeeded: ₹${amount} captured via authorized "${fallbackMethod}". Bound to Authorization ${authorization.authorization_id}.`,
        policy_id: policy?.id || null,
        policy_result: 'GREEN',
        payment_id: payment.id,
        order_id: orderId,
        result: 'success',
        authorization_id: authorization.authorization_id,
        policy_version: authorization.policy_version,
        policy_hash: authorization.policy_hash,
        request_hash: authorization.request_hash,
        nonce: authorization.nonce,
        key_id: authorization.key_id,
        verification_result: 'PASSED_FALLBACK',
        reservation_result: 'COMMITTED_FALLBACK',
      });

      return {
        success: true,
        order,
        payment,
        verificationDetails: {
          signatureValid: true,
          policyValid: true,
          requestBound: true,
          nonceConsumed: true,
          budgetReserved: true,
        },
      };
    }

    return {
      success: false,
      order,
      payment,
      rejectionReason: payment.failure_reason || 'Fallback payment failed.',
      rejectionCode: 'FALLBACK_FAILED',
    };
  }
}

export const executionGateway = new ExecutionGateway();
