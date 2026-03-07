import { NextResponse } from "next/server";
import { withBotApi } from "@/lib/agent-management/agent-api/middleware";
import { storage } from "@/server/storage";

export const POST = withBotApi("/api/v1/bot/rail5/confirm-delivery", async (_request, { bot }) => {
  const card = await storage.getRail5CardByBotId(bot.botId);
  if (!card) {
    return NextResponse.json(
      { error: "no_card", message: "No Rail 5 card is linked to this bot." },
      { status: 404 }
    );
  }

  if (card.status !== "pending_delivery") {
    return NextResponse.json(
      { error: "invalid_status", message: `Card is in '${card.status}' status, not 'pending_delivery'.` },
      { status: 409 }
    );
  }

  await storage.updateRail5Card(card.cardId, { status: "confirmed" });

  try {
    await storage.deletePendingMessagesByRef(bot.botId, "rail5.card.delivered", "card_id", card.cardId);
  } catch (err) {
    console.error("[confirm-delivery] Failed to clean up pending messages:", err);
  }

  return NextResponse.json({
    status: "confirmed",
    card_id: card.cardId,
    message: "Delivery confirmed. Card is now ready for checkout.",
  });
});
