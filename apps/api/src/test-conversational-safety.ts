// ============================================================
// AgentGate — Conversational Safety & Non-Trigger Unit Tests
// Rigorously verifies that greetings, help questions, and browsing
// NEVER trigger orders, authorizations, or financial deductions.
// ============================================================

import { executeBuyerFlow } from './agents/buyer-agent.js';
import { initializeDatabase } from './db/database.js';

async function runConversationalSafetyTests() {
  console.log('\n======================================================');
  console.log('🧪 AgentGate Conversational & Financial Safety Test Suite');
  console.log('======================================================\n');

  initializeDatabase();

  // Test 1: Simple Greeting "hello"
  console.log('▶ Test 1: Simple Greeting ("hello")');
  const greetingRes = await executeBuyerFlow('demo-buyer-001', 'hello');
  if (greetingRes.order === null && greetingRes.payment === null && greetingRes.candidates.length === 0) {
    console.log('  ✅ PASS: Greeting handled conversationally — ZERO financial deduction & no order created.');
  } else {
    console.error('  ❌ FAIL: Greeting triggered an order!', greetingRes.order);
    process.exitCode = 1;
    return;
  }

  // Test 2: Help & Capability Inquiry ("what can you do?")
  console.log('\n▶ Test 2: Capability Inquiry ("what can you do?")');
  const helpRes = await executeBuyerFlow('demo-buyer-001', 'what can you do?');
  if (helpRes.order === null && helpRes.payment === null) {
    console.log('  ✅ PASS: Capabilities explained — ZERO financial deduction.');
  } else {
    console.error('  ❌ FAIL: Help question triggered an order!', helpRes.order);
    process.exitCode = 1;
    return;
  }

  // Test 3: Browsing Only ("show me running shoes")
  console.log('\n▶ Test 3: Browsing / Search Query ("show me running shoes")');
  const browseRes = await executeBuyerFlow('demo-buyer-001', 'show me running shoes');
  if (browseRes.order === null && browseRes.candidates.length > 0) {
    console.log(`  ✅ PASS: Browsing returned ${browseRes.candidates.length} candidates WITHOUT placing autonomous order.`);
  } else {
    console.error('  ❌ FAIL: Browsing triggered an autonomous order without explicit buy command!');
    process.exitCode = 1;
    return;
  }

  // Test 4: Explicit Purchase Request ("Buy black running shoes size 9 under 6000")
  console.log('\n▶ Test 4: Explicit Purchase Intent ("Buy black running shoes size 9 under 6000")');
  const buyRes = await executeBuyerFlow('demo-buyer-001', 'Buy black running shoes for daily training, size 9, under 6000');
  if (buyRes.order !== null && buyRes.payment !== null && buyRes.policy_evaluation.decision === 'GREEN') {
    console.log(`  ✅ PASS: Valid purchase executed autonomously! Order: #${buyRes.order.id.slice(0, 8)}, Paid: ₹${buyRes.payment.amount}`);
  } else {
    console.error('  ❌ FAIL: Explicit purchase failed to complete!', buyRes);
    process.exitCode = 1;
    return;
  }

  // Test 5: Out of bounds purchase ("Buy smartwatch for 50000")
  console.log('\n▶ Test 5: Policy Exceeded Purchase ("Buy smartwatch for 50000")');
  const blockedRes = await executeBuyerFlow('demo-buyer-001', 'Buy smartwatch for 50000');
  if (blockedRes.order === null && blockedRes.policy_evaluation.decision === 'RED') {
    console.log('  ✅ PASS: Policy Engine deterministically blocked ₹50,000 purchase.');
  } else {
    console.error('  ❌ FAIL: Blocked purchase created an order!');
    process.exitCode = 1;
    return;
  }

  console.log('\n------------------------------------------------------');
  console.log('Safety Test Results: 5 / 5 PASSED');
  console.log('------------------------------------------------------\n');
  console.log('🎉 ALL CONVERSATIONAL & FINANCIAL SAFETY INVARIANTS RIGOROUSLY VERIFIED!\n');
  process.exitCode = 0;
}

runConversationalSafetyTests().catch(err => {
  console.error('Safety test error:', err);
  process.exitCode = 1;
});
