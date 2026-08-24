// ============================================================
// AgentGate — Intent Parser (Groq AI & Semantic Classifier)
// Robustly classifies conversational greetings, questions,
// browsing, and explicit purchase intents.
// ============================================================

import { config } from '../config.js';
import type { StructuredIntent } from '../types.js';

const INTENT_SYSTEM_PROMPT = `You are RazorX / AgentGate's intelligent commerce intent parser and classifier.
Your job is to analyze the user's message and determine whether they want to BUY a product, BROWSE/SEARCH products, ask a QUESTION, say HELLO/GREETING, or ask for HELP.

CRITICAL SAFETY RULES:
1. GREETINGS & CHAT ("hello", "hi", "hey", "who are you?", "what's up?"):
   - Set "intent_type": "greeting"
   - Set "is_shopping_intent": false
   - Set "purchase": false
   - Provide a friendly, helpful "conversational_reply" welcoming the user and explaining how you can help them find & buy products across verified merchants within their spending policy.

2. HELP & CAPABILITY QUESTIONS ("how does this work?", "what can you do?", "help", "explain policy"):
   - Set "intent_type": "help"
   - Set "is_shopping_intent": false
   - Set "purchase": false
   - Provide a concise, professional "conversational_reply" explaining autonomous discovery, bounded price negotiation, Ed25519 cryptographic policy gates, and Razorpay checkout.

3. BROWSING / SEARCHING ("what shoes do you have?", "show me smartwatches", "list electronics", "find running shoes"):
   - Set "intent_type": "browse"
   - Set "is_shopping_intent": true
   - Set "purchase": false
   - Extract category and preferences.

4. EXPLICIT PURCHASE INTENT ("buy black running shoes under 6000", "order whey protein", "purchase size 9 sneakers", "get me earbuds"):
   - Set "intent_type": "purchase"
   - Set "is_shopping_intent": true
   - Set "purchase": true
   - Extract category, subcategory, price, size, color, preferences.

Return ONLY valid JSON with this exact schema:
{
  "intent_type": "purchase" | "browse" | "greeting" | "help" | "policy_query" | "unknown",
  "is_shopping_intent": boolean,
  "conversational_reply": string | null,
  "category": string (one of: running_shoes, electronics, clothing, fitness, accessories, nutrition, student_essentials),
  "subcategory": string | null,
  "use_case": string | null,
  "max_price": number (in INR, numerical only),
  "min_price": number | null,
  "size": string | null,
  "color": string | null,
  "brand": string | null,
  "preferences": string[],
  "hard_constraints": string[],
  "purchase": boolean
}`;

/**
 * Parse a natural language message into a structured intent using Groq AI.
 */
export async function parseIntent(userMessage: string): Promise<StructuredIntent> {
  const cleanMsg = (userMessage || '').trim();

  // Fast-path rule checks for greetings & non-purchase chat
  const greetingCheck = checkFastPathGreetingOrHelp(cleanMsg);
  if (greetingCheck) {
    return greetingCheck;
  }

  // If no Groq API key, use comprehensive fallback
  if (!config.groq.apiKey) {
    return parseIntentFallback(cleanMsg);
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: AbortSignal.timeout(6000),
      headers: {
        'Authorization': `Bearer ${config.groq.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.groq.model || 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: INTENT_SYSTEM_PROMPT },
          { role: 'user', content: `Analyze user message: "${cleanMsg}"` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[IntentParser] Groq HTTP ${response.status}: ${errText}, using fallback`);
      return parseIntentFallback(cleanMsg);
    }

    const data: any = await response.json();
    const text = data.choices?.[0]?.message?.content;

    if (!text) {
      console.warn('[IntentParser] No content in Groq response, using fallback');
      return parseIntentFallback(cleanMsg);
    }

    const parsed = JSON.parse(text);
    return validateIntent(parsed, cleanMsg);
  } catch (error) {
    console.error('[IntentParser] Groq error:', error);
    return parseIntentFallback(cleanMsg);
  }
}

/**
 * Fast-path check for greetings, help, and generic non-purchase inquiries.
 */
function checkFastPathGreetingOrHelp(message: string): StructuredIntent | null {
  const lower = message.toLowerCase().trim();

  // Strict greetings check
  const greetingRegex = /^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening|day)|namaste|hola|sup|yo|howdy)[!.,?\s]*$/i;
  if (greetingRegex.test(lower) || lower === 'hi' || lower === 'hello' || lower === 'hey') {
    return {
      intent_type: 'greeting',
      is_shopping_intent: false,
      conversational_reply: "👋 **Hello! Welcome to RazorX AI Commerce.**\n\nI am your autonomous Buyer Agent. I can help you discover products, negotiate merchant discounts, verify your spending policy boundaries, and execute secure checkout with Razorpay.\n\nTry asking me:\n* *\"Buy black running shoes for daily training size 9 under ₹6,000\"*\n* *\"Find wireless ANC earbuds under ₹5,000\"*\n* *\"Order whey protein under ₹3,500\"*",
      category: 'running_shoes',
      max_price: 10000,
      preferences: [],
      hard_constraints: [],
      purchase: false,
    };
  }

  // Help & Capability check
  const helpRegex = /^(help|what\s+can\s+you\s+do|how\s+does\s+this\s+work|who\s+are\s+you|capabilities|features)[!.,?\s]*$/i;
  if (helpRegex.test(lower)) {
    return {
      intent_type: 'help',
      is_shopping_intent: false,
      conversational_reply: "🛡️ **RazorX Autonomous Commerce Capabilities:**\n\n1. **Autonomous Discovery**: Searches across verified merchants (RunPro, TechNest, CampusMart, FitFuel).\n2. **Bounded Price Negotiation**: Multi-round discount negotiation with merchant AI agents.\n3. **Deterministic Policy Gate**: Checks single transaction limit (₹6,000), daily velocity limit, and category whitelist.\n4. **Ed25519 Cryptographic Authorization**: Signs approvals before payment execution.\n5. **Razorpay Checkout & Failure Recovery**: Creates real Razorpay orders and automatically recovers failed UPI attempts via authorized Card fallback.\n6. **Immutable Audit Trail**: SHA-256 hash-chained ledger for every transaction.\n\nTell me what you'd like to buy to get started!",
      category: 'running_shoes',
      max_price: 10000,
      preferences: [],
      hard_constraints: [],
      purchase: false,
    };
  }

  return null;
}

/**
 * Rule-based fallback intent parser.
 */
function parseIntentFallback(message: string): StructuredIntent {
  const lower = message.toLowerCase().trim();

  // Check greetings / help
  const fast = checkFastPathGreetingOrHelp(lower);
  if (fast) return fast;

  // Detect explicit purchase vs browse verbs
  const hasPurchaseVerb = /\b(buy|purchase|order|get\s+me|checkout|acquire|pay\s+for)\b/i.test(lower);
  const hasBrowseVerb = /\b(search|find|show|list|look\s+for|what\s+do\s+you\s+have|recommend)\b/i.test(lower);

  // Extract price
  const priceMatch = lower.match(/(?:under|below|within|max|budget|upto|up to|less than|for|around)\s*(?:₹|rs\.?|inr)?\s*(\d[\d,]*)/i);
  const maxPrice = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : 10000;

  // Extract size
  const sizeMatch = lower.match(/size\s*(\d+)/i);
  const size = sizeMatch ? sizeMatch[1] : null;

  // Extract color
  const colors = ['black', 'white', 'red', 'blue', 'green', 'grey', 'gray', 'navy', 'orange', 'purple', 'neon', 'gold', 'silver'];
  const color = colors.find(c => lower.includes(c)) || null;

  // Determine category & subcategory
  let category: string | null = null;
  let subcategory: string | undefined = undefined;
  let useCase: string | undefined = undefined;

  if (lower.includes('shoe') || lower.includes('running') || lower.includes('trainer') || lower.includes('sneaker')) {
    category = 'running_shoes';
    if (lower.includes('daily') || lower.includes('training')) {
      subcategory = 'daily_training';
      useCase = 'daily_training';
    } else if (lower.includes('trail')) {
      subcategory = 'trail';
      useCase = 'trail_running';
    } else if (lower.includes('racing') || lower.includes('race') || lower.includes('marathon')) {
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
  } else if (lower.includes('yoga') || lower.includes('mat')) {
    category = 'fitness';
    subcategory = 'yoga_mat';
  } else if (lower.includes('protein') || lower.includes('whey') || lower.includes('nutrition')) {
    category = 'nutrition';
    subcategory = 'protein';
  } else if (lower.includes('backpack') || lower.includes('bag')) {
    category = 'clothing';
    subcategory = 'backpack';
  } else if (lower.includes('lamp') || lower.includes('desk')) {
    category = 'student_essentials';
    subcategory = 'lamp';
  } else if (lower.includes('stand') || lower.includes('laptop')) {
    category = 'student_essentials';
    subcategory = 'laptop_stand';
  }

  // If no category matched at all and message has no commerce signals
  if (!category) {
    return {
      intent_type: 'unknown',
      is_shopping_intent: false,
      conversational_reply: `I didn't quite catch a product request in "${message}". You can ask me to search or purchase items like **running shoes**, **wireless earbuds**, **smartwatches**, **yoga mats**, or **whey protein**.`,
      category: 'running_shoes',
      max_price: 10000,
      preferences: [],
      hard_constraints: [],
      purchase: false,
    };
  }

  // Extract preferences
  const prefKeywords = ['lightweight', 'comfortable', 'premium', 'durable', 'waterproof', 'breathable', 'responsive', 'fast', 'cushioning', 'noise cancelling', 'wireless', 'portable'];
  const preferences = prefKeywords.filter(k => lower.includes(k));

  const isShopping = true;
  const isPurchase = hasPurchaseVerb && !hasBrowseVerb;

  return {
    intent_type: isPurchase ? 'purchase' : 'browse',
    is_shopping_intent: isShopping,
    conversational_reply: undefined,
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
    purchase: isPurchase,
  };
}

/**
 * Validate and normalize a parsed intent.
 */
function validateIntent(raw: any, userMessage: string): StructuredIntent {
  const lower = userMessage.toLowerCase().trim();
  const hasPurchaseVerb = /\b(buy|purchase|order|get\s+me|checkout|acquire|pay\s+for)\b/i.test(lower);
  const hasBrowseVerb = /\b(search|find|show|list|look\s+for|what\s+do\s+you\s+have|recommend)\b/i.test(lower);

  // If user used a browsing verb (e.g. "show", "search", "list"), NEVER treat as purchase!
  const isPurchase = hasPurchaseVerb && !hasBrowseVerb;
  const intentType = isPurchase ? 'purchase' : (raw.intent_type === 'greeting' || raw.intent_type === 'help' ? raw.intent_type : 'browse');
  const isShopping = raw.is_shopping_intent !== undefined ? Boolean(raw.is_shopping_intent) : true;

  return {
    intent_type: intentType,
    is_shopping_intent: isShopping,
    conversational_reply: raw.conversational_reply || undefined,
    category: raw.category || 'running_shoes',
    subcategory: raw.subcategory || undefined,
    use_case: raw.use_case || undefined,
    max_price: (typeof raw.max_price === 'number' && raw.max_price > 0) ? raw.max_price : 10000,
    min_price: typeof raw.min_price === 'number' ? raw.min_price : undefined,
    size: raw.size || undefined,
    color: raw.color || undefined,
    brand: raw.brand || undefined,
    preferences: Array.isArray(raw.preferences) ? raw.preferences : [],
    hard_constraints: Array.isArray(raw.hard_constraints) ? raw.hard_constraints : [],
    purchase: isPurchase,
  };
}
