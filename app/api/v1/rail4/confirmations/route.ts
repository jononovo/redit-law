import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cards = await storage.getRail4CardsByOwnerUid(user.uid);
  const cardIds = cards.map(c => c.cardId);

  if (cardIds.length === 0) {
    return NextResponse.json({ confirmations: [] });
  }

  const confirmations = await storage.getPendingConfirmationsByCardIds(cardIds);

  const cardMap = new Map(cards.map(c => [c.cardId, c]));

  const bots = await storage.getBotsByOwnerUid(user.uid);
  const botMap = new Map(bots.map(b => [b.botId, b.botName]));

  return NextResponse.json({
    confirmations: confirmations.map(c => ({
      confirmation_id: c.confirmationId,
      card_id: c.cardId,
      card_name: cardMap.get(c.cardId)?.cardName || "Untitled Card",
      bot_id: c.botId,
      bot_name: botMap.get(c.botId) || c.botId,
      profile_index: c.profileIndex,
      amount_usd: c.amountCents / 100,
      merchant_name: c.merchantName,
      item_name: c.itemName,
      category: c.category,
      status: c.status,
      expires_at: c.expiresAt?.toISOString() || null,
      created_at: c.createdAt.toISOString(),
    })),
  });
}
