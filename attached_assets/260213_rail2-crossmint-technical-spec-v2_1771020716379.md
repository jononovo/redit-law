# Rail 2: CrossMint Wallet — Technical Specification

**Date:** February 13, 2026, 11:30 PM UTC
**Version:** 2.0 (replaces rail2-crossmint-stytch-technical-plan.md)

> CrossMint smart wallets on Base, CrossMint fiat onramp for credit card → USDC, CrossMint Headless Checkout for Amazon/commerce purchases, human-approval-first spending model.

---

## 0. Background & Focus

Rail 2 enables AI agents to **purchase physical goods** (starting with Amazon) using USDC-funded wallets. Unlike Rail 1 (which focuses on x402 machine-to-machine payments), Rail 2 focuses on **commerce**: the bot finds a product, requests a purchase, the owner approves, and CrossMint handles fulfillment via its World Store / Headless Checkout API.

**Key difference from Rail 1:** Rail 1 signs cryptographic payment headers for x402 endpoints. Rail 2 creates purchase orders through CrossMint's Orders API using product identifiers (Amazon ASINs). No EIP-712 signing, no X-PAYMENT headers — CrossMint handles the payment settlement from the wallet internally.

**Auth decision:** No Stytch. Firebase Auth remains the global auth layer across all rails. CrossMint handles wallet infrastructure only. Stytch was evaluated and determined to be an auth-only provider (does not create or manage wallets) with no clear benefit over Firebase Auth for this use case.

---

## 1. Provider Capabilities (Research Summary)

### CrossMint

| Capability | Confirmed | Details |
|-----------|-----------|---------|
| Server-side smart wallets | Yes | `POST /api/2022-06-09/wallets` — creates EVM smart wallets. MPC key storage via Fireblocks. Custodial option: transactions auto-approved server-side. |
| Smart wallet with platform signer | Yes | `evm-keypair` signer type — platform generates and holds the private key. Full control over when transactions execute. |
| Fiat onramp (credit card → USDC) | Yes | Embedded widget (`CrossmintEmbeddedCheckout` from `@crossmint/client-sdk-react-ui`), headless API (`POST /orders`), or hosted popup. Uses Checkout.com for payment, Persona for KYC. |
| Headless Checkout / Orders API | Yes | `POST /api/2022-06-09/orders` with `productLocator` for Amazon, Shopify, flights. CrossMint handles fulfillment. |
| Amazon World Store | Yes | `productLocator: "amazon:<ASIN>"` or `"amazon:<product_url>"`. Access to 1B+ SKUs. CrossMint manages purchase, payment settlement, and shipping. |
| USDC balance queries | Yes | `GET /api/2022-06-09/wallets/{locator}/balances?tokens=usdc&chains=base` |
| Order status tracking | Yes | `GET /api/2022-06-09/orders/{orderId}` — poll for status changes (processing → shipped → delivered). |
| Multi-chain | Yes | Base, Ethereum, Solana, Polygon, Arbitrum, and more. Rail 2 targets Base for consistency with Rail 1. |
| Gasless transactions | Yes | Smart wallets handle gas abstractly. Crossmint covers gas fees. |
| GOAT SDK integration | Yes | `@goat-sdk/crossmint` provides agent-side wallet tools. Reference only — CreditClaw mediates all transactions. |

---

## 2. Architecture

```
Owner (Browser)                     Bot (API Client)
      │                                   │
      ▼                                   ▼
┌──────────────────────────────────────────────────────────┐
│              CreditClaw Backend (Next.js API)            │
│                                                          │
│  Owner endpoints:               Bot endpoints:           │
│  /card-wallet/create            /card-wallet/bot/purchase│
│  /card-wallet/list              /card-wallet/bot/purchase│
│  /card-wallet/balance                        /status     │
│  /card-wallet/freeze                                     │
│  /card-wallet/onramp/session                             │
│  /card-wallet/guardrails                                 │
│  /card-wallet/transactions                               │
│  /card-wallet/orders/:id                                 │
│  /card-wallet/approvals                                  │
│  /card-wallet/approvals/decide                           │
│  /card-wallet/webhooks/crossmint                         │
└──────────┬──────────────────────────────┬────────────────┘
           │                              │
     ┌─────┴──────┐              ┌────────┴────────┐
     │  CrossMint │              │    CrossMint     │
     │  Wallet    │              │    Fiat Onramp   │
     │  API       │              │    (Embedded     │
     │            │              │     Checkout)    │
     └─────┬──────┘              └─────────────────┘
           │
     ┌─────┴────────────────────────────────────┐
     │     Commerce Purchase Flow                │
     │  Bot requests purchase via CreditClaw     │
     │  → Guardrails + human approval            │
     │  → CrossMint Orders API                   │
     │    (productLocator: "amazon:<ASIN>")      │
     │  → CrossMint handles fulfillment          │
     │  → Wallet debited in USDC                 │
     └──────────────────────────────────────────-┘
```

---

## 3. Data Model

Four tables, all prefixed `crossmint_` for rail segmentation.

### crossmint_wallets

| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | |
| bot_id | text | Linked bot identifier |
| owner_uid | text | Firebase UID |
| crossmint_wallet_id | text | CrossMint internal wallet ID |
| address | text | 0x address (EVM smart wallet on Base) |
| balance_usdc | bigint | Micro-USDC (6 decimals). 1000000 = $1.00. Cache — CrossMint API is source of truth. |
| chain | text | `base` (default). Future: `ethereum` / `solana` |
| status | text | `active` / `paused` |
| created_at | timestamp | |
| updated_at | timestamp | |

### crossmint_guardrails

| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | |
| wallet_id | integer | FK → crossmint_wallets |
| max_per_tx_usdc | integer | Per-transaction cap in USD (default: 100) |
| daily_budget_usdc | integer | Daily spend cap in USD (default: 500) |
| monthly_budget_usdc | integer | Monthly spend cap in USD (default: 2000) |
| require_approval_above | integer | Human approval threshold in USD. **Default: 0** (approve everything). Owner can raise over time. |
| allowlisted_merchants | jsonb | Array of allowed merchant identifiers, e.g. `["amazon"]`. Empty = all allowed. |
| blocklisted_merchants | jsonb | Array of blocked merchant identifiers. |
| auto_pause_on_zero | boolean | Pause wallet when balance hits zero (default: true) |
| updated_at | timestamp | |
| updated_by | text | Firebase UID of last editor |

**Note on merchant identifiers:** These correspond to CrossMint's `productLocator` prefixes: `amazon`, `shopify`, etc. Domain-based allow/blocklists (used in Rail 1 for x402 URLs) are not applicable here.

### crossmint_transactions

| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | |
| wallet_id | integer | FK → crossmint_wallets |
| type | text | `deposit` / `purchase` / `refund` / `transfer` |
| amount_usdc | bigint | Micro-USDC |
| crossmint_order_id | text | CrossMint order ID (for purchases and deposits) |
| product_locator | text | e.g. `"amazon:B01DFKC2SO"` |
| product_name | text | Human-readable item name |
| quantity | integer | Number of items (default: 1) |
| order_status | text | `pending` / `processing` / `shipped` / `delivered` / `cancelled` / `failed` |
| shipping_address | jsonb | Delivery address for physical goods |
| tracking_info | jsonb | `{ carrier, tracking_number, tracking_url, estimated_delivery }` |
| status | text | `pending` / `confirmed` / `failed` / `requires_approval` |
| metadata | jsonb | Additional order details from CrossMint |
| created_at | timestamp | |
| updated_at | timestamp | |

### crossmint_approvals

| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | |
| wallet_id | integer | FK → crossmint_wallets |
| transaction_id | integer | FK → crossmint_transactions |
| amount_usdc | bigint | Estimated purchase price |
| product_locator | text | e.g. `"amazon:B01DFKC2SO"` |
| product_name | text | Human-readable name for approval card |
| shipping_address | jsonb | Where the item will ship |
| status | text | `pending` / `approved` / `rejected` / `expired` |
| expires_at | timestamp | Auto-expire after **15 minutes** |
| decided_by | text | Firebase UID of decider |
| decided_at | timestamp | |

**TTL rationale:** 15 minutes (vs. Rail 1's 5 minutes) because the owner needs time to review the product, verify the price, and confirm the shipping address — not just approve a dollar amount.

---

## 4. API Endpoints

All routes under `/api/v1/card-wallet/`. Owner endpoints use Firebase session cookie auth. Bot endpoint uses Bearer API token auth.

### Owner Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/create` | Create CrossMint smart wallet for a bot. Calls `POST crossmint.com/api/2022-06-09/wallets`. Stores wallet record, creates default guardrails (require_approval_above = 0). |
| GET | `/list` | List owner's CrossMint wallets with balances, guardrails, and linked bot info. |
| GET | `/balance` | Single wallet USDC balance. Queries CrossMint API (source of truth) and updates cached `balance_usdc`. |
| POST | `/freeze` | Toggle wallet status between `active` and `paused`. Paused wallets reject all purchase requests. |
| POST | `/onramp/session` | Create CrossMint fiat onramp order. Returns `orderId` and `clientSecret` for `<CrossmintEmbeddedCheckout />` widget. |
| GET/POST | `/guardrails` | View or update spending controls for a wallet. |
| GET | `/transactions` | List transactions for a wallet. Filterable by type (`purchase`, `deposit`). |
| GET | `/orders/:order_id` | Get detailed order status including shipping/tracking for a specific purchase. |
| GET | `/approvals` | List pending approvals for the owner. |
| POST | `/approvals/decide` | Approve or reject a pending purchase. Checks expiration (15-min TTL). |

### Bot Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/bot/purchase` | Request a commerce purchase. Enforces all guardrails. Default behavior: creates pending approval (202). |
| GET | `/bot/purchase/status` | Poll purchase status by `transaction_id` or `approval_id`. Returns approval status, order status, tracking info. |

### Webhook

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhooks/crossmint` | Handles CrossMint order status updates. For onramp orders: credits wallet balance, creates deposit transaction. For purchase orders: updates order_status, tracking_info. |

---

## 5. Core Flows

### Flow 1: Wallet Creation

```
Owner clicks "Create Wallet" → selects a bot
→ POST /card-wallet/create { bot_id }
→ Backend: POST https://www.crossmint.com/api/2022-06-09/wallets
   Headers: { "X-API-KEY": CROSSMINT_SERVER_API_KEY }
   Body: {
     type: "evm-smart-wallet",
     config: { adminSigner: { type: "evm-fireblocks-custodial" } },
     linkedUser: "userId:<owner_uid>"
   }
→ Response: { type: "evm-smart-wallet", address: "0x...", locator: "..." }
→ Store in crossmint_wallets (chain: "base")
→ Create default guardrails (require_approval_above: 0)
→ Wallet card appears in dashboard with $0.00 balance
```

### Flow 2: Funding via CrossMint Onramp

```
Owner clicks "Fund Wallet" on a wallet card
→ POST /card-wallet/onramp/session { wallet_id }
→ Backend: POST https://www.crossmint.com/api/2022-06-09/orders
   Headers: { "X-API-KEY": CROSSMINT_SERVER_API_KEY }
   Body: {
     lineItems: [{
       tokenLocator: "base:<USDC_CONTRACT_ADDRESS>:<USDC_CONTRACT_ADDRESS>",
       executionParameters: { mode: "exact-in", amount: "<dollar_amount>" }
     }],
     payment: { method: "checkoutcom-flow", receiptEmail: owner.email },
     recipient: { walletAddress: wallet.address }
   }
→ Returns { orderId, clientSecret, order }
→ Frontend: <CrossmintEmbeddedCheckout
     orderId={orderId}
     clientSecret={clientSecret}
     environment="staging" | "production"
   />
→ Widget handles KYC (Persona, first time only) + credit card payment
→ CrossMint webhook: order status → fulfillment_complete
→ Backend credits crossmint_wallets.balance_usdc
→ Creates deposit transaction in crossmint_transactions
```

**Fallback:** If embedded widget has iframe issues (same problem as Rail 1 Stripe widget in Replit preview), return a hosted redirect URL. Support both from day one.

### Flow 3: Bot Commerce Purchase (Amazon)

```
Bot encounters an Amazon product it wants to buy
→ POST /card-wallet/bot/purchase (Bearer: bot API key)
   {
     merchant: "amazon",
     product_id: "B01DFKC2SO",
     quantity: 1,
     shipping_address: {
       name: "Jane Smith",
       line1: "123 Main St",
       line2: "Apt 4B",
       city: "New York",
       state: "NY",
       zip: "10001",
       country: "US"
     }
   }

Backend processing:
  1. Authenticate bot via Bearer token
  2. Look up bot's crossmint_wallet
  3. Resolve product info:
     → Call CrossMint to get estimated price for the ASIN
     → Store product_name and estimated_amount

  4. Guardrail checks (in order):
     a. Wallet active? (status == "active")
     b. Estimated amount ≤ max_per_tx_usdc?
     c. Daily cumulative + estimated amount ≤ daily_budget_usdc?
     d. Monthly cumulative + estimated amount ≤ monthly_budget_usdc?
     e. Merchant on allowlist? (if set — "amazon" must be present)
     f. Merchant not on blocklist?
     g. Estimated amount ≥ require_approval_above? (default: 0 = always yes)

  5. If hard block (budget exceeded, merchant blocked):
     → Return 403 { error: "guardrail_violation", reason: "..." }

  6. If approval required (default for all transactions):
     → Create crossmint_transactions record (status: "requires_approval")
     → Create crossmint_approvals record (15-min TTL)
     → Return 202 {
         status: "awaiting_approval",
         approval_id: "...",
         product_name: "AmazonBasics USB Cable",
         estimated_price_usd: 12.99,
         expires_at: "..."
       }

  7. Owner sees pending approval in dashboard
     → Approval card shows: product name, estimated price, ASIN,
        shipping address, "View on Amazon" link, approve/reject buttons

  8. Owner approves (POST /card-wallet/approvals/decide)
     → Check not expired (15-min TTL)
     → If expired → 410 Gone
     → If rejected → transaction marked failed, notify bot

  9. If approved:
     → POST https://www.crossmint.com/api/2022-06-09/orders
        Body: {
          lineItems: [{
            productLocator: "amazon:B01DFKC2SO"
          }],
          payment: {
            method: "crypto",
            currency: "usdc",
            payerAddress: wallet.address
          },
          recipient: {
            name: "Jane Smith",
            address: "123 Main St",
            address2: "Apt 4B",
            city: "New York",
            state: "NY",
            zip: "10001",
            country: "US",
            email: owner.email
          }
        }
     → Store crossmint_order_id on transaction
     → Update transaction status to "confirmed", order_status to "processing"
     → Notify bot: purchase submitted

  10. CrossMint fulfills the order:
      → Webhook updates: order_status → "shipped" (with tracking info)
      → Webhook updates: order_status → "delivered"
      → Each update stored in crossmint_transactions.tracking_info
```

### Flow 4: Human-in-the-Loop Approval

```
Bot purchase exceeds require_approval_above threshold (default: $0 = all purchases)
→ Transaction created with status "requires_approval"
→ Approval record created (15-minute expiry)
→ Bot receives 202 { status: "awaiting_approval", approval_id }

Owner sees pending approval in dashboard:
  ┌─────────────────────────────────────────┐
  │  🛒 Purchase Approval Required          │
  │                                         │
  │  AmazonBasics USB-C Cable              │
  │  ASIN: B01DFKC2SO                      │
  │  Est. Price: $12.99                     │
  │  Quantity: 1                            │
  │  Ship to: Jane Smith, 123 Main St...   │
  │                                         │
  │  [View on Amazon]                       │
  │                                         │
  │  Bot: shopping-agent-01                 │
  │  Wallet: CrossMint #1 ($45.32 bal.)    │
  │  Expires in: 12:34                      │
  │                                         │
  │  [✓ Approve]  [✗ Reject]              │
  └─────────────────────────────────────────┘

→ POST /card-wallet/approvals/decide { approval_id, decision: "approve"|"reject" }
→ If expired → 410 Gone
→ If rejected → transaction marked failed, bot notified
→ If approved → CrossMint order created, bot notified
```

### Flow 5: Bot Polls Purchase Status

```
Bot received approval_id or transaction_id from purchase request
→ GET /card-wallet/bot/purchase/status?transaction_id=123

Response (while awaiting approval):
  { status: "awaiting_approval", expires_at: "..." }

Response (after approval, order processing):
  { status: "confirmed", order_status: "processing" }

Response (shipped):
  { status: "confirmed", order_status: "shipped",
    tracking: { carrier: "UPS", tracking_number: "1Z...",
                tracking_url: "https://...", estimated_delivery: "2026-02-18" } }

Response (delivered):
  { status: "confirmed", order_status: "delivered" }

Response (rejected):
  { status: "failed", reason: "approval_rejected" }
```

---

## 6. Lib Files

| File | Purpose |
|------|---------|
| `lib/card-wallet/server.ts` | CrossMint client initialization (raw `fetch` with API key), wallet creation, balance queries. All CrossMint API calls abstracted behind a single client for version pinning. |
| `lib/card-wallet/purchase.ts` | CrossMint Orders API integration — create purchase order with `productLocator`, poll order status, parse order response, extract tracking info. |
| `lib/card-wallet/onramp.ts` | CrossMint onramp order creation for fiat → USDC funding. Returns `orderId` + `clientSecret` for embedded checkout widget. |

**Shared modules (extracted from Rail 1):**

| File | Purpose |
|------|---------|
| `lib/guardrails/evaluate.ts` | Pure function: `(rules, txRequest, cumulativeSpend) → { allow | block | require_approval, reason }`. Used by both Rail 1 and Rail 2. |
| `lib/guardrails/types.ts` | Shared types: `GuardrailRules`, `TransactionRequest`, `GuardrailDecision`. |
| `lib/approvals/lifecycle.ts` | Approval state machine: create (with TTL), decide, check expiry. Parameterized TTL (5 min for Rail 1, 15 min for Rail 2). |

---

## 7. Environment Variables (New)

| Variable | Purpose |
|----------|---------|
| `CROSSMINT_SERVER_API_KEY` | Server-side API key. Scopes: `wallets.create`, `wallets.read`, `wallets.fund`, `wallets:balance.read`, `wallets:transactions.create`, `wallets:transactions.read`, `orders.create`, `orders.read`. |
| `NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY` | Client-side API key for `<CrossmintEmbeddedCheckout />` widget. |
| `CROSSMINT_WEBHOOK_SECRET` | Webhook signature verification for order status updates. |

---

## 8. Dependencies (New)

| Package | Purpose |
|---------|---------|
| `@crossmint/client-sdk-react-ui` | Embedded checkout widget (`CrossmintEmbeddedCheckout`) for onramp funding UI. |
| `@crossmint/wallets-sdk` | Server-side wallet SDK (if mature enough, otherwise raw `fetch` to REST API). |

---

## 9. What Can Be Reused from Rail 1

| Component | Reuse Level | Notes |
|-----------|------------|-------|
| Guardrail enforcement logic | **Extract to shared module** | `lib/guardrails/evaluate.ts`. Same checks: per-tx, daily, monthly, merchant/domain list, approval threshold. Rail 2 uses merchant lists instead of domain lists — the evaluator accepts both. |
| Approval flow | **Extract to shared module** | `lib/approvals/lifecycle.ts`. Same state machine, parameterized TTL. Rail 2 approval cards show richer content (product info, shipping address). |
| Bot auth middleware | **Share directly** | Same `authenticateBot()` middleware with Bearer token auth. |
| Dashboard UI layout | Copy + adapt | Same card layout pattern. Rail 2 adds product info, order tracking, shipping status to transaction ledger. |
| Guardrail config UI | Copy + adapt | Same panel structure. Rail 2 replaces domain lists with merchant lists. |
| Transaction ledger component | Copy + adapt | Rail 2 adds order_status, tracking_info columns. |

---

## 10. Frontend

Dashboard at `/app/card-wallet` (client component). Features:
- Wallet cards with gradient design (differentiated from Rail 1 cards)
- Balance display, bot name, wallet address, status badge
- "Fund Wallet" button per wallet (opens CrossMint embedded checkout)
- "Create Wallet" flow with bot selector
- Wallet freeze/unfreeze toggle
- **Purchase history with order tracking** — shows product name, price, order status (processing → shipped → delivered), tracking link
- **Pending approvals section** — approval cards showing product name, ASIN, estimated price, shipping address, "View on Amazon" link, approve/reject buttons, countdown timer (15 min)
- Guardrails configuration panel (with merchant allow/blocklist instead of domain lists)

---

## 11. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| CrossMint wallet API is `v1-alpha2` (alpha) | Pin API version in all calls. Abstract behind `lib/card-wallet/server.ts` so endpoint changes require updating one file. CrossMint is production-deployed with MoneyGram, WireX, Visa. |
| Onramp widget iframe restrictions (same as Rail 1 Stripe issue) | Support hosted redirect fallback from day one. |
| Amazon product pricing is estimated at approval time — final price may differ | Guardrails check against estimated price with 5% buffer. If final price exceeds estimate + buffer, the order should be flagged or cancelled. |
| CrossMint Orders API may reject invalid shipping addresses | Validate address format before creating approval. Return clear error to bot. |
| Order cancellation / Amazon fulfillment failure | Handle order failure status in webhook. Refund wallet balance (or note that CrossMint handles refunds). Notify bot of failure. |
| $1,000/day default user limit on onramp | Contact CrossMint sales for enterprise limits. Document limit in owner UI. |
| Amazon ASIN availability — product may be out of stock | Validate ASIN availability before creating approval if CrossMint provides a lookup endpoint. Otherwise, handle gracefully when order fails. |
| 15-minute approval TTL may expire during owner review | Show countdown timer in UI. Allow owner to extend (or create a new approval) if expired. Bot can re-request. |

---

## 12. Implementation Order

1. **CrossMint account setup** — Create project in staging console, get API keys (server + client), configure Smart Wallets in project settings.
2. **DB schema** — Add `crossmint_wallets`, `crossmint_guardrails`, `crossmint_transactions`, `crossmint_approvals` tables to Drizzle schema in `shared/schema.ts`. Run migration.
3. **Wallet creation endpoint** — `POST /card-wallet/create` + storage methods.
4. **Balance queries** — `GET /card-wallet/balance` via CrossMint API. Cache in DB.
5. **Extract shared guardrails** — Move evaluation logic from Rail 1 into `lib/guardrails/evaluate.ts`. Ensure Rail 1 still works with the extracted module.
6. **Rail 2 guardrails** — `crossmint_guardrails` table with merchant allow/blocklist, default require_approval_above=0.
7. **Fiat onramp** — `POST /card-wallet/onramp/session` + `<CrossmintEmbeddedCheckout />` widget in frontend. Test with staging USDXM faucet tokens.
8. **Bot purchase endpoint** — `POST /card-wallet/bot/purchase`. Guardrail enforcement → create approval → return 202.
9. **Approval flow** — `GET /approvals` + `POST /approvals/decide`. Rich approval cards with product info. 15-min TTL.
10. **CrossMint order execution** — On approval, call CrossMint Orders API with `productLocator: "amazon:<ASIN>"`. Store order ID.
11. **Order status tracking** — `GET /bot/purchase/status` for bot polling. Webhook handler for order status updates (shipped, delivered, cancelled). Update tracking_info.
12. **Dashboard UI** — `/app/card-wallet` page: wallet cards, fund button, purchase history with order tracking, pending approvals with product details, guardrails config.
13. **Webhook handler** — `POST /webhooks/crossmint` for both onramp fulfillment and purchase order status updates.
14. **Testing** — Staging environment with USDXM faucet tokens (`faucet.crossmint.com`). Test full flow: create wallet → fund → bot requests purchase → owner approves → order placed → status updates.

---

## 13. Staging vs Production

| Environment | Console | API Base |
|------------|---------|----------|
| Staging | `staging.crossmint.com/console` | `staging.crossmint.com/api` |
| Production | `www.crossmint.com/console` | `www.crossmint.com/api` |

Test with staging first. CrossMint provides a faucet at `faucet.crossmint.com` for testnet tokens (USDXM). Use `CROSSMINT_ENV=staging` in development.

---

## 14. Not in v1 (Explicitly Deferred)

| Feature | Reason | Difficulty to Add Later |
|---------|--------|------------------------|
| x402 payment signing | Rail 1 already covers x402. Rail 2 focuses on commerce. | Low — add `/bot/sign` endpoint, reuse Rail 1's EIP-712 logic with CrossMint signing. |
| Shopify / flights / other World Store merchants | Same Orders API, different `productLocator` format. | Very low — change `"amazon:<id>"` to `"shopify:<id>"`. |
| GOAT SDK bot-side integration | Bypasses CreditClaw guardrails. Not suitable for v1. | Medium — would require a "bring your own wallet" mode. |
| Master guardrails (cross-rail limits) | Separate feature, builds on shared guardrails extraction done in this work. | Medium — new `master_guardrails` table + cross-rail spend aggregation. |
| Real-time balance polling from Base RPC | CrossMint API balance queries are sufficient for v1. | Low — add RPC polling as a background job. |
| Webhook notifications to bots | Bots poll for status in v1. | Low — reuse Rail 1's webhook delivery infrastructure. |

---

## 15. Reference Links

**CrossMint:**
- Docs: https://docs.crossmint.com
- Server-side wallets: https://docs.crossmint.com/wallets/quickstarts/server-side-wallets
- Amazon integration: https://docs.crossmint.com/payments/headless/guides/providers/amazon
- Onramp embedded quickstart: https://github.com/Crossmint/onramp-embedded-quickstart
- Agentic finance examples: https://github.com/Crossmint/crossmint-agentic-finance
- OpenClaw plugin (reference): https://github.com/Crossmint/openclaw-crossmint-plugin
- Staging console: https://staging.crossmint.com/console
- Faucet: https://faucet.crossmint.com

**GOAT SDK (reference):**
- GitHub: https://github.com/goat-sdk/goat
- EVM Amazon purchase example: https://github.com/goat-sdk/goat/tree/main/typescript/examples/by-use-case/evm-purchase-on-amazon
- Crossmint wallet package: https://www.npmjs.com/package/@goat-sdk/crossmint

**CreditClaw Rail 1 (for shared module extraction):**
- Spec: creditclaw-x402-tech-spec_v5.md
- Implementation: rail1-stripe-wallet-technical-spec.md
- Routes: `/api/v1/stripe-wallet/*`
- Lib: `lib/stripe-wallet/`
- Tables: `privy_wallets`, `privy_guardrails`, `privy_transactions`, `privy_approvals`
