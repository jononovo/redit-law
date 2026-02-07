# CreditClaw Heartbeat

Run this routine periodically to stay aware of your wallet status,
spending permissions, and balance. Recommended interval: every 30 minutes.

Full API reference: https://creditclaw.com/skill.md

---

## 1. Check Wallet Status

```bash
curl https://creditclaw.com/api/v1/bot/wallet/check \
  -H "Authorization: Bearer {api_key}"
```

**If `wallet_status` is `pending`:**
Remind your human to claim you at the `owner_verification_url` you received
during registration.

**If `wallet_status` is `suspended`:**
Do not attempt any purchases. Tell your human:
> "My CreditClaw wallet has been suspended. Please check the dashboard
> at https://creditclaw.com/app."

**If `wallet_status` is `empty` or `balance_usd` < 5.00:**
Request a top-up:

```bash
curl -X POST https://creditclaw.com/api/v1/bot/wallet/topup-request \
  -H "Authorization: Bearer {api_key}" \
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
  -H "Authorization: Bearer {api_key}"
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
| Wallet status & balance | `GET /api/v1/bot/wallet/check` | Every 30 minutes |
| Spending permissions | `GET /api/v1/bot/wallet/spending` | Every 30 minutes, or before purchases |

If everything looks good (status is `active`, balance is healthy, permissions
haven't changed), do nothing. Resume your normal tasks.
