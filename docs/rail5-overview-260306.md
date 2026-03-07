# Rail 5: Sub-Agent Cards — Technical Overview

**March 6, 2026 • Internal • v3**

---

## What Rail 5 Is

Rail 5 lets a bot purchase from any merchant using an encrypted card file that CreditClaw can't read and a decryption key that's only ever handed to a disposable sub-agent. CreditClaw holds zero card data. The bot's main agent never sees card details or the decryption key.

**Owner holds:** An encrypted `.md` file containing full card details (e.g., `Card-Harry-26-Visa.md`). Also available as a backup download.
**Bot holds:** The encrypted `.md` file — delivered via webhook, staged pending message, or placed manually by the owner.
**CreditClaw holds:** The AES-256-GCM decryption key (key, IV, auth tag). No card data. No encrypted card data. Not PCI-scoped.
**Main agent holds:** A reference to the encrypted file. Can't decrypt it.
**Sub-agent (ephemeral):** Gets the key from CreditClaw, decrypts, checks out, announces result, gets deleted.

### Split-Knowledge Security Model

CreditClaw and the bot each hold one half of the secret. Neither can access card data alone.

| Entity | Holds | Can decrypt? |
|---|---|---|
| CreditClaw | Decryption key (key/IV/tag) | No — has no ciphertext |
| Bot | Encrypted card file | No — has no key |
| Owner | Backup copy of encrypted file | No — has no key |
| Sub-agent (ephemeral) | Key + file (momentarily) | Yes — then deleted |

The encrypted card file **never** persists on CreditClaw's servers. During direct delivery, the ciphertext passes through server memory transiently and is immediately discarded after relay. No database write occurs.

---

## How Rail 5 Differs from Rail 4

Rail 5 is **autonomous from Rail 4**. Own table, own folder, own page, own endpoints. It shares only platform-level infrastructure.

| | Rail 5 | Rail 4 |
|---|---|---|
| CreditClaw stores card data | **No** — only the decryption key | Yes — 3 missing digits + expiry |
| CreditClaw stores encrypted card | **No** — transient relay only | N/A |
| Card file format | 1 encrypted profile | 6 profiles (5 fake + 1 real) |
| Obfuscation engine | Not used | Core feature |
| Fake profiles | None | 5 per card |
| Main agent sees card details | Never | Yes (assembles at checkout) |
| Sub-agent required | Yes (OpenClaw) | No |
| Dashboard page | `/app/sub-agent-cards` | `/app/self-hosted` |
| DB table | `rail5_cards` | `rail4_cards` |
| API folder | `/api/v1/rail5/*` + `/api/v1/bot/rail5/*` | `/api/v1/rail4/*` + `/api/v1/bot/merchant/*` |

**Shared platform infrastructure** (not duplicated): `withBotApi` middleware, bot auth (`lib/agent-management/auth.ts`), wallet + spending controls, master guardrails, webhooks, notifications, rate limiting.

---

## File Structure

```
lib/
  rail5/
    index.ts                                 # Spawn payload builder, validation helpers
    encrypt.ts                               # Server-side encryption utilities
    decrypt-script.ts                        # Deterministic decrypt script content
  card/onboarding-rail5/
    encrypt.ts                               # Client-side AES-256-GCM encryption + file builder
    interactive-card.tsx                      # Visual card input component
  agent-management/
    bot-messaging/
      index.ts                               # sendToBot() — universal delivery function
      expiry.ts                              # Per-event-type expiry config
      templates/
        index.ts                             # Template loader with {{variable}} substitution
        rail5-card-delivered.ts              # Canonical card delivery instructions
  webhooks.ts                                # Webhook helpers (signPayload, attemptDelivery)

app/
  api/v1/rail5/
    initialize/route.ts                      # Owner: create card record (POST)
    submit-key/route.ts                      # Owner: store encryption key (POST)
    cards/route.ts                           # Owner: list rail5 cards (GET)
    cards/[cardId]/route.ts                  # Owner: get/update card (GET, PATCH)
    deliver-to-bot/route.ts                  # Owner: transient relay of encrypted file to bot (POST)
  api/v1/bot/rail5/
    key/route.ts                             # Bot: sub-agent gets decryption key (POST)
    checkout/route.ts                        # Bot: get spawn payload (POST)
    checkout/status/route.ts                 # Bot: check checkout status (GET)
    confirm/route.ts                         # Bot: sub-agent reports checkout result (POST)
    confirm-delivery/route.ts                # Bot: confirms encrypted card file received (POST)
  api/v1/bot-messages/
    send/route.ts                            # Owner: send message to bot via sendToBot()
  api/v1/bot/messages/
    route.ts                                 # Bot: poll pending messages (GET)
    ack/route.ts                             # Bot: acknowledge messages (POST)
  app/sub-agent-cards/
    page.tsx                                 # Dashboard listing page
    [cardId]/page.tsx                        # Card detail page

components/dashboard/
  rail5-setup-wizard.tsx                     # 8-step onboarding wizard with delivery + relay

shared/schema.ts                             # rail5_cards, rail5_checkouts, rail5_guardrails tables
server/storage.ts                            # rail5 storage methods
```

---

## Database

### `rail5_cards` Table

| Column | Type | Purpose |
|---|---|---|
| `id` | serial PK | |
| `card_id` | text, unique | `r5card_` + random hex |
| `owner_uid` | text | FK to Firebase user |
| `bot_id` | text, nullable | Linked bot |
| `card_name` | text | User-provided name |
| `encrypted_key_hex` | text | AES-256-GCM key (32 bytes as hex) |
| `encrypted_iv_hex` | text | Initialization vector (12 bytes as hex) |
| `encrypted_tag_hex` | text | Auth tag (16 bytes as hex) |
| `card_last4` | text | Last 4 digits for display only |
| `card_brand` | text | Visa/MC/Amex — user-selected for display |
| `status` | text | `pending_setup` → `pending_delivery` → `confirmed` → `active` → `frozen` |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**What's NOT stored:** Card number, CVV, expiry, name, address, encrypted card file, or any data that could identify the card.

### `rail5_guardrails` Table

Spending controls per card. Separate from the card record.

| Column | Type | Purpose |
|---|---|---|
| `id` | serial PK | |
| `card_id` | text | FK to `rail5_cards.card_id` |
| `max_per_tx_cents` | integer | Per-checkout spending cap |
| `daily_budget_cents` | integer | Daily aggregate cap |
| `monthly_budget_cents` | integer | Monthly aggregate cap |
| `require_approval_above` | integer, nullable | Require owner approval above this |
| `approval_mode` | text | `ask_for_everything`, `auto_approve_under_threshold`, `auto_approve_by_category` |
| `recurring_allowed` | boolean | Allow recurring charges |
| `auto_pause_on_zero` | boolean | Freeze card when budget exhausted |
| `notes` | text, nullable | Owner notes |
| `updated_at` | timestamp | |
| `updated_by` | text, nullable | Who last updated |

### `rail5_checkouts` Table

| Column | Type | Purpose |
|---|---|---|
| `id` | serial PK | |
| `checkout_id` | text, unique | `r5chk_` + random hex |
| `card_id` | text | FK to `rail5_cards.card_id` |
| `bot_id` | text | Bot that initiated checkout |
| `status` | text | `approved` → `key_delivered` → `completed` / `failed` |
| `key_delivered` | boolean | Enforces single-use key delivery |
| `merchant_name` | text | |
| `merchant_url` | text | |
| `amount_cents` | integer | |
| `created_at` | timestamp | |

---

## Onboarding Flow (Setup Wizard)

8-step wizard at `components/dashboard/rail5-setup-wizard.tsx` (`TOTAL_STEPS = 8`, index 0–7).

### Step 0: Card Name + Brand
User enters a name, selects brand, enters last 4 digits. Calls `POST /api/v1/rail5/initialize` → creates `rail5_cards` row, returns `cardId`. Status: `pending_setup`.

### Step 1: How It Works
Educational step. "CreditClaw will never see your card details. Everything is encrypted in your browser before it leaves this page." No API calls.

### Step 2: Spending Limits
Per-checkout limit, daily/monthly caps, human approval threshold. Calls `PATCH /api/v1/rail5/cards/[cardId]`.

### Step 3: Card Details Entry
Full card number, CVV, expiry via `Rail5InteractiveCard` component (`lib/card/onboarding-rail5/interactive-card.tsx`). Data stays in local state — never sent to server.

### Step 4: Billing Address
Street, city, state, zip. Data stays in local state.

### Step 5: Connect Bot
Fetches `GET /api/v1/bots/mine`. User selects a bot. Calls `PATCH /api/v1/rail5/cards/[cardId]` with `bot_id`.

### Step 6: Encrypt & Deliver

1. **Encrypt** — `encryptCardDetails()` (`lib/card/onboarding-rail5/encrypt.ts`). AES-256-GCM via Web Crypto API. Returns `keyHex`, `ivHex`, `tagHex`, `ciphertextBytes`.

2. **Submit key** — `POST /api/v1/rail5/submit-key` with key material. Status: `pending_setup` → `pending_delivery`.

3. **Build file** — `buildEncryptedCardFile()` creates a Markdown file with base64-encoded ciphertext and an embedded Node.js decrypt script between `DECRYPT_SCRIPT_START/END` markers.

4. **Deliver to bot** — `POST /api/v1/bot-messages/send` → `sendToBot()` (`lib/agent-management/bot-messaging/index.ts`).
   - Event type: `rail5.card.delivered`
   - Payload: `card_id`, `card_name`, `card_last4`, `file_content`, `suggested_path`, `instructions`
   - `instructions` field from centralized template `RAIL5_CARD_DELIVERED` (`lib/agent-management/bot-messaging/templates/rail5-card-delivered.ts`)
   - Routes via webhook health: tries webhook if `active`/`degraded`, stages pending message if `unreachable`/`none`

5. **Manual download** — `downloadEncryptedFile()` always triggers browser download as backup.

### Step 7: Delivery Result

Adaptive display based on delivery outcome:

**Webhook succeeded:** Shows "Delivered to bot via webhook" confirmation.

**Staged as pending message:** Shows "File Staged for Your Bot" with relay message and sharing buttons.
- **Relay message** — uses `RAIL5_CARD_DELIVERED` template. Instructions for bot to poll messages, save file, and confirm delivery.
- **Copy** — copies relay message to clipboard.
- **Telegram** — opens `t.me/share/url?text=` with message pre-filled.
- **Discord** — copies to clipboard + toast notification.
- Polls `GET /api/v1/rail5/cards/[cardId]/delivery-status` every 5 seconds for bot confirmation.

---

## Message Delivery System

All three delivery paths use the same instruction text from `lib/agent-management/bot-messaging/templates/rail5-card-delivered.ts`:

| Path | File | How it uses the template |
|---|---|---|
| Relay message (wizard UI) | `rail5-setup-wizard.tsx` | Displayed as copyable text, shared via Telegram/Discord |
| Staged message payload | `rail5-setup-wizard.tsx` → `sendToBot()` | `instructions` field in pending message payload |
| Webhook payload | `deliver-to-bot/route.ts` | `instructions` field in webhook JSON |

`sendToBot()` (`lib/agent-management/bot-messaging/index.ts`) handles routing:
- Checks bot's `webhookStatus` (from `bots` table `webhook_status` column)
- `active` or `degraded` → attempts `fireWebhook()`. On success, resets health to `active`.
- `unreachable` or `none` → skips webhook, stages as pending message.
- On webhook failure → increments `webhook_fail_count` atomically, transitions `active→degraded→unreachable`.

Pending messages expire per event type (`lib/agent-management/bot-messaging/expiry.ts`): `rail5.card.delivered` = 24h.

---

## Bot-Side Flow

### 1. Retrieve message
Bot polls `GET /api/v1/bot/messages` → returns pending messages including `rail5.card.delivered` payload with `file_content`.

### 2. Save the file
Bot saves `file_content` to `.creditclaw/cards/` (or path in `suggested_path`).

### 3. Acknowledge message
Bot calls `POST /api/v1/bot/messages/ack` with `{ message_ids: [id] }` — removes from pending queue.

### 4. Confirm delivery
Bot calls `POST /api/v1/bot/rail5/confirm-delivery` (no body needed).

**Route:** `app/api/v1/bot/rail5/confirm-delivery/route.ts`

- Looks up card linked to bot via `storage.getRail5CardByBotId()`
- Validates card is in `pending_delivery` status
- Updates to `confirmed` via `storage.updateRail5Card()`
- Cleans up pending messages via `storage.deletePendingMessagesByRef()`
- Returns:
```json
{
  "status": "confirmed",
  "card_id": "r5card_...",
  "card_name": "...",
  "message": "Card confirmed. Complete a test purchase to verify your card works end-to-end.",
  "test_checkout_url": "https://creditclaw.com/pay/cp_dd5f6ff666dcb31fce0f251a",
  "test_instructions": "Navigate to ... to complete a test purchase.\nThis is a sandbox checkout — no real payment will be processed.\n..."
}
```

### 5. Test purchase (verification)
Bot follows the `test_instructions` from confirm-delivery: navigates to the test checkout URL, decrypts the card file, fills in card details, and submits. The "testing" payment method records the entered details in the sale metadata without processing a real charge. The owner's wizard polls `GET /api/v1/rail5/cards/[cardId]/test-purchase-status` to compare the submitted details against the originals field-by-field.

### Card Status Progression

| Status | Meaning | Triggered By |
|---|---|---|
| `pending_setup` | Card created, wizard in progress | `POST /api/v1/rail5/initialize` |
| `pending_delivery` | Key submitted, file sent to bot | `POST /api/v1/rail5/submit-key` |
| `confirmed` | Bot confirmed file receipt | `POST /bot/rail5/confirm-delivery` |
| `active` | Card in active use | First successful checkout |
| `frozen` | Owner manually paused | Owner action from dashboard |

UI label mapping (`components/wallet/card-visual.tsx`):
- `pending_setup` → "Pending Setup"
- `pending_delivery` → "Ready to Test"
- `confirmed` → "Confirmed"
- `active` → "Active"
- `frozen` → "Frozen"

---

## Direct Delivery: Transient Relay

When a bot has a webhook, `sendToBot()` relays the encrypted card file directly. If the webhook fails, the file is staged as a pending message instead. The legacy `POST /api/v1/rail5/deliver-to-bot` endpoint also exists for owner-initiated direct webhook delivery.

### Why Transient (No Persistence for Encrypted Data)

The split-knowledge model requires that CreditClaw **never** stores both the decryption key and the encrypted file in the same system. Since CreditClaw already stores the key, it must not persist the ciphertext. During webhook delivery:

- The encrypted blob touches server memory for ~1 second during the HTTP relay
- After the response is returned, the data is garbage collected
- No database record contains any encrypted card content

**Note:** When webhook delivery fails and the file is staged as a pending message, the encrypted content is stored in `bot_pending_messages.payload` JSONB. This is acceptable because pending messages expire after 24 hours and are auto-purged.

### Webhook Payload (to Bot)

```json
{
  "event": "rail5.card.delivered",
  "timestamp": "2026-02-26T12:00:00.000Z",
  "bot_id": "bot_abc123",
  "data": {
    "card_id": "r5card_def456",
    "card_name": "Harry's Visa",
    "card_last4": "1234",
    "file_content": "--- CREDITCLAW ENCRYPTED CARD FILE ---\n...",
    "suggested_path": ".creditclaw/cards/Card-HarrysVisa-1234.md",
    "instructions": "<from centralized template>"
  }
}
```

Headers: `X-CreditClaw-Signature: sha256=<hmac>`, `X-CreditClaw-Event: rail5.card.delivered`

---

## Unified `rails.updated` Webhook

All rails fire a unified `rails.updated` webhook when a bot's payment methods change, so bots can call `GET /bot/status` to refresh their state.

### Actions by Rail

| Rail | Route | Action(s) Fired |
|---|---|---|
| Rail 1 | `stripe-wallet/create` | `wallet_created` |
| Rail 1 | `stripe-wallet/freeze` | `wallet_frozen` / `wallet_unfrozen` |
| Rail 2 | `card-wallet/create` | `wallet_created` |
| Rail 2 | `card-wallet/freeze` | `wallet_frozen` / `wallet_unfrozen` |
| Rail 4 | `rail4/link-bot` | `card_linked` |
| Rail 4 | `rail4/freeze` | `card_frozen` / `card_unfrozen` |
| Rail 5 | `rail5/cards/[cardId]` PATCH | `card_linked` / `card_removed` / `card_frozen` / `card_unfrozen` |

### Payload

```json
{
  "event": "rails.updated",
  "timestamp": "2026-02-26T12:00:00.000Z",
  "bot_id": "bot_abc123",
  "data": {
    "action": "card_linked",
    "rail": "rail5",
    "card_id": "r5card_def456",
    "bot_id": "bot_abc123",
    "message": "Your payment methods have been updated (card linked). Call GET /bot/status for details."
  }
}
```

### Available Actions

`card_linked`, `card_removed`, `card_frozen`, `card_unfrozen`, `card_created`, `card_deleted`, `wallet_created`, `wallet_linked`, `wallet_unlinked`, `wallet_frozen`, `wallet_unfrozen`, `wallet_funded`, `limits_updated`

All `rails.updated` webhooks use `fireWebhook()` with full persistence. These payloads contain no sensitive data (just action + IDs).

---

## Checkout Flow

### Step 1: Main Agent Requests Spawn Payload

`POST /api/v1/bot/rail5/checkout`

```json
{
  "merchant_name": "DigitalOcean",
  "merchant_url": "https://cloud.digitalocean.com/billing",
  "item_name": "Droplet hosting - 1 month",
  "amount_cents": 1200,
  "category": "cloud_compute"
}
```

CreditClaw validates spending limits (from `rail5_guardrails`) and returns a spawn payload. **No card data or key in this response.**

```json
{
  "approved": true,
  "spawn_payload": {
    "task": "You are a checkout agent. [instructions to get key, decrypt, checkout]",
    "cleanup": "delete",
    "runTimeoutSeconds": 300,
    "label": "checkout-digitalocean"
  },
  "checkout_id": "r5chk_abc123"
}
```

If above `require_approval_above`, returns `"status": "pending_approval"` instead. The owner receives a confirmation request. Once approved, the checkout proceeds.

### Step 2: Main Agent Spawns Sub-Agent

```
sessions_spawn({ task: <from payload>, cleanup: "delete", runTimeoutSeconds: 300 })
```

Main agent's job is done. It waits for the announce.

### Step 3: Sub-Agent Gets Decryption Key

`POST /api/v1/bot/rail5/key` with `{ "checkout_id": "r5chk_abc123" }`

```json
{
  "key_hex": "a1b2c3d4...64 chars",
  "iv_hex": "e5f6a7b8...24 chars",
  "tag_hex": "c9d0e1f2...32 chars"
}
```

**Single-use:** After delivery, checkout record marked `key_delivered`. Subsequent calls rejected.

### Step 4: Sub-Agent Decrypts (Deterministic Script)

Pre-placed Node.js script, run via `exec`. Not LLM reasoning — deterministic:

```javascript
// decrypt.js — embedded in the encrypted card file between DECRYPT_SCRIPT_START/END markers
const crypto = require("crypto");
const fs = require("fs");
const [,, keyHex, ivHex, tagHex, filePath] = process.argv;

const raw = fs.readFileSync(filePath, "utf8");
const b64 = raw.match(/```([\s\S]+?)```/)[1].trim();
const data = Buffer.from(b64, "base64");

const decipher = crypto.createDecipheriv(
  "aes-256-gcm",
  Buffer.from(keyHex, "hex"),
  Buffer.from(ivHex, "hex")
);
decipher.setAuthTag(Buffer.from(tagHex, "hex"));
const plain = decipher.update(data.slice(0, -16)) + decipher.final("utf8");
process.stdout.write(plain);
```

Run: `node decrypt.js <key> <iv> <tag> Card-Harry-26-Visa.md`

### Step 5: Sub-Agent Confirms + Announces

Sub-agent calls `POST /api/v1/bot/rail5/confirm`:

```json
{ "checkout_id": "r5chk_abc123", "status": "success", "merchant_name": "DigitalOcean" }
```

CreditClaw then: debits wallet (atomic), creates transaction, fires webhook (`rail5.checkout.completed`), sends owner notification, updates spend aggregates.

Sub-agent announces: "Purchase of Droplet hosting at DigitalOcean — SUCCESS"

Session deleted. Key, decrypted card, all context — gone.

---

## Endpoints Summary

### Owner-Facing (Session Cookie Auth)

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/rail5/initialize` | Create card record, return card_id |
| POST | `/api/v1/rail5/submit-key` | Store encryption key material |
| GET | `/api/v1/rail5/cards` | List owner's Rail 5 cards |
| GET | `/api/v1/rail5/cards/[cardId]` | Get card detail + checkout history |
| PATCH | `/api/v1/rail5/cards/[cardId]` | Update card settings, link/unlink bot, freeze/unfreeze |
| GET | `/api/v1/rail5/cards/[cardId]/test-purchase-status` | Poll test purchase result + field-by-field card verification |
| POST | `/api/v1/rail5/deliver-to-bot` | Transient relay of encrypted file to bot (legacy) |
| POST | `/api/v1/bot-messages/send` | Universal message delivery via `sendToBot()` |

### Bot-Facing (Bearer Token Auth via `withBotApi`)

| Method | Path | Rate Limit | Purpose |
|---|---|---|---|
| POST | `/api/v1/bot/rail5/checkout` | 30/hr | Validate spend + return spawn payload |
| POST | `/api/v1/bot/rail5/key` | 30/hr | Return decryption key (single-use) |
| POST | `/api/v1/bot/rail5/confirm` | 30/hr | Sub-agent reports checkout result |
| POST | `/api/v1/bot/rail5/confirm-delivery` | — | Bot confirms card file received + gets test checkout instructions |
| GET | `/api/v1/bot/messages` | — | Poll pending messages |
| POST | `/api/v1/bot/messages/ack` | — | Acknowledge (remove) pending messages |

---

## Verified Technology

**OpenClaw `sessions_spawn` + `cleanup: "delete"`**
Production since v2026.2.15. `/subagents spawn` command added v2026.2.17 for deterministic skill-file triggering.

**OpenClaw `exec` tool**
Available to sub-agents by default (`group:runtime`). Node.js on all gateway hosts (required since v2026.1.29). Decrypt script uses only `node:crypto`.

**Web Crypto API (AES-256-GCM)**
W3C standard. All modern browsers. No external library needed.

**Node.js `crypto.createDecipheriv` (AES-256-GCM)**
Stable since Node 10+. Built-in, no dependencies.

---

## Security Properties

| Property | Rail 5 |
|---|---|
| CreditClaw holds card data | **No** |
| CreditClaw holds encrypted card data | **No** — transient relay only, zero persistence (pending messages expire in 24h) |
| Main agent sees card details | **Never** |
| Main agent sees decryption key | **Never** |
| Card data in persistent context | **Never** — only in ephemeral sub-agent |
| Encrypted at rest | **Yes** — AES-256-GCM on owner's machine and bot's workspace |
| Single point of compromise | **None** — file without key is gibberish, key without file decrypts nothing |
| Key delivery | Single-use per checkout, only to authenticated sub-agent |
| Spending controls | Per-checkout, daily, monthly limits via `rail5_guardrails` + procurement controls |
| Human approval | Configurable threshold — owner confirmation for purchases above limit |
| Sub-agent timeout | 5 minutes, then killed + deleted |
| Webhook delivery persistence | `rails.updated` and other events: persisted. `rail5.card.delivered`: transient (webhook) or 24h expiry (pending message) |

---

## Changelog

| Date | Change |
|---|---|
| 2026-02-24 | Wizard reordered: Name → HowItWorks → CardDetails → Limits → LinkBot → Encrypt → Success |
| 2026-02-24 | Added `POST /api/v1/rail5/deliver-to-bot` for direct encrypted file delivery to bots |
| 2026-02-24 | Added `GET/PATCH /api/v1/rail5/cards/[cardId]` for card detail and updates |
| 2026-02-24 | Unified `rails.updated` webhook wired across all rails (1, 2, 4, 5) |
| 2026-02-24 | Adaptive success screen with copyable bot instructions and `card_id` |
| 2026-02-26 | **CRITICAL:** Deliver-to-bot changed from `fireWebhook()` (persists payload) to transient relay (zero DB persistence) |
| 2026-02-26 | Exported `signPayload` and `attemptDelivery` from `lib/webhooks.ts` for transient relay use |
| 2026-02-26 | Removed all `webhook_deliveries` writes from deliver-to-bot |
| 2026-03-06 | Wizard expanded to 8 steps (added billing address + delivery result with relay message sharing) |
| 2026-03-06 | `sendToBot()` replaced direct `fireWebhook()` for card delivery — adds pending message fallback |
| 2026-03-06 | Moved `lib/bot-messaging/` → `lib/agent-management/bot-messaging/` |
| 2026-03-06 | Added centralized message templates (`lib/agent-management/bot-messaging/templates/`) |
| 2026-03-06 | Added `POST /bot/rail5/confirm-delivery` endpoint — bot confirms card file received |
| 2026-03-06 | Confirm-delivery response returns `test_checkout_url` for end-to-end card verification |
| 2026-03-06 | Card status progression: `pending_setup` → `pending_delivery` → `confirmed` → `active` → `frozen` |
| 2026-03-06 | Status label `pending_delivery` → "Ready to Test" (was "Awaiting Bot") |
| 2026-03-06 | Webhook health tracking: `webhookStatus`/`webhookFailCount` on bots table, smart routing in `sendToBot()` |
| 2026-03-06 | Spending controls moved to `rail5_guardrails` table (separate from `rail5_cards`) |
| 2026-03-06 | Removed confirm-delivery docs from `skill.md` — bot receives instructions via message payload |
| 2026-03-07 | Confirm-delivery response updated with real `test_checkout_url` and `test_instructions` for sandbox verification |
| 2026-03-07 | Added `GET /api/v1/rail5/cards/[cardId]/test-purchase-status` — field-by-field card detail verification against test sale |
| 2026-03-07 | Step 7 Phase 2: test purchase verification with 3-minute polling, field-by-field match display |
| 2026-03-07 | Card details saved into `savedCardDetails` state before clearing inputs — persists through Step 7 for comparison |
