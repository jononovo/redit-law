---
name: creditclaw-dev-v2
description: >
  Internal context for agents building and maintaining the CreditClaw platform.
  Use this to understand the OpenClaw ecosystem, what CreditClaw does, how the
  application is architected, and the conventions to follow when writing code.
  Read this before making any changes to the CreditClaw codebase.
  Updated after Phase 5 completion (February 2026).
---

# CreditClaw — Developer Context (V2)

> **Note for agents working on this codebase:** This document reflects the
> **current implementation** as of Phase 5 completion. Section 3 describes the
> live, working architecture — not a future target. Section 10 describes the
> outstanding features still to be built (future phases).

---

## 1. The OpenClaw Ecosystem (What World We Live In)

### What Is OpenClaw?

OpenClaw is an open-source autonomous AI agent framework created by Peter Steinberger.
It runs locally on a user's machine, connects to LLMs (Claude, GPT, DeepSeek, etc.),
and performs real tasks: managing email, browsing the web, writing code, controlling
apps — all through messaging platforms like WhatsApp, Telegram, and Discord.

As of early February 2026, OpenClaw has 145,000+ GitHub stars, 20,000+ forks, and is
one of the fastest-growing open-source projects in history. It has spawned an entire
ecosystem of services built specifically for AI agents.

### The Ecosystem — Services for Bots

OpenClaw bots are autonomous. They run 24/7, make decisions, and interact with the
world. A wave of startups and projects now provide services *to* these bots:

| Service | What It Does |
|---------|-------------|
| **ClawHub** | Skills marketplace — bots install plugins to gain new capabilities |
| **Moltbook** | Social network exclusively for AI agents (Reddit for bots) |
| **SendClaw** | Email service — bots get their own email address and can send/receive |
| **ClawCredit** | Credit line service — bots access x402 services on credit |
| **CreditClaw (us)** | Virtual wallet + Visa card — bots get funded cards to spend anywhere |
| **Moltroad** | Marketplace where agents buy/sell services from each other |
| **Openwork** | Gig economy for agents — bots hire humans or other bots |
| **Bankrbot** | AI crypto banking on Base |
| **Stripe ACP** | Agentic Commerce Protocol — agents buy from merchants via Stripe |

### Why This Matters

These bots need money. They need to pay for API calls, buy services, hire humans,
and transact with each other. But they don't have bank accounts or credit cards.
That's the gap CreditClaw fills.

### Key Terms

- **Skill file** — A markdown document (SKILL.md) that teaches an agent how to use
  a service. Follows the Agent Skills open standard (Anthropic). Bots discover and
  read these to learn new capabilities.
- **ClawHub** — The public registry where skills are published and installed.
- **Heartbeat** — A periodic check-in routine bots run to poll for updates.
- **Claim token** — A one-time code a bot gives its human owner to link accounts.
- **Agent Skills standard** — Open spec adopted by Anthropic, Microsoft, OpenAI,
  GitHub, Cursor, and others. YAML frontmatter + markdown instructions.

---

## 2. What CreditClaw Is

### The Thesis

AI agents need to spend money but can't get bank accounts or credit cards.
CreditClaw bridges this gap by issuing real virtual Visa/Mastercards to bots,
funded by their human owners. The bot gets a card. The human controls the wallet.

### What We Do

1. **Issue virtual cards** — Real Visa/Mastercard numbers that work at any merchant online (future — currently wallet-debit only)
2. **Wallet management** — Human owners fund wallets, set spending limits
3. **Payment links** — Bots can generate Stripe Checkout links to charge anyone (future)
4. **Spending permissions** — A granular framework that gives owners control over per-transaction, daily, monthly limits, category blocking, and approval modes
5. **Bot-first registration** — Bots sign up before their human, get a claim token

### What We Don't Do

- We are NOT a credit line (that's ClawCredit — different product)
- We don't handle crypto or blockchain
- We don't process payments between bots directly (they use their cards)
- We don't store any credit card details (Stripe does)

### Domain

- Website: `https://creditclaw.com`
- API: `https://api.creditclaw.com/v1`
- Skill file: `https://creditclaw.com/skill.md`

---

## 3. Architecture (Current Implementation)

### Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 with App Router |
| Auth (Owner) | Firebase Auth (client SDK) + Firebase Admin SDK (server) + httpOnly session cookies |
| Auth (Bot) | Bearer API token with bcrypt hash validation + prefix lookup |
| Database | PostgreSQL (Neon-backed via Replit) + Drizzle ORM |
| Payments | Stripe (SetupIntents for card storage, PaymentIntents for wallet funding) |
| Email | SendGrid (registration notifications, top-up requests) |
| Styling | Tailwind CSS v4 with PostCSS |
| UI Components | shadcn/ui (Radix primitives) |
| Fonts | Plus Jakarta Sans + JetBrains Mono |
| Security | Per-bot rate limiting (in-memory token bucket) + access logging |

### Core Entity Relationships

```
Owner (Firebase UID)
  └── Wallet (one per owner)
       └── Bot (one per owner, linked via claim)
            ├── SpendingPermissions (owner-configured rules)
            ├── Transactions (wallet debits + top-ups)
            └── ApiAccessLogs (every bot API call)
```

Current architecture: **one bot per user, one wallet per bot**. This is enforced at
the claim and wallet-creation level. A future phase may support multiple bots per owner.

### Money Flow (Current)

```
Top-up (Owner funds wallet):
  Owner's saved card (Stripe Customer)
    → Stripe PaymentIntent (off-session, immediate confirm)
      → CreditClaw wallet.balance_cents += amount
        → Transaction record created (type: "topup")

Bot spends (Wallet debit):
  Bot calls POST /api/v1/bot/wallet/purchase
    → Auth: Bearer token validated (bcrypt)
    → Rate limit check (30/hr)
    → Spending rules enforced (limits, categories, approval modes)
    → Atomic wallet debit (SQL WHERE balance_cents >= amount)
      → Transaction record created (type: "purchase")
      → Access log recorded
```

---

## 4. Database Schema (Live)

### Table: `bots`

| Column | Type | Purpose |
|--------|------|---------|
| id | serial PK | Auto-incrementing ID |
| bot_id | text UNIQUE | Public bot identifier (e.g., `bot_67247c74`) |
| bot_name | text | Display name |
| description | text | What the bot does |
| owner_email | text | Email provided at registration |
| owner_uid | text | Firebase UID (set when owner claims) |
| api_key_hash | text | bcrypt hash of the API key |
| api_key_prefix | text | First 12 chars of API key (for lookup) |
| claim_token | text UNIQUE | One-time code for owner claiming (nullified after use) |
| wallet_status | text | `pending` / `active` / `empty` / `suspended` |
| callback_url | text | Optional callback URL |
| claimed_at | timestamp | When owner claimed |
| created_at | timestamp | Registration time |

### Table: `wallets`

| Column | Type | Purpose |
|--------|------|---------|
| id | serial PK | Auto-incrementing ID |
| bot_id | text UNIQUE | FK to bots.bot_id |
| owner_uid | text | Firebase UID of owner |
| balance_cents | integer | Current balance in cents |
| currency | text | Always "usd" |
| created_at | timestamp | |
| updated_at | timestamp | |

### Table: `transactions`

| Column | Type | Purpose |
|--------|------|---------|
| id | serial PK | Auto-incrementing ID |
| wallet_id | integer | FK to wallets.id |
| type | text | `topup` / `purchase` / `refund` |
| amount_cents | integer | Amount in cents |
| stripe_payment_intent_id | text | Stripe PI ID (for top-ups) |
| description | text | e.g., "Amazon: AWS Credits" |
| created_at | timestamp | |

### Table: `payment_methods`

| Column | Type | Purpose |
|--------|------|---------|
| id | serial PK | Auto-incrementing ID |
| owner_uid | text UNIQUE | Firebase UID |
| stripe_customer_id | text | Stripe Customer ID |
| stripe_pm_id | text | Stripe PaymentMethod ID |
| card_last4 | text | For display |
| card_brand | text | e.g., "visa" |
| created_at | timestamp | |

### Table: `spending_permissions`

| Column | Type | Purpose |
|--------|------|---------|
| id | serial PK | Auto-incrementing ID |
| bot_id | text UNIQUE | FK to bots.bot_id |
| approval_mode | text | `ask_for_everything` / `auto_approve_under_threshold` / `auto_approve_by_category` |
| per_transaction_cents | integer | Default 2500 ($25) |
| daily_cents | integer | Default 5000 ($50) |
| monthly_cents | integer | Default 50000 ($500) |
| ask_approval_above_cents | integer | Default 1000 ($10) |
| approved_categories | text[] | Categories auto-approved |
| blocked_categories | text[] | Categories always blocked |
| recurring_allowed | boolean | Default false |
| notes | text | Freeform owner instructions |
| updated_at | timestamp | |

### Table: `topup_requests`

| Column | Type | Purpose |
|--------|------|---------|
| id | serial PK | Auto-incrementing ID |
| bot_id | text | FK to bots.bot_id |
| amount_cents | integer | Requested amount |
| reason | text | Bot's reason for requesting |
| status | text | `sent` / `approved` / `denied` |
| created_at | timestamp | |

### Table: `api_access_logs`

| Column | Type | Purpose |
|--------|------|---------|
| id | serial PK | Auto-incrementing ID |
| bot_id | text | Bot that made the request (or "unknown") |
| endpoint | text | API route path |
| method | text | HTTP method |
| status_code | integer | Response status |
| ip | text | Client IP |
| user_agent | text | Client user-agent |
| response_time_ms | integer | Processing time |
| error_code | text | Error type if failed |
| created_at | timestamp | |

Indexes: `idx_access_logs_bot_id`, `idx_access_logs_created_at`

---

## 5. API Endpoints (Live)

### Owner-Facing Endpoints (Session Cookie Auth)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/session` | Create session from Firebase ID token |
| GET | `/api/auth/session` | Get current session user |
| DELETE | `/api/auth/session` | Destroy session (logout) |
| GET | `/api/v1/bots/mine` | List all bots owned by current user |
| POST | `/api/v1/bots/claim` | Claim a bot with a claim token |
| GET | `/api/v1/bots/spending?bot_id=` | Get spending permissions for a bot |
| PUT | `/api/v1/bots/spending` | Update spending permissions for a bot |
| POST | `/api/v1/bots/register` | Register a new bot (public, IP rate-limited) |
| GET | `/api/v1/wallet/balance` | Get owner's wallet balance |
| POST | `/api/v1/wallet/fund` | Fund wallet using saved payment method |
| GET | `/api/v1/wallet/transactions` | Get owner's transaction history |
| POST | `/api/v1/billing/setup-intent` | Create Stripe SetupIntent for card storage |
| GET | `/api/v1/billing/payment-method` | Get saved payment method details |
| POST | `/api/v1/billing/payment-method` | Save payment method after setup |
| DELETE | `/api/v1/billing/payment-method` | Remove saved payment method |
| GET | `/api/v1/activity-log` | Get bot API access logs for dashboard |

### Bot-Facing Endpoints (Bearer Token Auth + Rate Limiting + Access Logging)

All 5 endpoints use the `withBotApi` middleware wrapper.

| Method | Endpoint | Rate Limit | Purpose |
|--------|----------|-----------|---------|
| GET | `/api/v1/bot/wallet/check` | 6/hr | Wallet status, balance, spending limits |
| GET | `/api/v1/bot/wallet/spending` | 6/hr | Full spending permissions and rules |
| POST | `/api/v1/bot/wallet/purchase` | 30/hr | Make a purchase (wallet debit) |
| POST | `/api/v1/bot/wallet/topup-request` | 3/hr | Request more funds from owner |
| GET | `/api/v1/bot/wallet/transactions` | 12/hr | Transaction history |

---

## 6. Authentication Systems

### Owner Authentication (Firebase + Session Cookies)

1. Owner enters email on landing page or dashboard
2. Firebase sends magic link email (passwordless)
3. Owner clicks link → Firebase client SDK validates → gets ID token
4. Client POSTs ID token to `/api/auth/session`
5. Server verifies ID token with Firebase Admin SDK
6. Server creates httpOnly session cookie (5-day expiry)
7. All subsequent owner API calls use the session cookie
8. `getCurrentUser()` in `lib/auth/session.ts` reads the cookie, verifies with Firebase Admin

### Bot Authentication (API Key + bcrypt)

1. Bot registers via `POST /api/v1/bots/register` (no auth required, IP rate-limited)
2. Server generates API key: `cck_live_` + 48 random hex chars
3. Server stores bcrypt hash of the full key + first 12 chars as prefix
4. API key is returned to the bot **once** — never retrievable again
5. On subsequent requests, bot sends `Authorization: Bearer cck_live_...`
6. `authenticateBot()` in `lib/bot-auth.ts`:
   - Extracts key from Authorization header
   - Validates it starts with `cck_live_`
   - Looks up candidates by prefix (first 12 chars) via `getBotsByApiKeyPrefix()`
   - For each candidate, runs `bcrypt.compare(key, storedHash)`
   - Returns the matched Bot record or null

---

## 7. Key Files

### Core Library Files

| File | Purpose |
|------|---------|
| `lib/bot-auth.ts` | Bot authentication via Bearer token + bcrypt |
| `lib/bot-api.ts` | `withBotApi` middleware — wraps auth + rate limiting + access logging |
| `lib/rate-limit.ts` | In-memory token bucket rate limiter (per bot, per endpoint) |
| `lib/crypto.ts` | API key generation, bcrypt hashing, prefix extraction |
| `lib/stripe.ts` | Stripe integration: customer management, SetupIntents, PaymentIntents |
| `lib/email.ts` | SendGrid email sending (registration + top-up request notifications) |
| `lib/auth/session.ts` | Session cookie management (create, read, destroy) |
| `lib/auth/auth-context.tsx` | React context for Firebase Auth state |
| `lib/firebase/admin.ts` | Firebase Admin SDK initialization |
| `lib/firebase/client.ts` | Firebase client SDK initialization |

### Schema and Storage

| File | Purpose |
|------|---------|
| `shared/schema.ts` | Drizzle ORM table definitions + Zod validation schemas |
| `server/storage.ts` | `IStorage` interface + PostgreSQL implementation |
| `server/db.ts` | Database connection (Neon serverless driver) |

### Public Skill Files (DO NOT MODIFY without approval)

| File | Served At | Purpose |
|------|-----------|---------|
| `public/skill.md` | `creditclaw.com/skill.md` | Agent Skill file — teaches bots the API |
| `public/heartbeat.md` | `creditclaw.com/heartbeat.md` | Polling routine for balance checks |
| `public/spending.md` | `creditclaw.com/spending.md` | Default spending permissions template |

### Dashboard Components

| File | Purpose |
|------|---------|
| `components/dashboard/sidebar.tsx` | Navigation sidebar (Overview, Cards, Transactions, Settings) |
| `components/dashboard/header.tsx` | Top header with search, notifications, user avatar |
| `components/dashboard/bot-card.tsx` | Bot summary card with expandable spending editor |
| `components/dashboard/spending-editor.tsx` | Full spending rules editor (limits, categories, approval modes) |
| `components/dashboard/fund-modal.tsx` | Modal for adding funds (preset amounts + custom) |
| `components/dashboard/payment-setup.tsx` | Stripe Elements card setup + saved card management |
| `components/dashboard/card-visual.tsx` | Visual credit card component |
| `components/dashboard/activity-log.tsx` | Bot API activity feed on dashboard |

### Landing Page Components

| File | Purpose |
|------|---------|
| `components/hero.tsx` | Landing page hero section |
| `components/features.tsx` | Feature showcase section |
| `components/nav.tsx` | Top navigation bar |
| `components/waitlist-form.tsx` | Email waitlist signup |
| `components/bot-signup.tsx` | Bot registration form |
| `components/live-metrics.tsx` | Live stats display |
| `components/announcement-bar.tsx` | Top announcement banner |
| `components/auth-drawer.tsx` | Slide-up auth drawer for sign-in |

### Page Routes

| File | Route | Purpose |
|------|-------|---------|
| `app/page.tsx` | `/` | Consumer landing page |
| `app/claim/page.tsx` | `/claim` | Bot claim page (Suspense-wrapped for useSearchParams) |
| `app/app/page.tsx` | `/app` | Dashboard overview (stats, bots, activity log) |
| `app/app/cards/page.tsx` | `/app/cards` | Card management |
| `app/app/transactions/page.tsx` | `/app/transactions` | Transaction history |
| `app/app/settings/page.tsx` | `/app/settings` | Account settings + payment method |
| `app/app/layout.tsx` | `/app/*` | Dashboard layout (sidebar + header + auth guard) |

---

## 8. Phase-by-Phase Build History

### Phase 1: Foundation

**What was built:**
- Next.js 16 project with App Router, Tailwind CSS v4, shadcn/ui
- Consumer landing page with hero, features, waitlist, live metrics, navigation
- Dashboard layout with sidebar, header, and protected routes
- Firebase Auth integration (magic link, session cookies, auth context)
- PostgreSQL database with Drizzle ORM (bots, wallets, transactions tables)
- Bot registration endpoint with API key generation (bcrypt hashed)
- Bot claim flow (one-time claim token → links bot to owner)
- Wallet creation on bot claim

**Key decisions:**
- Passwordless auth only (magic links via Firebase)
- API keys use `cck_live_` prefix, 48 hex chars, bcrypt hashed, prefix stored for lookup
- One bot per user, one wallet per bot
- All money in cents internally, dollars in API responses

### Phase 2: Stripe Integration & Wallet Funding

**What was built:**
- Stripe customer management (`getOrCreateCustomer` — find-or-create by email)
- SetupIntent flow for saving payment cards (Stripe Elements in React)
- PaymentIntent flow for funding wallets (off-session, immediate confirm)
- Payment method CRUD (save, retrieve, delete via Stripe API)
- Fund modal with preset amounts ($10, $25, $50, $100) and custom input
- Transaction recording for top-ups
- Payment setup component on settings page
- Wallet balance API endpoint

**Key decisions:**
- Stripe handles all card storage — no PCI data touches our server
- PaymentIntents are confirmed immediately off-session (no redirect flows)
- Single payment method per user (upsert pattern)

### Phase 3: Spending Controls & Dashboard Polish

**What was built:**
- `spending_permissions` table with full rule set (approval modes, limits, categories, etc.)
- Spending editor component with live save (owner configures rules per bot)
- Owner-facing spending API (GET + PUT per bot)
- Bot card component with expandable spending editor
- Dashboard overview page with stats cards (total bots, balance, pending claims)
- Cards page (visual card component, issue new card dialog)
- Transactions page wired to real wallet transaction data
- Settings page with payment method management and notification preferences

**Key decisions:**
- Three approval modes: `ask_for_everything`, `auto_approve_under_threshold`, `auto_approve_by_category`
- Default limits: $25/transaction, $50/day, $500/month, ask above $10
- Default blocked categories: gambling, adult_content, cryptocurrency, cash_advances
- Spending rules saved instantly (no "submit" button — saves on change)

### Phase 4: Bot-Facing Spending API

**What was built:**
- 5 bot-facing API endpoints:
  1. `GET /api/v1/bot/wallet/check` — wallet status, balance, card status, spending summary
  2. `GET /api/v1/bot/wallet/spending` — full spending permissions and rules
  3. `POST /api/v1/bot/wallet/purchase` — make a purchase (wallet debit) with full enforcement
  4. `POST /api/v1/bot/wallet/topup-request` — request funds from owner
  5. `GET /api/v1/bot/wallet/transactions` — transaction history
- Bot authentication via Bearer token (`authenticateBot()`)
- Purchase endpoint with comprehensive validation:
  - Wallet status check
  - Balance sufficiency (402 if insufficient)
  - Per-transaction limit enforcement
  - Daily spend aggregation + limit check
  - Monthly spend aggregation + limit check
  - Category blocking
  - Approval mode enforcement (threshold + category-based)
  - Atomic wallet debit (SQL `WHERE balance_cents >= amount`)
- Top-up request with SendGrid email notification to owner
- Zod validation schemas for purchase and top-up request bodies
- `topup_requests` table for tracking bot fund requests

**Key decisions:**
- Wallet debits are atomic — the SQL WHERE clause prevents race conditions
- Purchase intent pre-flight provides sufficient access control (scoped API keys deemed premature)
- Specific HTTP status codes: 402 for insufficient funds, 403 for spending rule violations, 429 for rate limits
- Top-up request emails sent asynchronously (don't block the response)

### Phase 5: Security Hardening

**What was built:**
- **Per-bot rate limiting** (`lib/rate-limit.ts`):
  - In-memory token bucket algorithm
  - Per-bot, per-endpoint scoping (e.g., bot_abc + /purchase has its own bucket)
  - Endpoint-specific limits: check/spending 6/hr, purchase 30/hr, topup-request 3/hr, transactions 12/hr
  - Automatic bucket cleanup every 5 minutes (prevents memory leaks)
  - Returns `retry_after_seconds` in 429 responses

- **Access logging** (`api_access_logs` table):
  - Captures every bot API call: bot_id, endpoint, method, status_code, IP, user_agent, response_time_ms, error_code
  - Indexes on bot_id and created_at for fast queries
  - Fire-and-forget writes (logging failures never block responses)
  - Even failed auth attempts are logged (bot_id = "unknown")

- **Unified middleware** (`lib/bot-api.ts`):
  - `withBotApi(endpoint, handler)` — single wrapper for all 5 bot endpoints
  - Execution order: extract IP/UA → authenticate → rate limit → handler → log
  - Measures response time via `Date.now()` diff
  - Extracts error codes from failed response bodies
  - `finally` block ensures logging happens even on exceptions

- **Activity Log dashboard component** (`components/dashboard/activity-log.tsx`):
  - Fetches from `/api/v1/activity-log` (owner session auth)
  - Shows last 20 API calls across all owner's bots
  - Color-coded status icons (green/amber/red)
  - Human-readable endpoint labels ("Wallet Check" not "/api/v1/bot/wallet/check")
  - Relative timestamps ("2m ago", "1h ago")
  - Response time display in milliseconds
  - Empty state when no activity exists

- **Refactored all 5 bot endpoints** to use `withBotApi` — eliminated duplicated auth/error handling code

- **Suspense boundary fix** on `/claim` page for Next.js static generation compatibility

---

## 9. Security Principles

- **API keys are non-retrievable.** Once issued, we store only a bcrypt hash. Bot must save it.
- **Prefix lookup pattern.** First 12 chars stored in plaintext for efficient DB lookup, then bcrypt validates the full key against candidates.
- **Rate limiting fires after auth.** Unauthenticated requests get 401 before touching the rate limiter — prevents anonymous users from exhausting bot buckets (DoS vector).
- **Access logs capture everything.** Even failed auth attempts are logged with bot_id="unknown" — useful for detecting brute-force attacks.
- **Claim tokens are single-use.** Nullified immediately after successful claim.
- **Wallet debits are atomic.** SQL `WHERE balance_cents >= amount` prevents overdraft race conditions.
- **Owner's credit card details never touch our servers.** Stripe handles all payment collection.
- **Blocked categories enforced server-side.** Every purchase checks the spending_permissions table.
- **Session cookies are httpOnly.** Prevents XSS from stealing auth tokens.
- **All money in cents.** Prevents floating-point precision errors in financial calculations.

---

## 10. Outstanding Features (Not Yet Implemented)

The following features are described in `public/skill.md` (the target product vision)
but have not been built yet. They represent future phases of development.

1. **Virtual Card Issuance** — Stripe Issuing for real Visa/Mastercard numbers per bot. Currently purchases are direct wallet debits.
2. **GET /wallet/card** — Full card details endpoint (PAN, CVV, expiry, billing address). Requires Stripe Issuing.
3. **GET /wallet (full)** — Extended wallet endpoint with card metadata. Currently only balance is available.
4. **Payment Links** — `POST /payments/create-link` for bots to generate Stripe Checkout links to charge anyone.
5. **Stripe Webhooks** — `checkout.session.completed`, `issuing_authorization.request`, `issuing_transaction.created` handlers.
6. **Issuing Authorization Webhook** — Real-time approve/decline of card purchases based on spending permissions.
7. **Ledger System** — Full double-entry ledger with Stripe event deduplication and state machine (PAYMENT_RECEIVED → TRANSFER_INITIATED → TRANSFER_COMPLETE → BALANCE_CREDITED).
8. **Stripe Connect** — Connected accounts per owner for proper money flow isolation.
9. **Financial Accounts (Treasury)** — Stripe Financial Accounts as the underlying wallet infrastructure.
10. **Daily Reconciliation** — Cron job to compare internal ledger against Stripe balances.

---

## 11. Conventions

- All money amounts are stored in **cents** in the database, converted to dollars in API responses.
- Bot API keys follow the format `cck_live_` + 48 hex chars.
- Bot IDs follow the format `bot_` + 8 hex chars (e.g., `bot_67247c74`).
- Claim tokens follow the format `word-XXXX` (e.g., `coral-X9K2`).
- Wallet status transitions: `pending` → `active` → `empty` (can cycle) → `suspended` (terminal until manual review).
- The spending permissions default to `ask_for_everything` for new bots. Owners relax over time.
- All interactive React components use `"use client"` directive.
- shadcn/ui components live in `components/ui/`.
- Custom dashboard components live in `components/dashboard/`.
- API routes follow the Next.js App Router convention: `app/api/.../route.ts`.
- Storage interface (`IStorage`) is the single source of truth for all DB operations.
- No direct SQL in route handlers — always go through `storage.*` methods.
- Drizzle schema in `shared/schema.ts` is the single source of truth for DB types.

---

## 12. Environment Variables

### Secrets (stored in Replit secrets manager)

| Key | Purpose |
|-----|---------|
| `STRIPE_SECRET_KEY` | Stripe API secret key |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (also in NEXT_PUBLIC_) |
| `SENDGRID_API_KEY` | SendGrid API key for transactional emails |
| `SENDGRID_FROM_EMAIL` | Sender email address |
| `DATABASE_URL` | PostgreSQL connection string (auto-provided by Replit) |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase client API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID (client) |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID |

---

## 13. Design System Notes

- **Theme:** "Fun Consumer" — 3D clay/claymation aesthetic, coral lobster mascot
- **Colors:** Bright pastels (orange/blue/purple)
- **Font:** Plus Jakarta Sans (body), JetBrains Mono (code/monospace)
- **Border radius:** 1rem (rounded corners everywhere)
- **No framer-motion** — lightweight build, CSS transitions only
- **Framework:** Next.js 16 App Router only — no Vite, no standalone React
