// ============================================================
// AgentGate — Razorpay Service (Demo Mode + Real Mode)
// ============================================================

import { config } from '../config.js';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  created_at: number;
}

interface RazorpayPaymentLink {
  id: string;
  amount: number;
  currency: string;
  short_url: string;
  status: string;
}

/**
 * Create a Razorpay order (or simulate one in demo mode).
 */
export async function createRazorpayOrder(
  amount: number,
  currency: string,
  receipt: string
): Promise<RazorpayOrder> {
  if (config.demoMode) {
    // Simulate Razorpay order creation
    return {
      id: `order_demo_${uuidv4().slice(0, 12)}`,
      entity: 'order',
      amount: amount * 100, // Razorpay uses paise
      amount_paid: 0,
      amount_due: amount * 100,
      currency,
      receipt,
      status: 'created',
      created_at: Math.floor(Date.now() / 1000),
    };
  }

  // Real Razorpay API call
  const Razorpay = (await import('razorpay')).default;
  const rzp = new Razorpay({
    key_id: config.razorpay.keyId,
    key_secret: config.razorpay.keySecret,
  });

  const order = await rzp.orders.create({
    amount: amount * 100,
    currency,
    receipt,
  });

  return order as unknown as RazorpayOrder;
}

/**
 * Create a Razorpay payment link (or simulate one in demo mode).
 */
export async function createPaymentLink(
  amount: number,
  currency: string,
  description: string,
  customerName: string,
  customerEmail: string
): Promise<RazorpayPaymentLink> {
  if (config.demoMode) {
    const linkId = `plink_demo_${uuidv4().slice(0, 8)}`;
    return {
      id: linkId,
      amount: amount * 100,
      currency,
      short_url: `https://rzp.io/demo/${linkId}`,
      status: 'created',
    };
  }

  // Real Razorpay API call
  const Razorpay = (await import('razorpay')).default;
  const rzp = new Razorpay({
    key_id: config.razorpay.keyId,
    key_secret: config.razorpay.keySecret,
  });

  const link = await (rzp as any).paymentLink.create({
    amount: amount * 100,
    currency,
    description,
    customer: { name: customerName, email: customerEmail },
  });

  return link as unknown as RazorpayPaymentLink;
}

/**
 * Verify Razorpay payment signature.
 */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  if (config.demoMode) {
    // In demo mode, always verify successfully
    return true;
  }

  const body = orderId + '|' + paymentId;
  const expectedSignature = crypto
    .createHmac('sha256', config.razorpay.keySecret)
    .update(body)
    .digest('hex');

  return expectedSignature === signature;
}

/**
 * Simulate a payment flow for demo mode.
 * Returns payment status based on the method (UPI fails first to demo recovery).
 */
export function simulatePayment(
  method: string,
  amount: number,
  shouldFail: boolean = false
): { success: boolean; paymentId: string; failureReason: string | null } {
  const paymentId = `pay_demo_${uuidv4().slice(0, 12)}`;

  if (shouldFail) {
    return {
      success: false,
      paymentId,
      failureReason: method === 'upi'
        ? 'UPI transaction declined: Bank server timeout. Error code: U69'
        : `Payment via ${method} failed: Gateway timeout / card declined.`,
    };
  }

  return {
    success: true,
    paymentId,
    failureReason: null,
  };
}

/**
 * Verify webhook signature from Razorpay.
 */
export function verifyWebhookSignature(body: string, signature: string): boolean {
  if (config.demoMode) return true;

  const expectedSignature = crypto
    .createHmac('sha256', config.razorpay.webhookSecret)
    .update(body)
    .digest('hex');

  return expectedSignature === signature;
}
