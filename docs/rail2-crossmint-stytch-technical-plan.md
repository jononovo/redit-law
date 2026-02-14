# Rail 2: CrossMint + Stytch — Technical Plan

**Date:** February 13, 2026, 9:00 PM UTC

> CrossMint custodial smart wallets on Base/Solana, CrossMint fiat onramp for credit card → USDC, Stytch for Web3 auth, x402 payment protocol for bot spending.

---

## Provider Capabilities (Research Summary)

### CrossMint

| Capability | Confirmed | Details |
|-----------|-----------|---------|
| Server-side custodial wallets | Yes | `POST /v1-alpha2/wallets` — creates EVM smart wallets (or Solana). MPC key storage. |
| EIP-712 typed data signing | Yes | `signTypedData()` on `SmartWalletClient` interface. Native support. |
| x402 support | Yes | Major x402 infrastructure provider. Production-ready. `crossmint-402-starter` reference repo. |
| Fiat onramp (credit card → USDC) | Yes | Embedded widget (`@crossmint/client-sdk-react-ui`), headless API (`POST /orders`), or hosted popup. |
| Multi-chain | Yes | Ethereum, Base, Solana, Polygon, Arbitrum, and more. |
| USDC balance queries | Yes | `GET /v1-alpha2/wallets/{address}/balances?tokens=usdc&chains=base` |
| Token transfers | Yes | `POST /v1-alpha2/wallets/{locator}/transactions` with encoded ERC-20 call data. Gasless. |
| Delegated signing | Yes | Agent holds local key; owner delegates via web flow. Used in OpenClaw plugin. |
| Gasless transactions | Yes | Smart wallets handle gas abstractly. |

### Stytch

| Capability | Confirmed | Details |
|-----------|-----------|---------|
| Crypto wallet auth | Yes | Ethereum + Solana wallets (MetaMask, Coinbase Wallet, Phantom, etc.) |
| API-based auth flow | Yes | Two-step: `/crypto_wallets/authenticate/start` → `/crypto_wallets/authenticate` |
| Session management | Yes | JWT + session tokens with custom claims, RBAC |
| Web2 + Web3 hybrid | Yes | Mix email/OAuth with crypto wallet login in single flow |
| React SDK | Yes | Drop-in UI components via `@stytch/stytch-react` |
| Custodial wallet management | **No** | Stytch is auth only. Does not create or manage wallets. |

### Key Insight

**Stytch ≠ Privy.** Stytch authenticates users who *already have* wallets (MetaMask, etc.). It does not create wallets. CrossMint creates and manages the custodial wallets. The pairing is: **Stytch authenticates the owner → CrossMint manages the bot's wallet**.

However — CreditClaw already uses Firebase Auth globally. Adding Stytch as a *second* auth layer solely for wallet connection adds complexity without clear benefit, since the bot wallets are custodial (CrossMint holds the keys, not the user). Stytch would only add value if owners need to *connect their personal wallets* to the platform.

---

## Architecture Decision: Stytch Role

Two options:

### Option A: Skip Stytch (Recommended)

Keep Firebase Auth as the only auth layer. Use CrossMint server-side API directly for wallet operations. The owner authenticates via Firebase, and CreditClaw calls CrossMint's API on their behalf. No wallet-connect flow needed because the wallets are custodial.

**Pros:** Simpler, fewer dependencies, consistent auth across all rails.
**Cons:** No Web3 wallet-connect if later needed.

### Option B: Stytch for Owner Wallet Connection

Add Stytch as a scoped auth provider for Rail 2 (like Privy is scoped to Rail 1). Use it to let owners connect their personal wallets for identity verification or direct funding.

**Pros:** Web3-native onboarding, wallet-based identity.
**Cons:** Extra dependency, extra user mapping table, complexity for marginal benefit.

**Recommendation:** Start with Option A. Add Stytch later only if wallet-connect becomes a requirement.

---

## Proposed Architecture

```
Owner (Browser)                     Bot (API Client)
      │                                   │
      ▼                                   ▼
┌──────────────────────────────────────────────────────────┐
│              CreditClaw Backend (Next.js API)            │
│                                                          │
│  Owner endpoints:               Bot endpoints:           │
│  /card-wallet/create            /card-wallet/bot/sign    │
│  /card-wallet/list                                       │
│  /card-wallet/balance                                    │
│  /card-wallet/freeze                                     │
│  /card-wallet/onramp/session                             │
│  /card-wallet/guardrails                                 │
│  /card-wallet/transactions                               │
│  /card-wallet/approvals                                  │
│  /card-wallet/approvals/decide                           │
│  /card-wallet/webhooks/crossmint                         │
└──────────┬──────────────────────────────┬────────────────┘
           │                              │
     ┌─────┴──────┐              ┌────────┴────────┐
     │  CrossMint │              │    CrossMint     │
     │  Wallet    │              │    Fiat Onramp   │
     │  API       │              │    (Embedded/    │
     │            │              │     Headless)    │
     └─────┬──────┘              └─────────────────┘
           │
     ┌─────┴────────────────────────────────────┐
     │         x402 Payment Flow                │
     │  EIP-712 sign via CrossMint SDK          │
     │  → X-PAYMENT header                      │
     │  → Coinbase CDP facilitator              │
     │  → USDC settlement on Base               │
     └─────────────────────────────────────────-┘
```

---

## Data Model

Four tables, prefixed `crossmint_` for rail segmentation.

### crossmint_wallets
| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | |
| bot_id | text | Linked bot identifier |
| owner_uid | text | Firebase UID |
| crossmint_wallet_id | text | CrossMint internal wallet ID |
| address | text | 0x address (EVM smart wallet) |
| balance_usdc | bigint | Micro-USDC (6 decimals) |
| chain | text | `base` / `ethereum` / `solana` |
| status | text | `active` / `paused` |
| created_at | timestamp | |
| updated_at | timestamp | |

### crossmint_guardrails
Same schema as `privy_guardrails` — reuse the guardrail model:
| Column | Type |
|--------|------|
| id | serial PK |
| wallet_id | integer FK |
| max_per_tx_usdc | integer |
| daily_budget_usdc | integer |
| monthly_budget_usdc | integer |
| require_approval_above | integer |
| allowlisted_domains | jsonb |
| blocklisted_domains | jsonb |
| auto_pause_on_zero | boolean |

### crossmint_transactions
Same schema as `privy_transactions` with CrossMint-specific fields:
| Column | Type | Description |
|--------|------|-------------|
| id | serial PK | |
| wallet_id | integer FK | |
| type | text | `deposit` / `x402_payment` / `transfer` / `refund` |
| amount_usdc | bigint | Micro-USDC |
| recipient_address | text | |
| resource_url | text | x402 endpoint URL |
| tx_hash | text | On-chain transaction hash |
| crossmint_action_id | text | CrossMint async action ID |
| status | text | `pending` / `confirmed` / `failed` / `requires_approval` |
| metadata | jsonb | |

### crossmint_approvals
Same schema as `privy_approvals`.

---

## API Endpoints

All routes under `/api/v1/card-wallet/`.

### Owner Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/create` | Create CrossMint smart wallet. `POST crossmint.com/api/v1-alpha2/wallets` with `{ chain: "base" }`. Store wallet record + default guardrails. |
| GET | `/list` | List owner's CrossMint wallets with balances and guardrails. |
| GET | `/balance` | Single wallet USDC balance. Calls CrossMint `GET /wallets/{address}/balances?tokens=usdc&chains=base`. |
| POST | `/freeze` | Toggle wallet `active`/`paused`. |
| POST | `/onramp/session` | Create CrossMint fiat onramp order. Returns `clientSecret` for embedded widget or redirect URL. |
| GET/POST | `/guardrails` | View or update spending controls. |
| GET | `/transactions` | List wallet transactions. |
| GET | `/approvals` | List pending approvals. |
| POST | `/approvals/decide` | Approve/reject pending payment. |

### Bot Endpoint

| Method | Path | Description |
|--------|------|-------------|
| POST | `/bot/sign` | Sign x402 payment via CrossMint `signTypedData()`. Enforces guardrails. Returns `X-PAYMENT` header. |

### Webhook

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhooks/crossmint` | CrossMint order status webhook. On payment completion, credits wallet balance. |

---

## Core Flows

### 1. Wallet Creation

```
Owner → POST /card-wallet/create { bot_id, chain: "base" }
→ Backend: POST https://www.crossmint.com/api/v1-alpha2/wallets
   Headers: { "X-API-KEY": CROSSMINT_SERVER_API_KEY }
   Body: { "userId": owner_uid, "chain": "base" }
→ Response: { type: "evm-smart-wallet", address: "0x...", ... }
→ Store in crossmint_wallets, create default guardrails
```

### 2. Funding via CrossMint Onramp

**Option A: Embedded Widget (preferred)**
```
Owner clicks "Fund Wallet"
→ POST /card-wallet/onramp/session { wallet_id }
→ Backend: POST https://www.crossmint.com/api/2022-06-09/orders
   Body: {
     lineItems: [{ tokenLocator: "base:<USDC_ADDRESS>",
                    executionParameters: { mode: "exact-in", amount: "50" }}],
     payment: { method: "checkoutcom-flow" },
     recipient: { walletAddress: wallet.address }
   }
→ Returns clientSecret
→ Frontend: <CrossmintEmbeddedCheckout /> widget
→ User pays with credit card
→ CrossMint webhook: order fulfilled
→ Backend credits wallet balance, creates deposit transaction
```

**Option B: Headless API** (if embedded widget has issues)
```
Same API call, but return redirect URL for hosted checkout page.
```

### 3. Bot x402 Payment Signing

```
Bot → POST /card-wallet/bot/sign (Bearer: bot API key)
  { resource_url, amount_usdc, recipient_address }

Backend guardrail checks (identical to Rail 1):
  1. Wallet active?
  2. Per-transaction limit?
  3. Daily budget?
  4. Monthly budget?
  5. Domain allowlist/blocklist?
  6. Approval threshold?

If passed:
  → Build EIP-712 TransferWithAuthorization typed data
  → Sign via CrossMint: POST /v1-alpha2/wallets/{address}/signatures
    or use CrossMint SDK signTypedData()
  → Construct X-PAYMENT header
  → Log transaction, return { x_payment_header, signature }
```

### 4. Human-in-the-Loop Approval

Identical pattern to Rail 1 (5-minute TTL, approve/reject via dashboard).

---

## Lib Files (Proposed)

| File | Purpose |
|------|---------|
| `lib/card-wallet/server.ts` | CrossMint client init, wallet creation, EIP-712 signing via CrossMint API |
| `lib/card-wallet/x402.ts` | Same EIP-712 typed data construction as Rail 1 (shared or copied) |
| `lib/card-wallet/onramp.ts` | CrossMint order creation for fiat → USDC onramp |

---

## Environment Variables (New)

| Variable | Purpose |
|----------|---------|
| `CROSSMINT_SERVER_API_KEY` | Server-side API key (scopes: `wallets.create`, `wallets.read`, `wallets.fund`, `wallets:balance.read`, `wallets:transactions.create`) |
| `NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY` | Client-side API key for embedded checkout widget |
| `CROSSMINT_WEBHOOK_SECRET` | Webhook signature verification |

---

## Dependencies (New)

| Package | Purpose |
|---------|---------|
| `@crossmint/client-sdk-react-ui` | Embedded checkout widget (`CrossmintEmbeddedCheckout`) |
| `@crossmint/server-sdk` | Server-side wallet API (if SDK available, otherwise raw `fetch`) |

---

## OpenClaw Plugin Assessment

The `crossmint/openclaw-crossmint-plugin` is a Solana-focused plugin that uses **delegated signing** (agent holds local ed25519 key, owner delegates via web flow). It includes Amazon purchasing. Interesting reference but not directly usable because:

1. **Solana-only** — CreditClaw targets Base (EVM) for x402 consistency with Rail 1.
2. **Delegated signing model** — CreditClaw uses custodial wallets where the platform holds keys, not the bot. This is intentional: the guardrails layer sits between bot and wallet.
3. **No guardrails** — The plugin lets bots spend freely. CreditClaw's value is the spending controls.

**Recommendation:** Don't use the plugin directly. Use CrossMint's server-side wallet API instead, which gives CreditClaw full control over when and how transactions are signed.

---

## What Can Be Reused from Rail 1

| Component | Reuse Level | Notes |
|-----------|------------|-------|
| Guardrail schema | Copy schema, same column structure | Prefix tables `crossmint_*` |
| Guardrail enforcement logic | Share or copy | Same checks: per-tx, daily, monthly, domain, approval threshold |
| EIP-712 typed data construction | Share `x402.ts` utilities | Same USDC contract on Base, same EIP-712 domain |
| Approval flow | Copy pattern | Same 5-min TTL, approve/reject, dashboard UI |
| Bot auth middleware | Share `authenticateBot()` | Same bearer token auth |
| Dashboard UI layout | Copy + rebrand | Same card layout, guardrail panels, transaction ledger |
| Transaction ledger | Copy schema | Add `crossmint_action_id` field |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| CrossMint wallet API is `v1-alpha2` (alpha) | Pin API version, monitor changelog. They're production-deployed with major clients (Visa, Google partnerships). |
| Onramp widget iframe restrictions (same as Rail 1 Stripe issue) | Support hosted redirect fallback from day one. |
| CrossMint signing API may differ from Privy's `signTypedData` | Prototype the signing flow first. If server-side signing isn't exposed, use delegated signer pattern with a platform-held key. |
| $1,000/day default user limit on onramp | Contact CrossMint sales for enterprise limits. |
| Stytch adds complexity without clear benefit | Start without Stytch. Add only if wallet-connect needed. |

---

## Implementation Order

1. **CrossMint account setup** — Create project, get API keys, configure smart wallets
2. **Wallet creation endpoint** — `POST /card-wallet/create` + DB schema
3. **Balance queries** — `GET /card-wallet/balance` via CrossMint API
4. **Guardrails** — Copy schema from Rail 1, adapt to `crossmint_*` tables
5. **Fiat onramp** — CrossMint embedded checkout or headless orders API
6. **Bot x402 signing** — EIP-712 via CrossMint, guardrail enforcement
7. **Approval flow** — Copy pattern from Rail 1
8. **Dashboard UI** — `/app/card-wallet` page, wallet cards, transaction ledger
9. **Webhook handler** — CrossMint order/payment webhooks
10. **Testing** — Staging environment with testnet USDC (USDXM tokens via CrossMint faucet)

---

## Staging vs Production

| Environment | Console | API Base |
|------------|---------|----------|
| Staging | `staging.crossmint.com/console` | `staging.crossmint.com/api` |
| Production | `www.crossmint.com/console` | `www.crossmint.com/api` |

Test with staging first. CrossMint provides a faucet at `faucet.crossmint.com` for testnet tokens (USDXM).
