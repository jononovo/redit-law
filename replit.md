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
- **Split-Knowledge Card Model (Rail 4):** This advanced privacy feature uses decoy filenames, real profile indexes, and obfuscation events to manage bot card configurations and transactions. It allows for a unified checkout endpoint where the system intelligently routes purchases through fake profiles (for obfuscation) or real profiles (with allowance checks and wallet debits).

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
- **Stripe:** Payment processing for funding wallets, managing payment methods, and handling payment links.
- **SendGrid:** Transactional email services for notifications.
- **shadcn/ui:** UI component library.
- **React Query (@tanstack/react-query):** Server state management and data fetching.