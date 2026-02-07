import { pgTable, serial, text, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
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

export const waitlistEntries = pgTable("waitlist_entries", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  source: text("source").notNull().default("hero"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WaitlistEntry = typeof waitlistEntries.$inferSelect;
export type InsertWaitlistEntry = typeof waitlistEntries.$inferInsert;

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
