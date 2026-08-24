// ============================================================
// AgentGate — Merchant Agent
// Handles merchant-side AI interactions
// ============================================================

import { config } from '../config.js';
import { db } from '../db/database.js';
import { canUpsell } from '../policy/merchant-policy-engine.js';
import type { Product, ProductCandidate } from '../types.js';

/**
 * Get AI-powered product recommendations for upselling.
 */
export function getUpsellRecommendations(
  merchantId: string,
  purchasedProductId: string,
  maxOffers: number
): Product[] {
  const upsellCheck = canUpsell(merchantId);
  if (!upsellCheck.allowed) return [];

  const purchasedProduct = db.getProduct(purchasedProductId);
  if (!purchasedProduct) return [];

  const allMerchantProducts = db.getProductsByMerchant(merchantId);

  // Find complementary products (different subcategory, reasonable price)
  const complementary = allMerchantProducts
    .filter(p =>
      p.id !== purchasedProductId &&
      p.stock > 0 &&
      p.category !== purchasedProduct.category
    )
    .sort((a, b) => b.rating - a.rating)
    .slice(0, Math.min(maxOffers, upsellCheck.maxOffers));

  return complementary;
}

/**
 * Generate a merchant response for buyer queries.
 */
export async function generateMerchantResponse(
  merchantId: string,
  productId: string,
  buyerQuery: string
): Promise<string> {
  const merchant = db.getMerchant(merchantId);
  const product = db.getProduct(productId);

  if (!merchant || !product) {
    return 'Sorry, I could not find the requested product information.';
  }

  if (!config.groq.apiKey) {
    // Fallback response
    return `Thank you for your interest in ${product.title}! This product is currently priced at ₹${product.price} with ${product.stock} units in stock. Delivery typically takes ${product.delivery_days} days. Would you like to proceed?`;
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.groq.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.groq.model || 'openai/gpt-oss-120b',
        messages: [
          {
            role: 'system',
            content: `You are a helpful AI merchant agent for ${merchant.name}. Respond helpfully and concisely. Be professional and encouraging. Keep response under 100 words.`,
          },
          {
            role: 'user',
            content: `Product: ${product.title} - ${product.description}
Price: ₹${product.price}
Rating: ${product.rating}/5
Stock: ${product.stock} units
Delivery: ${product.delivery_days} days
Attributes: ${JSON.stringify(product.attributes)}

Customer query: "${buyerQuery}"`,
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      return `${product.title} is available at ₹${product.price}. ${product.stock} units in stock.`;
    }

    const data: any = await response.json();
    return (
      data.choices?.[0]?.message?.content ||
      `${product.title} is an excellent choice at ₹${product.price}. Would you like to proceed?`
    );
  } catch {
    return `${product.title} is available at ₹${product.price}. ${product.stock} units in stock.`;
  }
}

/**
 * Get merchant dashboard metrics.
 */
export function getMerchantDashboardMetrics(merchantId: string) {
  return db.getMerchantMetrics(merchantId);
}
