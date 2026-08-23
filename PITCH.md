# AgentGate — 5-Minute Hackathon / Recruiter Pitch

## 0:00–0:30 — The Problem

Today, AI assistants can recommend products, but they usually stop before the transaction.

A real AI buyer needs to do much more:

- understand what a user wants
- compare merchants
- make a decision
- negotiate
- pay
- recover from payment failure
- and do all of that without having unrestricted access to the user's money

At the same time, merchants need a way to become **AI-readable and AI-transactable**.

That is the problem AgentGate solves.

---

## 0:30–1:00 — What Is AgentGate?

> **AgentGate is a permissioned AI-commerce platform where an AI Buyer purchases from AI-readable merchants through Razorpay, while deterministic policies control what the agent is allowed to do.**

The user does not approve every purchase.

They define their authority once.

For example:

```text
Buy autonomously up to ₹6,000
Negotiate when possible
Use card if UPI fails
Prefer quality over lowest price
Alert me about materially better options above budget
```

The agent then operates inside that contract.

---

## 1:00–2:00 — Demo Flow

User says:

> “Buy black running shoes for daily training, size 9, under ₹6,000.”

The AI Buyer converts that into structured intent.

Then it searches AgentGate's AI-readable merchant network instead of depending on Amazon or other external marketplaces.

It compares:

- price
- product fit
- quality
- merchant reliability
- inventory
- user preferences

It selects the best valid option.

Then the Buyer Agent talks to the Merchant Agent and negotiates within the merchant's allowed discount.

Suppose the product falls from ₹5,799 to ₹5,393.

The user's policy allows autonomous purchases up to ₹6,000.

The policy engine approves the transaction.

Razorpay handles the payment.

The system confirms the order from the backend payment event.

---

## 2:00–2:40 — The Important Part: Autonomous but Bounded

The agent is autonomous, but it is not unrestricted.

There is a deterministic policy layer between the AI and Razorpay.

For example:

```text
AI wants to buy: ₹8,500
User limit:      ₹6,000

Policy result: BLOCKED
```

The agent cannot simply decide that ₹8,500 is “close enough.”

Instead, it keeps searching for the best product inside the user's authority.

This creates the key design principle:

> **AI decides how to achieve the objective. Policy decides whether the action is authorized.**

---

## 2:40–3:20 — Opportunity Override

We also do not make the agent blindly stop at the first valid answer.

Suppose the best valid option is:

```text
₹5,799 — 95% match
```

The agent later discovers:

```text
₹6,999 — 98% match
```

The agent has already completed the valid purchase.

Because the second product is materially better and the user has enabled opportunity alerts, AgentGate informs them:

> “I completed your requested purchase within ₹6,000. I also found a 98% match at ₹6,999. Upgrade?”

The important distinction is that **the over-budget purchase is never automatic**.

---

## 3:20–4:00 — Payment Failure Recovery

Now we show why this is more than an AI shopping chatbot.

The Razorpay payment fails through UPI.

Instead of simply returning:

> “Payment failed.”

AgentGate checks the user's payment recovery policy.

If card fallback is authorized:

```text
UPI
 ↓ failed
Authorized fallback
 ↓
Card
 ↓
Payment successful
```

The agent recovers the transaction without asking the user another question because that action was already delegated and bounded.

This is one of the strongest examples of real agentic behavior.

---

## 4:00–4:30 — Merchant Side

Now switch to the merchant dashboard.

The merchant has its own AI Merchant Agent.

It can:

- answer buyer questions
- negotiate within limits
- recommend complementary products
- recover abandoned purchases
- recover failed payments
- increase AI-generated revenue

The merchant defines its own policy:

```text
Discount <= 10%
Auto-confirm <= ₹25,000
Refund <= ₹2,000
Upsell enabled
```

So both sides have bounded autonomy.

---

## 4:30–5:00 — Trust, Technology & Closing

Every meaningful action is recorded in an audit timeline:

```text
User intent
→ candidates searched
→ product selected
→ negotiation
→ policy decision
→ Razorpay action
→ payment failure
→ recovery
→ final order
```

The system is built with:

```text
React + TypeScript + Tailwind
Vercel
Node.js + TypeScript
Supabase PostgreSQL + Auth
Gemini API
Razorpay Test Mode
Render
```

The most important architectural decision is that Gemini does not control money directly.

Gemini proposes structured actions.

The deterministic policy engine authorizes them.

Razorpay executes them.

Webhooks confirm them.

The audit layer records them.

### Closing

> **AgentGate is not trying to make AI better at recommending products. It is trying to make AI trustworthy enough to actually transact.**

That is the bridge between AI assistants and real agentic commerce.
