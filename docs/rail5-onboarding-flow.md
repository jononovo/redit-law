# Rail 5 Onboarding Flow — Internal Technical Reference

## Overview

Rail 5 onboarding provisions an end-to-end encrypted credit card to an AI bot. The card is encrypted client-side (AES-256-GCM) so the server never sees plaintext card data. The encrypted file is delivered to the bot, which confirms receipt and can then test the card at a checkout URL.

## Entry Point

`components/dashboard/rail5-setup-wizard.tsx` — 8-step modal wizard (`TOTAL_STEPS = 8`, index 0–7).

---

## Wizard Steps

### Step 0: Name Your Card
- Owner enters a card name.
- Calls `POST /api/v1/rail5/initialize` → creates a `rail5_cards` row, returns `cardId`.
- Card status: `pending_setup`.

### Step 1: How It Works
- Educational — explains AES-256-GCM encryption model. No API calls.

### Step 2: Spending Limits
- Owner sets `spending_limit_cents`, `daily_limit_cents`, `monthly_limit_cents`, and human approval thresholds.
- Calls `PATCH /api/v1/rail5/cards/[cardId]` to persist.

### Step 3: Enter Card Details
- Owner enters PAN, CVV, expiry via `Rail5InteractiveCard` component (`lib/card/onboarding-rail5/interactive-card.tsx`).
- No API calls — data stays in local state.

### Step 4: Billing Address
- Owner enters street, city, state, zip. Data stays in local state.

### Step 5: Connect Bot
- Fetches `GET /api/v1/bots/mine` to list owner's bots.
- Owner selects a bot → calls `PATCH /api/v1/rail5/cards/[cardId]` with `bot_id`.

### Step 6: Encrypt & Deliver
Triggered by "Encrypt" button. This is the core step:

1. **Encrypt** — `encryptCardDetails()` (`lib/card/onboarding-rail5/encrypt.ts`)
   - Converts card + address to JSON string.
   - Generates random AES-256-GCM key and 12-byte IV via Web Crypto API.
   - Encrypts in-browser. Returns `keyHex`, `ivHex`, `tagHex`, `ciphertextBytes`.

2. **Submit key to server** — `POST /api/v1/rail5/submit-key`
   - Sends `keyHex`, `ivHex`, `tagHex` to server (server stores these for checkout-time key delivery).
   - Card status: `pending_setup` → `pending_delivery`.

3. **Build encrypted file** — `buildEncryptedCardFile()` (`lib/card/onboarding-rail5/encrypt.ts`)
   - Creates a Markdown file containing base64-encoded ciphertext and an embedded Node.js decrypt script between `DECRYPT_SCRIPT_START/END` markers.

4. **Deliver to bot** — `POST /api/v1/bot-messages/send`
   - Calls `sendToBot()` (`lib/agent-management/bot-messaging/index.ts`).
   - Event type: `rail5.card.delivered`.
   - Payload includes `card_id`, `card_name`, `card_last4`, `file_content`, `suggested_path`, and `instructions`.
   - The `instructions` field comes from the centralized template `RAIL5_CARD_DELIVERED` (`lib/agent-management/bot-messaging/templates/rail5-card-delivered.ts`).
   - `sendToBot()` routing:
     - If bot has webhook and status is `active`/`degraded` → attempts `fireWebhook()`. On success, returns `{ delivered: true, method: "webhook" }`.
     - If webhook fails or not configured → stages as pending message in `bot_pending_messages` table (24h expiry). Returns `{ delivered: false, method: "pending_message" }`.

5. **Manual download** — `downloadEncryptedFile()` (`lib/card/onboarding-rail5/encrypt.ts`)
   - Creates a `Blob` and triggers browser download of the `.md` file.
   - Always runs regardless of delivery result, as a backup.

### Step 7: Delivery Result (`Step7DeliveryResult`)

Displays one of two states:

**If webhook delivery succeeded:**
- Shows "Delivered to bot via webhook" confirmation.

**If webhook failed or bot has no webhook (staged message):**
- Shows "File Staged for Your Bot" with a relay message and sharing buttons.
- **Relay message** — uses `RAIL5_CARD_DELIVERED` template constant. Contains instructions for the bot to:
  1. Poll `GET /api/v1/bot/messages`
  2. Save the card file
  3. Call `POST /api/v1/bot/rail5/confirm-delivery`
- **Copy button** — copies relay message to clipboard via `navigator.clipboard.writeText()`.
- **Telegram button** — opens `t.me/share/url?text=` with the relay message pre-filled.
- **Discord button** — copies to clipboard + shows toast "Paste this in Discord to send to your bot."
- Polls `GET /api/v1/rail5/cards/[cardId]/delivery-status` every 5 seconds checking for bot confirmation.

---

## Bot-Side Flow

### 1. Retrieve message
Bot polls `GET /api/v1/bot/messages` (authenticated with API key).
Returns pending messages including any `rail5.card.delivered` events with the encrypted file in `payload.file_content`.

**Route:** `app/api/v1/bot/messages/route.ts`

### 2. Save the file
Bot saves `file_content` to `.creditclaw/cards/` (or the path in `payload.suggested_path`).

### 3. Acknowledge message
Bot calls `POST /api/v1/bot/messages/ack` with `{ message_ids: [id] }`.
This removes the message from the pending queue — purely queue cleanup.

**Route:** `app/api/v1/bot/messages/ack/route.ts`

### 4. Confirm delivery
Bot calls `POST /api/v1/bot/rail5/confirm-delivery` (authenticated with API key, no body needed).

**Route:** `app/api/v1/bot/rail5/confirm-delivery/route.ts`

Logic:
- Looks up the card linked to this bot via `storage.getRail5CardByBotId()`.
- Validates card is in `pending_delivery` status.
- Updates card status to `confirmed` via `storage.updateRail5Card()`.
- Cleans up any remaining pending messages for this card via `storage.deletePendingMessagesByRef()`.
- Returns:
  ```json
  {
    "status": "confirmed",
    "card_id": "r5card_...",
    "card_name": "...",
    "message": "Card confirmed. Run a test purchase to verify everything works.",
    "test_checkout_url": "https://creditclaw.com/checkout/to-be-confirmed"
  }
  ```

---

## Card Status Progression

| Status | Meaning | Triggered By |
|--------|---------|--------------|
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

## Centralized Message Templates

All delivery paths use the same instruction text from `lib/agent-management/bot-messaging/templates/rail5-card-delivered.ts`:

```
RAIL5_CARD_DELIVERED
```

This constant is imported by:
- `components/dashboard/rail5-setup-wizard.tsx` — relay message UI
- `components/dashboard/rail5-setup-wizard.tsx` — staged message `instructions` field (via `sendToBot`)
- `app/api/v1/rail5/deliver-to-bot/route.ts` — webhook payload `instructions` field

---

## Key Files

| File | Purpose |
|------|---------|
| `components/dashboard/rail5-setup-wizard.tsx` | 8-step onboarding wizard |
| `lib/card/onboarding-rail5/encrypt.ts` | Client-side AES-256-GCM encryption, file builder, download |
| `lib/card/onboarding-rail5/interactive-card.tsx` | Card input UI component |
| `lib/agent-management/bot-messaging/index.ts` | `sendToBot()` — routes via webhook or pending message |
| `lib/agent-management/bot-messaging/templates/rail5-card-delivered.ts` | Canonical instruction template |
| `app/api/v1/rail5/initialize/route.ts` | Creates card record |
| `app/api/v1/rail5/submit-key/route.ts` | Stores encryption key material |
| `app/api/v1/rail5/deliver-to-bot/route.ts` | Legacy direct webhook delivery (owner-initiated) |
| `app/api/v1/bot-messages/send/route.ts` | Universal `sendToBot()` API (used by wizard) |
| `app/api/v1/bot/messages/route.ts` | Bot polls for pending messages |
| `app/api/v1/bot/messages/ack/route.ts` | Bot acknowledges messages |
| `app/api/v1/bot/rail5/confirm-delivery/route.ts` | Bot confirms card file saved |
| `app/api/v1/rail5/cards/[cardId]/route.ts` | Card CRUD (PATCH for limits, bot linking) |
| `components/wallet/card-visual.tsx` | Card status labels and badge colors |
