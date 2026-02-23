---
name: creditclaw-heartbeat
version: 2.3.0
---

# CreditClaw Heartbeat (suggested: every 30 minutes)

Run this routine periodically to stay aware of your wallet status,
spending permissions, and balance across all active rails.

Full API reference: https://creditclaw.com/skill.md

---

## 1. Check Full Status (Recommended)

```bash
curl https://creditclaw.com/api/v1/bot/status \
  -H "Authorization: Bearer $CREDITCLAW_API_KEY"
```

This single endpoint returns your status across **all connected payment rails**,
including balances, spending limits, and master guardrails.

**Response fields:**
- `status` — your overall status (`active`, `pending`, `frozen`, `inactive`)
- `default_rail` — your owner's preferred payment rail for you (may be null)
- `active_rails` — list of rail names you're connected to
- `rails` — detailed status per rail (balance, limits, cards)
- `master_guardrails` — cross-rail spending limits set by your owner

**If `status` is `pending`:**
Remind your human to claim you at the `owner_verification_url` you received
during registration.

**If `status` is `frozen`:**
Do not attempt any purchases. Tell your human:
> "My CreditClaw wallet has been frozen. Please check the dashboard
> at https://creditclaw.com/app."

**If any rail balance is low (< $5.00):**
Ask your human if they'd like you to request a top-up:

```bash
curl -X POST https://creditclaw.com/api/v1/bot/wallet/topup-request \
  -H "Authorization: Bearer $CREDITCLAW_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount_usd": 25.00,
    "reason": "Balance is low — need funds to continue operations"
  }'
```

Then tell your human:
> "My CreditClaw balance is low ($X.XX remaining). I've sent you a
> top-up request — please add funds when you get a chance."

## 2. Check Spending Permissions

```bash
curl https://creditclaw.com/api/v1/bot/wallet/spending \
  -H "Authorization: Bearer $CREDITCLAW_API_KEY"
```

Cache this response for up to 30 minutes. Check it before any purchase.

**Key fields to act on:**
- `approval_mode` — determines whether you can auto-spend or must ask first
- `blocked_categories` — never attempt purchases in these categories
- `notes` — read and follow these; they are direct instructions from your owner
- `updated_at` — if this changed since your last check, re-read all fields

## 3. Summary

| Check | Endpoint | Frequency |
|-------|----------|-----------|
| Full status (all rails) | `GET /bot/status` | Every 30 minutes |
| Spending permissions | `GET /bot/wallet/spending` | Every 30 minutes, or before purchases |

> **Legacy:** `GET /bot/wallet/check` still works but only shows prepaid wallet status.
> Use `GET /bot/status` instead for a complete cross-rail view.

If everything looks good (status is `active`, balance is healthy, permissions
haven't changed), do nothing. Resume your normal tasks.
