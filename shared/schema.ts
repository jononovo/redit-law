import { pgTable, serial, text, timestamp, integer, boolean, index, bigint, jsonb } from "drizzle-orm/pg-core";
import { z } from "zod";

export const bots = pgTable("bots", {
  id: serial("id").primaryKey(),
  botId: text("bot_id").notNull().unique(),
  botName: text("bot_name").notNull(),
  description: text("description"),
  ownerEmail: text("owner_email").notNull(),
  ownerUid: text("owner_uid"),
  apiKeyHash: text("api_key_hash").notNull(),
  apiKeyPrefix: text("api_key_prefix").notNull(),
  claimToken: text("claim_token").unique(),
  walletStatus: text("wallet_status").notNull().default("pending"),
  callbackUrl: text("callback_url"),
  webhookSecret: text("webhook_secret"),
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const wallets = pgTable("wallets", {
  id: serial("id").primaryKey(),
  botId: text("bot_id").notNull().unique(),
  ownerUid: text("owner_uid").notNull(),
  balanceCents: integer("balance_cents").notNull().default(0),
  currency: text("currency").notNull().default("usd"),
  isFrozen: boolean("is_frozen").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").notNull(),
  type: text("type").notNull(),
  amountCents: integer("amount_cents").notNull(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const paymentMethods = pgTable("payment_methods", {
  id: serial("id").primaryKey(),
  ownerUid: text("owner_uid").notNull(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  stripePmId: text("stripe_pm_id").notNull().unique(),
  cardLast4: text("card_last4"),
  cardBrand: text("card_brand"),
  isDefault: boolean("is_default").notNull().default(false),
  label: text("label"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const spendingPermissions = pgTable("spending_permissions", {
  id: serial("id").primaryKey(),
  botId: text("bot_id").notNull().unique(),
  approvalMode: text("approval_mode").notNull().default("ask_for_everything"),
  perTransactionCents: integer("per_transaction_cents").notNull().default(2500),
  dailyCents: integer("daily_cents").notNull().default(5000),
  monthlyCents: integer("monthly_cents").notNull().default(50000),
  askApprovalAboveCents: integer("ask_approval_above_cents").notNull().default(1000),
  approvedCategories: text("approved_categories").array().notNull().default([]),
  blockedCategories: text("blocked_categories").array().notNull().default([]),
  recurringAllowed: boolean("recurring_allowed").notNull().default(false),
  notes: text("notes"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const topupRequests = pgTable("topup_requests", {
  id: serial("id").primaryKey(),
  botId: text("bot_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  reason: text("reason"),
  status: text("status").notNull().default("sent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const apiAccessLogs = pgTable("api_access_logs", {
  id: serial("id").primaryKey(),
  botId: text("bot_id").notNull(),
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull(),
  statusCode: integer("status_code").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  responseTimeMs: integer("response_time_ms"),
  errorCode: text("error_code"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: serial("id").primaryKey(),
  botId: text("bot_id").notNull(),
  eventType: text("event_type").notNull(),
  callbackUrl: text("callback_url").notNull(),
  payload: text("payload").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(5),
  lastAttemptAt: timestamp("last_attempt_at"),
  nextRetryAt: timestamp("next_retry_at"),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("webhook_deliveries_bot_created_idx").on(table.botId, table.createdAt),
  index("webhook_deliveries_status_retry_idx").on(table.status, table.nextRetryAt),
]);

export const notificationPreferences = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  ownerUid: text("owner_uid").notNull().unique(),
  transactionAlerts: boolean("transaction_alerts").notNull().default(true),
  budgetWarnings: boolean("budget_warnings").notNull().default(true),
  weeklySummary: boolean("weekly_summary").notNull().default(false),
  purchaseOverThresholdCents: integer("purchase_over_threshold_cents").notNull().default(5000),
  balanceLowCents: integer("balance_low_cents").notNull().default(500),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  ownerUid: text("owner_uid").notNull(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  botId: text("bot_id"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("notifications_owner_created_idx").on(table.ownerUid, table.createdAt),
]);

export const paymentLinks = pgTable("payment_links", {
  id: serial("id").primaryKey(),
  paymentLinkId: text("payment_link_id").notNull().unique(),
  botId: text("bot_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  description: text("description").notNull(),
  payerEmail: text("payer_email"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  checkoutUrl: text("checkout_url").notNull(),
  status: text("status").notNull().default("pending"),
  paidAt: timestamp("paid_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("payment_links_bot_created_idx").on(table.botId, table.createdAt),
  index("payment_links_stripe_session_idx").on(table.stripeCheckoutSessionId),
]);

export const pairingCodes = pgTable("pairing_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  ownerUid: text("owner_uid").notNull(),
  botId: text("bot_id"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  claimedAt: timestamp("claimed_at"),
}, (table) => [
  index("pairing_codes_code_idx").on(table.code),
  index("pairing_codes_owner_idx").on(table.ownerUid),
]);

export const reconciliationLogs = pgTable("reconciliation_logs", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").notNull(),
  botId: text("bot_id").notNull(),
  expectedCents: integer("expected_cents").notNull(),
  actualCents: integer("actual_cents").notNull(),
  diffCents: integer("diff_cents").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const registerBotRequestSchema = z.object({
  bot_name: z.string().min(1).max(100),
  owner_email: z.string().email(),
  description: z.string().max(500).optional(),
  callback_url: z.string().url().optional(),
  pairing_code: z.string().length(6).regex(/^\d{6}$/).optional(),
});

export const claimBotRequestSchema = z.object({
  claim_token: z.string().min(1),
});

export const fundWalletRequestSchema = z.object({
  amount_cents: z.number().int().min(100).max(100000),
  payment_method_id: z.number().int().optional(),
});

export const purchaseRequestSchema = z.object({
  amount_cents: z.number().int().min(1).max(10000000),
  merchant: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  category: z.string().max(100).optional(),
});

export const topupRequestSchema = z.object({
  amount_usd: z.number().min(1).max(10000),
  reason: z.string().max(500).optional(),
});

export const updateSpendingPermissionsSchema = z.object({
  approval_mode: z.enum(["ask_for_everything", "auto_approve_under_threshold", "auto_approve_by_category"]).optional(),
  per_transaction_usd: z.number().min(0).max(100000).optional(),
  daily_usd: z.number().min(0).max(100000).optional(),
  monthly_usd: z.number().min(0).max(1000000).optional(),
  ask_approval_above_usd: z.number().min(0).max(100000).optional(),
  approved_categories: z.array(z.string()).optional(),
  blocked_categories: z.array(z.string()).optional(),
  recurring_allowed: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export type Bot = typeof bots.$inferSelect;
export type InsertBot = typeof bots.$inferInsert;
export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = typeof wallets.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = typeof paymentMethods.$inferInsert;
export type SpendingPermission = typeof spendingPermissions.$inferSelect;
export type InsertSpendingPermission = typeof spendingPermissions.$inferInsert;
export type TopupRequest = typeof topupRequests.$inferSelect;
export type InsertTopupRequest = typeof topupRequests.$inferInsert;
export type ApiAccessLog = typeof apiAccessLogs.$inferSelect;
export type InsertApiAccessLog = typeof apiAccessLogs.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type InsertWebhookDelivery = typeof webhookDeliveries.$inferInsert;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = typeof notificationPreferences.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type PaymentLink = typeof paymentLinks.$inferSelect;
export type InsertPaymentLink = typeof paymentLinks.$inferInsert;
export type ReconciliationLog = typeof reconciliationLogs.$inferSelect;
export type InsertReconciliationLog = typeof reconciliationLogs.$inferInsert;
export type PairingCode = typeof pairingCodes.$inferSelect;
export type InsertPairingCode = typeof pairingCodes.$inferInsert;

export const rail4Cards = pgTable("rail4_cards", {
  id: serial("id").primaryKey(),
  cardId: text("card_id").notNull().unique(),
  ownerUid: text("owner_uid").notNull(),
  cardName: text("card_name").notNull().default("Untitled Card"),
  useCase: text("use_case"),
  botId: text("bot_id"),
  decoyFilename: text("decoy_filename").notNull(),
  realProfileIndex: integer("real_profile_index").notNull(),
  missingDigitPositions: integer("missing_digit_positions").array().notNull(),
  missingDigitsValue: text("missing_digits_value").notNull(),
  expiryMonth: integer("expiry_month"),
  expiryYear: integer("expiry_year"),
  ownerName: text("owner_name"),
  ownerZip: text("owner_zip"),
  ownerIp: text("owner_ip"),
  status: text("status").notNull().default("pending_setup"),
  fakeProfilesJson: text("fake_profiles_json").notNull(),
  profilePermissions: text("profile_permissions"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("rail4_cards_card_id_idx").on(table.cardId),
  index("rail4_cards_owner_uid_idx").on(table.ownerUid),
  index("rail4_cards_bot_id_idx").on(table.botId),
  index("rail4_cards_status_idx").on(table.status),
]);

export const obfuscationEvents = pgTable("obfuscation_events", {
  id: serial("id").primaryKey(),
  cardId: text("card_id").notNull(),
  botId: text("bot_id"),
  profileIndex: integer("profile_index").notNull(),
  merchantName: text("merchant_name").notNull(),
  merchantSlug: text("merchant_slug").notNull(),
  itemName: text("item_name").notNull(),
  amountCents: integer("amount_cents").notNull(),
  status: text("status").notNull().default("pending"),
  confirmationId: text("confirmation_id"),
  occurredAt: timestamp("occurred_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("obfuscation_events_card_id_idx").on(table.cardId),
  index("obfuscation_events_card_status_idx").on(table.cardId, table.status),
]);

export const obfuscationState = pgTable("obfuscation_state", {
  id: serial("id").primaryKey(),
  cardId: text("card_id").notNull().unique(),
  botId: text("bot_id"),
  phase: text("phase").notNull().default("warmup"),
  active: boolean("active").notNull().default(true),
  activatedAt: timestamp("activated_at").notNull().defaultNow(),
  lastOrganicAt: timestamp("last_organic_at"),
  lastObfuscationAt: timestamp("last_obfuscation_at"),
  organicCount: integer("organic_count").notNull().default(0),
  obfuscationCount: integer("obfuscation_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const profileAllowanceUsage = pgTable("profile_allowance_usage", {
  id: serial("id").primaryKey(),
  cardId: text("card_id").notNull(),
  botId: text("bot_id"),
  profileIndex: integer("profile_index").notNull(),
  windowStart: timestamp("window_start").notNull(),
  spentCents: integer("spent_cents").notNull().default(0),
  exemptUsed: boolean("exempt_used").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("profile_allowance_card_profile_idx").on(table.cardId, table.profileIndex),
]);

export const checkoutConfirmations = pgTable("checkout_confirmations", {
  id: serial("id").primaryKey(),
  confirmationId: text("confirmation_id").notNull().unique(),
  cardId: text("card_id").notNull(),
  botId: text("bot_id").notNull(),
  profileIndex: integer("profile_index").notNull(),
  amountCents: integer("amount_cents").notNull(),
  merchantName: text("merchant_name").notNull(),
  merchantUrl: text("merchant_url").notNull(),
  itemName: text("item_name").notNull(),
  category: text("category"),
  status: text("status").notNull().default("pending"),
  hmacToken: text("hmac_token"),
  expiresAt: timestamp("expires_at"),
  decidedAt: timestamp("decided_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("checkout_confirmations_card_idx").on(table.cardId),
  index("checkout_confirmations_bot_idx").on(table.botId),
  index("checkout_confirmations_confirmation_idx").on(table.confirmationId),
]);

export const waitlistEntries = pgTable("waitlist_entries", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  source: text("source").notNull().default("hero"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WaitlistEntry = typeof waitlistEntries.$inferSelect;
export type InsertWaitlistEntry = typeof waitlistEntries.$inferInsert;

export type Rail4Card = typeof rail4Cards.$inferSelect;
export type InsertRail4Card = typeof rail4Cards.$inferInsert;
export type ObfuscationEvent = typeof obfuscationEvents.$inferSelect;
export type InsertObfuscationEvent = typeof obfuscationEvents.$inferInsert;
export type ObfuscationState = typeof obfuscationState.$inferSelect;
export type InsertObfuscationState = typeof obfuscationState.$inferInsert;
export type ProfileAllowanceUsage = typeof profileAllowanceUsage.$inferSelect;
export type InsertProfileAllowanceUsage = typeof profileAllowanceUsage.$inferInsert;
export type CheckoutConfirmation = typeof checkoutConfirmations.$inferSelect;
export type InsertCheckoutConfirmation = typeof checkoutConfirmations.$inferInsert;

export const profilePermissionSchema = z.object({
  profile_index: z.number().int().min(1).max(6),
  allowance_duration: z.enum(["day", "week", "month"]),
  allowance_currency: z.string().default("USD"),
  allowance_value: z.number().min(0),
  confirmation_exempt_limit: z.number().min(0),
  human_permission_required: z.enum(["all", "above_exempt", "none"]),
  creditclaw_permission_required: z.literal("all"),
});

export type ProfilePermission = z.infer<typeof profilePermissionSchema>;

export const rail4InitializeSchema = z.object({
  card_id: z.string().min(1),
});

export const rail4SubmitOwnerDataSchema = z.object({
  card_id: z.string().min(1),
  missing_digits: z.string().length(3).regex(/^\d{3}$/),
  expiry_month: z.number().int().min(1).max(12),
  expiry_year: z.number().int().min(2025).max(2040),
  owner_name: z.string().max(200).optional(),
  owner_zip: z.string().min(3).max(20),
  profile_permissions: profilePermissionSchema.optional(),
});

export const unifiedCheckoutSchema = z.object({
  profile_index: z.number().int().min(1).max(6),
  merchant_name: z.string().min(1).max(200),
  merchant_url: z.string().min(1).max(2000),
  item_name: z.string().min(1).max(500),
  amount_cents: z.number().int().min(1).max(10000000),
  category: z.string().max(100).optional(),
  task_id: z.string().optional(),
  card_id: z.string().optional(),
});

export const waitlistEmailSchema = z.object({
  email: z.string().email(),
  source: z.string().optional(),
});

export const createPaymentLinkSchema = z.object({
  amount_usd: z.number().min(0.50).max(10000.00),
  description: z.string().min(1).max(500),
  payer_email: z.string().email().optional(),
});

export const updateNotificationPreferencesSchema = z.object({
  transaction_alerts: z.boolean().optional(),
  budget_warnings: z.boolean().optional(),
  weekly_summary: z.boolean().optional(),
  purchase_over_threshold_usd: z.number().min(0).max(100000).optional(),
  balance_low_usd: z.number().min(0).max(100000).optional(),
  email_enabled: z.boolean().optional(),
  in_app_enabled: z.boolean().optional(),
});

// ─── Rail 1: Stripe Wallet (Privy + x402) ───────────────────────────────────

export const privyWallets = pgTable("privy_wallets", {
  id: serial("id").primaryKey(),
  botId: text("bot_id").notNull(),
  ownerUid: text("owner_uid").notNull(),
  privyWalletId: text("privy_wallet_id").notNull(),
  address: text("address").notNull(),
  balanceUsdc: bigint("balance_usdc", { mode: "number" }).notNull().default(0),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("privy_wallets_bot_id_idx").on(table.botId),
  index("privy_wallets_owner_uid_idx").on(table.ownerUid),
  index("privy_wallets_address_idx").on(table.address),
]);

export const privyGuardrails = pgTable("privy_guardrails", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").notNull(),
  maxPerTxUsdc: integer("max_per_tx_usdc").notNull().default(100),
  dailyBudgetUsdc: integer("daily_budget_usdc").notNull().default(1000),
  monthlyBudgetUsdc: integer("monthly_budget_usdc").notNull().default(10000),
  requireApprovalAbove: integer("require_approval_above"),
  allowlistedDomains: jsonb("allowlisted_domains").$type<string[]>().default([]),
  blocklistedDomains: jsonb("blocklisted_domains").$type<string[]>().default([]),
  autoPauseOnZero: boolean("auto_pause_on_zero").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by"),
}, (table) => [
  index("privy_guardrails_wallet_id_idx").on(table.walletId),
]);

export const privyTransactions = pgTable("privy_transactions", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").notNull(),
  type: text("type").notNull(),
  amountUsdc: bigint("amount_usdc", { mode: "number" }).notNull(),
  recipientAddress: text("recipient_address"),
  resourceUrl: text("resource_url"),
  txHash: text("tx_hash"),
  status: text("status").notNull().default("pending"),
  stripeSessionId: text("stripe_session_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
}, (table) => [
  index("privy_transactions_wallet_id_idx").on(table.walletId),
  index("privy_transactions_status_idx").on(table.status),
  index("privy_transactions_type_idx").on(table.type),
]);

export const privyApprovals = pgTable("privy_approvals", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").notNull(),
  transactionId: integer("transaction_id").notNull(),
  amountUsdc: bigint("amount_usdc", { mode: "number" }).notNull(),
  resourceUrl: text("resource_url").notNull(),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  decidedAt: timestamp("decided_at"),
  decidedBy: text("decided_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("privy_approvals_wallet_id_idx").on(table.walletId),
  index("privy_approvals_status_idx").on(table.status),
]);

export type PrivyWallet = typeof privyWallets.$inferSelect;
export type InsertPrivyWallet = typeof privyWallets.$inferInsert;
export type PrivyGuardrail = typeof privyGuardrails.$inferSelect;
export type InsertPrivyGuardrail = typeof privyGuardrails.$inferInsert;
export type PrivyTransaction = typeof privyTransactions.$inferSelect;
export type InsertPrivyTransaction = typeof privyTransactions.$inferInsert;
export type PrivyApproval = typeof privyApprovals.$inferSelect;
export type InsertPrivyApproval = typeof privyApprovals.$inferInsert;

export const createPrivyWalletSchema = z.object({
  bot_id: z.string().min(1),
});

export const setPrivyGuardrailsSchema = z.object({
  wallet_id: z.number().int().positive(),
  max_per_tx_usdc: z.number().int().min(0).optional(),
  daily_budget_usdc: z.number().int().min(0).optional(),
  monthly_budget_usdc: z.number().int().min(0).optional(),
  require_approval_above: z.number().int().min(0).nullable().optional(),
  allowlisted_domains: z.array(z.string()).optional(),
  blocklisted_domains: z.array(z.string()).optional(),
  auto_pause_on_zero: z.boolean().optional(),
});

export const privyOnrampSessionSchema = z.object({
  wallet_id: z.number().int().positive(),
  amount_usd: z.number().min(1).max(10000).optional(),
});

export const privyBotSignSchema = z.object({
  bot_id: z.string().min(1),
  resource_url: z.string().min(1),
  amount_usdc: z.number().int().positive(),
  recipient_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  valid_before: z.number().int().positive().optional(),
});

export const privyApprovalDecideSchema = z.object({
  approval_id: z.number().int().positive(),
  decision: z.enum(["approve", "reject"]),
});

// ─── Rail 2: Card Wallet (CrossMint + Commerce) ─────────────────────────────

export const crossmintWallets = pgTable("crossmint_wallets", {
  id: serial("id").primaryKey(),
  botId: text("bot_id").notNull(),
  ownerUid: text("owner_uid").notNull(),
  crossmintWalletId: text("crossmint_wallet_id").notNull(),
  address: text("address").notNull(),
  balanceUsdc: bigint("balance_usdc", { mode: "number" }).notNull().default(0),
  chain: text("chain").notNull().default("base"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("crossmint_wallets_bot_id_idx").on(table.botId),
  index("crossmint_wallets_owner_uid_idx").on(table.ownerUid),
  index("crossmint_wallets_address_idx").on(table.address),
]);

export const crossmintGuardrails = pgTable("crossmint_guardrails", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").notNull(),
  maxPerTxUsdc: integer("max_per_tx_usdc").notNull().default(100),
  dailyBudgetUsdc: integer("daily_budget_usdc").notNull().default(500),
  monthlyBudgetUsdc: integer("monthly_budget_usdc").notNull().default(2000),
  requireApprovalAbove: integer("require_approval_above").notNull().default(0),
  allowlistedMerchants: jsonb("allowlisted_merchants").$type<string[]>().default([]),
  blocklistedMerchants: jsonb("blocklisted_merchants").$type<string[]>().default([]),
  autoPauseOnZero: boolean("auto_pause_on_zero").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by"),
}, (table) => [
  index("crossmint_guardrails_wallet_id_idx").on(table.walletId),
]);

export const crossmintTransactions = pgTable("crossmint_transactions", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").notNull(),
  type: text("type").notNull(),
  amountUsdc: bigint("amount_usdc", { mode: "number" }).notNull(),
  crossmintOrderId: text("crossmint_order_id"),
  productLocator: text("product_locator"),
  productName: text("product_name"),
  quantity: integer("quantity").notNull().default(1),
  orderStatus: text("order_status"),
  shippingAddress: jsonb("shipping_address").$type<{
    name: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  }>(),
  trackingInfo: jsonb("tracking_info").$type<{
    carrier?: string;
    tracking_number?: string;
    tracking_url?: string;
    estimated_delivery?: string;
  }>(),
  status: text("status").notNull().default("pending"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("crossmint_transactions_wallet_id_idx").on(table.walletId),
  index("crossmint_transactions_status_idx").on(table.status),
  index("crossmint_transactions_type_idx").on(table.type),
  index("crossmint_transactions_order_id_idx").on(table.crossmintOrderId),
]);

export const crossmintApprovals = pgTable("crossmint_approvals", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").notNull(),
  transactionId: integer("transaction_id").notNull(),
  amountUsdc: bigint("amount_usdc", { mode: "number" }).notNull(),
  productLocator: text("product_locator").notNull(),
  productName: text("product_name"),
  shippingAddress: jsonb("shipping_address").$type<{
    name: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  }>(),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  decidedBy: text("decided_by"),
  decidedAt: timestamp("decided_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("crossmint_approvals_wallet_id_idx").on(table.walletId),
  index("crossmint_approvals_status_idx").on(table.status),
]);

export type CrossmintWallet = typeof crossmintWallets.$inferSelect;
export type InsertCrossmintWallet = typeof crossmintWallets.$inferInsert;
export type CrossmintGuardrail = typeof crossmintGuardrails.$inferSelect;
export type InsertCrossmintGuardrail = typeof crossmintGuardrails.$inferInsert;
export type CrossmintTransaction = typeof crossmintTransactions.$inferSelect;
export type InsertCrossmintTransaction = typeof crossmintTransactions.$inferInsert;
export type CrossmintApproval = typeof crossmintApprovals.$inferSelect;
export type InsertCrossmintApproval = typeof crossmintApprovals.$inferInsert;

export const createCrossmintWalletSchema = z.object({
  bot_id: z.string().min(1),
});

export const setCrossmintGuardrailsSchema = z.object({
  wallet_id: z.number().int().positive(),
  max_per_tx_usdc: z.number().int().min(0).optional(),
  daily_budget_usdc: z.number().int().min(0).optional(),
  monthly_budget_usdc: z.number().int().min(0).optional(),
  require_approval_above: z.number().int().min(0).optional(),
  allowlisted_merchants: z.array(z.string()).optional(),
  blocklisted_merchants: z.array(z.string()).optional(),
  auto_pause_on_zero: z.boolean().optional(),
});

export const crossmintOnrampSessionSchema = z.object({
  wallet_id: z.number().int().positive(),
  amount_usd: z.number().min(1).max(10000).optional(),
});

export const crossmintBotPurchaseSchema = z.object({
  merchant: z.string().min(1).max(100),
  product_id: z.string().min(1).max(500),
  quantity: z.number().int().min(1).max(100).default(1),
  product_name: z.string().max(500).optional(),
  estimated_price_usd: z.number().positive().optional(),
  shipping_address: z.object({
    name: z.string().min(1).max(200),
    line1: z.string().min(1).max(500),
    line2: z.string().max(500).optional(),
    city: z.string().min(1).max(200),
    state: z.string().min(1).max(100),
    zip: z.string().min(1).max(20),
    country: z.string().length(2).default("US"),
  }),
});

export const crossmintApprovalDecideSchema = z.object({
  approval_id: z.number().int().positive(),
  decision: z.enum(["approve", "reject"]),
});
