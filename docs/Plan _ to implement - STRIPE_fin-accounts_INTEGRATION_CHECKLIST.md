# Stripe Connect + Issuing + Treasury Integration Checklist

**When:** After Stripe approves CreditClaw for Connect, Issuing, and Treasury (Financial Accounts).  
**What changes:** The internal ledger becomes backed by real Stripe money movement. Bots get real virtual Visa cards.  
**Risk level:** High — real money, real cards, real liability.

---

## 1. Owner Onboarding → Connected Account + Financial Account

**Currently:** Owner signs up via Firebase, gets a Stripe Customer for saved payment methods.  
**After:** Owner also gets a Connected Account and a Financial Account (wallet).

### Tasks

- [ ] On owner claim, create a Stripe Connected Account (`stripe.accounts.create`) with capabilities: `transfers`, `treasury`, `card_issuing`
- [ ] Use `controller.dashboard.type: 'none'` — owners manage everything through CreditClaw, not Stripe's dashboard
- [ ] Set `controller.losses.payments: 'application'` and `controller.fees.payer: 'application'` — CreditClaw absorbs losses and fees
- [ ] Create a Financial Account (`stripe.treasury.financialAccounts.create`) on the Connected Account with `card_issuing` and `financial_addresses.aba` features
- [ ] Add columns to DB: `stripe_account_id`, `financial_account_id` on users/owners table
- [ ] Handle capability verification requirements — Stripe may require KYC info from owners before activating capabilities

### Watch out for

- Connected Account capabilities take time to activate. Don't assume immediate availability.
- Financial Accounts require the Connected Account's `treasury` capability to be active first.
- The owner's existing Stripe Customer (for saved payment methods) is separate from their Connected Account. Both are needed.

---

## 2. Bot Claim → Cardholder + Virtual Card Issuance

**Currently:** Bot claim sets `wallet_status: active` and wallet gets an internal balance.  
**After:** Bot claim also creates an Issuing Cardholder and a virtual card on the owner's Connected Account.

### Tasks

- [ ] On claim, create an Issuing Cardholder (`stripe.issuing.cardholders.create`) on the owner's Connected Account
- [ ] Cardholder type: `individual`, name: bot name, billing address: owner's or platform default
- [ ] Create virtual card (`stripe.issuing.cards.create`) linked to the Financial Account
- [ ] Set Stripe-level `spending_controls.spending_limits` from the bot's spending permissions (per-authorization + monthly)
- [ ] Set Stripe-level `spending_controls.blocked_categories` from the bot's blocked categories list (defense in depth — enforced at both CreditClaw and Stripe level)
- [ ] Retrieve full card details (`expand: ['number', 'cvc']`) and store `stripe_card_id`, `stripe_cardholder_id`, `card_last4` in bots table
- [ ] Update `GET /wallet/card` to return real card details instead of placeholder data
- [ ] Card status should be `active` only after Financial Account has funds

### Watch out for

- Cardholder billing address is required. Decide: use owner's address or a platform address.
- Card details (PAN, CVV) should never be logged. The existing rate limiting on `/wallet/card` is critical here.
- If the owner's Financial Account has $0, the card exists but every authorization will be declined by Stripe anyway.

---

## 3. Top-Up Flow → Real Money Movement

**Currently:** `POST /api/v1/wallet/fund` charges the owner's saved card via PaymentIntent and credits the internal ledger.  
**After:** Payment still hits CreditClaw's platform account first, then gets transferred to the owner's Connected Account → Financial Account.

### Tasks

- [ ] After successful PaymentIntent, initiate a Transfer (`stripe.transfers.create`) to the owner's Connected Account with idempotency key `topup-transfer-${event.id}`
- [ ] Store `stripe_transfer_id` in the ledger/transactions table
- [ ] Implement ledger state machine: `PAYMENT_RECEIVED` → `TRANSFER_INITIATED` → `TRANSFER_COMPLETE` → `BALANCE_CREDITED`
- [ ] Handle `transfer.created` webhook to confirm funds landed
- [ ] Only update internal `balance_cents` after transfer is confirmed (not on PaymentIntent success)
- [ ] Update Stripe Checkout sessions (for top-up requests) to include `metadata.stripe_account_id` for the webhook handler

### Watch out for

- There's a delay between payment and transfer completion. The bot's balance won't update instantly anymore.
- If the transfer fails, money sits in the platform account. Need alerting for stuck transfers.
- The internal ledger balance and the Financial Account balance can drift. Reconciliation becomes critical.

---

## 4. Payment Links → Real Money Movement

**Currently:** `checkout.session.completed` webhook directly credits the bot's internal wallet balance.  
**After:** Same webhook, but now it also initiates a transfer to the owner's Connected Account.

### Tasks

- [ ] Extend the existing `checkout.session.completed` handler: after recording `PAYMENT_RECEIVED`, create a Transfer to the owner's Connected Account
- [ ] Add `stripe_account_id` to payment link metadata (so the webhook handler knows where to transfer)
- [ ] Follow the same ledger state machine as top-ups
- [ ] Don't credit internal balance until transfer is confirmed

### Watch out for

- This is the same handler as top-ups. Use `metadata.purpose` to distinguish `bot_topup` vs `payment_link`.
- The bot sees a delay between "client paid" and "balance available." Webhook to the bot (`wallet.payment.received`) should fire after transfer confirmation, not after checkout completion.

---

## 5. Bot Spending → Real Issuing Authorizations

**Currently:** `POST /wallet/purchase` validates spending rules server-side and debits the internal ledger. No real card transaction.  
**After:** Bot uses real card details at a merchant. Stripe fires `issuing_authorization.request` in real-time. CreditClaw approves or declines.

### Tasks

- [ ] Implement `issuing_authorization.request` webhook handler — this is a synchronous webhook, must respond within 2 seconds
- [ ] In the handler: look up bot by `card_id`, load spending permissions, run `evaluateSpend()` logic
- [ ] Call `stripe.issuing.authorizations.approve(auth.id)` or `.decline(auth.id)` based on evaluation
- [ ] Implement `issuing_transaction.created` webhook handler for settled transactions — record as `SPEND_SETTLED` in ledger
- [ ] Debit internal `balance_cents` on authorization approval (not on settlement — settlement can take days)
- [ ] Fire `wallet.spend.authorized` / `wallet.spend.declined` webhooks to bot after decision
- [ ] Fire owner notification on spend (if enabled in notification preferences)
- [ ] Handle `issuing_authorization.updated` for partial reversals and merchant adjustments

### Watch out for

- **2-second timeout is non-negotiable.** If CreditClaw doesn't respond in time, Stripe uses the default (which you configure as approve or decline). Set default to decline.
- The existing `POST /wallet/purchase` endpoint becomes redundant for real card spending but should remain as a "dry run" or for the purchase-intent pre-flight pattern from skill_v2.
- Authorization hold amount may differ from final settlement amount. Handle the delta.
- Refunds come as `issuing_transaction.created` with negative amounts. Credit the wallet back.

---

## 6. Webhook Handler Refactor

**Currently:** One handler for `checkout.session.completed` (payment links). Top-ups bypass webhooks entirely (direct PaymentIntent → ledger credit).  
**After:** Central webhook endpoint handling 4+ event types with the full ledger state machine.

### Tasks

- [ ] Create or update `POST /api/v1/stripe/webhooks` as the single Stripe webhook endpoint
- [ ] Register this endpoint in Stripe Dashboard for events: `checkout.session.completed`, `transfer.created`, `issuing_authorization.request`, `issuing_transaction.created`
- [ ] Verify all incoming webhooks with `stripe.webhooks.constructEvent()` using the webhook signing secret
- [ ] Deduplicate all events using `event.id` — check ledger for existing `event_id` before processing
- [ ] Route by `event.type` in a switch statement (per the architecture doc pattern)
- [ ] All Stripe API calls inside handlers must use idempotency keys
- [ ] Add dead letter queue / alerting for failed webhook processing (stuck in `TRANSFER_INITIATED` for >5 minutes = alert)

### Event routing summary

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Record payment → initiate transfer to Connected Account |
| `transfer.created` | Mark transfer complete → credit internal balance |
| `issuing_authorization.request` | Evaluate spending rules → approve or decline (2s timeout) |
| `issuing_transaction.created` | Record settled spend or refund in ledger |

---

## 7. Reconciliation Upgrade

**Currently:** Compares `balance_cents` against sum of internal transactions. Catches internal ledger drift.  
**After:** Also reconciles against Stripe Financial Account balances.

### Tasks

- [ ] Extend reconciliation to call `stripe.treasury.financialAccounts.retrieve()` for each owner's Financial Account
- [ ] Compare: internal ledger balance vs Financial Account `balance.cash.usd`
- [ ] Flag mismatches > $0.01 and log to `reconciliation_logs`
- [ ] Add reconciliation for stuck ledger entries: any row in `TRANSFER_INITIATED` for >15 minutes should trigger a retry or alert
- [ ] Run reconciliation daily (cron or manual trigger, already have the endpoint)

---

## 8. Spending Permissions → Stripe Card Controls Sync

**Currently:** Spending permissions are enforced only at the CreditClaw API level.  
**After:** Also enforced at the Stripe card level (defense in depth).

### Tasks

- [ ] When owner updates spending permissions on dashboard, also update the card's `spending_controls` via `stripe.issuing.cards.update()`
- [ ] Sync `blocked_categories` → Stripe `spending_controls.blocked_categories` (map CreditClaw categories to Stripe MCC categories)
- [ ] Sync `per_transaction_max` → Stripe `spending_limits[].amount` with `interval: 'per_authorization'`
- [ ] Sync `monthly_max` → Stripe `spending_limits[].amount` with `interval: 'monthly'`
- [ ] Card freeze/unfreeze from dashboard → `stripe.issuing.cards.update({ status: 'inactive' / 'active' })`

### Watch out for

- Stripe MCC categories don't map 1:1 to CreditClaw's custom categories. Need a mapping table.
- Stripe enforces limits in cents. Make sure the conversion is consistent.
- If the Stripe update fails, the card's controls are stale. Log the failure and retry.

---

## 9. Database Schema Changes

New columns needed across existing tables:

| Table | Column | Type | Purpose |
|-------|--------|------|---------|
| users/owners | `stripe_account_id` | text | Connected Account ID |
| users/owners | `financial_account_id` | text | Financial Account ID |
| bots | `stripe_cardholder_id` | text | Issuing Cardholder ID |
| bots | `stripe_card_id` | text | Issued virtual card ID |
| bots | `card_last4` | text | For display |
| bots | `card_status` | text | `none` / `active` / `frozen` / `cancelled` |
| transactions/ledger | `stripe_event_id` | text | For webhook deduplication |
| transactions/ledger | `stripe_transfer_id` | text | Transfer tracking |
| transactions/ledger | `ledger_status` | text | State machine status |

New table:

| Table | Purpose |
|-------|---------|
| `mcc_category_map` | Maps CreditClaw categories → Stripe MCC codes |

---

## 10. Environment Variables

New secrets needed:

| Variable | Purpose |
|----------|---------|
| `STRIPE_WEBHOOK_SECRET` | For verifying incoming Stripe webhook signatures |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Separate secret if using Connect webhooks |

---

## 11. Migration Strategy

This is not a flag-flip. Roll out incrementally:

1. **Schema migration first** — add all new columns as nullable, no breaking changes
2. **Connect onboarding** — new owners get Connected Accounts on claim. Existing owners get backfilled.
3. **Card issuance** — new bots get real cards on claim. Existing bots get cards issued via migration script.
4. **Top-up flow** — switch from direct ledger credit to transfer-based flow. Keep internal balance as source of truth until confident.
5. **Payment links** — extend webhook handler with transfer step.
6. **Issuing authorizations** — wire up `issuing_authorization.request`. This is the big one. Test extensively in Stripe test mode first.
7. **Deprecate `POST /wallet/purchase`** — once bots are using real cards, this endpoint becomes the pre-flight check only (purchase intent pattern from skill_v2).
8. **Reconciliation** — turn on Stripe balance reconciliation after all flows are live.

---

## 12. Testing Checklist (Stripe Test Mode)

- [ ] Create test Connected Account and verify capability activation
- [ ] Create test Financial Account and verify `card_issuing` feature
- [ ] Fund Financial Account via test transfer
- [ ] Issue test virtual card and retrieve full details
- [ ] Simulate authorization via Stripe test helpers
- [ ] Verify `issuing_authorization.request` handler responds < 2s
- [ ] Verify declined authorization for blocked category
- [ ] Verify declined authorization for exceeded limit
- [ ] Simulate checkout completion and verify transfer chain
- [ ] Verify reconciliation catches intentional mismatch
- [ ] Verify idempotency: replay same webhook event, confirm no double-credit
- [ ] Verify stuck transfer alerting (simulate failed transfer)
- [ ] End-to-end: register bot → claim → fund → spend → verify all ledger states
