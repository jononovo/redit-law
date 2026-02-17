import { db } from "@/server/db";
import {
  bots, wallets, transactions, paymentMethods, spendingPermissions, topupRequests, apiAccessLogs, webhookDeliveries,
  notificationPreferences, notifications, reconciliationLogs, paymentLinks, pairingCodes, waitlistEntries,
  rail4Cards, obfuscationEvents, obfuscationState, profileAllowanceUsage, checkoutConfirmations,
  privyWallets, privyGuardrails, privyTransactions, privyApprovals,
  crossmintWallets, crossmintGuardrails, crossmintTransactions, crossmintApprovals,
  owners, masterGuardrails, skillDrafts, skillEvidence, skillSubmitterProfiles,
  skillVersions, skillExports,
  type Owner, type InsertOwner,
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
  type Rail4Card, type InsertRail4Card,
  type ObfuscationEvent, type InsertObfuscationEvent,
  type ObfuscationState, type InsertObfuscationState,
  type ProfileAllowanceUsage, type InsertProfileAllowanceUsage,
  type CheckoutConfirmation, type InsertCheckoutConfirmation,
  type PrivyWallet, type InsertPrivyWallet,
  type PrivyGuardrail, type InsertPrivyGuardrail,
  type PrivyTransaction, type InsertPrivyTransaction,
  type PrivyApproval, type InsertPrivyApproval,
  type CrossmintWallet, type InsertCrossmintWallet,
  type CrossmintGuardrail, type InsertCrossmintGuardrail,
  type CrossmintTransaction, type InsertCrossmintTransaction,
  type CrossmintApproval, type InsertCrossmintApproval,
  type MasterGuardrail, type InsertMasterGuardrail,
  type SkillDraft, type InsertSkillDraft,
  type SkillEvidence, type InsertSkillEvidence,
  type SkillSubmitterProfile, type InsertSkillSubmitterProfile,
  type SkillVersion, type InsertSkillVersion,
  type SkillExport, type InsertSkillExport,
} from "@/shared/schema";
import { eq, and, isNull, desc, sql, gte, lte, inArray } from "drizzle-orm";

export interface IStorage {
  getOwnerByUid(uid: string): Promise<Owner | null>;
  upsertOwner(uid: string, data: Partial<InsertOwner>): Promise<Owner>;

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

  // ─── Rail 2: Card Wallet (CrossMint + Commerce) ──────────────────
  crossmintCreateWallet(data: InsertCrossmintWallet): Promise<CrossmintWallet>;
  crossmintGetWalletById(id: number): Promise<CrossmintWallet | null>;
  crossmintGetWalletByBotId(botId: string): Promise<CrossmintWallet | null>;
  crossmintGetWalletsByOwnerUid(ownerUid: string): Promise<CrossmintWallet[]>;
  crossmintUpdateWalletBalance(id: number, balanceUsdc: number): Promise<CrossmintWallet | null>;
  crossmintUpdateWalletStatus(id: number, status: string, ownerUid: string): Promise<CrossmintWallet | null>;

  crossmintGetGuardrails(walletId: number): Promise<CrossmintGuardrail | null>;
  crossmintUpsertGuardrails(walletId: number, data: Partial<InsertCrossmintGuardrail>): Promise<CrossmintGuardrail>;

  crossmintCreateTransaction(data: InsertCrossmintTransaction): Promise<CrossmintTransaction>;
  crossmintGetTransactionsByWalletId(walletId: number, limit?: number): Promise<CrossmintTransaction[]>;
  crossmintGetTransactionById(id: number): Promise<CrossmintTransaction | null>;
  crossmintGetTransactionByOrderId(orderId: string): Promise<CrossmintTransaction | null>;
  crossmintUpdateTransaction(id: number, data: Partial<InsertCrossmintTransaction>): Promise<CrossmintTransaction | null>;
  crossmintGetDailySpend(walletId: number): Promise<number>;
  crossmintGetMonthlySpend(walletId: number): Promise<number>;

  crossmintCreateApproval(data: InsertCrossmintApproval): Promise<CrossmintApproval>;
  crossmintGetApproval(id: number): Promise<CrossmintApproval | null>;
  crossmintGetPendingApprovalsByOwnerUid(ownerUid: string): Promise<CrossmintApproval[]>;
  crossmintDecideApproval(id: number, decision: string, decidedBy: string): Promise<CrossmintApproval | null>;

  // ─── Rail 1: Stripe Wallet (Privy + x402) ─────────────────────────
  privyCreateWallet(data: InsertPrivyWallet): Promise<PrivyWallet>;
  privyGetWalletById(id: number): Promise<PrivyWallet | null>;
  privyGetWalletByBotId(botId: string): Promise<PrivyWallet | null>;
  privyGetWalletsByOwnerUid(ownerUid: string): Promise<PrivyWallet[]>;
  privyGetWalletByAddress(address: string): Promise<PrivyWallet | null>;
  privyUpdateWalletBalance(id: number, balanceUsdc: number): Promise<PrivyWallet | null>;
  privyUpdateWalletStatus(id: number, status: string, ownerUid: string): Promise<PrivyWallet | null>;

  privyGetGuardrails(walletId: number): Promise<PrivyGuardrail | null>;
  privyUpsertGuardrails(walletId: number, data: Partial<InsertPrivyGuardrail>): Promise<PrivyGuardrail>;

  privyCreateTransaction(data: InsertPrivyTransaction): Promise<PrivyTransaction>;
  privyGetTransactionsByWalletId(walletId: number, limit?: number): Promise<PrivyTransaction[]>;
  privyUpdateTransactionStatus(id: number, status: string, txHash?: string): Promise<PrivyTransaction | null>;
  privyGetDailySpend(walletId: number): Promise<number>;
  privyGetMonthlySpend(walletId: number): Promise<number>;

  privyCreateApproval(data: InsertPrivyApproval): Promise<PrivyApproval>;
  privyGetApproval(id: number): Promise<PrivyApproval | null>;
  privyGetPendingApprovals(walletId: number): Promise<PrivyApproval[]>;
  privyGetPendingApprovalsByOwnerUid(ownerUid: string): Promise<PrivyApproval[]>;
  privyDecideApproval(id: number, decision: string, decidedBy: string): Promise<PrivyApproval | null>;

  createRail4Card(data: InsertRail4Card): Promise<Rail4Card>;
  getRail4CardByCardId(cardId: string): Promise<Rail4Card | null>;
  getRail4CardByBotId(botId: string): Promise<Rail4Card | null>;
  getRail4CardsByBotId(botId: string): Promise<Rail4Card[]>;
  countCardsByBotId(botId: string): Promise<number>;
  getRail4CardsByOwnerUid(ownerUid: string): Promise<Rail4Card[]>;
  updateRail4CardByCardId(cardId: string, data: Partial<InsertRail4Card>): Promise<Rail4Card | null>;
  updateRail4Card(botId: string, data: Partial<InsertRail4Card>): Promise<Rail4Card | null>;
  deleteRail4CardByCardId(cardId: string): Promise<void>;
  deleteRail4Card(botId: string): Promise<void>;

  createObfuscationEvent(data: InsertObfuscationEvent): Promise<ObfuscationEvent>;
  getObfuscationEventsByCardId(cardId: string, limit?: number): Promise<ObfuscationEvent[]>;
  getObfuscationEventsByBotId(botId: string, limit?: number): Promise<ObfuscationEvent[]>;
  getPendingObfuscationEvents(cardId: string): Promise<ObfuscationEvent[]>;
  completeObfuscationEvent(id: number, occurredAt: Date): Promise<ObfuscationEvent | null>;
  updateObfuscationEventConfirmation(id: number, confirmationId: string): Promise<void>;

  getObfuscationState(cardId: string): Promise<ObfuscationState | null>;
  createObfuscationState(data: InsertObfuscationState): Promise<ObfuscationState>;
  updateObfuscationState(cardId: string, data: Partial<InsertObfuscationState>): Promise<ObfuscationState | null>;
  getActiveObfuscationStates(): Promise<ObfuscationState[]>;

  getProfileAllowanceUsage(cardId: string, profileIndex: number, windowStart: Date): Promise<ProfileAllowanceUsage | null>;
  upsertProfileAllowanceUsage(cardId: string, profileIndex: number, windowStart: Date, addCents: number, markExemptUsed?: boolean): Promise<ProfileAllowanceUsage>;

  createCheckoutConfirmation(data: InsertCheckoutConfirmation): Promise<CheckoutConfirmation>;
  getCheckoutConfirmation(confirmationId: string): Promise<CheckoutConfirmation | null>;
  updateCheckoutConfirmationStatus(confirmationId: string, status: string): Promise<CheckoutConfirmation | null>;
  getPendingConfirmationsByBotIds(botIds: string[]): Promise<CheckoutConfirmation[]>;
  getPendingConfirmationsByCardIds(cardIds: string[]): Promise<CheckoutConfirmation[]>;

  // ─── Master Guardrails (cross-rail spend limits) ───────────────────
  getMasterGuardrails(ownerUid: string): Promise<MasterGuardrail | null>;
  upsertMasterGuardrails(ownerUid: string, data: Partial<InsertMasterGuardrail>): Promise<MasterGuardrail>;
  getMasterDailySpend(ownerUid: string): Promise<{ rail1: number; rail2: number; rail4: number; total: number }>;
  getMasterMonthlySpend(ownerUid: string): Promise<{ rail1: number; rail2: number; rail4: number; total: number }>;

  // ─── Skill Builder (draft management) ──────────────────────────────
  createSkillDraft(data: InsertSkillDraft): Promise<SkillDraft>;
  createSkillDraftWithEvidence(draftData: InsertSkillDraft, evidenceData: InsertSkillEvidence[]): Promise<SkillDraft>;
  getSkillDraft(id: number): Promise<SkillDraft | null>;
  listSkillDrafts(status?: string): Promise<SkillDraft[]>;
  updateSkillDraft(id: number, data: Partial<InsertSkillDraft>): Promise<SkillDraft | null>;
  deleteSkillDraft(id: number): Promise<void>;
  createSkillEvidence(data: InsertSkillEvidence): Promise<SkillEvidence>;
  getSkillEvidenceByDraftId(draftId: number): Promise<SkillEvidence[]>;

  // ─── Skill Submitter Profiles ──────────────────────────────────────
  upsertSubmitterProfile(ownerUid: string, data: Partial<InsertSkillSubmitterProfile>): Promise<SkillSubmitterProfile>;
  getSubmitterProfile(ownerUid: string): Promise<SkillSubmitterProfile | null>;
  incrementSubmitterStat(ownerUid: string, field: "skillsSubmitted" | "skillsPublished" | "skillsRejected"): Promise<void>;
  listSkillDraftsBySubmitter(ownerUid: string): Promise<SkillDraft[]>;

  // ─── Skill Versioning ───────────────────────────────────────────────
  createSkillVersion(data: InsertSkillVersion): Promise<SkillVersion>;
  getSkillVersion(id: number): Promise<SkillVersion | null>;
  getActiveVersion(vendorSlug: string): Promise<SkillVersion | null>;
  listVersionsByVendor(vendorSlug: string): Promise<SkillVersion[]>;
  deactivateVersions(vendorSlug: string): Promise<void>;

  // ─── Skill Exports ──────────────────────────────────────────────────
  createSkillExport(data: InsertSkillExport): Promise<SkillExport>;
  getLastExport(vendorSlug: string, destination: string): Promise<SkillExport | null>;
  listExportsByDestination(destination: string): Promise<SkillExport[]>;
  createSkillExportBatch(items: InsertSkillExport[]): Promise<SkillExport[]>;
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

  async createRail4Card(data: InsertRail4Card): Promise<Rail4Card> {
    const [card] = await db.insert(rail4Cards).values(data).returning();
    return card;
  },

  async getRail4CardByCardId(cardId: string): Promise<Rail4Card | null> {
    const [card] = await db.select().from(rail4Cards).where(eq(rail4Cards.cardId, cardId)).limit(1);
    return card || null;
  },

  async getRail4CardByBotId(botId: string): Promise<Rail4Card | null> {
    const [card] = await db.select().from(rail4Cards).where(eq(rail4Cards.botId, botId)).limit(1);
    return card || null;
  },

  async getRail4CardsByBotId(botId: string): Promise<Rail4Card[]> {
    return db.select().from(rail4Cards).where(eq(rail4Cards.botId, botId)).orderBy(desc(rail4Cards.createdAt));
  },

  async countCardsByBotId(botId: string): Promise<number> {
    const cards = await db.select().from(rail4Cards).where(eq(rail4Cards.botId, botId));
    return cards.length;
  },

  async getRail4CardsByOwnerUid(ownerUid: string): Promise<Rail4Card[]> {
    return db.select().from(rail4Cards).where(eq(rail4Cards.ownerUid, ownerUid)).orderBy(desc(rail4Cards.createdAt));
  },

  async updateRail4CardByCardId(cardId: string, data: Partial<InsertRail4Card>): Promise<Rail4Card | null> {
    const [updated] = await db
      .update(rail4Cards)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rail4Cards.cardId, cardId))
      .returning();
    return updated || null;
  },

  async updateRail4Card(botId: string, data: Partial<InsertRail4Card>): Promise<Rail4Card | null> {
    const [updated] = await db
      .update(rail4Cards)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rail4Cards.botId, botId))
      .returning();
    return updated || null;
  },

  async deleteRail4CardByCardId(cardId: string): Promise<void> {
    await db.delete(rail4Cards).where(eq(rail4Cards.cardId, cardId));
  },

  async deleteRail4Card(botId: string): Promise<void> {
    await db.delete(rail4Cards).where(eq(rail4Cards.botId, botId));
  },

  async createObfuscationEvent(data: InsertObfuscationEvent): Promise<ObfuscationEvent> {
    const [event] = await db.insert(obfuscationEvents).values(data).returning();
    return event;
  },

  async getObfuscationEventsByCardId(cardId: string, limit = 50): Promise<ObfuscationEvent[]> {
    return db
      .select()
      .from(obfuscationEvents)
      .where(eq(obfuscationEvents.cardId, cardId))
      .orderBy(desc(obfuscationEvents.createdAt))
      .limit(limit);
  },

  async getObfuscationEventsByBotId(botId: string, limit = 50): Promise<ObfuscationEvent[]> {
    return db
      .select()
      .from(obfuscationEvents)
      .where(eq(obfuscationEvents.botId, botId))
      .orderBy(desc(obfuscationEvents.createdAt))
      .limit(limit);
  },

  async getPendingObfuscationEvents(cardId: string): Promise<ObfuscationEvent[]> {
    return db
      .select()
      .from(obfuscationEvents)
      .where(and(eq(obfuscationEvents.cardId, cardId), eq(obfuscationEvents.status, "pending")))
      .orderBy(obfuscationEvents.createdAt);
  },

  async completeObfuscationEvent(id: number, occurredAt: Date): Promise<ObfuscationEvent | null> {
    const [updated] = await db
      .update(obfuscationEvents)
      .set({ status: "completed", occurredAt })
      .where(and(eq(obfuscationEvents.id, id), eq(obfuscationEvents.status, "pending")))
      .returning();
    return updated || null;
  },

  async updateObfuscationEventConfirmation(id: number, confirmationId: string): Promise<void> {
    await db
      .update(obfuscationEvents)
      .set({ confirmationId })
      .where(eq(obfuscationEvents.id, id));
  },

  async getObfuscationState(cardId: string): Promise<ObfuscationState | null> {
    const [state] = await db.select().from(obfuscationState).where(eq(obfuscationState.cardId, cardId)).limit(1);
    return state || null;
  },

  async createObfuscationState(data: InsertObfuscationState): Promise<ObfuscationState> {
    const [state] = await db.insert(obfuscationState).values(data).returning();
    return state;
  },

  async updateObfuscationState(cardId: string, data: Partial<InsertObfuscationState>): Promise<ObfuscationState | null> {
    const [updated] = await db
      .update(obfuscationState)
      .set(data)
      .where(eq(obfuscationState.cardId, cardId))
      .returning();
    return updated || null;
  },

  async getActiveObfuscationStates(): Promise<ObfuscationState[]> {
    return db
      .select()
      .from(obfuscationState)
      .where(eq(obfuscationState.active, true));
  },

  async getProfileAllowanceUsage(cardId: string, profileIndex: number, windowStart: Date): Promise<ProfileAllowanceUsage | null> {
    const [usage] = await db
      .select()
      .from(profileAllowanceUsage)
      .where(and(
        eq(profileAllowanceUsage.cardId, cardId),
        eq(profileAllowanceUsage.profileIndex, profileIndex),
        eq(profileAllowanceUsage.windowStart, windowStart),
      ))
      .limit(1);
    return usage || null;
  },

  async upsertProfileAllowanceUsage(cardId: string, profileIndex: number, windowStart: Date, addCents: number, markExemptUsed = false): Promise<ProfileAllowanceUsage> {
    const existing = await this.getProfileAllowanceUsage(cardId, profileIndex, windowStart);
    if (existing) {
      const updateData: Record<string, unknown> = {
        spentCents: sql`${profileAllowanceUsage.spentCents} + ${addCents}`,
      };
      if (markExemptUsed) {
        updateData.exemptUsed = true;
      }
      const [updated] = await db
        .update(profileAllowanceUsage)
        .set(updateData)
        .where(eq(profileAllowanceUsage.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(profileAllowanceUsage)
      .values({
        cardId,
        profileIndex,
        windowStart,
        spentCents: addCents,
        exemptUsed: markExemptUsed,
      })
      .returning();
    return created;
  },

  async createCheckoutConfirmation(data: InsertCheckoutConfirmation): Promise<CheckoutConfirmation> {
    const [conf] = await db.insert(checkoutConfirmations).values(data).returning();
    return conf;
  },

  async getCheckoutConfirmation(confirmationId: string): Promise<CheckoutConfirmation | null> {
    const [conf] = await db
      .select()
      .from(checkoutConfirmations)
      .where(eq(checkoutConfirmations.confirmationId, confirmationId))
      .limit(1);
    return conf || null;
  },

  async updateCheckoutConfirmationStatus(confirmationId: string, status: string): Promise<CheckoutConfirmation | null> {
    const [updated] = await db
      .update(checkoutConfirmations)
      .set({ status, decidedAt: new Date() })
      .where(eq(checkoutConfirmations.confirmationId, confirmationId))
      .returning();
    return updated || null;
  },

  async getPendingConfirmationsByBotIds(botIds: string[]): Promise<CheckoutConfirmation[]> {
    if (botIds.length === 0) return [];
    return db
      .select()
      .from(checkoutConfirmations)
      .where(and(
        inArray(checkoutConfirmations.botId, botIds),
        eq(checkoutConfirmations.status, "pending"),
      ))
      .orderBy(desc(checkoutConfirmations.createdAt));
  },

  async getPendingConfirmationsByCardIds(cardIds: string[]): Promise<CheckoutConfirmation[]> {
    if (cardIds.length === 0) return [];
    return db
      .select()
      .from(checkoutConfirmations)
      .where(and(
        inArray(checkoutConfirmations.cardId, cardIds),
        eq(checkoutConfirmations.status, "pending"),
      ))
      .orderBy(desc(checkoutConfirmations.createdAt));
  },

  // ─── Rail 1: Stripe Wallet (Privy + x402) ─────────────────────────

  async privyCreateWallet(data: InsertPrivyWallet): Promise<PrivyWallet> {
    const [wallet] = await db.insert(privyWallets).values(data).returning();
    return wallet;
  },

  async privyGetWalletById(id: number): Promise<PrivyWallet | null> {
    const [wallet] = await db.select().from(privyWallets).where(eq(privyWallets.id, id)).limit(1);
    return wallet || null;
  },

  async privyGetWalletByBotId(botId: string): Promise<PrivyWallet | null> {
    const [wallet] = await db.select().from(privyWallets).where(eq(privyWallets.botId, botId)).limit(1);
    return wallet || null;
  },

  async privyGetWalletsByOwnerUid(ownerUid: string): Promise<PrivyWallet[]> {
    return db.select().from(privyWallets).where(eq(privyWallets.ownerUid, ownerUid)).orderBy(desc(privyWallets.createdAt));
  },

  async privyGetWalletByAddress(address: string): Promise<PrivyWallet | null> {
    const [wallet] = await db
      .select()
      .from(privyWallets)
      .where(sql`LOWER(${privyWallets.address}) = LOWER(${address})`)
      .limit(1);
    return wallet || null;
  },

  async privyUpdateWalletBalance(id: number, balanceUsdc: number): Promise<PrivyWallet | null> {
    const [updated] = await db
      .update(privyWallets)
      .set({ balanceUsdc, updatedAt: new Date() })
      .where(eq(privyWallets.id, id))
      .returning();
    return updated || null;
  },

  async privyUpdateWalletStatus(id: number, status: string, ownerUid: string): Promise<PrivyWallet | null> {
    const [updated] = await db
      .update(privyWallets)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(privyWallets.id, id), eq(privyWallets.ownerUid, ownerUid)))
      .returning();
    return updated || null;
  },

  async privyGetGuardrails(walletId: number): Promise<PrivyGuardrail | null> {
    const [g] = await db.select().from(privyGuardrails).where(eq(privyGuardrails.walletId, walletId)).limit(1);
    return g || null;
  },

  async privyUpsertGuardrails(walletId: number, data: Partial<InsertPrivyGuardrail>): Promise<PrivyGuardrail> {
    const existing = await this.privyGetGuardrails(walletId);
    if (existing) {
      const [updated] = await db
        .update(privyGuardrails)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(privyGuardrails.walletId, walletId))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(privyGuardrails)
      .values({ walletId, ...data })
      .returning();
    return created;
  },

  async privyCreateTransaction(data: InsertPrivyTransaction): Promise<PrivyTransaction> {
    const [tx] = await db.insert(privyTransactions).values(data).returning();
    return tx;
  },

  async privyGetTransactionsByWalletId(walletId: number, limit = 50): Promise<PrivyTransaction[]> {
    return db
      .select()
      .from(privyTransactions)
      .where(eq(privyTransactions.walletId, walletId))
      .orderBy(desc(privyTransactions.createdAt))
      .limit(limit);
  },

  async privyUpdateTransactionStatus(id: number, status: string, txHash?: string): Promise<PrivyTransaction | null> {
    const updateData: Record<string, unknown> = { status };
    if (txHash) updateData.txHash = txHash;
    if (status === "confirmed") updateData.confirmedAt = new Date();
    const [updated] = await db
      .update(privyTransactions)
      .set(updateData)
      .where(eq(privyTransactions.id, id))
      .returning();
    return updated || null;
  },

  async privyGetDailySpend(walletId: number): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = await db
      .select({ total: sql<number>`COALESCE(SUM(${privyTransactions.amountUsdc}), 0)` })
      .from(privyTransactions)
      .where(and(
        eq(privyTransactions.walletId, walletId),
        eq(privyTransactions.type, "x402_payment"),
        gte(privyTransactions.createdAt, today),
      ));
    return Number(result[0]?.total || 0);
  },

  async privyGetMonthlySpend(walletId: number): Promise<number> {
    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
    firstOfMonth.setHours(0, 0, 0, 0);
    const result = await db
      .select({ total: sql<number>`COALESCE(SUM(${privyTransactions.amountUsdc}), 0)` })
      .from(privyTransactions)
      .where(and(
        eq(privyTransactions.walletId, walletId),
        eq(privyTransactions.type, "x402_payment"),
        gte(privyTransactions.createdAt, firstOfMonth),
      ));
    return Number(result[0]?.total || 0);
  },

  async privyCreateApproval(data: InsertPrivyApproval): Promise<PrivyApproval> {
    const [approval] = await db.insert(privyApprovals).values(data).returning();
    return approval;
  },

  async privyGetApproval(id: number): Promise<PrivyApproval | null> {
    const [approval] = await db.select().from(privyApprovals).where(eq(privyApprovals.id, id)).limit(1);
    return approval || null;
  },

  async privyGetPendingApprovals(walletId: number): Promise<PrivyApproval[]> {
    return db
      .select()
      .from(privyApprovals)
      .where(and(eq(privyApprovals.walletId, walletId), eq(privyApprovals.status, "pending")))
      .orderBy(desc(privyApprovals.createdAt));
  },

  async privyGetPendingApprovalsByOwnerUid(ownerUid: string): Promise<PrivyApproval[]> {
    const wallets = await this.privyGetWalletsByOwnerUid(ownerUid);
    if (wallets.length === 0) return [];
    const walletIds = wallets.map(w => w.id);
    return db
      .select()
      .from(privyApprovals)
      .where(and(
        inArray(privyApprovals.walletId, walletIds),
        eq(privyApprovals.status, "pending"),
      ))
      .orderBy(desc(privyApprovals.createdAt));
  },

  async privyDecideApproval(id: number, decision: string, decidedBy: string): Promise<PrivyApproval | null> {
    const [updated] = await db
      .update(privyApprovals)
      .set({ status: decision, decidedAt: new Date(), decidedBy })
      .where(and(eq(privyApprovals.id, id), eq(privyApprovals.status, "pending")))
      .returning();
    return updated || null;
  },

  // ─── Rail 2: Card Wallet (CrossMint + Commerce) ─────────────────────────

  async crossmintCreateWallet(data: InsertCrossmintWallet): Promise<CrossmintWallet> {
    const [wallet] = await db.insert(crossmintWallets).values(data).returning();
    return wallet;
  },

  async crossmintGetWalletById(id: number): Promise<CrossmintWallet | null> {
    const [wallet] = await db.select().from(crossmintWallets).where(eq(crossmintWallets.id, id)).limit(1);
    return wallet || null;
  },

  async crossmintGetWalletByBotId(botId: string): Promise<CrossmintWallet | null> {
    const [wallet] = await db.select().from(crossmintWallets).where(eq(crossmintWallets.botId, botId)).limit(1);
    return wallet || null;
  },

  async crossmintGetWalletsByOwnerUid(ownerUid: string): Promise<CrossmintWallet[]> {
    return db.select().from(crossmintWallets).where(eq(crossmintWallets.ownerUid, ownerUid)).orderBy(desc(crossmintWallets.createdAt));
  },

  async crossmintUpdateWalletBalance(id: number, balanceUsdc: number): Promise<CrossmintWallet | null> {
    const [updated] = await db
      .update(crossmintWallets)
      .set({ balanceUsdc, updatedAt: new Date() })
      .where(eq(crossmintWallets.id, id))
      .returning();
    return updated || null;
  },

  async crossmintUpdateWalletStatus(id: number, status: string, ownerUid: string): Promise<CrossmintWallet | null> {
    const [updated] = await db
      .update(crossmintWallets)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(crossmintWallets.id, id), eq(crossmintWallets.ownerUid, ownerUid)))
      .returning();
    return updated || null;
  },

  async crossmintGetGuardrails(walletId: number): Promise<CrossmintGuardrail | null> {
    const [g] = await db.select().from(crossmintGuardrails).where(eq(crossmintGuardrails.walletId, walletId)).limit(1);
    return g || null;
  },

  async crossmintUpsertGuardrails(walletId: number, data: Partial<InsertCrossmintGuardrail>): Promise<CrossmintGuardrail> {
    const existing = await this.crossmintGetGuardrails(walletId);
    if (existing) {
      const [updated] = await db
        .update(crossmintGuardrails)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(crossmintGuardrails.walletId, walletId))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(crossmintGuardrails)
      .values({ walletId, ...data })
      .returning();
    return created;
  },

  async crossmintCreateTransaction(data: InsertCrossmintTransaction): Promise<CrossmintTransaction> {
    const [tx] = await db.insert(crossmintTransactions).values(data).returning();
    return tx;
  },

  async crossmintGetTransactionsByWalletId(walletId: number, limit = 50): Promise<CrossmintTransaction[]> {
    return db
      .select()
      .from(crossmintTransactions)
      .where(eq(crossmintTransactions.walletId, walletId))
      .orderBy(desc(crossmintTransactions.createdAt))
      .limit(limit);
  },

  async crossmintGetTransactionById(id: number): Promise<CrossmintTransaction | null> {
    const [tx] = await db.select().from(crossmintTransactions).where(eq(crossmintTransactions.id, id)).limit(1);
    return tx || null;
  },

  async crossmintGetTransactionByOrderId(orderId: string): Promise<CrossmintTransaction | null> {
    const [tx] = await db.select().from(crossmintTransactions).where(eq(crossmintTransactions.crossmintOrderId, orderId)).limit(1);
    return tx || null;
  },

  async crossmintUpdateTransaction(id: number, data: Partial<InsertCrossmintTransaction>): Promise<CrossmintTransaction | null> {
    const [updated] = await db
      .update(crossmintTransactions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crossmintTransactions.id, id))
      .returning();
    return updated || null;
  },

  async crossmintGetDailySpend(walletId: number): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const [result] = await db
      .select({ total: sql<number>`COALESCE(SUM(${crossmintTransactions.amountUsdc}), 0)` })
      .from(crossmintTransactions)
      .where(and(
        eq(crossmintTransactions.walletId, walletId),
        eq(crossmintTransactions.type, "purchase"),
        gte(crossmintTransactions.createdAt, startOfDay),
        sql`${crossmintTransactions.status} NOT IN ('failed')`
      ));
    return Number(result?.total || 0);
  },

  async crossmintGetMonthlySpend(walletId: number): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const [result] = await db
      .select({ total: sql<number>`COALESCE(SUM(${crossmintTransactions.amountUsdc}), 0)` })
      .from(crossmintTransactions)
      .where(and(
        eq(crossmintTransactions.walletId, walletId),
        eq(crossmintTransactions.type, "purchase"),
        gte(crossmintTransactions.createdAt, startOfMonth),
        sql`${crossmintTransactions.status} NOT IN ('failed')`
      ));
    return Number(result?.total || 0);
  },

  async crossmintCreateApproval(data: InsertCrossmintApproval): Promise<CrossmintApproval> {
    const [approval] = await db.insert(crossmintApprovals).values(data).returning();
    return approval;
  },

  async crossmintGetApproval(id: number): Promise<CrossmintApproval | null> {
    const [approval] = await db.select().from(crossmintApprovals).where(eq(crossmintApprovals.id, id)).limit(1);
    return approval || null;
  },

  async crossmintGetPendingApprovalsByOwnerUid(ownerUid: string): Promise<CrossmintApproval[]> {
    const walletList = await this.crossmintGetWalletsByOwnerUid(ownerUid);
    if (walletList.length === 0) return [];
    const walletIds = walletList.map(w => w.id);
    return db
      .select()
      .from(crossmintApprovals)
      .where(and(
        inArray(crossmintApprovals.walletId, walletIds),
        eq(crossmintApprovals.status, "pending"),
      ))
      .orderBy(desc(crossmintApprovals.createdAt));
  },

  async crossmintDecideApproval(id: number, decision: string, decidedBy: string): Promise<CrossmintApproval | null> {
    const [updated] = await db
      .update(crossmintApprovals)
      .set({ status: decision, decidedAt: new Date(), decidedBy })
      .where(and(eq(crossmintApprovals.id, id), eq(crossmintApprovals.status, "pending")))
      .returning();
    return updated || null;
  },

  // ─── Owners ──────────────────────────────────────────────────────────

  async getOwnerByUid(uid: string): Promise<Owner | null> {
    const [row] = await db.select().from(owners).where(eq(owners.uid, uid)).limit(1);
    return row || null;
  },

  async upsertOwner(uid: string, data: Partial<InsertOwner>): Promise<Owner> {
    const existing = await this.getOwnerByUid(uid);
    if (existing) {
      const [updated] = await db
        .update(owners)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(owners.uid, uid))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(owners)
      .values({ uid, email: data.email || "", ...data })
      .returning();
    return created;
  },

  // ─── Master Guardrails (cross-rail spend limits) ───────────────────

  async getMasterGuardrails(ownerUid: string): Promise<MasterGuardrail | null> {
    const [row] = await db.select().from(masterGuardrails).where(eq(masterGuardrails.ownerUid, ownerUid)).limit(1);
    return row || null;
  },

  async upsertMasterGuardrails(ownerUid: string, data: Partial<InsertMasterGuardrail>): Promise<MasterGuardrail> {
    const existing = await this.getMasterGuardrails(ownerUid);
    if (existing) {
      const [updated] = await db
        .update(masterGuardrails)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(masterGuardrails.ownerUid, ownerUid))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(masterGuardrails)
      .values({ ownerUid, ...data })
      .returning();
    return created;
  },

  async getMasterDailySpend(ownerUid: string): Promise<{ rail1: number; rail2: number; rail4: number; total: number }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [r1] = await db
      .select({ total: sql<number>`COALESCE(SUM(${privyTransactions.amountUsdc}), 0)` })
      .from(privyTransactions)
      .innerJoin(privyWallets, eq(privyTransactions.walletId, privyWallets.id))
      .where(and(
        eq(privyWallets.ownerUid, ownerUid),
        eq(privyTransactions.type, "x402_payment"),
        gte(privyTransactions.createdAt, startOfDay),
        sql`${privyTransactions.status} NOT IN ('failed')`,
      ));

    const [r2] = await db
      .select({ total: sql<number>`COALESCE(SUM(${crossmintTransactions.amountUsdc}), 0)` })
      .from(crossmintTransactions)
      .innerJoin(crossmintWallets, eq(crossmintTransactions.walletId, crossmintWallets.id))
      .where(and(
        eq(crossmintWallets.ownerUid, ownerUid),
        eq(crossmintTransactions.type, "purchase"),
        gte(crossmintTransactions.createdAt, startOfDay),
        sql`${crossmintTransactions.status} NOT IN ('failed')`,
      ));

    const [r4] = await db
      .select({ total: sql<number>`COALESCE(SUM(${checkoutConfirmations.amountCents}), 0)` })
      .from(checkoutConfirmations)
      .innerJoin(rail4Cards, eq(checkoutConfirmations.cardId, rail4Cards.cardId))
      .where(and(
        eq(rail4Cards.ownerUid, ownerUid),
        eq(checkoutConfirmations.status, "approved"),
        gte(checkoutConfirmations.createdAt, startOfDay),
        eq(checkoutConfirmations.profileIndex, sql`${rail4Cards.realProfileIndex}`),
      ));

    const rail1 = Number(r1?.total || 0);
    const rail2 = Number(r2?.total || 0);
    const rail4Cents = Number(r4?.total || 0);
    const rail4 = rail4Cents * 10_000;
    return { rail1, rail2, rail4, total: rail1 + rail2 + rail4 };
  },

  async getMasterMonthlySpend(ownerUid: string): Promise<{ rail1: number; rail2: number; rail4: number; total: number }> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [r1] = await db
      .select({ total: sql<number>`COALESCE(SUM(${privyTransactions.amountUsdc}), 0)` })
      .from(privyTransactions)
      .innerJoin(privyWallets, eq(privyTransactions.walletId, privyWallets.id))
      .where(and(
        eq(privyWallets.ownerUid, ownerUid),
        eq(privyTransactions.type, "x402_payment"),
        gte(privyTransactions.createdAt, startOfMonth),
        sql`${privyTransactions.status} NOT IN ('failed')`,
      ));

    const [r2] = await db
      .select({ total: sql<number>`COALESCE(SUM(${crossmintTransactions.amountUsdc}), 0)` })
      .from(crossmintTransactions)
      .innerJoin(crossmintWallets, eq(crossmintTransactions.walletId, crossmintWallets.id))
      .where(and(
        eq(crossmintWallets.ownerUid, ownerUid),
        eq(crossmintTransactions.type, "purchase"),
        gte(crossmintTransactions.createdAt, startOfMonth),
        sql`${crossmintTransactions.status} NOT IN ('failed')`,
      ));

    const [r4] = await db
      .select({ total: sql<number>`COALESCE(SUM(${checkoutConfirmations.amountCents}), 0)` })
      .from(checkoutConfirmations)
      .innerJoin(rail4Cards, eq(checkoutConfirmations.cardId, rail4Cards.cardId))
      .where(and(
        eq(rail4Cards.ownerUid, ownerUid),
        eq(checkoutConfirmations.status, "approved"),
        gte(checkoutConfirmations.createdAt, startOfMonth),
        eq(checkoutConfirmations.profileIndex, sql`${rail4Cards.realProfileIndex}`),
      ));

    const rail1 = Number(r1?.total || 0);
    const rail2 = Number(r2?.total || 0);
    const rail4Cents = Number(r4?.total || 0);
    const rail4 = rail4Cents * 10_000;
    return { rail1, rail2, rail4, total: rail1 + rail2 + rail4 };
  },

  async createSkillDraft(data: InsertSkillDraft): Promise<SkillDraft> {
    const [draft] = await db.insert(skillDrafts).values(data).returning();
    return draft;
  },

  async createSkillDraftWithEvidence(draftData: InsertSkillDraft, evidenceData: InsertSkillEvidence[]): Promise<SkillDraft> {
    return db.transaction(async (tx) => {
      const [draft] = await tx.insert(skillDrafts).values(draftData).returning();
      if (evidenceData.length > 0) {
        await tx.insert(skillEvidence).values(
          evidenceData.map(ev => ({ ...ev, draftId: draft.id }))
        );
      }
      return draft;
    });
  },

  async getSkillDraft(id: number): Promise<SkillDraft | null> {
    const [draft] = await db.select().from(skillDrafts).where(eq(skillDrafts.id, id)).limit(1);
    return draft ?? null;
  },

  async listSkillDrafts(status?: string): Promise<SkillDraft[]> {
    if (status) {
      return db.select().from(skillDrafts).where(eq(skillDrafts.status, status)).orderBy(desc(skillDrafts.createdAt));
    }
    return db.select().from(skillDrafts).orderBy(desc(skillDrafts.createdAt));
  },

  async updateSkillDraft(id: number, data: Partial<InsertSkillDraft>): Promise<SkillDraft | null> {
    const [draft] = await db.update(skillDrafts).set({ ...data, updatedAt: new Date() }).where(eq(skillDrafts.id, id)).returning();
    return draft ?? null;
  },

  async deleteSkillDraft(id: number): Promise<void> {
    await db.delete(skillEvidence).where(eq(skillEvidence.draftId, id));
    await db.delete(skillDrafts).where(eq(skillDrafts.id, id));
  },

  async createSkillEvidence(data: InsertSkillEvidence): Promise<SkillEvidence> {
    const [evidence] = await db.insert(skillEvidence).values(data).returning();
    return evidence;
  },

  async getSkillEvidenceByDraftId(draftId: number): Promise<SkillEvidence[]> {
    return db.select().from(skillEvidence).where(eq(skillEvidence.draftId, draftId)).orderBy(skillEvidence.field);
  },

  async upsertSubmitterProfile(ownerUid: string, data: Partial<InsertSkillSubmitterProfile>): Promise<SkillSubmitterProfile> {
    const existing = await db.select().from(skillSubmitterProfiles).where(eq(skillSubmitterProfiles.ownerUid, ownerUid)).limit(1);
    if (existing.length > 0) {
      const [updated] = await db.update(skillSubmitterProfiles)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(skillSubmitterProfiles.ownerUid, ownerUid))
        .returning();
      return updated;
    }
    const [profile] = await db.insert(skillSubmitterProfiles)
      .values({ ownerUid, ...data })
      .returning();
    return profile;
  },

  async getSubmitterProfile(ownerUid: string): Promise<SkillSubmitterProfile | null> {
    const [profile] = await db.select().from(skillSubmitterProfiles).where(eq(skillSubmitterProfiles.ownerUid, ownerUid)).limit(1);
    return profile ?? null;
  },

  async incrementSubmitterStat(ownerUid: string, field: "skillsSubmitted" | "skillsPublished" | "skillsRejected"): Promise<void> {
    const existing = await db.select().from(skillSubmitterProfiles).where(eq(skillSubmitterProfiles.ownerUid, ownerUid)).limit(1);
    if (existing.length === 0) {
      await db.insert(skillSubmitterProfiles).values({ ownerUid, [field]: 1 });
    } else {
      await db.update(skillSubmitterProfiles)
        .set({ [field]: sql`${skillSubmitterProfiles[field]} + 1`, updatedAt: new Date() })
        .where(eq(skillSubmitterProfiles.ownerUid, ownerUid));
    }
  },

  async listSkillDraftsBySubmitter(ownerUid: string): Promise<SkillDraft[]> {
    return db.select().from(skillDrafts)
      .where(eq(skillDrafts.submitterUid, ownerUid))
      .orderBy(desc(skillDrafts.createdAt));
  },

  async createSkillVersion(data: InsertSkillVersion): Promise<SkillVersion> {
    const [version] = await db.insert(skillVersions).values(data).returning();
    return version;
  },

  async getSkillVersion(id: number): Promise<SkillVersion | null> {
    const [version] = await db.select().from(skillVersions).where(eq(skillVersions.id, id)).limit(1);
    return version ?? null;
  },

  async getActiveVersion(vendorSlug: string): Promise<SkillVersion | null> {
    const [version] = await db.select().from(skillVersions)
      .where(and(eq(skillVersions.vendorSlug, vendorSlug), eq(skillVersions.isActive, true)))
      .limit(1);
    return version ?? null;
  },

  async listVersionsByVendor(vendorSlug: string): Promise<SkillVersion[]> {
    return db.select().from(skillVersions)
      .where(eq(skillVersions.vendorSlug, vendorSlug))
      .orderBy(desc(skillVersions.createdAt));
  },

  async deactivateVersions(vendorSlug: string): Promise<void> {
    await db.update(skillVersions)
      .set({ isActive: false })
      .where(and(eq(skillVersions.vendorSlug, vendorSlug), eq(skillVersions.isActive, true)));
  },

  async createSkillExport(data: InsertSkillExport): Promise<SkillExport> {
    const [exp] = await db.insert(skillExports).values(data).returning();
    return exp;
  },

  async getLastExport(vendorSlug: string, destination: string): Promise<SkillExport | null> {
    const [exp] = await db.select().from(skillExports)
      .where(and(eq(skillExports.vendorSlug, vendorSlug), eq(skillExports.destination, destination)))
      .orderBy(desc(skillExports.exportedAt))
      .limit(1);
    return exp ?? null;
  },

  async listExportsByDestination(destination: string): Promise<SkillExport[]> {
    return db.select().from(skillExports)
      .where(eq(skillExports.destination, destination))
      .orderBy(desc(skillExports.exportedAt));
  },

  async createSkillExportBatch(items: InsertSkillExport[]): Promise<SkillExport[]> {
    if (items.length === 0) return [];
    return db.insert(skillExports).values(items).returning();
  },
};
