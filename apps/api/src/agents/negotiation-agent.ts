// ============================================================
// AgentGate — Negotiation Agent
// Bounded multi-round negotiation between buyer and merchant
// ============================================================

import type { Negotiation, NegotiationRound } from '../types.js';
import { db } from '../db/database.js';
import { validateDiscount, getMinimumAllowedPrice } from '../policy/merchant-policy-engine.js';
import { config } from '../config.js';

const MAX_ROUNDS = 3;

/**
 * Execute a negotiation between buyer agent and merchant agent.
 * Returns the final negotiated price (or null if negotiation fails).
 */
export async function negotiate(params: {
  sessionId: string;
  productId: string;
  merchantId: string;
  userId: string;
  originalPrice: number;
  userMaxPrice: number;
}): Promise<Negotiation> {
  const { sessionId, productId, merchantId, userId, originalPrice, userMaxPrice } = params;

  const minMerchantPrice = getMinimumAllowedPrice(merchantId, originalPrice);
  const rounds: NegotiationRound[] = [];

  // Create negotiation record
  let negotiation = db.createNegotiation({
    session_id: sessionId,
    order_id: null,
    product_id: productId,
    merchant_id: merchantId,
    user_id: userId,
    original_price: originalPrice,
    final_price: null,
    rounds: [],
    status: 'active',
  });

  // Round 1: Buyer opens with a lower offer
  const buyerOpeningOffer = Math.round(originalPrice * 0.88); // Start at 12% off
  const round1: NegotiationRound = {
    round: 1,
    proposer: 'buyer',
    proposed_price: buyerOpeningOffer,
    message: `I'm interested in this product. Would you consider ₹${buyerOpeningOffer}?`,
    accepted: false,
    timestamp: new Date().toISOString(),
  };
  rounds.push(round1);

  // Round 1 Response: Merchant counters
  const merchantCounter1 = Math.round(originalPrice * (1 - 0.04)); // Merchant offers ~4% off
  const validDiscount1 = validateDiscount(merchantId, originalPrice, merchantCounter1);

  const round1Response: NegotiationRound = {
    round: 1,
    proposer: 'merchant',
    proposed_price: merchantCounter1,
    message: validDiscount1.allowed
      ? `Thank you for your interest! I can offer ₹${merchantCounter1} — that's ${(validDiscount1.proposedDiscount * 100).toFixed(0)}% off.`
      : `I appreciate the offer, but the best I can do right now is ₹${merchantCounter1}.`,
    accepted: false,
    timestamp: new Date().toISOString(),
  };
  rounds.push(round1Response);

  // Round 2: Buyer pushes for more
  const buyerCounter = Math.round((buyerOpeningOffer + merchantCounter1) / 2);
  const round2: NegotiationRound = {
    round: 2,
    proposer: 'buyer',
    proposed_price: buyerCounter,
    message: `How about we meet in the middle at ₹${buyerCounter}?`,
    accepted: false,
    timestamp: new Date().toISOString(),
  };
  rounds.push(round2);

  // Round 2 Response: Merchant final offer
  const merchantFinalOffer = Math.round(Math.max(minMerchantPrice, buyerCounter * 1.01));
  const validDiscount2 = validateDiscount(merchantId, originalPrice, merchantFinalOffer);

  let accepted = false;
  let finalPrice: number | null = null;

  if (validDiscount2.allowed && merchantFinalOffer <= userMaxPrice) {
    accepted = true;
    finalPrice = merchantFinalOffer;
  } else if (merchantCounter1 <= userMaxPrice) {
    finalPrice = merchantCounter1;
    accepted = true;
  }

  const round2Response: NegotiationRound = {
    round: 2,
    proposer: 'merchant',
    proposed_price: merchantFinalOffer,
    message: accepted
      ? `Deal! I'll do ₹${finalPrice} for you. That's my best offer.`
      : `I'm sorry, ₹${merchantFinalOffer} is my final price. I can't go lower.`,
    accepted,
    timestamp: new Date().toISOString(),
  };
  rounds.push(round2Response);

  if (accepted && finalPrice) {
    // Buyer accepts
    const acceptRound: NegotiationRound = {
      round: 3,
      proposer: 'buyer',
      proposed_price: finalPrice,
      message: `Agreed! ₹${finalPrice} works for me. Let's proceed with the purchase.`,
      accepted: true,
      timestamp: new Date().toISOString(),
    };
    rounds.push(acceptRound);
  }

  // Update negotiation
  negotiation = db.updateNegotiation(negotiation.id, {
    rounds,
    final_price: finalPrice,
    status: accepted ? 'accepted' : 'rejected',
  })!;

  return negotiation;
}

/**
 * Get negotiation savings summary.
 */
export function getNegotiationSummary(negotiation: Negotiation): {
  originalPrice: number;
  finalPrice: number | null;
  savings: number;
  savingsPercent: number;
  rounds: number;
} {
  const savings = negotiation.final_price
    ? negotiation.original_price - negotiation.final_price
    : 0;
  const savingsPercent = negotiation.final_price
    ? savings / negotiation.original_price
    : 0;

  return {
    originalPrice: negotiation.original_price,
    finalPrice: negotiation.final_price,
    savings,
    savingsPercent,
    rounds: negotiation.rounds.length,
  };
}
