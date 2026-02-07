# CreditClaw.com

## Overview
CreditClaw is a prepaid virtual credit card platform for AI agents, built for the OpenClaw ecosystem. Bot owners fund wallets with allowances, and their AI agents spend responsibly using virtual Visa/Mastercard cards. Bots register before their humans, receive API keys and claim tokens, then access their wallets after human activation.

The platform has two main surfaces:
- **Consumer landing page** — waitlist, features, live metrics, 3D clay lobster branding
- **Dashboard application** — manage virtual cards, view transactions, control spending

**Current State:** Production Next.js 16 app with App Router, deployed on Replit. Firebase authentication (Google, GitHub, magic link), protected dashboard, and bot-facing skill files.

## Recent Changes
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
    transaction-ledger.tsx # Dashboard transaction table

hooks/                  # Custom React hooks
  use-toast.ts          # Toast notification hook
  use-mobile.tsx        # Mobile breakpoint hook

lib/                    # Utilities and services
  utils.ts              # cn() helper
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
- `/app` — Dashboard overview (stats, cards, transactions)
- `/app/cards` — Card management (create, freeze, limits)
- `/app/transactions` — Transaction history
- `/app/settings` — Account settings

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
