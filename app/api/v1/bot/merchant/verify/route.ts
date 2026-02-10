import { NextResponse } from "next/server";
import { withBotApi } from "@/lib/bot-api";
import { storage } from "@/server/storage";
import { getEventForVerification, getFakeProfileData } from "@/lib/obfuscation-engine/events";
import { z } from "zod";

const verifySchema = z.object({
  event_id: z.number().int().min(1),
  missing_digits: z.string().length(3).regex(/^\d{3}$/),
  expiry_month: z.number().int().min(1).max(12),
  expiry_year: z.number().int().min(2025).max(2040),
});

export const POST = withBotApi("/api/v1/bot/merchant/verify", async (request, { bot }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", message: "Invalid request body", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { event_id, missing_digits, expiry_month, expiry_year } = parsed.data;

  const event = await getEventForVerification(event_id, bot.botId);
  if (!event) {
    return NextResponse.json(
      { error: "not_found", message: "No pending merchant event found with this ID." },
      { status: 404 }
    );
  }

  const rail4Card = await storage.getRail4CardByBotId(bot.botId);
  if (!rail4Card) {
    return NextResponse.json(
      { error: "not_configured", message: "Self-hosted card not configured." },
      { status: 404 }
    );
  }

  const fakeData = getFakeProfileData(rail4Card, event.profileIndex);
  if (!fakeData) {
    return NextResponse.json(
      { error: "profile_error", message: "Could not locate profile data." },
      { status: 500 }
    );
  }

  const digitsMatch = missing_digits === fakeData.missingDigits;
  const expiryMatch = expiry_month === fakeData.expiryMonth && expiry_year === fakeData.expiryYear;

  if (!digitsMatch || !expiryMatch) {
    return NextResponse.json({
      verified: false,
      message: "Card verification failed. The provided details do not match.",
    });
  }

  return NextResponse.json({
    verified: true,
    message: "Card details verified successfully. Proceed to complete the purchase.",
  });
});
