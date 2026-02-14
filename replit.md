# CreditClaw.com

## Overview
CreditClaw is a prepaid spending controls platform designed for AI agents within the OpenClaw ecosystem. It allows owners to fund bot wallets using their own credit cards and enforce strict spending limits, including per-transaction, daily, monthly caps, category blocking, and approval modes. The platform offers a consumer landing page with immediate sign-up and a waitlist for future virtual card issuance, alongside a dashboard for managing wallets, transactions, and spending controls. The project's vision is to provide a secure and controlled financial environment for AI agents, emphasizing a prepaid model rather than credit lines. It also includes features for bots to get paid through payment links and advanced "Split-Knowledge Card Model" for enhanced privacy and obfuscation during transactions.

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
The platform is built on Next.js 16 (App Router), utilizing Firebase Auth (client SDK and Admin SDK) for authentication with httpOnly session cookies. PostgreSQL is the primary database, accessed via Drizzle ORM. Styling is managed with Tailwind CSS v4 and PostCSS, with UI components from shadcn/ui. React Query handles state management.

### Core Features and Design
CreditClaw features a dual interface: a public consumer landing page and a protected dashboard. Key functionalities include bot registration and claiming, integrated Stripe for wallet funding, and comprehensive spending controls (limits, category blocking, approval modes) enforced server-side. A bot-facing API allows bots to check wallet status, make purchases, request top-ups, and view transaction history. Authentication uses Firebase for owners and Bearer API tokens for bots.

The system supports multiple payment methods per owner, webhook notifications for bots (with HMAC-SHA256 signatures and exponential backoff retries), and owner-facing notifications (in-app and email alerts based on preferences). Operational safety nets include daily wallet reconciliation, health checks, and alerts for failed webhook deliveries.

Advanced features include:
- **Payment Links:** Bots can generate Stripe Checkout Sessions for receiving payments, crediting their wallets automatically upon completion.
- **Wallet Freeze:** Owners can freeze bot wallets, preventing transactions and triggering notifications.
- **Onboarding Wizard:** A guided 12-screen wizard facilitates new bot owner setup, supporting both "bot-first" (claim token) and "owner-first" (pairing code) flows.
- **Split-Knowledge Card Model (Rail 4):** This advanced privacy feature uses payment profiles files (formerly "decoy files"), real profile indexes, and obfuscation events to manage bot card configurations and transactions. Setup wizard (11 steps in new-card mode): Card Name → Use Case → Welcome → Card Details → Permissions → Download → Instructions Overview → File Editing Guide → Address Guide → Success → Connect Bot (optional). Card status lifecycle: pending_setup → awaiting_bot (setup complete) → active (bot connected). The File Editing Guide shows the user's actual profile number and masked card number with an auto-toggling incomplete/complete switch (5-second interval, pauses on hover/click). The Address Guide shows the address section with the same toggle. Permissions editable post-setup via three-dot menu on each card. Per-card detail page shows filtered transaction ledger. Includes human approval workflow via HMAC-signed email links (15-min TTL), bot polling for confirmation results, and per-profile allowance tracking with confirmation-exempt thresholds.

### Multi-Rail Architecture
CreditClaw supports multiple independent payment rails, each with its own database tables, API routes, components, and lib files. Rails are strongly segmented — no cross-contamination of schemas or logic.

- **Rail 1 (Stripe Wallet):** Privy server wallets on Base chain, USDC funding via Stripe Crypto Onramp, x402 payment protocol for bot spending. Firebase Auth remains the global auth layer; Privy SDK is scoped only to Rail 1 wallet operations. Tables: `privy_wallets`, `privy_guardrails`, `privy_transactions`, `privy_approvals`. Routes: `/api/v1/stripe-wallet/*`. Lib: `lib/stripe-wallet/`. UI: `/stripe-wallet` (landing), `/app/stripe-wallet` (dashboard). Storage methods prefixed `privy*`.
- **Rail 2 (Card Wallet):** CrossMint smart wallets on Base chain, USDC funding via fiat onramp, Amazon/commerce purchases via Orders API. Firebase Auth remains global layer; CrossMint handles wallet operations only (no Stytch). Uses merchant allow/blocklist instead of domain lists; 15-min approval TTL. Tables: `crossmint_wallets`, `crossmint_guardrails`, `crossmint_transactions`, `crossmint_approvals`. Routes: `/api/v1/card-wallet/*`. Lib: `lib/card-wallet/` (server.ts, onramp.ts, purchase.ts). Shared modules: `lib/guardrails/evaluate.ts`, `lib/approvals/lifecycle.ts`. UI: `/app/card-wallet` (dashboard). Storage methods prefixed `crossmint*`.
- **Master Guardrails:** Cross-rail spending limits enforced at the owner level. A single `master_guardrails` table keyed by `ownerUid` stores per-transaction max, daily budget, monthly budget, and an enabled toggle. Aggregated spend is computed live across Rail 1 (`privy_transactions`), Rail 2 (`crossmint_transactions`), and Rail 4 (`checkout_confirmations` for approved real-profile purchases). Master guardrails are checked before per-rail guardrails in each bot-facing endpoint. They only block or allow (no approval threshold at master level). Unit normalization: Rail 1/2 use micro USDC natively; Rail 4 cents are converted via `centsToMicroUsdc(cents) = cents * 10,000`. Lib: `lib/guardrails/master.ts`. UI: "Master Budget" section on `/app/settings`.
- **Rail 4 (Self-Hosted Cards):** Split-knowledge card model with obfuscation. See existing documentation below. Routes: `/api/v1/rail4/*`.

### Key Routes
- `/` — Consumer landing page
- `/claim` — Bot claim page
- `/stripe-wallet` — Rail 1 landing page (Privy + x402)
- `/app` — Dashboard overview
- `/app/stripe-wallet` — Rail 1 dashboard (wallet list, guardrails, activity, approvals)
- `/card-wallet` — Rail 2 landing page (CrossMint + Amazon)
- `/app/card-wallet` — Rail 2 dashboard (wallet list, guardrails, orders, approvals, fund wallet)
- `/app/cards` — Card management
- `/app/self-hosted` — Self-hosted card management (Rail 4 split-knowledge)
- `/app/self-hosted/[cardId]` — Per-card detail page with transaction ledger
- `/app/transactions` — Transaction history
- `/app/settings` — Account settings
- `/onboarding` — Guided setup wizard (authenticated)
- `/payment/success` — Post-payment success page (public)
- `/payment/cancelled` — Post-payment cancel page (public)

### Rail 1 API Endpoints (Stripe Wallet)
- `POST /api/v1/stripe-wallet/create` — Create a Privy server wallet for a bot
- `GET /api/v1/stripe-wallet/list` — List owner's Stripe Wallets with balances and guardrails
- `GET /api/v1/stripe-wallet/balance` — Get single wallet balance
- `POST /api/v1/stripe-wallet/freeze` — Pause/activate a wallet
- `POST /api/v1/stripe-wallet/onramp/session` — Create Stripe Crypto Onramp session (fiat → USDC)
- `GET/POST /api/v1/stripe-wallet/guardrails` — View/set spending guardrails
- `POST /api/v1/stripe-wallet/bot/sign` — Bot-facing: sign x402 EIP-712 transfer authorization (enforces guardrails)
- `GET /api/v1/stripe-wallet/transactions` — List transactions for a wallet
- `GET /api/v1/stripe-wallet/approvals` — List pending approvals for owner
- `POST /api/v1/stripe-wallet/approvals/decide` — Approve or reject a pending payment
- `POST /api/v1/stripe-wallet/webhooks/stripe` — Stripe webhook for onramp fulfillment

### Rail 2 API Endpoints (Card Wallet)
- `POST /api/v1/card-wallet/create` — Create a CrossMint smart wallet for a bot
- `GET /api/v1/card-wallet/list` — List owner's Card Wallets with balances, guardrails, and merchant controls
- `GET /api/v1/card-wallet/balance` — Get single wallet balance (queries CrossMint chain balance)
- `POST /api/v1/card-wallet/freeze` — Pause/activate a wallet
- `POST /api/v1/card-wallet/onramp/session` — Create fiat onramp session (fiat → USDC)
- `GET/POST /api/v1/card-wallet/guardrails` — View/set spending guardrails (merchant allow/blocklist, limits, auto-pause)
- `GET /api/v1/card-wallet/transactions` — List transactions/orders for a wallet
- `GET /api/v1/card-wallet/orders/[order_id]` — Get detailed order status with live CrossMint tracking info
- `POST /api/v1/card-wallet/webhooks/crossmint` — CrossMint webhook handler for order lifecycle events (Svix signature verification)
- `GET /api/v1/card-wallet/approvals` — List pending purchase approvals for owner
- `POST /api/v1/card-wallet/approvals/decide` — Approve or reject a purchase (creates order on approval)
- `POST /api/v1/card-wallet/bot/purchase` — Bot-facing: request a commerce purchase (requires owner approval)
- `GET /api/v1/card-wallet/bot/purchase/status` — Bot-facing: poll purchase/approval status
- `POST /api/v1/card-wallet/bot/search` — Bot-facing: search Shopify product variants via CrossMint WS Search API (unstable/beta)

### Rail 4 API Endpoints
- `POST /api/v1/bot/merchant/checkout` — Unified checkout (fake profiles → obfuscation, real profiles → wallet debit or pending approval)
- `GET /api/v1/bot/merchant/checkout/status` — Bot polls for human approval result
- `GET/POST /api/v1/rail4/confirm/[id]` — HMAC-signed approval page (HTML) and processing
- `GET /api/v1/rail4/confirmations` — Owner lists pending approvals
- `GET/PATCH /api/v1/rail4/permissions` — Profile permissions editor
- `GET /api/v1/rail4/cards` — List owner's self-hosted cards
- `POST /api/v1/rail4/create-bot` — Owner-initiated bot creation for self-hosted cards (one bot per account)
- `GET /api/v1/rail4/owner-bot` — Returns owner's bot (if any) and card count (max 3 cards per bot)
- `POST /api/v1/rail4/link-bot` — Link existing bot to a card (card must be awaiting_bot, bot must have < 3 cards)
- `POST /api/v1/rail4/initialize` — Initialize card setup (creates card with cardId, returns missing digit positions)
- `POST /api/v1/rail4/submit-owner-data` — Submit missing digits/expiry/permissions by card_id, transitions card to awaiting_bot, returns payment profiles file

### Master Guardrails API
- `GET /api/v1/master-guardrails` — Read master config + live cross-rail spend totals (daily/monthly per-rail breakdown)
- `POST /api/v1/master-guardrails` — Create or update master guardrails (per-tx max, daily, monthly, enabled toggle)

### Authentication
- Session cookies (httpOnly) via Firebase Admin SDK
- Firebase ID token Bearer auth fallback via `lib/auth-fetch.ts` for dashboard API calls
- Bot API uses Bearer API tokens via `withBotApi` middleware
- HMAC-SHA256 signed approval links require `CONFIRMATION_HMAC_SECRET` or `CRON_SECRET` env var

## External Dependencies
- **Firebase Auth:** User authentication and authorization (global layer across all rails).
- **PostgreSQL:** Primary database for all application data.
- **Drizzle ORM:** Object-Relational Mapper for database interactions.
- **Stripe:** Payment processing for funding wallets, managing payment methods, payment links, and Crypto Onramp (Rail 1).
- **Privy (@privy-io/node):** Server wallet management on Base chain (Rail 1 only). Env vars: `NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_AUTHORIZATION_KEY`.
- **viem:** Ethereum utility library for EIP-712 typed data construction (Rail 1).
- **canonicalize:** JSON canonicalization for Privy authorization signatures (Rail 1).
- **CrossMint:** Smart wallet creation, fiat onramp, and commerce orders API (Rail 2). Env vars: `CROSSMINT_SERVER_API_KEY`, `NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY`, `CROSSMINT_WEBHOOK_SECRET`. Webhook verification uses Svix library.
- **Svix:** Webhook signature verification for CrossMint order lifecycle events (Rail 2).
- **SendGrid:** Transactional email services for notifications.
- **shadcn/ui:** UI component library.
- **React Query (@tanstack/react-query):** Server state management and data fetching.