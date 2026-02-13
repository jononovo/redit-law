# CreditClaw x402 — Technical Specification

> **Purpose:** Build doc for the CreditClaw pivot from Stripe Issuing virtual cards to Stripe Crypto Onramp + Privy wallets + x402 machine payments on Base.
>
> **Target users:** OpenClaw bot owners (expandable to any agent platform).
>
> **Core principle:** Non-crypto-native humans fund wallets with credit cards. Bots spend autonomously via x402 within human-defined guardrails.

---

## 0. Background & Ecosystem Context

### What is x402?

x402 is an open-source payment protocol created by Coinbase that embeds stablecoin payments directly into HTTP request-response flows. It revives the long-dormant HTTP 402 "Payment Required" status code. When an AI agent requests a paid resource, the server responds with a 402 status containing machine-readable payment requirements (price, token, network, recipient address). The agent's wallet signs a USDC payment authorization, retries the request with an `X-PAYMENT` header, and the server verifies and settles the transaction on-chain. The entire round-trip takes ~2 seconds with transaction costs as low as $0.001. No accounts, API keys, or subscriptions needed — payment itself is authentication.

### Why this architecture?

On February 10, 2026, Stripe launched "machine payments" — a preview feature integrating x402 into its PaymentIntents API. Simultaneously, Coinbase launched Agentic Wallets for AI agents. However, neither solves the problem for **non-crypto-native users** who want their bots to transact on x402 rails. Stripe's x402 integration is merchant-side only. Coinbase's Agentic Wallets assume crypto familiarity. CreditClaw fills this gap: the financial management layer that lets a human fund a bot's wallet with a credit card and control how the bot spends via x402.

### Key players

- **Stripe** — Acquired Privy ($230M, June 2025) and Bridge ($1.1B). Provides Crypto Onramp for fiat-to-USDC conversion and x402 machine payments for merchants.
- **Privy** (now Stripe) — Wallet infrastructure. Creates and manages crypto wallets with TEE-secured key management, policy engine for spending controls, and native x402 support.
- **Coinbase** — Created x402 protocol. Operates the primary facilitator (payment verification + on-chain settlement). Runs Base (the L2 blockchain where x402 transactions settle).
- **Circle** — Issues USDC, the stablecoin used for x402 payments.
- **OpenClaw** — Open-source AI agent framework (145K+ GitHub stars). CreditClaw's primary target ecosystem.

### How x402 payments work under the hood

x402 leverages two Ethereum standards:

- **EIP-3009 (transferWithAuthorization):** Enables gasless, one-time USDC transfers through signed authorizations. Each authorization is for a specific amount, recipient, and time window — no persistent on-chain allowances.
- **EIP-712 (typed data signing):** Provides the cryptographic structure. The wallet signs a `TransferWithAuthorization` struct containing `from`, `to`, `value`, `validAfter`, `validBefore`, and `nonce`.

The **facilitator** (Coinbase CDP) handles payment verification and blockchain settlement so that neither the paying agent nor the receiving server needs to run blockchain infrastructure.

### Documentation & Reference URLs

**Important — Onramp integration approach:**
We use Stripe's **embedded crypto onramp widget** (the pre-built iframe) — NOT Stripe's "Embedded Components" SDK. The widget approach is simpler: we create an `OnrampSession` server-side, pass the `client_secret` to the frontend, and mount Stripe's iframe which handles the entire UI (KYC, payment collection, purchase flow). The Privy recipe at `docs.privy.io/recipes/stripe-headless-onramp` demonstrates the *Embedded Components* approach (app-controlled UI with separate SDK calls for each step) — we are NOT following that pattern. However, that Privy recipe is still valuable as **architectural reference** because it confirms the Privy + Stripe integration plumbing: Privy auth for users, Privy wallets as USDC destination, `'base'` as a supported network, and `'usdc.base'` as the destination currency format. The underlying infrastructure is the same; we're just letting Stripe handle the UI.

**Stripe Crypto Onramp (our fiat-to-USDC integration):**
- Overview: https://docs.stripe.com/crypto/onramp
- Embedded widget guide: https://docs.stripe.com/crypto/onramp/embedded
- Wallet funding use case: https://docs.stripe.com/crypto/onramp/embedded#wallet
- Onramp API reference: https://docs.stripe.com/api/crypto/onramp_sessions
- Onramp application: https://docs.stripe.com/crypto/onramp#submit-your-application
- Sandbox quickstart: https://docs.stripe.com/crypto/onramp/embedded-quickstart

**Privy (our wallet infrastructure):**
- Wallets overview: https://docs.privy.io/wallets/overview
- Server wallets API: https://docs.privy.io/api-reference/introduction
- x402 recipe: https://docs.privy.io/recipes/x402
- Policy engine: https://docs.privy.io/security/wallet-infrastructure/policy-and-controls
- Sending USDC: https://docs.privy.io/recipes/send-usdc
- Stripe Embedded Components onramp (reference only — we use embedded widget instead): https://docs.privy.io/recipes/stripe-headless-onramp
- Agentic wallets recipe: https://docs.privy.io/recipes/wallets/agentic-wallets

**x402 Protocol:**
- Specification: https://www.x402.org
- Whitepaper: https://www.x402.org/x402-whitepaper.pdf
- GitHub (SDKs): https://github.com/coinbase/x402
- Coinbase developer docs: https://docs.cdp.coinbase.com/x402/welcome
- How it works: https://docs.cdp.coinbase.com/x402/core-concepts/how-it-works
- Network support: https://docs.cdp.coinbase.com/x402/network-support

**Stripe Machine Payments (merchant side — context only):**
- Overview: https://docs.stripe.com/payments/machine
- x402 integration: https://docs.stripe.com/payments/machine/x402

**Base (blockchain):**
- Docs: https://docs.base.org
- Block explorer: https://basescan.org
- USDC contract on Base: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    HUMAN OWNER (Browser)                     │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Auth/Login  │  │ Stripe Crypto│  │  Owner Dashboard  │  │
│  │  (Privy SDK) │  │ Onramp Widget│  │  (Next.js)        │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬──────────┘  │
└─────────┼────────────────┼───────────────────┼──────────────┘
          │                │                   │
          ▼                ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                 CREDITCLAW BACKEND (Next.js API)             │
│                                                             │
│  /api/wallet/create     — Create Privy wallet for bot       │
│  /api/onramp/session    — Mint Stripe onramp session        │
│  /api/guardrails/set    — Configure spending policies       │
│  /api/transactions/list — Query transaction ledger          │
│  /api/bot/sign          — Proxy x402 signing requests       │
│  /api/webhooks/stripe   — Handle onramp completion          │
│  /api/webhooks/privy    — Handle wallet events              │
└──────────┬──────────────────────────────────┬───────────────┘
           │                                  │
           ▼                                  ▼
┌─────────────────────┐          ┌────────────────────────────┐
│   PRIVY (Stripe)    │          │   STRIPE CRYPTO ONRAMP     │
│                     │          │                            │
│  Server Wallets API │          │  POST /v1/crypto/          │
│  Policy Engine (TEE)│          │    onramp_sessions         │
│  Signing API        │          │  Webhook: session_updated  │
│  Base + USDC        │          │  KYC + Fraud (Stripe MoR)  │
└──────────┬──────────┘          └────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                    x402 PAYMENT FLOW                         │
│                                                             │
│  Bot HTTP request → 402 response → Privy signs EIP-712     │
│  → X-PAYMENT header → Facilitator verifies → Content       │
│  → Facilitator settles USDC on Base                         │
│                                                             │
│  Facilitator: Coinbase CDP (api.cdp.coinbase.com)           │
│  Free: 1,000 tx/month, then $0.001/tx                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Data Model

### Users
```
users
├── id                  (uuid, PK)
├── email               (string, unique)
├── name                (string)
├── privy_user_id       (string, from Privy auth)
├── stripe_customer_id  (string, nullable)
├── onramp_kyc_status   (enum: pending | verified | rejected)
├── created_at          (timestamp)
└── updated_at          (timestamp)
```

### Bots
```
bots
├── id                  (uuid, PK)
├── user_id             (uuid, FK → users)
├── bot_id              (string, unique — OpenClaw bot ID)
├── bot_name            (string)
├── status              (enum: active | paused | disabled)
├── created_at          (timestamp)
└── updated_at          (timestamp)
```

### Wallets
```
wallets
├── id                  (uuid, PK)
├── bot_id              (uuid, FK → bots)
├── privy_wallet_id     (string — Privy server wallet ID)
├── address             (string — 0x address on Base)
├── balance_usdc        (bigint — micro-USDC, 6 decimals)
├── created_at          (timestamp)
└── updated_at          (timestamp)
```

### Guardrails
```
guardrails
├── id                  (uuid, PK)
├── wallet_id           (uuid, FK → wallets)
├── max_per_tx_usdc     (integer — cents, e.g. 100 = $1.00)
├── daily_budget_usdc   (integer — cents)
├── monthly_budget_usdc (integer — cents)
├── require_approval_above (integer — cents, null = never)
├── allowlisted_domains (jsonb — array of domains/addresses)
├── blocklisted_domains (jsonb — array of domains/addresses)
├── auto_pause_on_zero  (boolean, default true)
├── updated_at          (timestamp)
└── updated_by          (uuid, FK → users)
```

### Transactions
```
transactions
├── id                  (uuid, PK)
├── wallet_id           (uuid, FK → wallets)
├── type                (enum: deposit | x402_payment | refund)
├── amount_usdc         (bigint — micro-USDC)
├── recipient_address   (string, nullable — for x402 payments)
├── resource_url        (string, nullable — the x402 endpoint)
├── tx_hash             (string, nullable — Base chain tx hash)
├── status              (enum: pending | confirmed | failed | requires_approval)
├── stripe_session_id   (string, nullable — for deposits)
├── metadata            (jsonb)
├── created_at          (timestamp)
└── confirmed_at        (timestamp, nullable)
```

### Pending Approvals
```
pending_approvals
├── id                  (uuid, PK)
├── wallet_id           (uuid, FK → wallets)
├── transaction_id      (uuid, FK → transactions)
├── amount_usdc         (bigint)
├── resource_url        (string)
├── status              (enum: pending | approved | rejected | expired)
├── expires_at          (timestamp — auto-expire after 5 min)
├── decided_at          (timestamp, nullable)
├── created_at          (timestamp)
└── decided_by          (uuid, nullable, FK → users)
```

---

## 3. Core Flows

### 3.1 — User Signup & Wallet Creation

```
1. User visits CreditClaw, signs up via Privy auth
   (email, Google, or wallet — Privy handles all auth)

2. Backend: POST /api/wallet/create
   → Privy API: POST https://api.privy.io/v1/wallets
     Body: { chain_type: "ethereum" }
   → Returns: { id: "wallet_xxx", address: "0x..." }

3. Store wallet record in DB
   Link wallet to user's first bot (or prompt bot setup)

4. Redirect to dashboard showing:
   - Wallet address (display only)
   - Balance: $0.00 USDC
   - "Fund Your Bot" button → opens onramp
```

### 3.2 — Funding via Stripe Crypto Onramp

```
1. User clicks "Fund Bot" in dashboard

2. Backend: POST /api/onramp/session
   → Stripe API: POST https://api.stripe.com/v1/crypto/onramp_sessions
     Body:
       wallet_addresses[ethereum] = <PRIVY_WALLET_ADDRESS>
       lock_wallet_address = true
       destination_currencies[] = usdc
       destination_networks[] = base
       destination_network = base
       destination_currency = usdc
       customer_ip_address = <USER_IP>
       customer_information[email] = <USER_EMAIL>
       customer_information[first_name] = <if known>
       customer_information[last_name] = <if known>
   → Returns: { client_secret: "cos_xxx_secret_xxx" }

3. Frontend renders Stripe Onramp widget:
   const onrampSession = stripeOnramp.createSession({
     clientSecret,
     appearance: { theme: 'dark' }  // match CreditClaw UI
   });
   onrampSession.mount("#onramp-element");

4. User completes KYC (first time only — Stripe Link saves it)
   User pays with credit card / debit / ACH / Apple Pay

5. Session progresses:
   initialized → requires_payment → fulfillment_processing → fulfillment_complete

6. Stripe webhook: crypto.onramp_session_updated
   → Backend /api/webhooks/stripe receives event
   → On fulfillment_complete:
     - Query on-chain USDC balance of wallet via Base RPC
     - Update wallets.balance_usdc
     - Create transaction record (type: deposit)
     - Notify user: "Your bot has been funded with $X USDC"

SANDBOX TEST VALUES:
  OTP: 000000
  SSN: 000000000
  Address line 1: address_full_match
  Card: 4242 4242 4242 4242
```

### 3.3 — Bot Makes an x402 Payment

```
1. Bot encounters x402-paywalled resource
   GET https://api.example.com/data
   → Response: 402 Payment Required
     Header: PAYMENT-REQUIRED: {
       price: "10000",        # $0.01 USDC (6 decimals)
       address: "0xMerchant...",
       network: "base",
       asset: "USDC"
     }

2. Bot calls CreditClaw: POST /api/bot/sign
   Body: {
     bot_id: "bot_xxx",
     resource_url: "https://api.example.com/data",
     amount_usdc: 10000,      # micro-USDC
     recipient: "0xMerchant..."
   }

3. Backend middleware checks guardrails:
   a. Is bot active? (status == active)
   b. Is amount ≤ max_per_tx_usdc?
   c. Is daily cumulative + amount ≤ daily_budget_usdc?
   d. Is monthly cumulative + amount ≤ monthly_budget_usdc?
   e. Is recipient on allowlist (if allowlist is set)?
   f. Is recipient NOT on blocklist?
   g. Is amount < require_approval_above? (if set)

   IF any check fails:
     → If approval required: create pending_approval, notify owner, return 202
     → If hard block: return 403 with reason

4. Backend signs via Privy:
   POST https://api.privy.io/v1/wallets/<wallet_id>/rpc
   Body: {
     method: "eth_signTypedData_v4",
     params: {
       typed_data: <EIP-712 TransferWithAuthorization struct>
       # domain: { name: "USD Coin", version: "2", chainId: 8453, verifyingContract: USDC_BASE }
       # message: { from, to, value, validAfter, validBefore, nonce }
     }
   }
   → Returns: { signature: "0x..." }

5. Backend constructs X-PAYMENT header (base64-encoded payload)
   Returns signed header to bot

6. Bot retries original request with X-PAYMENT header
   GET https://api.example.com/data
   Header: X-PAYMENT: <base64 payload>

7. Server forwards to facilitator (Coinbase CDP) for verification
   → Facilitator confirms signature + balance
   → Server returns content to bot
   → Facilitator calls transferWithAuthorization() on Base
   → USDC moves from bot wallet to merchant

8. Backend records transaction, updates balance
```

### 3.4 — Human-in-the-Loop Approval

```
1. Bot requests payment that exceeds require_approval_above threshold

2. Backend creates pending_approval record (expires in 5 min)
   Sends push notification / email to owner:
   "Your bot wants to spend $5.00 USDC on api.example.com — Approve?"

3. Owner opens dashboard or notification link
   Sees: amount, recipient, resource URL
   Clicks: Approve or Reject

4. If approved:
   → Backend proceeds with Privy signing (step 3.3.4)
   → Returns signed header to bot (bot was polling or via webhook)

5. If rejected or expired:
   → Bot receives 403
   → Transaction logged as failed with reason
```

---

## 4. Privy Policy Engine Configuration

Set these via Privy's API when the user configures guardrails. Enforced inside the TEE — cannot be bypassed even if the app server is compromised.

```jsonc
// Example policy for a bot wallet
{
  "policies": [
    {
      // Only allow EIP-712 signing for USDC transferWithAuthorization
      "type": "typed_data_signing",
      "action": "allow",
      "conditions": {
        "domain.name": "USD Coin",
        "domain.chainId": 8453,            // Base mainnet
        "domain.verifyingContract": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"  // USDC on Base
      }
    },
    {
      // Block all other signing requests
      "type": "typed_data_signing",
      "action": "deny",
      "conditions": {}
    },
    {
      // Block raw ETH transfers (bot should never send ETH)
      "type": "transfer",
      "action": "deny",
      "conditions": {}
    }
  ]
}
```

---

## 5. API Route Specifications

### POST /api/wallet/create
```
Auth: Privy session token (user must be authenticated)
Body: { bot_id: string }
Response: { wallet_id, address, bot_id }

Logic:
  1. Verify user owns bot_id
  2. Check bot doesn't already have a wallet
  3. POST to Privy /v1/wallets { chain_type: "ethereum" }
  4. Apply default policy engine rules
  5. Store wallet record
  6. Return wallet info
```

### POST /api/onramp/session
```
Auth: Privy session token
Body: { wallet_id: string, amount_usd?: number }
Response: { client_secret: string }

Logic:
  1. Look up wallet, verify user owns it
  2. POST to Stripe /v1/crypto/onramp_sessions with:
     - wallet address locked to Privy wallet
     - USDC on Base only
     - Pre-populated customer info
     - Optional: source_amount if user specified
  3. Return client_secret for frontend widget
```

### POST /api/guardrails/set
```
Auth: Privy session token
Body: {
  wallet_id: string,
  max_per_tx_usdc?: number,
  daily_budget_usdc?: number,
  monthly_budget_usdc?: number,
  require_approval_above?: number | null,
  allowlisted_domains?: string[],
  blocklisted_domains?: string[]
}
Response: { guardrails: GuardrailsObject }

Logic:
  1. Verify user owns wallet
  2. Validate values (positive numbers, valid domains)
  3. Update guardrails record in DB
  4. Sync relevant rules to Privy Policy Engine via API
  5. Return updated guardrails
```

### POST /api/bot/sign
```
Auth: Bot API key (issued per bot, stored hashed)
Body: {
  bot_id: string,
  resource_url: string,
  amount_usdc: number,        # micro-USDC (6 decimals)
  recipient_address: string,
  valid_before: number         # Unix timestamp
}
Response:
  200: { x_payment_header: string }
  202: { status: "awaiting_approval", approval_id: string }
  403: { error: string, reason: string }

Logic:
  1. Authenticate bot via API key
  2. Look up wallet and guardrails
  3. Run guardrail checks (see flow 3.3 step 3)
  4. If approval needed → create pending_approval, return 202
  5. Build EIP-712 typed data for TransferWithAuthorization
  6. Sign via Privy /v1/wallets/{id}/rpc
  7. Construct X-PAYMENT header
  8. Log transaction
  9. Return header
```

### GET /api/transactions/list
```
Auth: Privy session token
Query: { wallet_id, type?, limit?, offset?, from?, to? }
Response: { transactions: Transaction[], total: number }
```

### POST /api/approvals/decide
```
Auth: Privy session token
Body: { approval_id: string, decision: "approve" | "reject" }
Response: { approval: ApprovalObject, transaction?: TransactionObject }

Logic:
  1. Verify user owns the wallet
  2. Check approval isn't expired
  3. If approve → proceed with signing flow, return signed header
  4. If reject → mark transaction as failed
  5. Notify bot via webhook/polling
```

---

## 6. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Auth | Privy SDK (`@privy-io/react-auth`) |
| Database | PostgreSQL (Drizzle ORM) |
| Fiat Onramp | Stripe Crypto Onramp (embedded widget) |
| Wallet Infra | Privy Server Wallets API |
| Spending Controls | Privy Policy Engine + application middleware |
| x402 Signing | Privy RPC (`eth_signTypedData_v4`) |
| Facilitator | Coinbase CDP (`api.cdp.coinbase.com`) |
| Chain | Base (chain ID 8453) |
| Token | USDC (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`) |
| Notifications | Email (Resend) + WebSocket for real-time |
| Deployment | Vercel (or Replit) |

---

## 7. NPM Packages

```json
{
  "dependencies": {
    "@privy-io/react-auth": "latest",
    "@privy-io/server-auth": "latest",
    "@stripe/stripe-js": "latest",
    "@stripe/crypto": "latest",
    "stripe": "latest",
    "viem": "latest",
    "drizzle-orm": "latest",
    "next": "16.x",
    "react": "19.x"
  }
}
```

**Note:** `viem` is for constructing EIP-712 typed data and encoding the X-PAYMENT header. No ethers.js needed.

---

## 8. Environment Variables

```env
# Privy
NEXT_PUBLIC_PRIVY_APP_ID=
PRIVY_APP_SECRET=

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Coinbase CDP (facilitator)
CDP_API_KEY=

# Database
DATABASE_URL=

# Base RPC
BASE_RPC_URL=https://mainnet.base.org

# USDC Contract (Base)
USDC_CONTRACT_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# App
NEXT_PUBLIC_APP_URL=
BOT_API_KEY_SALT=
```

---

## 9. Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Submit Stripe Crypto Onramp application
- [ ] Set up Next.js project with Privy auth
- [ ] Implement wallet creation flow (Privy server wallets)
- [ ] Build basic dashboard: wallet view, balance display
- [ ] Database schema + migrations

### Phase 2: Funding (Week 2)
- [ ] Integrate Stripe Crypto Onramp embedded widget
- [ ] Implement onramp session creation API
- [ ] Handle Stripe webhooks for deposit confirmation
- [ ] Balance tracking (on-chain polling + webhook)
- [ ] Transaction ledger for deposits
- [ ] Test full deposit flow in sandbox

### Phase 3: Bot Spending (Week 3)
- [ ] Bot API key generation and authentication
- [ ] Implement /api/bot/sign endpoint
- [ ] EIP-712 typed data construction for x402
- [ ] Privy signing integration
- [ ] X-PAYMENT header construction
- [ ] Transaction logging for x402 payments
- [ ] Test against a local x402 paywalled endpoint

### Phase 4: Guardrails & Approvals (Week 4)
- [ ] Guardrails configuration UI
- [ ] Application-level spending checks
- [ ] Privy Policy Engine sync
- [ ] Human-in-the-loop approval flow
- [ ] Notification system (email + real-time)
- [ ] Approval expiration handling

### Phase 5: OpenClaw Integration
- [ ] Write SKILL.md for OpenClaw bots
- [ ] Bot onboarding flow (claim token linking)
- [ ] Publish skill to ClawHub
- [ ] End-to-end testing with live OpenClaw bot

---

## 10. Key Contract Addresses (Base Mainnet)

```
USDC:                    0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
SpendPermissionManager:  (deploy or use Base's if available)
Base Chain ID:           8453
Base RPC:                https://mainnet.base.org
Base Block Explorer:     https://basescan.org
```

---

## 11. Security Considerations

1. **Bot API keys** are hashed (bcrypt) before storage. Never stored in plaintext.
2. **Privy wallet keys** never leave the TEE. CreditClaw backend never has access to private keys.
3. **Privy Policy Engine** enforces spending rules at the cryptographic level — even a compromised app server cannot sign unauthorized transactions.
4. **Stripe handles all KYC/AML** as merchant of record. CreditClaw never collects or stores SSN, ID documents, or raw payment credentials.
5. **Rate limiting** on /api/bot/sign — max 100 requests/minute per bot to prevent abuse.
6. **All x402 payments are on-chain** and auditable via Base block explorer.
7. **Webhook signature verification** for both Stripe and Privy events.
