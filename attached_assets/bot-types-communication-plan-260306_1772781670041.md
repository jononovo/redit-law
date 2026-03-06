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

## Implementation Order

### Phase 1: Foundation (This Plan)

1. **Schema update** — Add `botType` and `communicationMode` columns to `bots` table
2. **Migration** — Set existing bots to `botType = "openclaw_bot"`, `communicationMode = null`
3. **Registration update** — Accept `bot_type` in registration, default to `"openclaw_bot"`
4. **Communication mode derivation** — `getEffectiveCommunicationMode()` function
5. **Pull mode infrastructure** — `bot_pending_events` table + `GET /api/v1/bot/pending-events` endpoint
6. **Owner relay infrastructure** — `owner_relay_messages` table + dashboard "Messages for Your Bot" section
7. **Unified `notifyBot()` function** — Routes events to the correct channel based on mode
8. **Dashboard updates** — Bot type badge, communication indicator, bot type selector during setup
9. **Deferred webhook setup** — `POST /api/v1/bot/webhook/setup` with challenge-response

### Phase 2: Rail 5 Delivery (Updated)

The [Rail 5 File Delivery Plan](./rail5-file-delivery-plan-260306.md) is updated to use the bot type system:
- Delivery routing uses `notifyBot()` instead of direct webhook calls
- The four delivery options map to communication modes:
  - Option 1 (webhook push) → `push` mode
  - Option 2 (bot pulls) → `pull` mode
  - Option 3 (owner downloads) → `owner_relay` mode
  - Option 4 (agent instructions) → `owner_relay` mode for `ai_agent` type
- The combined single-file format stays the same
- The pending-deliveries endpoint becomes a specific case of the general `pending-events` system

### Phase 3: Platform-Wide Rollout

- Update all existing `fireWebhook()` calls across the codebase to use `notifyBot()` instead
- Each feature gets the three-mode treatment (push / pull / owner_relay)
- Dashboard shows the "Messages for Your Bot" section populated with real events
- Skill.md updated with full documentation

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
