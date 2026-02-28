# CreditClaw — Sales Feature: Remaining Build Plan

**Date:** February 28, 2026  
**Status:** Build plan for unbuilt items only  
**Builds on:** Branch `260226_sales_feature` / `260226_feature-sales-page`

---

## Critical Notes for the Builder

1. **Do NOT rebuild anything in the "Already Built" section.** Read the existing code first. The checkout pages, sales table, all APIs, the public `/pay/[id]` page, webhook handling, and skill file already exist and work. You are extending, not replacing.

2. **Stripe Onramp amount locking — use `lock_source_amount`.** The Stripe onramp API supports a `lock_source_amount` parameter (following the same pattern as `lock_wallet_address`). **Add `formData.append("lock_source_amount", "true")` to `createStripeOnrampSession()` in `lib/crypto-onramp/stripe-onramp/session.ts` when the checkout page has `amountLocked: true`.** Test it — if Stripe accepts it and the widget amount becomes non-editable, we're done. If for any reason it doesn't work, fall back to webhook-side validation: in `handleStripeOnrampFulfillment()`, compare the delivered `amountUsdc` against the checkout page's expected amount and only create a confirmed sale on match. Also try `lock_destination_amount` as an alternative approach. Regardless of whether the lock works, always validate the amount on the webhook side as defense-in-depth.

3. **Stripe Onramp metadata.** The Stripe Crypto Onramp API supports `metadata` as key-value pairs on session creation. The current `createStripeOnrampSession()` in `lib/crypto-onramp/stripe-onramp/session.ts` does NOT send metadata to Stripe. You need to add `formData.append("metadata[checkout_page_id]", ...)` (and later `metadata[invoice_ref]`) to the session creation call. Verify this works end-to-end before building invoice payment linking. If Stripe doesn't return metadata in the webhook event, implement a `pending_checkout_payments` lookup table keyed by session ID as a fallback.

4. **Use `destination_amount` instead of `source_amount`** for locked-amount checkout pages. This ensures the seller receives the exact USDC amount regardless of fee fluctuations. The buyer pays the amount + Stripe's fees on top. Update `createStripeOnrampSession()` to use `destination_amount` (in USDC) when the checkout page has a locked amount, instead of `source_amount` (in USD).

5. **Micro-USDC conversion.** Use the existing helpers in `lib/rail1/x402.ts` (`formatUsdc`, `usdToMicroUsdc`, `microUsdcToUsd`) for all conversions. The `checkout_pages.amountUsdc` and `invoices.totalUsdc` store micro-USDC (6 decimals, 1000000 = $1.00). The API accepts `amount_usd` as a float. Every handler must convert consistently.

---

## What's Already Built

These exist in the current branch and do NOT need to be rebuilt:

- ✅ `checkout_pages` + `sales` tables in `shared/schema.ts`
- ✅ `server/storage/sales.ts` — full CRUD for both tables
- ✅ Owner API: `POST/GET /api/v1/checkout-pages`, `GET/PATCH/DELETE /api/v1/checkout-pages/[id]`, `GET /api/v1/sales`, `GET /api/v1/sales/[sale_id]`
- ✅ Bot API: `POST /api/v1/bot/checkout-pages/create`, `GET /api/v1/bot/checkout-pages`, `GET /api/v1/bot/sales`
- ✅ Public API: `GET /api/v1/checkout/[id]/public`, `POST /api/v1/checkout/[id]/pay/stripe-onramp`
- ✅ Create Checkout dashboard page (`/app/checkout/create`)
- ✅ My Sales dashboard page (`/app/sales`) with filters (status, method)
- ✅ Public checkout page (`/pay/[id]`) with Stripe onramp widget
- ✅ Success page (`/pay/[id]/success`)
- ✅ `wallet.sale.completed` webhook event
- ✅ `public/checkout.md` skill file
- ✅ Sidebar "Sales" section with "Create Checkout" and "My Sales"

---

## What Needs to Be Built

### 1. Seller Profile

Before the checkout page redesign, we need seller identity data.

**Three-tier fallback for seller info on the checkout page:**

1. **Custom seller profile** (highest priority) — if the owner has configured a seller profile, use it
2. **Bot name + owner profile** (default) — bot name from the linked wallet's bot, plus owner name/email from Firebase
3. **Owner profile only** — if no bot is linked to the wallet

**Schema — `seller_profiles` table:**

```typescript
export const sellerProfiles = pgTable("seller_profiles", {
  id: serial("id").primaryKey(),
  ownerUid: text("owner_uid").notNull().unique(),
  businessName: text("business_name"),          // "Acme Data Services"
  logoUrl: text("logo_url"),                    // Uploaded or URL
  contactEmail: text("contact_email"),          // Public-facing email
  websiteUrl: text("website_url"),
  description: text("description"),             // Short business description
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

**Schema — add to `checkout_pages` table:**

```typescript
// Optional overrides (populated from seller profile at creation, editable per page)
sellerName: text("seller_name"),
sellerLogoUrl: text("seller_logo_url"),
sellerEmail: text("seller_email"),
```

**Dashboard — Seller Settings:**

Either a section within `/app/settings` or a standalone page at `/app/settings/seller`. Fields: Business Name, Logo (upload), Contact Email, Website, Description. The "Create Checkout" form auto-fills seller fields from this profile but allows per-page override.

**Public API — `GET /api/v1/checkout/[id]/public` response update:**

Currently returns title, description, amount, methods. Add:

```json
{
  "seller_name": "Acme Data Services",
  "seller_logo_url": "https://...",
  "seller_email": "sales@acme.com"
}
```

Resolution logic in the API handler:
1. If `checkout_pages.seller_name` is set → use it
2. Else if owner has a `seller_profiles` row → use `businessName`
3. Else → use bot name (from wallet's linked bot) + owner email

---

### 2. Checkout Page Redesign — Split-Panel Layout

**Current state:** The `/pay/[id]` page is a single centered card on a neutral background. Title, description, amount, and Stripe widget are stacked vertically.

**Target:** A split-panel layout matching the `StripeOnrampSheet` pattern — dark semi-transparent info panel on the left, payment widget on the right. Same visual language as the "Fund from Stripe" drawer.

**Layout — Checkout Link (standard product/service):**

```
┌──────────────────────────────┬──────────────────────────────┐
│                              │                              │
│  DARK PANEL (left)           │  WHITE PANEL (right)         │
│  bg-neutral-900 text-white   │  bg-white                    │
│                              │                              │
│  ┌────────┐                  │  Pay with                    │
│  │ SELLER │  (logo/avatar)   │  ┌──────┐ ┌──────┐ ┌──────┐│
│  │  LOGO  │                  │  │ Card │ │ USDC │ │ x402 ││
│  └────────┘                  │  └──────┘ └──────┘ └──────┘│
│                              │                              │
│  Company / Bot Name          │  [ Stripe onramp widget     │
│  seller@example.com          │    or USDC / x402 content   │
│                              │    renders here ]            │
│  ─────────────────────────   │                              │
│                              │                              │
│  Product Name                │                              │
│  Short description of the    │                              │
│  product or service being    │                              │
│  sold.                       │                              │
│                              │                              │
│  ─────────────────────────   │                              │
│                              │                              │
│  Amount                      │                              │
│  ┌─────────────────────┐     │                              │
│  │  $5.00          🔒  │     │                              │
│  └─────────────────────┘     │                              │
│                              │                              │
│  ─────────────────────────   │                              │
│  Powered by CreditClaw       │                              │
│                              │                              │
└──────────────────────────────┴──────────────────────────────┘
```

**Layout — Invoice Payment (specific buyer):**

Same split-panel, but the left panel adds buyer-specific info:

```
┌──────────────────────────────┬──────────────────────────────┐
│                              │                              │
│  DARK PANEL (left)           │  WHITE PANEL (right)         │
│                              │                              │
│  ┌────────┐                  │  [ Stripe onramp widget ]    │
│  │ SELLER │                  │                              │
│  │  LOGO  │                  │                              │
│  └────────┘                  │                              │
│                              │                              │
│  DataAnalyzer Bot            │                              │
│  owner@example.com           │                              │
│                              │                              │
│  ─────────────────────────   │                              │
│                              │                              │
│  INVOICE                     │                              │
│  INV-2026-0042               │                              │
│                              │                              │
│  BILL TO                     │                              │
│  Acme Corp                   │                              │
│  buyer@acme.com              │                              │
│                              │                              │
│  ─────────────────────────   │                              │
│                              │                              │
│  API Access - 1 Month  $5.00 │                              │
│  Premium Support       $2.00 │                              │
│  ─────────────────────────   │                              │
│  Total                 $7.00 │                              │
│                              │                              │
│  Due: March 30, 2026         │                              │
│                              │                              │
│  ─────────────────────────   │                              │
│  Powered by CreditClaw       │                              │
│                              │                              │
└──────────────────────────────┴──────────────────────────────┘
```

**Mobile:** Collapses to single column — info panel on top (condensed), payment widget below. Same pattern as the `StripeOnrampSheet` which shows a mobile header (`md:hidden`) with wallet info when the overlay isn't visible.

**Implementation:**
- Refactor `/pay/[id]/page.tsx` from centered card to split-panel (`grid grid-cols-1 md:grid-cols-2`)
- Left panel: dark background (`bg-neutral-900 text-white`), seller info, product info, amount display
- Right panel: white background, payment method tabs (Phase 1: Stripe only), widget mount area
- Detect `?ref=` query param → if present, fetch invoice data and render the invoice variant of the left panel

**Data needed for left panel (checkout link):**
- Seller name, logo, email (from three-tier fallback above)
- Product title (from `checkout_pages.title`)
- Product description (from `checkout_pages.description`)
- Amount + locked status

**Additional data for invoice variant:**
- Invoice reference number
- Bill-to name + email
- Line items with amounts
- Due date
- Total

---

### 2. Invoicing — Full Feature

#### 2.1 Schema — `invoices` table

```typescript
export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceId: text("invoice_id").notNull().unique(),     // "inv_a1b2c3d4"
  ownerUid: text("owner_uid").notNull(),
  checkoutPageId: text("checkout_page_id").notNull(),   // FK → checkout_pages
  
  referenceNumber: text("reference_number").notNull().unique(),  // "INV-2026-0042"
  status: text("status").notNull().default("draft"),    // draft | sent | viewed | paid | overdue | cancelled
  
  // Buyer
  recipientName: text("recipient_name"),
  recipientEmail: text("recipient_email"),
  recipientType: text("recipient_type"),                // "human" | "bot" | "agent"
  
  // Amounts
  lineItems: jsonb("line_items").notNull().$type<Array<{
    description: string;
    quantity: number;
    unitPriceUsd: number;
    amountUsd: number;
  }>>(),
  subtotalUsdc: bigint("subtotal_usdc", { mode: "number" }).notNull(),
  taxUsdc: bigint("tax_usdc", { mode: "number" }).notNull().default(0),
  totalUsdc: bigint("total_usdc", { mode: "number" }).notNull(),
  
  // Payment
  paymentUrl: text("payment_url").notNull(),  // /pay/cp_xxx?ref=INV-2026-0042&amount=7000000
  
  // PDF
  pdfUrl: text("pdf_url"),
  pdfGeneratedAt: timestamp("pdf_generated_at"),
  
  // Lifecycle
  dueDate: timestamp("due_date"),
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  paidAt: timestamp("paid_at"),
  saleId: text("sale_id"),                    // FK → sales (set when paid)
  
  // Sender (denormalized for PDF/email)
  senderName: text("sender_name"),
  senderEmail: text("sender_email"),
  
  notes: text("notes"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("invoices_owner_uid_idx").on(table.ownerUid),
  index("invoices_checkout_page_id_idx").on(table.checkoutPageId),
  index("invoices_reference_number_idx").on(table.referenceNumber),
  index("invoices_status_idx").on(table.status),
  index("invoices_sale_id_idx").on(table.saleId),
]);
```

#### 2.2 Add `invoiceId` to existing `sales` table

```typescript
// Add to sales table
invoiceId: text("invoice_id"),  // FK → invoices (NULL if direct checkout)
```

Plus index: `index("sales_invoice_id_idx").on(table.invoiceId)`

#### 2.3 Storage — `server/storage/invoices.ts`

- `createInvoice()`
- `getInvoiceById(invoiceId)`
- `getInvoiceByReferenceNumber(ref)`
- `getInvoicesByOwnerUid(ownerUid, filters)`
- `getInvoicesByCheckoutPageId(checkoutPageId)`
- `updateInvoice(id, updates)`
- `markInvoiceSent(id)`
- `markInvoiceViewed(id)`
- `markInvoicePaid(id, saleId)`
- `cancelInvoice(id)`
- `getNextReferenceNumber(ownerUid)` — returns `INV-{YEAR}-{NEXT_SEQUENCE}`

#### 2.4 Owner API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/invoices` | Create invoice |
| GET | `/api/v1/invoices` | List invoices (filters: status, checkout_page, date range) |
| GET | `/api/v1/invoices/[id]` | Get invoice detail |
| PATCH | `/api/v1/invoices/[id]` | Update draft invoice |
| POST | `/api/v1/invoices/[id]/send` | Generate PDF, send email, mark as sent |
| POST | `/api/v1/invoices/[id]/cancel` | Cancel unpaid invoice |

#### 2.5 Bot API

| Method | Path | Rate Limit | Purpose |
|---|---|---|---|
| POST | `/api/v1/bot/invoices/create` | 10/hr | Create invoice |
| GET | `/api/v1/bot/invoices` | 12/hr | List invoices |
| POST | `/api/v1/bot/invoices/[id]/send` | 5/hr | Send invoice |

#### 2.6 Dashboard Pages

**`/app/invoices`** — Invoice list page
- Columns: Date, Ref #, Recipient, Product, Amount, Due Date, Status
- Filters: Status (draft/sent/viewed/paid/overdue/cancelled), date range
- "Create Invoice" button

**`/app/invoices/create`** — Create invoice form
- Select checkout page (dropdown of owner's active pages)
- Recipient name + email
- Line items (repeater: description, qty, unit price)
- Tax (optional)
- Due date (default: 30 days)
- Notes
- On submit → creates invoice in `draft` status

**`/app/invoices/[invoice_id]`** — Invoice detail page
- Mirrors order detail layout (`/app/orders/[order_id]`)
- Status timeline: Created → Sent → Viewed → Paid
- From / To section
- Line items table with subtotal, tax, total
- Due date
- Payment link (copyable)
- Actions: [Download PDF] [Resend Email] [Cancel Invoice]

#### 2.7 Sidebar Update

```typescript
const salesNavItems = [
  { icon: PlusCircle, label: "Create Checkout", href: "/app/checkout/create" },
  { icon: DollarSign, label: "My Sales", href: "/app/sales" },
  { icon: FileText, label: "Invoices", href: "/app/invoices" },  // NEW
];
```

#### 2.8 Checkout Page — `?ref=` and `?amount=` Handling

When `/pay/[id]?ref=INV-2026-0042&amount=7000000` is loaded:

- `GET /api/v1/checkout/[id]/public` already returns the checkout page config
- New: also fetch invoice data via `GET /api/v1/invoices/by-ref/[ref]` (public, limited fields)
- If ref is valid and matches this checkout page:
  - Amount is overridden and locked to invoice total
  - Left panel switches to invoice variant (shows BILL TO, line items, due date)
  - Mark invoice as `viewed` if not already
- If ref is invalid → ignore params, render normal checkout page

#### 2.9 Invoice Email — Full Invoice in Body

The email body IS the invoice. No need to open the PDF or click a link to see what's owed.

```
Subject: Invoice INV-2026-0042 from DataAnalyzer Bot — $7.00 due March 30

┌─────────────────────────────────────────────────────┐
│  [CreditClaw Logo]                                  │
│                                                     │
│  Invoice INV-2026-0042                              │
│                                                     │
│  FROM                        TO                     │
│  DataAnalyzer Bot            Acme Corp              │
│  owner@example.com           buyer@acme.com         │
│                                                     │
│  Invoice Date: February 28, 2026                    │
│  Due Date: March 30, 2026                           │
│                                                     │
│  ──────────────────────────────────────────────     │
│                                                     │
│  Description            Qty    Price     Total      │
│  ──────────────────────────────────────────────     │
│  API Access - 1 Month    1    $5.00     $5.00      │
│  Premium Support         1    $2.00     $2.00      │
│  ──────────────────────────────────────────────     │
│                      Subtotal            $7.00      │
│                      Tax                 $0.00      │
│                      Total               $7.00      │
│                                                     │
│  Notes: "Thank you for your business"               │
│                                                     │
│  ──────────────────────────────────────────────     │
│                                                     │
│            ┌─────────────────────────┐              │
│            │      💳 Pay $7.00       │              │
│            └─────────────────────────┘              │
│   Pay with credit card, USDC, or CreditClaw wallet  │
│                                                     │
│  Ref: INV-2026-0042                                 │
│  Link: creditclaw.com/pay/cp_xxx?ref=INV-2026-0042 │
│                                                     │
│  ──────────────────────────────────────────────     │
│  Powered by CreditClaw                              │
└─────────────────────────────────────────────────────┘

Attachment: INV-2026-0042.pdf
```

- HTML email template rendered server-side
- Uses existing notification infrastructure (`lib/notifications.ts`)
- PDF attached for recipient's records (mirrors the email content)

#### 2.10 Invoice PDF Generation

- Generated server-side when invoice is sent
- Uses `lib/` PDF generation (not the skill — server code)
- Content mirrors the email body: logo, from/to, ref #, dates, line items, totals, pay link, notes
- Stored at a URL, referenced in `invoices.pdfUrl`

#### 2.11 Webhook Routing for Invoice Payments

When the Stripe onramp webhook fires for a checkout-page-originated session:

1. The `pay/stripe-onramp` route already passes `checkout_page_id` in the session metadata
2. After creating the `sales` record, check: does this sale have a `ref` param that matches an invoice?
3. If yes → update invoice status to `paid`, set `saleId`, set `paidAt`
4. The `wallet.sale.completed` webhook payload includes `invoice_id` if applicable

#### 2.12 Skill File Update — `checkout.md`

Add invoicing section to the existing `public/checkout.md`:

```markdown
## Invoicing — Bill a Specific Buyer

### Create an Invoice

POST /api/v1/bot/invoices/create
  { checkout_page_id, recipient_name, recipient_email,
    line_items: [...], due_date, notes }

### Send an Invoice

POST /api/v1/bot/invoices/{id}/send
  → Generates PDF, sends email with full invoice + pay link

### List Invoices

GET /api/v1/bot/invoices
  ?status=draft|sent|paid|overdue
```

---

### 3. Sale Detail Page — `/app/sales/[sale_id]`

**Current state:** The My Sales list page exists, but clicking a sale row doesn't go to a detail page yet.

**Build:**
- New page at `/app/sales/[sale_id]/page.tsx`
- Layout mirrors `/app/orders/[order_id]/page.tsx`
- Shows: amount, timestamp, status badge, checkout page (linked), invoice (linked if applicable), payment method, Stripe session or tx hash, buyer info (email, wallet address, IP, user-agent), wallet that received the funds

---

### 4. Risk: Stripe Onramp Metadata for Invoice Linking

**The issue:** When an invoice payment completes via Stripe onramp, we need to know which invoice it was for. The `pay/stripe-onramp` route currently passes `checkout_page_id` in metadata, and the webhook handler reads it back. This already works for checkout pages.

For invoices, we'd add `invoice_ref` to the same metadata. But there's a question: **does the Stripe Crypto Onramp API preserve custom metadata on sessions and return it in webhooks?**

Looking at the existing code: `parseStripeOnrampEvent()` reads `session.metadata` from the Stripe event object and merges it into our event metadata. The `pay/stripe-onramp` route passes metadata to `createStripeOnrampSession()`, but `createStripeOnrampSession()` does NOT currently forward custom metadata to Stripe — it only sends wallet address, currency, and amount.

**The checkout_page_id linkage currently works because** `parseStripeOnrampEvent` reads from the Stripe session's own metadata field. If Stripe onramp sessions support setting custom metadata (like regular Checkout Sessions do), we need to add a `formData.append("metadata[checkout_page_id]", ...)` call in `createStripeOnrampSession()`. If they don't, the current linkage might be relying on Stripe internally preserving something, or it might not actually work in production.

**Fallback approach (safe):** Create a `pending_checkout_payments` lookup table keyed by Stripe session ID. When we create the onramp session, store `{ sessionId, checkoutPageId, invoiceRef }`. When the webhook fires, look up the session ID and get the context back. This is bulletproof regardless of whether Stripe preserves metadata.

**Action:** Before building invoice linking, verify the existing checkout→sale linkage actually works end-to-end in production. If it does, extend the same pattern for invoices. If it doesn't, implement the lookup table for both.

---

## Build Order

| Step | What | Depends On |
|---|---|---|
| 1 | Seller profile table + settings UI | Nothing |
| 2 | Add seller fields to `checkout_pages` + update create form | Step 1 |
| 3 | Checkout page split-panel redesign | Step 2 |
| 4 | Sale detail page (`/app/sales/[sale_id]`) | Nothing — uses existing data |
| 5 | `invoices` table + storage + `invoiceId` on sales | Schema migration |
| 6 | Invoice owner API (create, list, get, update, send, cancel) | Step 5 |
| 7 | Invoice bot API | Step 6 |
| 8 | Invoice dashboard pages (list, create, detail) | Step 6 |
| 9 | Sidebar update (add Invoices) | Step 8 |
| 10 | `?ref=` + `?amount=` handling on checkout page | Steps 3 + 5 |
| 11 | Invoice email (full body + PDF attachment) | Steps 6 + 10 |
| 12 | Verify Stripe metadata pass-through or build lookup table | Before step 10 |
| 13 | Webhook routing (link sale → invoice on payment) | Steps 5 + 10 + 12 |
| 14 | Skill file update (`checkout.md` invoicing section) | Step 7 |
