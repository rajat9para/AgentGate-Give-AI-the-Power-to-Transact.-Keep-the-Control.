// ============================================================
// AgentGate — Key Management & Ed25519 Cryptographic Layer
// Manages versioned Ed25519 key pairs, signing, and verification
// ============================================================

import crypto from 'crypto';

export interface KeyRecord {
  keyId: string;
  algorithm: 'Ed25519';
  publicKeyPem: string;
  privateKeyPem?: string;
  createdAt: string;
  isActiveSigningKey: boolean;
}

class KeyManager {
  private keys: Map<string, KeyRecord> = new Map();
  private activeKeyId: string = 'agentgate-prod-2026-08-v1';

  constructor() {
    this.initializeKeys();
  }

  /**
   * Initializes Ed25519 key management from environment or generates a secure in-memory keypair.
   */
  private initializeKeys(): void {
    const envKeyId = process.env.ED25519_KEY_ID || 'agentgate-prod-2026-08-v1';
    const envPrivateKey = process.env.ED25519_PRIVATE_KEY;
    const envPublicKey = process.env.ED25519_PUBLIC_KEY;

    if (envPrivateKey && envPublicKey) {
      this.registerKey({
        keyId: envKeyId,
        algorithm: 'Ed25519',
        publicKeyPem: envPublicKey,
        privateKeyPem: envPrivateKey,
        createdAt: new Date().toISOString(),
        isActiveSigningKey: true,
      });
      this.activeKeyId = envKeyId;
    } else {
      // Generate a cryptographically secure Ed25519 keypair
      const keypair = crypto.generateKeyPairSync('ed25519');
      const publicKeyPem = keypair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
      const privateKeyPem = keypair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

      this.registerKey({
        keyId: envKeyId,
        algorithm: 'Ed25519',
        publicKeyPem,
        privateKeyPem,
        createdAt: new Date().toISOString(),
        isActiveSigningKey: true,
      });
      this.activeKeyId = envKeyId;
    }
  }

  /**
   * Registers a key in the internal store.
   */
  public registerKey(record: KeyRecord): void {
    if (record.algorithm !== 'Ed25519') {
      throw new Error(`Unsupported cryptographic algorithm: ${record.algorithm}. Only Ed25519 is allowed.`);
    }
    this.keys.set(record.keyId, record);
  }

  /**
   * Returns the active signing key ID.
   */
  public getActiveKeyId(): string {
    return this.activeKeyId;
  }

  /**
   * Returns public key PEM for a given key ID, or null if unknown.
   */
  public getPublicKeyPem(keyId: string): string | null {
    const record = this.keys.get(keyId);
    return record ? record.publicKeyPem : null;
  }

  /**
   * Rotates the active signing key to a new key ID.
   * Old keys remain registered in the store for verification of unexpired authorizations.
   */
  public rotateKey(newKeyId: string, customPrivateKeyPem?: string, customPublicKeyPem?: string): KeyRecord {
    let publicKeyPem: string;
    let privateKeyPem: string;

    if (customPrivateKeyPem && customPublicKeyPem) {
      publicKeyPem = customPublicKeyPem;
      privateKeyPem = customPrivateKeyPem;
    } else {
      const keypair = crypto.generateKeyPairSync('ed25519');
      publicKeyPem = keypair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
      privateKeyPem = keypair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    }

    // Mark previous active keys as not active for signing
    for (const [, k] of this.keys) {
      k.isActiveSigningKey = false;
    }

    const record: KeyRecord = {
      keyId: newKeyId,
      algorithm: 'Ed25519',
      publicKeyPem,
      privateKeyPem,
      createdAt: new Date().toISOString(),
      isActiveSigningKey: true,
    };

    this.registerKey(record);
    this.activeKeyId = newKeyId;
    return record;
  }

  /**
   * Signs a canonical string payload using the active Ed25519 private key.
   * Returns signature in hex encoding and the key_id used.
   */
  public signPayload(canonicalPayload: string): { signature: string; key_id: string } {
    const record = this.keys.get(this.activeKeyId);
    if (!record || !record.privateKeyPem) {
      throw new Error(`Active signing key "${this.activeKeyId}" has no private key available.`);
    }

    const privateKey = crypto.createPrivateKey({
      key: record.privateKeyPem,
      format: 'pem',
      type: 'pkcs8',
    });

    const signature = crypto.sign(null, Buffer.from(canonicalPayload, 'utf8'), privateKey);
    return {
      signature: signature.toString('hex'),
      key_id: this.activeKeyId,
    };
  }

  /**
   * Verifies an Ed25519 signature against a canonical payload using the key specified by keyId.
   * Fails closed on any error or mismatch.
   */
  public verifySignature(canonicalPayload: string, signatureHex: string, keyId: string): { valid: boolean; reason?: string } {
    const record = this.keys.get(keyId);
    if (!record) {
      return { valid: false, reason: `Unknown key_id "${keyId}". Verification failed closed.` };
    }

    if (record.algorithm !== 'Ed25519') {
      return { valid: false, reason: `Unsupported key algorithm "${record.algorithm}". Only Ed25519 is authorized.` };
    }

    try {
      const publicKey = crypto.createPublicKey({
        key: record.publicKeyPem,
        format: 'pem',
        type: 'spki',
      });

      const signatureBuffer = Buffer.from(signatureHex, 'hex');
      const isValid = crypto.verify(null, Buffer.from(canonicalPayload, 'utf8'), publicKey, signatureBuffer);

      if (!isValid) {
        return { valid: false, reason: 'Invalid Ed25519 cryptographic signature. Payload may have been tampered.' };
      }

      return { valid: true };
    } catch (err) {
      return { valid: false, reason: `Cryptographic verification error: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
}

export const keyManager = new KeyManager();
