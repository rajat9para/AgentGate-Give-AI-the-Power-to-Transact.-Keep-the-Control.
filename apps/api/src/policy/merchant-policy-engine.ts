// ============================================================
// AgentGate — Merchant Policy Engine (Deterministic)
// ============================================================

import type { MerchantPolicy } from '../types.js';
import { db } from '../db/database.js';

/**
 * Check if a negotiated discount is within merchant policy.
 */
export function validateDiscount(
  merchantId: string,
  originalPrice: number,
  proposedPrice: number
): { allowed: boolean; maxAllowedDiscount: number; proposedDiscount: number; reason: string } {
  const policy = db.getMerchantPolicy(merchantId);

  if (!policy) {
    return {
      allowed: false,
      maxAllowedDiscount: 0,
      proposedDiscount: 0,
      reason: 'No merchant policy found.',
    };
  }

  if (!policy.negotiation) {
    return {
      allowed: false,
      maxAllowedDiscount: 0,
      proposedDiscount: 0,
      reason: 'Merchant does not allow negotiation.',
    };
  }

  const proposedDiscount = (originalPrice - proposedPrice) / originalPrice;

  if (proposedDiscount <= policy.max_discount) {
    return {
      allowed: true,
      maxAllowedDiscount: policy.max_discount,
      proposedDiscount,
      reason: `Discount of ${(proposedDiscount * 100).toFixed(1)}% is within the allowed maximum of ${(policy.max_discount * 100).toFixed(1)}%.`,
    };
  }

  return {
    allowed: false,
    maxAllowedDiscount: policy.max_discount,
    proposedDiscount,
    reason: `Discount of ${(proposedDiscount * 100).toFixed(1)}% exceeds the allowed maximum of ${(policy.max_discount * 100).toFixed(1)}%.`,
  };
}

/**
 * Check if an order can be auto-confirmed by the merchant agent.
 */
export function canAutoConfirm(merchantId: string, amount: number): { allowed: boolean; reason: string } {
  const policy = db.getMerchantPolicy(merchantId);

  if (!policy) {
    return { allowed: false, reason: 'No merchant policy found.' };
  }

  if (amount <= policy.auto_confirmation_limit) {
    return { allowed: true, reason: `Order amount ₹${amount} is within auto-confirmation limit of ₹${policy.auto_confirmation_limit}.` };
  }

  return { allowed: false, reason: `Order amount ₹${amount} exceeds auto-confirmation limit of ₹${policy.auto_confirmation_limit}. Manual confirmation required.` };
}

/**
 * Check if a refund can be auto-processed.
 */
export function canAutoRefund(merchantId: string, amount: number): { allowed: boolean; reason: string } {
  const policy = db.getMerchantPolicy(merchantId);

  if (!policy) {
    return { allowed: false, reason: 'No merchant policy found.' };
  }

  if (amount <= policy.auto_refund_limit) {
    return { allowed: true, reason: `Refund amount ₹${amount} is within auto-refund limit of ₹${policy.auto_refund_limit}.` };
  }

  return { allowed: false, reason: `BLOCKED: Refund amount ₹${amount} exceeds auto-refund limit of ₹${policy.auto_refund_limit}. Manual approval required.` };
}

/**
 * Check if upselling is allowed for this merchant.
 */
export function canUpsell(merchantId: string): { allowed: boolean; maxOffers: number; reason: string } {
  const policy = db.getMerchantPolicy(merchantId);

  if (!policy) {
    return { allowed: false, maxOffers: 0, reason: 'No merchant policy found.' };
  }

  if (policy.upsell) {
    return { allowed: true, maxOffers: policy.max_upsell_offers, reason: `Upselling enabled with up to ${policy.max_upsell_offers} offers.` };
  }

  return { allowed: false, maxOffers: 0, reason: 'Upselling is disabled for this merchant.' };
}

/**
 * Calculate the minimum price a merchant agent can offer.
 */
export function getMinimumAllowedPrice(merchantId: string, originalPrice: number): number {
  const policy = db.getMerchantPolicy(merchantId);
  if (!policy) return originalPrice;
  return originalPrice * (1 - policy.max_discount);
}
