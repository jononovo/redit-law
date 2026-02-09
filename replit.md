# CreditClaw.com

## Overview
CreditClaw is a prepaid spending controls platform for AI agents within the OpenClaw ecosystem. Owners add their own credit card, fund a bot wallet, and set strict spending limits (per-transaction, daily, monthly, category blocking, approval modes). The platform is open for immediate sign-up with a parallel waitlist for future virtual card issuance. It features a consumer landing page with waitlist + instant onboarding, and a dashboard for managing wallets, transactions, and spending controls. The project aims to provide a secure and controlled financial environment for AI agents.

## User Preferences
- **Design theme:** "Fun Consumer" — 3D clay/claymation aesthetic, coral lobster mascot, bright pastels (orange/blue/purple)
- **Font:** Plus Jakarta Sans
- **Border radius:** 1rem rounded corners
- **Framework:** Next.js 16 with App Router only
- **No framer-motion** (lightweight build)
- **No Vite, no standalone React** — everything runs through Next.js
- All interactive components marked with `"use client"` directive

## System Architecture

### Stack
- **Framework:** Next.js 16 with App Router
- **Auth:** Firebase Auth (client SDK) + Firebase Admin SDK (server) + httpOnly session cookies
- **Database:** PostgreSQL + Drizzle ORM
- **Payments:** Stripe (for payment setup and wallet funding)
- **Email:** SendGrid (for notifications)
- **Styling:** Tailwind CSS v4 with PostCSS
- **UI Components:** shadcn/ui (Radix primitives)
- **Fonts:** Plus Jakarta Sans + JetBrains Mono
- **State Management:** React Query

### Core Features and Design
- **Dual Interface:** Consumer landing page and a protected dashboard application.
- **Bot Registration & Claim Flow:** Bots register first, receiving API keys and claim tokens. Owners then claim bots, linking them to their Firebase UID and activating wallets.
- **Wallet Funding:** Integrated Stripe for payment method setup and wallet funding via Payment Intents.
- **Spending Controls:** Owners can set per-transaction, daily, and monthly spending limits, category blocking, and approval modes via a dashboard editor. These rules are enforced server-side for every purchase.
- **Bot-Facing API:** Provides endpoints for bots to check wallet status, spending permissions, make purchases (wallet debits), request top-ups, and view transaction history.
- **Authentication:** Firebase for owner authentication (session cookies), and Bearer API token for bot authentication (bcrypt validation, prefix lookup).
- **Prepaid Model:** Emphasizes a prepaid system where humans fund bot wallets, rather than credit lines.
- **Atomic Transactions:** Wallet debits are atomic, ensuring data integrity.
- **No Virtual Card Issuance (yet):** Current purchases are direct wallet debits; Stripe Issuing for virtual cards is a future feature.
- **Security Hardening (Phase 5):**
  - Per-bot rate limiting with endpoint-specific limits (6/hr check/spending, 30/hr purchase, 3/hr topup-request, 12/hr transactions) using in-memory token bucket with auto-cleanup.
  - Access logging via `api_access_logs` table capturing bot_id, endpoint, method, status_code, IP, user_agent, response_time_ms, and error_code.
  - Reusable `withBotApi` middleware (`lib/bot-api.ts`) wrapping auth + rate limiting + access logging for all 5 bot endpoints.
  - Activity Log component on dashboard overview showing recent bot API calls.
- **Multiple Payment Methods (Phase 6A):**
  - Owners can save multiple cards per account (removed unique constraint on `owner_uid` in `payment_methods` table).
  - `is_default` flag on each payment method; first card added is auto-default.
  - Dashboard payment setup shows a list of all saved cards with add/remove/set-default controls.
  - Fund modal includes a card picker dropdown when multiple cards are on file.
  - Fund endpoint accepts optional `payment_method_id` to charge a specific card (falls back to default).
  - Setup Intent now includes `usage: 'off_session'` for better authorization rates and SCA compliance.
  - API routes: `GET /api/v1/billing/payment-method` returns list, `DELETE/PUT /api/v1/billing/payment-method/[id]` for per-card operations.
- **Webhooks & Bot Notifications (Phase 6B):**
  - `webhook_deliveries` table stores all outbound webhook events with status, attempts, retry scheduling.
  - `webhook_secret` column on bots table (auto-generated at registration, returned to bot for HMAC verification).
  - Fire-and-forget webhook delivery with HMAC-SHA256 signatures (`X-CreditClaw-Signature` header).
  - Events: `wallet.activated`, `wallet.topup.completed`, `wallet.spend.authorized`, `wallet.spend.declined`, `wallet.balance.low`.
  - Exponential backoff retries (1m, 5m, 15m, 1h, 6h) with max 5 attempts per delivery.
  - Piggyback retry on bot API calls (throttled to once per 60s per bot via `withBotApi` middleware).
  - Owner-facing API: `GET /api/v1/webhooks` lists deliveries, `POST /api/v1/webhooks/retry-pending` retries scoped to owner's bots.
  - WebhookLog dashboard component showing delivery status, expandable details, and manual retry button.
  - Key files: `lib/webhooks.ts`, `components/dashboard/webhook-log.tsx`.
- **Owner Notifications & Alerts (Phase 6C):**
  - `notification_preferences` table stores per-owner settings: transaction_alerts, budget_warnings, weekly_summary, thresholds, email/in-app toggles.
  - `notifications` table stores in-app notifications with type, title, body, bot_id, is_read flag.
  - Notification library (`lib/notifications.ts`) with preference-based routing: `notifyPurchase`, `notifyBalanceLow`, `notifySuspicious`, `notifyTopupCompleted`, `notifyWalletActivated`.
  - Three email templates: purchase alerts (above threshold), balance low warnings, suspicious activity (always sent).
  - Notifications wired into purchase (success + all decline reasons), fund (topup completed), and claim (wallet activated) routes.
  - API endpoints: `GET/PUT /api/v1/notifications/preferences`, `GET /api/v1/notifications`, `POST /api/v1/notifications/read`, `POST /api/v1/notifications/read-all`, `GET /api/v1/notifications/unread-count`.
  - Live notification bell popover in dashboard header with unread badge, mark-read, mark-all-read, auto-polling.
  - Settings page notification section wired to preferences API with toggles for in-app, email, transaction alerts, budget warnings, weekly summary, and dollar thresholds.
  - Key files: `lib/notifications.ts`, `components/dashboard/notification-popover.tsx`, `app/api/v1/notifications/`.
- **Operational Safety Net (Phase 6D):**
  - Daily wallet reconciliation: sums all transactions per wallet (topups - purchases) and compares against stored `balance_cents`. Logs results to `reconciliation_logs` table. Triggered manually via `POST /api/v1/admin/reconciliation/run` (owner-scoped).
  - Health check endpoint: `GET /api/v1/health` — pings DB, returns uptime and connection status. No auth required.
  - Failed webhook delivery alerting: `GET /api/v1/webhooks/health` — returns count of failed deliveries in last 24h, scoped to owner's bots.
  - Operational Health panel on dashboard overview with webhook health indicator (green/amber) and manual reconciliation button with inline results.
  - Key files: `components/dashboard/ops-health.tsx`, `app/api/v1/health/route.ts`, `app/api/v1/admin/reconciliation/run/route.ts`, `app/api/v1/webhooks/health/route.ts`.
- **Payment Links — Bots Get Paid (Phase 7):**
  - `payment_links` table tracks bot-generated payment links with Stripe Checkout Sessions.
  - Bot endpoints: `POST /api/v1/bot/payments/create-link` (creates Stripe Checkout Session, returns URL), `GET /api/v1/bot/payments/links` (list with status/limit filters).
  - Stripe webhook handler: `POST /api/v1/webhooks/stripe` — verifies `stripe-signature`, handles `checkout.session.completed` with `purpose: bot_payment_link` metadata. Idempotent (ignores already-completed links).
  - On payment completion: credits bot wallet, records `payment_received` transaction, fires `wallet.payment.received` bot webhook, sends owner notification.
  - Lazy expiry: payment links expire after 24h; status computed on read (no cron needed).
  - Public pages: `/payment/success` and `/payment/cancelled` for post-checkout redirect.
  - Owner dashboard: `GET /api/v1/payment-links` (session-auth), PaymentLinksPanel component with status badges and earnings total.
  - Reconciliation updated to count `payment_received` as credits alongside `topup`.
  - Key files: `app/api/v1/bot/payments/create-link/route.ts`, `app/api/v1/bot/payments/links/route.ts`, `app/api/v1/webhooks/stripe/route.ts`, `app/api/v1/payment-links/route.ts`, `components/dashboard/payment-links.tsx`.
- **Open Access & Waitlist (Phase 9):**
  - `waitlist_entries` table with email (unique), source, createdAt.
  - `POST /api/v1/waitlist` with validation, rate limiting (5/hr per IP), deduplication.
  - Hero + footer waitlist forms submit to API, show decision modal with two paths: "Let me try it now" (→ onboarding) or "Keep me on the waitlist" (→ confirmation).
  - All landing page and onboarding wizard copy updated to reflect "add your own card + spending controls" model, virtual cards = coming soon.
  - Key files: `app/api/v1/waitlist/route.ts`, `components/hero.tsx`, `components/waitlist-form.tsx`.
- **Wallet Freeze & Dynamic Cards (Phase 9B):**
  - `is_frozen` boolean column on `wallets` table (default false).
  - `freezeWallet`/`unfreezeWallet` storage methods (owner-scoped).
  - `GET /api/v1/wallets` returns wallets+bot data for authenticated owner.
  - `POST /api/v1/wallets/[id]/freeze` toggles frozen state (session-auth, owner-scoped).
  - Purchase endpoint rejects spends on frozen wallets with `wallet_frozen` error, webhook, and owner alert.
  - `CardVisual` component accepts `frozen` prop with grayscale + "FROZEN" badge overlay.
  - Cards page now dynamic: fetches real wallets from API, Freeze button with optimistic toggle + toast, Limits button opens spending permissions dialog, "..." dropdown with View Transactions and Copy Bot ID.
  - Key files: `app/api/v1/wallets/route.ts`, `app/api/v1/wallets/[id]/freeze/route.ts`, `app/app/cards/page.tsx`, `components/dashboard/card-visual.tsx`.
- **Onboarding Wizard (Phase 8):**
  - Guided 12-screen wizard at `/onboarding` for new bot owners to complete full setup in one sitting.
  - Two entry paths: "bot-first" (owner has claim token from bot registration) and "owner-first" (owner generates 6-digit pairing code for bot to use during registration).
  - `pairing_codes` table with 6-digit numeric codes, 1-hour expiry, owner-scoped rate limiting (5/hr).
  - Pairing code endpoints: `POST /api/v1/pairing-codes` (generate), `GET /api/v1/pairing-codes/status` (poll for bot connection).
  - Register endpoint updated: optional `pairing_code` field auto-claims bot + creates wallet atomically in a DB transaction.
  - Wizard steps: choose path → claim token / pairing code → approval mode → threshold (conditional) → spending limits → blocked categories → approved categories (conditional) → special instructions → connect bot (if not yet connected) → add payment → fund wallet (conditional) → complete.
  - Dynamic step list with index clamping to prevent out-of-bounds navigation.
  - Complete step saves spending permissions once via ref-guarded useEffect.
  - CSS-only step transitions (no framer-motion).
  - Entry points: "Get Started" CTA on landing page hero, dashboard banner for owners with no bots.
  - Key files: `components/onboarding/onboarding-wizard.tsx`, `components/onboarding/wizard-step.tsx`, `components/onboarding/steps/*.tsx`, `app/onboarding/page.tsx`, `app/api/v1/pairing-codes/route.ts`, `app/api/v1/pairing-codes/status/route.ts`.

- **Rail 4: Split-Knowledge Card Model (Phase 1 — Data Model + Core Setup API):**
  - `rail4_cards` table stores all Rail 4 data per bot: decoy filename, real profile index, 3 missing digit positions, missing digits value, expiry, owner name/zip/IP, status, and 5 fake profiles as JSON.
  - Single-table design — Rail 4 is an add-on to existing bots, not a separate registration flow. Uses `bot_id` FK back to `bots` table.
  - Decoy file generator (`lib/rail4.ts`): generates randomized filename from unusual words, picks random profile index (1-6), random consecutive digit positions (start 7-10, ensuring at least 2 within positions 7-12), generates 5 fake profiles with plausible card numbers/CVVs/addresses, builds markdown decoy file with 6 profiles (5 fake pre-filled, 1 empty for owner).
  - Storage methods: `createRail4Card`, `getRail4CardByBotId`, `updateRail4Card`, `deleteRail4Card`.
  - Owner-auth API endpoints: `POST /api/v1/rail4/initialize` (generates setup, returns decoy file), `POST /api/v1/rail4/submit-owner-data` (owner submits 3 missing digits, expiry, name, zip; IP recorded automatically; status set to active), `GET /api/v1/rail4/status` (check Rail 4 config status).
  - Zod validation schemas: `initializeRail4Schema`, `submitRail4OwnerDataSchema`.
  - PCI scope: CreditClaw stores only 3 middle digits (not cardholder data per PCI truncation rules), expiry (not cardholder data without PAN), and standard user data (name, zip, IP). Out of PCI scope by design.
  - Key files: `shared/schema.ts`, `server/storage.ts`, `lib/rail4.ts`, `app/api/v1/rail4/initialize/route.ts`, `app/api/v1/rail4/submit-owner-data/route.ts`, `app/api/v1/rail4/status/route.ts`.

### Key Routes
- `/` — Consumer landing page
- `/claim` — Bot claim page
- `/app` — Dashboard overview
- `/app/cards` — Card management
- `/app/transactions` — Transaction history
- `/app/settings` — Account settings
- `/onboarding` — Guided setup wizard (authenticated)
- `/payment/success` — Post-payment success page (public)
- `/payment/cancelled` — Post-payment cancel page (public)

## External Dependencies
- **Firebase Auth:** User authentication and authorization.
- **PostgreSQL:** Primary database for all application data.
- **Drizzle ORM:** Object-Relational Mapper for database interactions.
- **Stripe:** For payment processing, including SetupIntents, PaymentIntents, and managing payment methods.
- **SendGrid:** For sending transactional emails (e.g., bot registration notifications, top-up requests).
- **shadcn/ui:** UI component library built on Radix primitives.
- **React Query (@tanstack/react-query):** For server state management and data fetching.