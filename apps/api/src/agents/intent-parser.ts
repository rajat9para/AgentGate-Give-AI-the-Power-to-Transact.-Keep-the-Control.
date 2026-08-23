// ============================================================
// AgentGate — Intent Parser (Gemini AI)
// Parses natural language into structured purchase intent
// ============================================================

import { config } from '../config.js';
import type { StructuredIntent } from '../types.js';

const INTENT_SYSTEM_PROMPT = `You are AgentGate's intent parser. Given a user's natural language purchase request, extract a structured shopping intent.

Return ONLY valid JSON with this exact schema:
{
  "category": string (one of: running_shoes, electronics, clothing, fitness, accessories, nutrition, student_essentials),
  "subcategory": string | null (e.g., daily_training, racing, trail, earbuds, wearable, smartwatch, charger, speaker, power_bank, resistance_bands, yoga_mat, protein, backpack, lamp, laptop_stand, stationery),
  "use_case": string | null (what the product is for),
  "max_price": number (in INR, the budget),
  "min_price": number | null,
  "size": string | null,
  "color": string | null,
  "brand": string | null,
  "preferences": string[] (soft preferences like "lightweight", "comfortable", "premium"),
  "hard_constraints": string[] (must-have requirements),
  "purchase": boolean (true if user wants to buy)
}

Rules:
- Extract exact numbers for prices (e.g., "under 6000" → max_price: 6000)
- If no price mentioned, set max_price to 10000 as default
- Category must be one of the listed options
- Preferences are nice-to-have, hard_constraints are must-have
- Always set purchase to true unless user is just browsing`;

/**
 * Parse a natural language message into a structured intent using Gemini.
 */
export async function parseIntent(userMessage: string): Promise<StructuredIntent> {
  // If no API key, use rule-based fallback
  if (!config.gemini.apiKey) {
    return parseIntentFallback(userMessage);
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent?key=${config.gemini.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: `${INTENT_SYSTEM_PROMPT}\n\nUser message: "${userMessage}"` }] }
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    const data: any = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.warn('[IntentParser] No response from Gemini, using fallback');
      return parseIntentFallback(userMessage);
    }

    const parsed = JSON.parse(text);
    return validateIntent(parsed);
  } catch (error) {
    console.error('[IntentParser] Gemini error:', error);
    return parseIntentFallback(userMessage);
  }
}

/**
 * Rule-based fallback intent parser (no AI required).
 */
function parseIntentFallback(message: string): StructuredIntent {
  const lower = message.toLowerCase();

  // Extract price
  const priceMatch = lower.match(/(?:under|below|within|max|budget|upto|up to|less than)\s*(?:₹|rs\.?|inr)?\s*(\d[\d,]*)/);
  const maxPrice = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : 10000;

  // Extract size
  const sizeMatch = lower.match(/size\s*(\d+)/);
  const size = sizeMatch ? sizeMatch[1] : null;

  // Extract color
  const colors = ['black', 'white', 'red', 'blue', 'green', 'grey', 'gray', 'navy', 'orange', 'purple', 'neon', 'gold', 'silver'];
  const color = colors.find(c => lower.includes(c)) || null;

  // Determine category
  let category = 'running_shoes';
  let subcategory: string | undefined = undefined;
  let useCase: string | undefined = undefined;

  if (lower.includes('shoe') || lower.includes('running') || lower.includes('trainer')) {
    category = 'running_shoes';
    if (lower.includes('daily') || lower.includes('training')) {
      subcategory = 'daily_training';
      useCase = 'daily_training';
    } else if (lower.includes('trail')) {
      subcategory = 'trail';
      useCase = 'trail_running';
    } else if (lower.includes('racing') || lower.includes('race') || lower.includes('competition')) {
      subcategory = 'racing';
      useCase = 'racing';
    }
  } else if (lower.includes('earbud') || lower.includes('earphone') || lower.includes('headphone')) {
    category = 'electronics';
    subcategory = 'earbuds';
  } else if (lower.includes('watch') || lower.includes('smartwatch')) {
    category = 'electronics';
    subcategory = 'smartwatch';
  } else if (lower.includes('speaker')) {
    category = 'electronics';
    subcategory = 'speaker';
  } else if (lower.includes('charger') || lower.includes('adapter')) {
    category = 'electronics';
    subcategory = 'charger';
  } else if (lower.includes('power bank') || lower.includes('powerbank')) {
    category = 'electronics';
    subcategory = 'power_bank';
  } else if (lower.includes('band') || lower.includes('fitness band') || lower.includes('tracker')) {
    category = 'electronics';
    subcategory = 'wearable';
  } else if (lower.includes('yoga') || lower.includes('mat')) {
    category = 'fitness';
    subcategory = 'yoga_mat';
  } else if (lower.includes('resistance') || lower.includes('band')) {
    category = 'fitness';
    subcategory = 'resistance_bands';
  } else if (lower.includes('protein') || lower.includes('whey') || lower.includes('nutrition')) {
    category = 'nutrition';
    subcategory = 'protein';
  } else if (lower.includes('backpack') || lower.includes('bag')) {
    category = 'clothing';
    subcategory = 'backpack';
  } else if (lower.includes('lamp') || lower.includes('light') || lower.includes('desk')) {
    category = 'student_essentials';
    subcategory = 'lamp';
  } else if (lower.includes('laptop stand') || lower.includes('stand')) {
    category = 'student_essentials';
    subcategory = 'laptop_stand';
  } else if (lower.includes('glove')) {
    category = 'fitness';
    subcategory = 'gloves';
  }

  // Extract preferences
  const prefKeywords = ['lightweight', 'comfortable', 'premium', 'durable', 'waterproof', 'breathable', 'responsive', 'fast', 'cushioning', 'noise cancelling', 'wireless', 'portable'];
  const preferences = prefKeywords.filter(k => lower.includes(k));

  return {
    category,
    subcategory,
    use_case: useCase,
    max_price: maxPrice,
    min_price: undefined,
    size: size || undefined,
    color: color || undefined,
    brand: undefined,
    preferences,
    hard_constraints: size ? [`size_${size}`] : [],
    purchase: true,
  };
}

/**
 * Validate and normalize a parsed intent.
 */
function validateIntent(raw: any): StructuredIntent {
  return {
    category: raw.category || 'running_shoes',
    subcategory: raw.subcategory || undefined,
    use_case: raw.use_case || undefined,
    max_price: typeof raw.max_price === 'number' ? raw.max_price : 10000,
    min_price: typeof raw.min_price === 'number' ? raw.min_price : undefined,
    size: raw.size || undefined,
    color: raw.color || undefined,
    brand: raw.brand || undefined,
    preferences: Array.isArray(raw.preferences) ? raw.preferences : [],
    hard_constraints: Array.isArray(raw.hard_constraints) ? raw.hard_constraints : [],
    purchase: raw.purchase !== false,
  };
}
