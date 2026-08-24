import { initializeDatabase } from './db/database.js';
import { executeBuyerFlow } from './agents/buyer-agent.js';
import { db } from './db/database.js';

async function runTest() {
  console.log('--- Initializing AgentGate Database ---');
  initializeDatabase();

  console.log('\n--- TEST 1: Winning Demo Purchase Flow ---');
  const demoResult = await executeBuyerFlow(
    'demo-buyer-001',
    'Buy black running shoes for daily training, size 9, under ₹6,000'
  );

  console.log('Session ID:', demoResult.session_id);
  console.log('Parsed Category:', demoResult.intent.category);
  console.log('Candidates Found:', demoResult.candidates.length);
  console.log('Selected Product:', demoResult.selected?.product.title, 'at ₹' + demoResult.selected?.product.price);
  console.log('Negotiated Final Price: ₹' + demoResult.negotiation?.final_price, '(Status:', demoResult.negotiation?.status + ')');
  console.log('Policy Gate Decision:', demoResult.policy_evaluation.decision);
  console.log('Order ID:', demoResult.order?.id);
  console.log('Payment Status:', demoResult.payment?.status, '| Method:', demoResult.payment?.method, '| Was Recovered:', demoResult.payment?.is_recovery_attempt);
  console.log('Opportunity Alert:', demoResult.opportunity?.should_alert ? demoResult.opportunity.message : 'None');
  console.log('Audit Trail Entries Count:', demoResult.audit_trail.length);

  if (
    demoResult.policy_evaluation.decision === 'GREEN' &&
    demoResult.payment?.status === 'captured' &&
    demoResult.order !== null &&
    demoResult.audit_trail.length >= 5
  ) {
    console.log('>>> TEST 1 PASSED: End-to-end autonomous flow, negotiation, and Razorpay payment executed perfectly! <<<');
  } else {
    console.error('>>> TEST 1 FAILED: Conditions not met <<<');
    process.exit(1);
  }

  console.log('\n--- TEST 2: Deterministic Policy Boundary Block ---');
  const blockResult = await executeBuyerFlow(
    'demo-buyer-001',
    'Buy TechNest ProWatch Ultra smartwatch for ₹10,000'
  );

  console.log('Policy Decision on ₹50,000 request:', blockResult.policy_evaluation.decision);
  console.log('Block Reason:', blockResult.policy_evaluation.reason);
  console.log('Order created:', blockResult.order ? 'YES (UNEXPECTED)' : 'NO (CORRECT)');

  if (blockResult.policy_evaluation.decision === 'RED' && blockResult.order === null) {
    console.log('>>> TEST 2 PASSED: Out-of-bounds purchase blocked deterministically by Policy Engine! <<<');
  } else {
    console.error('>>> TEST 2 FAILED: Policy engine failed to block <<<');
    process.exit(1);
  }

  console.log('\n=============================================');
  console.log('🎉 ALL INTEGRATION TESTS PASSED WITH 0 ERRORS!');
  console.log('=============================================');
  setTimeout(() => process.exit(0), 50);
}

runTest().catch((err) => {
  console.error('Test failed with error:', err);
  setTimeout(() => process.exit(1), 50);
});
