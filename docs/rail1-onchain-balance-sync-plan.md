# Rail 1: On-Chain Balance Sync — Technical Plan

**Date:** February 25, 2026

## Objective

Add the ability to check the actual USDC balance of a Privy wallet directly from the Base blockchain. This provides a source-of-truth balance that catches funds received from any source — not just Stripe Onramp deposits.

The user triggers this via a refresh icon on each wallet card in the dashboard.

---

## Architecture

```
User clicks refresh icon on wallet card
  → Frontend: POST /api/v1/stripe-wallet/balance/sync { wallet_id }
  → Backend: Call Base RPC balanceOf(walletAddress) on USDC contract
  → Compare on-chain balance with stored balance_usdc
  → If different: update privy_wallets.balance_usdc, log a reconciliation transaction
  → Return updated balance to frontend
  → UI updates the card with the new balance
```

---

## Implementation

### 1. New lib file: `lib/stripe-wallet/balance.ts`

Create a utility to query the USDC balance on Base using `viem`.

- Use `viem` with the public Base RPC (`https://mainnet.base.org`)
- Call `balanceOf(address)` on the USDC contract (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- Return the balance as a number in micro-USDC (6 decimals), matching the `balance_usdc` column format
- No API key required — Base has a free public RPC

```typescript
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'

const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const ERC20_ABI = [{
  name: 'balanceOf',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }]
}] as const

export async function getOnChainUsdcBalance(walletAddress: string): Promise<number> {
  const client = createPublicClient({ chain: base, transport: http() })
  const balance = await client.readContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [walletAddress as `0x${string}`]
  })
  return Number(balance)
}
```

### 2. New API endpoint: `app/api/v1/stripe-wallet/balance/sync/route.ts`

- Method: POST
- Auth: Firebase session cookie (owner only)
- Body: `{ wallet_id: number }`
- Logic:
  1. Authenticate owner, verify wallet ownership
  2. Call `getOnChainUsdcBalance(wallet.address)`
  3. If on-chain balance differs from stored `balance_usdc`:
     - Update `privy_wallets.balance_usdc` to the on-chain value
     - If balance increased, create a transaction of type `deposit` with status `confirmed` and metadata `{ source: "on_chain_sync" }`
     - If balance decreased (e.g., an on-chain spend we missed), create a transaction of type `x402_payment` with metadata `{ source: "on_chain_sync" }`
  4. Return the updated balance and whether it changed

### 3. Frontend: Add refresh icon to wallet card

- File: `app/app/stripe-wallet/page.tsx`
- Add a `RefreshCw` icon (from lucide-react) next to the balance display
- On click: call `POST /api/v1/stripe-wallet/balance/sync` with the wallet ID
- Show a spinning animation while the request is in flight
- Update the wallet's `balance_display` in state when the response comes back
- Show a brief toast indicating whether the balance changed or was already in sync

---

## Dependencies

- `viem` — Ethereum client library for Base RPC calls (needs to be installed)
- No API key needed — uses the free public Base RPC

## Files to Create/Modify

| File | Action |
|------|--------|
| `lib/stripe-wallet/balance.ts` | Create — on-chain balance query |
| `app/api/v1/stripe-wallet/balance/sync/route.ts` | Create — sync endpoint |
| `app/app/stripe-wallet/page.tsx` | Modify — add refresh icon to wallet card |

## Not in Scope (Future)

- Periodic background sync / cron job
- WebSocket or event-driven on-chain monitoring
- Multi-token balance support (only USDC for now)
