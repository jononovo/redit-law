---
name: creditclaw
description: >
  Virtual wallet and prepaid payment service for AI agents. Use when you need to
  (1) register for a funded wallet you can spend from,
  (2) check your wallet balance,
  (3) view your spending permissions,
  (4) make a purchase (wallet debit),
  (5) request a top-up from your owner, or
  (6) view your transaction history.
  CreditClaw gives you a prepaid wallet funded by your owner. You spend via
  the purchase endpoint which debits your wallet after validating spending rules.
url: https://creditclaw.com
api_base: https://creditclaw.com/api/v1
---

# CreditClaw — Wallet & Payments for AI Agents

| File | URL | Purpose |
|------|-----|---------|
| `skill.md` | `https://creditclaw.com/skill.md` | Full API reference and registration instructions (this file) |
| `heartbeat.md` | `https://creditclaw.com/heartbeat.md` | Lightweight polling routine for balance and spending checks |
| `spending.md` | `https://creditclaw.com/spending.md` | Default spending permissions template (owner-editable) |

## What This Is

CreditClaw gives you a prepaid wallet funded by your human owner.
You register, your owner claims you and adds funds, and then you can make purchases
by calling the purchase endpoint — which debits your wallet after validating your
owner's spending rules (per-transaction limits, daily/monthly caps, category blocks).

## Security

CreditClaw is designed with defense-in-depth to protect your owner's funds:

- **API keys are hashed server-side.** CreditClaw stores only a bcrypt hash of your API key. If our database were compromised, your key cannot be recovered.
- **Spending is enforced server-side.** Every purchase is evaluated in real time against your owner's spending permissions — per-transaction limits, daily caps, monthly caps, and category blocks. These cannot be bypassed.
- **Owner has full visibility.** Every purchase (approved or declined) is logged and visible on your owner's dashboard in real time.
- **Claim tokens are single-use.** The token linking you to your owner is invalidated immediately after use and cannot be replayed.
- **Your owner's payment details never touch CreditClaw.** All owner payment collection is handled by Stripe. CreditClaw references only Stripe payment method IDs — never raw card numbers.

## End-to-End Flow

```
1. You fetch this skill file from creditclaw.com/skill.md
2. You call POST /api/v1/bots/register → get api_key + claim_token
3. You tell your human the claim_token and verification link
4. Human visits creditclaw.com/claim, enters claim_token, adds payment method
5. Your wallet activates with an initial balance
6. You poll GET /api/v1/bot/wallet/check periodically to monitor balance
7. You check GET /api/v1/bot/wallet/spending for your owner's permission rules
8. You make purchases via POST /api/v1/bot/wallet/purchase (wallet debit)
9. When balance is low, you request a top-up via POST /api/v1/bot/wallet/topup-request
10. Human monitors activity from creditclaw.com/app
```

---

## Quick Start

### 1. Register

You can register before your human does. You'll get an API key immediately.

```bash
curl -X POST https://creditclaw.com/api/v1/bots/register \
  -H "Content-Type: application/json" \
  -d '{
    "bot_name": "my-research-bot",
    "owner_email": "jonathan@example.com",
    "description": "Performs web research tasks for hire"
  }'
```

Response:
```json
{
  "bot_id": "bot_a1b2c3d4",
  "api_key": "cck_live_7f3e...",
  "claim_token": "coral-X9K2",
  "status": "pending_owner_verification",
  "owner_verification_url": "https://creditclaw.com/claim?token=coral-X9K2",
  "important": "Save your api_key now — it cannot be retrieved later. Give the claim_token to your human so they can activate your wallet."
}
```

**Save your `api_key` immediately.** It cannot be retrieved again.

**Store your API key securely** using one of these methods (in order of preference):

1. **Environment variable** (recommended):
   ```bash
   export CREDITCLAW_API_KEY="cck_live_7f3e..."
   ```

2. **OS keychain / secrets manager:**
   - macOS Keychain, Linux Secret Service / `libsecret`, or your runtime's credential store

3. **Encrypted config file** with restricted permissions:
   ```bash
   mkdir -p ~/.creditclaw && chmod 700 ~/.creditclaw
   cat > ~/.creditclaw/credentials.json << 'EOF'
   {
     "bot_id": "bot_a1b2c3d4",
     "api_key": "cck_live_7f3e...",
     "claim_token": "coral-X9K2",
     "registered_at": "2026-02-07T00:00:00Z"
   }
   EOF
   chmod 600 ~/.creditclaw/credentials.json
   ```

Load your API key from the above on future sessions — do not re-register.

**What to tell your human:**
> "I've registered for a CreditClaw wallet. To activate it and fund my wallet,
> visit https://creditclaw.com/claim?token=coral-X9K2 — you'll need to add
> a payment method. After that I can spend on your behalf."

**Rate limit:** 3 registrations per IP per hour.

### 2. Human Claims the Bot

Your human visits the claim URL. On the backend:
- They log in or create an account
- They enter the `claim_token`
- Your wallet activates and is ready to receive funds
- The `claim_token` is invalidated after use

After claiming, the human can see your balance, transactions, and spending
limits at `https://creditclaw.com/app`.

### 3. Check Wallet Status (Heartbeat)

Use this lightweight endpoint to poll your wallet status. Recommended
interval: every 30 minutes, or before any purchase.

```bash
curl https://creditclaw.com/api/v1/bot/wallet/check \
  -H "Authorization: Bearer $CREDITCLAW_API_KEY"
```

Response (pending — not yet claimed):
```json
{
  "wallet_status": "pending",
  "balance_usd": 0,
  "card_status": "inactive",
  "message": "Owner has not claimed this bot yet. Share your claim token with your human."
}
```

Response (active):
```json
{
  "wallet_status": "active",
  "balance_usd": 50.00,
  "card_status": "active",
  "spending_limits": {
    "per_transaction_usd": 25.00,
    "monthly_usd": 500.00,
    "monthly_spent_usd": 12.50,
    "monthly_remaining_usd": 487.50
  },
  "pending_topups": 0
}
```

**Status values:**
| Status | Meaning |
|--------|---------|
| `pending` | Registered but owner hasn't claimed yet |
| `active` | Wallet funded, ready to spend |
| `suspended` | Owner or CreditClaw froze the wallet |
| `empty` | Active but $0 balance — request a top-up |

If `wallet_status` is `pending`, remind your human about the claim link.
If `balance_usd` < 5.00, consider requesting a top-up.

### 4. Check Spending Permissions (Before Every Purchase)

Before any purchase, fetch your spending rules. Your owner controls these
and can update them anytime from their dashboard.

```bash
curl https://creditclaw.com/api/v1/bot/wallet/spending \
  -H "Authorization: Bearer $CREDITCLAW_API_KEY"
```

Response:
```json
{
  "approval_mode": "ask_for_everything",
  "limits": {
    "per_transaction_usd": 25.00,
    "daily_usd": 50.00,
    "monthly_usd": 500.00,
    "ask_approval_above_usd": 10.00
  },
  "approved_categories": [],
  "blocked_categories": [
    "gambling",
    "adult_content",
    "cryptocurrency",
    "cash_advances"
  ],
  "recurring_allowed": false,
  "notes": null,
  "updated_at": "2026-02-07T00:00:00Z"
}
```

**You must follow these rules:**
- If `approval_mode` is `ask_for_everything`, send a top-up request or message your owner before any purchase.
- If `approval_mode` is `auto_approve_under_threshold`, you may spend freely up to `ask_approval_above_usd`. Anything above that requires owner approval.
- If `approval_mode` is `auto_approve_by_category`, you may spend freely on `approved_categories` within limits. All others require approval.
- **Never** spend on `blocked_categories`. These are hard blocks enforced server-side and your purchase will be rejected.
- Always read and follow the `notes` field — these are your owner's direct instructions.
- Cache this for up to 30 minutes. Do not fetch before every micro-purchase.

Your owner can update these permissions anytime from `https://creditclaw.com/app`.
A template of the default permissions is available at `https://creditclaw.com/spending.md`.

### 5. Make a Purchase (Wallet Debit)

When you need to spend, call this endpoint. It validates your spending permissions,
checks your balance, and debits your wallet in one atomic operation.

```bash
curl -X POST https://creditclaw.com/api/v1/bot/wallet/purchase \
  -H "Authorization: Bearer $CREDITCLAW_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount_cents": 500,
    "merchant": "OpenAI",
    "description": "API credits purchase",
    "category": "api_services"
  }'
```

Response (approved):
```json
{
  "status": "approved",
  "transaction_id": 42,
  "amount_usd": 5.00,
  "merchant": "OpenAI",
  "description": "OpenAI: API credits purchase",
  "new_balance_usd": 45.00,
  "message": "Purchase approved. Wallet debited."
}
```

Response (rejected — insufficient funds):
```json
{
  "error": "insufficient_funds",
  "balance_usd": 2.50,
  "required_usd": 5.00,
  "message": "Insufficient wallet balance. Request a top-up from your owner."
}
```

Response (rejected — blocked category):
```json
{
  "error": "category_blocked",
  "message": "Spending category \"cryptocurrency\" is blocked by your owner."
}
```

Response (rejected — exceeds limit):
```json
{
  "error": "limit_exceeded",
  "limit_type": "per_transaction",
  "limit_usd": 25.00,
  "requested_usd": 50.00,
  "message": "Amount exceeds per-transaction limit of $25.00"
}
```

**Required fields:**
- `amount_cents` (integer) — amount in cents (e.g., 500 = $5.00)
- `merchant` (string) — who you're paying

**Optional fields:**
- `description` (string) — what you're buying
- `category` (string) — spending category (used for permission checks)

**Server-side validation performs these checks in order:**
1. Is the wallet active?
2. Is the category blocked?
3. Does the amount exceed per-transaction limit?
4. Does the amount exceed daily spending limit?
5. Does the amount exceed monthly spending limit?
6. Does the wallet have sufficient balance?

If all checks pass, the wallet is debited and a transaction record is created.

### 6. Request a Top-Up From Your Owner

When your balance is low, ask your owner to add funds:

```bash
curl -X POST https://creditclaw.com/api/v1/bot/wallet/topup-request \
  -H "Authorization: Bearer $CREDITCLAW_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount_usd": 25.00,
    "reason": "Need funds to purchase API access for research task"
  }'
```

Response:
```json
{
  "topup_request_id": 1,
  "status": "sent",
  "amount_usd": 25.00,
  "owner_notified": true,
  "message": "Your owner has been emailed a top-up request."
}
```

**What happens:**
- Your owner gets an email notification with the amount and reason.
- They can add funds from their dashboard at `https://creditclaw.com/app`.
- Once they add funds, your balance updates automatically.

Poll `GET /api/v1/bot/wallet/check` to see when the balance increases.

### 7. View Transaction History

```bash
curl https://creditclaw.com/api/v1/bot/wallet/transactions?limit=10 \
  -H "Authorization: Bearer $CREDITCLAW_API_KEY"
```

Response:
```json
{
  "transactions": [
    {
      "id": 1,
      "type": "topup",
      "amount_usd": 25.00,
      "description": "Owner top-up",
      "created_at": "2026-02-06T14:30:00Z"
    },
    {
      "id": 2,
      "type": "purchase",
      "amount_usd": 5.00,
      "description": "OpenAI: API credits purchase",
      "created_at": "2026-02-06T15:12:00Z"
    }
  ]
}
```

---

## API Reference

All bot-facing endpoints require `Authorization: Bearer <api_key>` header.
The register endpoint is public (no auth required).

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/bots/register` | Register a new bot. Returns API key + claim token. |
| GET | `/api/v1/bot/wallet/check` | Lightweight heartbeat: balance, status, limits. |
| GET | `/api/v1/bot/wallet/spending` | Get spending permissions and rules set by owner. |
| POST | `/api/v1/bot/wallet/purchase` | Make a purchase (wallet debit). Validates spending rules. |
| POST | `/api/v1/bot/wallet/topup-request` | Ask owner to add funds. Sends email notification. |
| GET | `/api/v1/bot/wallet/transactions` | List transaction history. Supports `?limit=`. |

## Error Responses

| Status Code | Meaning | Example |
|-------------|---------|---------|
| `401` | Invalid or missing API key | `{"error": "unauthorized", "message": "Invalid API key"}` |
| `402` | Insufficient funds for purchase | `{"error": "insufficient_funds", "balance_usd": 2.50, "required_usd": 10.00}` |
| `403` | Wallet not active, category blocked, or limit exceeded | `{"error": "wallet_not_active"}` |
| `429` | Rate limit exceeded | `{"error": "rate_limited", "retry_after_seconds": 600}` |

---

## Important Rules

- **Save your API key on registration.** It cannot be retrieved again. Store in an environment variable (`CREDITCLAW_API_KEY`), OS keychain, or encrypted config file with `chmod 600` permissions.
- **Purchases debit your wallet.** The purchase endpoint validates spending rules and deducts from your balance in one step. There is no separate card number to manage.
- **Spending is enforced server-side.** Your owner's limits and blocked categories are checked on every purchase. Blocked purchases are rejected with a clear error message.
- **Balance can reach $0.** Purchases will be declined. Request a top-up.
- **One bot = one wallet.** Your wallet is unique to you and linked to your owner's account.
- **Poll responsibly.** Use `GET /api/v1/bot/wallet/check` no more than every 30 minutes unless you are actively waiting for a top-up.
