// ============================================================
// AgentGate — Canonical JSON Serialization & Cryptographic Hashing
// Implements deterministic canonical JSON serialization (RFC 8785 subset)
// ============================================================

import crypto from 'crypto';

/**
 * Deterministically stringifies any JavaScript object or value to canonical JSON.
 * - Object keys are sorted lexicographically in Unicode code point order.
 * - No whitespace is introduced between elements.
 * - Undefined and function values in objects are omitted.
 * - Numbers and booleans follow strict standard JSON representation.
 */
export function canonicalStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (typeof value === 'boolean' || typeof value === 'number') {
    return JSON.stringify(value);
  }

  if (typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const serializedElements = value.map(elem => canonicalStringify(elem));
    return `[${serializedElements.join(',')}]`;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const serializedPairs: string[] = [];

    for (const key of keys) {
      const val = (value as Record<string, unknown>)[key];
      if (val !== undefined && typeof val !== 'function') {
        serializedPairs.push(`${JSON.stringify(key)}:${canonicalStringify(val)}`);
      }
    }

    return `{${serializedPairs.join(',')}}`;
  }

  return JSON.stringify(value);
}

/**
 * Computes SHA-256 hash of a string or object using canonical serialization.
 * Returns lowercase hex digest.
 */
export function sha256(data: string | object): string {
  const content = typeof data === 'string' ? data : canonicalStringify(data);
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}
