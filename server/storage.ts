import { db } from "@/server/db";
import {
  bots, wallets, transactions, paymentMethods,
  type InsertBot, type Bot,
  type Wallet, type InsertWallet,
  type Transaction, type InsertTransaction,
  type PaymentMethod, type InsertPaymentMethod,
} from "@/shared/schema";
import { eq, and, isNull, desc, sql } from "drizzle-orm";

export interface IStorage {
  createBot(data: InsertBot): Promise<Bot>;
  getBotByClaimToken(token: string): Promise<Bot | null>;
  getBotByBotId(botId: string): Promise<Bot | null>;
  getBotsByOwnerEmail(email: string): Promise<Bot[]>;
  getBotsByOwnerUid(ownerUid: string): Promise<Bot[]>;
  claimBot(claimToken: string, ownerUid: string): Promise<Bot | null>;
  checkDuplicateRegistration(botName: string, ownerEmail: string): Promise<boolean>;

  createWallet(data: InsertWallet): Promise<Wallet>;
  getWalletByBotId(botId: string): Promise<Wallet | null>;
  getWalletByOwnerUid(ownerUid: string): Promise<Wallet | null>;
  creditWallet(walletId: number, amountCents: number): Promise<Wallet>;

  createTransaction(data: InsertTransaction): Promise<Transaction>;
  getTransactionsByWalletId(walletId: number, limit?: number): Promise<Transaction[]>;

  getPaymentMethod(ownerUid: string): Promise<PaymentMethod | null>;
  upsertPaymentMethod(data: InsertPaymentMethod): Promise<PaymentMethod>;
  deletePaymentMethod(ownerUid: string): Promise<void>;
}

export const storage: IStorage = {
  async createBot(data: InsertBot): Promise<Bot> {
    const [bot] = await db.insert(bots).values(data).returning();
    return bot;
  },

  async getBotByClaimToken(token: string): Promise<Bot | null> {
    const [bot] = await db.select().from(bots).where(eq(bots.claimToken, token)).limit(1);
    return bot || null;
  },

  async getBotByBotId(botId: string): Promise<Bot | null> {
    const [bot] = await db.select().from(bots).where(eq(bots.botId, botId)).limit(1);
    return bot || null;
  },

  async getBotsByOwnerEmail(email: string): Promise<Bot[]> {
    return db.select().from(bots).where(eq(bots.ownerEmail, email));
  },

  async getBotsByOwnerUid(ownerUid: string): Promise<Bot[]> {
    return db.select().from(bots).where(eq(bots.ownerUid, ownerUid));
  },

  async claimBot(claimToken: string, ownerUid: string): Promise<Bot | null> {
    const bot = await this.getBotByClaimToken(claimToken);
    if (!bot) return null;
    if (bot.ownerUid) return null;

    const [updated] = await db
      .update(bots)
      .set({
        ownerUid,
        walletStatus: "active",
        claimToken: null,
        claimedAt: new Date(),
      })
      .where(and(eq(bots.claimToken, claimToken), isNull(bots.ownerUid)))
      .returning();

    if (!updated) return null;

    await this.createWallet({
      botId: updated.botId,
      ownerUid,
    });

    return updated;
  },

  async checkDuplicateRegistration(botName: string, ownerEmail: string): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(bots)
      .where(and(eq(bots.botName, botName), eq(bots.ownerEmail, ownerEmail)))
      .limit(1);
    return !!existing;
  },

  async createWallet(data: InsertWallet): Promise<Wallet> {
    const [wallet] = await db.insert(wallets).values(data).returning();
    return wallet;
  },

  async getWalletByBotId(botId: string): Promise<Wallet | null> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.botId, botId)).limit(1);
    return wallet || null;
  },

  async getWalletByOwnerUid(ownerUid: string): Promise<Wallet | null> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.ownerUid, ownerUid)).limit(1);
    return wallet || null;
  },

  async creditWallet(walletId: number, amountCents: number): Promise<Wallet> {
    const [updated] = await db
      .update(wallets)
      .set({
        balanceCents: sql`${wallets.balanceCents} + ${amountCents}`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, walletId))
      .returning();
    return updated;
  },

  async createTransaction(data: InsertTransaction): Promise<Transaction> {
    const [tx] = await db.insert(transactions).values(data).returning();
    return tx;
  },

  async getTransactionsByWalletId(walletId: number, limit = 50): Promise<Transaction[]> {
    return db
      .select()
      .from(transactions)
      .where(eq(transactions.walletId, walletId))
      .orderBy(desc(transactions.createdAt))
      .limit(limit);
  },

  async getPaymentMethod(ownerUid: string): Promise<PaymentMethod | null> {
    const [pm] = await db.select().from(paymentMethods).where(eq(paymentMethods.ownerUid, ownerUid)).limit(1);
    return pm || null;
  },

  async upsertPaymentMethod(data: InsertPaymentMethod): Promise<PaymentMethod> {
    const existing = await this.getPaymentMethod(data.ownerUid);
    if (existing) {
      const [updated] = await db
        .update(paymentMethods)
        .set({
          stripeCustomerId: data.stripeCustomerId,
          stripePmId: data.stripePmId,
          cardLast4: data.cardLast4,
          cardBrand: data.cardBrand,
        })
        .where(eq(paymentMethods.ownerUid, data.ownerUid))
        .returning();
      return updated;
    }
    const [created] = await db.insert(paymentMethods).values(data).returning();
    return created;
  },

  async deletePaymentMethod(ownerUid: string): Promise<void> {
    await db.delete(paymentMethods).where(eq(paymentMethods.ownerUid, ownerUid));
  },
};
