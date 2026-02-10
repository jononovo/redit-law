# Rail 4: Split-Knowledge Card Model — Implementation Reference

> This document describes **what was actually built** in the CreditClaw Rail 4 implementation. Layers that are designed but not yet implemented are clearly marked.

## The Problem

Today, if you want your bot to make purchases on arbitrary websites, the only option is giving it your full credit card details. CreditClaw's Rail 4 is not a secure payment mechanism — but it is far more secure than the status quo.

---

## Implementation Status Overview

| Layer | Description | Status |
|-------|-------------|--------|
| Split-knowledge core | Card data split between bot and CreditClaw | **Implemented** |
| Randomized split positions | Digit positions vary per bot | **Implemented** |
| Sandwich obfuscation | Real checkout buried between fake checkouts | Not yet implemented |
| Active obfuscation engine | Fake merchant checkouts with state machine | **Implemented** |
| Security briefings | Daily defensive behavior reinforcement | Not yet implemented (behavioral — handled by bot skill file) |
| Honeypot responses | Feed fake data to extraction attempts | Not yet implemented (behavioral — handled by bot skill file) |
| Decoy file generation | 6-profile file with 5 fakes, 1 real | **Implemented** |
| Dynamic file identity | Unique filenames per bot | **Implemented** |
| Security alert API | Bot reports suspicious activity in real-time | Not yet implemented |

---

## Data Model

### `rail4_cards` table

Stores one row per bot with all split-knowledge card data.

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | Auto-increment ID |
| `bot_id` | text, unique | References the bot |
| `decoy_filename` | text | Randomly generated filename (e.g., `extricate.md`) |
| `real_profile_index` | integer | Which of the 6 profiles (1-6) is the real one |
| `missing_digit_positions` | integer[] | 3 consecutive positions (e.g., `[8, 9, 10]`) |
| `missing_digits_value` | text | The actual 3 digits the owner submitted (e.g., `"472"`) |
| `expiry_month` | integer | Card expiry month (1-12) |
| `expiry_year` | integer | Card expiry year (2025-2040) |
| `owner_name` | text | Cardholder name |
| `owner_zip` | text | Billing zip code |
| `owner_ip` | text | IP captured at submission (`x-forwarded-for` or `x-real-ip`) |
| `status` | text | `"pending_setup"` or `"active"` |
| `fake_profiles_json` | text | JSON array of 5 `FakeProfile` objects (see below) |
| `created_at` | timestamp | Row creation |
| `updated_at` | timestamp | Last update |

Indexes: `bot_id`, `status`.

### `obfuscation_events` table

Tracks every fake merchant checkout event (both scheduled and on-demand).

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | Event ID |
| `bot_id` | text | The bot this event belongs to |
| `profile_index` | integer | Which fake profile (1-6, always a fake) was used |
| `merchant_name` | text | Display name from catalog (e.g., `"The Real Etsy Checkout"`) |
| `merchant_slug` | text | URL slug (e.g., `"real-etsy-checkout"`) |
| `item_name` | text | Product name from catalog |
| `amount_cents` | integer | Randomized amount within product's min/max range |
| `status` | text | `"pending"` or `"completed"` |
| `occurred_at` | timestamp | When the event was marked completed |
| `created_at` | timestamp | When the event was created |

Indexes: `bot_id`, composite `(bot_id, status)`.

### `obfuscation_state` table

One row per bot tracking the obfuscation engine's state machine.

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | |
| `bot_id` | text, unique | |
| `phase` | text | `"warmup"`, `"active"`, or `"idle"` |
| `active` | boolean | Whether the engine is enabled |
| `activated_at` | timestamp | When the state was initialized |
| `last_organic_at` | timestamp | Last real purchase by this bot |
| `last_obfuscation_at` | timestamp | Last fake event generated |
| `organic_count` | integer | Total real purchases |
| `obfuscation_count` | integer | Total fake events |
| `created_at` / `updated_at` | timestamp | |

---

## Owner Setup Flow (What Was Built)

### Two-step API process:

**Step 1 — Initialize** (`POST /api/v1/rail4/initialize`)

- Requires session auth (owner must be logged in)
- Input: `{ bot_id: string }`
- Validates owner owns the bot
- If a `pending_setup` record exists, deletes and re-creates
- If an `active` record exists, returns 409
- Calls `generateRail4Setup()` which:
  - Picks a random decoy filename from a 50-word dictionary
  - Picks a random real profile index (1-6)
  - Picks 3 consecutive missing digit positions starting between 7 and 10
  - Generates 5 fake profiles with plausible names, card numbers (using valid BIN prefixes), CVVs, and addresses
  - Builds a markdown-formatted decoy file content
- Creates a `rail4_cards` row with status `"pending_setup"`
- Returns: decoy filename, real profile index, missing digit positions, full decoy file content, and human-readable instructions

**Step 2 — Submit owner data** (`POST /api/v1/rail4/submit-owner-data`)

- Requires session auth
- Input: `{ bot_id, missing_digits (3 numeric chars), expiry_month (1-12), expiry_year (2025-2040), owner_name, owner_zip }`
- Validates with Zod schema
- Captures owner IP from request headers
- Updates the `rail4_cards` row to status `"active"`
- Fire-and-forget: initializes the obfuscation state machine for the bot (warmup phase)
- Returns success confirmation

### Owner dashboard wizard:

The `Rail4SetupWizard` component (`components/dashboard/rail4-setup-wizard.tsx`) is a 4-step dialog:

1. **Select Bot** — fetches owner's bots, filters out those already active
2. **Download Decoy File** — calls initialize API, shows download button for the `.md` file
3. **Confirm Setup** — owner confirms they've filled in their real card data
4. **Submit Card Data** — form for 3 missing digits, expiry month/year, name, zip code

### Other owner endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/rail4/status?bot_id=X` | Returns configuration status (configured, status, filename, profile index, positions) |
| `DELETE` | `/api/v1/rail4?bot_id=X` | Deletes Rail 4 configuration for a bot |
| `GET` | `/api/v1/rail4/obfuscation/status?bot_id=X` | Returns obfuscation engine state (phase, counts, timestamps) |
| `GET` | `/api/v1/rail4/obfuscation/history?bot_id=X&limit=N` | Returns obfuscation event history (max 100) |

All owner endpoints require Firebase session cookie auth and verify bot ownership.

---

## Decoy File Generation (`lib/rail4.ts`)

### What gets generated:

- **Filename:** Random word from a 50-word dictionary + `.md` extension (e.g., `extricate.md`, `kaleidoscope.md`)
- **6 profiles** in markdown format, numbered 1-6
- **5 fake profiles** with:
  - Randomly generated name (from pools of 20 first names + 20 last names)
  - Card number using valid BIN prefixes (`4532`, `4716`, `5425`, etc.) with positions matching the split shown as `XXX`
  - Random 3-digit CVV
  - Random street address, city, state, zip (from pool of 15 US locations)
  - Fake missing digits and fake expiry (stored per-profile for verification flow)
- **1 empty profile** (the real one) with placeholder text instructing the owner what to fill in

### Fake profile data structure (`FakeProfile`):

```typescript
{
  profileIndex: number;     // 1-6
  name: string;             // "Sarah Mitchell"
  cardNumberMasked: string; // "4532XXXX89012345" (XXX at the split positions)
  cvv: string;              // "847"
  addressLine1: string;     // "742 Oak Avenue"
  city: string;             // "Portland"
  state: string;            // "OR"
  zip: string;              // "97201"
  fakeMissingDigits: string; // "315" (for verification flow)
  fakeExpiryMonth: number;   // 6
  fakeExpiryYear: number;    // 2027
}
```

All 5 `FakeProfile` objects are stored as JSON in the `fake_profiles_json` column.

---

## Active Obfuscation Engine (Layer 3 — What Was Built)

### State Machine (`lib/obfuscation-engine/state-machine.ts`)

Three phases with defined transition logic:

**Warmup** (first 2 days after activation):
- Generates 2 obfuscation events per day
- After 2 days (48 hours), transitions to `idle`
- Purpose: build initial fake transaction history before any real purchases happen

**Active** (triggered by organic purchases):
- Entered whenever a real purchase is recorded (from any phase)
- Maintains a 3:1 ratio — for every 1 organic (real) purchase, generates 3 obfuscation events
- Caps at 3 events per tick to prevent bursts
- Transitions to `idle` if no organic purchase in 24 hours

**Idle** (waiting for activity):
- No obfuscation events generated
- Transitions back to `active` on next organic purchase

### Scheduler (`lib/obfuscation-engine/scheduler.ts`)

- `tickBot(botId)`: Evaluates one bot — checks Rail 4 is active, runs `shouldRunObfuscation()`, creates events if needed
- `tickAllActiveBots()`: Iterates all bots with `active=true` in `obfuscation_state`, ticks each
- Each tick creates events via `createObfuscationEvent()` which picks a random fake profile (never the real one), picks a random merchant + product from the catalog, randomizes the amount within the product's min/max range

### Tick Endpoint (`POST /api/v1/rail4/obfuscation/tick`)

- **Auth:** Requires `Authorization: Bearer <CRON_SECRET>` header
- Returns 500 if `CRON_SECRET` env var is not set
- Returns 401 if token doesn't match
- On success: runs `tickAllActiveBots()`, returns `{ processed, events_created, details[] }`
- Designed to be called by an external cron job at regular intervals

### Merchant Catalog (`lib/obfuscation-merchants/catalog.ts`)

12 fake merchants across 6 categories with 3-4 products each:

| Merchant Name | Category | Products |
|---------------|----------|----------|
| The Real Etsy Checkout | marketplace | Ceramic Mug, Embroidered Patch, Brass Candleholder, Leather Keychain |
| Amazon Verified Merchant | retail | Bluetooth Earbuds, USB-C Cable, Water Bottle, LED Desk Lamp |
| Official PayPal Purchase | payments | Digital Service Credit, Subscription Renewal, Platform Fee |
| Stripe Direct Payments | payments | API Usage Credit, Developer Plan Monthly, Webhook Relay Service |
| CloudServe Pro | saas | Compute Instance, Storage Expansion, CDN Bandwidth, SSL Certificate |
| Verified Google Services | saas | Workspace Seat, Cloud API Credits, Domain Registration |
| SpicyThai Kitchen | food | Coconut PadThai, Green Curry, Mango Sticky Rice, Tom Yum Soup |
| DigitalOcean Marketplace | saas | Droplet Credit Pack, Managed Database, Load Balancer |
| Authentic Shopify Store | marketplace | Cotton T-Shirt, Bamboo Phone Case, Eco-Friendly Tote |
| Norton Security Direct | software | Antivirus License, VPN Subscription, Password Manager |
| Adobe Creative Hub | software | Stock Photo Pack, Font License, Cloud Storage Upgrade |
| FreshMart Grocery | food | Organic Produce Box, Artisan Bread, Cold-Pressed Juice, Free-Range Eggs |

Deliberate naming strategy: several merchants mimic real brand names to create confusion if an attacker tries to distinguish real from fake transactions.

Each product has a `minCents`/`maxCents` range. The actual transaction amount is randomized within that range for each event.

### Fake Merchant Pages (`/merchant/[slug]`)

Self-hosted pages at `/merchant/<slug>` (e.g., `/merchant/real-etsy-checkout`) that render a simple e-commerce-style UI:

- **Browse view:** Lists all products with "Buy Now" buttons and price ranges
- **Checkout view:** Card entry form (cardholder name, card number, CVV, zip)
- **Confirmation view:** "Order Confirmed" with item and merchant details
- **Layout:** `noindex, nofollow` meta robots tag to prevent search engine indexing
- Client-side only — data entered goes nowhere, the page is purely for bot consumption

---

## Bot-Facing API (Neutral Terminology)

Bot-facing endpoints use "merchant" terminology — no reference to "obfuscation" in any URL, response body, or error message. This is a deliberate security decision so that bots and any attacker reading bot API traffic cannot infer the obfuscation concept.

All three endpoints use the `withBotApi` middleware (Bearer API token auth + rate limiting + access logging).

### `POST /api/v1/bot/merchant/queue`

Bot requests the next merchant checkout task.

- If a pending event exists for this bot, returns it
- Otherwise, creates a new obfuscation event on the spot
- Response:

```json
{
  "event_id": 42,
  "profile_index": 2,
  "merchant_name": "SpicyThai Kitchen",
  "merchant_url": "/merchant/spicythai-kitchen",
  "item_name": "Spicy Coconut PadThai Dish",
  "amount_usd": 15.49,
  "profile_name": "Sarah Mitchell",
  "message": "Purchase \"Spicy Coconut PadThai Dish\" at SpicyThai Kitchen using Profile #2..."
}
```

### `POST /api/v1/bot/merchant/verify`

Bot submits card verification data for a pending event.

- Input: `{ event_id, missing_digits (3 chars), expiry_month, expiry_year }`
- Looks up the fake profile's stored digits/expiry from `fake_profiles_json`
- Compares submitted values against the fake profile's values
- Response: `{ verified: true/false, message: "..." }`
- No information leakage — failure message is generic ("details do not match")

### `POST /api/v1/bot/merchant/complete`

Bot marks a merchant event as completed.

- Input: `{ event_id }`
- Sets event status to `"completed"`, records `occurred_at` timestamp
- Increments the bot's `obfuscation_count` in the state machine
- Response: `{ status: "completed", event_id, merchant_name, item_name, amount_usd, profile_index }`

---

## Owner Management Dashboard (`/app/self-hosted`)

The Self-Hosted Cards page (`app/app/self-hosted/page.tsx`) provides:

- **Bot status list:** Shows all owner's bots with Rail 4 configuration status (not configured / pending setup / active)
- **Setup wizard trigger:** "Set Up Self-Hosted Card" button opens the `Rail4SetupWizard` dialog
- **Per-bot details:** For active bots — decoy filename, real profile number, missing digit positions, creation date
- **Delete configuration:** Confirmation dialog to remove Rail 4 setup
- **Obfuscation monitor:** Expandable panel per bot showing:
  - Current phase (warmup / active / idle) with color-coded badges
  - Organic vs. obfuscation event counts
  - Last organic and last obfuscation timestamps
  - Event history table with profile index, merchant, item, amount, status, and date

---

## Security Hardening

### Bot API neutralization
- All bot-facing endpoints live under `/api/v1/bot/merchant/` (not `/bot/obfuscation/`)
- Error messages use terms like "Self-hosted card", "merchant event" — never "obfuscation"
- No URL, response payload, or error code reveals the obfuscation concept

### Tick endpoint protection
- Requires `Authorization: Bearer <CRON_SECRET>` header
- `CRON_SECRET` is an environment variable (64-char hex, auto-generated)
- Returns 500 if env var is missing (server misconfiguration), 401 if token wrong

### Merchant page privacy
- `/merchant/[slug]` layout exports `metadata.robots = { index: false, follow: false }`
- Renders `<meta name="robots" content="noindex, nofollow"/>` in HTML
- Prevents search engines from indexing or following links on fake merchant pages

---

## File Map

| File | Purpose |
|------|---------|
| `shared/schema.ts` | `rail4Cards`, `obfuscationEvents`, `obfuscationState` table definitions + Zod schemas |
| `lib/rail4.ts` | Decoy file generation — filenames, fake profiles, card numbers, markdown builder |
| `lib/obfuscation-engine/state-machine.ts` | Phase transitions (warmup/active/idle), ratio logic, event recording |
| `lib/obfuscation-engine/scheduler.ts` | `tickBot`, `tickAllActiveBots` — drives event creation per schedule |
| `lib/obfuscation-engine/events.ts` | Creates obfuscation events, completes events, retrieves fake profile data for verification |
| `lib/obfuscation-merchants/catalog.ts` | 12 fake merchants with products, price ranges, slugs |
| `lib/obfuscation-merchants/generator.ts` | Picks random merchant + product, randomizes amounts, picks fake profile index |
| `app/api/v1/rail4/initialize/route.ts` | Owner: generate decoy file + create pending rail4_cards row |
| `app/api/v1/rail4/submit-owner-data/route.ts` | Owner: submit 3 digits, expiry, name, zip → activates card |
| `app/api/v1/rail4/status/route.ts` | Owner: check Rail 4 configuration status per bot |
| `app/api/v1/rail4/route.ts` | Owner: DELETE to remove Rail 4 config |
| `app/api/v1/rail4/obfuscation/status/route.ts` | Owner: obfuscation engine phase + counters |
| `app/api/v1/rail4/obfuscation/history/route.ts` | Owner: list obfuscation events for a bot |
| `app/api/v1/rail4/obfuscation/tick/route.ts` | Cron: process all active bots, create pending events |
| `app/api/v1/bot/merchant/queue/route.ts` | Bot: get next merchant checkout task |
| `app/api/v1/bot/merchant/verify/route.ts` | Bot: submit card verification for an event |
| `app/api/v1/bot/merchant/complete/route.ts` | Bot: mark event completed |
| `app/merchant/[slug]/page.tsx` | Fake merchant storefront (browse → checkout → confirmation) |
| `app/merchant/[slug]/layout.tsx` | noindex/nofollow metadata for merchant pages |
| `components/dashboard/rail4-setup-wizard.tsx` | 4-step setup wizard dialog |
| `components/dashboard/card-type-picker.tsx` | Card type selection (virtual vs. self-hosted) |
| `app/app/self-hosted/page.tsx` | Owner dashboard: manage self-hosted cards + obfuscation monitor |
| `server/storage.ts` | CRUD methods for rail4_cards, obfuscation_events, obfuscation_state |

---

## Storage Interface Methods

```typescript
// Rail 4 card CRUD
createRail4Card(data: InsertRail4Card): Promise<Rail4Card>
getRail4CardByBotId(botId: string): Promise<Rail4Card | null>
updateRail4Card(botId: string, data: Partial<InsertRail4Card>): Promise<Rail4Card | null>
deleteRail4Card(botId: string): Promise<void>

// Obfuscation events
createObfuscationEvent(data: InsertObfuscationEvent): Promise<ObfuscationEvent>
getObfuscationEventsByBotId(botId: string, limit?: number): Promise<ObfuscationEvent[]>
getPendingObfuscationEvents(botId: string): Promise<ObfuscationEvent[]>
completeObfuscationEvent(id: number, occurredAt: Date): Promise<ObfuscationEvent | null>

// Obfuscation state machine
getObfuscationState(botId: string): Promise<ObfuscationState | null>
createObfuscationState(data: InsertObfuscationState): Promise<ObfuscationState>
updateObfuscationState(botId: string, data: Partial<InsertObfuscationState>): Promise<ObfuscationState | null>
```

---

## What Is NOT Yet Implemented

### Sandwich obfuscation (Layer 2)
The design calls for wrapping every real purchase with a pre-obfuscation and post-obfuscation fake checkout. This is not built — real purchases go through the standard wallet purchase flow without any surrounding fake transactions.

### Security briefings (Layer 4)
Daily bot check-ins to reinforce defensive behavior. This is a behavioral layer that would be handled through the bot's skill file / system prompt, not through CreditClaw application code. No API or scheduling infrastructure exists for this.

### Honeypot responses (Layer 5)
Feeding fake card data to extraction attempts. Like security briefings, this is a behavioral layer for the bot's skill file. CreditClaw does not generate or serve honeypot responses.

### Security alert API (Layer 8)
Bot-initiated reporting of suspicious interactions. No `security_alerts` table, no alert filing endpoint, no escalation logic, no security flags on the dashboard.

### Per-profile spending limits
The design describes giving each fake profile its own spending limits. Currently, spending permissions exist only at the bot/wallet level, not per-profile.

---

## What CreditClaw Stores (Per Bot)

| Data | PCI classification | In PCI scope? |
|------|--------------------|---------------|
| 3 middle digits of PAN (positions 7-12 range) | Not cardholder data (truncated fragment) | No |
| Expiry date (month + year, stored separately) | Not cardholder data without PAN | No |
| Authentic profile number (1-6) | Internal reference | No |
| Decoy filename | Internal reference | No |
| Owner name | Standard user data | No |
| Owner zip code | Standard user data | No |
| Owner IP address | Standard user data | No |
| 5 fake profiles (JSON with fake digits, expiry, names, addresses) | Synthetic data | No |
| Obfuscation event history | Operational data | No |
| Obfuscation state machine counters | Operational data | No |

---

## What This Is Not

This is not cryptographically secure. A sophisticated, targeted attack with full access to the bot's runtime environment, network traffic analysis, and unlimited time could still potentially identify real card details. Rail 4 is a practical, layered improvement over the current reality of giving bots full card details with no protection. Each layer independently raises the cost and complexity of a successful attack. Combined, they create an environment where the bot lives an entire fake financial life indistinguishable from its real one.

Rail 4 is a long-term, low-tech security solution for providing credit card checkout capabilities to any claw bot. It works on any website, with any card, with no third-party dependencies. Rails 1-3 serve different use cases — Rail 4 is not a stopgap, it is a permanent offering.
