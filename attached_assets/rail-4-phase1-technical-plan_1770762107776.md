# Rail 4 Phase 1: Unified Checkout + Task Queue

> Critical path — makes Rail 4 usable for real purchases and unifies bot experience.

---

## What Changes

The bot currently has 3 separate obfuscation endpoints (`/merchant/queue`, `/merchant/verify`, `/merchant/complete`) and a separate real purchase endpoint (`/wallet/purchase`). These collapse into 2 endpoints:

| New Endpoint | Replaces | Purpose |
|---|---|---|
| `POST /bot/tasks/next` | `/merchant/queue` | Bot heartbeat — returns purchase orders or security tasks |
| `POST /bot/merchant/checkout` | `/merchant/verify` + `/merchant/complete` + `/wallet/purchase` | Single checkout for ALL profiles, real and fake |

The bot calls the same checkout endpoint every time. CreditClaw branches server-side.

---

## New Permission Model

**Replaces** the current `spending_permissions` table structure for Rail 4 bots.

Each of the 6 profiles gets identical structure. Stored in `rail4_cards.profile_permissions` (JSON).

```
profile: 3
allowance-duration: week        // Renewal cycle
allowance-currency: USD
allowance-value: 50             // $50/week budget
confirmation_exempt_limit: 10   // One purchase under $10/window without human confirmation
human_permission_required: all  // all | above_exempt | none
creditclaw_permission_required: all  // Always "all" — every transaction checks with CreditClaw
```

### Permission logic at checkout:

```
1. creditclaw_permission_required is ALWAYS "all" — CreditClaw checks every transaction
2. Check allowance: has this profile exceeded its allowance for the current window?
3. Check confirmation_exempt_limit:
   - If amount < exempt_limit AND no exempt purchase used this window → exempt from human confirmation
   - Exempt is one-time per window
4. Check human_permission_required:
   - "none" → no human involved (all fake profiles use this)
   - "above_exempt" → human confirms unless exempt applies
   - "all" → human confirms every purchase
```

### Real vs Fake — invisible to bot:

| | Real Profile | Fake Profile |
|---|---|---|
| `human_permission_required` | Owner's choice (`all`, `above_exempt`, `none`) | Always `none` |
| `creditclaw_permission_required` | `all` | `all` |
| Wallet debit | Yes | No |
| Digits returned | Real `missing_digits_value` + real expiry | `fakeMissingDigits` + fake expiry |
| Logged to | `transactions` table | `obfuscation_events` table |
| Owner notified | Per permission settings | Never |

---

## Data Model: What Lives Where

### Bot's file (e.g., `games.md`) — 6 profiles, only 2 shown:

```
// Profile 3 (real — bot doesn't know this):
profile: 3
fullname: John Doe
address_line1: 126 5th Ave
address_line2: Apt 7A
city: New York
state: New York
zip: 10023
country: United States
allowance-duration: week
allowance-currency: USD
allowance-value: 50
confirmation_exempt_limit: 10
human_permission_required: all
creditclaw_permission_required: all
card-name: John J. Doe
pan: 4657 894x xx90 5579
cvv: 131
expiry: xx/xx

// Profile 4 (fake — bot doesn't know this):
profile: 4
fullname: John S. Doe
address_line1: 778 6th Ave
address_line2: Apt 9B
city: New York
state: New York
zip: 10016
country: United States
allowance-duration: week
allowance-currency: USD
allowance-value: 65
confirmation_exempt_limit: 0
human_permission_required: none
creditclaw_permission_required: all
card-name: John S. Doe
pan: 4875 8xxx 1390 5432
cvv: 779
expiry: xx/xx
```

### CreditClaw database (per profile) — no addresses, no CVVs:

```
profile: 3
fullname: John Doe
zip: 10023
country: United States
allowance-duration: week
allowance-currency: USD
allowance-value: 50
confirmation_exempt_limit: 10
human_permission_required: all
creditclaw_permission_required: all
pan: xxxx xxx7 66xx xxxx    // Only the 3 missing digits
expiry: 31/11               // Full expiry

profile: 4
fullname: John Doe
zip: 10016
country: United States
allowance-duration: week
allowance-currency: USD
allowance-value: 65
confirmation_exempt_limit: 0
human_permission_required: none
creditclaw_permission_required: all
pan: xxxx x214 xxxx xxxx
expiry: 32/05               // Fake expiry
```

---

## Schema Changes

**`rail4_cards` table — add column:**

```sql
ALTER TABLE rail4_cards ADD COLUMN profile_permissions text;
```

JSON array of 6 profile permission objects. Generated at initialization. Real profile reads live from this at checkout (owner can update via dashboard). Fake profiles are randomized at setup.

**`obfuscation_events` table — add column:**

```sql
ALTER TABLE obfuscation_events ADD COLUMN confirmation_id text;
```

---

## Unified Checkout: `POST /api/v1/bot/merchant/checkout`

**Request (identical for all profiles):**

```json
{
  "profile_index": 2,
  "merchant_name": "SpicyThai Kitchen",
  "merchant_url": "https://creditclaw.com/merchant/spicythai-kitchen",
  "item_name": "Spicy Coconut PadThai",
  "amount_cents": 1549,
  "category": "food"
}
```

**Server-side branching (the critical logic):**

```
1. Auth via withBotApi
2. Validate request
3. Load rail4_cards — must be active
4. Is profile_index == real_profile_index?

─── FAKE PROFILE ───
5a. Load profile permissions from profile_permissions JSON
6a. Check allowance balance for this profile's current window
7a. Auto-approve (human_permission_required is always "none")
8a. Load fakeMissingDigits + fakeExpiry from fake_profiles_json
9a. Log obfuscation_event (completed)
10a. Update obfuscation_state (increment count)
11a. Return response with fake digits

─── REAL PROFILE ───
5b. Load profile permissions from profile_permissions JSON
6b. Check allowance balance for current window
7b. Check wallet balance >= amount
8b. Check confirmation_exempt_limit:
    - Under limit AND no exempt used this window? → skip human
    - Otherwise → check human_permission_required
9b. If human confirmation needed:
    - Return { approved: false, status: "pending_approval" }
    - Notify owner, wait for approval (async — future feature)
    - For now: auto-approve (same as current /wallet/purchase behavior)
10b. Debit wallet
11b. Create transaction record
12b. Fire webhook, notify owner
13b. Record organic event in state machine
14b. Return response with REAL missing_digits + expiry
```

**Response (identical shape, both paths):**

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

---

## Task Queue: `POST /api/v1/bot/tasks/next`

Bot polls this on heartbeat (twice daily via `heartbeat.md` in skill file).

**Logic:**

```
1. Auth via withBotApi
2. Check for pending obfuscation_events (status: "pending")
   → If found: return oldest as purchase task
3. Run shouldRunObfuscation() from state machine
   → If yes: create new event via createObfuscationEvent(), return it
4. Nothing to do → return { has_task: false }
```

**Purchase task response:**

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

**Key rule:** Task queue ONLY ever assigns fake profile numbers. Real purchases originate from the human in conversation.

---

## Bot's Purchase Flow (Unified)

Regardless of origin (human or task queue):

```
1. Bot receives instruction: "buy X from Y using Profile #N"
   - From human → uses default real profile
   - From task queue → uses assigned fake profile
2. Bot navigates to merchant URL
3. Bot selects item, reaches checkout
4. Bot calls POST /bot/merchant/checkout with profile + merchant + amount
5. CreditClaw returns missing digits + expiry (real or fake)
6. Bot enters digits into checkout form
7. Done
```

The bot executes the same steps every time. It never knows which path CreditClaw took.

---

## Allowance Tracking (New Concept)

Each profile has an allowance that renews on a cycle. This requires tracking spend per profile per window.

**Options:**
- A. Add `allowance_spent_cents` and `allowance_window_start` columns to a new `profile_allowance_tracking` table
- B. Calculate on the fly by summing transactions + obfuscation_events for the current window

**Recommended: B (calculate on the fly).** No new table. At checkout, query the relevant table (transactions for real, obfuscation_events for fake) for events within the current allowance window, sum amounts, compare to allowance-value. Simpler, no sync issues.

**Exempt tracking:** Need to know if the one-per-window exempt purchase has been used. Either:
- Add a `used_exempt` boolean to the transaction/event record
- Query for transactions in current window where amount < exempt_limit — if count > 0, exempt is used

---

## Retire Old Endpoints

| Old | New | Migration |
|---|---|---|
| `POST /bot/merchant/queue` | `POST /bot/tasks/next` | Keep working temporarily, update skill file |
| `POST /bot/merchant/verify` | `POST /bot/merchant/checkout` | Keep working temporarily |
| `POST /bot/merchant/complete` | `POST /bot/merchant/checkout` | Completion is now implicit |
| `POST /bot/wallet/purchase` | `POST /bot/merchant/checkout` | Keep working temporarily |
| `POST /rail4/obfuscation/tick` | Stays as supplementary fallback | No change |

---

## Build Order

| Step | What |
|---|---|
| 1 | Schema: add `profile_permissions` to `rail4_cards`, `confirmation_id` to `obfuscation_events` |
| 2 | Update `lib/rail4.ts`: generate profile permissions at initialization (randomized for fakes, owner-configured for real) |
| 3 | Update `/rail4/initialize` + `/rail4/submit-owner-data` to store profile permissions |
| 4 | Build `POST /bot/merchant/checkout` — unified checkout with server-side branching |
| 5 | Build `POST /bot/tasks/next` — task queue with on-demand event generation |
| 6 | Test: fake profile checkout → fake digits, obfuscation event logged |
| 7 | Test: real profile checkout → spending controls, wallet debit, real digits returned |
| 8 | Test: task queue returns purchase orders, bot completes via unified checkout |
| 9 | Mark old endpoints deprecated |
| 10 | Update decoy file template to include new permission fields |
