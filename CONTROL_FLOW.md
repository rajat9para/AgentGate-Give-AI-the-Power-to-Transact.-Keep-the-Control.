# 🔄 RazorX (AgentGate) — Execution Control Flow & State Machine Specification

> **Document Purpose**: *Detailed end-to-end execution paths, state transition matrices, sequence diagrams, and error handling branching for RazorX (AgentGate).*

---

## 1. Complete End-to-End Execution Sequence

```mermaid
sequenceDiagram
    autonumber
    actor User as Buyer Principal
    participant BA as Buyer Agent (buyer-agent.ts)
    participant IP as Intent Parser (intent-parser.ts)
    participant CS as Catalog Service (catalog-service.ts)
    participant NA as Negotiation Engine (negotiation-agent.ts)
    participant MA as Merchant Agent (merchant-agent.ts)
    participant PE as Policy Engine (user-policy-engine.ts)
    participant TA as Transaction Authorizer (transaction-authorizer.ts)
    participant GW as Execution Gateway (execution-gateway.ts)
    participant BR as Budget Reservation (budget-reservation.ts)
    participant RZP as Razorpay API (razorpay-service.ts)
    participant RA as Recovery Agent (payment-recovery.ts)
    participant AC as Audit Chain (audit-chain.ts)

    User->>BA: Submits natural language message (e.g. "Buy running shoes under ₹6000")
    BA->>IP: Parse intent, price bounds, category & preferences
    IP-->>BA: StructuredIntent object

    alt Non-Shopping / FAQ / Policy Query
        BA-->>User: Conversational explanation or policy summary
    else Valid Commerce Intent
        BA->>CS: Search catalogs across all 4 merchant networks
        CS-->>BA: Ranked candidate products with variant matrices

        alt Top Candidate is Negotiable
            BA->>NA: Initiate multi-round price bidding
            NA->>MA: Validate discount against merchant floor price
            MA-->>NA: Issue counter-offer within allowed margin
            NA-->>BA: Binding negotiated agreement formed
        end

        BA->>PE: Evaluate transaction (Amount, Category, Single Limit, Daily/Weekly Velocity)
        
        alt Policy Evaluation = RED (Limit / Category Violation)
            PE-->>BA: RED: Transaction Blocked
            BA->>AC: Append BLOCKED audit entry
            BA-->>User: Explainable block notification (Zero money moved)
        else Policy Evaluation = GREEN (Authorized)
            PE->>TA: Generate Ed25519 Signed Authorization Token
            TA-->>PE: Signed token with nonce & parameter hash
            PE-->>BA: GREEN: Authorization issued

            BA->>GW: Submit Authorization Token + Order Details
            GW->>TA: Verify Ed25519 signature & parameter binding
            GW->>GW: Check nonce replay in consumption registry
            GW->>BR: Lock funds in atomic budget reservation mutex
            
            GW->>RZP: Create Razorpay standard order (order_xxx)
            RZP-->>GW: Order created with ID
            GW->>RZP: Initiate primary payment method (UPI)

            alt Primary Payment Succeeded
                RZP-->>GW: Payment Captured (pay_xxx)
                GW->>BR: Commit budget reservation
                GW->>AC: Append PAYMENT_SUCCESS hash-linked block
                GW-->>BA: Order confirmed
                BA-->>User: Order Confirmation + Explainable Decision Card + GST Invoice
            else Primary Payment Failed (e.g. UPI Timeout U69)
                RZP-->>GW: Payment Failed (U69 Timeout)
                GW->>AC: Log PAYMENT_FAILED event
                GW->>RA: Initiate autonomous payment recovery
                Note over RA: Check User Policy pre-authorized fallback (Card)
                RA->>RZP: Execute Card payment fallback
                RZP-->>RA: Fallback Captured (pay_yyy)
                RA-->>GW: Recovery Successful
                GW->>BR: Commit budget reservation
                GW->>AC: Append PAYMENT_RECOVERED hash-linked block
                GW-->>BA: Recovered order confirmed
                BA-->>User: Order Confirmed (via Card Auto-Recovery) + Decision Card
            end
        end
    end
```

---

## 2. Order & Payment State Machine

```
               [Initiated]
                    │
                    ▼
           [Intent Structured]
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   [Browse Mode]        [Purchase Mode]
        │                       │
        ▼                       ▼
 [Catalog Stream]     [Candidates Ranked]
                                │
                                ▼
                      [Negotiation Formed]
                                │
                                ▼
                     [Policy Evaluation]
                                │
                   ┌────────────┴────────────┐
                   ▼                         ▼
             [Policy: RED]             [Policy: GREEN]
                   │                         │
                   ▼                         ▼
             [Safe Halt]              [Ed25519 Signed]
                   │                         │
                   ▼                         ▼
            [Audit Blocked]           [Nonce Consumed]
                                             │
                                             ▼
                                      [Budget Reserved]
                                             │
                                             ▼
                                    [Razorpay Order Created]
                                             │
                                ┌────────────┴────────────┐
                                ▼                         ▼
                           [UPI Captured]            [UPI Failed]
                                │                         │
                                │                         ▼
                                │                 [Recovery Agent]
                                │                         │
                                │                         ▼
                                │                 [Card Fallback]
                                │                         │
                                └────────────┬────────────┘
                                             │
                                             ▼
                                     [Budget Committed]
                                             │
                                             ▼
                                     [Order Confirmed]
                                             │
                                             ▼
                                    [Merkle Block Appended]
                                             │
                                             ▼
                                   [Tax Invoice Issued]
```

---

## 3. Policy Decision Matrix & Invariants

| Policy Parameter | Test Invariant | Failure Action |
| :--- | :--- | :--- |
| **Single Transaction** | $P_{\text{order}} \le \text{single\_transaction\_limit}$ | Return `RED`, abort before payment creation. |
| **Daily Velocity** | $\text{Spent}_{\text{today}} + \text{Pending}_{\text{reservations}} + P_{\text{order}} \le \text{daily\_limit}$ | Return `RED`, block to prevent daily ceiling breach. |
| **Weekly Velocity** | $\text{Spent}_{\text{this\_week}} + P_{\text{order}} \le \text{weekly\_limit}$ | Return `RED`, block to protect weekly budget. |
| **Category Whitelist** | $\text{Category}_{\text{product}} \in \text{Allowed\_Categories}$ | Return `RED`, block unapproved category purchase. |
| **Autonomous Flag** | $\text{autonomous\_purchase} == \text{true}$ | If `false`, require manual human confirmation modal. |
| **Fallback Payment** | $\text{Method}_{\text{fallback}} \in \text{Allowed\_Payment\_Methods}$ | If unauthorized, abort recovery and trigger manual review. |
