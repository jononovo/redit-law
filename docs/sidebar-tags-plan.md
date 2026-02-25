# Sidebar: Nav Item Tags/Chips Plan

## Objective
Add subtle, uniform status tags (chips) to specific sidebar nav items. Also rename "Card Wallet" to "Shopping Wallet".

## Changes

### File: `components/dashboard/sidebar.tsx`

#### 1. Add optional `tag` property to nav items

```ts
const mainNavItems = [
  { icon: LayoutDashboard, label: "Overview", href: "/app" },
  { icon: Wallet, label: "Stripe Wallet", href: "/app/stripe-wallet", tag: "beta" },
  { icon: ShoppingCart, label: "Shopping Wallet", href: "/app/card-wallet", tag: "soon" },
  { icon: Shield, label: "Self-Hosted", href: "/app/self-hosted", tag: "legacy" },
  { icon: Lock, label: "Sub-Agent Cards", href: "/app/sub-agent-cards", tag: "beta" },
  { icon: Activity, label: "Transactions", href: "/app/transactions" },
  { icon: CreditCard, label: "Virtual Cards", href: "/app/cards", inactive: true },
];
```

#### 2. Render tag chip

Same style for all tags — subtle, neutral, consistent with the existing "Inactive" badge:

```tsx
{item.tag && (
  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">
    {item.tag}
  </span>
)}
```

This reuses the exact same classes as the existing "Inactive" badge on Virtual Cards, so all chips look uniform.

When the item is active (white text on dark bg), the tag switches to a subtle inverted style:

```tsx
{item.tag && (
  <span className={cn(
    "ml-auto text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
    isActive
      ? "text-white/60 bg-white/10"
      : "text-neutral-400 bg-neutral-100"
  )}>
    {item.tag}
  </span>
)}
```

#### 3. Rename
- `"Card Wallet"` → `"Shopping Wallet"`

## Visual Result

```
Overview
Stripe Wallet                    BETA
Shopping Wallet                  SOON
Self-Hosted                    LEGACY
Sub-Agent Cards                  BETA
Transactions
Virtual Cards                INACTIVE
─────────────────────────────────────
PROCUREMENT
Submit Supplier
Skill Builder
```

## Scope
- Single file: `components/dashboard/sidebar.tsx`
- No route changes (`/app/card-wallet` href stays the same)
- No backend changes
- No other components affected
