# Balance After Column — Technical Plan

**Date:** February 25, 2026

## Objective

Add a `balance_after` column to every transaction/checkout table across all rails. When a transaction is created, store the wallet's current balance at that moment — no calculations, just record what the balance is. Display it as a "Balance" column in all Activity/ledger views.

---

## Why This Is Simple

- No historical data to backfill — all tables are empty or near-empty
- No math required — at the time of insert, the wallet balance is already known
- For reconciliation: you just read the on-chain balance — that's the `balance_after`
- For deposits: you just credited the wallet — the new balance is right there
- For payments: you just debited — same thing
- One extra field on each insert call, that's it

---

## Schema Changes

Add a nullable `balance_after` column to each transaction table. Nullable so existing rows (if any) don't break.

### 1. `transactions` (Rail 0 — Stripe fiat)
```typescript
balanceAfter: integer("balance_after"),  // cents
```

### 2. `privy_transactions` (Rail 1 — Stripe/Privy USDC)
```typescript
balanceAfter: bigint("balance_after", { mode: "number" }),  // micro-USDC
```

### 3. `crossmint_transactions` (Rail 2 — CrossMint USDC)
```typescript
balanceAfter: bigint("balance_after", { mode: "number" }),  // micro-USDC
```

### 4. `rail5_checkouts` (Rail 5 — Sub-Agent Cards)
```typescript
balanceAfter: integer("balance_after"),  // cents
```

**SQL migration** (run once):
```sql
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS balance_after INTEGER;
ALTER TABLE privy_transactions ADD COLUMN IF NOT EXISTS balance_after BIGINT;
ALTER TABLE crossmint_transactions ADD COLUMN IF NOT EXISTS balance_after BIGINT;
ALTER TABLE rail5_checkouts ADD COLUMN IF NOT EXISTS balance_after INTEGER;
```

---

## Transaction Creation Points (Where to Add `balanceAfter`)

Every place that inserts a transaction needs to include the wallet's current balance. Here's every call site:

### Rail 0 (`createTransaction`)
| File | Context | Balance source |
|------|---------|---------------|
| `app/api/v1/wallet/fund/route.ts` | Stripe fiat deposit | Wallet balance after crediting |
| `app/api/v1/webhooks/stripe/route.ts` | Stripe webhook deposit | Wallet balance after crediting |
| `app/api/v1/bot/merchant/checkout/route.ts` | Bot merchant purchase | Wallet balance after debiting |
| `app/api/v1/rail4/confirm/[confirmationId]/route.ts` | Rail 4 card confirmation | Wallet balance after debiting |
| `app/api/v1/bot/rail5/confirm/route.ts` | Rail 5 checkout confirm | Wallet balance after debiting |

### Rail 1 (`privyCreateTransaction`)
| File | Context | Balance source |
|------|---------|---------------|
| `app/api/v1/stripe-wallet/webhooks/stripe/route.ts` | Onramp deposit webhook | `targetWallet.balanceUsdc + amountUsdc` (new balance) |
| `app/api/v1/stripe-wallet/bot/sign/route.ts` (3 calls) | x402 payment / approval | Wallet balance after debit |
| `app/api/v1/stripe-wallet/balance/sync/route.ts` | Reconciliation | `onChainBalance` (the value just read from chain) |

### Rail 2 (`crossmintCreateTransaction`)
| File | Context | Balance source |
|------|---------|---------------|
| `app/api/v1/card-wallet/bot/purchase/route.ts` | Bot purchase | Wallet balance after debiting |

### Rail 5 (`rail5Checkouts` insert)
| File | Context | Balance source |
|------|---------|---------------|
| `server/storage.ts` (rail5CreateCheckout) | Checkout creation | Card balance at time of checkout |

---

## Frontend Changes

Add a "Balance" column to every Activity/ledger table. Same pattern everywhere:

- Column header: `BALANCE`
- Cell value: Format `balance_after` using the same currency formatter as the Amount column
- If `balance_after` is null (legacy rows): show "—"

### Files to modify:
| File | Ledger |
|------|--------|
| `app/app/stripe-wallet/page.tsx` | Rail 1 Activity tab |
| `app/app/card-wallet/page.tsx` | Rail 2 Activity tab (if exists) |
| `app/app/transactions/page.tsx` | Global transactions page (if exists) |

---

## Files Summary

| File | Action |
|------|--------|
| `shared/schema.ts` | Add `balanceAfter` to 4 tables |
| `server/storage.ts` | No changes — `balanceAfter` is part of the insert type |
| `app/api/v1/wallet/fund/route.ts` | Add `balanceAfter` to insert |
| `app/api/v1/webhooks/stripe/route.ts` | Add `balanceAfter` to insert |
| `app/api/v1/bot/merchant/checkout/route.ts` | Add `balanceAfter` to insert |
| `app/api/v1/rail4/confirm/[confirmationId]/route.ts` | Add `balanceAfter` to insert |
| `app/api/v1/bot/rail5/confirm/route.ts` | Add `balanceAfter` to insert |
| `app/api/v1/stripe-wallet/webhooks/stripe/route.ts` | Add `balanceAfter` to insert |
| `app/api/v1/stripe-wallet/bot/sign/route.ts` | Add `balanceAfter` to 3 inserts |
| `app/api/v1/stripe-wallet/balance/sync/route.ts` | Add `balanceAfter` to insert |
| `app/api/v1/card-wallet/bot/purchase/route.ts` | Add `balanceAfter` to insert |
| `app/app/stripe-wallet/page.tsx` | Add Balance column to ledger |
| Additional frontend pages | Add Balance column (check which exist) |

## No Dependencies / No Env Vars

No new packages. No new environment variables. Just schema + insert updates + UI column.
