import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";

export async function DELETE(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const botId = request.nextUrl.searchParams.get("bot_id");
  if (!botId) {
    return NextResponse.json({ error: "missing_bot_id" }, { status: 400 });
  }

  const bot = await storage.getBotByBotId(botId);
  if (!bot || bot.ownerUid !== user.uid) {
    return NextResponse.json({ error: "bot_not_found" }, { status: 404 });
  }

  await storage.deleteRail4Card(botId);

  return NextResponse.json({ deleted: true });
}
