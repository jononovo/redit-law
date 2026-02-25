# Inter-Wallet USDC Transfer — Technical Plan

**Date:** February 25, 2026

## Objective

Enable USDC transfers between CreditClaw wallets and to external addresses. Three tiers, implemented in order:

1. **Tier 1 — Same-rail transfer:** Privy→Privy or CrossMint→CrossMint (between the owner's own wallets)
2. **Tier 2 — Cross-rail transfer:** Privy→CrossMint or CrossMint→Privy (between the owner's own wallets on different rails)
3. **Tier 3 — External withdrawal:** Any CreditClaw wallet → any `0x` address on Base

All three tiers are the same on-chain operation: an ERC-20 `transfer()` of USDC on Base chain. The tiers differ only in validation (is the destination the owner's own wallet? is it a known CreditClaw address?) and in how the receiving side picks up the balance change.

---

## Architecture

```
Owner clicks "Transfer" on a wallet card
        │
        ▼
POST /api/v1/wallet/transfer
  { source_wallet_id, source_rail, amount_usdc, destination }
        │
        ├── Auth check (Firebase session, owns source wallet?)
        │
        ├── Resolve destination
        │     ├── destination.wallet_id? → look up address from DB (Tier 1/2)
        │     └── destination.address? → validate as 0x address (Tier 3)
        │
        ├── Guardrail checks on SOURCE wallet
        │     ├── Wallet active?
        │     ├── Amount ≤ max_per_tx?
        │     ├── Daily/monthly budget?
        │     └── Sufficient balance?
        │
        ├── Execute on-chain transfer (rail-specific)
        │     ├── Privy source → privy.wallets().ethereum().sendTransaction()
        │     └── CrossMint source → crossmintFetch POST /wallets/{locator}/transactions
        │
        ├── Debit source wallet balance in DB
        │
        ├── [If destination is own wallet] Credit destination wallet in DB
        │     OR
        │   [If external] Let recipient handle it
        │
        ├── Log "transfer" transaction on source ledger
        ├── [If own wallet] Log "transfer" transaction on destination ledger
        │
        └── Return { tx_hash, source_balance, destination_balance? }
```

---

## How Each Rail Sends USDC On-Chain

This is the most critical section. Each rail has a different API for broadcasting transactions.

### Rail 1 (Privy) — `sendTransaction` via Node SDK

**This is a NEW capability for CreditClaw.** Currently, Rail 1 only uses `signTypedData` (for x402 authorizations that someone else submits). For transfers, we need `sendTransaction` which signs AND broadcasts.

**✅ CONFIRMED — Privy SDK & API Surface Analysis:**

CreditClaw uses the **deprecated** `@privy-io/server-auth` package (the `walletsService` pattern). Privy has two Node.js SDK packages:

| Package | Status | Constructor | Wallet API |
|---------|--------|-------------|------------|
| `@privy-io/server-auth` | **DEPRECATED** | `new PrivyClient(appId, appSecret)` | `privy.walletApi.ethereum.sendTransaction({...})` |
| `@privy-io/node` | **CURRENT** | `new PrivyClient({ appId, appSecret })` | `privy.wallets().ethereum().sendTransaction(walletId, {...})` |

**CreditClaw's current code uses the deprecated constructor pattern** (`new PrivyClient(appId, appSecret)` — positional args), which means it's on `@privy-io/server-auth`. The migration guide confirms:
- `privy.walletApi.ethereum.signMessage` → `privy.wallets().ethereum().signMessage`
- `privy.walletApi.createWallet` → `privy.wallets().create`
- The old `walletsService` pattern is even older — it predates `walletApi`

**For `sendTransaction` specifically**, the deprecated `@privy-io/server-auth` docs show:
```typescript
// @privy-io/server-auth (deprecated) — walletApi flat params:
const {hash} = await privy.walletApi.ethereum.sendTransaction({
  walletId: 'insert-wallet-id',
  caip2: 'eip155:8453',
  transaction: {
    to: usdcContractAddress,
    data: encodedData,
    chainId: 8453,
  },
});
```

The current `@privy-io/node` docs show:
```typescript
// @privy-io/node (current) — wallets() chained params:
const {hash} = await privy
  .wallets()
  .ethereum()
  .sendTransaction(walletId, {
    caip2: 'eip155:8453',
    params: {
      transaction: {
        to: usdcContractAddress,
        data: encodedData,
        chain_id: 8453,
      },
    },
    sponsor: true,
  });
```

**IMPLEMENTATION APPROACH (ordered by preference):**

1. **Try `privy.walletApi.ethereum.sendTransaction`** — this is on the deprecated `@privy-io/server-auth` that CreditClaw already has installed. It likely supports `sendTransaction` even though CreditClaw only uses `signTypedData` today. **Check:** `typeof privy.walletApi?.ethereum?.sendTransaction === 'function'`

2. **If not available, use the REST API** — works regardless of SDK version. The `getAuthorizationSignature()` function already exists in `lib/stripe-wallet/server.ts`:
```
POST https://api.privy.io/v1/wallets/{wallet_id}/rpc
Headers:
  Authorization: Basic base64(appId:appSecret)
  privy-app-id: <appId>
  privy-authorization-signature: <signature>
  Content-Type: application/json
Body: {
  "method": "eth_sendTransaction",
  "caip2": "eip155:8453",
  "chain_type": "ethereum",
  "sponsor": true,
  "params": {
    "transaction": {
      "to": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "data": "<encoded ERC-20 transfer>"
    }
  }
}
Response: {
  "method": "eth_sendTransaction",
  "data": {
    "hash": "0x...",
    "caip2": "eip155:8453",
    "transaction_id": "..."
  }
}
```

3. **Long-term: Upgrade to `@privy-io/node`** — this is a separate migration task, not blocking for transfers. When upgraded, switch all wallet calls to `privy.wallets().ethereum().*` pattern.

**REST API fallback** (works regardless of SDK version):
```
POST https://api.privy.io/v1/wallets/{wallet_id}/rpc
Headers:
  Authorization: Basic base64(appId:appSecret)
  privy-app-id: <appId>
  privy-authorization-signature: <signature>
  Content-Type: application/json
Body: {
  "method": "eth_sendTransaction",
  "caip2": "eip155:8453",
  "sponsor": true,
  "params": {
    "transaction": {
      "to": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "data": "<encoded ERC-20 transfer>"
    }
  }
}
```
The `getAuthorizationSignature()` function already exists in `lib/stripe-wallet/server.ts` and can generate the required `privy-authorization-signature` header.

**New function to add to `lib/stripe-wallet/server.ts`:**

```typescript
import { encodeFunctionData, erc20Abi } from 'viem';

const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const BASE_CAIP2 = 'eip155:8453';

export async function sendUsdcTransfer(
  privyWalletId: string,
  recipientAddress: string,
  amountMicroUsdc: number
): Promise<{ hash: string }> {
  const privy = getPrivyClient();

  // Encode the ERC-20 transfer(address,uint256) call
  const encodedData = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [
      recipientAddress as `0x${string}`,
      BigInt(amountMicroUsdc)   // already in 6-decimal micro-USDC
    ],
  });

  // ── Use walletApi.ethereum.sendTransaction (deprecated @privy-io/server-auth) ──
  // CreditClaw is on the deprecated package. This API surface should have sendTransaction.
  // If it doesn't, fall back to REST API (see implementation approach above).
  const result = await (privy as any).walletApi.ethereum.sendTransaction({
    walletId: privyWalletId,
    caip2: BASE_CAIP2,
    transaction: {
      to: USDC_CONTRACT,
      data: encodedData,
      chainId: 8453,
    },
    sponsor: true,  // Privy pays gas — requires dashboard enablement
  });

  return { hash: result.hash };
}
```

**If `walletApi.ethereum.sendTransaction` does not exist on the installed version**, use this REST fallback instead:

```typescript
export async function sendUsdcTransfer(
  privyWalletId: string,
  recipientAddress: string,
  amountMicroUsdc: number
): Promise<{ hash: string }> {
  const encodedData = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [recipientAddress as `0x${string}`, BigInt(amountMicroUsdc)],
  });

  const body = {
    method: "eth_sendTransaction",
    caip2: "eip155:8453",
    chain_type: "ethereum",
    sponsor: true,
    params: {
      transaction: {
        to: USDC_CONTRACT,
        data: encodedData,
      },
    },
  };

  const url = `https://api.privy.io/v1/wallets/${privyWalletId}/rpc`;
  const appId = getPrivyAppId();
  const appSecret = getPrivyAppSecret();
  const authSig = getAuthorizationSignature(url, body);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`,
      "privy-app-id": appId,
      "privy-authorization-signature": authSig,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to send transaction via Privy REST API");
  }

  return { hash: data.data.hash };
}
```

**✅ CONFIRMED NOTES:**

1. **Gas sponsorship requires TEE execution — but server wallets are TEE-native.** The Privy docs state "Apps must use TEE execution in order to use our native gas sponsorship feature." The TEE migration guide applies to **embedded wallets** (on-device → TEE). Server wallets already run inside TEEs by design — they "reconstitute keys in secure enclaves." So gas sponsorship with `sponsor: true` **should work for CreditClaw's server wallets** without any migration. **ACTION: Enable gas sponsorship for Base chain in the Privy dashboard** (Gas Sponsorship tab → enable → select Base).

2. **If gas sponsorship fails at runtime**, the wallet needs ~0.0001 ETH for gas on Base (fractions of a cent). This is a viable fallback but adds operational complexity of funding ETH to each wallet.

3. **`viem` is already installed** (used by `lib/stripe-wallet/balance.ts`). The `erc20Abi` export from viem includes the standard `transfer` function — no custom ABI needed.

4. **Response shape confirmed from Privy REST API docs:** `{ method: "eth_sendTransaction", data: { hash: "0x...", caip2: "eip155:8453", transaction_id: "..." } }`. The `hash` is the on-chain transaction hash — broadcast has occurred but confirmation is not guaranteed. For CreditClaw's purposes, broadcast = good enough (update DB optimistically).

### Rail 2 (CrossMint) — Dedicated Transfer Token REST API

**Major finding from research:** CrossMint has a **dedicated token transfer endpoint** that is much simpler than encoding raw ERC-20 calls. No `encodeFunctionData` needed — just POST with recipient and amount.

**Confirmed REST API endpoint:**
```
POST /api/2025-06-09/wallets/{walletLocator}/tokens/{chain}:{token}/transfers
Headers: X-API-KEY: <server-api-key>, Content-Type: application/json
Body: {
  "recipient": "0x...",
  "amount": "5.00"     // human-readable USD amount, NOT micro-USDC
}
```

**⚠️ CRITICAL — API Version Change:**
- CreditClaw currently uses API version `2022-06-09` (in `lib/card-wallet/server.ts`)
- The transfer token endpoint is under the **`2025-06-09`** API version
- This is a DIFFERENT base URL: `https://www.crossmint.com/api/2025-06-09/...`
- The implementing agent MUST either add a second helper or parameterize `crossmintFetch`

**✅ CONFIRMED — No Approval Step Needed:**
CreditClaw creates wallets with `adminSigner: { type: "evm-fireblocks-custodial" }` (see `lib/card-wallet/server.ts`). This is a fully custodial signer — Fireblocks MPC infrastructure holds and manages the signing keys. All API calls authenticate via the server API key (`X-API-KEY` header with `CROSSMINT_SERVER_API_KEY`).

CrossMint's approval flow only applies to **non-custodial signer types** (email/phone OTP, passkey biometric, external wallet signature). For custodial signers authenticated by server API key, transactions **auto-approve** — one POST = done, no extra steps.

**Evidence this auto-approves in CreditClaw's existing codebase:**
- Purchase orders (`lib/card-wallet/purchase.ts`) go through with just the API key — no approval step
- EIP-712 signing (`POST /v1-alpha2/wallets/{address}/signatures`) works with just the API key — no approval step
- The entire Rail 2 architecture was designed as custodial specifically so CreditClaw's guardrails layer sits between bot and wallet, with no CrossMint-side user challenge

**No email to the user is needed** from CrossMint's side. CreditClaw handles all user auth via Firebase independently. CrossMint never interacts with the end user.

**The `signer` field** in the transfer request body can be omitted — it defaults to the wallet's admin signer (the Fireblocks custodial signer).

**New function to add to `lib/card-wallet/server.ts`:**

```typescript
const CROSSMINT_TRANSFER_API_BASE = process.env.CROSSMINT_ENV === "staging"
  ? "https://staging.crossmint.com/api/2025-06-09"
  : "https://www.crossmint.com/api/2025-06-09";

export async function sendUsdcTransfer(
  walletAddress: string,
  recipientAddress: string,
  amountMicroUsdc: number
): Promise<{ transferId: string; txHash?: string; status: string }> {
  const locator = `evm-smart-wallet:${walletAddress}`;
  
  // CrossMint expects human-readable amount (e.g., "5.00"), NOT micro-USDC
  const amountHuman = (amountMicroUsdc / 1_000_000).toFixed(6);
  
  // Use the transfer-specific API version (2025-06-09, NOT 2022-06-09)
  const url = `${CROSSMINT_TRANSFER_API_BASE}/wallets/${encodeURIComponent(locator)}/tokens/base:usdc/transfers`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-API-KEY": getServerApiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      recipient: recipientAddress,
      amount: amountHuman,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("[CrossMint Transfer] Failed:", data);
    throw new Error(data.message || data.error || "Failed to send USDC transfer");
  }

  console.log("[CrossMint Transfer] Submitted:", {
    id: data.id,
    status: data.status,
    txHash: data.onChain?.txId || data.txHash,
  });

  // Fireblocks custodial + server API key = auto-approved, no extra steps needed.
  // The response will have status "pending" (settling on-chain) or "success".

  return {
    transferId: data.id || data.actionId,
    txHash: data.onChain?.txId || data.txHash || null,
    status: data.status || "pending",
  };
}
```

**⚠️ CRITICAL NOTES:**

1. **Amount format difference.** Privy/on-chain uses micro-USDC (6 decimal integers). CrossMint transfer API uses **human-readable decimal strings** (e.g., `"5.00"` for five dollars). The function above converts. Be extremely careful with this conversion — rounding errors could lose or create money.

2. **CrossMint transactions are asynchronous.** The API may return a transaction ID with status `pending`. The tx settles on-chain after a few seconds. For internal transfers (own wallets), optimistically update both DB balances. The balance sync (↻) button corrects any discrepancy.

3. **Gas is free.** CrossMint smart wallets handle gas abstractly. No ETH needed, no sponsorship to configure. This is simpler than the Privy side.

4. **Token locator format.** The URL path uses `base:usdc` (chain:token). For production Base mainnet USDC, this is `base:usdc`. For staging, use `base-sepolia:usdxm` (CrossMint's testnet USDC equivalent).

---

## Phases

---

### Phase 1: Transfer Lib Functions

**Files:**
- `lib/stripe-wallet/server.ts` — add `sendUsdcTransfer()` for Privy
- `lib/card-wallet/server.ts` — add `sendUsdcTransfer()` for CrossMint

**What to do:** Add the two functions shown above. These are pure infrastructure — they take a wallet ID, recipient address, and amount, and return a tx hash. No guardrails, no DB writes, no auth. Just the on-chain send.

**Test each function independently** before proceeding. Call them from a scratch route or test script with a small amount ($0.01 = 10000 micro-USDC) between two known wallets.

---

### Phase 2: Transfer API Endpoint

**File:** `app/api/v1/wallet/transfer/route.ts` (CREATE NEW)

**This is the most complex phase.** A single unified endpoint that handles all three tiers.

#### Request Schema

```typescript
const transferSchema = z.object({
  source_wallet_id: z.number().int().positive(),
  source_rail: z.enum(["privy", "crossmint"]),
  amount_usdc: z.number().int().positive(),   // micro-USDC
  destination: z.object({
    // Exactly one of these must be provided:
    wallet_id: z.number().int().positive().optional(),  // Tier 1/2: own wallet
    rail: z.enum(["privy", "crossmint"]).optional(),    // Required with wallet_id
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),  // Tier 3: external
  }).refine(
    (d) => (d.wallet_id && d.rail) || d.address,
    "Either wallet_id+rail or address is required"
  ),
});
```

#### Full Endpoint Logic

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";
import { sendUsdcTransfer as privySendUsdc } from "@/lib/stripe-wallet/server";
import { sendUsdcTransfer as crossmintSendUsdc } from "@/lib/card-wallet/server";
import { isAddress } from "viem";

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    // Validate with transferSchema (see above)

    const { source_wallet_id, source_rail, amount_usdc, destination } = body;

    // ── 1. Load and validate source wallet ──────────────────────────
    let sourceWallet: any;
    if (source_rail === "privy") {
      sourceWallet = await storage.privyGetWalletById(source_wallet_id);
    } else {
      sourceWallet = await storage.crossmintGetWalletById(source_wallet_id);
    }

    if (!sourceWallet || sourceWallet.ownerUid !== user.uid) {
      return NextResponse.json({ error: "Source wallet not found" }, { status: 404 });
    }

    if (sourceWallet.status !== "active") {
      return NextResponse.json({ error: "Source wallet is paused" }, { status: 403 });
    }

    if (sourceWallet.balanceUsdc < amount_usdc) {
      return NextResponse.json({
        error: "Insufficient balance",
        balance: sourceWallet.balanceUsdc,
        requested: amount_usdc,
      }, { status: 400 });
    }

    // ── 2. Resolve destination address ──────────────────────────────
    let destinationAddress: string;
    let destinationWallet: any = null;
    let destinationRail: string | null = null;
    let transferTier: "same_rail" | "cross_rail" | "external";

    if (destination.wallet_id && destination.rail) {
      // Tier 1 or 2: internal transfer to own wallet
      if (destination.rail === "privy") {
        destinationWallet = await storage.privyGetWalletById(destination.wallet_id);
      } else {
        destinationWallet = await storage.crossmintGetWalletById(destination.wallet_id);
      }

      if (!destinationWallet || destinationWallet.ownerUid !== user.uid) {
        return NextResponse.json({ error: "Destination wallet not found" }, { status: 404 });
      }

      destinationAddress = destinationWallet.address;
      destinationRail = destination.rail;
      transferTier = source_rail === destination.rail ? "same_rail" : "cross_rail";

      // Prevent self-transfer
      if (source_rail === destination.rail && source_wallet_id === destination.wallet_id) {
        return NextResponse.json({ error: "Cannot transfer to the same wallet" }, { status: 400 });
      }
    } else if (destination.address) {
      // Tier 3: external withdrawal
      if (!isAddress(destination.address)) {
        return NextResponse.json({ error: "Invalid destination address" }, { status: 400 });
      }
      destinationAddress = destination.address;
      transferTier = "external";
    } else {
      return NextResponse.json({ error: "Destination required" }, { status: 400 });
    }

    // ── 3. Guardrail checks on source wallet ────────────────────────
    let guardrails: any;
    let dailySpend: number;
    let monthlySpend: number;

    if (source_rail === "privy") {
      guardrails = await storage.privyGetGuardrails(source_wallet_id);
      dailySpend = await storage.privyGetDailySpend(source_wallet_id);
      monthlySpend = await storage.privyGetMonthlySpend(source_wallet_id);
    } else {
      guardrails = await storage.crossmintGetGuardrails(source_wallet_id);
      dailySpend = await storage.crossmintGetDailySpend(source_wallet_id);
      monthlySpend = await storage.crossmintGetMonthlySpend(source_wallet_id);
    }

    if (guardrails) {
      const amountUsd = amount_usdc / 1_000_000;

      if (guardrails.maxPerTxUsdc && amountUsd > guardrails.maxPerTxUsdc) {
        return NextResponse.json({
          error: "Exceeds per-transaction limit",
          limit: guardrails.maxPerTxUsdc,
          requested: amountUsd,
        }, { status: 403 });
      }

      const dailyUsd = dailySpend / 1_000_000;
      if (guardrails.dailyBudgetUsdc && (dailyUsd + amountUsd) > guardrails.dailyBudgetUsdc) {
        return NextResponse.json({ error: "Exceeds daily budget" }, { status: 403 });
      }

      const monthlyUsd = monthlySpend / 1_000_000;
      if (guardrails.monthlyBudgetUsdc && (monthlyUsd + amountUsd) > guardrails.monthlyBudgetUsdc) {
        return NextResponse.json({ error: "Exceeds monthly budget" }, { status: 403 });
      }
    }

    // ── 4. Execute on-chain transfer ────────────────────────────────
    let txHash: string;

    try {
      if (source_rail === "privy") {
        const result = await privySendUsdc(
          sourceWallet.privyWalletId,  // Privy's internal wallet ID
          destinationAddress,
          amount_usdc
        );
        txHash = result.hash;
      } else {
        const result = await crossmintSendUsdc(
          sourceWallet.address,
          destinationAddress,
          amount_usdc
        );
        // CrossMint may not return txHash immediately (async)
        txHash = result.txHash || `pending:${result.actionId}`;
      }
    } catch (sendError: any) {
      console.error("[Transfer] On-chain send failed:", sendError);
      return NextResponse.json({
        error: "Transfer failed",
        details: sendError.message,
      }, { status: 502 });
    }

    // ── 5. Update DB balances ───────────────────────────────────────
    const newSourceBalance = sourceWallet.balanceUsdc - amount_usdc;

    if (source_rail === "privy") {
      await storage.privyUpdateWalletBalance(source_wallet_id, newSourceBalance);
    } else {
      await storage.crossmintUpdateWalletBalance(source_wallet_id, newSourceBalance);
    }

    // Credit destination if it's an internal wallet
    if (destinationWallet) {
      const newDestBalance = destinationWallet.balanceUsdc + amount_usdc;
      if (destinationRail === "privy") {
        await storage.privyUpdateWalletBalance(destinationWallet.id, newDestBalance);
      } else {
        await storage.crossmintUpdateWalletBalance(destinationWallet.id, newDestBalance);
      }
    }

    // ── 6. Log transactions ─────────────────────────────────────────
    const sharedMetadata = {
      transfer_tier: transferTier,
      counterparty_address: destinationAddress,
      counterparty_wallet_id: destinationWallet?.id || null,
      counterparty_rail: destinationRail,
      tx_hash: txHash,
    };

    // Source ledger — outbound transfer
    if (source_rail === "privy") {
      await storage.privyCreateTransaction({
        walletId: source_wallet_id,
        type: "transfer",
        amountUsdc: amount_usdc,
        recipientAddress: destinationAddress,
        txHash,
        status: "confirmed",
        metadata: { ...sharedMetadata, direction: "outbound" },
      });
    } else {
      await storage.crossmintCreateTransaction({
        walletId: source_wallet_id,
        type: "transfer",
        amountUsdc: amount_usdc,
        quantity: 1,
        status: "confirmed",
        metadata: { ...sharedMetadata, direction: "outbound" },
      });
    }

    // Destination ledger — inbound transfer (only for own wallets)
    if (destinationWallet) {
      if (destinationRail === "privy") {
        await storage.privyCreateTransaction({
          walletId: destinationWallet.id,
          type: "transfer",
          amountUsdc: amount_usdc,
          txHash,
          status: "confirmed",
          metadata: { ...sharedMetadata, direction: "inbound" },
        });
      } else {
        await storage.crossmintCreateTransaction({
          walletId: destinationWallet.id,
          type: "transfer",
          amountUsdc: amount_usdc,
          quantity: 1,
          status: "confirmed",
          metadata: { ...sharedMetadata, direction: "inbound" },
        });
      }
    }

    // ── 7. Return result ────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      tx_hash: txHash,
      transfer_tier: transferTier,
      source: {
        wallet_id: source_wallet_id,
        rail: source_rail,
        new_balance: newSourceBalance,
        new_balance_display: `$${(newSourceBalance / 1_000_000).toFixed(2)}`,
      },
      destination: {
        wallet_id: destinationWallet?.id || null,
        rail: destinationRail,
        address: destinationAddress,
        new_balance: destinationWallet
          ? destinationWallet.balanceUsdc + amount_usdc
          : null,
      },
    });
  } catch (error) {
    console.error("POST /api/v1/wallet/transfer error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
```

**⚠️ CRITICAL IMPLEMENTATION NOTES:**

1. **`privyCreateTransaction` field compatibility.** The `privy_transactions` table has a `recipient_address` column and a `tx_hash` column. The type `"transfer"` is new — since `type` is a `text` column with no enum, no schema change is needed. However, **check `InsertPrivyTransaction` type** to confirm `recipientAddress` and `txHash` are valid optional fields.

2. **`crossmintCreateTransaction` field compatibility.** The `crossmint_transactions` table has required fields like `quantity` (which we set to 1). It does NOT have a `recipientAddress` or `txHash` column in the current schema. Transfer metadata (destination, tx hash) goes into the `metadata` jsonb field. **Alternatively**, consider adding `recipientAddress` and `txHash` columns to `crossmint_transactions` if you want structural parity with `privy_transactions` — but this is optional since `metadata` works.

3. **Race condition on balance.** The debit and credit are not atomic across tables. If the server crashes between debiting the source and crediting the destination, the DB balances will be inconsistent. The balance sync (↻) button on both rails corrects this from on-chain truth. For v1, this is acceptable. For production hardening, wrap source debit + destination credit in a database transaction.

4. **CrossMint async settlement.** If CrossMint returns `actionId` without `txHash`, store `pending:{actionId}` as the hash and update it when the CrossMint webhook fires. Or poll `GET /wallets/{locator}/transactions/{actionId}` for the final hash. For v1, optimistic DB update is fine since both wallets are on the same chain and settlement is near-instant on Base.

---

### Phase 3: Frontend — Transfer Dialog

**Files:**
- `app/app/stripe-wallet/page.tsx` — add Transfer button to Rail 1 wallet cards
- `app/app/card-wallet/page.tsx` — add Transfer button to Rail 2 wallet cards

**What to do:** Add a "Transfer" button on each wallet card that opens a dialog/modal.

#### Transfer Dialog UI

```
┌────────────────────────────────────────────┐
│          Transfer USDC                      │
│                                             │
│  From: Bot Agent Alpha (Privy) — $52.30     │
│                                             │
│  Amount: [________] USDC                    │
│                                             │
│  To:  ○ My Wallets                          │
│       ┌─────────────────────────────────┐   │
│       │ ▼ Select destination wallet     │   │
│       │   Bot Beta (Privy) — $10.00     │   │
│       │   Bot Gamma (CrossMint) — $5.00 │   │
│       └─────────────────────────────────┘   │
│                                             │
│       ○ External Address                    │
│       ┌─────────────────────────────────┐   │
│       │ 0x...                           │   │
│       └─────────────────────────────────┘   │
│                                             │
│  [Cancel]                    [Transfer]     │
└────────────────────────────────────────────┘
```

**Key UI behaviors:**
- The "My Wallets" dropdown shows ALL the owner's wallets across BOTH rails, excluding the source wallet
- Each option shows: bot name, rail label (Privy/CrossMint), current balance
- The "External Address" option is a free-text `0x` input with validation
- Amount field validates against source wallet balance (client-side)
- Transfer button calls `POST /api/v1/wallet/transfer`
- On success: toast with amount and destination, refresh wallet list on both rail pages
- On guardrail error: toast with the specific limit that was exceeded

**To populate the wallet dropdown**, the frontend needs wallets from both rails. Either:
- Call both `/api/v1/stripe-wallet/list` and `/api/v1/card-wallet/list` when the dialog opens
- Or use the existing `/api/v1/bots/rails` endpoint which already aggregates all rails

**State for the dialog:**
```typescript
const [transferSource, setTransferSource] = useState<{ id: number; rail: string } | null>(null);
const [transferMode, setTransferMode] = useState<"internal" | "external">("internal");
const [transferDestWalletId, setTransferDestWalletId] = useState<number | null>(null);
const [transferDestRail, setTransferDestRail] = useState<string>("");
const [transferDestAddress, setTransferDestAddress] = useState<string>("");
const [transferAmount, setTransferAmount] = useState<string>("");
const [transferLoading, setTransferLoading] = useState(false);
```

---

### Phase 4: Transaction Ledger Display

**Files:**
- `app/app/stripe-wallet/page.tsx` — update ledger to show `transfer` type
- `app/app/card-wallet/page.tsx` — update ledger to show `transfer` type

**What to do:** The existing Activity/ledger tables show transaction types like `deposit`, `x402_payment`, `purchase`. Add handling for the new `transfer` type.

**Display rules for `transfer` transactions:**
- **Outbound** (metadata.direction === "outbound"): Show as negative amount with red text, label "Transfer to {counterparty info}"
- **Inbound** (metadata.direction === "inbound"): Show as positive amount with green text, label "Transfer from {counterparty info}"
- **Counterparty info:** If `metadata.counterparty_wallet_id` exists, resolve to bot name. Otherwise show truncated address.

Example ledger rows:
```
TYPE          AMOUNT     BALANCE    DESCRIPTION
Transfer      -$5.00     $47.30    → Bot Beta (CrossMint)
Transfer      +$5.00     $10.00    ← Bot Alpha (Privy)
```

---

## Files Summary

| File | Action | Phase |
|------|--------|-------|
| `lib/stripe-wallet/server.ts` | Add `sendUsdcTransfer()` function | 1 |
| `lib/card-wallet/server.ts` | Add `sendUsdcTransfer()` function | 1 |
| `app/api/v1/wallet/transfer/route.ts` | CREATE — unified transfer endpoint | 2 |
| `app/app/stripe-wallet/page.tsx` | Add Transfer button + dialog + ledger display | 3, 4 |
| `app/app/card-wallet/page.tsx` | Add Transfer button + dialog + ledger display | 3, 4 |

## No Schema Changes Required

- `"transfer"` is a new transaction type value, but `type` is a `text` column — no migration needed
- Transaction metadata (direction, counterparty, tx hash) goes into the existing `metadata` jsonb column
- Both `privy_transactions` and `crossmint_transactions` already have all needed columns

## Dependencies

| Package | Status | Notes |
|---------|--------|-------|
| `viem` | Already installed | Provides `encodeFunctionData` and `erc20Abi` |
| `@privy-io/server-auth` | **DEPRECATED — currently installed** | CreditClaw uses the deprecated package. Has `walletApi.ethereum.sendTransaction` — try it first. REST API fallback if not. |
| `@privy-io/node` | **NOT installed (upgrade recommended)** | The current Privy Node SDK. Uses `privy.wallets().ethereum().sendTransaction()` pattern. Migration guide available. Not blocking for this feature. |

## Environment Variables

| Variable | Required | Notes |
|----------|----------|-------|
| (none new) | — | All existing Privy and CrossMint credentials are sufficient |

**Privy gas sponsorship** is the confirmed approach for Privy wallet transfers. Enable in the Privy dashboard: Gas Sponsorship tab → Enable → Select Base. Server wallets are TEE-native, so no TEE migration is needed. Privy bills gas costs back to your account.

---

## Risk Assessment

| Risk | Impact | Mitigation | Status |
|------|--------|------------|--------|
| Privy SDK is deprecated `@privy-io/server-auth` | May lack `sendTransaction` | Try `walletApi.ethereum.sendTransaction` first. If unavailable, use REST API (`POST /v1/wallets/{id}/rpc`) with existing `getAuthorizationSignature()`. Both confirmed in Privy docs. | **✅ CONFIRMED — REST fallback exists** |
| Privy SDK upgrade needed long-term | Tech debt | `@privy-io/server-auth` → `@privy-io/node` migration guide exists. Constructor changes from positional to object params. `walletApi.*` → `wallets().*` pattern. Not blocking this feature. | **Known tech debt** |
| CrossMint API version mismatch | Blocks Phase 1 | Transfer endpoint is on `2025-06-09` API, not `2022-06-09`. Need second base URL constant or parameterized fetch. | **✅ CONFIRMED — new API version required** |
| CrossMint Fireblocks custodial signer approval | N/A | **No approval step needed.** Fireblocks custodial + server API key = auto-approve. CreditClaw's existing purchase and signing flows already prove this. | **✅ CONFIRMED — auto-approves** |
| CrossMint amount format is human-readable, not micro-USDC | Silent data corruption | Conversion in `sendUsdcTransfer` — divide by 1,000,000 and format as decimal string. Use `.toFixed(6)` to preserve precision. | **✅ CONFIRMED — handled in code** |
| Privy gas sponsorship not enabled for Base | User-facing failure | Server wallets are TEE-native (no migration needed). **Decision: Use gas sponsorship.** Enable in dashboard: Gas Sponsorship tab → Enable → Base. Privy bills gas back to your account. | **ACTION: Enable in Privy dashboard** |
| Non-atomic DB balance updates | Data inconsistency on crash | Balance sync (↻) corrects from on-chain truth. Acceptable for v1. | Known tradeoff |
| CrossMint async tx (no immediate hash) | UX confusion | Show "pending" status, resolve on webhook or poll. | Known tradeoff |

## Verification

### Phase 1 (Lib functions)
- Send $0.01 USDC between two known Privy wallets → verify on Basescan
- Send $0.01 USDC between two known CrossMint wallets → verify on Basescan

### Phase 2 (API endpoint)
- Tier 1: Transfer between two Privy wallets → both DB balances update, both ledgers have entries
- Tier 2: Transfer from Privy to CrossMint → source debited, destination credited, both ledgers updated
- Tier 3: Transfer to external address → source debited, no destination ledger entry
- Guardrail enforcement: attempt transfer exceeding per-tx limit → 403

### Phase 3 (Frontend)
- Transfer dialog shows all owner wallets across both rails
- Successful transfer shows toast and refreshes balances on both pages
- External address mode validates `0x` format

### Phase 4 (Ledger)
- Outbound transfers show as negative with red styling
- Inbound transfers show as positive with green styling
- Counterparty info resolves to bot name when available
