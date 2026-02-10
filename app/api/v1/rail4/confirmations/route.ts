import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";

export async function GET(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const bots = await storage.getBotsByOwnerUid(user.uid);
  const botIds = bots.map(b => b.botId);

  const confirmations = await storage.getPendingConfirmationsByBotIds(botIds);

  const botMap = new Map(bots.map(b => [b.botId, b.botName]));

  return NextResponse.json({
    confirmations: confirmations.map(c => ({
      confirmation_id: c.confirmationId,
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
