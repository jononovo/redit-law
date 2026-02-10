import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";

export async function GET(request: NextRequest) {
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

  const state = await storage.getObfuscationState(botId);
  if (!state) {
    return NextResponse.json({
      initialized: false,
      phase: null,
      active: false,
    });
  }

  return NextResponse.json({
    initialized: true,
    phase: state.phase,
    active: state.active,
    activated_at: state.activatedAt.toISOString(),
    last_organic_at: state.lastOrganicAt?.toISOString() || null,
    last_obfuscation_at: state.lastObfuscationAt?.toISOString() || null,
    organic_count: state.organicCount,
    obfuscation_count: state.obfuscationCount,
  });
}
