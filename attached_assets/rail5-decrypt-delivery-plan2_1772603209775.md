# Rail 5: decrypt.js Delivery — Technical Plan

## The Problem

Rail 5 lets a bot purchase from any merchant using an encrypted credit card file. The encryption splits knowledge between two parties:

- **CreditClaw** holds the encryption key material (key_hex, iv_hex, tag_hex) server-side
- **The bot's workspace** holds the encrypted card file (e.g. `Card-ChaseD-9547.md`)

To combine these two pieces and get the plaintext card details, the bot runs a deterministic Node.js script called `decrypt.js`. This script is not secret — it's a generic AES-256-GCM decryption recipe. But it contains a small piece of CreditClaw-specific logic: parsing the base64 ciphertext out of markdown code fences in the encrypted card file. A generic decryption script from npm or a CDN won't work without that parsing step.

**Current gap:** The encrypted card file gets delivered to the bot (via the `rail5.card.delivered` webhook or manual download). The key material gets delivered at checkout time (via `POST /api/v1/bot/rail5/key`). But `decrypt.js` has no delivery mechanism — it's listed as a prerequisite ("must be in your workspace") with no explanation of how it gets there.

As a result, the bot has the encrypted card file, can request the key, but cannot decrypt because `decrypt.js` is missing from its workspace.

## How Rail 5 Checkout Works

The checkout flow has 5 core steps. The bot (main agent) can execute all of them directly. Sub-agent spawning is optional — some OpenClaw environments handle it well, others don't, so the system must work without it.

### Core Steps (executed by whichever agent is doing the checkout)

1. **Request checkout** — call `POST /api/v1/bot/rail5/checkout` with merchant details and amount. CreditClaw validates guardrails/limits and returns a `checkout_id` along with checkout instructions.
2. **Get decryption key** — call `POST /api/v1/bot/rail5/key` with the `checkout_id`. Returns `key_hex`, `iv_hex`, `tag_hex`. Single-use — cannot be retrieved again.
3. **Decrypt the card** — run `node decrypt.js <key_hex> <iv_hex> <tag_hex> Card-ChaseD-9547.md`. Outputs plaintext card JSON (number, CVV, expiry, name, address).
4. **Complete checkout** — navigate to the merchant, fill in the card details, complete the purchase.
5. **Confirm result** — call `POST /api/v1/bot/rail5/confirm` with the `checkout_id` and `status: "success"` or `"failed"`. CreditClaw debits wallet, records transaction, fires webhooks, notifies owner.

### Two Execution Modes

**Direct mode (main agent does everything):**
The main agent executes steps 1–5 itself. Simpler, works on all OpenClaw environments. The trade-off is that the main agent sees the decrypted card details in its context.

**Sub-agent mode (optional, for enhanced security):**
The main agent executes step 1, then spawns an ephemeral sub-agent (`sessions_spawn` with `cleanup: "delete"`) that executes steps 2–5. The sub-agent session is destroyed afterward, so the decrypted card details don't persist in any agent's context. The main agent never sees the card data.

The bot decides which mode to use based on its capabilities. CreditClaw doesn't enforce either pattern — the API endpoints work the same way regardless of who's calling them.

### What needs to change in the codebase

**`lib/rail5/index.ts` — `buildSpawnPayload`** currently returns instructions that assume sub-agent spawning. This should be updated to return **checkout steps** — the raw list of actions to perform — and optionally a spawn payload wrapper. The checkout endpoint response should include:

```json
{
  "approved": true,
  "checkout_id": "r5chk_abc123",
  "checkout_steps": [
    "1. Call POST /api/v1/bot/rail5/key with { \"checkout_id\": \"r5chk_abc123\" } to get the decryption key.",
    "2. Run: node decrypt.js <key_hex> <iv_hex> <tag_hex> Card-ChaseD-9547.md",
    "3. Use the decrypted card details to complete checkout at the merchant URL.",
    "4. Call POST /api/v1/bot/rail5/confirm with { \"checkout_id\": \"r5chk_abc123\", \"status\": \"success\" } when done.",
    "5. If checkout fails, call confirm with { \"status\": \"failed\" } instead."
  ],
  "spawn_payload": {
    "task": "You are a checkout agent. ...<same steps wrapped in spawn instructions>...",
    "cleanup": "delete",
    "runTimeoutSeconds": 300,
    "label": "checkout-digitalocean"
  }
}
```

The bot can use `checkout_steps` directly (direct mode) or use `spawn_payload` to delegate (sub-agent mode). Both are always returned. The bot picks whichever works for its environment.

**`public/skill.md`** — Update the Rail 5 section to document both modes and let the bot choose. Remove language that implies sub-agent spawning is required.

## What decrypt.js Actually Is

A ~10 line Node.js script using only built-in `crypto` and `fs` modules:

```javascript
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

Key facts about this script:

- **100% generic** — same file for every bot, every card, every transaction, every user
- **No secrets inside it** — the uniqueness comes from the runtime arguments (key, IV, tag, filename)
- **CreditClaw-specific** — the regex `raw.match(/```([\s\S]+?)```/)` parses CreditClaw's markdown-fenced encrypted file format; a generic AES-GCM script wouldn't know to do this
- **No dependencies** — uses only Node.js built-ins (`crypto`, `fs`)
- **Deterministic** — not LLM reasoning; run via `exec`, not generated on the fly
- **Only needs to be saved once** — the bot saves it the first time and reuses it for every future Rail 5 checkout

## The Fix: decrypt.js Delivery

Include the `decrypt.js` script content in the `rail5.card.delivered` webhook payload alongside the encrypted card file. One webhook, two files, one delivery.

### What changes

**`app/api/v1/rail5/deliver-to-bot/route.ts`** — Add a `decrypt_script` field to the webhook payload:

Current payload:
```json
{
  "event": "rail5.card.delivered",
  "bot_id": "bot_abc123",
  "data": {
    "card_id": "r5card_...",
    "card_name": "ChaseD",
    "card_last4": "9547",
    "encrypted_file_content": "<markdown file content>"
  }
}
```

Updated payload:
```json
{
  "event": "rail5.card.delivered",
  "bot_id": "bot_abc123",
  "data": {
    "card_id": "r5card_...",
    "card_name": "ChaseD",
    "card_last4": "9547",
    "encrypted_file_content": "<markdown file content>",
    "decrypt_script": "<the decrypt.js source code>"
  }
}
```

Since the script is static and identical for everyone, it can be stored as a constant string in the codebase (e.g. `lib/rail5/decrypt-script.ts`) and included in every delivery payload.

**`lib/rail5/index.ts` — `buildSpawnPayload`** — Refactor to return both `checkout_steps` (array of instruction strings) and `spawn_payload` (the existing spawn wrapper). The checkout endpoint returns both so the bot can choose its execution mode.

**`public/skill.md`** — Update the Rail 5 section to:
- Explain that `decrypt.js` arrives with the card delivery webhook and should be saved to workspace
- Document both direct mode and sub-agent mode
- Make clear that sub-agent spawning is optional, not required

### What does NOT change

- `POST /api/v1/bot/rail5/key` — unchanged, still returns key material (works regardless of who calls it)
- `POST /api/v1/bot/rail5/confirm` — unchanged
- The encrypted card file format — unchanged
- The decrypt script itself — unchanged
- The security model for the key — still single-use per checkout

### Bot-side behavior

When the bot receives the `rail5.card.delivered` webhook:

1. Save `data.encrypted_file_content` as `Card-{name}-{last4}.md` (already does this)
2. Check if `decrypt.js` exists in workspace; if not, save `data.decrypt_script` as `decrypt.js` (new)

When the bot initiates a checkout:

1. Call `/rail5/checkout` → receive `checkout_steps` and `spawn_payload`
2. If the bot supports sub-agents and wants to use them → use `spawn_payload` with `sessions_spawn`
3. If not → execute `checkout_steps` directly as the main agent

## Summary

| Component | Status | Change Needed |
|-----------|--------|---------------|
| Encrypted card file delivery | Working | No |
| Key delivery (`/rail5/key`) | Working | No |
| decrypt.js delivery | **Missing** | Add to webhook payload |
| Checkout endpoint response | Too rigid (spawn-only) | Return both `checkout_steps` and `spawn_payload` |
| Skill file docs | Assumes sub-agent required | Update to document both modes |
| Checkout flow | Blocked at decrypt step | Unblocked by delivering decrypt.js |
