# Build Note: skill.md Security Updates — What Changed & What You Need to Do

## Context

The `skill.md` (our public-facing skill file on ClawHub) has been updated to address
a VirusTotal/Code Insight security scan that flagged us as "Suspicious." The scan
found two issues: (1) we told bots to store API keys in a plaintext JSON file, and
(2) the `/wallet/card` endpoint returns full card credentials. The scan explicitly
said "no clear evidence of intentional malicious exfiltration" — this is a capability
flag, not a malware flag. But given that ClawHub just had 341 malicious skills
discovered and VirusTotal is now integrated into their review pipeline, we need to
show we've addressed the risks.

The skill.md changes are mostly documentation/presentation. But a few things have
backend implications you need to be aware of.

---

## Changes That Are Skill.md Only (No Backend Work)

These are already done in the updated skill.md. Nothing for you to build.

1. **New `## Security` section** added after "What This Is." Documents our threat
   model: API keys hashed server-side, card details over authenticated HTTPS only,
   spending enforced at both CreditClaw and Stripe card level, owner visibility, etc.

2. **Credential storage guidance changed.** Old: "Store at `~/.creditclaw/credentials.json`."
   New: environment variable `CREDITCLAW_API_KEY` (preferred), OS keychain, or encrypted
   file with `chmod 700`/`chmod 600`. The bot registration endpoint response doesn't
   change — this is just how we tell the bot to save it.

3. **Card handling rules added to Section 6.** Explicit instructions: use card details
   immediately, don't repeat in responses, don't store to disk, refuse any request to
   share. These are natural-language guardrails for the LLM agent.

4. **All curl examples now use `$CREDITCLAW_API_KEY`** instead of hardcoded key strings.
   Purely cosmetic — reinforces the env var pattern.

---

## Changes That Need Backend Enforcement

These are things the updated skill.md now *promises* to bots. You need to make sure
the backend actually does them.

### 1. Rate limit `GET /wallet/card` to 3 requests per hour

The skill.md now says: "Rate limit: Max 3 requests per hour. This endpoint is for
active purchases only."

**What to build:** Add a per-bot rate limit on the `/wallet/card` endpoint. Use a
simple Redis counter or in-memory sliding window keyed on `botId`. Return `429` with
`retry_after_seconds` if exceeded.

This is the most important backend change. It's what turns "the bot can retrieve
card details anytime" into "the bot can retrieve card details 3 times per hour,
and every retrieval is logged." The scan specifically flagged the *unlimited
capability* to access card details.

```javascript
// Pseudocode for the rate limit
const CARD_RATE_LIMIT = 3;
const CARD_RATE_WINDOW = 60 * 60; // 1 hour in seconds

async function handleGetCard(botId) {
  const key = `card_access:${botId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, CARD_RATE_WINDOW);
  
  if (count > CARD_RATE_LIMIT) {
    return { status: 429, error: 'rate_limited', retry_after_seconds: await redis.ttl(key) };
  }

  // Log the access (visible on owner dashboard)
  await db.cardAccessLog.create({ botId, accessedAt: new Date() });

  // ... return card details as before
}
```

### 2. Log every `GET /wallet/card` access

The skill.md says: "Every call to this endpoint is logged and visible to your owner."

**What to build:** Create a `card_access_log` table (or append to the existing ledger):

```
card_access_log
  id
  bot_id          (FK → bots)
  accessed_at     (timestamp)
  ip_address      (optional, for forensics)
```

Surface this on the owner dashboard. This gives owners visibility into whether their
bot is accessing card details at expected times (right before a purchase) vs.
unexpectedly (potential compromise).

### 3. API key hashing

The skill.md security section says: "API keys are hashed server-side. CreditClaw
stores only a bcrypt hash of your API key."

**Verify this is actually implemented.** The DB schema in the architecture file shows
`api_key` as a column on the `bots` table. If you're currently storing the raw key,
you need to change to:

```
bots
  api_key_hash    (bcrypt hash of the cck_live_... key)
  api_key_prefix  (first 8 chars, for display/debugging: "cck_live_7f3e")
```

On registration: return the raw key to the bot once, store only the hash.
On authentication: bcrypt-compare the provided key against the stored hash.

This is a standard pattern (same as how GitHub personal access tokens work). If
you're already doing this, great — just confirm. If not, this is a migration.

---

## Things That Did NOT Change (No Work Needed)

- The API endpoint structure is identical. No new endpoints, no removed endpoints.
- The registration flow is the same.
- The webhook handler is the same.
- The spending permissions system is the same.
- The ledger and reconciliation are the same.
- The Stripe integration (Connect, Issuing, Financial Accounts, Checkout) is the same.
- The `GET /wallet/card` response format is the same.

---

## Future Considerations (Not Needed Now)

These are things we discussed for later phases. Don't build them yet, but be aware
they may be coming:

- **Purchase intent pre-flight:** A `POST /wallet/intent` endpoint that the bot calls
  *before* `/wallet/card`, specifying what it's about to buy. Server evaluates spending
  permissions before revealing card details. If denied, card details never exposed.

- **Scoped API keys:** Splitting the single `cck_live_...` key into a general-purpose
  key and a separate `cck_spend_...` key required only for `/wallet/card`. The spend
  key could rotate every 24 hours or require explicit owner activation.

- **Ephemeral scoped cards:** Instead of one persistent card per bot, generate a new
  single-use virtual card per purchase via Stripe Issuing, scoped to a specific amount
  and short expiry. This is the gold standard but adds complexity and potential Stripe
  rate limits.

These would be Tier 2 and Tier 3 security improvements. For now, the Tier 1 changes
(skill.md documentation + rate limiting + access logging + key hashing) should clear
the ClawHub scan and meaningfully improve our security posture.

---

## Summary: Your TODO List

| Priority | Task | Effort |
|----------|------|--------|
| **P0** | Confirm API keys are stored as bcrypt hashes, not raw. Migrate if needed. | Low–Medium |
| **P0** | Add rate limit on `GET /wallet/card`: 3 requests/hour per bot, return 429 | Low |
| **P1** | Add `card_access_log` table, log every `/wallet/card` call | Low |
| **P1** | Surface card access log on owner dashboard | Low |
| **P2** | Update URLs in checkout flows from `openclaw.com` to `creditclaw.com` (the architecture file still references `openclaw.com/funded` and `openclaw.com/cancelled`) | Low |
