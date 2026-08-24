// ============================================================
// AgentGate — Intent Parser (Groq AI & Semantic Classifier)
// Robustly classifies conversational greetings, questions,
// browsing, and explicit purchase intents.
// ============================================================

import { config } from '../config.js';
import type { StructuredIntent } from '../types.js';

const INTENT_SYSTEM_PROMPT = `You are RazorX / AgentGate's intelligent commerce intent parser and classifier.
Your job is to analyze the user's message and determine whether they want to:
1. ORDER_HISTORY_QUERY: Check past orders, receipts, purchase history, or delivery tracking ("where is my order?", "show my orders", "what did I buy?", "view bills", "have I ordered anything?")
2. POLICY_QUERY: Ask about spending policy, limits, remaining daily budget, or allowed categories ("what is my spending limit?", "how much daily limit is left?", "show my policy", "can I buy for 50000?")
3. GREETING: Say hello, chat socially, or tell jokes ("hello", "hi", "hey", "who are you?", "tell me a joke", "namaste")
4. HELP: Ask about RazorX capabilities, Ed25519 security, merchant networks, or failure recovery ("how does this work?", "what is Ed25519?", "who are the verified merchants?", "explain policy gate")
5. BROWSE: Discover, search, compare, or list products ("show running shoes", "find earbuds under 5000", "what yoga mats do you have?", "compare shoes", "what products are on discount?")
6. PURCHASE: Explicitly execute an autonomous purchase ("buy black running shoes under 6000", "order whey protein under 3500", "1-click buy earbuds", "purchase size 9 sneakers")

CRITICAL SAFETY & CLASSIFICATION RULES:
- If user asks about their orders or past transactions -> "intent_type": "order_history_query", "is_shopping_intent": false, "purchase": false
- If user asks about policy, budget, or spending limits -> "intent_type": "policy_query", "is_shopping_intent": false, "purchase": false
- If user greets or chats -> "intent_type": "greeting", "is_shopping_intent": false, "purchase": false
- If user asks for help or architecture details -> "intent_type": "help", "is_shopping_intent": false, "purchase": false
- If user wants to see/search/find/compare products -> "intent_type": "browse", "is_shopping_intent": true, "purchase": false
- If user explicitly commands buying/ordering -> "intent_type": "purchase", "is_shopping_intent": true, "purchase": true

Return ONLY valid JSON with this exact schema:
{
  "intent_type": "purchase" | "browse" | "greeting" | "help" | "policy_query" | "order_history_query" | "unknown",
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

  // Fast-path rule checks for greetings, help, order history, policy queries
  const fastCheck = checkFastPathGreetingOrHelp(cleanMsg);
  if (fastCheck) {
    return fastCheck;
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
 * Fast-path check for greetings, help, order history, policy queries, and generic inquiries.
 */
function checkFastPathGreetingOrHelp(message: string): StructuredIntent | null {
  const lower = message.toLowerCase().trim();

  // Check specific product keywords
  const hasSpecificProductKeywords = /\b(shoe|shoes|running|sneaker|trainer|earbud|earbuds|earphone|headphone|watch|smartwatch|keyboard|yoga|mat|mats|protein|whey|backpack|bag|lamp|desk|stand|bottle|supplement|shaker|tws|anc|isolate)\b/i.test(lower);

  // 1. Strict Greetings & Social Phrases (Word bounded, strictly non-product)
  const greetingRegex = /\b(hi|hello|hey|greetings|good\s+(morning|afternoon|evening|day|night)|namaste|hola|sup|yo|howdy|how\s+are\s+you|how\s+are\s+you\s+doing|who\s+are\s+you|who\s+made\s+you|who\s+created\s+you|what\s+is\s+your\s+name|are\s+you\s+an\s+ai|tell\s+me\s+a\s+joke|thank\s+you|thanks|bye|goodbye|see\s+you\s+later|have\s+a\s+nice\s+day|cool|awesome|nice\s+to\s+meet\s+you)\b/i;
  if (!hasSpecificProductKeywords && greetingRegex.test(lower) && !/\b(buy|order|show|find|search|price|discount)\b/i.test(lower)) {
    return {
      intent_type: 'greeting',
      is_shopping_intent: false,
      conversational_reply: "👋 **Hello! Welcome to RazorX Autonomous AI Commerce.**\n\nI am your autonomous Buyer Agent integrated with Razorpay. Tell me what product you'd like to explore (e.g. *'Buy black running shoes size 9 under ₹6,000'* or *'Show wireless earbuds'*), and I will discover products across verified merchants, negotiate price discounts, verify your spending policy boundaries, and execute secure checkout.",
      category: 'running_shoes',
      max_price: 10000,
      preferences: [],
      hard_constraints: [],
      purchase: false,
    };
  }

  // 2. Order History & Tracking Queries (Prioritized when user inquires about past orders/receipts/purchases)
  const isOrderQuery = /\b(order(s|ed|ing)?|purchas(e|es|ed|ing)|bought|receipts?|bills?|deliver(ed|y)?|invoices?|track(ing)?|what\s+did\s+i\s+buy)\b/i.test(lower);
  const isPastInquiry = /\b(my|past|previous|history|recent|did\s+i|have\s+i|what\s+did\s+i|all\s+my|where\s+is|status|receipts?|bills?|invoice|were\s+delivered|was\s+delivered|have\s+been\s+delivered|what\s+items|items\s+ordered|items\s+bought|items\s+delivered)\b/i.test(lower);

  if (isOrderQuery && (isPastInquiry || /order\s+history/i.test(lower) || /purchased\s+items/i.test(lower) || /delivered/i.test(lower))) {
    return {
      intent_type: 'order_history_query',
      is_shopping_intent: false,
      conversational_reply: "📦 **Order History & Delivery Tracking**\n\nI have fetched your active and past orders from the database. You can review items, delivery status, and access tax invoices.",
      category: 'running_shoes',
      max_price: 10000,
      preferences: [],
      hard_constraints: [],
      purchase: false,
    };
  }

  // 3. Policy & Budget Queries (When user asks about policy/limits/rules, not budget products)
  const isPolicyKeyword = /\b(spending\s+limits?|policy\s+limits?|user\s+polic(y|ies)|daily\s+allowance|velocity\s+limit|allowed\s+categories|categories\s+are\s+allowed|what\s+categories\s+are\s+allowed|which\s+categories\s+can\s+i)\b/i.test(lower);
  const isBudgetInquiry = /\b(how\s+much\s+can\s+i\s+spend|remaining\s+budget|my\s+budget\s+limit|check\s+my\s+budget|what\s+is\s+my\s+budget|budget\s+left|budget\s+remaining)\b/i.test(lower);

  if (!hasSpecificProductKeywords && !/\b(essential|essentials|product|products|gear|items?|goods?|under|below)\b/i.test(lower) && (isPolicyKeyword || isBudgetInquiry)) {
    return {
      intent_type: 'policy_query',
      is_shopping_intent: false,
      conversational_reply: "🛡️ **Active Spending Policy & Governance Limits**\n\n- **Single Transaction Limit**: ₹6,000 max per purchase.\n- **Daily Spending Limit**: ₹10,000 velocity ceiling.\n- **Weekly Spending Limit**: ₹25,000 velocity ceiling.\n- **Allowed Categories**: Running shoes, electronics, fitness, nutrition, clothing, accessories, student essentials.",
      category: 'running_shoes',
      max_price: 10000,
      preferences: [],
      hard_constraints: [],
      purchase: false,
    };
  }

  // 4. Help, Architecture & FAQ Doubts (Questions about system mechanics, security, negotiation, merchants, etc.)
  const isQuestionIntro = /^(how\s+|what\s+|why\s+|who\s+|which\s+|explain|is\s+|are\s+|can\s+|could\s+|will\s+|would\s+|does\s+|do\s+|tell\s+me\s+about)/i.test(lower);
  const isArchitectureDoubt = /\b(ed25519|razorx|merkle|audit\s+chain|sha-256|replay|nonce|invoice|gst|receipt|tax|pdf|refund|timeout|groq|public\s+key|private\s+key|recovery|upsell|non-repudiation|architecture|capabilities|security|safe|stored|merchants?\s+(in|are|network|onboard)|declines?\s+discount|rejects?\s+an?\s+offer|difference\s+between|discount\s+percentage|calculated|calculate|without\s+my\s+permission|permission)\b/i.test(lower);

  if (isQuestionIntro && (isArchitectureDoubt || !hasSpecificProductKeywords)) {
    return {
      intent_type: 'help',
      is_shopping_intent: false,
      conversational_reply: "🛡️ **RazorX Autonomous Commerce Architecture & Protections:**\n\n1. **Autonomous Product Discovery**: Evaluates catalogs across 4 verified merchant networks (RunPro, TechNest, CampusMart, FitFuel).\n2. **AI-to-AI Price Negotiation**: Executes multi-round automated bidding with merchant agents to secure discounts based on merchant policy margins and stock levels.\n3. **Deterministic Policy Gate**: Enforces single transaction limits (₹6,000 default), daily/weekly velocity limits, and whitelisted categories before issuing authorizations.\n4. **Ed25519 Cryptographic Signatures**: Issues cryptographically signed transaction tokens (RFC 8032) bound to amount, merchant ID, and nonce.\n5. **Razorpay Standard Checkout & Auto-Recovery**: Creates real Razorpay orders and recovers simulated UPI timeouts via authorized Card fallback.\n6. **SHA-256 Merkle Audit Chain**: Every transaction and decision is permanently linked in a tamper-evident cryptographic hash chain.\n\nTell me what you'd like to explore or purchase today!",
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

  // Check greetings / help / order history / policy queries
  const fast = checkFastPathGreetingOrHelp(lower);
  if (fast) return fast;

  // Detect explicit purchase vs browse verbs
  const hasPurchaseVerb = /\b(buy|purchase|order|1-click\s+buy|autonomous\s+buy|checkout|acquire|pay\s+for)\b/i.test(lower);
  const hasBrowseVerb = /\b(search|find|show|list|look\s+for|what|recommend|compare|view|browse|explore|suggest|check|discount|deal|sale|offer|best|option)\b/i.test(lower);

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

  if (lower.includes('shoe') || lower.includes('running') || lower.includes('trainer') || lower.includes('sneaker') || lower.includes('jogging') || lower.includes('footwear')) {
    category = 'running_shoes';
    if (lower.includes('daily') || lower.includes('training') || lower.includes('jogging')) {
      subcategory = 'daily_training';
      useCase = 'daily_training';
    } else if (lower.includes('trail')) {
      subcategory = 'trail';
      useCase = 'trail_running';
    } else if (lower.includes('racing') || lower.includes('race') || lower.includes('marathon')) {
      subcategory = 'racing';
      useCase = 'racing';
    }
  } else if (lower.includes('earbud') || lower.includes('earphone') || lower.includes('headphone') || lower.includes('pod') || lower.includes('tws') || lower.includes('anc') || lower.includes('airbud')) {
    category = 'electronics';
    subcategory = 'earbuds';
  } else if (lower.includes('watch') || lower.includes('smartwatch') || lower.includes('tracker')) {
    category = 'electronics';
    subcategory = 'smartwatch';
  } else if (lower.includes('keyboard') || lower.includes('gaming') || lower.includes('electronic') || lower.includes('mech')) {
    category = 'electronics';
    subcategory = 'keyboard';
  } else if (lower.includes('speaker') || lower.includes('audio') || lower.includes('sound')) {
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
  } else if (lower.includes('fitness') || lower.includes('gym') || lower.includes('workout') || lower.includes('exercise')) {
    category = 'fitness';
    if (lower.includes('band')) subcategory = 'resistance_bands';
    else if (lower.includes('glove')) subcategory = 'gloves';
    else if (lower.includes('mat') || lower.includes('yoga')) subcategory = 'yoga_mat';
  } else if (lower.includes('protein') || lower.includes('whey') || lower.includes('nutrition') || lower.includes('supplement') || lower.includes('isolate') || lower.includes('powder')) {
    category = 'nutrition';
    subcategory = 'protein';
  } else if (lower.includes('backpack') || lower.includes('bag')) {
    category = 'clothing';
    subcategory = 'backpack';
  } else if (lower.includes('clothing') || lower.includes('shirt') || lower.includes('tshirt') || lower.includes('short') || lower.includes('sock') || lower.includes('activewear')) {
    category = 'clothing';
    if (lower.includes('backpack') || lower.includes('bag')) subcategory = 'backpack';
    else if (lower.includes('sock')) subcategory = 'socks';
  } else if (lower.includes('student') || lower.includes('essential') || lower.includes('college')) {
    category = 'student_essentials';
    if (lower.includes('lamp') || lower.includes('desk')) subcategory = 'lamp';
    else if (lower.includes('notebook') || lower.includes('stationery') || lower.includes('pen')) subcategory = 'stationery';
    else if (lower.includes('stand') || lower.includes('laptop')) subcategory = 'laptop_stand';
  } else if (lower.includes('lamp') || lower.includes('desk')) {
    category = 'student_essentials';
    subcategory = 'lamp';
  } else if (lower.includes('notebook') || lower.includes('stationery') || lower.includes('book')) {
    category = 'student_essentials';
    subcategory = 'stationery';
  } else if (lower.includes('stand') || lower.includes('laptop')) {
    category = 'student_essentials';
    subcategory = 'laptop_stand';
  } else if (lower.includes('accessory') || lower.includes('accessories') || lower.includes('shaker') || lower.includes('bottle')) {
    category = 'accessories';
    if (lower.includes('bottle') || lower.includes('flask')) subcategory = 'hydration';
    else if (lower.includes('shaker')) subcategory = 'shaker';
    else if (lower.includes('sock')) subcategory = 'socks';
  } else if (lower.includes('all') || lower.includes('product') || lower.includes('item') || lower.includes('catalog') || lower.includes('technest') || lower.includes('runpro') || lower.includes('campus') || lower.includes('fitfuel') || lower.includes('budget') || lower.includes('sport') || lower.includes('discount') || lower.includes('deal') || lower.includes('sale') || lower.includes('offer') || lower.includes('best') || lower.includes('cheap')) {
    category = 'running_shoes';
  } else if (hasPurchaseVerb || hasBrowseVerb) {
    category = 'electronics';
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
  const hasPurchaseVerb = /\b(buy|purchase|order|1-click\s+buy|autonomous\s+buy|checkout|acquire|pay\s+for)\b/i.test(lower);
  const hasBrowseVerb = /\b(search|find|show|list|look\s+for|what|recommend|compare|view|browse|explore|suggest|check)\b/i.test(lower);

  const isOrderHistory = raw.intent_type === 'order_history_query' || /\b(my\s+orders?|order\s+history|what\s+did\s+i\s+buy|track\s+order)\b/i.test(lower);
  const isPolicy = raw.intent_type === 'policy_query' || /\b(my\s+policy|spending\s+limit|daily\s+limit|weekly\s+limit|budget\s+left)\b/i.test(lower);

  // Check if query contains any product / catalog keywords
  const hasProductKeywords = /\b(shoe|shoes|running|sneaker|trainer|earbud|earbuds|earphone|headphone|watch|smartwatch|keyboard|yoga|mat|mats|protein|whey|backpack|bag|lamp|desk|stand|accessories|bottle|supplement|shaker|fitness|electronics|tws|anc|isolate|gadget|product|products|item|items)\b/i.test(lower);

  let intentType: any = 'browse';
  if (isOrderHistory) {
    intentType = 'order_history_query';
  } else if (isPolicy) {
    intentType = 'policy_query';
  } else if (hasProductKeywords) {
    // If product keywords are present, determine purchase vs browse
    intentType = (hasPurchaseVerb && !hasBrowseVerb) ? 'purchase' : 'browse';
  } else if (raw.intent_type === 'greeting') {
    intentType = 'greeting';
  } else if (raw.intent_type === 'help') {
    intentType = 'help';
  } else if (hasPurchaseVerb && !hasBrowseVerb) {
    intentType = 'purchase';
  }

  const isPurchase = intentType === 'purchase';
  const isShopping = (intentType === 'browse' || intentType === 'purchase');

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
