import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";

export async function DELETE(request: Request) {
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
      return NextResponse.json({ error: "not_found", message: "No Rail 4 configuration found for this bot" }, { status: 404 });
    }

    await storage.deleteRail4Card(botId);

    return NextResponse.json({
      message: "Rail 4 configuration has been deleted. You can re-initialize at any time.",
    });
  } catch (error) {
    console.error("Rail 4 delete error:", error);
    return NextResponse.json({ error: "Failed to delete Rail 4 configuration" }, { status: 500 });
  }
}
