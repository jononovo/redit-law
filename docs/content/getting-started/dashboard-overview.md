# Dashboard Overview

The CreditClaw dashboard is your command center for managing bots, wallets, transactions, and sales. This page gives you a tour of what you'll find in each section.

## Top-Level Stats

When you land on the dashboard at `/app`, you'll see three key metrics at the top:

- **Total Bots** — The number of bots connected to your account
- **Wallet Balance** — Your current wallet balance across active wallets
- **Pending Claims** — Bots that have been registered but not yet claimed

## Sidebar Navigation

The left sidebar organizes the dashboard into three main groups:

### Wallets & Cards

| Section | Description |
|---------|-------------|
| **Overview** | The main dashboard with stats, bot cards, activity, and health |
| **Stripe Wallet** | Manage your USDC wallet for x402 purchases. Fund with Stripe or Link |
| **Shop Wallet** | USDC wallet for shopping at Amazon, Shopify, and other merchants |
| **My Card (Encrypted)** | Self-hosted card setup with encryption and ephemeral sub-agents |
| **My Card (Split-Knowledge)** | Legacy self-hosted card with obfuscation and split-knowledge security |
| **Orders** | Track physical goods orders and shipping status |
| **Transactions** | Unified transaction ledger across all wallets |

### Procurement

| Section | Description |
|---------|-------------|
| **Submit Supplier** | Submit a new vendor to be added to the skills catalog |
| **Skill Builder** | Create and review procurement skills for vendors |
| **Supplier Hub** | Browse the full catalog of available vendor skills |

### Sales

| Section | Description |
|---------|-------------|
| **Create Checkout** | Build checkout pages to accept payments |
| **Shop** | Manage your public storefront |
| **My Sales** | View completed sales and revenue |
| **Invoices** | Create, send, and track invoices |
| **Seller Profile** | Configure your business name, logo, and contact details |

## Bot Cards

On the overview page, each connected bot is displayed as a card showing:

- Bot name and ID
- Wallet status (active, pending, or inactive)
- Quick actions for managing the bot

Click on a bot card to view its details, adjust spending limits, or link/unlink wallets.

## Activity Log

The activity log on the dashboard shows a real-time feed of events across your account — bot connections, wallet funding, purchases, approvals, and more.

## Ops Health

The operations health panel gives you a quick status check on your active systems — wallet connectivity, bot status, and webhook delivery health.

## Payment Links

From the dashboard, you can also view and manage your active payment links — shareable URLs that let anyone pay you directly.

## Settings

Access account settings from the sidebar to configure:

- **Seller Profile** — Business name, logo, and contact email
- **Account Settings** — Display name, notifications, shipping addresses

## Next Steps

- [Onboarding Wizard](/docs/bots/onboarding-wizard) — Set up your first bot
- [Wallet Types](/docs/wallets/wallet-types) — Understand the different wallet options
- [Spending Limits](/docs/guardrails/spending-limits) — Configure your safety controls
