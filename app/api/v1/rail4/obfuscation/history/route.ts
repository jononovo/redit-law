import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const botId = searchParams.get("bot_id");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    if (!botId) {
      return NextResponse.json({ error: "bot_id is required" }, { status: 400 });
    }

    const bot = await storage.getBotByBotId(botId);
    if (!bot || bot.ownerUid !== user.uid) {
      return NextResponse.json({ error: "Bot not found or not owned by you" }, { status: 404 });
    }

    const events = await storage.getObfuscationEventsByBotId(botId, limit);

    return NextResponse.json({
      events: events.map((e) => ({
        id: e.id,
        profile_index: e.profileIndex,
        merchant_name: e.merchantName,
        item_name: e.itemName,
        amount_usd: e.amountCents / 100,
        status: e.status,
        occurred_at: e.occurredAt?.toISOString() || null,
        created_at: e.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Obfuscation history error:", error);
    return NextResponse.json({ error: "Failed to get obfuscation history" }, { status: 500 });
  }
}
