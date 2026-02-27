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

## Modularization Guidelines

New features should follow a feature-first folder structure. Each rail lives under `lib/rail{N}/` with files grouped by responsibility, not by layer.

**Within a rail**, split code by what it does:
- `client.ts` — shared API client, auth, fetch wrapper, format helpers (if the rail talks to an external API)
- `wallet/` or `orders/` — domain operations grouped into subfolders when there are multiple related functions
- `fulfillment.ts` — business logic that runs when an approval is decided (wallet debits, order creation, webhooks)
- `approval-callback.ts` — thin glue (~5-10 lines) that registers the rail's fulfillment functions with the unified approval system
- Keep each file focused on one concern. If a file is doing two unrelated things, split it.

**Outside of rails** (cross-cutting features like guardrails, approvals, webhooks, notifications):
- These stay in their own `lib/{feature}/` folders and should not contain rail-specific business logic.
- If a cross-cutting module starts accumulating rail-specific code (like `callbacks.ts` did), extract that logic into the rail's own folder and leave a thin import in the cross-cutting module.

**Guardrails** (`lib/guardrails/`):
- `defaults.ts` — single source of truth for all guardrail default values (master + all rails). The schema reads from this file, so changing a value here changes the default for new records. Also exports `PROCUREMENT_DEFAULTS` for procurement controls.
- `types.ts` — `GuardrailRules` (USDC-based for Rails 1/2), `CardGuardrailRules` (cents-based for Rails 4/5), `TransactionRequest`, `CardTransactionRequest`, `CumulativeSpend`, `CardCumulativeSpend`, `GuardrailDecision` interfaces.
- `evaluate.ts` — two pure evaluation functions: `evaluateGuardrails()` for USDC rails (1 & 2) and `evaluateCardGuardrails()` for card rails (4 & 5). Only enforces spending limits and approval thresholds — domain/merchant/category enforcement is handled by procurement controls.
- `master.ts` — master-level guardrail evaluation (fetches config, aggregates cross-rail spend, calls `evaluateGuardrails`).
- **Standardized Structure**: All four rail guardrail tables have identical columns (differing only in `_usdc` vs `_cents` suffix and FK type): `maxPerTx`, `dailyBudget`, `monthlyBudget`, `requireApprovalAbove`, `approvalMode`, `recurringAllowed`, `autoPauseOnZero`, `notes`, `updatedAt`, `updatedBy`. Domain/merchant/category lists are NOT guardrails — they live exclusively in `procurement_controls`.
- **approvalMode Enforcement**: All four checkout routes check `approvalMode` before running the evaluator:
  - `ask_for_everything` → immediately require owner approval (skip evaluator)
  - `auto_approve_under_threshold` → run evaluator; only require approval if amount exceeds `requireApprovalAbove`
  - `auto_approve_by_category` → treated same as `auto_approve_under_threshold` (future feature)
  - Defaults: Rail 1/2/4 default to `ask_for_everything`, Rail 5 defaults to `auto_approve_under_threshold`
- **recurringAllowed**: Column exists on all rails for structural consistency but is not yet enforced in checkout routes (pending recurring detection logic).
- **notes**: Informational field on all rails, returned in API responses but not used in enforcement.

**Procurement Controls** (`lib/procurement-controls/`):
- `types.ts` — `ProcurementRules`, `ProcurementRequest`, `ProcurementDecision` interfaces.
- `defaults.ts` — `DEFAULT_PROCUREMENT_RULES` with default blocked categories.
- `evaluate.ts` — `evaluateProcurementControls()` checks domain, merchant, and category rules. `mergeProcurementRules()` combines master + rail-level rules (blocklists are unioned, allowlists are intersected).
- DB table: `procurement_controls` with `scope` (master/rail1/rail2/rail4/rail5) and `scope_ref_id` for per-rail granularity. Owner-facing API: `GET/POST /api/v1/procurement-controls` and `GET /api/v1/procurement-controls/[scope]`.
- **Fully separated from guardrails**: Domain/merchant/category lists are exclusively managed by `procurement_controls`. The guardrails tables (`privy_guardrails`, `crossmint_guardrails`, `rail4_guardrails`, `rail5_guardrails`) no longer have `allowlisted_domains`, `blocklisted_domains`, `allowlisted_merchants`, or `blocklisted_merchants` columns. The guardrails GET APIs still return these fields in the response by reading from `procurement_controls`, maintaining backward compatibility. The card-wallet frontend saves merchant lists to `POST /api/v1/procurement-controls` separately from guardrail limit saves.

**Storage is modularized** under `server/storage/` with domain-grouped files:
- `types.ts` — the `IStorage` interface (single source of truth for all method signatures)
- `index.ts` — composes all domain fragments into the `storage` object and re-exports `IStorage`
- `core.ts` — bots, wallets, transactions, payment methods, topups, access logs, reconciliation, freeze/unfreeze
  - `rail4-guardrails.ts` — CRUD for `rail4_guardrails` table
  - `rail5-guardrails.ts` — CRUD for `rail5_guardrails` table
  - `procurement-controls.ts` — CRUD for `procurement_controls` table
- `webhooks.ts` — webhook deliveries, retries, failed count
- `notifications.ts` — notification preferences + messages
- `payment-links.ts` — payment links, pairing codes, waitlist
- `rail1.ts` — all privy/x402 wallet, guardrail, transaction, and approval methods
- `rail2.ts` — all crossmint wallet, guardrail, transaction, and approval methods
- `rail4.ts` — rail4 cards, obfuscation events/state, profile allowance, checkout confirmations
- `rail5.ts` — rail5 cards + checkouts
- `owners.ts` — owner profiles (get/upsert)
- `master-guardrails.ts` — master guardrails + cross-rail daily/monthly spend aggregation
- `skills.ts` — skill drafts, evidence, submitter profiles, versioning, exports
- `approvals.ts` — unified approvals
- All consumers import from `@/server/storage` unchanged (the directory's `index.ts` is transparent).
- Methods that use `this.` resolve correctly because all fragments are spread into one object.

**API route paths never change** during modularization — only internal `lib/` imports get rewired. This avoids breaking any external consumers.

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
- **Rail 1 (Stripe Wallet):** Uses Privy server wallets on Base chain, USDC funding via Stripe Crypto Onramp, and x402 payment protocol. **Modularized under `lib/rail1/`:**
  - `client.ts` — Privy client singleton, authorization signature helper, app ID/secret getters.
  - `wallet/create.ts` — `createServerWallet()` via Privy walletsService.
  - `wallet/sign.ts` — `signTypedData()` for x402 EIP-712 signing.
  - `wallet/transfer.ts` — `sendUsdcTransfer()` via Privy RPC with ERC-20 calldata.
  - `wallet/balance.ts` — `getOnChainUsdcBalance()` via viem + Base RPC.
  - `onramp.ts` — `createOnrampSession()` via Stripe Crypto Onramp API.
  - `x402.ts` — x402 typed data builders (`buildTransferWithAuthorizationTypedData`, `buildXPaymentHeader`, `generateNonce`) and USDC format helpers (`formatUsdc`, `usdToMicroUsdc`, `microUsdcToUsd`).
  - Webhook: `STRIPE_WEBHOOK_SECRET_ONRAMP` env var, event type `crypto.onramp_session.updated`. Balance sync endpoint: `POST /api/v1/stripe-wallet/balance/sync` with 30-sec cooldown and `reconciliation` transaction type for discrepancies. Schema includes `last_synced_at` column on `privy_wallets`.
- **Rail 2 (Card Wallet):** Uses CrossMint smart wallets on Base chain, USDC funding via fiat onramp, and Amazon/commerce purchases via Orders API. Employs merchant allow/blocklists. **Modularized under `lib/rail2/`:**
  - `client.ts` — shared CrossMint API client (`crossmintFetch`, `getServerApiKey`, format helpers). Handles both API versions: Wallets API (`2025-06-09`) and Orders API (`2022-06-09`).
  - `wallet/create.ts` — `createSmartWallet()` using `evm-fireblocks-custodial` signer.
  - `wallet/balance.ts` — `getWalletBalance()` with balance parsing for old/new response formats.
  - `wallet/transfer.ts` — `sendUsdcTransfer()` for on-chain USDC transfers.
  - `orders/purchase.ts` — `createPurchaseOrder()`, `getOrderStatus()`, `ShippingAddress` interface.
  - `orders/onramp.ts` — `createOnrampOrder()` for fiat-to-USDC via checkoutcom-flow.
  - On-chain balance sync via reused `getOnChainUsdcBalance` from `lib/rail1/wallet/balance.ts`. Balance sync endpoint: `POST /api/v1/card-wallet/balance/sync` with 30-sec cooldown and `reconciliation` transaction type for discrepancies. Schema includes `last_synced_at` column on `crossmint_wallets`. Frontend ↻ button on Card Wallet dashboard mirrors Rail 1 pattern.
- **Master Guardrails:** Owner-level, cross-rail spending limits stored in a `master_guardrails` table. These guardrails are checked before per-rail guardrails and aggregate spend across all active rails.
- **Rail 4 (Self-Hosted Cards):** Implements the Split-Knowledge card model with obfuscation. **Modularized under `lib/rail4/`:**
  - `obfuscation.ts` — decoy data, fake profile generation, `generateRail4Setup()`, `buildDecoyFileContent()`, types (`FakeProfile`, `Rail4Setup`).
  - `allowance.ts` — spending window helpers: `getWindowStart()`, `getNextWindowStart()` for day/week/month allowance periods.
- **Rail 5 (Sub-Agent Cards):** Encrypted card files + ephemeral sub-agents. Owner encrypts card client-side (AES-256-GCM), CreditClaw stores only the decryption key. At checkout, a disposable sub-agent gets the key, decrypts, pays, and is deleted. **Modularized under `lib/rail5/`:**
  - `index.ts` — core helpers (`generateRail5CardId`, `generateRail5CheckoutId`, `validateKeyMaterial`, `getDailySpendCents`, `getMonthlySpendCents`, `buildSpawnPayload`).
  - DB tables: `rail5_cards`, `rail5_checkouts`. Owner API: `/api/v1/rail5/{initialize,submit-key,cards,deliver-to-bot}`. Bot API: `/api/v1/bot/rail5/{checkout,key,confirm}`. Dashboard: `/app/sub-agent-cards`. Setup wizard: 7-step (Name→HowItWorks→CardDetails→Limits→LinkBot→Encrypt→Success) with Web Crypto encryption. Direct delivery: if an OpenClaw bot is linked before encryption, the encrypted file is relayed directly to the bot via webhook (`rail5.card.delivered`); backup download always happens. Unified `rails.updated` webhook fires across ALL rails on bot link/unlink/freeze/unfreeze/wallet create with `action`, `rail`, `card_id`/`wallet_id`, `bot_id` in payload. Wired up in: Rail 1 (create, freeze), Rail 2 (create, freeze), Rail 4 (link-bot, freeze), Rail 5 (PATCH cards). Success screen shows adaptive copy message with `card_id` and API instructions; includes note that `GET /bot/status` always has latest.

### Inter-Wallet Transfers
CreditClaw supports USDC transfers between wallets across all rails and to external addresses.
- **API Endpoint:** `POST /api/v1/wallet/transfer` (authenticated, owner-only)
- **Transfer Tiers:** Same-rail (Privy→Privy, CrossMint→CrossMint), Cross-rail (Privy↔CrossMint), External (to any 0x address)
- **Guardrail Enforcement:** Transfers are subject to per-wallet guardrails (per-tx limit, daily/monthly budgets) via `evaluateGuardrails`
- **On-chain Execution:** Privy wallets use REST API (`POST /v1/wallets/{id}/rpc` with ERC-20 transfer calldata, gas sponsored); CrossMint wallets use token transfer endpoint (`POST /wallets/{locator}/tokens/base:usdc/transfers`)
- **Atomic DB Updates:** Source debit, destination credit, and transaction ledger entries are wrapped in a single Drizzle `db.transaction()` for consistency
- **Transaction Type:** `"transfer"` with metadata containing `direction` ("inbound"/"outbound"), `transfer_tier`, `counterparty_address`, `counterparty_wallet_id`, `counterparty_rail`, `tx_hash`
- **Frontend:** Transfer button on both Stripe Wallet and Card Wallet pages, dialog with destination picker (own wallets across both rails or external address), amount input in USD
- **Lib Functions:** `sendUsdcTransfer` in `lib/rail1/wallet/transfer.ts` (Privy) and `lib/rail2/wallet/transfer.ts` (CrossMint)

### Transaction Ledger — `balance_after` Column
All transaction tables (`transactions`, `privy_transactions`, `crossmint_transactions`, `rail5_checkouts`) have a nullable `balance_after` column that records the wallet's balance at the time the transaction was created. No calculations — just stores whatever the DB balance is at that moment. For reconciliation, it stores the on-chain balance. For pending x402 payments, it stores the current (unchanged) DB balance. The real balance drop shows when reconciliation runs. All owner-facing and bot-facing transaction list APIs include `balance_after` / `balance_after_display` in responses. Frontend ledger tables show a "Balance" column.

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

### Unified Approval System
All four rails route approval emails through a single system under `lib/approvals/`:
- **Service** (`lib/approvals/service.ts`): `createApproval()` generates HMAC-signed approval links, stores in `unified_approvals` table, sends branded email. `resolveApproval()` verifies HMAC, checks expiry, updates status, dispatches rail-specific callbacks.
- **Email** (`lib/approvals/email.ts`): Single `sendApprovalEmail()` with CreditClaw-branded HTML template, rail badge, and magic-link button.
- **Callbacks** (`lib/approvals/callbacks.ts`): Thin loader that imports the four rail-specific fulfillment modules below.
- **Rail 1 Fulfillment** (`lib/approvals/rail1-fulfillment.ts`): Approval/denial handlers for Privy approvals + self-registers via `registerRailCallbacks("rail1", ...)`.
- **Rail 2 Fulfillment** (`lib/approvals/rail2-fulfillment.ts`): Approval/denial handlers for CrossMint purchases (creates purchase orders, fires webhooks) + self-registers.
- **Rail 4 Fulfillment** (`lib/approvals/rail4-fulfillment.ts`): Approval/denial handlers for self-hosted card checkouts (wallet debit, allowance tracking, obfuscation events) + self-registers.
- **Rail 5 Fulfillment** (`lib/approvals/rail5-fulfillment.ts`): Approval/denial handlers for sub-agent checkouts (status updates, webhook firing) + self-registers.
- **Lifecycle** (`lib/approvals/lifecycle.ts`): TTL constants per rail (Rail 1 polling: 5min, Rail 1 email: 10min, Rails 2/4/5: 15min).
- **Landing Page** (`app/api/v1/approvals/confirm/[approvalId]/route.ts`): GET renders branded approval page with approve/deny buttons; POST processes the decision via `resolveApproval()`. This is the single entry point for email-based approvals across all rails.
- **Dashboard Integration**: Dashboard decide endpoints (`stripe-wallet/approvals/decide`, `card-wallet/approvals/decide`) delegate to `resolveApproval()` when a unified approval exists, with fallback to direct logic for pre-unified approvals. Rail 4 dashboard "Review" button links to unified page via `getUnifiedApprovalByRailRef()` lookup.
- **Storage**: `getUnifiedApprovalByRailRef(rail, railRef)` looks up pending unified approval by rail-specific ID. `closeUnifiedApprovalByRailRef()` for bidirectional sync. `decideUnifiedApproval()` with atomic `WHERE status = 'pending'` guard.
- **DB Table**: `unified_approvals` with columns: id, approvalId, rail, ownerUid, ownerEmail, botName, amountDisplay, amountRaw, merchantName, itemName, hmacToken, status, expiresAt, decidedAt, railRef, metadata, createdAt.
- **Env Vars**: `UNIFIED_APPROVAL_HMAC_SECRET` (falls back to `HMAC_SECRET` or default).
- **Wiring**: Rail 1 sign route, Rail 2 purchase route, Rail 4 checkout route, and Rail 5 checkout route all call `createApproval()` alongside their rail-specific approval records.
- **Removed Legacy**: Old Rail 4 confirm page (`/api/v1/rail4/confirm`), old Rail 5 approve page (`/api/v1/rail5/approve`), dead email functions (`sendCheckoutApprovalEmail`, `sendRail5ApprovalEmail`), and dead Rail 5 HMAC helpers have been removed.

### Shared Wallet/Card UI (`components/wallet/`)
All wallet and card page UI is consolidated into `components/wallet/` to eliminate duplication across Rails 1, 2, 4, and 5. Setup wizards are NOT in this folder — they remain in their original locations.
- **`types.ts`** — Unified types including `NormalizedCard` (common shape both rails map into), plus `normalizeRail4Card()` and `normalizeRail5Card()` converters.
- **`card-visual.tsx`** — Credit card visual (chip, masked card number, expiry, brand). Used by Rails 4 & 5.
- **`crypto-card-visual.tsx`** — Crypto wallet visual (wallet icon + bot name + address with copy, balance + "USDC on Base" with inline sync/basescan/transfer icons, guardrails panel, status badge + three-dot menu). No chip, no card number. Used by Rails 1 & 2.
- **`credit-card-item.tsx`** — **Unified card+action bar component** for all credit card rails. Renders `CardVisual` + identical action bar (Manage, Freeze, Add Agent/Bot badge, More menu) from a `NormalizedCard`.
- **`credit-card-list-page.tsx`** — **Full page shell** used by both Rail 4 and Rail 5. Handles header, add button, setup wizard, explainer, loading/empty states, card grid, freeze/link/unlink dialogs. Pages just pass a config object.
- **`status-badge.tsx`** — Reusable status badge (active/frozen/pending).
- **`wallet-action-bar.tsx`** — Base action bar (accepts action items array, badge, menu); used by crypto pages and `CreditCardItem`.
- **`crypto-wallet-item.tsx`** — **Unified wallet+action bar component** for crypto rails. Wraps `CryptoCardVisual` + `CryptoActionBar`. Card handles inline actions (copy, sync, basescan, transfer) and three-dot menu (add agent, unlink bot). Action bar handles Fund/Pause/Guardrails/Activity.
- **`crypto-action-bar.tsx`** — Crypto wallet action bar (Fund, Pause/Activate, Guardrails, Activity, Bot badge).
- **`hooks/use-wallet-actions.ts`** — Shared freeze, sync balance, copy address, approval decision, sync-and-patch handlers (accepts rail-specific config).
- **`hooks/use-bot-linking.ts`** — Shared link/unlink bot state and handlers. Also used by Rail 2 for bot list in create dialog.
- **`hooks/use-transfer.ts`** — Shared transfer dialog state and handler (Rails 1 & 2).
- **`hooks/use-guardrails.ts`** — Shared guardrail form state, open/save logic. Supports `crypto` variant (direct USD values) and `card` variant (micro-USDC multiplier + procurement controls save).
- **`dialogs/`** — Freeze, link-bot, unlink-bot, transfer, guardrail, create-crypto-wallet dialogs.
- **`index.ts`** — Barrel export for all components, hooks, types, and dialogs.

Rail 4 (`self-hosted/page.tsx`) and Rail 5 (`sub-agent-cards/page.tsx`) are ~43 lines each — pure config objects passed to `CreditCardListPage`. Both rails render identical UI structure, identical action bars, identical dialogs. The only differences are the config: API endpoint, data normalizer, explainer content, and setup wizard component.

Rail 1 (`stripe-wallet/page.tsx`, ~664 lines) and Rail 2 (`card-wallet/page.tsx`, ~742 lines) use shared hooks (`useWalletActions`, `useBotLinking`, `useTransfer`, `useGuardrails`) and shared dialogs (`GuardrailDialog`, `CreateCryptoWalletDialog`, `TransferDialog`, `LinkBotDialog`, `UnlinkBotDialog`). Remaining page-specific code is genuinely rail-specific: Stripe Onramp Sheet (Rail 1), CrossMint checkout + fund dialog (Rail 2), OrderTimeline + order detail dialog (Rail 2), and different tab content layouts.

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

### Agent Management (`lib/agent-management/`)
Bot/agent-facing API infrastructure consolidated into a feature folder:
- `auth.ts` — authenticates bot requests via Bearer API key (prefix lookup + bcrypt verify).
- `crypto.ts` — API key generation, hashing, verification, claim tokens, card IDs, webhook secrets.
- `rate-limit.ts` — token-bucket rate limiter with per-endpoint config (19 endpoints).
- `agent-api/middleware.ts` — `withBotApi()` wrapper: auth → rate limit → handler → access log → webhook retry.
- `agent-api/status-builders.ts` — `buildRail{1,2,4,5}Detail()` functions for `/bot/status` and `/bot/check/*` responses.

### Bot Status & Check API
- **Unified Status:** `GET /api/v1/bot/status` — cross-rail status, balances, master guardrails, default rail.
- **Per-Rail Detail:** `GET /api/v1/bot/check/rail{1,2,4,5}` — deep operational info per rail (guardrails, allowances, approval mode, domain/merchant rules).
- **Preflight:** `POST /api/v1/bot/check/rail4/test` — dry-run validation for Rail 4 purchases (no side effects).
- **Shared builders:** `lib/agent-management/agent-api/status-builders.ts` — reusable functions for building per-rail detail responses.
- **Owner Rail Management:** `GET /api/v1/bots/rails` — owner-facing aggregated rail connections per bot.

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