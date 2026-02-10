import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";
import { getObfuscationStatus } from "@/lib/obfuscation-engine/state-machine";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const botId = searchParams.get("bot_id");

    if (!botId) {
      return NextResponse.json({ error: "bot_id is required" }, { status: 400 });
    }

    const bot = await storage.getBotByBotId(botId);
    if (!bot || bot.ownerUid !== user.uid) {
      return NextResponse.json({ error: "Bot not found or not owned by you" }, { status: 404 });
    }

    const status = await getObfuscationStatus(botId);

    return NextResponse.json(status);
  } catch (error) {
    console.error("Obfuscation status error:", error);
    return NextResponse.json({ error: "Failed to get obfuscation status" }, { status: 500 });
  }
}
