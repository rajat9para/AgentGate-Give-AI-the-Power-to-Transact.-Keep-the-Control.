// ============================================================
// AgentGate — Policy Engine & Recovery Unit Tests
// Proves deterministic trust boundaries and fallback chains
// ============================================================

import { initializeDatabase, db } from './db/database.js';
import { evaluateUserPolicy, recordSpending } from './policy/user-policy-engine.js';
import { recoverPayment } from './payments/payment-recovery.js';
import { createOrder } from './commerce/order-service.js';
import { createRazorpayOrder } from './payments/razorpay-service.js';

interface TestResult {
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

const results: TestResult[] = [];

function assertTest(name: string, condition: boolean, expected: string, actual: string, details?: string) {
  results.push({
    name,
    passed: condition,
    expected,
    actual,
    details,
  });
  if (condition) {
    console.log(`  ✅ PASS: ${name}`);
  } else {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Expected: ${expected}`);
    console.error(`     Actual:   ${actual}`);
  }
}

async function runPolicyTests() {
  console.log('\n======================================================');
  console.log('🧪 AgentGate Deterministic Policy Engine Unit Test Suite');
  console.log('======================================================\n');

  // Initialize DB with standard seed
  initializeDatabase();
  const userId = 'demo-buyer-001';

  // Ensure fresh baseline policy
  db.updateUserPolicy(userId, {
    single_transaction_limit: 6000,
    daily_limit: 10000,
    weekly_limit: 25000,
    autonomous_purchase: true,
    allowed_categories: ['running_shoes', 'electronics', 'clothing', 'fitness'],
    fallback_payments: ['upi', 'card'],
  });

  // ----------------------------------------------------
  // TEST 1: Single Transaction Limit Enforcement (RED)
  // ----------------------------------------------------
  console.log('▶ Test 1: Transaction exceeding single limit (₹8,000 > ₹6,000)');
  const res1 = evaluateUserPolicy(userId, 8000, 'running_shoes', 'upi');
  assertTest(
    'Single Transaction Limit Block',
    res1.decision === 'RED' && res1.details.amount_check === false,
    'Decision: RED (amount_check: false)',
    `Decision: ${res1.decision} (${res1.reason})`
  );

  // ----------------------------------------------------
  // TEST 2: Category Whitelist Enforcement (RED)
  // ----------------------------------------------------
  console.log('\n▶ Test 2: Transaction for unapproved category ("automotive")');
  const res2 = evaluateUserPolicy(userId, 3000, 'automotive', 'upi');
  assertTest(
    'Disallowed Category Block',
    res2.decision === 'RED' && res2.details.category_check === false,
    'Decision: RED (category_check: false)',
    `Decision: ${res2.decision} (${res2.reason})`
  );

  // ----------------------------------------------------
  // TEST 3: Valid Authorized Transaction (GREEN)
  // ----------------------------------------------------
  console.log('\n▶ Test 3: Valid transaction within all limits (₹4,500, "running_shoes", "upi")');
  const res3 = evaluateUserPolicy(userId, 4500, 'running_shoes', 'upi');
  assertTest(
    'Valid Transaction Approval',
    res3.decision === 'GREEN' &&
      res3.details.amount_check === true &&
      res3.details.daily_budget_check === true &&
      res3.details.category_check === true &&
      res3.details.payment_method_check === true,
    'Decision: GREEN (all checks pass)',
    `Decision: ${res3.decision} (${res3.reason})`
  );

  // Record spending for Test 3 to advance daily velocity
  recordSpending(userId, 4500);

  // ----------------------------------------------------
  // TEST 4: Daily Spending Velocity Breach (RED)
  // ----------------------------------------------------
  console.log('\n▶ Test 4: Daily velocity breach (Spent: ₹4,500 + New: ₹6,000 = ₹10,500 > ₹10,000)');
  const res4 = evaluateUserPolicy(userId, 6000, 'running_shoes', 'upi');
  assertTest(
    'Daily Velocity Limit Block',
    res4.decision === 'RED' && res4.details.daily_budget_check === false,
    'Decision: RED (daily_budget_check: false)',
    `Decision: ${res4.decision} (${res4.reason})`
  );

  // ----------------------------------------------------
  // TEST 5: Autonomous Purchase Disabled (AMBER)
  // ----------------------------------------------------
  console.log('\n▶ Test 5: Transaction when autonomous_purchase is disabled');
  db.updateUserPolicy(userId, { autonomous_purchase: false });
  const res5 = evaluateUserPolicy(userId, 2000, 'running_shoes', 'upi');
  assertTest(
    'Manual Approval Gate Required',
    res5.decision === 'AMBER',
    'Decision: AMBER (approval required)',
    `Decision: ${res5.decision} (${res5.reason})`
  );
  // Restore autonomous purchase
  db.updateUserPolicy(userId, { autonomous_purchase: true });

  // ----------------------------------------------------
  // TEST 6: Payment Fallback Authorization (AMBER)
  // ----------------------------------------------------
  console.log('\n▶ Test 6: Primary method unlisted but authorized fallback available');
  // Attempt with netbanking (not in fallback_payments: ['upi', 'card'])
  const res6 = evaluateUserPolicy(userId, 2000, 'running_shoes', 'netbanking' as any);
  assertTest(
    'Fallback Method Redirection',
    res6.decision === 'AMBER' && res6.details.payment_method_check === false,
    'Decision: AMBER (fallback available)',
    `Decision: ${res6.decision} (${res6.reason})`
  );

  // ----------------------------------------------------
  // TEST 7: Payment Recovery State Machine (AMBER -> GREEN)
  // ----------------------------------------------------
  console.log('\n▶ Test 7: Simulated UPI Failure ➔ Automatic Card Fallback Recovery');
  const dummyOrder = createOrder({
    userId,
    merchantId: 'merchant-runpro',
    productId: 'prod-rp-001',
    variantId: null,
    quantity: 1,
    unitPrice: 4999,
    negotiatedPrice: 4645,
    agentSessionId: 'test-session-recovery',
  });

  const recoveryResult = await recoverPayment(
    userId,
    dummyOrder.id,
    4645,
    'upi',
    'test-session-recovery'
  );

  assertTest(
    'UPI Failure to Card Auto-Recovery',
    recoveryResult.success === true &&
      recoveryResult.finalMethod === 'card' &&
      recoveryResult.payment?.status === 'captured' &&
      recoveryResult.attempts.length >= 1,
    'Recovery: Success via Card (captured)',
    `Recovery: ${recoveryResult.success ? 'Success' : 'Failed'} via ${recoveryResult.finalMethod} (status: ${recoveryResult.payment?.status})`
  );

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log('\n------------------------------------------------------');
  const totalPassed = results.filter(r => r.passed).length;
  console.log(`Test Results: ${totalPassed} / ${results.length} PASSED`);
  console.log('------------------------------------------------------\n');

  if (totalPassed === results.length) {
    console.log('🎉 ALL POLICY ENGINE INVARIANTS PROVEN DETERMINISTICALLY!\n');
    setTimeout(() => process.exit(0), 50);
  } else {
    console.error('❌ SOME TESTS FAILED!\n');
    setTimeout(() => process.exit(1), 50);
  }
}

runPolicyTests().catch(err => {
  console.error('Fatal test error:', err);
  setTimeout(() => process.exit(1), 50);
});
