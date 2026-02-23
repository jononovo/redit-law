import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cards = await storage.getRail5CardsByOwnerUid(user.uid);

  const botIds = [...new Set(cards.map((c) => c.botId).filter(Boolean))] as string[];
  const botLookup: Record<string, string> = {};
  await Promise.all(
    botIds.map(async (botId) => {
      const bot = await storage.getBotByBotId(botId);
      if (bot) botLookup[botId] = bot.botName;
    })
  );

  const result = cards.map((c) => ({
    card_id: c.cardId,
    card_name: c.cardName,
    card_brand: c.cardBrand,
    card_last4: c.cardLast4,
    status: c.status,
    bot_id: c.botId || null,
    bot_name: c.botId ? (botLookup[c.botId] || null) : null,
    spending_limit_cents: c.spendingLimitCents,
    daily_limit_cents: c.dailyLimitCents,
    monthly_limit_cents: c.monthlyLimitCents,
    human_approval_above_cents: c.humanApprovalAboveCents,
    created_at: c.createdAt.toISOString(),
  }));

  return NextResponse.json({ cards: result });
}
