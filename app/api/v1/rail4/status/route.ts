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

    if (!botId) {
      return NextResponse.json({ error: "validation_error", message: "bot_id query parameter is required" }, { status: 400 });
    }

    const bot = await storage.getBotByBotId(botId);
    if (!bot || bot.ownerUid !== user.uid) {
      return NextResponse.json({ error: "not_found", message: "Bot not found or not owned by you" }, { status: 404 });
    }

    const rail4Card = await storage.getRail4CardByBotId(botId);
    if (!rail4Card) {
      return NextResponse.json({
        configured: false,
        status: "not_configured",
        message: "Rail 4 has not been set up for this bot.",
      });
    }

    return NextResponse.json({
      configured: true,
      status: rail4Card.status,
      decoy_filename: rail4Card.decoyFilename,
      real_profile_index: rail4Card.realProfileIndex,
      missing_digit_positions: rail4Card.missingDigitPositions,
      created_at: rail4Card.createdAt,
      updated_at: rail4Card.updatedAt,
    });
  } catch (error) {
    console.error("Rail 4 status error:", error);
    return NextResponse.json({ error: "Failed to get Rail 4 status" }, { status: 500 });
  }
}
