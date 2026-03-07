import { NextResponse } from "next/server";
import { withBotApi } from "@/lib/agent-management/agent-api/middleware";
import { storage } from "@/server/storage";
import { RAIL5_TEST_CHECKOUT_URL } from "@/lib/rail5";

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
    card_name: card.cardName,
    message: "Card confirmed. Complete a test purchase to verify your card works end-to-end.",
    test_checkout_url: RAIL5_TEST_CHECKOUT_URL,
    test_instructions: [
      `Navigate to ${RAIL5_TEST_CHECKOUT_URL} to complete a test purchase.`,
      "This is a sandbox checkout — no real payment will be processed.",
      "Use the encrypted card file you just saved to decrypt and enter the card details.",
      "Fill in all fields: card number, expiry, CVV, cardholder name, and billing address.",
      "Submit the payment. The system will verify that the card details were decrypted correctly.",
      "This proves your card file works end-to-end before any real purchase.",
    ].join("\n"),
  });
});
