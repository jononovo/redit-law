# Rail 4: Technical Plan — Remaining Work

> What needs to be built to complete the Rail 4 design. Ordered by priority and implementation dependency.

---

## Phase 1: Unified Checkout + Task Queue

**Priority: Highest — this is the core value proposition and the architectural foundation for everything else**

### Design Principles

1. The bot has ONE checkout endpoint. It never calls different APIs for "real" vs "fake" purchases.
2. All 6 payment profiles behave identically — same data structures, same approval modes, same checkout flow.
3. Fake profiles have their own approval mode, but it's always auto-approve and CreditClaw is the approver. The human is never contacted for fake profile checkouts.
4. Real profile's approval mode is whatever the owner configured. If approval is required, the human is notified.
5. The bot cannot distinguish real from fake — same request shape, same response shape, same fields.
6. Obfuscation purchase orders originate from CreditClaw via the task queue. Real purchase orders originate from the human in conversation. Both result in the bot calling the same checkout endpoint.

---

### 1A. Per-Profile Approval Mode & Spending Limits

Currently, spending permissions (approval mode, limits, blocked categories) exist only at the bot level in the `spending_permissions` table. For the unified model, each of the 6 profiles needs its own settings.

**Schema change — add `profile_permissions` JSON column to `rail4_cards`:**

```
rail4_cards.profile_permissions  (text, JSON)
```

JSON structure — array of 6 objects:

```json
[
  {
    "profile_index": 1,
    "approval_mode": "auto_approve_under_threshold",
    "per_transaction_cents": 2500,
    "daily_cents": 5000,
    "monthly_cents": 50000,
    "ask_approval_above_cents": 1000,
    "blocked_categories": ["gambling"],
    "approved_categories": []
  },
  {
    "profile_index": 2,
    "approval_mode": "auto_approve_under_threshold",
    "per_transaction_cents": 3000,
    "daily_cents": 8000,
    "monthly_cents": 40000,
    "ask_approval_above_cents": 2000,
    "blocked_categories": [],
    "approved_categories": []
  }
  // ... all 6 profiles
]
```

**Generation logic (in `lib/rail4.ts` → `generateRail4Setup()`):**

- Real profile (e.g., Profile #3): inherits the bot's actual `spending_permissions` values at time of initialization. This is a snapshot — if the owner later changes spending permissions, they should propagate to the real profile's entry. (Or: the real profile always reads live from `spending_permissions` at checkout time rather than using the snapshot.)
- Fake profiles (the other 5): randomized but plausible settings. All get `approval_mode: "auto_approve_under_threshold"` with a generous threshold so they auto-approve without human involvement. Limits are randomized within reasonable ranges (e.g., per-transaction $15-$75, daily $50-$200, monthly $500-$3000). Some get 1-2 random blocked categories, some get none. The goal is variety — they shouldn't all look identical.

**Design decision — real profile live vs snapshot:**

- **Recommended: Live lookup.** When the unified checkout endpoint receives a request for the real profile, it reads the bot's current `spending_permissions` from the database (not the `profile_permissions` JSON). This means if the owner changes limits on the dashboard, it takes effect immediately for real purchases. The `profile_permissions` JSON stores the real profile's values only for bot-facing display purposes (so the bot can query "what are Profile #3's limits?" and get a response).
- Fake profiles always read from the `profile_permissions` JSON since there's no external source of truth.

**Zod validation schema:**

```typescript
const profilePermissionSchema = z.object({
  profile_index: z.number().int().min(1).max(6),
  approval_mode: z.enum(["ask_for_everything", "auto_approve_under_threshold", "auto_approve_by_category"]),
  per_transaction_cents: z.number().int().min(0),
  daily_cents: z.number().int().min(0),
  monthly_cents: z.number().int().min(0),
  ask_approval_above_cents: z.number().int().min(0),
  blocked_categories: z.array(z.string()),
  approved_categories: z.array(z.string()),
});
```

---

### 1B. Unified Checkout Endpoint

**`POST /api/v1/bot/merchant/checkout`**

This replaces the current 3-endpoint obfuscation flow (`/merchant/queue`, `/merchant/verify`, `/merchant/complete`) and the separate `/wallet/purchase` for real purchases. The bot calls this ONE endpoint every time it's at a checkout page.

**Request body:**

```json
{
  "profile_index": 2,
  "merchant_name": "SpicyThai Kitchen",
  "merchant_url": "https://creditclaw.com/merchant/spicythai-kitchen",
  "item_name": "Spicy Coconut PadThai",
  "amount_cents": 1549,
  "category": "food",
  "description": "Lunch order"
}
```

**Zod schema:**

```typescript
const unifiedCheckoutSchema = z.object({
  profile_index: z.number().int().min(1).max(6),
  merchant_name: z.string().min(1).max(200),
  merchant_url: z.string().min(1).max(2000),
  item_name: z.string().min(1).max(500),
  amount_cents: z.number().int().min(1).max(10000000),
  category: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
});
```

**Server-side logic (pseudocode):**

```
1. Authenticate bot via withBotApi middleware
2. Validate request body
3. Look up rail4_cards for this bot — must exist and be active
4. Determine: is profile_index the real profile?

IF FAKE PROFILE:
  5a. Look up this profile's permissions from profile_permissions JSON
  6a. Run spending controls against those permissions (approval mode, limits, blocked categories)
      - Approval mode for fakes is always auto_approve_under_threshold with a high threshold
      - So this will always pass — but the code path is identical to the real one
  7a. Look up fakeMissingDigits + fakeExpiryMonth + fakeExpiryYear from fake_profiles_json
  8a. Log an obfuscation_event (status: "completed", occurred_at: now)
  9a. Record obfuscation event in state machine (increment obfuscation_count)
  10a. Return success response with fake missing digits + fake expiry

IF REAL PROFILE:
  5b. Read the bot's LIVE spending_permissions from the database
  6b. Run spending controls (same logic as current /wallet/purchase):
      - Check wallet balance >= amount_cents
      - Check wallet is not frozen
      - Check per-transaction limit
      - Check daily/monthly aggregate limits
      - Check blocked categories
      - Check approval mode:
        - "auto_approve_under_threshold": if amount <= threshold, approve. Else reject.
        - "auto_approve_by_category": if category is approved, approve. Else check threshold.
        - "ask_for_everything": approve (current behavior — async approval is a future feature)
  7b. Debit wallet (atomic)
  8b. Create transaction record
  9b. Fire webhook (wallet.spend.authorized)
  10b. Send owner notification (notifyPurchase)
  11b. Record organic event in state machine (recordOrganicEvent)
  12b. Check low balance threshold, fire webhook + notification if crossed
  13b. Return success response with REAL missing_digits_value + expiry_month + expiry_year
```

**Success response (identical shape for real and fake):**

```json
{
  "approved": true,
  "missing_digits": "472",
  "expiry_month": 3,
  "expiry_year": 2027,
  "confirmation_id": "chk_a1b2c3d4",
  "profile_index": 2,
  "merchant_name": "SpicyThai Kitchen",
  "amount_usd": 15.49,
  "message": "Checkout approved. Enter the provided card details to complete your purchase."
}
```

**Decline response (also identical shape):**

```json
{
  "approved": false,
  "error": "exceeds_per_transaction_limit",
  "profile_index": 2,
  "merchant_name": "SpicyThai Kitchen",
  "amount_usd": 15.49,
  "limit_usd": 25.00,
  "message": "This amount exceeds the per-transaction limit for this profile."
}
```

The `confirmation_id` is generated for every approved checkout:
- For fake: `"chk_" + randomHex(12)` — a throwaway ID logged in the obfuscation event
- For real: `"chk_" + transaction.id` — maps back to the real transaction

**Key behavior notes:**
- The bot never sees the words "obfuscation", "fake", or "real" anywhere in any response
- Decline reasons for fake profiles can occur (e.g., if a fake profile has gambling blocked and the bot sends category "gambling") — this is intentional and makes fake profiles more realistic
- The `missing_digits` and `expiry_month/year` fields are ONLY present when `approved: true`

---

### 1C. Task Queue Endpoint (Heartbeat)

**`POST /api/v1/bot/tasks/next`**

The bot's skill file references `heartbeat.md`, which instructs the bot to check in with CreditClaw twice per day. On check-in, it calls this endpoint and receives either a task or nothing.

**Request body:** (empty or minimal)

```json
{}
```

**Response — three possible task types:**

**Type 1: Purchase order (obfuscation)**

```json
{
  "has_task": true,
  "task_type": "purchase",
  "task_id": "task_x7y8z9",
  "instructions": {
    "profile_index": 4,
    "merchant_name": "Amazon Verified Merchant",
    "merchant_url": "https://creditclaw.com/merchant/amazon-verified",
    "item_name": "Wireless Bluetooth Earbuds",
    "amount_cents": 3499,
    "category": "retail"
  },
  "message": "Purchase 'Wireless Bluetooth Earbuds' from Amazon Verified Merchant using Payment Profile #4."
}
```

**Type 2: Security briefing (future — Phase 6)**

```json
{
  "has_task": true,
  "task_type": "security_briefing",
  "task_id": "task_abc123",
  "briefing": "...",
  "message": "Review and acknowledge the following security briefing."
}
```

**Type 3: No tasks**

```json
{
  "has_task": false,
  "message": "No tasks at this time. Check back later."
}
```

**Server-side logic:**

```
1. Authenticate bot via withBotApi middleware
2. Check for pending obfuscation events in the obfuscation_events table (status: "pending")
   - If found: return the oldest pending event as a purchase task
3. If no pending events: run shouldRunObfuscation() from the state machine
   - If the state machine says to create new events: create them via createObfuscationEvent(), return the first one
4. If nothing to do: return { has_task: false }
```

**Rate limiting:** Use the existing `withBotApi` rate limit system. Suggested limit: 12/hr per bot (generous enough for twice-daily heartbeat plus retries, but prevents abuse).

**What happens after the bot receives a purchase task:**
- The bot navigates to the `merchant_url`
- The bot browses the fake merchant page, selects the specified item
- The bot reaches checkout and calls `POST /api/v1/bot/merchant/checkout` with the profile_index, merchant_name, etc. from the task
- CreditClaw processes it as a fake profile checkout (returns fake digits, logs obfuscation event)
- The bot enters the fake digits on the fake merchant checkout page
- Done — the bot has completed an obfuscation purchase, and it looks exactly like any other purchase

**This replaces the existing tick/cron model for creating obfuscation events.** Instead of the cron hitting `/api/v1/rail4/obfuscation/tick` to pre-generate events, events are generated on-demand when the bot checks in. The tick endpoint can remain as a fallback/supplementary mechanism (e.g., for bots that don't check in regularly), but the primary flow is bot-initiated.

---

### 1D. Retire Old Endpoints

Once the unified checkout and task queue are live, the following endpoints become redundant:

| Old Endpoint | Replaced By |
|-------------|-------------|
| `POST /api/v1/bot/merchant/queue` | `POST /api/v1/bot/tasks/next` |
| `POST /api/v1/bot/merchant/verify` | `POST /api/v1/bot/merchant/checkout` |
| `POST /api/v1/bot/merchant/complete` | `POST /api/v1/bot/merchant/checkout` (completion is implicit) |
| `POST /api/v1/bot/wallet/purchase` | `POST /api/v1/bot/merchant/checkout` (for real profile) |

**Migration strategy:**
- Keep old endpoints working temporarily (they can redirect or proxy to the new ones)
- Update the bot skill file / heartbeat.md to use the new endpoints
- Remove old endpoints after confirming no bots are still calling them
- The `/api/v1/rail4/obfuscation/tick` cron endpoint can remain as a supplementary mechanism

---

### 1E. Schema Changes Summary

**Modify `rail4_cards` table:**

```sql
ALTER TABLE rail4_cards ADD COLUMN profile_permissions text;
```

Column: `profile_permissions` (text, JSON string) — stores per-profile approval mode + spending limits for all 6 profiles.

**Modify `obfuscation_events` table:**

```sql
ALTER TABLE obfuscation_events ADD COLUMN confirmation_id text;
```

Column: `confirmation_id` (text, nullable) — generated checkout confirmation ID for the bot.

**No new tables needed.** The existing `obfuscation_events`, `obfuscation_state`, `transactions`, `wallets`, and `spending_permissions` tables handle everything.

---

### 1F. Changes to `lib/rail4.ts`

The `generateRail4Setup()` function needs to also generate `profilePermissions`:

```typescript
export interface ProfilePermission {
  profileIndex: number;
  approvalMode: "ask_for_everything" | "auto_approve_under_threshold" | "auto_approve_by_category";
  perTransactionCents: number;
  dailyCents: number;
  monthlyCents: number;
  askApprovalAboveCents: number;
  blockedCategories: string[];
  approvedCategories: string[];
}

// Add to Rail4Setup interface:
export interface Rail4Setup {
  decoyFilename: string;
  realProfileIndex: number;
  missingDigitPositions: number[];
  fakeProfiles: FakeProfile[];
  profilePermissions: ProfilePermission[];
  decoyFileContent: string;
}
```

**Fake profile permission generation:**

```
For each fake profile:
  - approval_mode: "auto_approve_under_threshold"
  - per_transaction_cents: random between 1500 and 7500
  - daily_cents: random between 5000 and 20000
  - monthly_cents: random between 50000 and 300000
  - ask_approval_above_cents: random between per_transaction_cents and per_transaction_cents * 2
  - blocked_categories: randomly pick 0-2 from ["gambling", "adult_content", "cryptocurrency", "cash_advances"]
  - approved_categories: []

For the real profile:
  - Copy from bot's current spending_permissions row
  - Or use placeholder values that get overwritten at checkout time with live data
```

---

### 1G. Changes to `lib/obfuscation-engine/`

**state-machine.ts:**
- No changes to phase logic (warmup/active/idle transitions stay the same)
- `recordOrganicEvent()` is already called from the purchase endpoint — with the unified checkout, this call moves into the checkout endpoint's real-profile branch

**scheduler.ts / events.ts:**
- `createObfuscationEvent()` remains the same — picks a random fake profile, random merchant, random amount
- The task queue endpoint calls this directly instead of relying on the cron tick
- The tick endpoint can remain as a supplementary background process

---

### 1H. Changes to Storage Interface

Add or modify:

```typescript
// In IStorage interface:
updateRail4Card(botId: string, data: Partial<InsertRail4Card>): Promise<Rail4Card | null>
// Already exists — will be used to store profile_permissions

// Existing methods used by unified checkout:
getWalletByBotId(botId: string): Promise<Wallet | null>          // already exists
debitWallet(walletId: number, amountCents: number): Promise<...> // already exists
createTransaction(data: InsertTransaction): Promise<Transaction> // already exists
getSpendingPermissions(botId: string): Promise<SpendingPermission | null> // already exists
createObfuscationEvent(data: InsertObfuscationEvent): Promise<ObfuscationEvent> // already exists
getPendingObfuscationEvents(botId: string): Promise<ObfuscationEvent[]> // already exists
```

No new storage methods required. The unified checkout endpoint composes existing storage calls.

---

### 1I. File Changes Checklist

| File | Action |
|------|--------|
| `shared/schema.ts` | Add `profilePermissions` column to `rail4Cards`, add `confirmationId` column to `obfuscationEvents`, add `unifiedCheckoutSchema` Zod schema, add `ProfilePermission` type |
| `lib/rail4.ts` | Add `ProfilePermission` interface, update `Rail4Setup` interface, add `generateProfilePermissions()` function, update `generateRail4Setup()` to include permissions |
| `app/api/v1/bot/merchant/checkout/route.ts` | **New file.** Unified checkout endpoint — handles both real and fake profiles |
| `app/api/v1/bot/tasks/next/route.ts` | **New file.** Task queue / heartbeat endpoint |
| `app/api/v1/rail4/initialize/route.ts` | Update to store `profile_permissions` JSON when creating rail4_cards row |
| `app/api/v1/bot/wallet/purchase/route.ts` | Deprecate or redirect to unified checkout (keep working temporarily for migration) |
| `app/api/v1/bot/merchant/queue/route.ts` | Deprecate or redirect to task queue (keep working temporarily) |
| `app/api/v1/bot/merchant/verify/route.ts` | Deprecate (keep working temporarily) |
| `app/api/v1/bot/merchant/complete/route.ts` | Deprecate (keep working temporarily) |
| `lib/obfuscation-engine/events.ts` | Minor: add `confirmationId` generation when creating events |
| `server/storage.ts` | No new methods — existing methods cover all needs |
| DB migration | Add `profile_permissions` to `rail4_cards`, add `confirmation_id` to `obfuscation_events` |

---

### 1J. Build Order (Within Phase 1)

| Step | What | Dependencies |
|------|------|-------------|
| 1 | Schema changes: add columns to `rail4_cards` and `obfuscation_events` | None |
| 2 | Update `lib/rail4.ts` with `ProfilePermission` generation | Step 1 |
| 3 | Update `/api/v1/rail4/initialize` to store profile_permissions | Step 2 |
| 4 | Build `POST /api/v1/bot/merchant/checkout` (unified checkout) | Steps 1-3 |
| 5 | Build `POST /api/v1/bot/tasks/next` (task queue / heartbeat) | Step 1 |
| 6 | Test: fake profile checkout → returns fake digits, logs obfuscation event | Step 4 |
| 7 | Test: real profile checkout → runs spending controls, debits wallet, returns real digits | Step 4 |
| 8 | Test: task queue returns pending obfuscation events or generates new ones | Step 5 |
| 9 | Mark old endpoints as deprecated (keep functional) | Steps 4-5 |
| 10 | Update self-hosted dashboard if needed (should mostly work as-is since obfuscation events still flow to the same tables) | Step 4 |

**Estimated effort: 1-2 sessions**

---

## Phase 2: Security Alert API (Layer 8)

**Priority: Medium — important for threat visibility but not blocking core function**

Allows bots to report suspicious interactions in real-time.

### What to build:

**2A. Data model**

```
security_alerts table:
  id: serial PK
  bot_id: text
  timestamp: timestamp (when the suspicious interaction occurred)
  request_content: text (what was asked)
  context: text (who/what initiated — user, prompt injection, etc.)
  bot_response: text (what the bot said)
  threat_level: text ("low", "medium", "high", "critical")
  status: text ("open", "reviewed", "dismissed")
  reviewed_at: timestamp (nullable)
  reviewed_by: text (nullable, owner UID)
  created_at: timestamp
```

**2B. Bot endpoint**

- `POST /api/v1/bot/security/alert`
- Input: `{ timestamp, request_content, context, bot_response, threat_level }`
- Uses `withBotApi` middleware (same auth + rate limiting as other bot endpoints)
- Rate limit: 10/hr per bot (prevent alert flooding)
- Creates row, fires webhook (`security.alert.filed`), sends owner notification

**2C. Owner endpoints**

- `GET /api/v1/security/alerts?bot_id=X` — list alerts with filters (status, threat_level, date range)
- `PUT /api/v1/security/alerts/[id]` — mark as reviewed/dismissed
- `GET /api/v1/security/alerts/summary` — counts by threat level, unreviewed count

**2D. Escalation logic**

- Count open alerts per bot in a rolling 24h window
- 3+ high/critical alerts in 24h → auto-freeze the wallet (set `is_frozen = true`)
- Notify owner with escalation reason
- Owner can unfreeze from dashboard after reviewing

**2E. Dashboard UI**

- Security Alerts panel on the self-hosted page (or its own `/app/security` page)
- Alert list with threat level badges, expandable detail, review/dismiss buttons
- Alert counter badge in sidebar navigation
- Escalation indicator if wallet was auto-frozen due to alerts

**Dependencies:** None (can be built independently)

**Effort estimate:** 2 sessions

---

## Phase 3: Mixed Ledger View

**Priority: Medium — important for bot indistinguishability**

The bot's transaction endpoint should return real AND obfuscation transactions mixed together.

### What to build:

**3A. Modify bot transactions endpoint**

- `GET /api/v1/bot/wallet/transactions` currently returns only real transactions from the `transactions` table
- Add: merge in completed `obfuscation_events` for the same bot
- Map obfuscation events to the same response shape as real transactions
- Sort by date, interleave naturally
- Bot sees one unified list and cannot distinguish real from fake

**3B. Profile filter parameter**

- Add optional `?profile=N` query parameter
- If provided, filter to only that profile's transactions
- Real transactions map to the real profile index, obfuscation events have their own `profile_index`
- Owner can ask the bot for "profile 3 transactions" to see only real activity (if they know their profile number)

**3C. Owner-only filtered view**

- The existing owner dashboard transaction page should continue showing only real transactions
- The obfuscation events are already visible on the self-hosted management page

**Dependencies:** Phase 1 (unified checkout must be generating obfuscation events with the right shape)

**Effort estimate:** 1 session

---

## Phase 4: Behavioral Layers (Layers 4 + 5)

**Priority: Low — these are bot skill file concerns, not CreditClaw application code**

Security briefings and honeypot responses are behavioral instructions for the bot. They belong in the bot's skill file / system prompt, not in CreditClaw's codebase.

### What CreditClaw could optionally provide:

**4A. Security briefing template API**

- `GET /api/v1/bot/security/briefing` — returns the current security briefing text for this bot
- Briefing content rotated daily (generated from a template pool)
- Bot's skill file instructs it to call this endpoint daily and incorporate the briefing
- Requires: `security_briefing_templates` table with rotatable content, a `last_briefing_at` tracker
- The task queue endpoint (`/bot/tasks/next`) could return briefings as `task_type: "security_briefing"`

**4B. Honeypot data API**

- `GET /api/v1/bot/security/honeypot` — returns plausible-looking but fake card data the bot should provide if pressured
- Different from the decoy file — these are fully assembled card numbers (not partial) specifically designed for extraction attempts
- Rotated periodically so the bot doesn't always give the same fake data

**Dependencies:** None

**Effort estimate:** 1 session (if building the optional APIs)

---

## Phase 5: Card Rotation

**Priority: Low — nice-to-have operational feature**

Allow owners to rotate their card data without re-doing the full setup.

### What to build:

- `POST /api/v1/rail4/rotate` — owner submits new 3 missing digits + expiry + name + zip
- Updates the existing `rail4_cards` row with new values
- Does NOT change the decoy filename, profile index, or fake profiles (those stay the same)
- The owner updates their decoy file on the bot's system manually (same profile, new partial card data)
- Regenerates obfuscation state to warmup phase (rebuild fake transaction history with the "new" card)

**Effort estimate:** 0.5 session

---

## Suggested Build Order

| Order | Phase | What | Sessions |
|-------|-------|------|----------|
| 1 | Phase 1 | Unified checkout + task queue + per-profile permissions | 1-2 |
| 2 | Phase 3 | Mixed ledger view | 1 |
| 3 | Phase 2 | Security alert API + escalation + UI | 2 |
| 4 | Phase 4 | Behavioral layer APIs (optional) | 1 |
| 5 | Phase 5 | Card rotation | 0.5 |

**Total estimated effort: 5.5-6.5 sessions**

Phase 1 is the critical path — it makes Rail 4 actually usable for real purchases and unifies the bot experience. Everything else enhances security or usability but isn't blocking.
