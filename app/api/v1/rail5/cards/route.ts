import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cards = await storage.getRail5CardsByOwnerUid(user.uid);

  const result = cards.map((c) => ({
    card_id: c.cardId,
    card_name: c.cardName,
    card_brand: c.cardBrand,
    card_last4: c.cardLast4,
    status: c.status,
    bot_id: c.botId || null,
    spending_limit_cents: c.spendingLimitCents,
    daily_limit_cents: c.dailyLimitCents,
    monthly_limit_cents: c.monthlyLimitCents,
    human_approval_above_cents: c.humanApprovalAboveCents,
    created_at: c.createdAt.toISOString(),
  }));

  return NextResponse.json({ cards: result });
}
