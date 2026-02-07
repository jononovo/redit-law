import { db } from "@/server/db";
import {
  bots, wallets, transactions, paymentMethods, spendingPermissions, topupRequests, apiAccessLogs, webhookDeliveries,
  type InsertBot, type Bot,
  type Wallet, type InsertWallet,
  type Transaction, type InsertTransaction,
  type PaymentMethod, type InsertPaymentMethod,
  type SpendingPermission, type InsertSpendingPermission,
  type TopupRequest, type InsertTopupRequest,
  type ApiAccessLog, type InsertApiAccessLog,
  type WebhookDelivery, type InsertWebhookDelivery,
} from "@/shared/schema";
import { eq, and, isNull, desc, sql, gte, lte, inArray } from "drizzle-orm";

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
  getPaymentMethods(ownerUid: string): Promise<PaymentMethod[]>;
  getPaymentMethodById(id: number, ownerUid: string): Promise<PaymentMethod | null>;
  addPaymentMethod(data: InsertPaymentMethod): Promise<PaymentMethod>;
  deletePaymentMethodById(id: number, ownerUid: string): Promise<void>;
  setDefaultPaymentMethod(id: number, ownerUid: string): Promise<PaymentMethod | null>;

  getBotsByApiKeyPrefix(prefix: string): Promise<Bot[]>;
  debitWallet(walletId: number, amountCents: number): Promise<Wallet | null>;
  getDailySpend(walletId: number): Promise<number>;
  getMonthlySpend(walletId: number): Promise<number>;

  getSpendingPermissions(botId: string): Promise<SpendingPermission | null>;
  upsertSpendingPermissions(botId: string, data: Partial<InsertSpendingPermission>): Promise<SpendingPermission>;

  createTopupRequest(data: InsertTopupRequest): Promise<TopupRequest>;

  createAccessLog(data: InsertApiAccessLog): Promise<void>;
  getAccessLogsByBotIds(botIds: string[], limit?: number): Promise<ApiAccessLog[]>;

  createWebhookDelivery(data: InsertWebhookDelivery): Promise<WebhookDelivery>;
  updateWebhookDelivery(id: number, data: Partial<InsertWebhookDelivery>): Promise<WebhookDelivery | null>;
  getPendingWebhookRetries(now: Date, limit?: number): Promise<WebhookDelivery[]>;
  getPendingWebhookRetriesForBot(botId: string, now: Date, limit?: number): Promise<WebhookDelivery[]>;
  getWebhookDeliveriesByBotIds(botIds: string[], limit?: number): Promise<WebhookDelivery[]>;
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
    const [pm] = await db.select().from(paymentMethods)
      .where(and(eq(paymentMethods.ownerUid, ownerUid), eq(paymentMethods.isDefault, true)))
      .limit(1);
    if (pm) return pm;
    const [any] = await db.select().from(paymentMethods)
      .where(eq(paymentMethods.ownerUid, ownerUid))
      .orderBy(desc(paymentMethods.createdAt))
      .limit(1);
    return any || null;
  },

  async getPaymentMethods(ownerUid: string): Promise<PaymentMethod[]> {
    return db.select().from(paymentMethods)
      .where(eq(paymentMethods.ownerUid, ownerUid))
      .orderBy(desc(paymentMethods.isDefault), desc(paymentMethods.createdAt));
  },

  async getPaymentMethodById(id: number, ownerUid: string): Promise<PaymentMethod | null> {
    const [pm] = await db.select().from(paymentMethods)
      .where(and(eq(paymentMethods.id, id), eq(paymentMethods.ownerUid, ownerUid)))
      .limit(1);
    return pm || null;
  },

  async addPaymentMethod(data: InsertPaymentMethod): Promise<PaymentMethod> {
    const existing = await this.getPaymentMethods(data.ownerUid);
    const shouldBeDefault = existing.length === 0;
    const [created] = await db.insert(paymentMethods).values({
      ...data,
      isDefault: shouldBeDefault,
    }).returning();
    return created;
  },

  async deletePaymentMethodById(id: number, ownerUid: string): Promise<void> {
    const pm = await this.getPaymentMethodById(id, ownerUid);
    if (!pm) return;
    await db.delete(paymentMethods).where(and(eq(paymentMethods.id, id), eq(paymentMethods.ownerUid, ownerUid)));
    if (pm.isDefault) {
      const [next] = await db.select().from(paymentMethods)
        .where(eq(paymentMethods.ownerUid, ownerUid))
        .orderBy(desc(paymentMethods.createdAt))
        .limit(1);
      if (next) {
        await db.update(paymentMethods).set({ isDefault: true }).where(eq(paymentMethods.id, next.id));
      }
    }
  },

  async setDefaultPaymentMethod(id: number, ownerUid: string): Promise<PaymentMethod | null> {
    const pm = await this.getPaymentMethodById(id, ownerUid);
    if (!pm) return null;
    await db.update(paymentMethods).set({ isDefault: false }).where(eq(paymentMethods.ownerUid, ownerUid));
    const [updated] = await db.update(paymentMethods).set({ isDefault: true }).where(eq(paymentMethods.id, id)).returning();
    return updated;
  },


  async getBotsByApiKeyPrefix(prefix: string): Promise<Bot[]> {
    return db.select().from(bots).where(eq(bots.apiKeyPrefix, prefix));
  },

  async debitWallet(walletId: number, amountCents: number): Promise<Wallet | null> {
    const [updated] = await db
      .update(wallets)
      .set({
        balanceCents: sql`${wallets.balanceCents} - ${amountCents}`,
        updatedAt: new Date(),
      })
      .where(and(eq(wallets.id, walletId), gte(wallets.balanceCents, amountCents)))
      .returning();
    return updated || null;
  },

  async getDailySpend(walletId: number): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = await db
      .select({ total: sql<number>`COALESCE(SUM(${transactions.amountCents}), 0)` })
      .from(transactions)
      .where(and(
        eq(transactions.walletId, walletId),
        eq(transactions.type, "purchase"),
        gte(transactions.createdAt, today)
      ));
    return Number(result[0]?.total || 0);
  },

  async getMonthlySpend(walletId: number): Promise<number> {
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);
    const result = await db
      .select({ total: sql<number>`COALESCE(SUM(${transactions.amountCents}), 0)` })
      .from(transactions)
      .where(and(
        eq(transactions.walletId, walletId),
        eq(transactions.type, "purchase"),
        gte(transactions.createdAt, firstOfMonth)
      ));
    return Number(result[0]?.total || 0);
  },

  async getSpendingPermissions(botId: string): Promise<SpendingPermission | null> {
    const [perm] = await db.select().from(spendingPermissions).where(eq(spendingPermissions.botId, botId)).limit(1);
    return perm || null;
  },

  async upsertSpendingPermissions(botId: string, data: Partial<InsertSpendingPermission>): Promise<SpendingPermission> {
    const existing = await this.getSpendingPermissions(botId);
    if (existing) {
      const [updated] = await db
        .update(spendingPermissions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(spendingPermissions.botId, botId))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(spendingPermissions)
      .values({ botId, ...data })
      .returning();
    return created;
  },

  async createTopupRequest(data: InsertTopupRequest): Promise<TopupRequest> {
    const [req] = await db.insert(topupRequests).values(data).returning();
    return req;
  },

  async createAccessLog(data: InsertApiAccessLog): Promise<void> {
    await db.insert(apiAccessLogs).values(data).catch((err) => {
      console.error("Failed to write access log:", err);
    });
  },

  async getAccessLogsByBotIds(botIds: string[], limit = 100): Promise<ApiAccessLog[]> {
    if (botIds.length === 0) return [];
    return db
      .select()
      .from(apiAccessLogs)
      .where(sql`${apiAccessLogs.botId} IN (${sql.join(botIds.map(id => sql`${id}`), sql`, `)})`)
      .orderBy(desc(apiAccessLogs.createdAt))
      .limit(limit);
  },

  async createWebhookDelivery(data: InsertWebhookDelivery): Promise<WebhookDelivery> {
    const [delivery] = await db.insert(webhookDeliveries).values(data).returning();
    return delivery;
  },

  async updateWebhookDelivery(id: number, data: Partial<InsertWebhookDelivery>): Promise<WebhookDelivery | null> {
    const [updated] = await db
      .update(webhookDeliveries)
      .set(data)
      .where(eq(webhookDeliveries.id, id))
      .returning();
    return updated || null;
  },

  async getPendingWebhookRetries(now: Date, limit = 10): Promise<WebhookDelivery[]> {
    return db
      .select()
      .from(webhookDeliveries)
      .where(and(
        eq(webhookDeliveries.status, "pending"),
        lte(webhookDeliveries.nextRetryAt, now),
      ))
      .orderBy(webhookDeliveries.nextRetryAt)
      .limit(limit);
  },

  async getPendingWebhookRetriesForBot(botId: string, now: Date, limit = 5): Promise<WebhookDelivery[]> {
    return db
      .select()
      .from(webhookDeliveries)
      .where(and(
        eq(webhookDeliveries.botId, botId),
        eq(webhookDeliveries.status, "pending"),
        lte(webhookDeliveries.nextRetryAt, now),
      ))
      .orderBy(webhookDeliveries.nextRetryAt)
      .limit(limit);
  },

  async getWebhookDeliveriesByBotIds(botIds: string[], limit = 50): Promise<WebhookDelivery[]> {
    if (botIds.length === 0) return [];
    return db
      .select()
      .from(webhookDeliveries)
      .where(sql`${webhookDeliveries.botId} IN (${sql.join(botIds.map(id => sql`${id}`), sql`, `)})`)
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit);
  },
};
