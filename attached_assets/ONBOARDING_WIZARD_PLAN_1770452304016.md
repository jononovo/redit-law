# Onboarding Wizard — Technical Plan

**For:** The AI agent building this feature  
**Context:** CreditClaw is a Next.js 16 App Router project. Read `replit.md` for full stack details. Auth is Firebase. Payments are Stripe. DB is PostgreSQL via Drizzle ORM. UI is shadcn/ui + Tailwind v4. Font is Plus Jakarta Sans. Design is "fun consumer" with bright pastels (orange/blue/purple), 1rem border radius.

---

## What We're Building

A full-page, slide-by-slide onboarding wizard that walks a bot owner through the entire setup in one sitting. By the end of the wizard, the owner has: configured spending permissions, connected their bot, optionally added a payment method, and optionally funded the wallet. The bot immediately receives its spending.md.

The wizard must support **two entry paths** that converge into the same flow:

**Path A — Owner First:** Owner starts from the landing page or dashboard. They go through spending permissions setup, then get a 6-digit pairing code to give their bot. The bot registers with that code. The wizard detects the pairing and continues.

**Path B — Bot First (existing flow):** Bot has already registered via `POST /bots/register` and given the owner a claim token (word-XXXX format). Owner enters the claim token, then continues through spending permissions, payment method, and funding steps. This path already partially exists via the `/claim` page and `bot-signup.tsx` component.

Both paths end at the same place: bot connected, permissions set, card optional.

---

## The Wizard Steps

### Step 1: Choose Your Path

Full-page screen. Two big cards side by side:

**"My bot already registered"** — Owner has a claim token from their bot. Clicking this shows a text input for the claim token (word-XXXX format). On submit, validate the token via `POST /api/v1/bots/claim`. If valid, store the bot ID in wizard state and advance to Step 3 (spending permissions). The bot is already connected at this point.

**"I want to set up first"** — Owner wants to configure everything before connecting the bot. Clicking this advances to Step 2 (generate pairing code).

Design note: Make these cards large, friendly, with icons. Bot icon (🤖) on the left, User icon (👤) on the right. Simple one-line descriptions beneath each.

### Step 2: Generate Pairing Code (Owner-First Path Only)

Owner sees a generated 6-digit numeric code displayed prominently (large mono font, spaced digits like `4 8 2 7 1 5`). Below the code:

- A simple instruction: "Tell your bot to visit creditclaw.com/skill.md and register using this code."
- A copy button for the code.
- A "Waiting for your bot..." status indicator with a subtle loading animation.

**Backend:** When the owner reaches this step, call `POST /api/v1/onboarding/pairing-code` which generates a 6-digit code, stores it in a new `pairing_codes` table linked to the owner's `uid`, and returns the code. The code expires after 1 hour.

**Polling:** The wizard polls `GET /api/v1/onboarding/pairing-code/{code}/status` every 3 seconds. When a bot registers with this code, the endpoint returns `{ "status": "paired", "bot_id": "bot_xxx", "bot_name": "my-research-bot" }`. The wizard auto-advances to Step 3 with a brief success animation showing the bot's name.

**Skip option:** A small "Skip — I'll connect later" link at the bottom. This advances to Step 3 but marks the wizard state as `bot_pending`. The owner can still set permissions and add a card. The bot gets connected later from the dashboard.

### Step 3: Spending Permissions — Approval Mode

Single question per screen. Large friendly text.

**"How should your bot handle purchases?"**

Three option cards (vertical stack, one selection):

1. **"Ask me every time"** — Bot requests approval before any purchase. (Icon: 🔒)
   - Subtitle: "Most secure. You approve every transaction."
   
2. **"Auto-approve small purchases"** — Bot spends freely below a threshold. (Icon: ⚡)
   - Subtitle: "You only get asked for bigger purchases."
   - Selecting this reveals a slider/input: "Auto-approve purchases under $___" (default: $10, range: $1–$100)

3. **"Auto-approve by category"** — Bot spends freely on approved categories. (Icon: 📋)
   - Subtitle: "You pick what's okay. Everything else needs approval."

Store selection in local wizard state. Advance on click.

### Step 4: Spending Permissions — Spending Limits

**"Set your bot's spending limits"**

Three input fields with sensible defaults and +/- steppers or sliders:

- **Per transaction max:** $25 (range: $5–$500)
- **Daily max:** $50 (range: $10–$1,000)  
- **Monthly max:** $500 (range: $50–$10,000)

Simple visual: a horizontal bar showing how the daily limit relates to the monthly limit.

If they chose "Auto-approve small purchases" in Step 3, also show:
- **Auto-approve up to:** (pre-filled from Step 3 selection)

"Next" button advances.

### Step 5: Spending Permissions — Categories

**"What can your bot spend on?"**

Two sections:

**Approved categories** (checkboxes, default top 3 checked):
- ✅ API services & SaaS
- ✅ Cloud compute & hosting
- ✅ Research & data access
- ☐ Physical goods & shipping
- ☐ Advertising & marketing
- ☐ Entertainment & media
- ☐ Other

**Always blocked** (pre-checked, shown as a separate "safety" section with a shield icon):
- 🚫 Gambling
- 🚫 Adult content
- 🚫 Cryptocurrency
- 🚫 Cash advances

The blocked section should feel definitive — red/muted styling, not easily toggled. If the owner unchecks one, show a confirmation: "Are you sure? This category is blocked by default for safety."

### Step 6: Spending Permissions — Recurring & Notes

**"A couple more things..."**

Toggle: **Allow recurring/subscription charges?** (default: off)
- If on, reveal: "Max per subscription: $___/month" (default: $20)

Text area: **"Any special instructions for your bot?"**
- Placeholder: "e.g., Prefer free tiers before paying. Always check for discount codes. No annual plans without asking me first."
- This maps to the `notes` field in spending_permissions.

### Step 7: Connect Your Bot (if not already connected)

**If Path A (bot already claimed in Step 1):** Skip this step entirely.

**If Path B (owner-first) and bot already paired in Step 2:** Skip this step — show a brief "Your bot is connected!" confirmation and auto-advance.

**If Path B and bot not yet paired (owner clicked "Skip" in Step 2):** Show the pairing code again with the same polling logic. Or show a claim token input as a fallback: "Already have a claim token from your bot? Enter it here."

This step is the safety net. By this point most users will have connected already.

### Step 8: Add Payment Method (Optional)

**"Add a card to fund your bot's wallet"**

Stripe Elements card form (same as existing Setup Intent flow in the dashboard). 

Two clear options:
1. **"Add a card now"** — Shows the Stripe Elements form. On success, saves the PaymentMethod via the existing `POST /api/v1/billing/setup-intent` → `POST /api/v1/billing/payment-method` flow.
2. **"Skip — I'll add a card later"** — Advances to final step. Card can be added from dashboard.

Note below: "Your card details are handled by Stripe. CreditClaw never sees your card number."

### Step 9: Fund the Wallet (Optional, only if card was added)

**"How much should your bot start with?"**

Quick-pick buttons: **$10** / **$25** / **$50** / **$100** / **Custom**

Below: "Or, let your bot request funds when it needs them."

If the owner picks an amount, trigger the existing `POST /api/v1/wallet/fund` flow. Show a success animation when complete.

If skip: advance to final step.

### Step 10: Done

**"Your bot is ready! 🎉"**

Summary card showing:
- Bot name (if connected)
- Approval mode chosen
- Spending limits
- Balance (if funded)
- Status: "Wallet active" or "Waiting for bot to connect"

**"Go to Dashboard"** button → navigates to `/app`

If the bot is connected and the wizard generated spending permissions, the backend should fire the `wallet.activated` webhook to the bot with the new permissions.

---

## Database Changes

### New Table: `pairing_codes`

```
pairing_codes
  id              serial primary key
  code            text unique not null        -- 6-digit numeric string, e.g. "482715"
  owner_uid       text not null               -- Firebase UID of the owner who generated it
  bot_id          integer                     -- FK → bots, null until a bot registers with this code
  status          text default 'pending'      -- 'pending' | 'paired' | 'expired'
  created_at      timestamp default now()
  expires_at      timestamp not null          -- created_at + 1 hour
```

Index on `code` for fast lookup. Index on `owner_uid` for listing owner's codes.

### No changes to existing tables

The `bots`, `wallets`, `spending_permissions`, and `payment_methods` tables already have everything needed. The wizard just populates them in sequence.

---

## API Changes

### New Endpoints

**`POST /api/v1/onboarding/pairing-code`**
- Auth: Firebase session (owner must be logged in)
- Creates a 6-digit pairing code, stores in `pairing_codes` table
- Returns: `{ "code": "482715", "expires_at": "2026-02-07T22:00:00Z" }`
- Rate limit: 5 codes per owner per hour
- Code generation: `Math.floor(100000 + Math.random() * 900000).toString()` — retry on collision

**`GET /api/v1/onboarding/pairing-code/:code/status`**
- Auth: Firebase session (owner must own this code)
- Returns: `{ "status": "pending" }` or `{ "status": "paired", "bot_id": 42, "bot_name": "my-research-bot" }` or `{ "status": "expired" }`
- This is the polling endpoint. Called every 3 seconds by the wizard.

**`POST /api/v1/onboarding/complete`**
- Auth: Firebase session
- Body: The full wizard state — spending permissions, bot_id (if connected), notes
- This is the "commit" endpoint. It:
  1. Creates/updates the `spending_permissions` row for the bot
  2. If bot is connected and wallet exists, fires `wallet.activated` webhook
  3. Returns success

### Modified Endpoints

**`POST /api/v1/bots/register`** — Add optional `pairing_code` field
- If `pairing_code` is provided (and valid + not expired), the bot is immediately linked to the owner who generated the code
- Sets `owner_uid` on the bot, sets `wallet_status` to `active`, creates wallet
- Updates the `pairing_codes` row: `status = 'paired'`, `bot_id = <new bot id>`
- The existing `owner_email` + `claim_token` flow continues to work unchanged
- The bot still gets an API key and claim token in the response (claim token is moot if already paired, but doesn't hurt)

**`POST /api/v1/bots/claim`** — No changes needed
- This already handles Path A (bot-first). The wizard just calls it from Step 1.

### skill.md Update

Add a section to the bot-facing skill.md explaining the pairing code option:

```
### Alternative: Register with a Pairing Code

If your owner gives you a 6-digit pairing code, include it during registration:

curl -X POST https://api.creditclaw.com/v1/bots/register \
  -H "Content-Type: application/json" \
  -d '{
    "bot_name": "my-research-bot",
    "owner_email": "jonathan@example.com",
    "description": "Performs web research tasks",
    "pairing_code": "482715"
  }'

This instantly connects you to your owner. No claim token needed.
Your wallet activates immediately and spending permissions are pre-configured.
```

---

## Frontend Architecture

### Component: `OnboardingWizard`

Location: `components/onboarding/onboarding-wizard.tsx` (client component)

Top-level component that manages:
- `currentStep` (number, 1–10)
- `wizardState` (object holding all collected data)
- `entryPath` ('owner-first' | 'bot-first' | null)
- Navigation (next/back/skip)
- Step indicator (progress dots or numbered steps at top)

Uses React `useState` for all state — no persistent storage needed since the wizard is completed in one sitting. The "commit" happens at the end via `POST /api/v1/onboarding/complete`.

### Step Components

Each step is its own component in `components/onboarding/`:

```
components/onboarding/
  onboarding-wizard.tsx          -- orchestrator
  step-choose-path.tsx           -- Step 1
  step-pairing-code.tsx          -- Step 2
  step-approval-mode.tsx         -- Step 3
  step-spending-limits.tsx       -- Step 4
  step-categories.tsx            -- Step 5
  step-recurring-notes.tsx       -- Step 6
  step-connect-bot.tsx           -- Step 7
  step-payment-method.tsx        -- Step 8
  step-fund-wallet.tsx           -- Step 9
  step-complete.tsx              -- Step 10
```

### Page Route

Location: `app/app/onboarding/page.tsx`

This is a full-page route inside the dashboard layout, but it should **hide the sidebar and header** — the wizard should take up the entire viewport. Use a custom layout or conditionally hide the dashboard chrome.

Alternative: Place at `app/onboarding/page.tsx` outside the dashboard layout entirely. This is cleaner — the wizard is its own experience, not part of the dashboard. It redirects to `/app` on completion.

**Recommendation:** Use `app/onboarding/page.tsx` (outside dashboard layout). Requires Firebase auth but not dashboard chrome.

### Entry Points

1. **Landing page CTA** — "Get Started" button on the hero section → navigates to `/onboarding` (requires login first, redirect back after auth)
2. **Dashboard** — If owner has no bots, show a banner: "Set up your first bot" → links to `/onboarding`
3. **Dashboard "Add Bot" button** — For owners who already have bots and want to add another
4. **Direct URL** — `creditclaw.com/onboarding` (redirect to login if not authenticated)

### Animations & Transitions

Use CSS transitions for step changes — slide left/right or fade. No framer-motion (per project preferences). Keep it lightweight:

```css
.step-enter { opacity: 0; transform: translateX(20px); }
.step-active { opacity: 1; transform: translateX(0); transition: all 0.3s ease; }
.step-exit { opacity: 0; transform: translateX(-20px); }
```

### Design Specifications

- Full viewport height (`min-h-screen`)
- Centered content card (max-width ~600px)
- Progress indicator at top (dots or step numbers, show current position)
- Back arrow in top-left (except Step 1)
- Step title in large bold text (Plus Jakarta Sans, 28–32px)
- One primary action per screen (big button at bottom)
- Skip links in muted text below primary action where applicable
- Use the existing shadcn/ui components: Button, Input, Slider, Checkbox, Textarea, Card
- Color: primary actions in orange (`--primary`), secondary in blue (`--secondary`)
- Border radius: 1rem on all cards and inputs (per project conventions)

---

## State Shape

```typescript
interface WizardState {
  // Path
  entryPath: 'owner-first' | 'bot-first' | null;
  
  // Bot connection
  botId: number | null;
  botName: string | null;
  claimToken: string | null;       // if bot-first
  pairingCode: string | null;      // if owner-first
  botConnected: boolean;
  
  // Spending permissions (Steps 3-6)
  approvalMode: 'ask_for_everything' | 'auto_approve_under_threshold' | 'auto_approve_by_category';
  perTransactionMax: number;        // dollars, converted to cents on submit
  dailyMax: number;
  monthlyMax: number;
  askApprovalAbove: number;
  approvedCategories: string[];
  blockedCategories: string[];
  recurringAllowed: boolean;
  maxPerSubscription: number;
  notes: string;
  
  // Payment (Steps 8-9)
  paymentMethodAdded: boolean;
  fundingAmount: number | null;     // dollars, null if skipped
}
```

---

## Step Skip Logic

The wizard dynamically skips steps based on state:

| Condition | Skip |
|-----------|------|
| Path A (bot-first, claimed in Step 1) | Skip Step 2 and Step 7 |
| Path B (owner-first, bot paired in Step 2) | Skip Step 7 |
| Path B (owner-first, bot NOT paired — skipped Step 2) | Show Step 7 |
| No card added in Step 8 | Skip Step 9 |
| Approval mode is "ask_for_everything" | Step 4 still shown (limits still apply as hard caps) but auto-approve threshold input is hidden |

---

## Interaction with Existing Code

### What's Reused As-Is
- `POST /api/v1/bots/claim` — called in Step 1 Path A
- `POST /api/v1/billing/setup-intent` — called in Step 8
- `POST /api/v1/billing/payment-method` — called in Step 8 after Stripe confirms
- `POST /api/v1/wallet/fund` — called in Step 9
- `spending_permissions` table and `SpendingPermissionsEditor` logic — the wizard produces the same data shape
- `withBotApi` middleware — unchanged, bot endpoints work the same
- All webhook/notification infrastructure — `wallet.activated` fires on completion

### What's New
- `pairing_codes` table + 2 new API endpoints
- `pairing_code` field on `POST /bots/register`
- `POST /api/v1/onboarding/complete` endpoint
- `OnboardingWizard` component + 10 step components
- `/onboarding` page route
- skill.md update with pairing code instructions

### What's Replaced
- The current `/claim` page (`app/app/claim/` or wherever it lives) becomes a redirect to the onboarding wizard with `?path=bot-first`
- The `BotSignup` component on the landing page should update its "Claim Your Bot" tab to link to the onboarding wizard instead of handling claims inline

---

## Edge Cases to Handle

1. **Pairing code collision** — 6 digits = 900,000 possible codes. Low collision risk, but retry on insert conflict.
2. **Pairing code expiry** — If the owner sits on Step 2 for >1 hour, the code expires. The polling endpoint returns `expired`. Show a "Generate new code" button.
3. **Owner refreshes mid-wizard** — State is lost (useState only). This is acceptable — the wizard is short. Don't over-engineer persistence. If needed later, use URL params or sessionStorage.
4. **Owner already has bots** — The wizard should work for adding a second, third bot. No assumption that this is their first.
5. **Bot registers with an expired pairing code** — Return a clear error: `{ "error": "pairing_code_expired", "message": "This code has expired. Ask your owner for a new one." }`
6. **Bot registers with a pairing code that's already been used** — Return: `{ "error": "pairing_code_used", "message": "This code has already been claimed." }`
7. **Owner completes wizard without connecting a bot** — This is allowed. Spending permissions are saved in wizard state but not committed to DB until a bot is linked. The `/app` dashboard shows "No bots connected — finish setup" with a link back.

---

## Testing Checklist

- [ ] Path A: Bot registered first → owner enters claim token → permissions → card → fund → done
- [ ] Path B: Owner starts first → gets pairing code → bot registers with code → auto-advances → permissions → done
- [ ] Path B with skip: Owner generates code → skips → sets permissions → connects bot in Step 7 → done
- [ ] Path B with claim token fallback: Owner skips pairing → enters claim token in Step 7 → done
- [ ] Pairing code expiry: Wait >1 hour → code shows expired → regenerate works
- [ ] Pairing code polling: Bot registers → wizard detects within 3 seconds → shows bot name → advances
- [ ] Skip payment: Owner skips card → skips funding → wizard completes with $0 balance
- [ ] Add payment + fund: Owner adds card → funds $50 → wallet shows $50 → bot can see balance
- [ ] Spending permissions saved correctly: After wizard, `GET /wallet/spending` from bot returns exact values set in wizard
- [ ] Second bot: Owner with existing bot runs wizard again → new bot gets independent permissions
- [ ] Mobile: All steps render correctly on mobile viewport (single column, full width cards)
- [ ] Auth required: Unauthenticated user hitting `/onboarding` gets redirected to login, then back to wizard
