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

### Key Routes
- `/` — Consumer landing page
- `/claim` — Bot claim page
- `/app` — Dashboard application
- `/onboarding` — Guided setup wizard
- `/payment/success` — Public payment success page
- `/payment/cancelled` — Public payment cancellation page

## External Dependencies
- **Firebase Auth:** User authentication and authorization.
- **PostgreSQL:** Primary database.
- **Drizzle ORM:** Database interaction.
- **Stripe:** Payment processing and payment method management.
- **SendGrid:** Transactional email services.
- **shadcn/ui:** UI component library.
- **React Query (@tanstack/react-query):** Server state management and data fetching.