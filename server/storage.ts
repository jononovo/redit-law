import { db } from "@/server/db";
import {
  bots, wallets, transactions, paymentMethods, spendingPermissions, topupRequests, apiAccessLogs, webhookDeliveries,
  notificationPreferences, notifications, reconciliationLogs, paymentLinks, pairingCodes, waitlistEntries,
  type InsertBot, type Bot,
  type Wallet, type InsertWallet,
  type Transaction, type InsertTransaction,
  type PaymentMethod, type InsertPaymentMethod,
  type SpendingPermission, type InsertSpendingPermission,
  type TopupRequest, type InsertTopupRequest,
  type ApiAccessLog, type InsertApiAccessLog,
  type WebhookDelivery, type InsertWebhookDelivery,
  type NotificationPreference, type InsertNotificationPreference,
  type Notification, type InsertNotification,
  type PaymentLink, type InsertPaymentLink,
  type ReconciliationLog, type InsertReconciliationLog,
  type PairingCode, type InsertPairingCode,
  type WaitlistEntry, type InsertWaitlistEntry,
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

  getNotificationPreferences(ownerUid: string): Promise<NotificationPreference | null>;
  upsertNotificationPreferences(ownerUid: string, data: Partial<InsertNotificationPreference>): Promise<NotificationPreference>;
  createNotification(data: InsertNotification): Promise<Notification>;
  getNotifications(ownerUid: string, limit?: number, unreadOnly?: boolean): Promise<Notification[]>;
  getUnreadCount(ownerUid: string): Promise<number>;
  markNotificationsRead(ids: number[], ownerUid: string): Promise<void>;
  markAllNotificationsRead(ownerUid: string): Promise<void>;

  getWalletsByOwnerUid(ownerUid: string): Promise<Wallet[]>;
  getTransactionSumByWalletId(walletId: number): Promise<number>;
  createReconciliationLog(data: InsertReconciliationLog): Promise<ReconciliationLog>;
  getFailedWebhookCount24h(botIds: string[]): Promise<number>;

  createPaymentLink(data: InsertPaymentLink): Promise<PaymentLink>;
  getPaymentLinksByBotId(botId: string, limit?: number, status?: string): Promise<PaymentLink[]>;
  getPaymentLinkByStripeSession(sessionId: string): Promise<PaymentLink | null>;
  getPaymentLinkByPaymentLinkId(paymentLinkId: string): Promise<PaymentLink | null>;
  getPaymentLinksByOwnerUid(ownerUid: string, limit?: number): Promise<PaymentLink[]>;
  updatePaymentLinkStatus(id: number, status: string, paidAt?: Date): Promise<PaymentLink | null>;
  completePaymentLink(id: number): Promise<PaymentLink | null>;

  createPairingCode(data: InsertPairingCode): Promise<PairingCode>;
  getPairingCodeByCode(code: string): Promise<PairingCode | null>;
  claimPairingCode(code: string, botId: string): Promise<PairingCode | null>;
  getRecentPairingCodeCount(ownerUid: string): Promise<number>;

  addWaitlistEntry(data: InsertWaitlistEntry): Promise<WaitlistEntry>;
  getWaitlistEntryByEmail(email: string): Promise<WaitlistEntry | null>;

  freezeWallet(walletId: number, ownerUid: string): Promise<Wallet | null>;
  unfreezeWallet(walletId: number, ownerUid: string): Promise<Wallet | null>;
  getWalletsWithBotsByOwnerUid(ownerUid: string): Promise<(Wallet & { botName: string; botId: string })[]>;
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

  async getNotificationPreferences(ownerUid: string): Promise<NotificationPreference | null> {
    const [pref] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.ownerUid, ownerUid)).limit(1);
    return pref || null;
  },

  async upsertNotificationPreferences(ownerUid: string, data: Partial<InsertNotificationPreference>): Promise<NotificationPreference> {
    const existing = await this.getNotificationPreferences(ownerUid);
    if (existing) {
      const [updated] = await db
        .update(notificationPreferences)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(notificationPreferences.ownerUid, ownerUid))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(notificationPreferences)
      .values({ ownerUid, ...data })
      .returning();
    return created;
  },

  async createNotification(data: InsertNotification): Promise<Notification> {
    const [notif] = await db.insert(notifications).values(data).returning();
    return notif;
  },

  async getNotifications(ownerUid: string, limit = 20, unreadOnly = false): Promise<Notification[]> {
    const conditions = [eq(notifications.ownerUid, ownerUid)];
    if (unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }
    return db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  },

  async getUnreadCount(ownerUid: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.ownerUid, ownerUid), eq(notifications.isRead, false)));
    return Number(result[0]?.count || 0);
  },

  async markNotificationsRead(ids: number[], ownerUid: string): Promise<void> {
    if (ids.length === 0) return;
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.ownerUid, ownerUid),
        sql`${notifications.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`
      ));
  },

  async markAllNotificationsRead(ownerUid: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.ownerUid, ownerUid), eq(notifications.isRead, false)));
  },

  async getWalletsByOwnerUid(ownerUid: string): Promise<Wallet[]> {
    return db.select().from(wallets).where(eq(wallets.ownerUid, ownerUid));
  },

  async getTransactionSumByWalletId(walletId: number): Promise<number> {
    const result = await db
      .select({
        topups: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} IN ('topup', 'payment_received') THEN ${transactions.amountCents} ELSE 0 END), 0)`,
        purchases: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'purchase' THEN ${transactions.amountCents} ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(eq(transactions.walletId, walletId));
    const topups = Number(result[0]?.topups || 0);
    const purchases = Number(result[0]?.purchases || 0);
    return topups - purchases;
  },

  async createReconciliationLog(data: InsertReconciliationLog): Promise<ReconciliationLog> {
    const [log] = await db.insert(reconciliationLogs).values(data).returning();
    return log;
  },

  async getFailedWebhookCount24h(botIds: string[]): Promise<number> {
    if (botIds.length === 0) return 0;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(webhookDeliveries)
      .where(and(
        inArray(webhookDeliveries.botId, botIds),
        eq(webhookDeliveries.status, "failed"),
        gte(webhookDeliveries.createdAt, oneDayAgo),
      ));
    return Number(result[0]?.count || 0);
  },

  async createPaymentLink(data: InsertPaymentLink): Promise<PaymentLink> {
    const [link] = await db.insert(paymentLinks).values(data).returning();
    return link;
  },

  async getPaymentLinksByBotId(botId: string, limit = 20, status?: string): Promise<PaymentLink[]> {
    const conditions = [eq(paymentLinks.botId, botId)];
    if (status) {
      conditions.push(eq(paymentLinks.status, status));
    }
    return db
      .select()
      .from(paymentLinks)
      .where(and(...conditions))
      .orderBy(desc(paymentLinks.createdAt))
      .limit(limit);
  },

  async getPaymentLinkByStripeSession(sessionId: string): Promise<PaymentLink | null> {
    const [link] = await db
      .select()
      .from(paymentLinks)
      .where(eq(paymentLinks.stripeCheckoutSessionId, sessionId))
      .limit(1);
    return link || null;
  },

  async getPaymentLinkByPaymentLinkId(paymentLinkId: string): Promise<PaymentLink | null> {
    const [link] = await db
      .select()
      .from(paymentLinks)
      .where(eq(paymentLinks.paymentLinkId, paymentLinkId))
      .limit(1);
    return link || null;
  },

  async getPaymentLinksByOwnerUid(ownerUid: string, limit = 50): Promise<PaymentLink[]> {
    const ownerBots = await this.getBotsByOwnerUid(ownerUid);
    if (ownerBots.length === 0) return [];
    const botIds = ownerBots.map(b => b.botId);
    return db
      .select()
      .from(paymentLinks)
      .where(inArray(paymentLinks.botId, botIds))
      .orderBy(desc(paymentLinks.createdAt))
      .limit(limit);
  },

  async updatePaymentLinkStatus(id: number, status: string, paidAt?: Date): Promise<PaymentLink | null> {
    const updateData: Record<string, unknown> = { status };
    if (paidAt) updateData.paidAt = paidAt;
    const [updated] = await db
      .update(paymentLinks)
      .set(updateData)
      .where(eq(paymentLinks.id, id))
      .returning();
    return updated || null;
  },

  async completePaymentLink(id: number): Promise<PaymentLink | null> {
    const [updated] = await db
      .update(paymentLinks)
      .set({ status: "completed", paidAt: new Date() })
      .where(and(eq(paymentLinks.id, id), eq(paymentLinks.status, "pending")))
      .returning();
    return updated || null;
  },

  async createPairingCode(data: InsertPairingCode): Promise<PairingCode> {
    const [code] = await db.insert(pairingCodes).values(data).returning();
    return code;
  },

  async getPairingCodeByCode(code: string): Promise<PairingCode | null> {
    const [pc] = await db.select().from(pairingCodes).where(eq(pairingCodes.code, code)).limit(1);
    return pc || null;
  },

  async claimPairingCode(code: string, botId: string): Promise<PairingCode | null> {
    const now = new Date();
    const [updated] = await db
      .update(pairingCodes)
      .set({ botId, status: "paired" })
      .where(and(
        eq(pairingCodes.code, code),
        eq(pairingCodes.status, "pending"),
        gte(pairingCodes.expiresAt, now),
      ))
      .returning();
    return updated || null;
  },

  async getRecentPairingCodeCount(ownerUid: string): Promise<number> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(pairingCodes)
      .where(and(
        eq(pairingCodes.ownerUid, ownerUid),
        gte(pairingCodes.createdAt, oneHourAgo),
      ));
    return Number(result[0]?.count || 0);
  },

  async addWaitlistEntry(data: InsertWaitlistEntry): Promise<WaitlistEntry> {
    const [entry] = await db
      .insert(waitlistEntries)
      .values(data)
      .onConflictDoNothing({ target: waitlistEntries.email })
      .returning();
    if (entry) return entry;
    const existing = await this.getWaitlistEntryByEmail(data.email);
    return existing!;
  },

  async getWaitlistEntryByEmail(email: string): Promise<WaitlistEntry | null> {
    const [entry] = await db.select().from(waitlistEntries).where(eq(waitlistEntries.email, email)).limit(1);
    return entry || null;
  },

  async freezeWallet(walletId: number, ownerUid: string): Promise<Wallet | null> {
    const [updated] = await db
      .update(wallets)
      .set({ isFrozen: true, updatedAt: new Date() })
      .where(and(eq(wallets.id, walletId), eq(wallets.ownerUid, ownerUid)))
      .returning();
    return updated || null;
  },

  async unfreezeWallet(walletId: number, ownerUid: string): Promise<Wallet | null> {
    const [updated] = await db
      .update(wallets)
      .set({ isFrozen: false, updatedAt: new Date() })
      .where(and(eq(wallets.id, walletId), eq(wallets.ownerUid, ownerUid)))
      .returning();
    return updated || null;
  },

  async getWalletsWithBotsByOwnerUid(ownerUid: string): Promise<(Wallet & { botName: string; botId: string })[]> {
    const results = await db
      .select({
        id: wallets.id,
        botId: wallets.botId,
        ownerUid: wallets.ownerUid,
        balanceCents: wallets.balanceCents,
        currency: wallets.currency,
        isFrozen: wallets.isFrozen,
        createdAt: wallets.createdAt,
        updatedAt: wallets.updatedAt,
        botName: bots.botName,
      })
      .from(wallets)
      .innerJoin(bots, eq(wallets.botId, bots.botId))
      .where(eq(wallets.ownerUid, ownerUid))
      .orderBy(desc(wallets.createdAt));
    return results;
  },
};
