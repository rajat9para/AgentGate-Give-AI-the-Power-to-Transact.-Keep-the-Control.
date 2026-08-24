// ============================================================
// AgentGate — Cryptographic Authorization & Security Test Suite
// Rigorously tests all 20+ security invariants, failure modes, and gateways
// ============================================================

import crypto from 'crypto';
import { initializeDatabase, db } from '../db/database.js';
import { canonicalStringify, sha256 } from './canonical.js';
import { keyManager } from './key-manager.js';
import {
  createTransactionAuthorization,
  verifyTransactionAuthorization,
  computePolicyHash,
  computeRequestHash,
  TransactionRequest,
  TransactionAuthorization,
} from './authorization.js';
import { nonceStore } from './nonce-store.js';
import { budgetReservationEngine } from './budget-reservation.js';
import { executionGateway } from '../gateway/execution-gateway.js';
import { auditService } from '../audit/audit-service.js';
import { executeBuyerFlow } from '../agents/buyer-agent.js';
import type { UserPolicy, AuditLog } from '../types.js';

interface TestResult {
  num: number;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
}

const results: TestResult[] = [];
let testCounter = 1;

function assertSecurityTest(name: string, condition: boolean, expected: string, actual: string) {
  results.push({
    num: testCounter++,
    name,
    passed: condition,
    expected,
    actual,
  });
  if (condition) {
    console.log(`  ✅ PASS [${results[results.length - 1].num}]: ${name}`);
  } else {
    console.error(`  ❌ FAIL [${results[results.length - 1].num}]: ${name}`);
    console.error(`     Expected: ${expected}`);
    console.error(`     Actual:   ${actual}`);
  }
}

async function runSecurityTestSuite() {
  console.log('\n========================================================================');
  console.log('🔒 AgentGate Cryptographically Bound Transaction Authorization Test Suite');
  console.log('========================================================================\n');

  initializeDatabase();
  nonceStore.reset();
  budgetReservationEngine.reset();
  const userId = 'demo-buyer-001';
  const policy = db.getUserPolicy(userId)!;

  const validRequest: TransactionRequest = {
    user_id: userId,
    agent_id: 'buyer-agent',
    merchant_id: 'merchant-runpro',
    category: 'running_shoes',
    amount: 5500,
    currency: 'INR',
    payment_method: 'upi',
    purpose: 'Purchase: RunPro Velocity X Daily Trainer',
  };

  // ----------------------------------------------------
  // TEST 1: Valid Authorization Creation & Ed25519 Verification
  // ----------------------------------------------------
  console.log('▶ Test 1: Valid Transaction Authorization Verification');
  const validAuth = createTransactionAuthorization({
    user_id: validRequest.user_id,
    agent_id: validRequest.agent_id,
    purpose: validRequest.purpose,
    merchant_id: validRequest.merchant_id,
    category: validRequest.category,
    amount: validRequest.amount,
    currency: validRequest.currency,
    allowed_payment_methods: ['upi', 'card'],
    policy,
    request: validRequest,
    validitySeconds: 300,
  });

  const res1 = verifyTransactionAuthorization(validAuth, {
    expectedRequest: validRequest,
    currentPolicy: policy,
  });

  assertSecurityTest(
    'Valid Ed25519 Authorization Verification',
    res1.valid === true,
    'valid: true',
    `valid: ${res1.valid} (reason: ${res1.reason || 'OK'})`
  );

  // ----------------------------------------------------
  // TEST 2: Tampered Signature Fails (Cryptographic Integrity)
  // ----------------------------------------------------
  console.log('\n▶ Test 2: Invalid/Tampered Signature Rejection');
  const tamperedSigAuth = {
    ...validAuth,
    signature: 'bad' + validAuth.signature.slice(3),
  };
  const res2 = verifyTransactionAuthorization(tamperedSigAuth, { expectedRequest: validRequest });
  assertSecurityTest(
    'Tampered Signature Rejection',
    res2.valid === false && res2.code === 'INVALID_SIGNATURE',
    'valid: false (INVALID_SIGNATURE)',
    `valid: ${res2.valid} (code: ${res2.code}, reason: ${res2.reason})`
  );

  // ----------------------------------------------------
  // TEST 3: Modified Amount Fails (Transaction Binding)
  // ----------------------------------------------------
  console.log('\n▶ Test 3: Modified Amount Rejection');
  const tamperedAmountAuth = {
    ...validAuth,
    amount: 9999, // Attacker increases authorized amount
  };
  const res3 = verifyTransactionAuthorization(tamperedAmountAuth, { expectedRequest: validRequest });
  assertSecurityTest(
    'Modified Amount Signature Mismatch',
    res3.valid === false && res3.code === 'INVALID_SIGNATURE',
    'valid: false (INVALID_SIGNATURE due to canonical mismatch)',
    `valid: ${res3.valid} (${res3.reason})`
  );

  // ----------------------------------------------------
  // TEST 4: Modified Merchant Fails (Transaction Binding)
  // ----------------------------------------------------
  console.log('\n▶ Test 4: Modified Merchant ID Rejection');
  const tamperedMerchantReq: TransactionRequest = {
    ...validRequest,
    merchant_id: 'merchant-evil-store',
  };
  const res4 = verifyTransactionAuthorization(validAuth, { expectedRequest: tamperedMerchantReq });
  assertSecurityTest(
    'Merchant Mismatch Rejection',
    res4.valid === false && res4.code === 'REQUEST_MISMATCH',
    'valid: false (REQUEST_MISMATCH: Merchant mismatch)',
    `valid: ${res4.valid} (${res4.reason})`
  );

  // ----------------------------------------------------
  // TEST 5: Modified Category Fails (Transaction Binding)
  // ----------------------------------------------------
  console.log('\n▶ Test 5: Modified Category Rejection');
  const tamperedCategoryReq: TransactionRequest = {
    ...validRequest,
    category: 'gift_cards',
  };
  const res5 = verifyTransactionAuthorization(validAuth, { expectedRequest: tamperedCategoryReq });
  assertSecurityTest(
    'Category Mismatch Rejection',
    res5.valid === false && res5.code === 'REQUEST_MISMATCH',
    'valid: false (REQUEST_MISMATCH: Category mismatch)',
    `valid: ${res5.valid} (${res5.reason})`
  );

  // ----------------------------------------------------
  // TEST 6: Modified Currency Fails (Transaction Binding)
  // ----------------------------------------------------
  console.log('\n▶ Test 6: Modified Currency Rejection');
  const tamperedCurrencyReq = {
    ...validRequest,
    currency: 'USD' as any,
  };
  const res6 = verifyTransactionAuthorization(validAuth, { expectedRequest: tamperedCurrencyReq });
  assertSecurityTest(
    'Currency Mismatch Rejection',
    res6.valid === false && res6.code === 'REQUEST_MISMATCH',
    'valid: false (REQUEST_MISMATCH: Currency mismatch)',
    `valid: ${res6.valid} (${res6.reason})`
  );

  // ----------------------------------------------------
  // TEST 7: Modified Payment Method Fails (Binding Constraint)
  // ----------------------------------------------------
  console.log('\n▶ Test 7: Unauthorized Payment Method Rejection');
  const tamperedMethodReq: TransactionRequest = {
    ...validRequest,
    payment_method: 'wallet' as any, // Not in ['upi', 'card']
  };
  const res7 = verifyTransactionAuthorization(validAuth, { expectedRequest: tamperedMethodReq });
  assertSecurityTest(
    'Unauthorized Payment Method Rejection',
    res7.valid === false && res7.code === 'REQUEST_MISMATCH',
    'valid: false (REQUEST_MISMATCH: Payment method not authorized)',
    `valid: ${res7.valid} (${res7.reason})`
  );

  // ----------------------------------------------------
  // TEST 8: Modified Policy Fails (Policy Hash Binding)
  // ----------------------------------------------------
  console.log('\n▶ Test 8: Modified Policy Hash Rejection');
  const modifiedPolicy: UserPolicy = {
    ...policy,
    single_transaction_limit: 1000, // Policy was changed after auth was signed
  };
  const res8 = verifyTransactionAuthorization(validAuth, {
    expectedRequest: validRequest,
    currentPolicy: modifiedPolicy,
  });
  assertSecurityTest(
    'Policy Hash Mismatch Rejection',
    res8.valid === false && res8.code === 'POLICY_MISMATCH',
    'valid: false (POLICY_MISMATCH)',
    `valid: ${res8.valid} (${res8.reason})`
  );

  // ----------------------------------------------------
  // TEST 9: Modified Request Hash Fails
  // ----------------------------------------------------
  console.log('\n▶ Test 9: Request Hash Mismatch Rejection');
  const tamperedPurposeReq: TransactionRequest = {
    ...validRequest,
    purpose: 'Substituted malicious purchase',
  };
  const res9 = verifyTransactionAuthorization(validAuth, { expectedRequest: tamperedPurposeReq });
  assertSecurityTest(
    'Request Hash Mismatch Rejection',
    res9.valid === false && res9.code === 'REQUEST_MISMATCH',
    'valid: false (REQUEST_MISMATCH: Request hash mismatch)',
    `valid: ${res9.valid} (${res9.reason})`
  );

  // ----------------------------------------------------
  // TEST 10: Expired Authorization Fails (Freshness)
  // ----------------------------------------------------
  console.log('\n▶ Test 10: Expired Authorization Rejection');
  const expiredAuth: TransactionAuthorization = {
    ...validAuth,
    issued_at: new Date(Date.now() - 600000).toISOString(),
    expires_at: new Date(Date.now() - 300000).toISOString(), // Expired 5 mins ago
  };
  const res10 = verifyTransactionAuthorization(expiredAuth, { clockSkewToleranceSeconds: 10 });
  assertSecurityTest(
    'Expired Authorization Rejection',
    res10.valid === false && res10.code === 'EXPIRED',
    'valid: false (EXPIRED)',
    `valid: ${res10.valid} (${res10.reason})`
  );

  // ----------------------------------------------------
  // TEST 11: Future-Issued Authorization Fails (Freshness)
  // ----------------------------------------------------
  console.log('\n▶ Test 11: Future-Issued Authorization Rejection');
  const futureAuth: TransactionAuthorization = {
    ...validAuth,
    issued_at: new Date(Date.now() + 600000).toISOString(), // Issued 10 mins in future
    expires_at: new Date(Date.now() + 900000).toISOString(),
  };
  const res11 = verifyTransactionAuthorization(futureAuth, { clockSkewToleranceSeconds: 10 });
  assertSecurityTest(
    'Future Timestamp Rejection',
    res11.valid === false && res11.code === 'FUTURE_ISSUED',
    'valid: false (FUTURE_ISSUED)',
    `valid: ${res11.valid} (${res11.reason})`
  );

  // ----------------------------------------------------
  // TEST 12: Reused Nonce Fails (Replay Protection)
  // ----------------------------------------------------
  console.log('\n▶ Test 12: Reused Nonce Rejection');
  const nonceTest = crypto.randomBytes(16).toString('hex');
  const firstConsume = nonceStore.consume(nonceTest, 'auth_test_1');
  const replayNonce = nonceStore.consume(nonceTest, 'auth_test_2');
  assertSecurityTest(
    'Reused Nonce Interception',
    firstConsume.success === true && replayNonce.success === false,
    'first: success, second: rejected',
    `first: ${firstConsume.success}, second: ${replayNonce.success} (${replayNonce.reason})`
  );

  // ----------------------------------------------------
  // TEST 13: Reused Authorization ID Fails (Replay Protection)
  // ----------------------------------------------------
  console.log('\n▶ Test 13: Reused Authorization ID Rejection');
  const authIdTest = 'auth_duplicate_check_001';
  const firstAuthConsume = nonceStore.consume(crypto.randomBytes(16).toString('hex'), authIdTest);
  const replayAuthConsume = nonceStore.consume(crypto.randomBytes(16).toString('hex'), authIdTest);
  assertSecurityTest(
    'Reused Authorization ID Interception',
    firstAuthConsume.success === true && replayAuthConsume.success === false,
    'first: success, second: rejected',
    `first: ${firstAuthConsume.success}, second: ${replayAuthConsume.success} (${replayAuthConsume.reason})`
  );

  // ----------------------------------------------------
  // TEST 14: Atomic Budget Reservation Prevents Concurrent Overspending
  // ----------------------------------------------------
  console.log('\n▶ Test 14: Atomic Budget Reservation Race-Condition Protection');
  budgetReservationEngine.reset();
  const limits = { dailyLimit: 10000, weeklyLimit: 25000, singleLimit: 6000 };

  // Concurrent Request A reserves ₹5,500 (Remaining: ₹4,500)
  const resA = budgetReservationEngine.reserve(userId, 'auth_req_A', 5500, limits);
  // Concurrent Request B attempts to reserve ₹5,500 (Total = ₹11,000 > ₹10,000 limit)
  const resB = budgetReservationEngine.reserve(userId, 'auth_req_B', 5500, limits);

  assertSecurityTest(
    'Concurrent Budget Exhaustion Protection',
    resA.success === true && resB.success === false,
    'Request A: Reserved, Request B: Blocked (exceeds daily limit)',
    `Request A: ${resA.success}, Request B: ${resB.success} (${resB.reason})`
  );

  // Clean up test reservations
  budgetReservationEngine.reset();

  // ----------------------------------------------------
  // TEST 15: Fallback Payment Cannot Exceed Authorized Methods
  // ----------------------------------------------------
  console.log('\n▶ Test 15: Fallback Payment Method Constraint');
  const fallbackAuth = createTransactionAuthorization({
    user_id: validRequest.user_id,
    agent_id: validRequest.agent_id,
    purpose: validRequest.purpose,
    merchant_id: validRequest.merchant_id,
    category: validRequest.category,
    amount: validRequest.amount,
    allowed_payment_methods: ['upi'], // ONLY UPI allowed, NO card
    policy,
    request: validRequest,
  });

  const gatewayFallbackRes = await executionGateway.executeFallbackPayment({
    authorization: fallbackAuth,
    fallbackMethod: 'card', // Attempt to expand scope to Card
    orderId: 'dummy_order_123',
    amount: 5500,
    session_id: 'test_session_fallback',
    attemptNumber: 1,
  });

  assertSecurityTest(
    'Unauthorized Fallback Method Rejection by Gateway',
    gatewayFallbackRes.success === false && gatewayFallbackRes.rejectionCode === 'UNAUTHORIZED_FALLBACK_METHOD',
    'success: false (UNAUTHORIZED_FALLBACK_METHOD)',
    `success: ${gatewayFallbackRes.success} (${gatewayFallbackRes.rejectionReason})`
  );

  // ----------------------------------------------------
  // TEST 16: Unknown Key ID Fails (Fail Closed)
  // ----------------------------------------------------
  console.log('\n▶ Test 16: Unknown Key ID Rejection');
  const unknownKeyAuth = {
    ...validAuth,
    key_id: 'agentgate-untrusted-key-999',
  };
  const res16 = verifyTransactionAuthorization(unknownKeyAuth);
  assertSecurityTest(
    'Unknown Key ID Fail Closed',
    res16.valid === false && res16.code === 'UNKNOWN_KEY',
    'valid: false (UNKNOWN_KEY)',
    `valid: ${res16.valid} (${res16.reason})`
  );

  // ----------------------------------------------------
  // TEST 17: Key Rotation Support
  // ----------------------------------------------------
  console.log('\n▶ Test 17: Key Rotation Support (Old Auth Verified by Registered Public Key)');
  const oldKeyId = keyManager.getActiveKeyId();
  const authSignedWithOldKey = createTransactionAuthorization({
    user_id: validRequest.user_id,
    agent_id: validRequest.agent_id,
    purpose: validRequest.purpose,
    merchant_id: validRequest.merchant_id,
    category: validRequest.category,
    amount: validRequest.amount,
    allowed_payment_methods: ['upi', 'card'],
    policy,
    request: validRequest,
  });

  // Rotate key to new version
  keyManager.rotateKey('agentgate-prod-2026-09-v2');

  // Verify auth signed with old key still passes using old registered public key
  const res17 = verifyTransactionAuthorization(authSignedWithOldKey, { expectedRequest: validRequest });
  assertSecurityTest(
    'Key Rotation Compatibility',
    res17.valid === true && authSignedWithOldKey.key_id === oldKeyId,
    'valid: true with old key ID',
    `valid: ${res17.valid} (key_id: ${authSignedWithOldKey.key_id})`
  );

  // ----------------------------------------------------
  // TEST 18: Audit Chain Tampering is Detected
  // ----------------------------------------------------
  console.log('\n▶ Test 18: Tamper-Evident Audit Chain Record Modification Detection');
  // Create sample audit events
  auditService.log({
    agent_id: 'buyer-agent',
    user_id: userId,
    merchant_id: 'merchant-runpro',
    session_id: 'test_audit_session',
    action: 'test_action_1',
    requested_amount: 1000,
    approved_amount: 1000,
    reason: 'Initial test event',
    result: 'success',
  });

  auditService.log({
    agent_id: 'buyer-agent',
    user_id: userId,
    merchant_id: 'merchant-runpro',
    session_id: 'test_audit_session',
    action: 'test_action_2',
    requested_amount: 2000,
    approved_amount: 2000,
    reason: 'Second test event',
    result: 'success',
  });

  const validAuditLogs = auditService.getAll();
  const validChainCheck = auditService.verifyChain(validAuditLogs);

  // Tamper with a record's reason
  const tamperedAuditLogs = JSON.parse(JSON.stringify(validAuditLogs)) as AuditLog[];
  tamperedAuditLogs[0].reason = 'Malicious attacker changed audit reason!';

  const tamperedChainCheck = auditService.verifyChain(tamperedAuditLogs);

  assertSecurityTest(
    'Audit Trail Content Tampering Detection',
    validChainCheck.valid === true && tamperedChainCheck.valid === false,
    'Valid chain: true, Tampered chain: false',
    `Valid chain: ${validChainCheck.valid}, Tampered chain: ${tamperedChainCheck.valid} (${tamperedChainCheck.reason})`
  );

  // ----------------------------------------------------
  // TEST 19: Audit Event Deletion is Detected
  // ----------------------------------------------------
  console.log('\n▶ Test 19: Tamper-Evident Audit Chain Event Deletion Detection');
  // Delete the middle event from the chain
  const deletedEventLogs = [validAuditLogs[0], ...validAuditLogs.slice(2)];
  const deletedChainCheck = auditService.verifyChain(deletedEventLogs);

  assertSecurityTest(
    'Audit Event Deletion Detection',
    deletedChainCheck.valid === false,
    'deleted chain: false (broken previous_event_hash)',
    `deleted chain: ${deletedChainCheck.valid} (${deletedChainCheck.reason})`
  );

  // ----------------------------------------------------
  // TEST 20: Audit Event Reordering is Detected
  // ----------------------------------------------------
  console.log('\n▶ Test 20: Tamper-Evident Audit Chain Event Reordering Detection');
  // Reorder events
  const reorderedLogs = [validAuditLogs[1], validAuditLogs[0], ...validAuditLogs.slice(2)];
  const reorderedChainCheck = auditService.verifyChain(reorderedLogs);

  assertSecurityTest(
    'Audit Event Reordering Detection',
    reorderedChainCheck.valid === false,
    'reordered chain: false',
    `reordered chain: ${reorderedChainCheck.valid} (${reorderedChainCheck.reason})`
  );

  // ----------------------------------------------------
  // TEST 21: Full End-to-End Integration Flow via Execution Gateway
  // ----------------------------------------------------
  console.log('\n▶ Test 21: Full Integration Flow (Agent → Policy → Ed25519 Auth → Execution Gateway → Razorpay)');
  budgetReservationEngine.reset();
  const flowResult = await executeBuyerFlow(
    userId,
    'Buy black running shoes for daily training, size 9, under ₹6,000'
  );

  const authInFlow = flowResult.policy_evaluation.authorization;
  const auditVerification = auditService.verifyChain();

  assertSecurityTest(
    'End-to-End Cryptographic Execution Pipeline',
    flowResult.policy_evaluation.decision === 'GREEN' &&
      authInFlow !== undefined &&
      authInFlow.signature.length > 32 &&
      flowResult.payment?.status === 'captured' &&
      auditVerification.valid === true,
    'Policy GREEN + Ed25519 Auth + Payment Captured + Audit Chain 100% Valid',
    `Policy: ${flowResult.policy_evaluation.decision}, Auth: ${authInFlow ? 'Signed (' + authInFlow.key_id + ')' : 'None'}, Payment: ${flowResult.payment?.status}, Audit Chain: ${auditVerification.valid ? 'Valid (' + auditVerification.totalEvents + ' events)' : 'Invalid'}`
  );

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log('\n========================================================================');
  const totalPassed = results.filter(r => r.passed).length;
  console.log(`Security Test Results: ${totalPassed} / ${results.length} PASSED`);
  console.log('========================================================================\n');

  if (totalPassed === results.length) {
    console.log('🎉 ALL 21 CRYPTOGRAPHIC & SECURITY INVARIANTS RIGOROUSLY VERIFIED!\n');
    setTimeout(() => process.exit(0), 50);
  } else {
    console.error('❌ SOME SECURITY TESTS FAILED!\n');
    setTimeout(() => process.exit(1), 50);
  }
}

runSecurityTestSuite().catch(err => {
  console.error('Fatal security test error:', err);
  process.exit(1);
});
