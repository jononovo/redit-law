# Unified Tabs Across Rail Dashboard Pages

**Date:** February 27, 2026  
**Scope:** Standardize the tab structure on all wallet/card dashboard pages.  
**Depends on:** Wallet UI refactor (T007 area). Independent from crypto-onramp extraction.

---

## Problem

Tabs are inconsistent across rails:

| Rail | Current tabs |
|---|---|
| Rail 1 (`/app/stripe-wallet`) | Wallets · Activity · Approvals |
| Rail 2 (`/app/card-wallet`) | Wallets · Activity · Orders · Approvals |
| Rail 4 (`/app/self-hosted`) | No tabs — flat card list |
| Rail 5 (`/app/sub-agent-cards`) | No tabs — flat card list |

"Activity" conflates transactions and orders. Rail 4/5 have no tab structure at all. Naming is inconsistent.

---

## Solution

Four standard tabs. Every rail page uses the same tab component. Tabs that have no data for a given rail are either hidden or show an empty state.

| Tab | Content | Description |
|---|---|---|
| **Wallets** (or **Cards** for Rail 4/5) | Wallet/card list with action bars | The primary view. Always present. |
| **Transactions** | Financial ledger | Deposits, debits, transfers, refunds. Amount, timestamp, status, direction, balance after. Pure money view. Every rail has this. |
| **Orders** | Procurement records | Vendor, product, product link, price, quantity, shipping status, tracking. Only shows when the rail has procurement capability (Rail 2 today, any rail later via `lib/procurement/`). |
| **Approvals** | Pending approval queue | Approve/reject pending requests. Every rail with approval thresholds shows this. Badge with count when items are pending. |

---

## Implementation

Create a shared tab wrapper in `components/wallet/`:

```
components/wallet/
  wallet-page-tabs.tsx      ← Shared tab shell (accepts config for which tabs to show + badge counts)
  transaction-list.tsx       ← Shared transaction table (accepts rail-specific fetch function)
  order-list.tsx             ← Shared order table (accepts rail-specific fetch function)
  approval-list.tsx          ← Shared approval list (accepts rail-specific fetch + decide handlers)
```

Each rail page becomes:

```tsx
<WalletPageTabs
  tabs={[
    { id: "wallets", label: "Wallets", content: <WalletList ... /> },
    { id: "transactions", label: "Transactions", content: <TransactionList fetchFn={...} /> },
    { id: "orders", label: "Orders", content: <OrderList fetchFn={...} />, hidden: !hasOrders },
    { id: "approvals", label: "Approvals", content: <ApprovalList ... />, badge: pendingCount },
  ]}
/>
```

The tab content components accept data-fetching functions as props so they stay rail-agnostic. The page decides which endpoint to call.

---

## Key decisions

- **Transactions vs Orders are separate concepts.** Transactions = financial (the money moved). Orders = procurement (what was bought). Don't merge them.
- **Rail 4/5 get tabs too.** Even card rails have transactions (debits for checkouts) and approvals. Adding tabs gives them the same structure as crypto wallets.
- **"Activity" is retired.** Replace with the explicit "Transactions" label everywhere.
- **Orders tab is conditionally shown.** Hidden when the rail has no procurement capability. Appears automatically when procurement is wired up (via `lib/procurement/`).

---

## Task fit

This is part of the T007 crypto wallet page refactor — when extracting shared components from the 780-880 line page files, the tab structure is the natural thing to unify. It also applies retroactively to Rails 4/5 (which are already thin wrappers of `CreditCardListPage` from T006).
