// ============================================================
// AgentGate — Cryptographic Transaction Authorization
// Implements canonical structure, signing, policy binding, and verification
// ============================================================

import crypto from 'crypto';
import type { PaymentMethod, UserPolicy } from '../types.js';
import { canonicalStringify, sha256 } from './canonical.js';
import { keyManager } from './key-manager.js';

export interface TransactionRequest {
  user_id: string;
  agent_id: string;
  merchant_id: string;
  merchant_domain?: string;
  category: string;
  amount: number;
  currency: 'INR';
  payment_method: PaymentMethod;
  purpose: string;
}

export interface CanonicalAuthorizationPayload {
  authorization_id: string;
  schema_version: '1.0';
  user_id: string;
  agent_id: string;
  purpose: string;
  merchant_id: string;
  merchant_domain?: string;
  category: string;
  amount: number;
  currency: 'INR';
  allowed_payment_methods: PaymentMethod[];
  policy_version: number;
  policy_hash: string;
  request_hash: string;
  issued_at: string;
  expires_at: string;
  nonce: string;
  key_id: string;
}

export interface TransactionAuthorization extends CanonicalAuthorizationPayload {
  signature: string;
}

export interface AuthorizationVerificationResult {
  valid: boolean;
  reason?: string;
  code?: 'INVALID_SIGNATURE' | 'EXPIRED' | 'FUTURE_ISSUED' | 'REPLAY_DETECTED' | 'POLICY_MISMATCH' | 'REQUEST_MISMATCH' | 'UNKNOWN_KEY' | 'UNSUPPORTED_ALGORITHM' | 'MALFORMED';
}

/**
 * Computes canonical SHA-256 hash for a normalized UserPolicy.
 */
export function computePolicyHash(policy: UserPolicy): string {
  const normalized = {
    user_id: policy.user_id,
    single_transaction_limit: policy.single_transaction_limit,
    daily_limit: policy.daily_limit,
    weekly_limit: policy.weekly_limit,
    autonomous_purchase: policy.autonomous_purchase,
    allowed_categories: [...policy.allowed_categories].sort(),
    fallback_payments: [...policy.fallback_payments].sort(),
    opportunity_alerts: policy.opportunity_alerts,
    max_opportunity_overshoot: policy.max_opportunity_overshoot,
    min_opportunity_improvement: policy.min_opportunity_improvement,
  };
  return sha256(normalized);
}

/**
 * Computes canonical SHA-256 hash for a normalized TransactionRequest.
 */
export function computeRequestHash(request: TransactionRequest): string {
  const normalized = {
    user_id: request.user_id,
    agent_id: request.agent_id,
    merchant_id: request.merchant_id,
    merchant_domain: request.merchant_domain || '',
    category: request.category,
    amount: request.amount,
    currency: request.currency,
    purpose: request.purpose,
  };
  return sha256(normalized);
}

/**
 * Creates and cryptographically signs a TransactionAuthorization using Ed25519.
 * Default validity period is 5 minutes (300 seconds).
 */
export function createTransactionAuthorization(params: {
  user_id: string;
  agent_id: string;
  purpose: string;
  merchant_id: string;
  merchant_domain?: string;
  category: string;
  amount: number;
  currency?: 'INR';
  allowed_payment_methods: PaymentMethod[];
  policy: UserPolicy;
  policy_version?: number;
  request: TransactionRequest;
  validitySeconds?: number;
}): TransactionAuthorization {
  const now = new Date();
  const validitySeconds = params.validitySeconds || 300;
  const expiresAt = new Date(now.getTime() + validitySeconds * 1000);

  const authorizationId = `auth_${crypto.randomUUID()}`;
  const nonce = crypto.randomBytes(16).toString('hex');
  const activeKeyId = keyManager.getActiveKeyId();

  const policyHash = computePolicyHash(params.policy);
  const requestHash = computeRequestHash(params.request);

  const canonicalPayload: CanonicalAuthorizationPayload = {
    authorization_id: authorizationId,
    schema_version: '1.0',
    user_id: params.user_id,
    agent_id: params.agent_id,
    purpose: params.purpose,
    merchant_id: params.merchant_id,
    merchant_domain: params.merchant_domain,
    category: params.category,
    amount: params.amount,
    currency: params.currency || 'INR',
    allowed_payment_methods: [...params.allowed_payment_methods],
    policy_version: params.policy_version || 1,
    policy_hash: policyHash,
    request_hash: requestHash,
    issued_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    nonce,
    key_id: activeKeyId,
  };

  const serialized = canonicalStringify(canonicalPayload);
  const { signature } = keyManager.signPayload(serialized);

  return {
    ...canonicalPayload,
    signature,
  };
}

/**
 * Extracts canonical payload (omitting signature) for verification.
 */
export function extractCanonicalPayload(auth: TransactionAuthorization): CanonicalAuthorizationPayload {
  return {
    authorization_id: auth.authorization_id,
    schema_version: auth.schema_version,
    user_id: auth.user_id,
    agent_id: auth.agent_id,
    purpose: auth.purpose,
    merchant_id: auth.merchant_id,
    merchant_domain: auth.merchant_domain,
    category: auth.category,
    amount: auth.amount,
    currency: auth.currency,
    allowed_payment_methods: auth.allowed_payment_methods,
    policy_version: auth.policy_version,
    policy_hash: auth.policy_hash,
    request_hash: auth.request_hash,
    issued_at: auth.issued_at,
    expires_at: auth.expires_at,
    nonce: auth.nonce,
    key_id: auth.key_id,
  };
}

/**
 * Fully verifies a TransactionAuthorization:
 * 1. Checks schema & fields
 * 2. Checks timestamp freshness and expiration with clock-skew tolerance
 * 3. Verifies Ed25519 signature against registered public key
 * 4. Verifies transaction binding against actual request
 * 5. Verifies policy hash against current policy
 */
export function verifyTransactionAuthorization(
  auth: TransactionAuthorization,
  options?: {
    expectedRequest?: TransactionRequest;
    currentPolicy?: UserPolicy;
    clockSkewToleranceSeconds?: number;
  }
): AuthorizationVerificationResult {
  if (!auth || typeof auth !== 'object') {
    return { valid: false, reason: 'Authorization object is null or not an object.', code: 'MALFORMED' };
  }

  if (auth.schema_version !== '1.0') {
    return { valid: false, reason: `Unsupported schema version "${auth.schema_version}". Expected "1.0".`, code: 'MALFORMED' };
  }

  if (!auth.signature || typeof auth.signature !== 'string') {
    return { valid: false, reason: 'Missing cryptographic signature.', code: 'INVALID_SIGNATURE' };
  }

  if (!auth.key_id || typeof auth.key_id !== 'string') {
    return { valid: false, reason: 'Missing key_id.', code: 'UNKNOWN_KEY' };
  }

  if (!keyManager.getPublicKeyPem(auth.key_id)) {
    return { valid: false, reason: `Unknown key_id "${auth.key_id}". Verification failed closed.`, code: 'UNKNOWN_KEY' };
  }

  // --- Freshness & Clock Skew Verification ---
  const skew = (options?.clockSkewToleranceSeconds ?? 30) * 1000;
  const now = Date.now();
  const issuedAt = new Date(auth.issued_at).getTime();
  const expiresAt = new Date(auth.expires_at).getTime();

  if (isNaN(issuedAt) || isNaN(expiresAt)) {
    return { valid: false, reason: 'Invalid ISO timestamps in authorization.', code: 'MALFORMED' };
  }

  if (issuedAt > now + skew) {
    return { valid: false, reason: `Authorization issued_at is in the future (${auth.issued_at}). Rejected.`, code: 'FUTURE_ISSUED' };
  }

  if (expiresAt < now - skew) {
    return { valid: false, reason: `Authorization expired at ${auth.expires_at}. Rejected.`, code: 'EXPIRED' };
  }

  if (expiresAt <= issuedAt) {
    return { valid: false, reason: 'expires_at must be strictly after issued_at.', code: 'MALFORMED' };
  }

  // --- Cryptographic Signature Verification ---
  const canonicalPayload = extractCanonicalPayload(auth);
  const serialized = canonicalStringify(canonicalPayload);
  const sigResult = keyManager.verifySignature(serialized, auth.signature, auth.key_id);

  if (!sigResult.valid) {
    return { valid: false, reason: sigResult.reason || 'Ed25519 signature verification failed.', code: 'INVALID_SIGNATURE' };
  }

  // --- Transaction Request Binding Verification ---
  if (options?.expectedRequest) {
    const req = options.expectedRequest;

    if (auth.user_id !== req.user_id) {
      return { valid: false, reason: `User mismatch: auth user "${auth.user_id}" != request user "${req.user_id}".`, code: 'REQUEST_MISMATCH' };
    }

    if (auth.merchant_id !== req.merchant_id) {
      return { valid: false, reason: `Merchant mismatch: auth merchant "${auth.merchant_id}" != request merchant "${req.merchant_id}".`, code: 'REQUEST_MISMATCH' };
    }

    if (auth.category !== req.category) {
      return { valid: false, reason: `Category mismatch: auth category "${auth.category}" != request category "${req.category}".`, code: 'REQUEST_MISMATCH' };
    }

    if (req.amount > auth.amount) {
      return { valid: false, reason: `Amount exceeded: request amount ₹${req.amount} > authorized amount ₹${auth.amount}.`, code: 'REQUEST_MISMATCH' };
    }

    if (auth.currency !== req.currency) {
      return { valid: false, reason: `Currency mismatch: auth currency "${auth.currency}" != request currency "${req.currency}".`, code: 'REQUEST_MISMATCH' };
    }

    if (!auth.allowed_payment_methods.includes(req.payment_method)) {
      return { valid: false, reason: `Payment method "${req.payment_method}" is not in authorized list: ${auth.allowed_payment_methods.join(', ')}.`, code: 'REQUEST_MISMATCH' };
    }

    const calculatedReqHash = computeRequestHash(req);
    if (auth.request_hash !== calculatedReqHash) {
      return { valid: false, reason: `Request hash mismatch. Expected ${calculatedReqHash}, received ${auth.request_hash}.`, code: 'REQUEST_MISMATCH' };
    }
  }

  // --- Policy Hash Binding Verification ---
  if (options?.currentPolicy) {
    const calculatedPolicyHash = computePolicyHash(options.currentPolicy);
    if (auth.policy_hash !== calculatedPolicyHash) {
      return { valid: false, reason: `Policy hash mismatch. The active policy has changed since authorization was signed.`, code: 'POLICY_MISMATCH' };
    }
  }

  return { valid: true };
}
