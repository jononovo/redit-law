# CreditClaw.com

## Overview
CreditClaw is a prepaid virtual credit card platform for AI agents, built for the OpenClaw ecosystem. Bot owners fund wallets with allowances, and their AI agents spend responsibly using virtual Visa/Mastercard cards. Bots register before their humans, receive API keys and claim tokens, then access their wallets after human activation.

The platform has two main surfaces:
- **Consumer landing page** — waitlist, features, live metrics, 3D clay lobster branding
- **Dashboard application** — manage virtual cards, view transactions, control spending

**Current State:** Production Next.js 16 app with App Router, deployed on Replit. Firebase authentication (Google, GitHub, magic link), protected dashboard, bot-facing skill files, live bot registration API, and owner claim flow.

## Recent Changes
- **Feb 7, 2026:** Phase 2 — Owner Claim Flow built. `/claim` page with token input, auth gate, and success state. `POST /api/v1/bots/claim` links bot to Firebase UID, activates wallet, nullifies claim token. `GET /api/v1/bots/mine` returns authenticated user's bots. Dashboard overview now shows real bot data (total, active, pending counts + bot cards). AuthDrawer refactored to support controlled mode.
- **Feb 7, 2026:** Phase 1 — Bot Registration API built. `POST /api/v1/bots/register` accepts bot name, owner email, description. Returns API key (bcrypt-hashed in DB), claim token, and verification URL. Sends owner notification email via SendGrid. PostgreSQL database with Drizzle ORM. Rate limiting (3 registrations/hour/IP).
- **Feb 2026:** Moved OG/social images to dedicated `public/og/` folder, archived pink variants in `public/og/og-pink/`
- **Feb 2026:** Set favicon to golden claw chip logo (`logo-claw-chip.png`)
- **Feb 2026:** Generated black card OG images matching landing page style
- **Feb 2026:** Fixed deployment config — changed run command from old Express (`node ./dist/index.cjs`) to Next.js (`npm run start`)
- **Feb 2026:** Implemented Firebase authentication with server-side session cookies
- **Feb 2026:** Converted from Vite/React to Next.js 16 with App Router
- **Feb 2026:** Created dashboard (Overview, Cards, Transactions, Settings)
- **Feb 2026:** Added bot-facing docs: skill.md, heartbeat.md, spending.md

## User Preferences
- **Design theme:** "Fun Consumer" — 3D clay/claymation aesthetic, coral lobster mascot, bright pastels (orange/blue/purple)
- **Font:** Plus Jakarta Sans
- **Border radius:** 1rem rounded corners
- **Framework:** Next.js 16 with App Router only
- **No framer-motion** (lightweight build)
- **No Vite, no standalone React** — everything runs through Next.js
- All interactive components marked with `"use client"` directive

## Project Architecture

### Stack
- **Framework:** Next.js 16 with App Router
- **Auth:** Firebase Auth (client SDK) + Firebase Admin SDK (server) + httpOnly session cookies (5-day expiry)
- **Database:** PostgreSQL (Replit built-in) + Drizzle ORM
- **Email:** SendGrid (@sendgrid/mail)
- **Styling:** Tailwind CSS v4 with PostCSS
- **UI Components:** shadcn/ui (Radix primitives)
- **Fonts:** Plus Jakarta Sans + JetBrains Mono (via next/font/google)
- **State:** React Query (@tanstack/react-query)
- **Deployment:** Replit (build: `npm run build`, run: `npm run start`)

### File Structure
```
app/                    # Next.js App Router
  layout.tsx            # Root layout (fonts, providers, metadata/OG tags)
  providers.tsx         # Client providers wrapper (Auth, Query, Tooltip, Toaster)
  page.tsx              # Landing page (/, consumer-facing)
  globals.css           # Global styles, theme variables, animations
  not-found.tsx         # 404 page
  api/auth/session/     # Auth API route (POST create, GET check, DELETE destroy)
    route.ts
  api/v1/bots/register/ # Bot registration API (POST)
    route.ts
  api/v1/bots/claim/    # Owner claim API (POST, authenticated)
    route.ts
  api/v1/bots/mine/     # Get user's bots (GET, authenticated)
    route.ts
  claim/                # Claim page (enter token, link bot to account)
    page.tsx
  app/                  # Dashboard section (protected by auth)
    layout.tsx          # Dashboard layout (sidebar + header + auth guard)
    page.tsx            # Overview dashboard
    cards/page.tsx      # Card management
    transactions/page.tsx # Transaction history
    settings/page.tsx   # Account settings

components/             # Shared components
  nav.tsx               # Landing page navigation (auth-aware)
  auth-drawer.tsx       # Sign-in drawer (Google, GitHub, magic link)
  hero.tsx              # Hero section with waitlist
  features.tsx          # Feature cards section
  live-metrics.tsx      # Animated counters section
  waitlist-form.tsx     # Footer waitlist form
  transaction-ledger.tsx # Landing page mini transaction list
  query-provider.tsx    # React Query provider (client component)
  ui/                   # shadcn/ui components
  dashboard/            # Dashboard-specific components
    sidebar.tsx         # Left sidebar navigation (auth-aware, logout)
    header.tsx          # Top header with search (shows user info)
    card-visual.tsx     # Credit card visual component
    bot-card.tsx        # Bot card component (name, status, dates)
    transaction-ledger.tsx # Dashboard transaction table

shared/                 # Shared types and schemas
  schema.ts             # Drizzle ORM schema (bots table) + Zod validation schemas

server/                 # Server-side data layer
  db.ts                 # Drizzle database connection (PostgreSQL)
  storage.ts            # IStorage interface + DatabaseStorage implementation

hooks/                  # Custom React hooks
  use-toast.ts          # Toast notification hook
  use-mobile.tsx        # Mobile breakpoint hook

lib/                    # Utilities and services
  utils.ts              # cn() helper
  crypto.ts             # API key generation, claim token generation, bcrypt hashing
  email.ts              # SendGrid email helper (owner notification on bot registration)
  firebase/client.ts    # Firebase client SDK init (public env vars)
  firebase/admin.ts     # Firebase Admin SDK init (private env vars, server-only)
  auth/auth-context.tsx # AuthProvider + useAuth() hook
  auth/session.ts       # Server-side session cookie helpers

public/og/              # Social sharing images (OG, Twitter, square)
  og-pink/              # Archived pink card variants
public/images/          # Static assets (logos, avatars, card images)
public/skill.md         # Bot-facing API skill file
public/heartbeat.md     # Bot polling routine
public/spending.md      # Default spending permissions template

docs/                   # Internal documentation
  brand.md              # Brand identity guidelines
  creditclaw-internal-context.md  # Full developer context (ecosystem, architecture, schema)

next.config.ts          # Next.js configuration
postcss.config.mjs      # PostCSS with @tailwindcss/postcss
tsconfig.json           # TypeScript configuration
```

### Key Routes
- `/` — Consumer landing page (waitlist, features, metrics)
- `/claim` — Claim page (enter token to link bot to account, requires auth)
- `/app` — Dashboard overview (real bot stats + bot cards from DB)
- `/app/cards` — Card management (create, freeze, limits)
- `/app/transactions` — Transaction history
- `/app/settings` — Account settings

### API Endpoints
- `POST /api/v1/bots/register` — Bot registration (public). Returns API key, claim token, verification URL. Sends owner email via SendGrid.
- `POST /api/v1/bots/claim` — Owner claims bot (authenticated). Accepts claim_token, links bot to Firebase UID, activates wallet.
- `GET /api/v1/bots/mine` — Get authenticated user's bots. Returns array of bot objects.

### Database Schema
- **bots** — Registered bots (bot_id, name, owner_email, owner_uid, api_key_hash, claim_token, wallet_status, claimed_at, etc.)

### Environment Variables (Secrets)
- `SENDGRID_API_KEY` — SendGrid API key for transactional emails
- `SENDGRID_FROM_EMAIL` — Verified sender email address (defaults to noreply@creditclaw.com)

### Design Tokens (CSS Variables)
- `--primary`: Orange (10 85% 55%)
- `--secondary`: Blue (200 95% 60%)
- `--accent`: Purple (260 90% 65%)
- `--radius`: 1rem

### Key Concepts
- **Prepaid model** — not a credit line; wallets are funded by humans with allowances
- **Bot-registers-first** — bots get API keys and claim tokens before human activation
- **REST API only** — no SDK, bots interact via standard HTTP
- **Spending permissions** — humans set allowances via checkbox format in spending.md that bots can parse
- **Heartbeat polling** — bots check balance/spending every 30 minutes via heartbeat.md routine
