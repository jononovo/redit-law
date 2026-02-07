import { db } from "@/server/db";
import { bots, type InsertBot, type Bot } from "@/shared/schema";
import { eq, and, isNull, isNotNull } from "drizzle-orm";

export interface IStorage {
  createBot(data: InsertBot): Promise<Bot>;
  getBotByClaimToken(token: string): Promise<Bot | null>;
  getBotByBotId(botId: string): Promise<Bot | null>;
  getBotsByOwnerEmail(email: string): Promise<Bot[]>;
  getBotsByOwnerUid(ownerUid: string): Promise<Bot[]>;
  claimBot(claimToken: string, ownerUid: string): Promise<Bot | null>;
  checkDuplicateRegistration(botName: string, ownerEmail: string): Promise<boolean>;
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

    return updated || null;
  },

  async checkDuplicateRegistration(botName: string, ownerEmail: string): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(bots)
      .where(and(eq(bots.botName, botName), eq(bots.ownerEmail, ownerEmail)))
      .limit(1);
    return !!existing;
  },
};
