import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cards = await storage.getRail4CardsByOwnerUid(user.uid);

  return NextResponse.json({
    cards: cards.map(c => ({
      card_id: c.cardId,
      card_name: c.cardName || "Untitled Card",
      use_case: c.useCase || null,
      status: c.status,
      bot_id: c.botId || null,
      created_at: c.createdAt.toISOString(),
    })),
  });
}
