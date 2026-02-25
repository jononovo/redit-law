# Rail 2: CrossMint On-Chain Balance Sync — Technical Plan

**Date:** February 25, 2026

## Objective

Add on-demand on-chain balance verification for CrossMint wallets, identical to the existing Rail 1 (Privy) balance sync. User clicks a refresh icon (↻) on their Card Wallet card, the backend reads the real USDC balance from Base chain, updates the local DB if it differs, records a `reconciliation` transaction for any delta, and returns the current balance.

---

## Context: What Already Exists

### Rail 1 (Privy) — Already Implemented ✅
- `lib/stripe-wallet/balance.ts` — reads on-chain USDC balance via `viem`
- `app/api/v1/stripe-wallet/balance/sync/route.ts` — sync endpoint with 30-second cooldown, reconciliation transactions
- `privy_wallets.last_synced_at` column — cooldown tracking
- `storage.privyUpdateWalletBalanceAndSync()` — sets balance + sync timestamp
- `storage.privyUpdateWalletSyncedAt()` — sets sync timestamp only
- Frontend ↻ button on Stripe Wallet page with spin animation, cooldown, toast feedback

### Rail 2 (CrossMint) — Current State
- `crossmint_wallets` table exists with `balance_usdc` column (bigint, micro-USDC)
- **No `last_synced_at` column** on `crossmint_wallets`
- `lib/card-wallet/server.ts` has `getWalletBalance()` that queries CrossMint API (`/wallets/{locator}/balances?tokens=usdc&chains=base`)
- `app/api/v1/card-wallet/balance/route.ts` already queries CrossMint API on each call but does NOT record reconciliation transactions for discrepancies
- **No dedicated sync endpoint** — the existing balance route just overwrites silently
- **No ↻ button** on the Card Wallet dashboard
- `storage.crossmintUpdateWalletBalance()` exists but no `crossmintUpdateWalletBalanceAndSync()` or `crossmintUpdateWalletSyncedAt()`

### Key Architectural Decision: Two Balance Sources

Rail 2 has **two ways** to get the current balance:

1. **CrossMint API** — `GET /wallets/{locator}/balances?tokens=usdc&chains=base` (already in `lib/card-wallet/server.ts`)
2. **On-chain via viem** — `USDC.balanceOf(address)` on Base RPC (same function used by Rail 1: `lib/stripe-wallet/balance.ts`)

**Use on-chain (viem)** for the sync endpoint. It's the same source of truth as Rail 1, avoids a CrossMint API dependency for a simple balance check, and the function already exists. The CrossMint API balance endpoint can remain as-is for the `/card-wallet/balance` route (backward compatible).

---

## Phases

---

### Phase 1: Schema — Add `last_synced_at` to `crossmint_wallets`

**File:** `shared/schema.ts`

**What to do:** Add a nullable `lastSyncedAt` column to the `crossmintWallets` table definition, identical to `privy_wallets`.

**Find this block in `shared/schema.ts`:**
```typescript
export const crossmintWallets = pgTable("crossmint_wallets", {
  id: serial("id").primaryKey(),
  botId: text("bot_id").notNull(),
  ownerUid: text("owner_uid").notNull(),
  crossmintWalletId: text("crossmint_wallet_id").notNull(),
  address: text("address").notNull(),
  balanceUsdc: bigint("balance_usdc", { mode: "number" }).notNull().default(0),
  chain: text("chain").notNull().default("base"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
```

**Add this line after `updatedAt`:**
```typescript
  lastSyncedAt: timestamp("last_synced_at"),
```

**Run the SQL migration:**
```sql
ALTER TABLE crossmint_wallets ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP;
```

---

### Phase 2: Storage Methods — Add Sync Helpers

**File:** `server/storage.ts`

**What to do:** Add two new storage methods, mirroring the Privy equivalents exactly. Also add interface declarations.

#### 2a. Add to the storage interface (find the `// ─── Rail 2` section):

```typescript
crossmintUpdateWalletBalanceAndSync(id: number, balanceUsdc: number): Promise<CrossmintWallet | null>;
crossmintUpdateWalletSyncedAt(id: number): Promise<void>;
```

#### 2b. Verify `crossmintGetWalletById` exists:

The sync endpoint calls `storage.crossmintGetWalletById(id)`. **Check if this method exists** — the codebase may only have `crossmintGetWalletByBotId`. If it doesn't exist, add it:

```typescript
async crossmintGetWalletById(id: number): Promise<CrossmintWallet | null> {
  const [wallet] = await db
    .select()
    .from(crossmintWallets)
    .where(eq(crossmintWallets.id, id));
  return wallet || null;
},
```

Also add the interface declaration alongside the other CrossMint methods:
```typescript
crossmintGetWalletById(id: number): Promise<CrossmintWallet | null>;
```

#### 2c. Add sync helper implementations (find the existing `crossmintUpdateWalletBalance` method and add after it):

**Reference — here is the existing Privy implementation to mirror:**
```typescript
// This is what already exists for Privy — copy this pattern exactly for CrossMint:

async privyUpdateWalletBalanceAndSync(id: number, balanceUsdc: number): Promise<PrivyWallet | null> {
  const [updated] = await db
    .update(privyWallets)
    .set({ balanceUsdc, lastSyncedAt: new Date(), updatedAt: new Date() })
    .where(eq(privyWallets.id, id))
    .returning();
  return updated || null;
},

async privyUpdateWalletSyncedAt(id: number): Promise<void> {
  await db
    .update(privyWallets)
    .set({ lastSyncedAt: new Date() })
    .where(eq(privyWallets.id, id));
},
```

**New CrossMint implementations:**
```typescript
async crossmintUpdateWalletBalanceAndSync(id: number, balanceUsdc: number): Promise<CrossmintWallet | null> {
  const [updated] = await db
    .update(crossmintWallets)
    .set({ balanceUsdc, lastSyncedAt: new Date(), updatedAt: new Date() })
    .where(eq(crossmintWallets.id, id))
    .returning();
  return updated || null;
},

async crossmintUpdateWalletSyncedAt(id: number): Promise<void> {
  await db
    .update(crossmintWallets)
    .set({ lastSyncedAt: new Date() })
    .where(eq(crossmintWallets.id, id));
},
```

---

### Phase 3: API Endpoint — Balance Sync Route

**File:** `app/api/v1/card-wallet/balance/sync/route.ts` (CREATE NEW)

**What to do:** Create a new sync endpoint that mirrors `app/api/v1/stripe-wallet/balance/sync/route.ts` exactly, but uses CrossMint storage methods and table.

**Critical detail:** Reuse `getOnChainUsdcBalance` from `lib/stripe-wallet/balance.ts`. Both Rail 1 and Rail 2 wallets are on Base chain with the same USDC contract. Do NOT create a duplicate function. Just import the existing one.

**Here is the complete implementation — model it after the existing Privy sync route:**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";
import { microUsdcToUsd } from "@/lib/card-wallet/server";
import { getOnChainUsdcBalance } from "@/lib/stripe-wallet/balance";
import { isAddress } from "viem";

const SYNC_COOLDOWN_MS = 30 * 1000; // 30 seconds — matches Rail 1

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const walletId = body.wallet_id;
    if (!walletId) {
      return NextResponse.json({ error: "wallet_id is required" }, { status: 400 });
    }

    // Use CrossMint storage method (not Privy)
    const wallet = await storage.crossmintGetWalletById(Number(walletId));
    if (!wallet || wallet.ownerUid !== user.uid) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }

    // Cooldown check — identical logic to Rail 1
    if (wallet.lastSyncedAt) {
      const elapsed = Date.now() - new Date(wallet.lastSyncedAt).getTime();
      if (elapsed < SYNC_COOLDOWN_MS) {
        const retryAfter = Math.ceil((SYNC_COOLDOWN_MS - elapsed) / 1000);
        return NextResponse.json(
          { error: "Please wait before syncing again", retry_after: retryAfter },
          { status: 429 }
        );
      }
    }

    if (!isAddress(wallet.address)) {
      console.error("[Card Wallet Balance Sync] Invalid wallet address:", wallet.address);
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    // Set synced_at immediately (even if RPC fails, prevents rapid retries)
    await storage.crossmintUpdateWalletSyncedAt(wallet.id);

    // Read on-chain balance — REUSES the same function as Rail 1
    let onChainBalance: number;
    try {
      onChainBalance = await getOnChainUsdcBalance(wallet.address);
    } catch (rpcError) {
      console.error("[Card Wallet Balance Sync] RPC call failed:", rpcError);
      return NextResponse.json(
        { error: "Could not reach blockchain. Try again later." },
        { status: 502 }
      );
    }

    const previousBalance = wallet.balanceUsdc;
    const delta = onChainBalance - previousBalance;
    const changed = delta !== 0;

    if (changed) {
      // Update balance + sync timestamp in one call
      await storage.crossmintUpdateWalletBalanceAndSync(wallet.id, onChainBalance);

      // Record reconciliation transaction — uses CrossMint storage
      // quantity defaults to 1, commerce fields (productLocator, shippingAddress, etc.) are all nullable
      await storage.crossmintCreateTransaction({
        walletId: wallet.id,
        type: "reconciliation",
        amountUsdc: Math.abs(delta),
        status: "confirmed",
        metadata: {
          source: "on_chain_sync",
          direction: delta > 0 ? "increase" : "decrease",
          previous_balance: previousBalance,
          new_balance: onChainBalance,
        },
      });

      console.log("[Card Wallet Balance Sync] Reconciliation recorded:", {
        walletId: wallet.id,
        previousBalance,
        onChainBalance,
        delta,
      });
    }

    return NextResponse.json({
      balance_usdc: onChainBalance,
      balance_display: `$${(onChainBalance / 1_000_000).toFixed(2)}`,
      previous_balance: previousBalance,
      changed,
    });
  } catch (error) {
    console.error("POST /api/v1/card-wallet/balance/sync error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
```

**⚠️ NOTE — `crossmintCreateTransaction` fields:**

The `crossmint_transactions` table has commerce-specific columns (`quantity`, `orderStatus`, `productLocator`, `productName`, `shippingAddress`, `trackingInfo`, `crossmintOrderId`). For reconciliation transactions: `quantity` has `.default(1)` in schema so it can be omitted. All commerce fields are nullable and default to null. The call above is intentionally minimal — only the fields that matter for reconciliation.

The `type` field should be `"reconciliation"` — this is a new transaction type for Rail 2 (joining `purchase`, `deposit`, `refund`). Since `type` is a `text` column with no enum constraint, no schema change is needed.

---

### Phase 4: Frontend — Add ↻ Button to Card Wallet Dashboard

**File:** `app/app/card-wallet/page.tsx`

**What to do:** Add the same refresh icon pattern used in `app/app/stripe-wallet/page.tsx`. The UI behavior is identical.

#### 4a. Add state variables (at the top of the component, alongside existing state):

```typescript
const [syncingWalletId, setSyncingWalletId] = useState<number | null>(null);
const [cooldowns, setCooldowns] = useState<Record<number, number>>({});
```

#### 4b. Add the sync handler function:

```typescript
async function handleSyncBalance(wallet: WalletInfo) {
  // Client-side cooldown check
  const lastSync = cooldowns[wallet.id];
  if (lastSync && Date.now() - lastSync < 30 * 1000) {
    toast({
      title: "Please wait",
      description: "Try again in a few seconds.",
    });
    return;
  }

  setSyncingWalletId(wallet.id);

  try {
    const res = await authFetch("/api/v1/card-wallet/balance/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet_id: wallet.id }),
    });

    if (res.status === 429) {
      toast({
        title: "Please wait",
        description: "Try again in a few seconds.",
      });
      return;
    }

    if (!res.ok) {
      toast({
        title: "Sync failed",
        description: "Could not check balance. Try again later.",
        variant: "destructive",
      });
      return;
    }

    const data = await res.json();
    setCooldowns((prev) => ({ ...prev, [wallet.id]: Date.now() }));

    if (data.changed) {
      toast({
        title: "Balance updated",
        description: `Balance updated to ${data.balance_display}`,
      });
    } else {
      toast({
        title: "Up to date",
        description: "Balance confirmed — no changes.",
      });
    }

    // Refresh wallet list to show new balance
    fetchWallets();
  } catch {
    toast({
      title: "Error",
      description: "Something went wrong.",
      variant: "destructive",
    });
  } finally {
    setSyncingWalletId(null);
  }
}
```

#### 4c. Add the ↻ icon to each wallet card:

Find where the wallet balance is displayed on the card. Add a `RefreshCw` icon next to it. Import from lucide-react:

```typescript
import { RefreshCw } from "lucide-react";
```

Place it near the balance display (same position as in the Stripe Wallet page):

```tsx
<button
  onClick={() => handleSyncBalance(wallet)}
  disabled={syncingWalletId === wallet.id}
  className="ml-2 p-1 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
  title="Sync on-chain balance"
>
  <RefreshCw
    className={`w-3.5 h-3.5 text-white/60 ${
      syncingWalletId === wallet.id ? "animate-spin" : ""
    }`}
  />
</button>
```

**Look at the existing Stripe Wallet page** (`app/app/stripe-wallet/page.tsx`) for the exact placement pattern and copy it. The wallet card structure may differ slightly between Rail 1 and Rail 2, but the icon placement should be analogous — near the balance amount, below or beside "USDC on Base".

---

## Files Summary

| File | Action | Phase |
|------|--------|-------|
| `shared/schema.ts` | Add `lastSyncedAt` to `crossmintWallets` | 1 |
| SQL migration | `ALTER TABLE crossmint_wallets ADD COLUMN ...` | 1 |
| `server/storage.ts` | Add `crossmintGetWalletById` (if missing) + `crossmintUpdateWalletBalanceAndSync` + `crossmintUpdateWalletSyncedAt` to interface and implementation | 2 |
| `app/api/v1/card-wallet/balance/sync/route.ts` | CREATE — new sync endpoint | 3 |
| `app/app/card-wallet/page.tsx` | Add ↻ button with spin, cooldown, toast | 4 |

## Dependencies

**None new.** `viem` is already installed (used by Rail 1). `getOnChainUsdcBalance` is already in `lib/stripe-wallet/balance.ts`. No new packages, no new env vars.

## Verification

After implementation, test:
1. Click ↻ on a Card Wallet card → should show "Balance confirmed" or "Balance updated" toast
2. Click ↻ again immediately → should show cooldown toast (client-side check)
3. Wait 30 seconds, click again → should work
4. Send USDC directly to the CrossMint wallet address from an external wallet → click ↻ → balance should update and a `reconciliation` transaction should appear in the ledger
5. Check `crossmint_transactions` table for the reconciliation row with correct metadata
