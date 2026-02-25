# Sidebar: Procurement Sub-Section Plan

## Objective
Reorganize the sidebar navigation to group "Submit Supplier" and "Skill Builder" under a "Procurement" sub-header at the bottom of the menu. Rename "Submit Skill" to "Submit Supplier".

## Current State
All nav items are in a single flat `navItems` array rendered in one `<nav>` block:
- Overview
- Stripe Wallet
- Card Wallet
- Self-Hosted
- Sub-Agent Cards
- Transactions
- Submit Skill ← to be renamed & moved
- Skill Builder ← to be moved
- Virtual Cards (inactive)

## Changes

### File: `components/dashboard/sidebar.tsx`

#### 1. Split `navItems` into two arrays

```ts
const mainNavItems = [
  { icon: LayoutDashboard, label: "Overview", href: "/app" },
  { icon: Wallet, label: "Stripe Wallet", href: "/app/stripe-wallet" },
  { icon: ShoppingCart, label: "Card Wallet", href: "/app/card-wallet" },
  { icon: Shield, label: "Self-Hosted", href: "/app/self-hosted" },
  { icon: Lock, label: "Sub-Agent Cards", href: "/app/sub-agent-cards" },
  { icon: Activity, label: "Transactions", href: "/app/transactions" },
  { icon: CreditCard, label: "Virtual Cards", href: "/app/cards", inactive: true },
];

const procurementNavItems = [
  { icon: Send, label: "Submit Supplier", href: "/app/skills/submit" },
  { icon: Sparkles, label: "Skill Builder", href: "/app/skills/review" },
];
```

#### 2. Render with sub-header

Inside the `<nav>` element, render `mainNavItems` first, then a subtle "Procurement" label, then `procurementNavItems`:

```tsx
<nav className="flex-1 px-4 space-y-1">
  {mainNavItems.map((item) => { /* existing render logic */ })}

  <div className="pt-4 pb-1 px-4">
    <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
      Procurement
    </p>
  </div>

  {procurementNavItems.map((item) => { /* same render logic */ })}
</nav>
```

#### 3. Rename
- `"Submit Skill"` → `"Submit Supplier"`
- `"Skill Builder"` stays as-is

## Result

```
Overview
Stripe Wallet
Card Wallet
Self-Hosted
Sub-Agent Cards
Transactions
Virtual Cards          INACTIVE
───────────────────────
PROCUREMENT
Submit Supplier
Skill Builder
```

## Scope
- Single file: `components/dashboard/sidebar.tsx`
- No route changes (hrefs stay `/app/skills/submit` and `/app/skills/review`)
- No backend changes
- No other components affected
