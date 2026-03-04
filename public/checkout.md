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
| `allowed_methods` | No | Array of: `"x402"`, `"usdc_direct"`, `"stripe_onramp"`, `"base_pay"`. Default: all four. |
| `success_url` | No | URL to redirect buyer after payment. |
| `expires_at` | No | ISO timestamp. Checkout page expires after this. |
| `page_type` | No | `"product"`, `"event"`, or `"digital_product"`. Default: `"product"`. |
| `digital_product_url` | No | URL delivered to buyer after payment. Required when `page_type` is `"digital_product"`. |
| `image_url` | No | URL of an image to display on the checkout page. |
| `collect_buyer_name` | No | Whether to ask for buyer's name. Default: `false`. |

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

## Send Invoices

Send formatted invoices to customers and receive payments via checkout pages.

### Create an Invoice

POST https://creditclaw.com/api/v1/bot/invoices/create
  -H "Authorization: Bearer $CREDITCLAW_API_KEY"
  -H "Content-Type: application/json"
  -d '{
    "checkout_page_id": "cp_a1b2c3d4",
    "recipient_name": "Acme Corp",
    "recipient_email": "buyer@acme.com",
    "line_items": [
      {
        "description": "Premium API Access - 1 Month",
        "quantity": 1,
        "unit_price_usd": 5.00
      }
    ],
    "tax_usd": 0.50,
    "due_date": "2026-03-27",
    "notes": "Payment due within 30 days"
  }'

### Request Fields

| Field | Required | Description |
|-------|----------|-------------|
| `checkout_page_id` | Yes | ID of the checkout page to link this invoice to |
| `recipient_name` | Yes | Customer name (max 255 chars) |
| `recipient_email` | Yes | Email to send invoice to |
| `line_items` | Yes | Array of line items with `description`, `quantity`, `unit_price_usd` |
| `tax_usd` | No | Tax amount (default 0) |
| `due_date` | No | ISO date string. Default: 30 days from now |
| `notes` | No | Additional payment terms or notes |

### Response (HTTP 201)

```json
{
  "invoice_id": "inv_x1y2z3",
  "reference_number": "INV-001",
  "checkout_page_id": "cp_a1b2c3d4",
  "recipient_name": "Acme Corp",
  "recipient_email": "buyer@acme.com",
  "total_usd": 5.50,
  "status": "draft",
  "payment_url": "/pay/cp_a1b2c3d4?ref=INV-001",
  "created_at": "2026-02-27T15:30:00Z"
}
```

**Rate limit:** 10 requests per hour.

---

### List Your Invoices

GET https://creditclaw.com/api/v1/bot/invoices
  -H "Authorization: Bearer $CREDITCLAW_API_KEY"

Optional query parameters:
- `?status=draft|sent|viewed|paid|cancelled` — Filter by status
- `?checkout_page_id=cp_xxx` — Filter by checkout page
- `?limit=N` — Number of results (default 20, max 100)

Returns all your invoices with counts.

**Rate limit:** 12 requests per hour.

### Response

```json
{
  "invoices": [
    {
      "invoice_id": "inv_x1y2z3",
      "reference_number": "INV-001",
      "checkout_page_id": "cp_a1b2c3d4",
      "recipient_name": "Acme Corp",
      "recipient_email": "buyer@acme.com",
      "total_usd": 5.50,
      "status": "sent",
      "due_date": "2026-03-27",
      "created_at": "2026-02-27T15:30:00Z",
      "sent_at": "2026-02-27T15:31:00Z"
    }
  ],
  "total": 1
}
```

---

### Send an Invoice

POST https://creditclaw.com/api/v1/bot/invoices/[id]/send
  -H "Authorization: Bearer $CREDITCLAW_API_KEY"
  -H "Content-Type: application/json"

Sends the invoice to the recipient via email with a formatted PDF attachment. Only draft invoices can be sent.

### Response (HTTP 200)

```json
{
  "invoice_id": "inv_x1y2z3",
  "status": "sent",
  "sent_at": "2026-02-27T15:31:00Z",
  "payment_url": "/pay/cp_a1b2c3d4?ref=INV-001"
}
```

**Rate limit:** 5 requests per hour.

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

## Digital Product Delivery via x402

When a checkout page has `page_type: "digital_product"`, the x402 settlement response includes the product URL after successful payment:

```json
{
  "status": "confirmed",
  "sale_id": "sale_abc123",
  "tx_hash": "0xdeadbeef...",
  "amount_usd": 5.00,
  "product": {
    "url": "https://your-service.com/download/signed-token",
    "type": "digital_product"
  }
}
```

The product URL is never exposed before payment. x402 payments are idempotent — retrying with the same nonce returns the original result without double-charging.

---

## Tips

- **Set `amount_locked: true`** for fixed-price products so buyers can't underpay.
- **Leave `amount_usd` empty** for donation or tip jars.
- **Use `page_type: "digital_product"`** when selling downloadable content, API keys, or access tokens.
- **Use `success_url`** to redirect buyers back to your service after payment.
- **Check `GET /bot/sales`** periodically to reconcile completed sales with your fulfillment.
- **Multiple checkout pages** are fine — create one per product or service tier.
