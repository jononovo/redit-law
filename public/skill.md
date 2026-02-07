---
name: creditclaw
version: 1.0.5
updated: 2026-02-07
description: >
  Prepaid wallet and spending controls for AI agents. Use when you need to
  (1) register for a funded wallet your owner controls,
  (2) check your wallet balance,
  (3) make purchases (wallet debits) within your owner's spending rules,
  (4) request a top-up from your owner,
  (5) generate a payment link to charge anyone for a service you performed, or
  (6) view your transaction history.
  Your owner funds your wallet and sets strict spending limits; you spend from it.
homepage: https://creditclaw.com
api_base: https://creditclaw.com/api/v1
---

# CreditClaw — Wallet & Payments for AI Agents

| File | URL | Purpose |
|------|-----|---------|
| `skill.md` | `https://creditclaw.com/skill.md` | Full API reference and registration instructions (this file) |
| `heartbeat.md` | `https://creditclaw.com/heartbeat.md` | Lightweight polling routine for balance and spending checks |
| `spending.md` | `https://creditclaw.com/spending.md` | Default spending permissions template (owner-editable) |

## What This Is

CreditClaw gives you a prepaid wallet funded by your owner. Your owner adds their credit card,
sets strict spending limits, and funds your wallet. You spend from your wallet balance via
`POST /bot/wallet/purchase`. You can also generate Stripe-hosted payment links to charge
humans for services you provide. Virtual card issuance (real card numbers) is coming soon.

## Security

CreditClaw is designed with defense-in-depth to protect your owner's funds:

- **API keys are hashed server-side.** CreditClaw stores only a bcrypt hash of your API key. If our database were compromised, your key cannot be recovered.
- **Spending is enforced server-side.** Every purchase is evaluated in real time against your owner's spending permissions — per-transaction limits, daily limits, monthly caps, category blocks, and approval modes. These rules cannot be bypassed.
- **Owner has full visibility.** Every purchase attempt (approved or declined) is logged and visible on your owner's dashboard in real time. Suspicious activity triggers automatic alerts.
- **Wallets can be frozen.** Your owner can freeze your wallet at any time. While frozen, all purchase attempts are rejected.
- **Claim tokens are single-use.** The token linking you to your owner is invalidated immediately after use and cannot be replayed.
- **Your owner's payment details never touch CreditClaw.** All owner payment collection is handled by Stripe. CreditClaw references only Stripe Customer IDs — never raw card numbers.

## End-to-End Flow

```
1. You fetch this skill file from creditclaw.com/skill.md
2. You call POST /bots/register → get apiKey + claimToken
3. You tell your human the claimToken and verification link
4. Human visits creditclaw.com/claim, enters claimToken, adds payment method
5. Your wallet activates
6. You poll GET /bot/wallet/check periodically to monitor balance
7. You check GET /bot/wallet/spending for your owner's permission rules
8. You spend via POST /bot/wallet/purchase (wallet debit)
9. When balance is low, you request a top-up or generate a payment link
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
    "description": "Performs web research tasks for hire",
    "callback_url": "https://my-bot.example.com/webhook"
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

Optional fields: `callback_url` (HTTPS, enables webhooks), `pairing_code` (6-digit code from owner — skips claim step, wallet activates instantly). If you provided a `callback_url`, the response includes a `webhook_secret` for verifying signatures.

**⚠️ Save your `api_key` immediately.** It cannot be retrieved again.

**Store your API key securely** using one of these methods (in order of preference):

1. **Environment variable** (recommended):
   ```bash
   export CREDITCLAW_API_KEY="cck_live_7f3e..."
   ```

2. **OS keychain / secrets manager:**
   - macOS Keychain, Linux Secret Service / `libsecret`, or your runtime's credential store

3. **Encrypted config file** with restricted permissions:
   ```bash
   # Only if environment variables are unavailable
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
- They add a credit card (Stripe saves it for future top-ups)
- Your wallet activates
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

Response:
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
| `active` | Wallet funded and ready to use |
| `inactive` | Owner claimed but no wallet record yet (edge case) |
| `empty` | Active but $0 balance — request a top-up |

If `wallet_status` is `pending`, remind your human about the claim link.
If `balance_usd` < 5.00, consider requesting a top-up.

**Rate limit:** 6 requests per hour. Poll responsibly.

### 4. Check Spending Permissions (Before Every Purchase)

Before any purchase, fetch your spending rules. Your owner controls this file
and can update it anytime from their dashboard.

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
  "approved_categories": [
    "api_services",
    "cloud_compute",
    "research_data"
  ],
  "blocked_categories": [
    "gambling",
    "adult_content",
    "cryptocurrency",
    "cash_advances"
  ],
  "recurring_allowed": false,
  "notes": "Prefer free tiers before paying. Always check for discount codes. No annual plans without asking me first.",
  "updated_at": "2026-02-06T18:00:00Z"
}
```

**You must follow these rules:**
- If `approval_mode` is `ask_for_everything`, send a top-up request or message your owner before any purchase.
- If `approval_mode` is `auto_approve_under_threshold`, you may spend freely up to `ask_approval_above_usd`. Anything above that requires owner approval.
- If `approval_mode` is `auto_approve_by_category`, you may spend freely on `approved_categories` within limits. All others require approval.
- **Never** spend on `blocked_categories`. These are hard blocks enforced server-side.
- Always read and follow the `notes` field — these are your owner's direct instructions.
- Cache this for up to 30 minutes. Do not fetch before every micro-purchase.

Your owner can update these permissions anytime from `https://creditclaw.com/app`.
A template of the default permissions is available at `https://creditclaw.com/spending.md`.

### 5. Make a Purchase (Wallet Debit)

When you need to spend money, call the purchase endpoint. CreditClaw checks your
owner's spending rules, debits your wallet, and logs the transaction.

```bash
curl -X POST https://creditclaw.com/api/v1/bot/wallet/purchase \
  -H "Authorization: Bearer $CREDITCLAW_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount_cents": 599,
    "merchant": "OpenAI API",
    "description": "GPT-4 API credits",
    "category": "api_services"
  }'
```

`amount_cents` is in **cents** (integer) — e.g. $5.99 = `599`. `merchant` is required (1-200 chars). `description` and `category` are optional.

Response (approved):
```json
{
  "status": "approved",
  "transaction_id": 42,
  "amount_usd": 5.99,
  "merchant": "OpenAI API",
  "description": "OpenAI API: GPT-4 API credits",
  "new_balance_usd": 44.01,
  "message": "Purchase approved. Wallet debited."
}
```

Possible decline errors: `insufficient_funds` (402), `wallet_frozen`, `wallet_not_active`,
`category_blocked`, `exceeds_per_transaction_limit`, `exceeds_daily_limit`,
`exceeds_monthly_limit`, `requires_owner_approval` (all 403).

**Rate limit:** 30 requests per hour.

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
  "topup_request_id": 7,
  "status": "sent",
  "amount_usd": 25.00,
  "owner_notified": true,
  "message": "Your owner has been emailed a top-up request."
}
```

**What happens:**
- Your owner gets an email notification with the requested amount and reason.
- They log in to their dashboard and fund your wallet using their saved card.
- Once payment completes, your balance updates automatically.

Poll `GET /bot/wallet/check` to see when the balance increases.

**Rate limit:** 3 requests per hour.

### 7. Generate a Payment Link (Charge Anyone)

You performed a service and want to get paid:

```bash
curl -X POST https://creditclaw.com/api/v1/bot/payments/create-link \
  -H "Authorization: Bearer $CREDITCLAW_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "amount_usd": 10.00,
    "description": "Research report: Q4 market analysis",
    "payer_email": "client@example.com"
  }'
```

Response:
```json
{
  "payment_link_id": "pl_q7r8s9",
  "checkout_url": "https://checkout.stripe.com/c/pay/cs_live_...",
  "amount_usd": 10.00,
  "status": "pending",
  "expires_at": "2026-02-07T21:00:00Z"
}
```

Send `checkout_url` to whoever needs to pay. When they do:
- Funds land in your wallet.
- Your balance increases.
- The payment shows in your transaction history.

### 8. View Transaction History

```bash
curl "https://creditclaw.com/api/v1/bot/wallet/transactions?limit=10" \
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
      "amount_usd": 5.99,
      "description": "OpenAI API: GPT-4 API credits",
      "created_at": "2026-02-06T15:12:00Z"
    },
    {
      "id": 3,
      "type": "payment_received",
      "amount_usd": 10.00,
      "description": "Research report: Q4 market analysis",
      "created_at": "2026-02-06T16:45:00Z"
    }
  ]
}
```

---

## API Reference

All endpoints require `Authorization: Bearer <api_key>` header (except register).

| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| POST | `/bots/register` | Register a new bot. Returns API key + claim token. | 3/hr per IP |
| GET | `/bot/wallet/check` | Lightweight heartbeat: balance, status, limits. | 6/hr |
| GET | `/bot/wallet/spending` | Get spending permissions and rules set by owner. | 6/hr |
| POST | `/bot/wallet/purchase` | Make a purchase (wallet debit). | 30/hr |
| POST | `/bot/wallet/topup-request` | Ask owner to add funds. Sends email notification. | 3/hr |
| POST | `/bot/payments/create-link` | Generate a payment link to charge anyone. | 10/hr |
| GET | `/bot/payments/links` | List your payment links. Supports `?status=` and `?limit=`. | 12/hr |
| GET | `/bot/wallet/transactions` | List transaction history. Supports `?limit=` (default 50, max 100). | 12/hr |

## Error Responses

| Status Code | Meaning | Example |
|-------------|---------|---------|
| `400` | Invalid request body or parameters | `{"error": "validation_error", "message": "Invalid request body"}` |
| `401` | Invalid or missing API key | `{"error": "unauthorized", "message": "Invalid API key"}` |
| `402` | Insufficient funds for purchase | `{"error": "insufficient_funds", "balance_usd": 2.50, "required_usd": 10.00}` |
| `403` | Wallet frozen, not active, or spending rule violation | `{"error": "wallet_frozen", "message": "This wallet is frozen by the owner."}` |
| `409` | Duplicate registration or race condition | `{"error": "duplicate_registration", "message": "A bot with this name already exists."}` |
| `429` | Rate limit exceeded | `{"error": "rate_limited", "retry_after_seconds": 600}` |

## Webhooks (Optional)

Provide a `callback_url` during registration to receive POST events. Webhooks are signed
with HMAC-SHA256 via the `X-CreditClaw-Signature` header — verify using your `webhook_secret`.

| Event | When |
|-------|------|
| `wallet.activated` | Owner claimed bot and wallet is live |
| `wallet.topup.completed` | Funds added to your wallet |
| `wallet.payment.received` | Someone paid your payment link |
| `wallet.spend.authorized` | A purchase was approved |
| `wallet.spend.declined` | A purchase was declined |
| `wallet.balance.low` | Balance dropped below $5.00 |

---

## Important Rules

- **Save your API key on registration.** It cannot be retrieved again. Store in an environment variable (`CREDITCLAW_API_KEY`), OS keychain, or encrypted config file with `chmod 600` permissions.
- **Spending is enforced server-side.** Your owner's limits and blocked categories are enforced by CreditClaw on every purchase attempt. Even if you try a blocked purchase, it will be declined.
- **Balance can reach $0.** Purchases will be declined. Request a top-up.
- **Payment links expire in 24 hours.** Generate a new one if needed.
- **One bot = one wallet.** Your wallet is unique to you and linked to your owner's account.
- **Poll responsibly.** Use `GET /bot/wallet/check` no more than every 10 minutes unless you are actively waiting for a top-up.
- **Virtual cards coming soon.** Currently all spending is via `POST /bot/wallet/purchase` (wallet debit). Virtual card issuance is a planned future feature.
