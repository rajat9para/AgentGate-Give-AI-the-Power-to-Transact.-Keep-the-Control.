// ============================================================
// AgentGate — Order Service
// ============================================================

import type { Order, OrderItem, OrderStatus } from '../types.js';
import { db } from '../db/database.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a new order from a selected product candidate.
 */
export function createOrder(params: {
  userId: string;
  merchantId: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  unitPrice: number;
  negotiatedPrice: number | null;
  agentSessionId: string;
}): Order {
  const totalAmount = params.unitPrice * params.quantity;
  const negotiatedAmount = params.negotiatedPrice
    ? params.negotiatedPrice * params.quantity
    : null;

  const order = db.createOrder({
    user_id: params.userId,
    merchant_id: params.merchantId,
    status: 'pending',
    total_amount: totalAmount,
    negotiated_amount: negotiatedAmount,
    currency: 'INR',
    items: [{
      id: uuidv4(),
      order_id: '', // Will be set after order creation
      product_id: params.productId,
      variant_id: params.variantId,
      quantity: params.quantity,
      unit_price: params.negotiatedPrice || params.unitPrice,
      total_price: negotiatedAmount || totalAmount,
    }],
    razorpay_order_id: null,
    payment_id: null,
    agent_session_id: params.agentSessionId,
  });

  // Update order items with the actual order ID
  order.items = order.items.map(item => ({ ...item, order_id: order.id }));

  return order;
}

/**
 * Update order status.
 */
export function updateOrderStatus(orderId: string, status: OrderStatus): Order | null {
  return db.updateOrder(orderId, { status });
}

/**
 * Get order by ID.
 */
export function getOrder(orderId: string): Order | null {
  return db.getOrder(orderId);
}

/**
 * Get all orders for a user.
 */
export function getUserOrders(userId: string): Order[] {
  return db.getOrdersByUser(userId);
}

/**
 * Get all orders for a merchant.
 */
export function getMerchantOrders(merchantId: string): Order[] {
  return db.getOrdersByMerchant(merchantId);
}
