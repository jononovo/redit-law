# Crypto Onramp & Procurement — Modularization Plan

**Date:** February 27, 2026  
**Status:** Verified against codebase — all import chains checked  
**Scope:** Extract onramp and commerce into standalone feature modules, decoupled from any specific wallet rail.

---

## The Problem

Funding and spending capabilities are currently embedded inside rail-specific code:

- **Stripe Onramp** lives in `lib/rail1/onramp.ts` (backend), inline in `app/app/stripe-wallet/page.tsx` (~130 lines of frontend), and `app/api/v1/stripe-wallet/webhooks/stripe/route.ts` (webhook). Only Rail 1 can use it.
- **CrossMint WorldStore** (Orders API for Amazon/Shopify purchases) lives in `lib/rail2/orders/purchase.ts` and is wired only to Rail 2 wallets. Only Rail 2 can shop.
- **CrossMint "onramp"** (buying USDC tokens via their Orders API checkout flow) lives in `lib/rail2/orders/onramp.ts`. Not currently enabled/functional.

This coupling is wrong. Both Privy (Rail 1) and CrossMint (Rail 2) wallets are 0x addresses on Base holding USDC at the same contract (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`). The funding method and the spending method shouldn't care which wallet provider created the address.

---

## The Vision

Two standalone feature modules that work with **any** USDC wallet on Base:

```
lib/crypto-onramp/          ← "How do I put money IN?"
lib/procurement/             ← "How do I spend money on products?"
```

A wallet is just an address + a balance. The onramp delivers USDC to an address. The procurement engine spends USDC from an address. Neither needs to know whether Privy or CrossMint manages the keys.

Future procurement providers (direct merchant APIs, browser-based checkout agents, other shopping platforms) slot in alongside CrossMint WorldStore as siblings.

---

## Phase 1: Crypto Onramp Module (immediate)

### Structure

```
lib/crypto-onramp/
  types.ts                          ← Shared types: OnrampProvider, OnrampSessionResult, OnrampWebhookEvent, WalletTarget
  stripe-onramp/
    session.ts                      ← createStripeOnrampSession() — moved from lib/rail1/onramp.ts
    webhook.ts                      ← handleStripeOnrampWebhook() — logic extracted from stripe webhook route
    types.ts                        ← Stripe-specific types (session shape, event payload)
  crossmint-onramp/                 ← placeholder — not built now
    README.md                       ← "CrossMint onramp not currently enabled. See lib/rail2/orders/onramp.ts for the existing implementation using their Orders API checkout flow."
  components/
    stripe-onramp-sheet.tsx         ← Sheet + embedded Stripe widget + script loader + close-confirm dialog
    use-stripe-onramp.ts            ← Hook: session creation, open/close state, widget mounting, event listeners
```

### Current import chain (verified)

| Consumer | Current import | New import |
|---|---|---|
| `app/api/v1/stripe-wallet/onramp/session/route.ts` | `import { createOnrampSession } from "@/lib/rail1/onramp"` | `import { createStripeOnrampSession } from "@/lib/crypto-onramp/stripe-onramp/session"` |
| `lib/rail1/onramp.ts` (re-export shim) | — | `export { createStripeOnrampSession as createOnrampSession } from "@/lib/crypto-onramp/stripe-onramp/session"` |

No other files import from `lib/rail1/onramp.ts`. Single consumer = clean move.

### What moves where

| Current Location | New Location | Notes |
|---|---|---|
| `lib/rail1/onramp.ts` → `createOnrampSession()` | `lib/crypto-onramp/stripe-onramp/session.ts` → `createStripeOnrampSession()` | Already wallet-agnostic. Takes `walletAddress` string. No changes to function logic. |
| Webhook logic in `app/api/v1/stripe-wallet/webhooks/stripe/route.ts` | `lib/crypto-onramp/stripe-onramp/webhook.ts` → `handleStripeOnrampWebhook()` | **⚠️ HIGHEST-RISK CHANGE.** Extract the `fulfillment_complete` handler. Must look up wallet address across BOTH `privy_wallets` and `crossmint_wallets`. A bug here = lost deposits. |
| ~130 lines inline in `app/app/stripe-wallet/page.tsx` (handleOpenOnramp, loadScript, onramp dialog JSX, close handler, session ref) | `lib/crypto-onramp/components/stripe-onramp-sheet.tsx` + `use-stripe-onramp.ts` | Component accepts `{ walletId, walletAddress, apiEndpoint, onFundingComplete }`. Hook manages all state. |

### What stays in place (thin wrappers)

| File | Role | Changes |
|---|---|---|
| `app/api/v1/stripe-wallet/onramp/session/route.ts` | Stays. Looks up Privy wallet, calls `createStripeOnrampSession()`. | Import path changes only. |
| `app/api/v1/stripe-wallet/webhooks/stripe/route.ts` | Stays. Verifies Stripe signature, delegates to `handleStripeOnrampWebhook()`. | Extracts handler logic to new file. |
| `app/app/stripe-wallet/page.tsx` | Stays. | Replaces ~130 lines of inline onramp code with `<StripeOnrampSheet>` + `useStripeOnramp()`. |
| `lib/rail1/onramp.ts` | Becomes a re-export shim. | One-line re-export for backward compat. |

### New files for Rail 2 integration

| File | What |
|---|---|
| `app/api/v1/card-wallet/onramp/stripe-session/route.ts` | **New.** Looks up CrossMint wallet by ID, verifies ownership, calls same `createStripeOnrampSession({ walletAddress: crossmintWallet.address, ... })`. Returns `client_secret` + `redirect_url`. |
| `app/app/card-wallet/page.tsx` | **Modified.** Add "Fund with Stripe" button alongside existing CrossMint fund option. Uses same `<StripeOnrampSheet>` component with `apiEndpoint="/api/v1/card-wallet/onramp/stripe-session"`. |

### Webhook multi-rail wallet lookup (the critical change)

Current behavior in webhook handler:
```ts
const targetWallet = await storage.privyGetWalletByAddress(walletAddress);
// If not found → silently drops the deposit
```

New behavior in `handleStripeOnrampWebhook()`:
```ts
// Try Privy first (most common case)
let targetWallet = await storage.privyGetWalletByAddress(walletAddress);
let rail: "rail1" | "rail2" = "rail1";

if (!targetWallet) {
  // Try CrossMint
  const cmWallet = await storage.crossmintGetWalletByAddress(walletAddress);
  if (cmWallet) {
    targetWallet = cmWallet;
    rail = "rail2";
  }
}

if (!targetWallet) {
  console.error("[Onramp Webhook] Wallet not found in any rail:", walletAddress);
  return; // Still log, but don't crash
}

// Credit the correct table based on rail
if (rail === "rail1") {
  await storage.privyCreditWallet(targetWallet.id, amountUsdc);
  await storage.privyCreateTransaction({ ... });
} else {
  await storage.crossmintCreditWallet(targetWallet.id, amountUsdc);
  await storage.crossmintCreateTransaction({ ... });
}
```

**Testing requirement:** Must verify that a Stripe onramp deposit to a CrossMint wallet address correctly credits `crossmint_wallets.balance_usdc` and creates a `crossmint_transactions` record of type `deposit`.

### Key design decisions

1. **`WalletTarget` type** — unifies what the onramp needs:
   ```ts
   type WalletTarget = {
     address: string;        // 0x address on Base
     rail: "rail1" | "rail2";
     walletId: number;
     ownerUid: string;
   }
   ```

2. **Hook accepts config, not hardcoded endpoints:**
   ```ts
   useStripeOnramp({
     apiEndpoint: string;            // "/api/v1/stripe-wallet/onramp/session" or "/api/v1/card-wallet/onramp/stripe-session"
     onFundingComplete: () => void;  // Caller refreshes their own wallet list
   })
   ```

3. **Existing CrossMint onramp stays untouched.** `lib/rail2/orders/onramp.ts` and `app/api/v1/card-wallet/onramp/session/route.ts` are not modified. The CrossMint onramp can optionally remain as a secondary button on Rail 2 if/when enabled.

4. **Existing Rail 2 onramp route has no collision.** The new Stripe route goes to `/card-wallet/onramp/stripe-session/` — separate from the existing `/card-wallet/onramp/session/` (CrossMint).

### Backward compatibility

- `lib/rail1/onramp.ts` becomes a re-export: `export { createStripeOnrampSession as createOnrampSession } from "@/lib/crypto-onramp/stripe-onramp/session"` — existing import in the route file continues to work.
- All API route paths unchanged. No external consumers affected.
- Rail 1 behavior is identical. The only visible change is Rail 2 gaining a "Fund with Stripe" button.

### Environment variables

No new env vars. Both rails use the same Stripe keys:
- `STRIPE_SECRET_KEY` — session creation
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — embedded widget
- `STRIPE_WEBHOOK_SECRET_ONRAMP` — webhook verification

---

## Phase 2: Procurement Module (next)

### Reasoning

The CrossMint Orders API for shopping (Amazon, Shopify, URL purchases) is currently wired only to Rail 2. But a Privy wallet holds the same USDC on Base. CrossMint WorldStore is also just one way to buy things — in the future there will be other procurement providers (direct merchant APIs, browser-based checkout agents, other shopping platforms).

The module should be named `procurement/` (not `commerce/`) to reflect that this is about acquiring goods and services on behalf of bots. CrossMint WorldStore is the first provider.

### Structure

```
lib/procurement/
  types.ts                              ← Shared types: PurchaseRequest, OrderStatus, ShippingAddress, Merchant, ProductLocator, ProcurementProvider
  crossmint-worldstore/
    purchase.ts                         ← createPurchaseOrder() — moved from lib/rail2/orders/purchase.ts
    status.ts                           ← getOrderStatus() — moved from lib/rail2/orders/purchase.ts
    search.ts                           ← searchProducts() — Shopify variant search via CrossMint WS Search API
    webhook.ts                          ← handleOrderWebhook() — CrossMint order lifecycle events (shipped, delivered, failed)
    client.ts                           ← CrossMint Orders API client (may reuse lib/rail2/client.ts or extract the orders-specific parts)
    types.ts                            ← CrossMint-specific types (order shape, webhook event payload, locator formats)
  components/
    order-timeline.tsx                  ← Order status timeline UI (currently inline in card-wallet page)
    order-detail-dialog.tsx             ← Order detail dialog UI
```

### Current import chain (verified — 5 consumers)

| Consumer | Current import | Impact |
|---|---|---|
| `lib/approvals/rail2-fulfillment.ts` | `import { createPurchaseOrder } from "@/lib/rail2/orders/purchase"` | Import path changes |
| `app/api/v1/card-wallet/approvals/decide/route.ts` | `const { createPurchaseOrder } = await import("@/lib/rail2/orders/purchase")` | Dynamic import path changes |
| `app/api/v1/card-wallet/orders/[order_id]/route.ts` | `import { getOrderStatus } from "@/lib/rail2/orders/purchase"` | Import path changes |
| `app/api/v1/card-wallet/webhooks/crossmint/route.ts` | Uses order status types/logic | Import path changes |
| `app/api/v1/card-wallet/bot/search/route.ts` | Shopify search | Import path changes |

All 5 consumers get re-export shims at the old paths OR updated imports. No functional changes.

### What this enables (future)

- Rail 1 wallets gain shopping capability — bots with Privy wallets can buy on Amazon/Shopify.
- New procurement providers slot in as siblings: `lib/procurement/browser-checkout/`, `lib/procurement/direct-merchant/`, etc.
- The approval + fulfillment flow becomes procurement-provider-agnostic.

### Open technical question (must answer before building)

**Can CrossMint's Orders API accept a non-CrossMint wallet as `payerAddress`?**

Currently the purchase order uses `payment: { method: "crypto", currency: "usdc", payerAddress: walletAddress }` — CrossMint auto-debits from its custodial wallet. For a Privy wallet, CrossMint can't auto-debit. This might require:
- A signed EIP-712 transfer authorization (like x402 but for CrossMint)
- CrossMint's delegated signer flow
- A pre-transfer of USDC from Privy wallet → CrossMint escrow, then order placement

**This is the gate.** If the answer is "no, only CrossMint wallets can be payers," then Phase 2 is about code organization only (cleaner structure, re-export shims) without the cross-rail shopping capability.

### Not in scope for Phase 2

- New database tables.
- Changing bot-facing API paths.
- Changes to guardrails or approvals (already cross-rail).

---

## Task Sequence — Phase 1 Only

| # | Task | Depends on | Risk | Files |
|---|---|---|---|---|
| 1 | Create `lib/crypto-onramp/types.ts` with shared types (`WalletTarget`, `OnrampSessionResult`, `OnrampProvider`) | — | Low | New |
| 2 | Move `createOnrampSession` → `lib/crypto-onramp/stripe-onramp/session.ts` as `createStripeOnrampSession`. Add re-export shim at `lib/rail1/onramp.ts`. | — | Low | Move + shim |
| 3 | Extract webhook handler → `lib/crypto-onramp/stripe-onramp/webhook.ts` with multi-rail wallet lookup. Update webhook route to delegate. | 1 | **⚠️ HIGH** — bug = lost deposits | New + modify route |
| 4 | Create `lib/crypto-onramp/components/use-stripe-onramp.ts` hook | 1 | Low | New |
| 5 | Create `lib/crypto-onramp/components/stripe-onramp-sheet.tsx` component | 4 | Low | New |
| 6 | Refactor `app/app/stripe-wallet/page.tsx` to use new component + hook | 4, 5 | Medium — visual regression risk | Modify (removes ~130 lines) |
| 7 | Create `app/api/v1/card-wallet/onramp/stripe-session/route.ts` for Rail 2 | 2 | Low | New |
| 8 | Add "Fund with Stripe" button to `app/app/card-wallet/page.tsx` using shared component | 5, 7 | Low | Modify |
| 9 | Add `crossmint-onramp/README.md` placeholder | — | None | New |
| 10 | **Verify:** Rail 1 funding still works. Rail 2 Stripe funding works. Webhook credits correct table. No build errors. | All | — | Test |

### Task 3 testing checklist (highest risk)

- [ ] Stripe onramp deposit to a **Privy** wallet address → credits `privy_wallets.balance_usdc`, creates `privy_transactions` deposit record
- [ ] Stripe onramp deposit to a **CrossMint** wallet address → credits `crossmint_wallets.balance_usdc`, creates `crossmint_transactions` deposit record
- [ ] Stripe webhook for an **unknown** address → logs error, returns 200 (doesn't crash)
- [ ] Stripe webhook signature verification still works after handler extraction
- [ ] No double-crediting if webhook fires twice for the same session
