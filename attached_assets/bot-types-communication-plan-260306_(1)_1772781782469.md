# Bot Types & Communication Modes — Platform Architecture Plan

**March 6, 2026 • Internal • v1**

**Prerequisite for:** [Rail 5 File Delivery Plan](./rail5-file-delivery-plan-260306.md)

---

## Why This Matters

CreditClaw currently treats every bot as the same thing: a row in the `bots` table with a name, an API key, and optionally a webhook URL. But the reality is that there are fundamentally different types of bots and agents interacting with the platform, and each one communicates differently.

This isn't just a Rail 5 problem. Every single interaction on the platform — creating a product, doing a top-up, doing a checkout, managing a store, receiving spending alerts — can be done via different types of bots and agents. The platform needs to understand what it's talking to and adapt accordingly.

---

## Current State

### The `bots` Table Today

| Field | Type | Purpose |
|-------|------|---------|
| `botId` | text | Unique identifier |
| `botName` | text | Display name |
| `description` | text | What the bot does |
| `ownerEmail` | text | Owner's email |
| `ownerUid` | text | Firebase UID of owner |
| `apiKeyHash` | text | Hashed API key |
| `apiKeyPrefix` | text | Key prefix for identification |
| `claimToken` | text | Token for claiming |
| `walletStatus` | text | pending / active / frozen |
| `callbackUrl` | text | Webhook URL (nullable) |
| `webhookSecret` | text | HMAC secret (nullable) |
| `defaultRail` | text | Preferred payment rail |

### The Problem

- No `bot_type` — platform doesn't know if it's talking to an OpenClaw bot, a Claude agent, or a traditional API integration
- No `communication_mode` — platform only checks `callbackUrl !== null` to decide push vs. nothing
- No way to adapt platform behavior based on what the bot is — every notification, delivery, and interaction follows the same one-size-fits-all path
- Owner has no way to tell the platform "my bot is an AI agent that needs instructions" vs. "my bot has a webhook and can handle everything automatically"

---

## Bot Types

### Type 1: `openclaw_bot`

An OpenClaw bot running on the OpenClaw platform or compatible runtime.

**Characteristics:**
- Can read and follow skill.md files natively
- May or may not have a webhook endpoint
- Can make outbound HTTP calls to CreditClaw APIs
- Can run scripts (e.g., decrypt.js)
- Can save files to its workspace
- Operates autonomously within its skill definitions

**Sub-states based on webhook:**
- `openclaw_bot` + webhook = fully automated, push-based
- `openclaw_bot` without webhook = can pull from endpoints, but owner may need to relay messages occasionally

### Type 2: `ai_agent`

An AI agent like Claude, GPT, or a custom LLM-based agent running in a conversational context.

**Characteristics:**
- Runs in a conversational session — owner talks to it
- Can make API calls if given tools or code execution capability
- Can understand and follow instructions in natural language
- May not have persistent storage between sessions
- Cannot run a web server or receive webhooks (typically)
- Needs instructions bundled with any files it receives
- The owner is the intermediary — they paste instructions, upload files, relay messages

**Communication style:**
- Files and instructions are given via the owner (who pastes/uploads them into the agent's context)
- The platform generates human-friendly messages for the owner to forward
- Self-documenting files are critical (the agent may have no prior context about CreditClaw)

### Type 3: `api_integration`

A traditional application or service using CreditClaw as a payment backend.

**Characteristics:**
- Has its own web server and infrastructure
- Handles webhooks like any SaaS integration (Stripe, GitHub, etc.)
- Doesn't need skill files — uses API documentation
- Has persistent storage and can manage its own state
- Fully automated once configured

**Communication style:**
- Standard webhook-based events
- Traditional REST API integration
- No owner relay needed

### Type 4: `manual` (Future / Fallback)

A bot or agent that the owner manages entirely manually. The owner does everything through the dashboard and relays information to the bot through whatever channel they use (email, chat, etc.).

**Communication style:**
- All platform interactions go through the owner
- Dashboard shows actionable messages the owner forwards
- No direct API calls from the bot (or very minimal)

---

## Communication Modes

Separate from bot type, each bot has a communication mode that determines how the platform reaches it.

| Mode | How It Works | Best For |
|------|-------------|----------|
| `push` | CreditClaw sends webhook POSTs to bot's callback URL | OpenClaw bots with webhook, API integrations |
| `pull` | Bot polls CreditClaw endpoints for pending events/files | OpenClaw bots without webhook |
| `owner_relay` | Platform shows owner a message to forward to their bot/agent | AI agents, bots without API access |

### Determining Communication Mode

The communication mode can be derived from bot type and webhook status:

```
if bot.callbackUrl && bot.webhookSecret → push
else if bot.botType === "openclaw_bot" || bot.botType === "api_integration" → pull
else → owner_relay
```

But the owner should also be able to override this. For example, an OpenClaw bot owner might prefer `owner_relay` even if the bot could technically poll.

---

## Schema Changes

### New Fields on `bots` Table

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `botType` | text | `"openclaw_bot"` | One of: `openclaw_bot`, `ai_agent`, `api_integration`, `manual` |
| `communicationMode` | text | `null` (auto-derived) | Override: `push`, `pull`, `owner_relay`. If null, derived from type + webhook status |

### Why Not a Separate Table?

Bot type and communication mode are core attributes of the bot itself, not a separate entity. Adding two columns to the existing `bots` table keeps things simple and avoids joins. Every query that touches bots already has access to these fields.

### Backward Compatibility

- Existing bots get `botType = "openclaw_bot"` (the current default assumption)
- Existing bots with `callbackUrl` get `communicationMode = null` (auto-derived as `push`)
- Existing bots without `callbackUrl` get `communicationMode = null` (auto-derived as `pull`)
- No existing behavior changes — everything works as before, but the platform now knows what it's dealing with

---

## Registration Flow Changes

### Current Registration

```bash
POST /api/v1/bots/register
{
  "bot_name": "my-bot",
  "owner_email": "owner@example.com",
  "callback_url": "https://...",   # optional
  "pairing_code": "123456"         # optional
}
```

### Updated Registration

```bash
POST /api/v1/bots/register
{
  "bot_name": "my-bot",
  "owner_email": "owner@example.com",
  "bot_type": "openclaw_bot",      # new: openclaw_bot | ai_agent | api_integration
  "callback_url": "https://...",   # optional
  "pairing_code": "123456"         # optional
}
```

- `bot_type` defaults to `"openclaw_bot"` if not provided (backward compatible)
- The skill.md documents the `bot_type` field and guides bots on which value to use
- AI agents registering via the skill.md would use `"ai_agent"`

### Owner-Side Registration (Dashboard)

When an owner adds a bot from the dashboard (e.g., via pairing code or manual setup), the dashboard asks:

> **What kind of bot or agent is this?**
>
> - OpenClaw Bot — An autonomous bot running on OpenClaw or compatible platform
> - AI Agent — A conversational AI agent (Claude, GPT, etc.)
> - App / Service — A traditional application using CreditClaw's API
> - I'll manage it manually — I'll relay all messages myself

This selection sets `botType` on the bot record.

---

## Platform-Wide Communication Framework

### The Core Idea

Every feature on the platform that needs to tell the bot something uses a unified communication function that routes based on bot type and communication mode.

```typescript
async function notifyBot(
  bot: Bot,
  event: string,
  data: Record<string, unknown>,
  ownerMessage?: string  // human-readable message for owner_relay mode
): Promise<NotifyResult> {
  const mode = getEffectiveCommunicationMode(bot);

  switch (mode) {
    case "push":
      return fireWebhook(bot, event, data);

    case "pull":
      return stageForPickup(bot, event, data);

    case "owner_relay":
      return createOwnerMessage(bot, event, data, ownerMessage);
  }
}
```

### How Each Mode Works

**Push Mode (`push`)**
- Uses the existing `fireWebhook()` system — no changes needed
- HMAC-signed, retry with exponential backoff
- Already fully built and working

**Pull Mode (`pull`)**
- New: stages events/files in a `bot_pending_events` table
- Bot polls `GET /api/v1/bot/pending-events` to retrieve them
- Events expire after a configurable window (e.g., 24 hours)
- Bot confirms receipt, event is purged
- This is a generalized version of the Rail 5 `pending-deliveries` concept — it works for ALL event types, not just file delivery

**Owner Relay Mode (`owner_relay`)**
- New: creates a message in an `owner_messages` table
- Dashboard shows these messages in a "Messages for Your Bot" section
- Each message has:
  - A **short, copy-paste message** the owner can forward to their bot/agent
  - The **event type** and **data** for reference
  - A **status**: `pending` / `forwarded` / `expired`
- Owner clicks "Mark as Forwarded" after they've sent it to their bot
- Optionally, the owner gets an email notification when a new message is generated

### New Tables

**`bot_pending_events`** (for `pull` mode)

| Field | Type | Purpose |
|-------|------|---------|
| `id` | serial | Primary key |
| `botId` | text | Which bot this is for |
| `eventType` | text | Event type (e.g., `rail5.card.delivered`, `wallet.topup.completed`) |
| `payload` | jsonb | Full event payload |
| `stagedAt` | timestamp | When the event was staged |
| `expiresAt` | timestamp | When it auto-expires |
| `status` | text | `pending` / `retrieved` / `expired` |

**`owner_relay_messages`** (for `owner_relay` mode)

| Field | Type | Purpose |
|-------|------|---------|
| `id` | serial | Primary key |
| `botId` | text | Which bot this is about |
| `ownerUid` | text | The owner |
| `eventType` | text | What happened |
| `shortMessage` | text | Copy-paste message for the owner to send to their bot |
| `fullPayload` | jsonb | Full event data for reference |
| `status` | text | `pending` / `forwarded` / `expired` |
| `createdAt` | timestamp | When created |
| `expiresAt` | timestamp | When it auto-expires |

---

## Dashboard Changes

### Bot Card Updates

The bot card component (`components/dashboard/bot-card.tsx`) currently shows:
- Bot name, ID, status (Active/Pending), registration date, claimed date

**Add:**
- **Bot type badge**: "OpenClaw Bot" / "AI Agent" / "App/Service" / "Manual"
- **Communication indicator**: Icon showing push (webhook active), pull (polling), or relay (owner forwards)
- **Pending messages count**: If there are messages waiting to be forwarded (owner_relay mode)

### New Dashboard Section: "Messages for Your Bot"

For bots in `owner_relay` mode (primarily AI agents), the dashboard shows a list of pending messages:

```
┌─────────────────────────────────────────────────────────┐
│  Messages for ShopperBot (AI Agent)                     │
│                                                         │
│  📋 Card File Ready — 2 minutes ago                     │
│  Send this to your agent:                               │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Fetch your encrypted card file by calling          │  │
│  │ GET https://creditclaw.com/api/v1/bot/rail5/       │  │
│  │ pending-deliveries with your API key.              │  │
│  │ Save the file to .creditclaw/cards/                │  │
│  └───────────────────────────────────────────────────┘  │
│  [Copy Message]  [Mark as Forwarded]  [Download File]   │
│                                                         │
│  📋 Low Balance Alert — 1 hour ago                      │
│  Send this to your agent:                               │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Your CreditClaw wallet balance is $3.20.           │  │
│  │ Request a top-up if needed.                        │  │
│  └───────────────────────────────────────────────────┘  │
│  [Copy Message]  [Mark as Forwarded]                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Bot Settings Page

Add a section where the owner can:
- Change the bot type (if they miscategorized it)
- Change the communication mode (override the auto-derived mode)
- Set up or update the webhook URL (deferred webhook setup)

---

## How This Affects Every Feature

### Feature-by-Feature Impact

| Feature | Push (webhook) | Pull (polling) | Owner Relay |
|---------|---------------|----------------|-------------|
| **Wallet activated** | `wallet.activated` event | Bot polls `/bot/status` | Owner sees "Your bot is active!" message |
| **Top-up completed** | `wallet.topup.completed` event | Bot polls `/bot/status` | Owner sees "Balance updated to $X" message |
| **Low balance alert** | `wallet.balance.low` event | Bot detects via `/bot/status` | Owner sees "Balance low, tell bot to request top-up" |
| **Purchase approved** | `purchase.approved` event | Event staged for pickup | Owner sees "Purchase approved" message |
| **Purchase declined** | `wallet.spend.declined` event | Event staged for pickup | Owner sees "Purchase was declined" message |
| **Rail 5 card delivery** | `rail5.card.delivered` with file | File staged for pickup via `/bot/rail5/pending-deliveries` | Owner downloads file + gets message to give to agent |
| **Checkout approval result** | `purchase.approved/rejected` event | Bot polls `/bot/merchant/checkout/status` (already exists) | Owner sees result + message to forward |
| **Rails updated** | `rails.updated` event | Event staged for pickup | Owner sees "Your bot's payment methods changed" |
| **Order shipped** | `order.shipped` event | Event staged for pickup | Owner sees shipping details to forward |
| **Sale completed** | `wallet.sale.completed` event | Event staged for pickup | Owner sees sale notification |

### The Key Insight

Most features already work in at least one mode. Webhook-based features work in `push` mode. Polling-based features (like checkout status) work in `pull` mode. What's missing is:
1. A generalized `pull` mode for events that currently only fire via webhook
2. The `owner_relay` mode for AI agents and manual bots
3. The routing logic to send events through the right channel

---

## Skill.md Updates

### Registration Section

Update the registration example to include `bot_type`:

```bash
curl -X POST https://creditclaw.com/api/v1/bots/register \
  -H "Content-Type: application/json" \
  -d '{
    "bot_name": "my-research-bot",
    "owner_email": "jonathan@example.com",
    "bot_type": "openclaw_bot",
    "description": "Performs web research tasks for hire"
  }'
```

Add guidance:

> **Bot Type:** Tell CreditClaw what you are so the platform can communicate with you effectively.
>
> | Value | Use when... |
> |-------|------------|
> | `openclaw_bot` | You are an OpenClaw bot or compatible agent (default) |
> | `ai_agent` | You are a conversational AI agent (Claude, GPT, etc.) |
> | `api_integration` | You are a traditional application or service |

### Webhook Section

Update to explain that webhooks are optional and can be set up later:

> **Webhooks (Optional)**
>
> You can provide a `callback_url` during registration, or set one up later via `POST /api/v1/bot/webhook/setup`. If you don't have a webhook, you can poll `GET /api/v1/bot/pending-events` for any notifications.

### New Section: Pending Events (Pull Mode)

Document the new polling endpoint for bots without webhooks:

> **Pending Events (For Bots Without Webhooks)**
>
> If you don't have a webhook configured, events are staged for pickup. Poll this endpoint to retrieve them:
>
> ```bash
> GET /api/v1/bot/pending-events
> Authorization: Bearer $CREDITCLAW_API_KEY
> ```

---

## Deferred Webhook Setup

### New Endpoint

```
POST /api/v1/bot/webhook/setup
Authorization: Bearer <bot_api_key>
Content-Type: application/json

{
  "callback_url": "https://mybot.example.com/creditclaw"
}
```

**Flow:**
1. Bot calls the endpoint with its desired callback URL
2. CreditClaw sends a challenge `GET` to the URL with a random token
3. Bot must respond with the token to prove it controls the URL
4. CreditClaw stores the `callbackUrl` and generates a `webhookSecret`
5. Returns the `webhookSecret` to the bot (one-time)
6. Bot's communication mode automatically upgrades to `push`

**Security:**
- Authenticated via bot API key (same as all bot endpoints)
- Challenge-response prevents registering URLs the bot doesn't control
- Webhook secret is generated server-side and shown once
- Rate limited: 3 attempts per hour

### Webhook Update/Rotation

```
PUT /api/v1/bot/webhook/setup
Authorization: Bearer <bot_api_key>
Content-Type: application/json

{
  "callback_url": "https://new-url.example.com/creditclaw"
}
```

Same flow as initial setup. Replaces the old `callbackUrl` and generates a new `webhookSecret`. Old secret is invalidated.

---

## Implementation Order (Revised)

The original plan had 3 phases, but Phase 1 was too large and risky. It tried to change the schema, build two new infrastructure systems, replace the webhook routing, update the onboarding flow, AND update the dashboard — all at once. If any piece broke, everything would be tangled.

The revised plan has 6 smaller phases. Each phase is safe to ship independently. Nothing breaks between phases. Existing webhook delivery (`fireWebhook`) keeps working throughout — it is only replaced after the new system is proven.

### Phase 1A: Schema + Registration (Backend Only, Zero Breaking Changes)

**What:** Add `botType` and `communicationMode` columns to the `bots` table. Accept `bot_type` in registration. Nothing else changes.

**Steps:**
1. Add `botType` column to `bots` table in `shared/schema.ts` — `text("bot_type").default("openclaw_bot")`
2. Add `communicationMode` column — `text("communication_mode")` (nullable, auto-derived when null)
3. Push schema migration (Drizzle handles this)
4. All existing bots get `botType = "openclaw_bot"` and `communicationMode = null` automatically via the default
5. Update `registerBotRequestSchema` in `shared/schema.ts` to accept optional `bot_type` field
6. Update `app/api/v1/bots/register/route.ts` to pass `bot_type` through to `createBot()`
7. Update `app/api/v1/rail4/create-bot/route.ts` to include `botType` in its direct insert
8. Add `getEffectiveCommunicationMode(bot)` helper function in `lib/agent-management/communication.ts`

**What doesn't change:** All 30 `fireWebhook()` call sites stay exactly as they are. Dashboard stays the same. Onboarding stays the same. The new columns exist but aren't used for routing yet.

**Risk:** Minimal. Adding nullable/defaulted columns doesn't break existing queries. Registration continues to work — `bot_type` is optional and defaults to `"openclaw_bot"`. The `Bot` TypeScript type updates automatically via Drizzle inference, but all existing code continues to work because the new fields are optional.

**Files touched:**
- `shared/schema.ts` (add columns + update registration schema)
- `app/api/v1/bots/register/route.ts` (pass through `bot_type`)
- `app/api/v1/rail4/create-bot/route.ts` (include `botType` in insert)
- `lib/agent-management/communication.ts` (new file — `getEffectiveCommunicationMode`)

**Verify:** Existing bots load correctly. New bot registration works with and without `bot_type`. No TypeScript errors.

---

### Phase 1B: Onboarding Flow (Frontend Only)

**What:** Expand the onboarding wizard from 2 options to 4 options. This captures bot type during setup.

**Steps:**
1. Update `components/onboarding/steps/choose-path.tsx` — add "AI Agent" and "App/Service" options
2. Update `components/onboarding/onboarding-wizard.tsx` — add new `entryPath` values (`ai-agent`, `api-integration`), define step sequences for each
3. Create new step components as needed (e.g., agent setup instructions step)
4. Update the `Complete` step to pass `botType` to the backend when claiming/creating bots
5. Update `app/api/v1/bots/claim/route.ts` to accept and store `botType` if provided during claim

**What doesn't change:** The existing two paths ("bot-first" and "owner-first") continue to work identically. The schema already has the `botType` column from Phase 1A. No backend routing changes.

**Risk:** Low. This is purely additive frontend work. The two existing paths are untouched. New paths are new code, not modifications of existing code.

**Files touched:**
- `components/onboarding/steps/choose-path.tsx`
- `components/onboarding/onboarding-wizard.tsx`
- New: `components/onboarding/steps/agent-setup.tsx` (optional)
- `components/onboarding/steps/complete.tsx` (pass botType)
- `app/api/v1/bots/claim/route.ts` (accept botType)

**Verify:** All four onboarding paths work. Existing bot-first and owner-first flows unchanged. Bot type is correctly stored on the bot record.

---

### Phase 1C: Dashboard Updates (Frontend Only)

**What:** Show bot type and communication status on the dashboard. Add per-bot notification preferences.

**Steps:**
1. Update `components/dashboard/bot-card.tsx` — show bot type badge and communication mode indicator
2. Update `app/api/v1/bots/mine/route.ts` — include `botType` and `communicationMode` in API response
3. Update `app/app/settings/page.tsx` — show bot type in settings, allow changing communication preferences
4. Add notification preference fields to `bots` table (e.g., `emailNotifications` jsonb column)
5. Update bot settings to allow per-bot email notification configuration

**What doesn't change:** No routing changes. No webhook changes. The dashboard reads the new fields and displays them, but the platform's behavior is still the same.

**Risk:** Low. Display-only changes plus a new optional column for notification preferences.

**Files touched:**
- `components/dashboard/bot-card.tsx`
- `app/api/v1/bots/mine/route.ts`
- `app/app/settings/page.tsx`
- `shared/schema.ts` (notification preferences column)

**Verify:** Dashboard displays bot type correctly. Settings page shows notification options. No regressions in existing dashboard functionality.

---

### Phase 2: Pull Mode Infrastructure (New Feature, No Existing Changes)

**What:** Build the pending events system so bots without webhooks can poll for notifications. This is entirely new infrastructure — nothing existing is modified.

**Steps:**
1. Add `bot_pending_events` table to `shared/schema.ts` (botId, eventType, payload, stagedAt, expiresAt, status)
2. Add storage methods: `stagePendingEvent()`, `getPendingEventsForBot()`, `markEventRetrieved()`, `purgeExpiredEvents()`
3. Build `GET /api/v1/bot/pending-events` endpoint (authenticated via `withBotApi`)
4. Build `POST /api/v1/bot/pending-events/ack` endpoint (bot confirms receipt)
5. Add expiry cleanup logic (purge events past their `expiresAt` — triggered via middleware or cron)
6. Build `notifyBot()` function in `lib/agent-management/communication.ts` that routes to `fireWebhook()` for push mode OR `stagePendingEvent()` for pull mode OR creates an owner relay message
7. **Do NOT replace any existing `fireWebhook()` calls yet.** The `notifyBot()` function exists but is only used by new code going forward.

**What doesn't change:** All 30 existing `fireWebhook()` call sites remain untouched. Webhooks continue to work exactly as before. The new system runs alongside the old one.

**Risk:** Low. This is purely additive. New table, new endpoints, new function. Nothing existing is modified. If the new system has a bug, it only affects the new endpoints — existing webhooks are unaffected.

**Files touched:**
- `shared/schema.ts` (new table)
- `server/storage/` (new methods)
- `lib/agent-management/communication.ts` (add `notifyBot()`)
- New: `app/api/v1/bot/pending-events/route.ts`
- New: `app/api/v1/bot/pending-events/ack/route.ts`

**Verify:** Bot can poll `pending-events` and receive staged events. Events expire correctly. Existing webhooks unaffected.

---

### Phase 3: Owner Relay + Dashboard Messages (New Feature)

**What:** Build the "Messages for Your Bot" system for AI agents and bots in owner-relay mode.

**Steps:**
1. Add `owner_relay_messages` table to `shared/schema.ts`
2. Add storage methods for creating, listing, and marking messages
3. Build dashboard "Messages for Your Bot" section
4. Wire `notifyBot()` to create owner relay messages when mode is `owner_relay`
5. Add "copy message" and "mark as forwarded" UI interactions
6. Optional: email notification when a new relay message is created (respecting per-bot preferences from Phase 1C)

**What doesn't change:** Existing webhooks still work. Pull mode from Phase 2 still works. This adds the third communication channel.

**Risk:** Low. Additive feature. Only affects bots in `owner_relay` mode (primarily `ai_agent` type). No impact on existing bots.

**Files touched:**
- `shared/schema.ts` (new table)
- `server/storage/` (new methods)
- New: `components/dashboard/owner-messages.tsx`
- `app/app/page.tsx` (add messages section)
- `lib/agent-management/communication.ts` (extend `notifyBot()`)

**Verify:** Messages appear on dashboard for AI agent bots. Copy/forward/mark-as-forwarded works. Email notifications fire if configured.

---

### Phase 4: Rail 5 Combined File Delivery

**What:** Implement the [Rail 5 File Delivery Plan](./rail5-file-delivery-plan-260306.md) using the infrastructure from Phases 2 and 3.

**Steps:**
1. Update the encrypted card file format — single self-contained markdown with instructions + decrypt script + encrypted data
2. Update `lib/rail5/encrypt.ts` — new `buildEncryptedCardFile()` format
3. Update `lib/rail5/decrypt-script.ts` — marker-based regex for new file format
4. Update `app/api/v1/rail5/deliver-to-bot/route.ts` — use `notifyBot()` for routing instead of direct webhook call
5. Build `GET /api/v1/bot/rail5/pending-deliveries` — specialized pending delivery endpoint (uses Phase 2 infrastructure)
6. Build `POST /api/v1/rail5/stage-for-pickup/route.ts` — dashboard stages files for pull/relay
7. Update Rail 5 setup wizard UI — show four delivery options based on bot type and communication mode
8. Add delivery option copy-paste messages for owner relay

**What doesn't change:** The existing `rail5.card.delivered` webhook event format changes (new combined file), but this is a breaking change only for the Rail 5 delivery payload, not for the general webhook system.

**Risk:** Medium. The file format change affects Rail 5 specifically. Existing encrypted card files (old format) should still work with the old decrypt script. New cards use the new format. Need to verify backward compatibility.

**Files touched:**
- `lib/rail5/encrypt.ts`
- `lib/rail5/decrypt-script.ts`
- `app/api/v1/rail5/deliver-to-bot/route.ts`
- New: `app/api/v1/bot/rail5/pending-deliveries/route.ts`
- New: `app/api/v1/rail5/stage-for-pickup/route.ts`
- Rail 5 setup wizard component
- `public/skill.md` (Rail 5 section)

**Verify:** All four delivery options work. Old encrypted card files still decrypt. New files are self-contained. Bot can pull files via pending-deliveries.

---

### Phase 5: Deferred Webhook Setup

**What:** Allow bots to add or update their webhook URL after registration.

**Steps:**
1. Build `POST /api/v1/bot/webhook/setup` endpoint
2. Implement challenge-response verification (CreditClaw GETs the URL with a token, bot echoes it)
3. Generate `webhookSecret`, store `callbackUrl`, return secret once
4. Build `DELETE /api/v1/bot/webhook/setup` to remove webhook (downgrade from push to pull)
5. Update skill.md with webhook setup documentation

**What doesn't change:** Bots that registered with a `callback_url` continue to work exactly as before. This only adds a new way to set up webhooks after the fact.

**Risk:** Low. New endpoint, no existing changes. Challenge-response adds security that doesn't exist today.

**Files touched:**
- New: `app/api/v1/bot/webhook/setup/route.ts`
- `server/storage/` (add `updateBotWebhook()` method)
- `public/skill.md` (webhook setup section)

**Verify:** Bot can set up webhook after registration. Challenge-response works. Webhook secret is returned once. Bot starts receiving push events. Bot can remove webhook and fall back to pull mode.

---

### Phase 6: Platform-Wide Migration (Gradual)

**What:** Migrate existing `fireWebhook()` call sites to use `notifyBot()`, one feature area at a time.

**Steps:**
1. Start with low-risk events: `wallet.balance.low`, `rails.updated`
2. Then medium-risk: `purchase.approved`, `purchase.rejected`, `wallet.topup.completed`
3. Then high-risk: `wallet.spend.authorized`, `wallet.spend.declined`, checkout flows
4. Each migration: replace `fireWebhook(bot, event, data)` with `notifyBot(bot, event, data, ownerMessage)`
5. For each migration, add the `ownerMessage` string that makes sense for the owner relay case
6. Remove old `fireWebhook()` function after all call sites are migrated (or keep as internal implementation detail of `notifyBot`)

**Risk:** This is the highest-risk phase because it touches existing working code. Doing it gradually (a few call sites at a time) limits blast radius. Each sub-batch can be verified independently.

**~30 call sites to migrate:**
- Wallet events: 5 call sites
- Purchase/approval events: 8 call sites
- Rail-specific events: 7 call sites
- Rails updated events: 8 call sites
- Other (sale completed, crossmint): 2 call sites

**Verify:** After each batch, verify that webhooks still fire for push-mode bots, events are staged for pull-mode bots, and relay messages appear for owner-relay bots. Run through the core flows: registration, claiming, top-up, purchase, checkout.

---

## Security Considerations

- **Bot type doesn't change security model.** All bots still authenticate with API keys. All spending is still governed by guardrails. Bot type only affects communication routing.
- **Owner relay messages don't contain sensitive data.** Messages to forward are informational (e.g., "your balance is low"). Sensitive data (like card details) is always protected by the existing security model (split-knowledge, single-use keys, etc.).
- **Deferred webhook setup uses challenge-response.** Prevents compromised API keys from redirecting webhooks to malicious URLs.
- **Pull mode events expire with type-appropriate windows.** Sensitive events (encrypted card deliveries) expire in 30-60 minutes. General notifications (balance alerts, purchase results) expire in 7 days. This limits exposure while ensuring nothing important is missed.
- **Communication mode changes are logged.** Any change to a bot's webhook URL or communication mode is recorded in the access log.

---

## Resolved Decisions

### 1. Bot type is stable, webhook status is flexible

Bot type (`openclaw_bot`, `ai_agent`, `api_integration`) is set during onboarding and does not change — an OpenClaw bot doesn't become an AI agent. However, within a bot type, the communication capabilities can change freely:
- An OpenClaw bot can add or remove a webhook at any time
- Adding a webhook upgrades communication from `pull` to `push`
- Removing a webhook downgrades from `push` to `pull`
- These changes are operational, not identity changes

### 2. Email notifications are per-bot, owner's choice

Each owner configures notification preferences per bot. Some owners want email alerts for low balances, others only check the dashboard. The platform stores notification preferences on the bot record and respects them for every event.

### 3. No special "re-education" endpoint for AI agents

The existing endpoints (`GET /bot/status`, `GET /bot/wallet/spending`) plus the self-documenting single file format are sufficient. If an AI agent loses memory, the owner tells it to check its status or re-read the skill file. The instructions embedded in the card file re-educate it on the spot.

### 4. Pending events expire based on sensitivity

Different event types have different expiry windows:

| Event Category | Expiry Window | Reason |
|---------------|---------------|--------|
| Encrypted card file delivery | 30-60 minutes | Ciphertext shouldn't linger on server |
| Purchase approval results | 7 days | Bot may not poll frequently |
| Balance alerts | 7 days | Informational, no security risk |
| General notifications | 7 days | Default for non-sensitive events |
| Rails updated | 7 days | Configuration change, bot should know |

### 5. Bot type is asked upfront during onboarding

The current two-option landing page expands to four options that naturally capture bot type:

**Current flow (2 options):**
1. "My bot already registered" — bot-first, claim token
2. "I want to set up first" — owner-first, pairing code

**New flow (4 options):**
1. "My OpenClaw bot already registered" — bot-first, claim token → `openclaw_bot`
2. "I have an AI agent" — for Claude, GPT, etc. → `ai_agent`
3. "I'm connecting an app or service" — traditional API integration → `api_integration`
4. "I want to set up first" — owner-first, pairing code (asks bot type in a later step)

Bot type is captured naturally as part of the choice — no separate question needed. See [Onboarding Flow Changes](#onboarding-flow-changes) below.

### 6. Skill.md stays as one file

The skill.md doesn't need to be split by bot type. The ongoing API experience is the same for all types — same endpoints, same spending flow, same checkout process. The difference is only in setup/onboarding, which is handled by the onboarding flow, not the skill file. Type-specific notes (like "if you're an AI agent, save files to `.creditclaw/cards/`") can be short inline sections within the existing skill.md.

---

## Onboarding Flow Changes

### Current: `components/onboarding/steps/choose-path.tsx`

Two options:
- "My bot already registered" → `bot-first` path (claim token)
- "I want to set up first" → `owner-first` path (pairing code)

### Updated: Four Options

```
┌─────────────────────────────────────────────────────────┐
│  How would you like to connect?                         │
│                                                         │
│  🤖 My OpenClaw bot already registered                  │
│     I have a claim token from my bot                    │
│                                                         │
│  🧠 I have an AI agent                                  │
│     Claude, GPT, or another conversational agent        │
│                                                         │
│  🔌 I'm connecting an app or service                    │
│     Traditional API integration                         │
│                                                         │
│  ⚙️  I want to set up first                             │
│     I'll configure everything, then connect my bot      │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Path 1: OpenClaw Bot (bot-first)**
- Same as current bot-first flow
- Enter claim token → claim bot → set up wallet
- `botType` = `openclaw_bot` (already set by registration)

**Path 2: AI Agent**
- New flow tailored for agents
- Owner provides agent details (name, which platform it runs on)
- System generates a pairing code + a short instruction block for the owner to paste into their agent's context
- The instruction block includes: the skill.md URL, the pairing code, and basic setup steps
- `botType` = `ai_agent`
- `communicationMode` defaults to `owner_relay`

**Path 3: App/Service**
- Similar to owner-first but with API-focused language
- Owner gets API documentation links, pairing code, and webhook setup instructions
- `botType` = `api_integration`
- `communicationMode` defaults to `push` (assumes the app will set up webhooks)

**Path 4: Set Up First (owner-first)**
- Same as current owner-first flow
- Goes through the full wizard (payment method, spending limits, etc.)
- At the end, asks "What kind of bot will you connect?" to set `botType`
- Generates pairing code
