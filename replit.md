# CreditClaw.com

## Overview
CreditClaw is a prepaid spending controls platform designed for AI agents within the OpenClaw ecosystem. It enables owners to fund bot wallets using their credit cards and enforce strict spending limits (per-transaction, daily, monthly caps, category blocking, approval modes). The platform offers a consumer landing page for immediate sign-up, a waitlist for virtual card issuance, and a dashboard for managing wallets, transactions, and spending controls. Its core purpose is to provide a secure and controlled financial environment for AI agents, focusing on a prepaid model. It also supports bots receiving payments via links and features a "Split-Knowledge Card Model" for enhanced transaction privacy. The project aims to become the leading financial control and payment solution for AI agents.

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
The platform uses Next.js 16 (App Router), Firebase Auth (client/Admin SDK) with httpOnly session cookies, PostgreSQL via Drizzle ORM, Tailwind CSS v4, PostCSS, shadcn/ui for components, and React Query for state management.

### Core Features and Design
CreditClaw features a public landing page and a protected dashboard. Key functionalities include bot registration, Stripe integration for wallet funding, and server-side enforced spending controls. A bot-facing API allows bots to check wallet status, make purchases, request top-ups, and view transaction history. Authentication is via Firebase for owners and Bearer API tokens for bots.

The system supports multiple payment methods per owner, webhook notifications for bots (HMAC-SHA256, exponential backoff), and owner notifications (in-app, email). Operational safety includes daily wallet reconciliation and health checks.

Advanced features:
- **Payment Links:** Bots generate Stripe Checkout Sessions for receiving payments.
- **Wallet Freeze:** Owners can freeze bot wallets, preventing transactions.
- **Onboarding Wizard:** A ~7-step wizard for new bot owner setup, supporting "bot-first" or "owner-first" flows. It configures master spending limits (account-wide defaults).
- **Split-Knowledge Card Model (Rail 4):** Manages bot card configurations and transactions using payment profiles and obfuscation. Includes a multi-step setup wizard and a human approval workflow for transactions via HMAC-signed email links.

### Multi-Rail Architecture
CreditClaw employs a multi-rail architecture, segmenting payment rails with independent database tables, API routes, and components.
- **Rail 1 (Stripe Wallet):** Uses Privy server wallets on Base chain, USDC funding via Stripe Crypto Onramp, and x402 payment protocol.
- **Rail 2 (Card Wallet):** Uses CrossMint smart wallets on Base chain, USDC funding via fiat onramp, and Amazon/commerce purchases via Orders API. Employs merchant allow/blocklists.
- **Master Guardrails:** Owner-level, cross-rail spending limits stored in a `master_guardrails` table. These guardrails are checked before per-rail guardrails and aggregate spend across all active rails.
- **Rail 4 (Self-Hosted Cards):** Implements the Split-Knowledge card model with obfuscation.
- **Rail 5 (Sub-Agent Cards):** Encrypted card files + ephemeral sub-agents. Owner encrypts card client-side (AES-256-GCM), downloads encrypted `.md` file, CreditClaw stores only the decryption key. At checkout, a disposable sub-agent gets the key, decrypts, pays, and is deleted. DB tables: `rail5_cards`, `rail5_checkouts`. Owner API: `/api/v1/rail5/{initialize,submit-key,cards}`. Bot API: `/api/v1/bot/rail5/{checkout,key,confirm}`. Dashboard: `/app/sub-agent-cards`. Setup wizard: 7-step with Web Crypto encryption.

### Procurement Skills Module
A `/skills/` module provides a curated library of vendor shopping skills.
- **Types:** Defines CheckoutMethod taxonomy, VendorCapability, SkillMaturity, and VendorSkill interface.
- **Registry:** A static TypeScript catalog of 14 vendors with capabilities, checkout methods, and tips.
- **Generator:** Converts VendorSkill configs into `SKILL.md` files for agents.
- **Discovery API:** Bot-facing endpoints to discover and load vendor skills.
- **Catalog Page:** Public browsable directory with search, filters, vendor cards, and friendliness scores.
- **Vendor Detail Pages:** Per-vendor pages with capabilities, checkout details, and `SKILL.md` preview.

### Community Submissions Module
Registered users can submit vendor websites for analysis, contributing to the procurement skills library.
- **Submission API:** `POST /api/v1/skills/submissions` (authenticated, triggers 4-pass analysis), `GET /api/v1/skills/submissions/mine` (list user's own submissions with profile stats).
- **Submitter Profiles:** `skill_submitter_profiles` table tracks per-user submission counts (submitted, published, rejected).
- **Trust Badges:** Submissions are tagged as "official" (email domain matches vendor domain) or "community" (all others).
- **Review Integration:** Community submissions feed into the existing review queue at `/app/skills/review` with source filtering (Admin/Community) and submitter attribution badges.
- **Submission UI:** `/app/skills/submit` provides a form to submit vendor URLs, view submission history, and track acceptance rates.

### Key Routes
- `/`: Consumer landing page
- `/claim`: Bot claim page
- `/skills`: Vendor procurement skills catalog
- `/app`: Dashboard overview
- `/app/stripe-wallet`: Rail 1 dashboard
- `/app/card-wallet`: Rail 2 dashboard
- `/app/self-hosted`: Self-hosted card management (Rail 4)
- `/app/sub-agent-cards`: Sub-agent card management (Rail 5)
- `/app/transactions`: Transaction history
- `/app/skills/submit`: Community vendor skill submission
- `/app/skills/review/[id]/versions`: Version history with diff view and rollback
- `/app/skills/export`: Export delta report for ClawHub.ai and skills.sh
- `/app/settings`: Account settings
- `/onboarding`: Guided setup wizard

### Skill Builder Module
An LLM-powered tool that analyzes vendor websites and generates procurement skill files automatically.
- **Builder Core** (`lib/procurement-skills/builder/`): 4-pass analysis (API probing, LLM checkout flow analysis, business feature detection, protocol support checking) with per-field confidence scoring.
- **Database Tables:** `skill_drafts` (vendor analysis results with confidence scores), `skill_evidence` (provenance records for each field), `skill_versions` (versioned snapshots with 4-file bundles), and `skill_exports` (export tracking per destination).
- **API Routes:** `POST /api/v1/skills/analyze` (trigger analysis), `GET /api/v1/skills/drafts` (list), `GET/PATCH/DELETE /api/v1/skills/drafts/[id]` (CRUD), `POST /api/v1/skills/drafts/[id]/publish` (approve and create versioned record with all 4 files).
- **Version API:** `GET /api/v1/skills/versions?vendor=slug` (list), `GET /api/v1/skills/versions/[id]` (detail), `GET /api/v1/skills/versions/[id]/diff` (semantic diff), `POST /api/v1/skills/versions/[id]/rollback` (rollback), `GET /api/v1/skills/versions/[id]/files` (4-file bundle download).
- **Export API:** `GET /api/v1/skills/export?destination=clawhub|skills_sh` (delta report), `POST /api/v1/skills/export/mark` (mark as exported, supports batch), `GET /api/v1/skills/export/download/[vendorSlug]` (download active version package).
- **Review UI:** `/app/skills/review` (draft queue with analyze form) and `/app/skills/review/[id]` (detail editor with confidence badges, evidence snippets, field overrides, publish/reject buttons).
- **Security:** SSRF-safe fetching with DNS resolution validation, private IP blocking (IPv4/IPv6), redirect validation, HTTPS-only.
- **Tests:** 41 API endpoint tests covering full draft lifecycle, 52 versioning unit tests.

### Skill Versioning & Multi-File Packages
Skills are packaged as 4-file bundles: `SKILL.md` (agent instructions), `skill.json` (structured metadata), `payments.md` (CreditClaw payment rules), `description.md` (human-readable listing card).
- **Package Generators** (`lib/procurement-skills/package/`): `skill-json.ts`, `payments-md.ts`, `description-md.ts` plus existing `generator.ts` for SKILL.md.
- **Versioning Core** (`lib/procurement-skills/versioning/`): Semantic field-level diff algorithm with severity classification (breaking/notable/minor), automatic semver bumping, SHA-256 checksums, and rollback support.
- **Export System:** Weekly manual export workflow with delta reports showing new/updated skills for ClawHub.ai and skills.sh external marketing sites. Mark-as-exported tracking per destination.

### API Endpoints
CreditClaw provides distinct API endpoints for each rail and for master guardrails, facilitating wallet management, transactions, approvals, and guardrail configuration. Bot-facing APIs allow for purchase requests, status polling, and skill discovery. Owner-facing APIs manage cards, guardrails, and approvals.

## External Dependencies
- **Firebase Auth:** User authentication and authorization.
- **PostgreSQL:** Primary application database.
- **Drizzle ORM:** Database interaction.
- **Stripe:** Payment processing for funding, payment links, and Crypto Onramp.
- **Privy (@privy-io/node):** Server wallet management (Rail 1).
- **viem:** Ethereum utility library (Rail 1).
- **canonicalize:** JSON canonicalization for signatures (Rail 1).
- **CrossMint:** Smart wallet creation, fiat onramp, and commerce orders API (Rail 2).
- **Svix:** Webhook signature verification for CrossMint (Rail 2).
- **SendGrid:** Transactional email services.
- **shadcn/ui:** UI component library.
- **React Query (@tanstack/react-query):** Server state management.
- **Anthropic (@anthropic-ai/sdk):** LLM-powered vendor analysis for Skill Builder.