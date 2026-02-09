# CreditClaw.com

## Overview
CreditClaw is a prepaid spending controls platform designed for AI agents within the OpenClaw ecosystem. Its core purpose is to enable owners to fund bot wallets using their own credit cards and enforce strict spending limits, including per-transaction, daily, monthly limits, category blocking, and approval modes. The platform offers immediate sign-up with a parallel waitlist for future virtual card issuance. It includes a consumer landing page, instant onboarding, and a dashboard for managing wallets, transactions, and spending controls. The project aims to establish a secure and controlled financial environment for AI agents, emphasizing a prepaid model over credit lines.

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
- **Payments:** Stripe
- **Email:** SendGrid
- **Styling:** Tailwind CSS v4 with PostCSS
- **UI Components:** shadcn/ui (Radix primitives)
- **Fonts:** Plus Jakarta Sans + JetBrains Mono
- **State Management:** React Query

### Core Features and Design
- **Dual Interface:** Comprises a public consumer landing page and a protected dashboard application.
- **Bot Management:** Supports bot registration, API key issuance, and owner-driven bot claiming to activate wallets.
- **Wallet Funding & Controls:** Integrated Stripe for funding, allowing owners to set granular spending limits (per-transaction, daily, monthly), category blocks, and approval modes enforced server-side.
- **Bot-Facing API:** Provides authenticated endpoints for bots to manage wallet status, execute purchases, request top-ups, and view transaction history.
- **Authentication:** Firebase handles owner authentication via session cookies, while bots use Bearer API tokens with bcrypt validation.
- **Prepaid Model:** Owners fund bot wallets directly, establishing a prepaid system.
- **Atomic Transactions:** Ensures data integrity for all wallet debit operations.
- **Security & Observability:** Implements per-bot rate limiting, comprehensive access logging, and a dedicated activity log for bot API calls.
- **Flexible Billing:** Supports multiple payment methods per account with default selection and specific card charging options.
- **Event-Driven Notifications:** Leverages webhooks for bot notifications (wallet activation, top-ups, spending events) with HMAC-SHA256 signatures and exponential backoff retries. Owners receive in-app and email notifications based on customizable preferences for transactions, budget warnings, and suspicious activity.
- **Operational Health:** Includes daily wallet reconciliation, health check endpoints, and monitoring for failed webhook deliveries, presented in a dashboard panel.
- **Payment Links:** Bots can generate Stripe payment links for receiving payments, crediting their wallets upon successful completion.
- **Onboarding Wizard:** A guided, multi-step wizard for new bot owners to streamline setup, including bot pairing, spending rule configuration, and initial funding.
- **Wallet State Management:** Allows freezing/unfreezing of wallets, impacting bot spending capabilities and visually represented on the dashboard.
- **Open Access & Waitlist:** Features a waitlist system for future virtual card issuance alongside immediate onboarding for current functionalities.
- **Rail 4: Split-Knowledge Card Model:** An add-on feature that generates a "split-knowledge" card configuration for bots, designed to be out of PCI scope by not storing full cardholder data directly. It involves generating decoy files with partial card information and fake profiles for enhanced security and privacy.
- **Card Type System:** The "+ Create New Card" button on the Cards page opens a card type picker modal with three options: "Self-Hosted" (active, launches Rail 4 setup wizard), "Virtual Card" (Coming Soon), and "Stripe ASP — For Agentic Checkout" (Coming Soon). Self-hosted cards appear in the card grid with a "Self-Hosted" badge and dark card visual.

### Recent Changes
- **Rail 4 Phase 1 — Data Model + Core Setup API:**
  - `rail4_cards` table stores all Rail 4 data per bot: decoy filename, real profile index, 3 missing digit positions, missing digits value, expiry, owner name/zip/IP, status, and 5 fake profiles as JSON.
  - Single-table design — Rail 4 is an add-on to existing bots, not a separate registration flow. Uses `bot_id` FK back to `bots` table.
  - Decoy file generator (`lib/rail4.ts`): generates randomized filename from unusual words, picks random profile index (1-6), random consecutive digit positions (start 7-10, ensuring at least 2 within positions 7-12), generates 5 fake profiles with plausible card numbers/CVVs/addresses, builds markdown decoy file with 6 profiles (5 fake pre-filled, 1 empty for owner).
  - Storage methods: `createRail4Card`, `getRail4CardByBotId`, `updateRail4Card`, `deleteRail4Card`.
  - Owner-auth API endpoints: `POST /api/v1/rail4/initialize` (generates setup, returns decoy file), `POST /api/v1/rail4/submit-owner-data` (owner submits 3 missing digits, expiry, name, zip; IP recorded automatically; status set to active), `GET /api/v1/rail4/status` (check Rail 4 config status), `DELETE /api/v1/rail4` (delete config for a bot).
  - PCI scope: CreditClaw stores only 3 middle digits (not cardholder data per PCI truncation rules), expiry (not cardholder data without PAN), and standard user data (name, zip, IP). Out of PCI scope by design.
  - Key files: `shared/schema.ts`, `server/storage.ts`, `lib/rail4.ts`, `app/api/v1/rail4/initialize/route.ts`, `app/api/v1/rail4/submit-owner-data/route.ts`, `app/api/v1/rail4/status/route.ts`, `app/api/v1/rail4/route.ts`.

- **Rail 4 Phase 2 — Owner UI for Setup:**
  - Card type picker modal (`components/dashboard/card-type-picker.tsx`): replaces old "Issue New Card" dialog. Three card types: Self-Hosted (active), Virtual Card (Coming Soon), Stripe ASP (Coming Soon).
  - Rail 4 setup wizard (`components/dashboard/rail4-setup-wizard.tsx`): 4-step multi-modal flow: (1) select bot, (2) initialize + download decoy file via blob, (3) confirmation checklist, (4) submit missing digits/expiry/name/zip. Shows success state on completion.
  - Cards page updated: shows self-hosted cards in the card grid with dark card visual, "Self-Hosted" emerald badge, and dropdown with Copy ID and Remove Card actions. Delete includes confirmation dialog.
  - Self-Hosted management page (`app/app/self-hosted/page.tsx`): dedicated hub at `/app/self-hosted` with overview stats (active/pending/not configured counts), "How it works" explainer section, per-bot status list with configure/continue/copy/delete actions, and "Set Up New Bot" button that opens the shared wizard.
  - Sidebar updated: "Self-Hosted" nav item with ShieldCheck icon added between Transactions and Settings.
  - Key files: `components/dashboard/card-type-picker.tsx`, `components/dashboard/rail4-setup-wizard.tsx`, `app/app/cards/page.tsx`, `app/app/self-hosted/page.tsx`, `components/dashboard/sidebar.tsx`.

### Key Routes
- `/` — Consumer landing page
- `/claim` — Bot claim page
- `/app` — Dashboard overview
- `/app/cards` — Card management (all card types)
- `/app/self-hosted` — Self-hosted card management hub
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
