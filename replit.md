# CreditClaw.com

## Overview
CreditClaw is a prepaid credit card platform for AI agents (specifically OpenClaw agents). The project features a consumer-facing landing page and a complete dashboard application for managing virtual cards, viewing transactions, and controlling spending.

**Current State:** Full Next.js 16 application with App Router. Landing page with waitlist, live metrics, features. Dashboard with overview, cards, transactions, and settings pages.

## Recent Changes
- **Feb 2026:** Converted entire Vite/React application to Next.js 16 with App Router
- Created complete dashboard application with Overview, Cards, Transactions, and Settings pages
- Implemented sidebar navigation, header with search, and card management UI
- Migrated all components to Next.js patterns (added "use client", replaced wouter with next/link)
- Set up proper Next.js structure with app directory, fonts via next/font, and Tailwind v4 integration
- Removed all Vite/Express code and dependencies

## User Preferences
- **Design theme:** "Fun Consumer" with bright pastel colors (orange/blue/purple)
- **Font:** Plus Jakarta Sans
- **Border radius:** 1rem rounded corners
- **Framework:** Next.js 16 (NOT React/Vite)
- **No framer-motion** (lightweight build)
- All interactive components marked with "use client" directive

## Project Architecture

### Stack
- **Framework:** Next.js 16 with App Router
- **Styling:** Tailwind CSS v4 with PostCSS
- **UI Components:** shadcn/ui (Radix primitives)
- **Fonts:** Plus Jakarta Sans + JetBrains Mono (via next/font/google)
- **State:** React Query (@tanstack/react-query)

### File Structure
```
app/                    # Next.js App Router
  layout.tsx            # Root layout (fonts, providers, announcement bar)
  page.tsx              # Landing page (/, consumer-facing)
  globals.css           # Global styles, theme variables, animations
  not-found.tsx         # 404 page
  app/                  # Dashboard section
    layout.tsx          # Dashboard layout (sidebar + header)
    page.tsx            # Overview dashboard
    cards/page.tsx      # Card management
    transactions/page.tsx # Transaction history
    settings/page.tsx   # Account settings

components/             # Shared components
  nav.tsx               # Landing page navigation
  hero.tsx              # Hero section with waitlist
  features.tsx          # Feature cards section
  live-metrics.tsx      # Animated counters section
  waitlist-form.tsx     # Footer waitlist form
  transaction-ledger.tsx # Landing page mini transaction list
  query-provider.tsx    # React Query provider (client component)
  ui/                   # shadcn/ui components
  dashboard/            # Dashboard-specific components
    sidebar.tsx         # Left sidebar navigation
    header.tsx          # Top header with search
    card-visual.tsx     # Credit card visual component
    transaction-ledger.tsx # Dashboard transaction table

hooks/                  # Custom React hooks
  use-toast.ts          # Toast notification hook
  use-mobile.tsx        # Mobile breakpoint hook

lib/                    # Utilities
  utils.ts              # cn() helper

public/images/          # Static assets (logos, avatars, card images)

next.config.ts          # Next.js configuration
postcss.config.mjs      # PostCSS with @tailwindcss/postcss
tsconfig.json           # TypeScript configuration
```

### Key Routes
- `/` - Consumer landing page (waitlist, features, metrics)
- `/app` - Dashboard overview (stats, cards, transactions)
- `/app/cards` - Card management (create, freeze, limits)
- `/app/transactions` - Transaction history
- `/app/settings` - Account settings

### Design Tokens (CSS Variables)
- `--primary`: Orange (10 85% 55%)
- `--secondary`: Blue (200 95% 60%)
- `--accent`: Purple (260 90% 65%)
- `--radius`: 1rem
