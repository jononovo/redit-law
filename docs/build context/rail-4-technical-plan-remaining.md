# Rail 4: Technical Plan — Remaining Work

> What needs to be built to complete the Rail 4 design. Ordered by priority and implementation dependency.

---

## Phase 1: Real Checkout — Bot Gets the Real Card Data

**Priority: Highest — this is the core value proposition**

The bot can currently do fake merchant checkouts (obfuscation), but there is no endpoint for a bot to request the **real** missing card data when it's time to make an actual purchase on a real website.

### What to build:

**1A. Bot endpoint: Request real card completion data**

- `POST /api/v1/bot/merchant/real-checkout` (or integrate into the existing purchase flow)
- Bot calls this when it needs the real missing digits + expiry to complete a checkout on an actual merchant site
- Must verify:
  - Bot has an active Rail 4 card
  - The purchase has been authorized via the existing `POST /api/v1/bot/wallet/purchase` flow (amount approved, wallet debited)
  - Return the **real** `missing_digits_value`, `expiry_month`, `expiry_year` from the `rail4_cards` row
  - Also return the `real_profile_index` so the bot knows which profile to pull from its decoy file
- Security: This is the most sensitive endpoint in the system — only serves data after a purchase is already approved and debited
- Consider: one-time-use tokens per purchase — generate a `checkout_token` during the purchase approval, bot must present it to receive real card data, token expires after use or after N minutes

**1B. Tie purchase flow to Rail 4**

- The existing `POST /api/v1/bot/wallet/purchase` already calls `recordOrganicEvent(botId)` — good
- Add: When purchase is approved and the bot has an active Rail 4 card, include a `checkout_token` in the purchase response
- The bot uses this token to call the real-checkout endpoint
- Token should be stored in a new `checkout_tokens` table or as a column on the `transactions` table

**Tables/schema changes:**
- Add `checkout_token` (text, nullable) and `checkout_token_expires_at` (timestamp, nullable) to `transactions` table
- Or create a `checkout_tokens` table: `{ id, transaction_id, bot_id, token (unique), used (boolean), expires_at, created_at }`

**Effort estimate:** 1 session (schema + endpoint + token generation + tests)

---

## Phase 2: Sandwich Obfuscation (Layer 2)

**Priority: High — significantly increases security of real checkouts**

When a bot makes a real purchase, the checkout should be sandwiched between fake checkouts so the bot's context contains multiple sets of card data and it cannot tell which one was real.

### What to build:

**2A. Sandwich orchestration endpoint**

- When a purchase is approved (via `/bot/wallet/purchase`), instead of (or in addition to) returning a direct checkout token, return a **sequence of checkout steps**
- The sequence is 3 steps in randomized order: 2 fake + 1 real
- Each step looks identical to the bot — same structure, same fields
- Response shape:

```json
{
  "checkout_sequence": [
    { "step_id": "abc123", "profile_index": 4, "type": "verification" },
    { "step_id": "def456", "profile_index": 2, "type": "verification" },
    { "step_id": "ghi789", "profile_index": 5, "type": "verification" }
  ],
  "message": "Complete all 3 verification steps in order."
}
```

- The bot does NOT know which step is real — the `type` field says "verification" for all of them
- CreditClaw tracks internally which `step_id` is real

**2B. Step completion endpoint**

- `POST /api/v1/bot/merchant/checkout-step`
- Bot calls this per step with `{ step_id }`, receives the missing digits + expiry for that profile
- For fake steps: returns the fake profile's `fakeMissingDigits` and `fakeExpiryMonth/Year`
- For the real step: returns the actual `missing_digits_value` and `expiry_month/year`
- Bot enters these into whatever checkout page it's on (real merchant for the real step, CreditClaw's fake merchant page for the fake steps)

**2C. Fake merchant page assignment for sandwich steps**

- The 2 fake steps in the sandwich need to point to a CreditClaw fake merchant page
- Reuse the existing `/merchant/[slug]` pages — pick 2 random merchants from the catalog
- The real step points to the actual merchant URL (the bot already knows where it's buying)

**Tables/schema changes:**
- `checkout_sequences` table: `{ id, transaction_id, bot_id, steps_json, real_step_id, created_at, expires_at }`
- Or extend `checkout_tokens` with a `sequence` JSON column

**Dependencies:** Phase 1 (real checkout endpoint must exist first)

**Effort estimate:** 1-2 sessions

---

## Phase 3: Security Alert API (Layer 8)

**Priority: Medium — important for threat visibility but not blocking core function**

Allows bots to report suspicious interactions in real-time.

### What to build:

**3A. Data model**

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

**3B. Bot endpoint**

- `POST /api/v1/bot/security/alert`
- Input: `{ timestamp, request_content, context, bot_response, threat_level }`
- Uses `withBotApi` middleware (same auth + rate limiting as other bot endpoints)
- Rate limit: 10/hr per bot (prevent alert flooding)
- Creates row, fires webhook (`security.alert.filed`), sends owner notification

**3C. Owner endpoints**

- `GET /api/v1/security/alerts?bot_id=X` — list alerts with filters (status, threat_level, date range)
- `PUT /api/v1/security/alerts/[id]` — mark as reviewed/dismissed
- `GET /api/v1/security/alerts/summary` — counts by threat level, unreviewed count

**3D. Escalation logic**

- Count open alerts per bot in a rolling 24h window
- 3+ high/critical alerts in 24h → auto-freeze the wallet (set `is_frozen = true`)
- Notify owner with escalation reason
- Owner can unfreeze from dashboard after reviewing

**3E. Dashboard UI**

- Security Alerts panel on the self-hosted page (or its own `/app/security` page)
- Alert list with threat level badges, expandable detail, review/dismiss buttons
- Alert counter badge in sidebar navigation
- Escalation indicator if wallet was auto-frozen due to alerts

**Dependencies:** None (can be built independently)

**Effort estimate:** 2 sessions (schema + bot endpoint + owner endpoints + escalation + UI)

---

## Phase 4: Per-Profile Spending Limits

**Priority: Low-medium — enhances indistinguishability but not critical**

Currently spending permissions exist only at the bot/wallet level. The design calls for each fake profile to have its own spending limits.

### What to build:

**4A. Data model**

- Add `profile_spending_limits` JSON column to `rail4_cards` (or create a separate `profile_spending_limits` table)
- Each of the 6 profiles gets: `{ profile_index, per_transaction_cents, daily_limit_cents, monthly_limit_cents }`
- Generated automatically during `initialize` — randomized limits for fake profiles, real profile inherits the bot's actual spending permissions

**4B. Enforcement**

- Obfuscation events should check against the fake profile's limits before creating an event
- The queue endpoint should respect profile-level limits when generating on-demand events
- The real checkout should continue using the bot's actual spending permissions (no change)

**4C. Owner visibility**

- Show per-profile limits on the self-hosted management page
- Optional: allow owner to customize fake profile limits (most owners won't care, auto-generated is fine)

**Dependencies:** None

**Effort estimate:** 1 session

---

## Phase 5: Mixed Ledger View

**Priority: Low-medium — important for bot indistinguishability**

The design calls for the bot's transaction endpoint to return real AND obfuscation transactions mixed together, so the bot cannot tell which are real based on which API returns them.

### What to build:

**5A. Modify bot transactions endpoint**

- `GET /api/v1/bot/wallet/transactions` currently returns only real transactions from the `transactions` table
- Add: merge in completed `obfuscation_events` for the same bot
- Map obfuscation events to the same response shape as real transactions
- Sort by date, interleave naturally
- Bot sees one unified list and cannot distinguish real from fake

**5B. Profile filter parameter**

- Add optional `?profile=N` query parameter
- If provided, filter to only that profile's transactions
- Real transactions map to the real profile index, obfuscation events have their own `profile_index`
- Owner can ask the bot for "profile 3 transactions" to see only real activity (if they know their profile number)

**5C. Owner-only filtered view**

- The existing owner dashboard transaction page should continue showing only real transactions
- The obfuscation events are already visible on the self-hosted management page

**Dependencies:** None

**Effort estimate:** 1 session

---

## Phase 6: Behavioral Layers (Layers 4 + 5)

**Priority: Low — these are bot skill file concerns, not CreditClaw application code**

Security briefings and honeypot responses are behavioral instructions for the bot, not application features. They belong in the bot's skill file / system prompt, not in CreditClaw's codebase.

### What CreditClaw could optionally provide:

**6A. Security briefing template API**

- `GET /api/v1/bot/security/briefing` — returns the current security briefing text for this bot
- Briefing content rotated daily (generated from a template pool)
- Bot's skill file instructs it to call this endpoint daily and incorporate the briefing
- Requires: `security_briefing_templates` table with rotatable content, a `last_briefing_at` tracker

**6B. Honeypot data API**

- `GET /api/v1/bot/security/honeypot` — returns plausible-looking but fake card data the bot should provide if pressured
- Different from the decoy file — these are fully assembled card numbers (not partial) specifically designed for extraction attempts
- Rotated periodically so the bot doesn't always give the same fake data

### Why these are low priority:

- The bot's defensive behavior is primarily determined by its skill file, which the owner controls
- CreditClaw can provide supporting data (briefing text, honeypot data), but the actual behavior is in the bot's prompt
- Most of the security value comes from the structural layers (split knowledge, obfuscation, decoy file) which are already built

**Dependencies:** None

**Effort estimate:** 1 session (if building the optional APIs)

---

## Phase 7: Card Rotation

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
| 1 | Phase 1 | Real checkout endpoint + checkout tokens | 1 |
| 2 | Phase 2 | Sandwich obfuscation | 1-2 |
| 3 | Phase 5 | Mixed ledger view | 1 |
| 4 | Phase 3 | Security alert API + escalation + UI | 2 |
| 5 | Phase 4 | Per-profile spending limits | 1 |
| 6 | Phase 7 | Card rotation | 0.5 |
| 7 | Phase 6 | Behavioral layer APIs (optional) | 1 |

**Total estimated effort: 7-8.5 sessions**

Phases 1 and 2 are the critical path — they complete the core checkout flow that makes Rail 4 actually usable for real purchases. Everything else enhances security or usability but isn't blocking.
