import { NextResponse } from "next/server";
import { withBotApi } from "@/lib/bot-api";
import { storage } from "@/server/storage";
import { createObfuscationEvent } from "@/lib/obfuscation-engine/events";

export const POST = withBotApi("/api/v1/bot/obfuscation/next", async (request, { bot }) => {
  const rail4Card = await storage.getRail4CardByBotId(bot.botId);
  if (!rail4Card || rail4Card.status !== "active") {
    return NextResponse.json(
      { error: "not_configured", message: "Self-hosted card is not active for this bot." },
      { status: 404 }
    );
  }

  const pending = await storage.getPendingObfuscationEvents(bot.botId);
  if (pending.length > 0) {
    const event = pending[0];
    const fakeProfiles = JSON.parse(rail4Card.fakeProfilesJson);
    const profile = fakeProfiles.find((p: any) => p.profileIndex === event.profileIndex);

    return NextResponse.json({
      event_id: event.id,
      profile_index: event.profileIndex,
      merchant_name: event.merchantName,
      merchant_url: `/merchant/${event.merchantSlug}`,
      item_name: event.itemName,
      amount_usd: event.amountCents / 100,
      profile_name: profile?.name || "Unknown",
      message: `Purchase "${event.itemName}" at ${event.merchantName} using Profile #${event.profileIndex}. Proceed to checkout and verify your card details.`,
    });
  }

  const { event, merchantUrl } = await createObfuscationEvent(bot.botId, rail4Card);
  const fakeProfiles = JSON.parse(rail4Card.fakeProfilesJson);
  const profile = fakeProfiles.find((p: any) => p.profileIndex === event.profileIndex);

  return NextResponse.json({
    event_id: event.id,
    profile_index: event.profileIndex,
    merchant_name: event.merchantName,
    merchant_url: merchantUrl,
    item_name: event.itemName,
    amount_usd: event.amountCents / 100,
    profile_name: profile?.name || "Unknown",
    message: `Purchase "${event.itemName}" at ${event.merchantName} using Profile #${event.profileIndex}. Proceed to checkout and verify your card details.`,
  });
});
