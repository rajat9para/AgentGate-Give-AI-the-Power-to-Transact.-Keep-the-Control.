// ============================================================
// AgentGate — Buyer Agent (Full Orchestrator)
// Orchestrates: Intent → Search → Score → Negotiate → Policy → Pay → Recover → Audit
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import type {
  BuyerIntentResponse, AgentMessage, ProductCandidate,
  StructuredIntent, OpportunityAlert
} from '../types.js';
import { db } from '../db/database.js';
import { config } from '../config.js';
import { parseIntent } from './intent-parser.js';
import { negotiate, getNegotiationSummary } from './negotiation-agent.js';
import { searchProducts, searchProductsWithOverbudget, rankCandidates } from '../commerce/catalog-service.js';
import { createOrder, updateOrderStatus } from '../commerce/order-service.js';
import { findMatchingVariant, checkStock } from '../commerce/inventory-service.js';
import { evaluateUserPolicy, evaluateOpportunityOverride, recordSpending } from '../policy/user-policy-engine.js';
import { createRazorpayOrder, simulatePayment } from '../payments/razorpay-service.js';
import { simulateWebhookEvent } from '../payments/webhook-handler.js';
import { recoverPayment } from '../payments/payment-recovery.js';
import { createAuditLog, getAuditTrail } from '../audit/audit-service.js';

/**
 * Execute the full buyer agent flow.
 * This is the main entry point for AI commerce transactions.
 */
export async function executeBuyerFlow(
  userId: string,
  userMessage: string
): Promise<BuyerIntentResponse> {
  const messages: AgentMessage[] = [];
  const addMessage = (role: AgentMessage['role'], content: string, type: AgentMessage['type'], data?: Record<string, unknown>) => {
    messages.push({
      id: uuidv4(),
      role,
      content,
      type,
      data,
      timestamp: new Date().toISOString(),
    });
  };

  // Create agent session
  const session = db.createAgentSession({
    user_id: userId,
    type: 'buyer',
    status: 'active',
    user_message: userMessage,
    structured_intent: null,
    result_summary: null,
  });

  addMessage('user', userMessage, 'text');
  addMessage('agent', '🔍 Understanding your request...', 'text');

  // ---- Step 1: Parse Intent ----
  createAuditLog({
    agentId: 'buyer-agent', userId, merchantId: null, sessionId: session.id,
    action: 'parse_intent', requestedAmount: null, approvedAmount: null,
    reason: `Parsing user request: "${userMessage}"`,
    policyResult: null, paymentId: null, orderId: null, result: 'pending',
  });

  const intent = await parseIntent(userMessage);
  db.updateAgentSession(session.id, { structured_intent: intent });

  addMessage('agent', `✅ Got it! Looking for **${intent.category.replace(/_/g, ' ')}** ${intent.subcategory ? `(${intent.subcategory.replace(/_/g, ' ')})` : ''} under **₹${intent.max_price}**${intent.size ? `, size ${intent.size}` : ''}${intent.color ? `, ${intent.color}` : ''}.`, 'text');

  createAuditLog({
    agentId: 'buyer-agent', userId, merchantId: null, sessionId: session.id,
    action: 'intent_parsed', requestedAmount: intent.max_price, approvedAmount: null,
    reason: `Intent: ${intent.category}, max ₹${intent.max_price}, size: ${intent.size || 'any'}, color: ${intent.color || 'any'}`,
    policyResult: null, paymentId: null, orderId: null, result: 'success',
  });

  // ---- Step 2: Search Products ----
  addMessage('agent', '🛒 Searching across all merchants...', 'text');

  const products = searchProducts(intent);

  if (products.length === 0) {
    addMessage('agent', '❌ No products found matching your criteria. Try adjusting your budget or category.', 'text');
    db.updateAgentSession(session.id, { status: 'failed', result_summary: 'No products found' });

    return {
      session_id: session.id,
      intent,
      candidates: [],
      selected: null,
      negotiation: null,
      policy_evaluation: { decision: 'RED', reason: 'No products found', details: { amount_check: false, daily_budget_check: false, weekly_budget_check: false, category_check: false, payment_method_check: false, remaining_daily_budget: 0, remaining_weekly_budget: 0 } },
      order: null,
      payment: null,
      opportunity: null,
      audit_trail: getAuditTrail(session.id),
      agent_messages: messages,
    };
  }

  // ---- Step 3: Rank Candidates ----
  const candidates = rankCandidates(products, intent);
  const topCandidates = candidates.slice(0, 5);

  addMessage('agent', `📊 Found **${products.length} products** across ${new Set(products.map(p => p.merchant_id)).size} merchants. Top ${topCandidates.length} candidates ranked.`, 'comparison', {
    candidates: topCandidates.map(c => ({
      title: c.product.title,
      merchant: c.merchant.name,
      price: c.product.price,
      score: c.score,
      rating: c.product.rating,
    })),
  });

  createAuditLog({
    agentId: 'buyer-agent', userId, merchantId: null, sessionId: session.id,
    action: 'candidates_ranked', requestedAmount: null, approvedAmount: null,
    reason: `Found ${products.length} products. Top candidate: ${topCandidates[0]?.product.title} at ₹${topCandidates[0]?.product.price} (score: ${topCandidates[0]?.score})`,
    policyResult: null, paymentId: null, orderId: null, result: 'success',
  });

  // ---- Step 4: Select Best Valid Candidate ----
  const selected = topCandidates[0];
  if (!selected) {
    addMessage('agent', '❌ No valid candidates found after ranking.', 'text');
    db.updateAgentSession(session.id, { status: 'failed', result_summary: 'No valid candidates' });
    return buildFailureResponse(session.id, intent, candidates, messages);
  }

  // Check stock & variant
  const variantMatch = findMatchingVariant(selected.product.id, {
    ...(intent.size ? { size: intent.size } : {}),
    ...(intent.color ? { color: intent.color } : {}),
  });

  const stockCheck = checkStock(selected.product.id, variantMatch.variantId, 1);
  if (!stockCheck.available) {
    addMessage('agent', `⚠️ ${selected.product.title} is currently out of stock.`, 'text');
  }

  addMessage('agent', `🏆 Best match: **${selected.product.title}** from **${selected.merchant.name}** at **₹${selected.product.price}** (Score: ${selected.score}/100)`, 'product_card', {
    product: selected.product,
    merchant: selected.merchant,
    score: selected.score,
    match_reasons: selected.match_reasons,
  });

  // ---- Step 5: Negotiate (if allowed) ----
  let negotiation = null;
  let finalPrice = selected.product.price;

  if (selected.negotiable) {
    addMessage('agent', '💬 Initiating negotiation with merchant...', 'negotiation');

    negotiation = await negotiate({
      sessionId: session.id,
      productId: selected.product.id,
      merchantId: selected.merchant.id,
      userId,
      originalPrice: selected.product.price,
      userMaxPrice: intent.max_price,
    });

    if (negotiation.status === 'accepted' && negotiation.final_price) {
      finalPrice = negotiation.final_price;
      const summary = getNegotiationSummary(negotiation);

      addMessage('agent', `🤝 Negotiation successful! Price reduced from ₹${summary.originalPrice} → **₹${summary.finalPrice}** (saved ₹${summary.savings}, ${(summary.savingsPercent * 100).toFixed(1)}%)`, 'negotiation', {
        negotiation: summary,
        rounds: negotiation.rounds,
      });

      createAuditLog({
        agentId: 'buyer-agent', userId, merchantId: selected.merchant.id, sessionId: session.id,
        action: 'negotiation_complete', requestedAmount: selected.product.price, approvedAmount: finalPrice,
        reason: `Negotiated from ₹${summary.originalPrice} to ₹${summary.finalPrice}. Savings: ₹${summary.savings} (${(summary.savingsPercent * 100).toFixed(1)}%)`,
        policyResult: null, paymentId: null, orderId: null, result: 'success',
      });
    } else {
      addMessage('agent', `💼 Negotiation did not result in a lower price. Proceeding with ₹${finalPrice}.`, 'negotiation');
    }
  }

  // ---- Step 6: Policy Check ----
  addMessage('agent', '🔐 Checking purchase authorization against your policy...', 'policy');

  const policyEval = evaluateUserPolicy(userId, finalPrice, intent.category, 'upi');

  createAuditLog({
    agentId: 'buyer-agent', userId, merchantId: selected.merchant.id, sessionId: session.id,
    action: 'policy_evaluation', requestedAmount: finalPrice, approvedAmount: policyEval.decision === 'GREEN' ? finalPrice : null,
    reason: policyEval.reason,
    policyResult: policyEval.decision, paymentId: null, orderId: null,
    result: policyEval.decision === 'GREEN' ? 'success' : (policyEval.decision === 'RED' ? 'blocked' : 'pending'),
  });

  if (policyEval.decision === 'RED') {
    addMessage('agent', `🚫 **Purchase blocked.** ${policyEval.reason}`, 'policy', { policy_evaluation: policyEval });
    db.updateAgentSession(session.id, { status: 'failed', result_summary: `Blocked: ${policyEval.reason}` });

    return {
      session_id: session.id, intent, candidates: topCandidates, selected, negotiation,
      policy_evaluation: policyEval, order: null, payment: null, opportunity: null,
      audit_trail: getAuditTrail(session.id), agent_messages: messages,
    };
  }

  addMessage('agent', `✅ **Policy approved!** ${policyEval.reason}`, 'policy', { policy_evaluation: policyEval });

  // ---- Step 7: Create Order & Process Payment ----
  addMessage('agent', '💳 Creating order and processing payment...', 'payment');

  const order = createOrder({
    userId,
    merchantId: selected.merchant.id,
    productId: selected.product.id,
    variantId: variantMatch.variantId,
    quantity: 1,
    unitPrice: selected.product.price,
    negotiatedPrice: negotiation?.final_price || null,
    agentSessionId: session.id,
  });

  // Create Razorpay order
  const rzpOrder = await createRazorpayOrder(finalPrice, 'INR', order.id);
  db.updateOrder(order.id, { razorpay_order_id: rzpOrder.id, status: 'payment_processing' });

  createAuditLog({
    agentId: 'buyer-agent', userId, merchantId: selected.merchant.id, sessionId: session.id,
    action: 'razorpay_order_created', requestedAmount: finalPrice, approvedAmount: finalPrice,
    reason: `Razorpay order ${rzpOrder.id} created for ₹${finalPrice}`,
    policyResult: 'GREEN', paymentId: null, orderId: order.id, result: 'success',
  });

  // ---- Step 8: Attempt Payment (UPI first → will fail in demo) ----
  const upiResult = simulatePayment('upi', finalPrice, true); // Force UPI to fail for demo

  let payment = db.createPayment({
    order_id: order.id,
    razorpay_payment_id: upiResult.paymentId,
    razorpay_order_id: rzpOrder.id,
    amount: finalPrice,
    currency: 'INR',
    method: 'upi',
    status: upiResult.success ? 'captured' : 'failed',
    failure_reason: upiResult.failureReason,
    is_recovery_attempt: false,
    recovery_attempt_number: 0,
  });

  if (!upiResult.success) {
    addMessage('agent', `⚠️ UPI payment failed: ${upiResult.failureReason}\n🔄 Initiating automatic recovery...`, 'payment', { failure: upiResult });

    // Simulate webhook for failure
    simulateWebhookEvent('payment.failed', rzpOrder.id, upiResult.paymentId, finalPrice);

    // ---- Step 9: Payment Recovery ----
    const recovery = await recoverPayment(userId, order.id, finalPrice, 'upi', session.id);

    if (recovery.success && recovery.payment) {
      payment = recovery.payment;
      db.updateOrder(order.id, { status: 'paid', payment_id: payment.id });

      // Simulate successful webhook
      simulateWebhookEvent('payment.captured', rzpOrder.id, payment.razorpay_payment_id || '', finalPrice);

      addMessage('agent', `✅ **Payment recovered!** Successfully paid ₹${finalPrice} via **${recovery.finalMethod}**.\n${recovery.message}`, 'payment', {
        recovery_attempts: recovery.attempts,
        final_method: recovery.finalMethod,
      });
    } else {
      db.updateOrder(order.id, { status: 'payment_failed' });
      addMessage('agent', `❌ Payment recovery failed. ${recovery.message}`, 'payment');

      return {
        session_id: session.id, intent, candidates: topCandidates, selected, negotiation,
        policy_evaluation: policyEval, order: db.getOrder(order.id), payment,
        opportunity: null, audit_trail: getAuditTrail(session.id), agent_messages: messages,
      };
    }
  } else {
    db.updateOrder(order.id, { status: 'paid', payment_id: payment.id });
    simulateWebhookEvent('payment.captured', rzpOrder.id, upiResult.paymentId, finalPrice);
    addMessage('agent', `✅ **Payment successful!** Paid ₹${finalPrice} via UPI.`, 'payment');
  }

  // Record spending
  recordSpending(userId, finalPrice);

  // ---- Step 10: Order Confirmation ----
  addMessage('agent', `🎉 **Order confirmed!**\n\n📦 **${selected.product.title}**\n🏪 From: ${selected.merchant.name}\n💰 Paid: ₹${finalPrice}\n📋 Order ID: ${order.id}\n\nYour order will be delivered in ~${selected.product.delivery_days} days.`, 'text');

  createAuditLog({
    agentId: 'buyer-agent', userId, merchantId: selected.merchant.id, sessionId: session.id,
    action: 'order_confirmed', requestedAmount: finalPrice, approvedAmount: finalPrice,
    reason: `Order ${order.id} confirmed. Product: ${selected.product.title}. Payment via ${payment.method}.`,
    policyResult: 'GREEN', paymentId: payment.id, orderId: order.id, result: 'success',
  });

  // ---- Step 11: Opportunity Override Check ----
  let opportunity: OpportunityAlert | null = null;
  const userPolicy = db.getUserPolicy(userId);

  if (userPolicy?.opportunity_alerts) {
    // Search for products above budget
    const extendedProducts = searchProductsWithOverbudget(intent, userPolicy.max_opportunity_overshoot);
    const extendedCandidates = rankCandidates(extendedProducts, intent);

    const betterAboveBudget = extendedCandidates.find(c =>
      c.product.price > intent.max_price &&
      c.score > selected.score
    );

    if (betterAboveBudget) {
      const oppEval = evaluateOpportunityOverride(
        userId,
        finalPrice,
        selected.score,
        betterAboveBudget.product.price,
        betterAboveBudget.score
      );

      if (oppEval.shouldAlert) {
        opportunity = {
          valid_purchase: selected,
          better_option: betterAboveBudget,
          price_overshoot_percent: oppEval.overshootPercent,
          improvement_percent: oppEval.improvementPercent,
          should_alert: true,
          message: `I completed your purchase within ₹${intent.max_price}. I also found a ${(oppEval.improvementPercent * 100).toFixed(1)}% better match: **${betterAboveBudget.product.title}** at ₹${betterAboveBudget.product.price}. Would you like to upgrade?`,
        };

        addMessage('agent', `💡 **Opportunity Alert**\n\n${opportunity.message}`, 'opportunity', {
          valid_purchase: { title: selected.product.title, price: finalPrice, score: selected.score },
          better_option: { title: betterAboveBudget.product.title, price: betterAboveBudget.product.price, score: betterAboveBudget.score },
        });

        createAuditLog({
          agentId: 'buyer-agent', userId, merchantId: null, sessionId: session.id,
          action: 'opportunity_alert', requestedAmount: betterAboveBudget.product.price, approvedAmount: null,
          reason: oppEval.reason,
          policyResult: null, paymentId: null, orderId: order.id, result: 'pending',
        });
      }
    }
  }

  // ---- Step 12: Show Audit Trail ----
  const auditTrail = getAuditTrail(session.id);
  addMessage('agent', `📋 **Audit Trail** — ${auditTrail.length} actions recorded for full transparency.`, 'audit', {
    audit_count: auditTrail.length,
  });

  // Complete session
  db.updateAgentSession(session.id, {
    status: 'completed',
    result_summary: `Purchased ${selected.product.title} for ₹${finalPrice} from ${selected.merchant.name}`,
  });

  return {
    session_id: session.id,
    intent,
    candidates: topCandidates,
    selected,
    negotiation,
    policy_evaluation: policyEval,
    order: db.getOrder(order.id),
    payment,
    opportunity,
    audit_trail: auditTrail,
    agent_messages: messages,
  };
}

function buildFailureResponse(sessionId: string, intent: StructuredIntent, candidates: ProductCandidate[], messages: AgentMessage[]): BuyerIntentResponse {
  return {
    session_id: sessionId,
    intent,
    candidates,
    selected: null,
    negotiation: null,
    policy_evaluation: { decision: 'RED', reason: 'No valid candidates', details: { amount_check: false, daily_budget_check: false, weekly_budget_check: false, category_check: false, payment_method_check: false, remaining_daily_budget: 0, remaining_weekly_budget: 0 } },
    order: null,
    payment: null,
    opportunity: null,
    audit_trail: getAuditTrail(sessionId),
    agent_messages: messages,
  };
}
