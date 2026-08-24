// ============================================================
// AgentGate — Catalog Service
// ============================================================

import type { Product, ProductCandidate, StructuredIntent, Merchant } from '../types.js';
import { db } from '../db/database.js';

/**
 * Search products matching a structured intent across all merchants.
 */
export function searchProducts(intent: StructuredIntent): Product[] {
  const baseMax = (intent.max_price && intent.max_price > 0) ? intent.max_price : undefined;
  // If purchasing with negotiation, allow finding products slightly above budget that can be negotiated down
  const maxPrice = (baseMax && intent.purchase) ? Math.round(baseMax * 1.15) : baseMax;
  const minPrice = (intent.min_price && intent.min_price > 0) ? intent.min_price : undefined;

  // First attempt: search with category, subcategory, maxPrice, inStock
  let results = db.searchProducts({
    category: intent.category || undefined,
    subcategory: intent.subcategory || undefined,
    maxPrice,
    minPrice,
    inStock: true,
  });

  // If subcategory was too restrictive, search across the broader category
  if (results.length === 0 && intent.category) {
    results = db.searchProducts({
      category: intent.category,
      maxPrice,
      minPrice,
      inStock: true,
    });
  }

  // If still no results, search across all products within budget
  if (results.length === 0) {
    results = db.searchProducts({
      maxPrice,
      minPrice,
      inStock: true,
    });
  }

  return results;
}

/**
 * Search all products including those above budget (for opportunity override).
 */
export function searchProductsWithOverbudget(intent: StructuredIntent, maxOvershoot: number): Product[] {
  const extendedMaxPrice = intent.max_price * (1 + maxOvershoot);
  let results = db.searchProducts({
    category: intent.category || undefined,
    maxPrice: extendedMaxPrice,
    minPrice: intent.min_price,
    inStock: true,
  });

  if (results.length === 0) {
    results = db.searchProducts({
      maxPrice: extendedMaxPrice,
      minPrice: intent.min_price,
      inStock: true,
    });
  }

  return results;
}

/**
 * Score and rank product candidates against the user's intent.
 */
export function rankCandidates(products: Product[], intent: StructuredIntent): ProductCandidate[] {
  const candidates: ProductCandidate[] = products.map(product => {
    const merchant = db.getMerchant(product.merchant_id);
    const merchantPolicy = db.getMerchantPolicy(product.merchant_id);

    if (!merchant) {
      throw new Error(`Merchant not found for product ${product.id}`);
    }

    // --- Score Calculation ---
    let relevanceScore = 0;
    let priceScore = 0;
    let qualityScore = 0;
    const matchReasons: string[] = [];

    // Relevance: category match
    if (product.category === intent.category) {
      relevanceScore += 30;
      matchReasons.push(`Category match: ${product.category}`);
    }
    if (intent.subcategory) {
      if (product.subcategory === intent.subcategory) {
        relevanceScore += 35;
        matchReasons.push(`Subcategory match: ${product.subcategory}`);
      } else {
        relevanceScore -= 25;
      }
    }

    // Relevance: size match
    if (intent.size && product.variants.length > 0) {
      const sizeMatch = product.variants.some(v => v.attributes.size === intent.size && v.stock > 0);
      if (sizeMatch) {
        relevanceScore += 15;
        matchReasons.push(`Size ${intent.size} available`);
      } else {
        relevanceScore -= 20;
        matchReasons.push(`Size ${intent.size} not available`);
      }
    }

    // Relevance: color match
    if (intent.color) {
      const colorMatch = product.variants.some(v =>
        v.attributes.color?.toLowerCase().includes(intent.color!.toLowerCase()) && v.stock > 0
      ) || Object.values(product.attributes).some(v => v.toLowerCase().includes(intent.color!.toLowerCase()));
      if (colorMatch) {
        relevanceScore += 10;
        matchReasons.push(`Color "${intent.color}" available`);
      }
    }

    // Relevance: preference keywords
    for (const pref of intent.preferences) {
      const prefLower = pref.toLowerCase();
      const matchFound = product.description.toLowerCase().includes(prefLower) ||
        product.title.toLowerCase().includes(prefLower) ||
        Object.values(product.attributes).some(v => v.toLowerCase().includes(prefLower));
      if (matchFound) {
        relevanceScore += 8;
        matchReasons.push(`Matches preference: "${pref}"`);
      }
    }

    // Price score: within budget is best
    if (product.price <= intent.max_price) {
      priceScore = 15 * (1 - (product.price / intent.max_price) * 0.4); // max 15
      matchReasons.push(`Within budget: ₹${product.price}`);
    } else {
      priceScore = -15; // penalty for over-budget
      matchReasons.push(`Over budget: ₹${product.price} > ₹${intent.max_price}`);
    }

    // Quality score
    qualityScore = product.rating * 4; // 0-20 range
    matchReasons.push(`Product rating: ${product.rating}/5`);

    // Merchant reliability
    const merchantReliabilityScore = merchant.reliability_score * 10; // 0-10 range

    const totalScore = relevanceScore + priceScore + qualityScore + merchantReliabilityScore;

    // Negotiation
    const negotiable = merchantPolicy?.negotiation === true;
    const estimatedNegotiatedPrice = negotiable
      ? Math.round(product.price * (1 - (merchantPolicy?.max_discount || 0) * 0.7))
      : null;

    return {
      product,
      merchant,
      score: Math.round(Math.max(0, Math.min(100, totalScore))),
      match_reasons: matchReasons,
      price_score: priceScore,
      quality_score: qualityScore,
      relevance_score: relevanceScore,
      merchant_reliability_score: merchantReliabilityScore,
      negotiable,
      estimated_negotiated_price: estimatedNegotiatedPrice,
    };
  });

  // Sort by score descending
  return candidates.sort((a, b) => b.score - a.score);
}

/**
 * Get all products from a specific merchant's catalog.
 */
export function getMerchantCatalog(merchantId: string): Product[] {
  return db.getProductsByMerchant(merchantId);
}

/**
 * Get product details by ID.
 */
export function getProductDetails(productId: string): Product | null {
  return db.getProduct(productId);
}
