# Rail 5 Phase 2: Owner Setup API + UI — Technical Plan

**February 2026**

---

## Scope

Phase 2 delivers the owner-facing half of Rail 5: three API routes and the dashboard UI (listing page + 7-step setup wizard). After Phase 2, an owner can create a Rail 5 card, encrypt their card details client-side, download the encrypted `.md` file, store only the decryption key on CreditClaw, set spending limits, and link the card to a bot.

Phase 2 does **not** include bot-facing endpoints (checkout, key delivery, confirm) — those are Phase 3.

---

## Task Breakdown

### Task 1: `POST /api/v1/rail5/initialize`

**File:** `app/api/v1/rail5/initialize/route.ts`

**Auth:** `getSessionUser(request)` → 401 if null

**Input validation:** `rail5InitializeSchema` from `shared/schema.ts`
```ts
// Expected body:
{ card_name: string, card_brand: string, card_last4: string }
```

**Logic:**
1. Parse + validate body with `rail5InitializeSchema.safeParse(body)`
2. Generate `card_id` via `generateRail5CardId()` from `lib/rail5.ts`
3. Call `storage.createRail5Card({ cardId, ownerUid: user.uid, cardName, cardBrand, cardLast4, status: "pending_setup" })`
4. Return `{ card_id, card_name, card_brand, card_last4, status: "pending_setup" }`

**Pattern reference:** `app/api/v1/rail4/initialize/route.ts`

---

### Task 2: `POST /api/v1/rail5/submit-key`

**File:** `app/api/v1/rail5/submit-key/route.ts`

**Auth:** `getSessionUser(request)` → 401 if null

**Input validation:** `rail5SubmitKeySchema` from `shared/schema.ts`
```ts
// Expected body:
{ card_id: string, key_hex: string (64 chars), iv_hex: string (24 chars), tag_hex: string (32 chars) }
```

**Logic:**
1. Parse + validate body with `rail5SubmitKeySchema.safeParse(body)`
2. Validate key material with `validateKeyMaterial(key_hex, iv_hex, tag_hex)` from `lib/rail5.ts` → 400 on failure
3. Look up card: `storage.getRail5CardByCardId(card_id)` → 404 if not found
4. Verify ownership: `card.ownerUid === user.uid` → 403 if mismatch
5. Verify status: `card.status === "pending_setup"` → 409 if key already submitted
6. Update card: `storage.updateRail5Card(card_id, { encryptedKeyHex, encryptedIvHex, encryptedTagHex, status: "active" })`
7. Return `{ card_id, status: "active" }`

---

### Task 3: `GET /api/v1/rail5/cards`

**File:** `app/api/v1/rail5/cards/route.ts`

**Auth:** `getSessionUser(request)` → 401 if null

**Logic:**
1. Call `storage.getRail5CardsByOwnerUid(user.uid)`
2. Map to response shape (never expose key material):
```ts
{
  cards: [{
    card_id, card_name, card_brand, card_last4,
    status, bot_id,
    spending_limit_cents, daily_limit_cents,
    monthly_limit_cents, human_approval_above_cents,
    created_at  // ISO string
  }]
}
```

**Pattern reference:** `app/api/v1/rail4/cards/route.ts`

---

### Task 4: Dashboard Listing Page

**File:** `app/app/sub-agent-cards/page.tsx`

**Pattern reference:** `app/app/self-hosted/page.tsx`

**Behavior:**
- `"use client"` directive
- Fetch cards from `GET /api/v1/rail5/cards` via `authFetch` on mount
- Display card grid using existing `CardVisual` component (pass card_brand, card_last4, card_name)
- Each card shows: name, brand icon, last4, status badge, spending limit, bot_id
- "Add New Card" button opens the setup wizard dialog
- Card click navigates to detail page (stub route for now: `/app/sub-agent-cards/[cardId]`)
- Empty state: message + prominent "Add Your First Card" CTA
- Reuse: `useAuth`, `authFetch`, `useToast`, shadcn `Button`/`Dialog`
- All interactive elements get `data-testid` attributes

**Card status colors:**
- `pending_setup` → yellow/amber
- `active` → green
- `frozen` → blue/ice

---

### Task 5: Setup Wizard Component

**File:** `components/dashboard/rail5-setup-wizard.tsx`

**Pattern reference:** Rail 4 wizard + `docs/rail5-overview.md` Steps 1–7

7-step wizard inside a `Dialog`. Each step is a sub-component rendered conditionally.

#### Step 1: Card Name + Brand
- Text input: card name (max 200 chars)
- Select: card brand (Visa / Mastercard / Amex / Discover)
- Text input: last 4 digits (exactly 4 numeric chars)
- On "Next": call `POST /api/v1/rail5/initialize` → get `card_id`

#### Step 2: Explanation
- Static content: "CreditClaw will never see your card details. Everything is encrypted in your browser before it leaves this page."
- Brief explanation of the split-knowledge model
- "Next" button

#### Step 3: Full Card Entry
- Inputs: card number, CVV, expiry (month/year), cardholder name, billing address (street, city, state, zip)
- **No data leaves the browser.** All inputs stored in local React state only.
- Basic client-side validation (Luhn check optional, field length checks)

#### Step 4: Client-Side Encryption + Download
- Auto-triggered on entering Step 4 (no user action needed beyond confirming)
- Uses Web Crypto API:
  1. `crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"])`
  2. `crypto.getRandomValues(new Uint8Array(12))` for IV
  3. `crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encodedCardJson)`
  4. `crypto.subtle.exportKey("raw", key)` → raw key bytes
  5. Extract auth tag (last 16 bytes of ciphertext)
  6. Send `POST /api/v1/rail5/submit-key` with `{ card_id, key_hex, iv_hex, tag_hex }`
  7. Build markdown: `# CreditClaw Encrypted Card\n\n\`\`\`\n${base64Ciphertext}\n\`\`\``
  8. Trigger browser download: `Card-${cardName}-${last4}.md`
- Show success checkmarks as each step completes
- Clear card data from React state immediately after encryption

#### Step 5: Spending Limits
- Number inputs for: per-checkout limit ($), daily limit ($), monthly limit ($)
- Number input for human approval threshold ($)
- Defaults from schema: $50 per-checkout, $100 daily, $500 monthly, $25 approval threshold
- On "Next": call `storage.updateRail5Card` via a PATCH-like endpoint, or fold into the initialize call
- **Decision:** Add a `PATCH /api/v1/rail5/cards/[cardId]` route for updating limits and bot assignment. This keeps endpoints clean.

#### Step 6: Bot Connection
- Dropdown of owner's existing bots (fetch from existing bot list endpoint)
- "Skip for now" option (can link later from card detail page)
- On select: update card's `bot_id` via the PATCH endpoint

#### Step 7: Success
- Confetti or checkmark animation
- Summary: card name, linked bot, spending limits
- Reminder: "Place the encrypted `.md` file in your bot's OpenClaw workspace"
- "Done" button closes wizard and refreshes card list

---

### Task 6: PATCH Endpoint for Card Updates

**File:** `app/api/v1/rail5/cards/[cardId]/route.ts`

**Auth:** `getSessionUser(request)` → 401

**Logic:**
1. Look up card by `cardId` param
2. Verify ownership
3. Accept partial updates: `spending_limit_cents`, `daily_limit_cents`, `monthly_limit_cents`, `human_approval_above_cents`, `bot_id`, `card_name`, `status` (only `frozen` ↔ `active`)
4. Call `storage.updateRail5Card(cardId, updates)`
5. Return updated card

---

### Task 7: Navigation + Sidebar Link

- Add "Sub-Agent Cards" link to dashboard sidebar (wherever Rail 4 "Self-Hosted Cards" is linked)
- Icon: same pattern as other rails
- Route: `/app/sub-agent-cards`

---

## Files Created/Modified

| Action | File |
|--------|------|
| Create | `app/api/v1/rail5/initialize/route.ts` |
| Create | `app/api/v1/rail5/submit-key/route.ts` |
| Create | `app/api/v1/rail5/cards/route.ts` |
| Create | `app/api/v1/rail5/cards/[cardId]/route.ts` |
| Create | `app/app/sub-agent-cards/page.tsx` |
| Create | `app/app/sub-agent-cards/[cardId]/page.tsx` (stub) |
| Create | `components/dashboard/rail5-setup-wizard.tsx` |
| Modify | Sidebar/nav component (add Sub-Agent Cards link) |

## Dependencies

- All from Phase 1 (schema, storage, helpers, rate limits) ✅
- Existing: `getSessionUser`, `authFetch`, `useAuth`, `useToast`, `CardVisual`, shadcn components
- Web Crypto API (browser built-in, no install needed)

## Not In Scope (Phase 3)

- `POST /api/v1/bot/rail5/checkout` (bot requests spawn payload)
- `POST /api/v1/bot/rail5/key` (sub-agent gets decryption key)
- `POST /api/v1/bot/rail5/confirm` (sub-agent reports result)
- `public/decrypt.js` (deterministic decryption script)
- `public/skill.md` Rail 5 section
- Spending limit enforcement (checked at checkout time in Phase 3)
