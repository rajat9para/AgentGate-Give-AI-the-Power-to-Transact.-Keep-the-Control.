// ============================================================
// AgentGate — Webhook Handler
// ============================================================

import type { Request, Response } from 'express';
import { verifyWebhookSignature } from './razorpay-service.js';
import { db } from '../db/database.js';
import { createAuditLog } from '../audit/audit-service.js';

// Track processed events for idempotency
const processedEvents = new Set<string>();

/**
 * Handle incoming Razorpay webhook events.
 */
export function handleWebhook(req: Request, res: Response): void {
  const signature = req.headers['x-razorpay-signature'] as string;
  const body = JSON.stringify(req.body);

  // Verify signature
  if (!verifyWebhookSignature(body, signature || '')) {
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  const event = req.body;
  const eventId = event.id || `evt_${Date.now()}`;

  // Idempotency check
  if (processedEvents.has(eventId)) {
    res.status(200).json({ status: 'already_processed' });
    return;
  }

  processedEvents.add(eventId);

  try {
    switch (event.event) {
      case 'payment.captured':
        handlePaymentCaptured(event.payload?.payment?.entity);
        break;
      case 'payment.failed':
        handlePaymentFailed(event.payload?.payment?.entity);
        break;
      case 'order.paid':
        handleOrderPaid(event.payload?.order?.entity);
        break;
      default:
        console.log(`[Webhook] Unhandled event: ${event.event}`);
    }

    res.status(200).json({ status: 'processed' });
  } catch (error) {
    console.error('[Webhook] Error processing event:', error);
    res.status(500).json({ error: 'Internal webhook processing error' });
  }
}

function handlePaymentCaptured(payment: any): void {
  if (!payment) return;

  const orderId = payment.order_id;
  if (!orderId) return;

  // Update payment status
  const existingPayments = db.getPaymentsByOrder(orderId);
  for (const p of existingPayments) {
    if (p.razorpay_order_id === orderId || p.razorpay_payment_id === payment.id) {
      db.updatePayment(p.id, { status: 'captured', razorpay_payment_id: payment.id });
    }
  }

  // Update order status
  db.updateOrder(orderId, { status: 'paid', payment_id: payment.id });

  console.log(`[Webhook] Payment captured for order ${orderId}`);
}

function handlePaymentFailed(payment: any): void {
  if (!payment) return;

  const orderId = payment.order_id;
  if (!orderId) return;

  const existingPayments = db.getPaymentsByOrder(orderId);
  for (const p of existingPayments) {
    if (p.razorpay_order_id === orderId) {
      db.updatePayment(p.id, {
        status: 'failed',
        failure_reason: payment.error_description || 'Payment failed',
      });
    }
  }

  db.updateOrder(orderId, { status: 'payment_failed' });

  console.log(`[Webhook] Payment failed for order ${orderId}`);
}

function handleOrderPaid(order: any): void {
  if (!order) return;

  db.updateOrder(order.id, { status: 'paid' });

  console.log(`[Webhook] Order paid: ${order.id}`);
}

/**
 * Simulate a webhook event (for demo mode).
 */
export function simulateWebhookEvent(
  eventType: 'payment.captured' | 'payment.failed',
  orderId: string,
  paymentId: string,
  amount: number
): void {
  const eventId = `evt_demo_${Date.now()}`;

  if (eventType === 'payment.captured') {
    handlePaymentCaptured({
      id: paymentId,
      order_id: orderId,
      amount: amount * 100,
      status: 'captured',
    });
  } else {
    handlePaymentFailed({
      id: paymentId,
      order_id: orderId,
      amount: amount * 100,
      status: 'failed',
      error_description: 'UPI transaction declined',
    });
  }

  processedEvents.add(eventId);
}
