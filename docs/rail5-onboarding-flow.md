# Rail 5 Onboarding Flow — Internal Technical Reference

## Overview

Rail 5 onboarding provisions an end-to-end encrypted credit card to an AI bot. The card is encrypted client-side (AES-256-GCM) so the server never sees plaintext card data. The encrypted file is delivered to the bot, which confirms receipt and can then test the card at a checkout URL.

## Entry Point

`components/dashboard/rail5-setup-wizard.tsx` — 9-step modal wizard (`TOTAL_STEPS = 9`, index 0–8).

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
- Polls `GET /api/v1/rail5/cards/[cardId]/delivery-status` every 5 seconds checking for bot confirmation (continues indefinitely until confirmed or wizard closed).
- **"Continue to Test Verification"** button appears once delivery is confirmed → advances to Step 8.
- **"Skip — I'll check later"** link allows closing the wizard before confirmation.

### Step 8: Test Verification (`Step8TestVerification`)

Dedicated step for verifying the card decrypts correctly via a sandbox test purchase.

- Starts polling `GET /api/v1/rail5/cards/[cardId]/test-purchase-status` immediately on mount (every 5 seconds, 3-minute timeout).
- Server returns the card details the bot submitted at the test checkout; the wizard compares them field-by-field against `savedCardDetails` still in browser memory (client-side only — raw card data never sent to server for comparison).
- **UI states**:
  - **Polling**: Blue banner with spinner — "Verifying card — waiting for test purchase..."
  - **Success**: Green banner with field-by-field checkmarks — "Card Verified — encryption and decryption working correctly"
  - **Failure**: Red banner with per-field match/mismatch — "Verification Failed — some fields did not match"
  - **Timeout (3 min)**: Amber warning — "Test purchase not completed yet" with suggestion to check the card dashboard later
- **"Done" button** closes the wizard.

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
    "message": "Card confirmed. Complete a test purchase to verify your card works end-to-end.",
    "test_checkout_url": "https://creditclaw.com/pay/cp_dd5f6ff666dcb31fce0f251a",
    "test_instructions": "Navigate to https://creditclaw.com/pay/cp_dd5f6ff666dcb31fce0f251a to complete a test purchase.\nThis is a sandbox checkout — no real payment will be processed.\n..."
  }
  ```

### 5. Test purchase (verification)
After confirming delivery, the bot follows the `test_instructions` from the confirm-delivery response:
- Navigates to the test checkout URL (a checkout page with only the "testing" payment method enabled).
- Decrypts the card file using `POST /api/v1/bot/rail5/key` and the embedded decrypt script.
- Enters the decrypted card details into the test checkout form and submits.
- The test checkout records card details in the sale's metadata (no real charge).
- The wizard (still open) polls `GET /api/v1/rail5/cards/[cardId]/test-purchase-status` and compares each field against the original card data still in browser memory.
- If all fields match: card is verified end-to-end. If any mismatch: verification fails.

**Route:** `app/api/v1/rail5/cards/[cardId]/test-purchase-status/route.ts`

Logic:
- Session-authenticated (owner only), validates card ownership.
- Queries recent test sales for the Rail5 test checkout page (within 5 minutes).
- Returns the submitted card details from the test sale (no comparison on server).
- Response when completed:
  ```json
  {
    "status": "completed",
    "sale_id": "sale_...",
    "submitted_details": {
      "cardNumber": "4111111111111111",
      "cardExpiry": "12/26",
      "cardCvv": "123",
      "cardholderName": "John Doe",
      "billingAddress": "123 Main St",
      "billingCity": "New York",
      "billingState": "NY",
      "billingZip": "10001"
    }
  }
  ```
- If no test sale found yet: returns `{ "status": "pending" }`.
- **Comparison happens client-side**: The wizard compares `submitted_details` against `savedCardDetails` (still in browser memory) field-by-field. Raw card data never leaves the browser for comparison purposes — the server only returns what the bot entered at the checkout.

---

## Wizard Step 8 — Test Purchase Verification

Step 8 (`Step8TestVerification`) is a dedicated step for verifying the card decrypts correctly:

1. **Card details preserved** — Before clearing the card input fields after encryption (in Step 6), the wizard saves the original values (card number, expiry, CVV, holder name, billing address) into `savedCardDetails` state.
2. **Polling starts immediately** on mount — polls `GET /api/v1/rail5/cards/[cardId]/test-purchase-status` every 5 seconds. The server returns the bot's submitted details; comparison against `savedCardDetails` happens entirely client-side.
3. **UI states**:
   - **Polling**: Blue banner with spinner — "Verifying card — waiting for test purchase..."
   - **Success**: Green banner with field-by-field checkmarks — "Card Verified — encryption and decryption working correctly"
   - **Failure**: Red banner with field-by-field results — "Verification Failed — some fields did not match"
   - **Timeout (3 min)**: Amber warning — "Test purchase not completed yet" with suggestion to check dashboard later
4. **Timeout**: 3 minutes (180 seconds). The bot needs time to spawn a sub-agent, decrypt, navigate, and fill the form.
5. **"Done" button** closes the wizard.

**Key constant:** `RAIL5_TEST_CHECKOUT_PAGE_ID` and `RAIL5_TEST_CHECKOUT_URL` in `lib/rail5/index.ts`.

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
| `components/dashboard/rail5-setup-wizard.tsx` | 9-step onboarding wizard (steps 0–8) |
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
| `app/api/v1/bot/rail5/confirm-delivery/route.ts` | Bot confirms card file saved, returns test checkout instructions |
| `app/api/v1/rail5/cards/[cardId]/test-purchase-status/route.ts` | Polls test purchase result + field-by-field verification |
| `app/api/v1/rail5/cards/[cardId]/route.ts` | Card CRUD (PATCH for limits, bot linking) |
| `lib/rail5/index.ts` | Constants (`RAIL5_TEST_CHECKOUT_PAGE_ID`, `RAIL5_TEST_CHECKOUT_URL`) |
| `components/wallet/card-visual.tsx` | Card status labels and badge colors |
