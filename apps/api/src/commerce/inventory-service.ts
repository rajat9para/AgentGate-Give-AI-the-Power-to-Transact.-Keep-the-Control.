// ============================================================
// AgentGate — Inventory Service
// ============================================================

import { db } from '../db/database.js';

/**
 * Check if a product (or specific variant) has sufficient stock.
 */
export function checkStock(productId: string, variantId: string | null, quantity: number): {
  available: boolean;
  currentStock: number;
  requested: number;
} {
  const product = db.getProduct(productId);
  if (!product) {
    return { available: false, currentStock: 0, requested: quantity };
  }

  if (variantId) {
    const variant = product.variants.find(v => v.id === variantId);
    if (!variant) {
      return { available: false, currentStock: 0, requested: quantity };
    }
    return {
      available: variant.stock >= quantity,
      currentStock: variant.stock,
      requested: quantity,
    };
  }

  return {
    available: product.stock >= quantity,
    currentStock: product.stock,
    requested: quantity,
  };
}

/**
 * Find the best matching variant for given attributes.
 */
export function findMatchingVariant(
  productId: string,
  attributes: Record<string, string>
): { variantId: string | null; matched: boolean } {
  const product = db.getProduct(productId);
  if (!product || product.variants.length === 0) {
    return { variantId: null, matched: true }; // No variants needed
  }

  // Find a variant that matches all requested attributes and has stock
  const match = product.variants.find(v => {
    const hasStock = v.stock > 0;
    const attrsMatch = Object.entries(attributes).every(([key, value]) =>
      v.attributes[key]?.toLowerCase() === value.toLowerCase()
    );
    return hasStock && attrsMatch;
  });

  if (match) {
    return { variantId: match.id, matched: true };
  }

  // Fallback: find any variant with stock
  const anyAvailable = product.variants.find(v => v.stock > 0);
  return {
    variantId: anyAvailable?.id || null,
    matched: false,
  };
}
