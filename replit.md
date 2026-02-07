# CreditClaw.com

## Overview
CreditClaw is a prepaid virtual credit card platform for AI agents within the OpenClaw ecosystem. It allows bot owners to fund wallets with allowances, enabling their AI agents to spend responsibly using virtual Visa/Mastercard cards. Bots register first, receive API keys and claim tokens, and then access their wallets upon human activation. The platform features a consumer landing page for waitlists and marketing, and a dashboard application for managing virtual cards, transactions, and spending controls. The project aims to provide a secure and controlled financial environment for AI agents.

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

### Key Routes
- `/` — Consumer landing page
- `/claim` — Bot claim page
- `/app` — Dashboard overview
- `/app/cards` — Card management
- `/app/transactions` — Transaction history
- `/app/settings` — Account settings

## External Dependencies
- **Firebase Auth:** User authentication and authorization.
- **PostgreSQL:** Primary database for all application data.
- **Drizzle ORM:** Object-Relational Mapper for database interactions.
- **Stripe:** For payment processing, including SetupIntents, PaymentIntents, and managing payment methods.
- **SendGrid:** For sending transactional emails (e.g., bot registration notifications, top-up requests).
- **shadcn/ui:** UI component library built on Radix primitives.
- **React Query (@tanstack/react-query):** For server state management and data fetching.