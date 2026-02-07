import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
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
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const wallets = pgTable("wallets", {
  id: serial("id").primaryKey(),
  botId: text("bot_id").notNull().unique(),
  ownerUid: text("owner_uid").notNull(),
  balanceCents: integer("balance_cents").notNull().default(0),
  currency: text("currency").notNull().default("usd"),
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
  ownerUid: text("owner_uid").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  stripePmId: text("stripe_pm_id").notNull(),
  cardLast4: text("card_last4"),
  cardBrand: text("card_brand"),
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

export const registerBotRequestSchema = z.object({
  bot_name: z.string().min(1).max(100),
  owner_email: z.string().email(),
  description: z.string().max(500).optional(),
  callback_url: z.string().url().optional(),
});

export const claimBotRequestSchema = z.object({
  claim_token: z.string().min(1),
});

export const fundWalletRequestSchema = z.object({
  amount_cents: z.number().int().min(100).max(100000),
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
