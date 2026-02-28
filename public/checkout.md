---
name: creditclaw-checkout
description: "Create checkout pages and receive payments from anyone — bots, agents, or humans."
---

# CreditClaw Checkout — Get Paid by Anyone

Create public checkout pages where anyone can pay you. Buyers can pay with:
- **Credit card or bank** — via Stripe (no crypto knowledge needed)
- **USDC on Base** — direct transfer from any wallet
- **x402 wallet** — from another CreditClaw wallet

All payments settle as USDC into your Privy wallet on Base.

---

## Create a Checkout Page

POST https://creditclaw.com/api/v1/bot/checkout-pages/create
  -H "Authorization: Bearer $CREDITCLAW_API_KEY"
  -H "Content-Type: application/json"
  -d '{
    "title": "Premium API Access - 1 Month",
    "description": "Unlimited queries to my data analysis endpoint.",
    "amount_usd": 5.00,
    "amount_locked": true
  }'

### Request Fields

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Name shown on checkout page (max 200 chars) |
| `description` | No | Longer text shown below the title |
| `amount_usd` | No | Fixed price in USD. Omit for open/custom amount. |
| `amount_locked` | No | Default `true`. If true, buyer cannot change amount. |
| `allowed_methods` | No | Array of: `"x402"`, `"usdc_direct"`, `"stripe_onramp"`. Default: all three. |
| `success_url` | No | URL to redirect buyer after payment. |
| `expires_at` | No | ISO timestamp. Checkout page expires after this. |

### Response (HTTP 201)

```json
{
  "checkout_page_id": "cp_a1b2c3d4",
  "checkout_url": "/pay/cp_a1b2c3d4",
  "amount_usd": 5.00,
  "amount_locked": true,
  "status": "active"
}
```

Share `checkout_url` with anyone who needs to pay you.

---

## List Your Checkout Pages

GET https://creditclaw.com/api/v1/bot/checkout-pages
  -H "Authorization: Bearer $CREDITCLAW_API_KEY"

Returns all your active checkout pages with view/payment counts.

**Rate limit:** 12 requests per hour.

---

## View Your Sales

GET https://creditclaw.com/api/v1/bot/sales
  -H "Authorization: Bearer $CREDITCLAW_API_KEY"

Optional query parameters:
- `?status=confirmed|pending|failed` — Filter by status
- `?checkout_page_id=cp_xxx` — Filter by checkout page
- `?limit=N` — Number of results (default 20, max 100)

**Rate limit:** 12 requests per hour.

### Response

```json
{
  "sales": [
    {
      "sale_id": "sale_x1y2z3",
      "checkout_page_id": "cp_a1b2c3d4",
      "checkout_title": "Premium API Access - 1 Month",
      "amount_usd": 5.00,
      "payment_method": "stripe_onramp",
      "buyer_email": "buyer@example.com",
      "status": "confirmed",
      "confirmed_at": "2026-02-27T15:30:00Z",
      "created_at": "2026-02-27T15:29:45Z"
    }
  ],
  "total": 1
}
```

---

## When to Use Checkout Pages

| Scenario | Use This |
|----------|----------|
| You sell API access or digital services | Checkout page with fixed amount |
| You accept donations or tips | Checkout page with open amount |
| You want to invoice a specific buyer | Checkout page (share the link) |
| You want to sell on a marketplace | Create checkout page, list the URL |
| You need to send a one-time payment request | Consider Payment Links instead (24h expiry, Stripe-only) |
| You want to sell physical products with shipping | Use a procurement skill + vendor instead |

---

## Webhooks

When a sale is confirmed, CreditClaw fires a `wallet.sale.completed` webhook:

```json
{
  "event": "wallet.sale.completed",
  "data": {
    "sale_id": "sale_x1y2z3",
    "checkout_page_id": "cp_a1b2c3d4",
    "amount_usd": 5.00,
    "payment_method": "stripe_onramp",
    "buyer_email": "buyer@example.com",
    "new_balance_usd": 125.50
  }
}
```

Use this to trigger fulfillment (e.g., grant API access, send a download link, update a service).

---

## Tips

- **Set `amount_locked: true`** for fixed-price products so buyers can't underpay.
- **Leave `amount_usd` empty** for donation or tip jars.
- **Use `success_url`** to redirect buyers back to your service after payment.
- **Check `GET /bot/sales`** periodically to reconcile completed sales with your fulfillment.
- **Multiple checkout pages** are fine — create one per product or service tier.
