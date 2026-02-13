import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { card_id } = body;
  if (!card_id || typeof card_id !== "string") {
    return NextResponse.json({ error: "missing_card_id", message: "card_id is required." }, { status: 400 });
  }

  const card = await storage.getRail4CardByCardId(card_id);
  if (!card || card.ownerUid !== user.uid) {
    return NextResponse.json({ error: "card_not_found" }, { status: 404 });
  }

  if (card.status !== "awaiting_bot") {
    return NextResponse.json({ error: "invalid_status", message: "Card must be in 'awaiting_bot' status to link a bot." }, { status: 400 });
  }

  const ownerBots = await storage.getBotsByOwnerUid(user.uid);
  if (ownerBots.length === 0) {
    return NextResponse.json({ error: "no_bot", message: "You don't have a bot on this account." }, { status: 400 });
  }

  const bot = ownerBots[0];

  const cardCount = await storage.countCardsByBotId(bot.botId);
  if (cardCount >= 3) {
    return NextResponse.json({
      error: "max_cards_reached",
      message: "This bot already has the maximum of 3 cards linked.",
      card_count: cardCount,
      max_cards: 3,
    }, { status: 400 });
  }

  await storage.updateRail4CardByCardId(card_id, {
    botId: bot.botId,
    status: "active",
  } as any);

  return NextResponse.json({
    status: "active",
    card_id,
    bot_id: bot.botId,
    bot_name: bot.botName,
    message: "Bot linked to card. Card is now active.",
  });
}
