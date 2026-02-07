import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
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

export type Bot = typeof bots.$inferSelect;
export type InsertBot = typeof bots.$inferInsert;
export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = typeof wallets.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
export type PaymentMethod = typeof paymentMethods.$inferSelect;
export type InsertPaymentMethod = typeof paymentMethods.$inferInsert;
