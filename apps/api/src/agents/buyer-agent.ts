// ============================================================
// AgentGate — Buyer Agent (Full Orchestrator)
// Orchestrates: Intent Classification → Search → Score → Negotiate → Policy → Pay → Recover → Audit
// Robustly enforces that conversational messages (greetings, help, questions)
// NEVER trigger orders, authorizations, or financial deductions.
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
import { executionGateway } from '../gateway/execution-gateway.js';

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

  // ---- Step 1: Parse Intent ----
  createAuditLog({
    agentId: 'buyer-agent', userId, merchantId: null, sessionId: session.id,
    action: 'parse_intent', requestedAmount: null, approvedAmount: null,
    reason: `Parsing user request: "${userMessage}"`,
    policyResult: null, paymentId: null, orderId: null, result: 'pending',
  });

  const intent = await parseIntent(userMessage);
  db.updateAgentSession(session.id, { structured_intent: intent });

  // 🛡️ CRITICAL GUARDRAIL: Handle Non-Shopping Interactions (Greetings, Help, General Chat)
  if (!intent.is_shopping_intent || intent.intent_type === 'greeting' || intent.intent_type === 'help' || intent.intent_type === 'unknown') {
    const reply = intent.conversational_reply ||
      "👋 Hello! I am your autonomous AI Buyer Agent connected to Razorpay.\n\nTell me what you're looking to purchase (e.g. *'Buy black running shoes size 9 under ₹6,000'*), and I will discover products, negotiate price discounts, verify your spending policy boundaries, and execute secure checkout.";

    addMessage('agent', reply, 'text');

    createAuditLog({
      agentId: 'buyer-agent', userId, merchantId: null, sessionId: session.id,
      action: 'conversational_interaction', requestedAmount: null, approvedAmount: null,
      reason: `User conversational interaction (${intent.intent_type}): "${userMessage}"`,
      policyResult: null, paymentId: null, orderId: null, result: 'success',
    });

    db.updateAgentSession(session.id, {
      status: 'completed',
      result_summary: `Conversational response (${intent.intent_type})`,
    });

    return {
      session_id: session.id,
      intent,
      candidates: [],
      selected: null,
      negotiation: null,
      policy_evaluation: {
        decision: 'GREEN',
        reason: 'Conversational interaction — no purchase triggered and zero money deducted',
        details: {
          amount_check: true,
          daily_budget_check: true,
          weekly_budget_check: true,
          category_check: true,
          payment_method_check: true,
          remaining_daily_budget: 10000,
          remaining_weekly_budget: 25000,
        },
      },
      order: null,
      payment: null,
      opportunity: null,
      audit_trail: getAuditTrail(session.id),
      agent_messages: messages,
    };
  }

  // Shopping intent detected:
  addMessage('agent', '🔍 Understanding your request...', 'text');
  addMessage('agent', `✅ Got it! Looking for **${intent.category.replace(/_/g, ' ')}** ${intent.subcategory ? `(${intent.subcategory.replace(/_/g, ' ')})` : ''} under **₹${intent.max_price}**${intent.size ? `, size ${intent.size}` : ''}${intent.color ? `, ${intent.color}` : ''}.`, 'text');

  createAuditLog({
    agentId: 'buyer-agent', userId, merchantId: null, sessionId: session.id,
    action: 'intent_parsed', requestedAmount: intent.max_price, approvedAmount: null,
    reason: `Intent: ${intent.category}, max ₹${intent.max_price}, size: ${intent.size || 'any'}, color: ${intent.color || 'any'}`,
    policyResult: null, paymentId: null, orderId: null, result: 'success',
  });

  // 🛡️ Pre-emptive Policy Check on Purchase Budget
  const activePolicy = db.getUserPolicy(userId);
  const singleLimit = activePolicy?.single_transaction_limit || 6000;

  if (intent.purchase && intent.max_price > singleLimit) {
    const policyResult = evaluateUserPolicy(userId, intent.max_price, intent.category, 'upi', {
      agentId: 'buyer-agent',
      purpose: `Purchase request for ${intent.category}`,
    });

    addMessage('agent', `🚫 **Policy Guardrail Blocked Transaction**: ${policyResult.reason}`, 'text');
    createAuditLog({
      agentId: 'buyer-agent', userId, merchantId: null, sessionId: session.id,
      action: 'policy_evaluation', requestedAmount: intent.max_price, approvedAmount: null,
      reason: policyResult.reason,
      policyResult: policyResult.decision, paymentId: null, orderId: null, result: 'blocked',
    });
    db.updateAgentSession(session.id, { status: 'failed', result_summary: policyResult.reason });

    return {
      session_id: session.id,
      intent,
      candidates: [],
      selected: null,
      negotiation: null,
      policy_evaluation: policyResult,
      order: null,
      payment: null,
      opportunity: null,
      audit_trail: getAuditTrail(session.id),
      agent_messages: messages,
    };
  }

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
      policy_evaluation: { decision: 'RED', reason: 'No products found matching criteria', details: { amount_check: false, daily_budget_check: false, weekly_budget_check: false, category_check: false, payment_method_check: false, remaining_daily_budget: 0, remaining_weekly_budget: 0 } },
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
      id: c.product.id,
      title: c.product.title,
      merchant: c.merchant.name,
      price: c.product.price,
      original_price: c.product.original_price,
      score: c.score,
      rating: c.product.rating,
      image_url: c.product.image_url,
      delivery_days: c.product.delivery_days,
      match_reasons: c.match_reasons,
    })),
  });

  createAuditLog({
    agentId: 'buyer-agent', userId, merchantId: null, sessionId: session.id,
    action: 'candidates_ranked', requestedAmount: null, approvedAmount: null,
    reason: `Found ${products.length} products. Top candidate: ${topCandidates[0]?.product.title} at ₹${topCandidates[0]?.product.price} (score: ${topCandidates[0]?.score})`,
    policyResult: null, paymentId: null, orderId: null, result: 'success',
  });

  // 🛡️ If browsing mode without explicit purchase verb:
  if (!intent.purchase || intent.intent_type === 'browse') {
    addMessage('agent', `💡 **Browsing Results**: Above are the top matching products from verified merchants.\n\nTo have me negotiate price discounts and purchase autonomously through Razorpay, say *\"Buy ${topCandidates[0]?.product.title}\"*!`, 'text');
    db.updateAgentSession(session.id, { status: 'completed', result_summary: 'Browsing search completed' });

    return {
      session_id: session.id,
      intent,
      candidates: topCandidates,
      selected: topCandidates[0] || null,
      negotiation: null,
      policy_evaluation: { decision: 'GREEN', reason: 'Browsing mode — no transaction executed', details: { amount_check: true, daily_budget_check: true, weekly_budget_check: true, category_check: true, payment_method_check: true, remaining_daily_budget: 10000, remaining_weekly_budget: 25000 } },
      order: null,
      payment: null,
      opportunity: null,
      audit_trail: getAuditTrail(session.id),
      agent_messages: messages,
    };
  }

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
  addMessage('agent', '🔐 Evaluating deterministic policy and issuing cryptographic authorization...', 'policy');

  const policyEval = evaluateUserPolicy(userId, finalPrice, intent.category, 'upi', {
    agentId: 'buyer-agent',
    merchantId: selected.merchant.id,
    purpose: `Purchase: ${selected.product.title}`,
  });

  createAuditLog({
    agentId: 'buyer-agent', userId, merchantId: selected.merchant.id, sessionId: session.id,
    action: 'policy_evaluation', requestedAmount: finalPrice, approvedAmount: policyEval.decision === 'GREEN' ? finalPrice : null,
    reason: policyEval.reason,
    policyResult: policyEval.decision, paymentId: null, orderId: null,
    result: policyEval.decision === 'GREEN' ? 'success' : (policyEval.decision === 'RED' ? 'blocked' : 'pending'),
    authorizationId: policyEval.authorization?.authorization_id,
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

  addMessage('agent', `✅ **Policy approved!** Ed25519 authorization issued (Auth ID: \`${policyEval.authorization?.authorization_id.slice(0, 16)}...\`).`, 'policy', {
    policy_evaluation: policyEval,
    authorization: policyEval.authorization,
  });

  // ---- Step 7: Centralized Execution Gateway (Verifies signature, locks nonce, reserves budget) ----
  addMessage('agent', '🛡️ Submitting to Execution Gateway for cryptographic verification & Razorpay processing...', 'payment');

  const gatewayResult = await executionGateway.executePayment({
    authorization: policyEval.authorization,
    request: {
      user_id: userId,
      agent_id: 'buyer-agent',
      merchant_id: selected.merchant.id,
      category: intent.category,
      amount: finalPrice,
      currency: 'INR',
      payment_method: 'upi',
      purpose: `Purchase: ${selected.product.title}`,
    },
    session_id: session.id,
    variantId: variantMatch.variantId,
    quantity: 1,
    simulateFailure: false,
  });

  let order = gatewayResult.order!;
  let payment = gatewayResult.payment!;

  if (!gatewayResult.success && payment?.status === 'failed') {
    addMessage('agent', `⚠️ Primary UPI payment failed: ${gatewayResult.rejectionReason}\n🔄 Initiating automatic fallback recovery via Execution Gateway...`, 'payment', { failure: payment });

    // Simulate webhook for initial failure
    simulateWebhookEvent('payment.failed', order.razorpay_order_id || '', payment.razorpay_payment_id || '', finalPrice);

    // ---- Step 8: Payment Recovery via Gateway ----
    const recovery = await recoverPayment(userId, order.id, finalPrice, 'upi', session.id, policyEval.authorization);

    if (recovery.success && recovery.payment) {
      payment = recovery.payment;
      simulateWebhookEvent('payment.captured', order.razorpay_order_id || '', payment.razorpay_payment_id || '', finalPrice);

      addMessage('agent', `✅ **Payment recovered!** Successfully captured ₹${finalPrice} via **${recovery.finalMethod}**.\n${recovery.message}`, 'payment', {
        recovery_attempts: recovery.attempts,
        final_method: recovery.finalMethod,
      });
    } else {
      addMessage('agent', `❌ Payment recovery failed. ${recovery.message}`, 'payment');

      return {
        session_id: session.id, intent, candidates: topCandidates, selected, negotiation,
        policy_evaluation: policyEval, order: db.getOrder(order.id), payment,
        opportunity: null, audit_trail: getAuditTrail(session.id), agent_messages: messages,
      };
    }
  } else if (gatewayResult.success) {
    simulateWebhookEvent('payment.captured', order.razorpay_order_id || '', payment.razorpay_payment_id || '', finalPrice);
    addMessage('agent', `✅ **Payment successful!** Paid ₹${finalPrice} via ${payment.method}.`, 'payment');
  } else {
    // Gateway rejected before payment
    addMessage('agent', `🚫 **Gateway Execution Rejected:** ${gatewayResult.rejectionReason}`, 'payment');
    return {
      session_id: session.id, intent, candidates: topCandidates, selected, negotiation,
      policy_evaluation: policyEval, order: null, payment: null,
      opportunity: null, audit_trail: getAuditTrail(session.id), agent_messages: messages,
    };
  }

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
