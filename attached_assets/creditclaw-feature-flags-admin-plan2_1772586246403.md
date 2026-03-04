# CreditClaw — Feature Flags & Admin Dashboard Technical Plan

## 1. Overview

1. **Feature flag system** — a `flags` column on the `owners` table, exposed through the existing session flow, used by the sidebar to hide nav items from users who don't have the right access level. Currently everyone registers freely and has full access — this just hides UI elements that aren't ready for release yet.
2. **Admin dashboard** (`/admin123`) — a server-side protected page for platform operations. No sidebar link — admins navigate directly to the URL. Uses the same shared layout (sidebar + header) as the rest of the app.

**Performance guarantee:** The user's flags load once at login as part of the existing session response. The sidebar reads them from React context with a synchronous `.includes()` check — no extra API calls, no loading states, no flash of content.

---

## 2. Task Breakdown

```
T001 (DB column)
  ├── T002 (flag module)  ──┐
  ├── T003 (auth flow)   ───┤── T004 (sidebar integration)
  └─────────────────────────┘── T005 (admin page + route guard)
```

---

## T001 — Add `flags` Column to `owners` Table

A `text().array()` column on the existing `owners` table. A user can hold multiple flags simultaneously (e.g. `["admin", "beta"]`).

**Schema change in `shared/schema.ts`:**

```typescript
flags: text("flags").array().default([]).notNull(),
```

**Migration:** `npx drizzle-kit generate` + `npx drizzle-kit migrate`. Defaults to empty array — all existing users get `[]`, no backfill.

**Initial admin setup:**

```sql
UPDATE owners SET flags = '{"admin"}' WHERE uid = '<your-firebase-uid>';
```

**Storage layer:** No new methods needed. `flags` flows through the existing `getOwnerByUid()` and `upsertOwner()` automatically since they return the full `Owner` type.

---

## T002 — Feature Flag Module (`lib/feature-flags/`)

Two small files:

```
lib/feature-flags/
├── tiers.ts                # Tier type definition
└── use-feature-flag.ts     # Client-side hook
```

### `tiers.ts`

```typescript
export const TIERS = ["admin", "beta", "paid"] as const;
export type Tier = (typeof TIERS)[number];
```

This gives TypeScript enforcement — if someone types `requiredAccess: "admni"` on a nav item, it's a compile error.

### `use-feature-flag.ts`

```typescript
"use client";

import { useAuth } from "@/lib/auth/auth-context";
import type { Tier } from "./tiers";

export function useHasAccess(tier: Tier): boolean {
  const { user } = useAuth();
  return user?.flags?.includes(tier) ?? false;
}
```

That's the whole module. Reads from auth context, no network calls.

---

## T003 — Expose Flags Through the Auth Flow

Piggyback `flags` onto the existing session response.

### Session response shape

```
// Current:
{ uid, email, displayName, photoURL }

// After:
{ uid, email, displayName, photoURL, flags: ["admin"] }
```

### Changes

**`lib/auth/session.ts` — `getCurrentUser()`:**

After getting the Firebase user, also fetch the owner record to get their flags:

```typescript
const owner = await storage.getOwnerByUid(user.uid);
return {
  uid: user.uid,
  email: user.email || null,
  displayName: user.displayName || null,
  photoURL: user.photoURL || null,
  flags: owner?.flags ?? [],
};
```

One indexed DB query, negligible overhead — `getCurrentUser()` already runs on authenticated page loads.

**`app/api/auth/session/route.ts` — `POST` handler:**

The login handler already calls `storage.upsertOwner()`. Read the flags from the returned owner:

```typescript
const owner = await storage.upsertOwner(user.uid, { ... });
return NextResponse.json({
  uid: user.uid,
  email: user.email || null,
  displayName: user.displayName || null,
  photoURL: user.photoURL || null,
  flags: owner?.flags ?? [],
});
```

**`lib/auth/auth-context.tsx`:**

Add `flags` to the `User` interface:

```typescript
interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  flags: string[];
}
```

`exchangeTokenForSession()` and `fetchSessionUser()` already parse the JSON response — `flags` flows through automatically.

---

## T004 — Wire Flags Into the Sidebar

### Add `requiredAccess` to nav items

```typescript
// In components/dashboard/sidebar.tsx — add to the nav item type:
requiredAccess?: Tier;

// Example — hiding items that aren't ready for release:
{ icon: CreditCard, label: "Virtual Cards", href: "/app/cards",
  requiredAccess: "admin" },
```

### Filter logic

```typescript
const { user } = useAuth();
const userFlags = user?.flags ?? [];

const visibleNavItems = mainNavItems.filter(item => {
  if (!item.requiredAccess) return true;
  return userFlags.includes(item.requiredAccess);
});
```

Same pattern for `procurementNavItems` and `salesNavItems`.

**Items without `requiredAccess` are completely unaffected.** No behavior change for anything currently visible.

---

## T005 — Admin Dashboard at `/admin123`

### Shared layout

Same sidebar, same header as the rest of the dashboard. The admin layout just adds an auth gate.

### Files

```
app/admin123/
├── layout.tsx       # Auth gate
├── page.tsx         # Landing page with placeholder cards for future sub-pages
```

### `layout.tsx`

```typescript
import { getCurrentUser } from "@/lib/auth/session";
import { notFound } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || !user.flags?.includes("admin")) {
    notFound();   // 404 — don't confirm the route exists
  }
  return <>{children}</>;
}
```

This only runs when someone navigates to `/admin123/*`. Regular users on `/app/*` never hit this code.

### `page.tsx`

A hub page with cards linking to future sub-pages (Users, Transactions, Skills, Health, etc.). Content is a separate design pass — the initial version just needs the structure and placeholder cards.

### Admin API routes

Future admin API routes go under `app/api/v1/admin/` with the same inline check:

```typescript
const user = await getSessionUser(request);
if (!user || !user.flags?.includes("admin")) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
```

Simple inline check. If the number of admin routes grows and this feels repetitive, extract a helper then — not now.

---

## 3. Implementation Order

| Step | Task | Files touched | Risk |
|------|------|---------------|------|
| **1** | T001: `flags` column + migration | `shared/schema.ts`, migration file | Low — additive column with default |
| **2** | T002: Create `lib/feature-flags/` (2 files) | New files | None |
| **3** | T003: Add `flags` to session + auth context | `lib/auth/session.ts`, `app/api/auth/session/route.ts`, `lib/auth/auth-context.tsx` | Low — additive field |
| **4** | T004: Sidebar filtering | `components/dashboard/sidebar.tsx` | Low — no change to items without `requiredAccess` |
| **5** | T005: Admin page + route guard | `app/admin123/layout.tsx`, `app/admin123/page.tsx` | None — new files |

---

## 4. Future Tiers

**Adding `beta` or `paid`:**

1. Update the user's `flags` array in the DB (manually, from admin dashboard, or via Stripe webhook)
2. Tag nav items with `requiredAccess: "beta"` or `requiredAccess: "paid"`
3. Done — no changes to the flag module, hook, or sidebar filtering logic

The `Tier` type in `tiers.ts` already includes `"beta"` and `"paid"`, so TypeScript is ready for it.
