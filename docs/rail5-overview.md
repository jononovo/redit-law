# Rail 5: Sub-Agent Cards — Technical Overview

**February 2026 • Internal**

---

## What Rail 5 Is

Rail 5 lets a bot purchase from any merchant using an encrypted card file that CreditClaw can't read and a decryption key that's only ever handed to a disposable sub-agent. CreditClaw holds zero card data. The bot's main agent never sees card details or the decryption key.

**Owner holds:** An encrypted `.md` file containing full card details (e.g., `Card-Harry-26-Visa.md`).  
**CreditClaw holds:** The AES-256-GCM decryption key. No card data. Not PCI-scoped.  
**Main agent holds:** A reference to the encrypted file. Can't decrypt it.  
**Sub-agent (ephemeral):** Gets the key from CreditClaw, decrypts, checks out, announces result, gets deleted.

---

## How Rail 5 Differs from Rail 4

Rail 5 is **autonomous from Rail 4**. Own table, own folder, own page, own endpoints. It shares only platform-level infrastructure.

| | Rail 5 | Rail 4 |
|---|---|---|
| CreditClaw stores card data | **No** — only the decryption key | Yes — 3 missing digits + expiry |
| Card file format | 1 encrypted profile | 6 profiles (5 fake + 1 real) |
| Obfuscation engine | Not used | Core feature |
| Fake profiles | None | 5 per card |
| Main agent sees card details | Never | Yes (assembles at checkout) |
| Sub-agent required | Yes (OpenClaw) | No |
| Dashboard page | `/app/sub-agent-cards` | `/app/self-hosted` |
| DB table | `rail5_cards` | `rail4_cards` |
| API folder | `/api/v1/rail5/*` + `/api/v1/bot/rail5/*` | `/api/v1/rail4/*` + `/api/v1/bot/merchant/*` |

**Shared platform infrastructure** (not duplicated): `withBotApi` middleware, bot auth (`lib/bot-auth.ts`), wallet + spending controls, master guardrails, webhooks, notifications, rate limiting.

---

## File Structure

```
lib/
  rail5.ts                                 # Spawn payload builder, validation helpers

app/
  api/v1/rail5/
    initialize/route.ts                    # Owner: create card record (POST)
    submit-key/route.ts                    # Owner: store encryption key (POST)
    cards/route.ts                         # Owner: list rail5 cards (GET)
  api/v1/bot/rail5/
    key/route.ts                           # Bot: sub-agent gets decryption key (POST)
    checkout/route.ts                      # Bot: get spawn payload (POST)
    confirm/route.ts                       # Bot: sub-agent reports result (POST)
  app/sub-agent-cards/
    page.tsx                               # Dashboard listing page
    [cardId]/page.tsx                      # Card detail page

components/dashboard/
  rail5-setup-wizard.tsx                   # Onboarding wizard
  rail5-card-manager.tsx                   # Card settings on detail page

shared/schema.ts                           # Add: rail5_cards table + types
server/storage.ts                          # Add: rail5 storage methods
lib/rate-limit.ts                          # Add: rate limit entries

public/
  skill.md                                 # Append: Rail 5 section
  decrypt.js                               # Deterministic decrypt script for bot workspace
```

---

## Database: `rail5_cards` Table

New table. Does not touch `rail4_cards`.

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
| `spending_limit_cents` | integer | Per-checkout spending cap |
| `daily_limit_cents` | integer | Daily aggregate cap |
| `monthly_limit_cents` | integer | Monthly aggregate cap |
| `human_approval_above_cents` | integer | Require owner approval above this |
| `status` | text | `pending_setup` → `active` → `frozen` |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

**What's NOT stored:** Card number, CVV, expiry, name, address, or any data that could identify the card.

---

## Onboarding Flow (Setup Wizard)

Standalone component at `components/dashboard/rail5-setup-wizard.tsx`.

### Step 1: Card Name + Brand
User enters a name ("Harry's Visa"), selects brand, enters last 4 digits. Display-only.

### Step 2: Explanation
"CreditClaw will never see your card details. Everything is encrypted in your browser before it leaves this page."

### Step 3: Full Card Entry
User enters: number, CVV, expiry, cardholder name, billing address. **None of this leaves the browser.**

### Step 4: Client-Side Encryption + Download

The browser encrypts all card data, sends **only the key** to CreditClaw, and triggers the encrypted file download:

```typescript
// In the browser (rail5-setup-wizard.tsx)

// 1. Generate AES-256-GCM key
const key = await crypto.subtle.generateKey(
  { name: "AES-GCM", length: 256 }, true, ["encrypt"]
);
const iv = crypto.getRandomValues(new Uint8Array(12));

// 2. Encrypt card JSON
const cardJson = JSON.stringify({
  number: "4111111111111111", cvv: "123",
  exp_month: 3, exp_year: 2027,
  name: "Harry Smith",
  address: "123 Main St", city: "New York", state: "NY", zip: "10001",
});
const ciphertext = await crypto.subtle.encrypt(
  { name: "AES-GCM", iv }, key, new TextEncoder().encode(cardJson)
);

// 3. Export raw key
const rawKey = await crypto.subtle.exportKey("raw", key);

// 4. Send ONLY key material to CreditClaw (no card data)
await authFetch("/api/v1/rail5/submit-key", {
  method: "POST",
  body: JSON.stringify({
    card_id: cardId,
    key_hex: bufToHex(rawKey),                                // 64 hex chars
    iv_hex: bufToHex(iv),                                     // 24 hex chars
    tag_hex: bufToHex(new Uint8Array(ciphertext.slice(-16))), // 32 hex chars
  }),
});

// 5. Build and download encrypted .md file — never touches server
const b64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
const md = `# CreditClaw Encrypted Card\n\n\`\`\`\n${b64}\n\`\`\`\n`;
downloadFile(md, `Card-${cardName}-${last4}.md`);
```

**Why Web Crypto API:** Built into every modern browser. No library. AES-256-GCM is authenticated encryption (tamper-proof via auth tag). Plaintext card data never leaves the browser.

### Step 5: Spending Limits
Per-checkout limit, daily/monthly caps, human approval threshold.

### Step 6: Bot Connection
Link the card to a bot (select existing or generate pairing code).

### Step 7: Success
Reminder to place the encrypted `.md` file in the bot's OpenClaw workspace.

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

CreditClaw validates spending limits and returns a spawn payload. **No card data or key in this response.**

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

If above `human_approval_above_cents`, returns `"status": "pending_approval"` instead.

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
// decrypt.js — in bot's OpenClaw workspace
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

### Bot-Facing (Bearer Token Auth via `withBotApi`)

| Method | Path | Rate Limit | Purpose |
|---|---|---|---|
| POST | `/api/v1/bot/rail5/checkout` | 30/hr | Validate spend + return spawn payload |
| POST | `/api/v1/bot/rail5/key` | 30/hr | Return decryption key (single-use) |
| POST | `/api/v1/bot/rail5/confirm` | 30/hr | Sub-agent reports checkout result |

---

## Verified Technology (Jan–Feb 2026)

**OpenClaw `sessions_spawn` + `cleanup: "delete"`**  
Production since v2026.2.15. `/subagents spawn` command added v2026.2.17 for deterministic skill-file triggering.  
→ [docs.openclaw.ai/tools/subagents](https://docs.openclaw.ai/tools/subagents)

**OpenClaw `exec` tool**  
Available to sub-agents by default (`group:runtime`). Node.js on all gateway hosts (required since v2026.1.29). Decrypt script uses only `node:crypto`.  
→ [docs.openclaw.ai/tools/exec](https://docs.openclaw.ai/tools/exec)

**Web Crypto API (AES-256-GCM)**  
W3C standard. All modern browsers. No external library needed.  
→ [MDN: SubtleCrypto.encrypt()](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/encrypt)

**Node.js `crypto.createDecipheriv` (AES-256-GCM)**  
Stable since Node 10+. Built-in, no dependencies.  
→ [Node.js crypto docs](https://nodejs.org/api/crypto.html)

**OpenClaw RFC #9676: Agent-Blind Credential Architecture**  
Community proposal for credential broker pattern. Rail 5 is a domain-specific implementation.  
→ [github.com/openclaw/openclaw/discussions/9676](https://github.com/openclaw/openclaw/discussions/9676)

---

## Security Properties

| Property | Rail 5 |
|---|---|
| CreditClaw holds card data | **No** |
| Main agent sees card details | **Never** |
| Main agent sees decryption key | **Never** |
| Card data in persistent context | **Never** — only in ephemeral sub-agent |
| Encrypted at rest | **Yes** — AES-256-GCM on owner's machine |
| Single point of compromise | **None** — file without key is gibberish, key without file decrypts nothing |
| Key delivery | Single-use per checkout, only to authenticated sub-agent |
| Spending controls | Per-checkout, daily, monthly limits + master guardrails |
| Human approval | Configurable threshold |
| Sub-agent timeout | 5 minutes, then killed + deleted |
