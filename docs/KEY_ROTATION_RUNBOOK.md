# 🔐 Operational Runbook: Ed25519 Key Rotation

**Service:** RazorX / AgentGate Cryptographic Authority  
**Algorithm:** Ed25519 (RFC 8032) Asymmetric Digital Signatures  
**Author:** RazorX Security & Infrastructure Engineering

---

## 1. Overview & Rotation Invariants

RazorX uses Ed25519 asymmetric cryptography to authorize autonomous AI transactions. Every signed `TransactionAuthorization` is stamped with a `key_id`, a one-time `nonce`, and an `expires_at` timestamp (default TTL: 300 seconds).

When rotating the active signing key:
1. **Zero Downtime:** In-flight authorizations signed with the old key remain verifiable until their TTL expires (max 5 minutes).
2. **Persistence:** Old public keys remain registered in the key registry / database so past audit records remain mathematically verifiable indefinitely.
3. **Immutability:** Once a key is rotated, new transactions are signed strictly with the new `key_id`.

---

## 2. Standard Key Rotation Procedure

### Phase A: Key Generation
Generate a new Ed25519 keypair either locally via OpenSSL or within Cloud KMS / AWS KMS / Vault:

```bash
# Generate Ed25519 Private Key in PKCS8 PEM format
openssl genpkey -algorithm ed25519 -out agentgate_ed25519_2026_q4.pem

# Extract Public Key in SPKI PEM format
openssl pkey -in agentgate_ed25519_2026_q4.pem -pubout -out agentgate_ed25519_2026_q4.pub
```

### Phase B: Automated In-Process Key Rotation
You can execute a live key rotation programmatically via the `keyManager` service:

```typescript
import { keyManager } from './crypto/key-manager.js';

// Rotate to new active key ID while keeping prior public key registered for verification
const rotatedKey = keyManager.rotateKey(
  'agentgate-prod-2026-11-v2',
  newPrivateKeyPem,
  newPublicKeyPem
);

console.log(`Active signing key rotated to: ${rotatedKey.keyId}`);
```

### Phase C: Environment Variable Updates (for Multi-Instance Deployments)
Update environment secrets on Render / Kubernetes / Cloud Run:

```env
ED25519_KEY_ID="agentgate-prod-2026-11-v2"
ED25519_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
ED25519_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
```

Trigger a rolling deployment. Older instances continue verifying transactions with registered keys, and new instances immediately begin issuing signatures with the new key ID.

---

## 3. Verification & Health Audit

After rotation, verify key status via the management API:

```bash
# 1. Check Active Key ID and Public Key
curl -X GET https://<api-host>/api/crypto/active-key

# 2. Inspect Full Key Rotation Audit History
curl -X GET https://<api-host>/api/crypto/rotation-history
```

---

## 4. Emergency Key Revocation / Incident Response

In the event of a suspected private key exposure:
1. **Immediate Revocation:** Call `keyManager.rotateKey('emergency-revocation-key-id')` or redeploy with newly generated key material.
2. **Flush Nonce Store:** Invalidate active uncommitted reservations via `budgetReservationEngine.reset()` or Redis flush.
3. **Audit Trail Verification:** Run `GET /api/audit-chain/verify` to detect any unauthorized transactions signed during the exposure window.
4. **Notify Ledger:** Post incident report and export signed Merkle audit trail for legal & compliance verification.
