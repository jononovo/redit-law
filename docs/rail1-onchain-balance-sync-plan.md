# Rail 1: On-Chain Balance Sync — Technical Plan v2

**Date:** February 25, 2026

## Objective

Add on-demand on-chain balance verification for Privy wallets. The user clicks a refresh icon on their wallet card, the backend reads the real USDC balance from Base, updates the local DB if it differs, records a transaction for any delta (increase or decrease), and returns the current balance.

This ensures the local ledger stays accurate regardless of how funds arrive (Stripe onramp, direct transfer, exchange withdrawal, refund) or leave (on-chain spend we didn't track).

---

## Architecture

```
User clicks ↻ on wallet card
        │
        ▼
POST /api/v1/stripe-wallet/balance/sync { wallet_id }
        │
        ├── Auth check (Firebase session, owns this wallet?)
        │
        ├── Cooldown check (last sync < 5 min ago? → 429 Too Many Requests)
        │
        ├── getOnChainUsdcBalance(wallet.address)
        │         └── viem → Base RPC → USDC.balanceOf(address)
        │
        ├── Compare on-chain balance to DB balance_usdc
        │
        ├── [if different]
        │     ├── UPDATE privy_wallets SET balance_usdc = onChainValue
        │     │
        │     ├── [if increased] INSERT privy_transactions
        │     │     type: "deposit"
        │     │     amount_usdc: delta
        │     │     status: "confirmed"
        │     │     metadata: { source: "on_chain_sync" }
        │     │
        │     └── [if decreased] INSERT privy_transactions
        │           type: "x402_payment"
        │           amount_usdc: |delta|
        │           status: "confirmed"
        │           metadata: { source: "on_chain_sync", note: "detected via balance sync" }
        │
        └── Return { balance_usdc, balance_display, previous_balance, changed }
                │
                ▼
        UI updates card balance, shows toast
```

---

## Why Store Transactions Locally (Not Query Chain On-Demand)

Industry standard for crypto wallet apps is to maintain a local transaction ledger:

- **`balanceOf` only gives the current number**, not how you got there. Getting transfer history requires scanning USDC Transfer event logs across blocks — slow, rate-limited, expensive.
- **Local records are richer than on-chain data.** The chain knows "address A sent X USDC to address B." Your DB knows "this was a Stripe onramp deposit" or "this was a bot payment for api.example.com."
- **Fast dashboard rendering.** Transaction ledger loads instantly from DB, no external calls.
- **At scale**, every user loading their wallet page would hammer the RPC if we queried on-demand.

The on-chain balance acts as the source of truth for the *current* number. The local `privy_transactions` table is the source of truth for *what happened*.

---

## Implementation

### 1. New lib file: `lib/stripe-wallet/balance.ts`

~15 lines. One function. Pure read, no side effects.

```typescript
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const

const USDC_ABI = [{
  name: 'balanceOf',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }]
}] as const

export async function getOnChainUsdcBalance(address: string): Promise<number> {
  const client = createPublicClient({
    chain: base,
    transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org'),
  })
  const raw = await client.readContract({
    address: USDC_CONTRACT,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  })
  return Number(raw) // micro-USDC (6 decimals), matches balance_usdc column
}
```

**Notes:**
- `BASE_RPC_URL` env var is optional. Public Base RPC works for low-volume on-demand calls. Add Alchemy/QuickNode for production reliability later.
- `Number(bigint)` is safe — even $1M USDC is only 1,000,000,000,000 micro-USDC, well within `Number.MAX_SAFE_INTEGER`.

### 2. New API endpoint: `app/api/v1/stripe-wallet/balance/sync/route.ts`

- **Method:** POST (has write side-effect)
- **Auth:** Firebase session cookie (owner only)
- **Body:** `{ wallet_id: number }`
- **Cooldown:** 5-minute per-wallet cooldown using `privy_wallets.updated_at`

**Logic:**

1. Authenticate owner, verify wallet ownership
2. Check cooldown: if `wallet.updated_at` is less than 5 minutes ago from a sync, return 429 with `retry_after` seconds
3. Call `getOnChainUsdcBalance(wallet.address)`
4. Compare on-chain balance to stored `balance_usdc`
5. If different:
   - Update `privy_wallets.balance_usdc` to the on-chain value (also updates `updated_at`)
   - Calculate delta: `onChainBalance - storedBalance`
   - If delta > 0 (funds came in): create `privy_transactions` record with `type: "deposit"`, `amount_usdc: delta`, `status: "confirmed"`, `metadata: { source: "on_chain_sync" }`
   - If delta < 0 (funds left): create `privy_transactions` record with `type: "x402_payment"`, `amount_usdc: |delta|`, `status: "confirmed"`, `metadata: { source: "on_chain_sync", note: "detected via balance sync" }`
6. If same: no DB writes, just confirm
7. Return `{ balance_usdc, balance_display, previous_balance, changed }`

### 3. Frontend: Refresh icon on wallet card

**File:** `app/app/stripe-wallet/page.tsx`

**UI placement:** Small `RefreshCw` icon next to the "USDC on Base" label, below the balance amount. Unobtrusive.

**State per wallet:**
- `syncingWalletId: number | null` — which wallet is currently syncing (drives spin animation)
- `cooldowns: Record<number, number>` — timestamp of last sync per wallet ID (disables button for 5 min)

**Behavior:**
- Icon shows as clickable when cooldown has expired
- On click: icon spins (`animate-spin`), button disabled
- On success with change: toast "Balance updated to $X.XX"
- On success without change: toast "Balance confirmed — up to date"
- On 429 (cooldown): toast "Please wait X minutes before refreshing again"
- On error: toast "Could not check balance. Try again later."
- After any response: stop spinning, set cooldown timestamp

---

## Files

| File | Action | Purpose |
|------|--------|---------|
| `lib/stripe-wallet/balance.ts` | Create | On-chain USDC balance query via viem |
| `app/api/v1/stripe-wallet/balance/sync/route.ts` | Create | Sync endpoint: read chain, compare, update DB, record transactions |
| `app/app/stripe-wallet/page.tsx` | Modify | Add refresh icon with spin, cooldown, toast feedback |

## Dependencies

| Package | Purpose | Notes |
|---------|---------|-------|
| `viem` | Ethereum client for Base RPC calls | Check if already installed (may be present via x402 tooling) |

## Env Vars

| Variable | Required | Purpose |
|----------|----------|---------|
| `BASE_RPC_URL` | No | Custom Base RPC URL. Falls back to `https://mainnet.base.org` |

---

## Not in Scope (Future)

- Periodic background sync / cron job
- WebSocket or event-driven on-chain monitoring (e.g., Alchemy webhooks for Transfer events)
- Multi-token balance support (only USDC for now)
- Full on-chain transaction history indexing (would require The Graph / Alchemy Token API)
