// ============================================================
// OPENCLAW WALLET SYSTEM
// ============================================================
//
// WHAT THIS IS:
// A platform where bot owners fund virtual Visa/Mastercards
// that their AI bots use to spend money autonomously.
// Bots can also generate payment links to get paid by anyone.
//
// STRIPE PRODUCTS USED:
// - Connect (Custom accounts for each bot owner)
// - Financial Accounts (wallet that holds funds)
// - Issuing (virtual cards linked to wallet)
// - Checkout (hosted payment pages for top-ups & bot invoicing)
//
// MONEY FLOW:
//   Payer (credit card)
//     → Stripe Checkout (hosted by Stripe)
//       → OpenClaw Platform Account
//         → Transfer to Owner's Connected Account
//           → Financial Account / Issuing Balance
//             → Bot's virtual card can spend
//
// CRITICAL ELEMENTS:
//
// 1. INTERNAL LEDGER (your DB, not Stripe)
//    - Source of truth for all balances
//    - Every money movement = a ledger row with status tracking
//    - States: PAYMENT_RECEIVED → TRANSFER_INITIATED →
//              TRANSFER_COMPLETE → BALANCE_CREDITED
//    - Daily reconciliation against Stripe balances
//
// 2. IDEMPOTENCY
//    - Every Stripe API call uses an idempotency key
//    - Webhooks can fire multiple times; your handler must
//      deduplicate using the event ID
//
// 3. WEBHOOK RELIABILITY
//    - If webhook fails mid-flow, money sits in platform
//      account and never reaches the bot's wallet
//    - Need: retry logic, dead letter queue, alerting
//
// 4. ACCOUNT LINKAGE (your DB schema)
//    - User → Connected Account → Financial Account
//    - Financial Account → [Bot1 → Card1, Bot2 → Card2, ...]
//    - Checkout Session metadata ties payments to the right bot
//
// ============================================================

const stripe = require('stripe')('sk_live_...');

// ============================================================
// 1. ONBOARD USER (Bot Owner → Connected Account + Wallet)
// ============================================================

async function onboardUser(email) {
  // Create a Stripe Customer (for saving payment methods)
  const customer = await stripe.customers.create({ email });

  // Create Connected Account (for holding funds + issuing cards)
  const account = await stripe.accounts.create({
    country: 'US',
    email,
    capabilities: {
      transfers: { requested: true },
      treasury: { requested: true },
      card_issuing: { requested: true },
    },
    controller: {
      dashboard: { type: 'none' },
      losses: { payments: 'application' },
      fees: { payer: 'application' },
      requirement_collection: 'application',
    },
  });

  const financialAccount = await stripe.treasury.financialAccounts.create(
    {
      supported_currencies: ['usd'],
      features: {
        card_issuing: { requested: true },
        financial_addresses: { aba: { requested: true } },
      },
    },
    { stripeAccount: account.id }
  );

  // STORE IN YOUR DB:
  // users table: { userId, email, stripeCustomerId, stripeAccountId, financialAccountId }
  return { customer, account, financialAccount };
}

// ============================================================
// 2. CREATE BOT + ISSUE VIRTUAL CARD
// ============================================================

async function createBot(stripeAccountId, financialAccountId, botName, billingAddress) {
  const cardholder = await stripe.issuing.cardholders.create(
    {
      name: botName,
      email: 'bots@openclaw.com',
      status: 'active',
      type: 'individual',
      individual: {
        first_name: botName,
        last_name: 'Bot',
        dob: { day: 1, month: 1, year: 2000 },
      },
      billing: { address: billingAddress },
    },
    { stripeAccount: stripeAccountId }
  );

  const card = await stripe.issuing.cards.create(
    {
      cardholder: cardholder.id,
      financial_account: financialAccountId,
      currency: 'usd',
      type: 'virtual',
      status: 'active',
      spending_controls: {
        spending_limits: [
          { amount: 5000, interval: 'per_authorization' },  // $50 per txn
          { amount: 50000, interval: 'monthly' },            // $500/month
        ],
      },
    },
    { stripeAccount: stripeAccountId }
  );

  // Retrieve full card details for the bot
  const details = await stripe.issuing.cards.retrieve(
    card.id,
    { expand: ['number', 'cvc'] },
    { stripeAccount: stripeAccountId }
  );

  // STORE IN YOUR DB:
  // bots table: { botId, userId, stripeCardId, cardholderId, cardLast4 }
  //
  // GIVE TO BOT:
  // details.number, details.exp_month, details.exp_year, details.cvc

  return { cardholder, card, details };
}

// ============================================================
// 3. TOP-UP: Owner or Anyone Pays → Bot's Wallet Gets Funded
// ============================================================
// Bot generates a Stripe Checkout link. Payer clicks it.
// FIRST TIME: they enter card details, card gets saved to their
//             Stripe Customer for future use.
// REPEAT:     saved card is pre-populated, they just hit "Pay".

// 3a. First top-up (or anyone without a saved card)
async function createTopUpLink(botId, amountCents, description, userId, stripeAccountId, stripeCustomerId) {
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,           // links to their saved cards
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: description },
        unit_amount: amountCents,
      },
      quantity: 1,
    }],
    mode: 'payment',
    payment_intent_data: {
      setup_future_usage: 'off_session',  // SAVES THE CARD for next time
    },
    saved_payment_method_options: {
      payment_method_save: 'enabled',     // show "save card" checkbox
    },
    metadata: {
      bot_id: botId,
      user_id: userId,
      stripe_account_id: stripeAccountId,
      purpose: 'bot_topup',
    },
    success_url: 'https://openclaw.com/funded?session={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://openclaw.com/cancelled',
  });

  // session.url → "https://checkout.stripe.com/c/pay/cs_live_..."
  // Bot sends this URL to whoever needs to pay.
  // If they've paid before, their saved card appears pre-filled.
  return session.url;
}

// 3b. Charge saved card directly (no UI, bot-initiated with owner consent)
// Use this when the owner has already saved a card and approves a top-up
// e.g. bot says "I need $20", owner replies "approved"
async function chargeOwnerSavedCard(userId, amountCents, botId) {
  // Look up the customer and their default payment method from your DB
  const user = await db.users.findById(userId);

  const customer = await stripe.customers.retrieve(user.stripeCustomerId);
  const paymentMethodId = customer.invoice_settings.default_payment_method
    || (await stripe.paymentMethods.list({
        customer: user.stripeCustomerId,
        type: 'card',
        limit: 1,
      })).data[0]?.id;

  if (!paymentMethodId) throw new Error('No saved payment method');

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: 'usd',
    customer: user.stripeCustomerId,
    payment_method: paymentMethodId,
    off_session: true,                    // charge without user present
    confirm: true,                        // execute immediately
    metadata: {
      bot_id: botId,
      user_id: userId,
      stripe_account_id: user.stripeAccountId,
      purpose: 'bot_topup',
    },
  }, {
    idempotencyKey: `topup-${botId}-${Date.now()}`,
  });

  return paymentIntent;
}

// ============================================================
// 4. WEBHOOK HANDLER: The critical glue
// ============================================================
// This is where money movement actually happens.
// MUST be idempotent. MUST update your internal ledger.

async function handleWebhook(event) {
  switch (event.type) {

    // --- PAYMENT COMPLETED (someone paid a bot's checkout link) ---
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.metadata.purpose !== 'bot_topup') return;

      // Step 1: Record in YOUR ledger
      const txn = await db.ledger.create({
        eventId: event.id,               // for deduplication
        botId: session.metadata.bot_id,
        userId: session.metadata.user_id,
        amount: session.amount_total,
        status: 'PAYMENT_RECEIVED',
      });

      // Step 2: Transfer funds to the owner's connected account
      const transfer = await stripe.transfers.create({
        amount: session.amount_total,
        currency: 'usd',
        destination: session.metadata.stripe_account_id,
        metadata: { ledger_id: txn.id },
      }, {
        idempotencyKey: `topup-transfer-${event.id}`,
      });

      await db.ledger.update(txn.id, {
        status: 'TRANSFER_INITIATED',
        stripeTransferId: transfer.id,
      });
      break;
    }

    // --- TRANSFER LANDED in connected account ---
    case 'transfer.created': {
      const transfer = event.data.object;
      if (!transfer.metadata.ledger_id) return;

      await db.ledger.update(transfer.metadata.ledger_id, {
        status: 'TRANSFER_COMPLETE',
      });
      // Funds are now in the Financial Account / Issuing balance
      // The bot's card can spend this money
      break;
    }

    // --- BOT TRIES TO SPEND (real-time approval) ---
    case 'issuing_authorization.request': {
      const auth = event.data.object;
      // Your logic: check balance, check bot permissions
      // Approve or decline in real time
      return stripe.issuing.authorizations.approve(auth.id);
    }

    // --- BOT PURCHASE SETTLED ---
    case 'issuing_transaction.created': {
      const txn = event.data.object;
      // Record spend in your ledger
      await db.ledger.create({
        eventId: event.id,
        botId: txn.card,  // map card ID → bot ID via your DB
        amount: -txn.amount,
        status: 'SPEND_SETTLED',
      });
      break;
    }
  }
}

// ============================================================
// 5. BALANCE CHECK (Full)
// ============================================================

async function getBotBalance(stripeAccountId, financialAccountId) {
  const fa = await stripe.treasury.financialAccounts.retrieve(
    financialAccountId,
    { stripeAccount: stripeAccountId }
  );
  return fa.balance; // { cash: { usd: 25000 } } → $250.00
}

// ============================================================
// 5b. HEARTBEAT CHECK (Lightweight polling endpoint)
// ============================================================
// Bots call GET /wallet/check every ~30 min. Returns only essentials.
// Much cheaper than the full /wallet endpoint.

async function walletCheck(botId) {
  const bot = await db.bots.findById(botId);

  if (bot.walletStatus === 'pending') {
    return {
      wallet_status: 'pending',
      balance_usd: 0,
      card_status: 'none',
      spending_limits: null,
      pending_topups: 0,
    };
  }

  const fa = await stripe.treasury.financialAccounts.retrieve(
    bot.financialAccountId,
    { stripeAccount: bot.stripeAccountId }
  );

  const balanceUsd = (fa.balance.cash.usd || 0) / 100;
  const pendingTopups = await db.ledger.count({
    botId,
    type: 'TOPUP',
    status: 'PAYMENT_RECEIVED',
  });

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthlySpent = await db.ledger.sumAbsolute({
    botId,
    type: 'SPEND',
    since: monthStart,
  });

  return {
    wallet_status: balanceUsd > 0 ? 'active' : 'empty',
    balance_usd: balanceUsd,
    card_status: bot.cardStatus,
    spending_limits: {
      per_transaction_usd: bot.spendingLimitPerTxn / 100,
      monthly_usd: bot.spendingLimitMonthly / 100,
      monthly_spent_usd: monthlySpent / 100,
      monthly_remaining_usd: (bot.spendingLimitMonthly - monthlySpent) / 100,
    },
    pending_topups: pendingTopups,
  };
}

// ============================================================
// 5c. SPENDING PERMISSIONS (Bot checks before every purchase)
// ============================================================
// Owner configures spending.md from the dashboard.
// Bot fetches structured version via GET /wallet/spending.
// Bot must follow these rules before using its card.

async function getSpendingPermissions(botId) {
  const bot = await db.bots.findById(botId);
  const permissions = await db.spendingPermissions.findByBotId(botId);

  // If owner hasn't customized yet, return conservative defaults
  if (!permissions) {
    return {
      approval_mode: 'ask_for_everything',
      limits: {
        per_transaction_usd: 25.00,
        daily_usd: 50.00,
        monthly_usd: 500.00,
        ask_approval_above_usd: 10.00,
      },
      approved_categories: ['api_services', 'cloud_compute', 'research_data'],
      blocked_categories: ['gambling', 'adult_content', 'cryptocurrency', 'cash_advances'],
      recurring_allowed: false,
      notes: '',
      updated_at: bot.createdAt,
    };
  }

  return {
    approval_mode: permissions.approvalMode,
    limits: {
      per_transaction_usd: permissions.perTransactionMax / 100,
      daily_usd: permissions.dailyMax / 100,
      monthly_usd: permissions.monthlyMax / 100,
      ask_approval_above_usd: permissions.askApprovalAbove / 100,
    },
    approved_categories: permissions.approvedCategories,   // string[]
    blocked_categories: permissions.blockedCategories,     // string[]
    recurring_allowed: permissions.recurringAllowed,
    notes: permissions.notes,                              // freeform text from owner
    updated_at: permissions.updatedAt,
  };
}

// Called when the bot is about to make a purchase.
// Returns { allowed, reason } — bot must respect this.
function evaluateSpend(permissions, amount, merchantCategory, isRecurring) {
  const { limits, approval_mode, approved_categories, blocked_categories } = permissions;

  // Hard blocks — always rejected, also enforced at Stripe card level
  if (blocked_categories.includes(merchantCategory)) {
    return { allowed: false, reason: `Category "${merchantCategory}" is blocked by your owner.` };
  }

  // Recurring check
  if (isRecurring && !permissions.recurring_allowed) {
    return { allowed: false, reason: 'Recurring payments are not allowed. Ask your owner.' };
  }

  // Limit checks
  if (amount > limits.per_transaction_usd) {
    return { allowed: false, reason: `Exceeds per-transaction limit of ${limits.per_transaction_usd}.` };
  }

  // Approval mode logic
  if (approval_mode === 'ask_for_everything') {
    return { allowed: false, reason: 'Owner requires approval for all purchases.' };
  }

  if (approval_mode === 'auto_approve_under_threshold') {
    if (amount > limits.ask_approval_above_usd) {
      return { allowed: false, reason: `Amount exceeds auto-approve threshold of ${limits.ask_approval_above_usd}. Ask your owner.` };
    }
    return { allowed: true, reason: 'Auto-approved: under threshold.' };
  }

  if (approval_mode === 'auto_approve_by_category') {
    if (amount > limits.ask_approval_above_usd) {
      return { allowed: false, reason: `Amount exceeds auto-approve threshold. Ask your owner.` };
    }
    if (approved_categories.includes(merchantCategory)) {
      return { allowed: true, reason: `Auto-approved: "${merchantCategory}" is an approved category.` };
    }
    return { allowed: false, reason: `Category "${merchantCategory}" requires owner approval.` };
  }

  return { allowed: false, reason: 'Unknown approval mode.' };
}

// ============================================================
// DB SCHEMA (minimum viable)
// ============================================================
//
// users
//   id
//   email
//   stripe_customer_id       (for saved payment methods)
//   stripe_account_id        (Connected Account)
//   financial_account_id     (their wallet)
//   default_payment_method   (cached from Stripe)
//
// bots
//   id
//   user_id                  (FK → users, nullable until claimed)
//   name
//   description
//   owner_email              (provided at registration)
//   api_key                  (cck_live_... unique, non-retrievable)
//   claim_token              (e.g. "coral-X9K2", nullified after claim)
//   wallet_status            (pending | active | suspended | empty)
//   stripe_cardholder_id
//   stripe_card_id
//   card_last4
//   card_status              (none | active | frozen | cancelled)
//   spending_limit_per_txn
//   spending_limit_monthly
//   claimed_at               (timestamp, nullable)
//   created_at
//
// spending_permissions
//   id
//   bot_id                   (FK → bots)
//   approval_mode            (ask_for_everything | auto_approve_under_threshold | auto_approve_by_category)
//   per_transaction_max      (cents)
//   daily_max                (cents)
//   monthly_max              (cents)
//   ask_approval_above       (cents)
//   approved_categories      (text[] e.g. ['api_services','cloud_compute'])
//   blocked_categories       (text[] e.g. ['gambling','adult_content'])
//   recurring_allowed        (boolean, default false)
//   notes                    (text, freeform owner instructions)
//   updated_at
//
// ledger
//   id
//   event_id                 (Stripe event ID, for deduplication)
//   bot_id                   (FK → bots)
//   user_id                  (FK → users)
//   type                     (TOPUP | SPEND | REFUND)
//   amount                   (positive = credit, negative = debit)
//   status                   (PAYMENT_RECEIVED | TRANSFER_INITIATED |
//                             TRANSFER_COMPLETE | BALANCE_CREDITED |
//                             SPEND_SETTLED | FAILED)
//   stripe_transfer_id
//   stripe_checkout_session_id
//   created_at
//   updated_at
//
// RECONCILIATION:
//   Daily cron job pulls Stripe balances + transactions
//   Compares against SUM(ledger.amount) per user/bot
//   Alerts on any mismatch > $0.01
