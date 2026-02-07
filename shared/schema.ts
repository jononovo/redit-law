import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
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

export const registerBotRequestSchema = z.object({
  bot_name: z.string().min(1).max(100),
  owner_email: z.string().email(),
  description: z.string().max(500).optional(),
  callback_url: z.string().url().optional(),
});

export const claimBotRequestSchema = z.object({
  claim_token: z.string().min(1),
});

export type Bot = typeof bots.$inferSelect;
export type InsertBot = typeof bots.$inferInsert;
