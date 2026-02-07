# CreditClaw.com

## Overview
CreditClaw is a prepaid virtual credit card platform for AI agents within the OpenClaw ecosystem. It enables bot owners to fund wallets, allowing their AI agents to make controlled expenditures using virtual Visa/Mastercard cards. The platform supports bot registration, API key issuance, and a human activation process to link agents to their funded wallets.

The platform provides two main interfaces: a consumer-facing landing page featuring a waitlist and project branding, and a dashboard application for owners to manage virtual cards, monitor transactions, and control agent spending. The project aims to provide a robust and secure spending mechanism for AI agents.

## User Preferences
- **Design theme:** "Fun Consumer" — 3D clay/claymation aesthetic, coral lobster mascot, bright pastels (orange/blue/purple)
- **Font:** Plus Jakarta Sans
- **Border radius:** 1rem rounded corners
- **Framework:** Next.js 16 with App Router only
- **No framer-motion** (lightweight build)
- **No Vite, no standalone React** — everything runs through Next.js
- All interactive components marked with `"use client"` directive

## System Architecture

CreditClaw is built as a Next.js 16 application utilizing the App Router. It follows a robust architectural pattern to manage both consumer-facing and bot-facing functionalities.

**Core Technologies:**
-   **Frontend Framework:** Next.js 16 (App Router)
-   **Authentication:** Firebase Auth (client SDK) and Firebase Admin SDK (server) with httpOnly session cookies.
-   **Database:** PostgreSQL with Drizzle ORM for schema management.
-   **Payments:** Stripe integration for wallet funding and payment method management.
-   **Email Services:** SendGrid for transactional emails.
-   **Styling:** Tailwind CSS v4 with PostCSS for a "Fun Consumer" design theme, featuring 3D clay aesthetics, a coral lobster mascot, and bright pastel colors. UI components are built using shadcn/ui (Radix primitives).
-   **State Management:** React Query for server state.
-   **Deployment:** Replit.

**Key Features and Implementations:**
-   **Bot Registration & Claim:** Bots register first, receiving API keys and claim tokens. Owners then use a `/claim` flow to link bots to their accounts.
-   **Wallet System:** Owners fund wallets via Stripe. Each bot has a dedicated wallet, created upon owner claim.
-   **Spending Control:** Owners define granular spending permissions (per-transaction, daily, monthly limits, category blocking, approval modes) via a dashboard editor. These rules are enforced server-side.
-   **Transaction Management:** Comprehensive transaction history is available for both owners and bots.
-   **API Design:** A dual API structure is used:
    -   **Owner-facing APIs:** Secured by Firebase session authentication for managing bots, wallets, and spending rules.
    -   **Bot-facing APIs:** Secured by Bearer API token authentication for actions like balance checks, spending requests, purchases, and top-up requests. API keys are bcrypt-hashed and use prefix-based lookup for security.
-   **UI/UX:** The application features a clean, intuitive dashboard for owners and a consumer landing page. The design incorporates a "Fun Consumer" aesthetic with a coral lobster mascot and a specific color palette (`--primary`: Orange, `--secondary`: Blue, `--accent`: Purple). Global border-radius is set to 1rem.

## External Dependencies

-   **Firebase:** For user authentication (Google, GitHub, magic link) and managing user sessions.
-   **Stripe:** Used for handling all payment processing, including setting up payment methods (SetupIntents) and funding wallets (PaymentIntents).
-   **SendGrid:** Utilized for sending transactional emails, such as owner notifications during bot registration and top-up requests initiated by bots.
-   **PostgreSQL:** The primary database solution for storing all application data, including bot information, wallets, transactions, payment methods, and spending permissions.
-   **Drizzle ORM:** Used as the Object-Relational Mapper for interacting with the PostgreSQL database.
-   **React Query (@tanstack/react-query):** For managing and caching server state.
-   **shadcn/ui:** Provides pre-built, accessible UI components based on Radix UI primitives.