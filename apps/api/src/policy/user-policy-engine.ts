// ============================================================
// AgentGate — User Policy Engine (Deterministic)
// GREEN = Execute, AMBER = Recover, RED = Blocked
// ============================================================

import type { UserPolicy, PolicyDecision, PolicyEvaluation, PaymentMethod } from '../types.js';
import { db } from '../db/database.js';
import { createTransactionAuthorization, TransactionAuthorization } from '../crypto/authorization.js';

/**
 * Evaluate whether a proposed purchase is authorized by the user's policy.
 * This is the DETERMINISTIC trust boundary — no LLM can override this.
 */
export function evaluateUserPolicy(
  userId: string,
  amount: number,
  category: string,
  paymentMethod: PaymentMethod,
  context?: {
    agentId?: string;
    merchantId?: string;
    purpose?: string;
  }
): PolicyEvaluation {
  const policy = db.getUserPolicy(userId);

  if (!policy) {
    return {
      decision: 'RED',
      reason: 'No user policy found. Cannot authorize purchase.',
      details: {
        amount_check: false,
        daily_budget_check: false,
        weekly_budget_check: false,
        category_check: false,
        payment_method_check: false,
        remaining_daily_budget: 0,
        remaining_weekly_budget: 0,
      },
    };
  }

  const dailySpent = db.getDailySpending(userId);
  const weeklySpent = db.getWeeklySpending(userId);

  const amountCheck = amount <= policy.single_transaction_limit;
  const dailyCheck = (dailySpent + amount) <= policy.daily_limit;
  const weeklyCheck = (weeklySpent + amount) <= policy.weekly_limit;
  const categoryCheck = policy.allowed_categories.includes(category);
  const paymentMethodCheck = policy.fallback_payments.includes(paymentMethod);

  const allPassed = amountCheck && dailyCheck && weeklyCheck && categoryCheck && paymentMethodCheck;

  let decision: PolicyDecision;
  let reason: string;
  let authorization: any = undefined;

  if (allPassed && policy.autonomous_purchase) {
    decision = 'GREEN';
    reason = `Purchase authorized: ₹${amount} is within single limit (₹${policy.single_transaction_limit}), daily budget (₹${policy.daily_limit - dailySpent} remaining), weekly budget (₹${policy.weekly_limit - weeklySpent} remaining). Category "${category}" allowed. Payment method "${paymentMethod}" authorized.`;

    // Issue cryptographic Ed25519 TransactionAuthorization
    const agentId = context?.agentId || 'buyer-agent';
    const merchantId = context?.merchantId || 'merchant_authorized';
    const purpose = context?.purpose || `Purchase: ${category} item`;

    authorization = createTransactionAuthorization({
      user_id: userId,
      agent_id: agentId,
      purpose,
      merchant_id: merchantId,
      category,
      amount,
      currency: 'INR',
      allowed_payment_methods: policy.fallback_payments,
      policy,
      request: {
        user_id: userId,
        agent_id: agentId,
        merchant_id: merchantId,
        category,
        amount,
        currency: 'INR',
        payment_method: paymentMethod,
        purpose,
      },
      validitySeconds: 300,
    });
  } else if (!amountCheck) {
    decision = 'RED';
    reason = `BLOCKED: ₹${amount} exceeds single transaction limit of ₹${policy.single_transaction_limit}.`;
  } else if (!dailyCheck) {
    decision = 'RED';
    reason = `BLOCKED: ₹${amount} would exceed daily limit. Spent today: ₹${dailySpent}, limit: ₹${policy.daily_limit}.`;
  } else if (!weeklyCheck) {
    decision = 'RED';
    reason = `BLOCKED: ₹${amount} would exceed weekly limit. Spent this week: ₹${weeklySpent}, limit: ₹${policy.weekly_limit}.`;
  } else if (!categoryCheck) {
    decision = 'RED';
    reason = `BLOCKED: Category "${category}" is not in user's allowed categories: ${policy.allowed_categories.join(', ')}.`;
  } else if (!paymentMethodCheck) {
    // Payment method not in primary list — check if fallback is available
    const availableFallback = policy.fallback_payments.find(m => m !== paymentMethod);
    if (availableFallback) {
      decision = 'AMBER';
      reason = `Payment method "${paymentMethod}" not authorized. Fallback to "${availableFallback}" is available and authorized.`;
    } else {
      decision = 'RED';
      reason = `BLOCKED: Payment method "${paymentMethod}" not authorized and no fallback available.`;
    }
  } else if (!policy.autonomous_purchase) {
    decision = 'AMBER';
    reason = 'Autonomous purchase is disabled. User approval required.';
  } else {
    decision = 'RED';
    reason = 'Unknown policy violation.';
  }

  return {
    decision,
    reason,
    authorization,
    details: {
      amount_check: amountCheck,
      daily_budget_check: dailyCheck,
      weekly_budget_check: weeklyCheck,
      category_check: categoryCheck,
      payment_method_check: paymentMethodCheck,
      remaining_daily_budget: policy.daily_limit - dailySpent,
      remaining_weekly_budget: policy.weekly_limit - weeklySpent,
    },
  };
}

/**
 * Check if an opportunity alert should be surfaced.
 */
export function evaluateOpportunityOverride(
  userId: string,
  validPurchasePrice: number,
  validPurchaseScore: number,
  betterOptionPrice: number,
  betterOptionScore: number
): { shouldAlert: boolean; reason: string; overshootPercent: number; improvementPercent: number } {
  const policy = db.getUserPolicy(userId);

  if (!policy || !policy.opportunity_alerts) {
    return { shouldAlert: false, reason: 'Opportunity alerts disabled.', overshootPercent: 0, improvementPercent: 0 };
  }

  const overshootPercent = (betterOptionPrice - policy.single_transaction_limit) / policy.single_transaction_limit;
  const improvementPercent = (betterOptionScore - validPurchaseScore) / validPurchaseScore;

  const withinOvershoot = overshootPercent <= policy.max_opportunity_overshoot;
  const meetsImprovement = improvementPercent >= policy.min_opportunity_improvement;

  if (withinOvershoot && meetsImprovement) {
    return {
      shouldAlert: true,
      reason: `Better option found: ${(improvementPercent * 100).toFixed(1)}% better match at ₹${betterOptionPrice} (${(overshootPercent * 100).toFixed(1)}% above limit). Opportunity alert criteria met.`,
      overshootPercent,
      improvementPercent,
    };
  }

  return {
    shouldAlert: false,
    reason: withinOvershoot
      ? `Improvement of ${(improvementPercent * 100).toFixed(1)}% does not meet minimum threshold of ${(policy.min_opportunity_improvement * 100).toFixed(1)}%.`
      : `Price overshoot of ${(overshootPercent * 100).toFixed(1)}% exceeds maximum allowed ${(policy.max_opportunity_overshoot * 100).toFixed(1)}%.`,
    overshootPercent,
    improvementPercent,
  };
}

/**
 * Record spending after a successful purchase.
 */
export function recordSpending(userId: string, amount: number): void {
  db.addDailySpending(userId, amount);
  db.addWeeklySpending(userId, amount);
}
