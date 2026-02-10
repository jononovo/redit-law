import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const botId = request.nextUrl.searchParams.get("bot_id");
  if (!botId) {
    return NextResponse.json({ error: "missing_bot_id" }, { status: 400 });
  }

  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 100);

  const bot = await storage.getBotByBotId(botId);
  if (!bot || bot.ownerUid !== user.uid) {
    return NextResponse.json({ error: "bot_not_found" }, { status: 404 });
  }

  const events = await storage.getObfuscationEventsByBotId(botId, limit);

  return NextResponse.json({
    events: events.map(e => ({
      id: e.id,
      profile_index: e.profileIndex,
      merchant_name: e.merchantName,
      merchant_slug: e.merchantSlug,
      item_name: e.itemName,
      amount_usd: e.amountCents / 100,
      status: e.status,
      occurred_at: e.occurredAt?.toISOString() || null,
      created_at: e.createdAt.toISOString(),
    })),
  });
}
