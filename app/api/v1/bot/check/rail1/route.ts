import { NextResponse } from "next/server";
import { withBotApi } from "@/lib/bot-api";
import { buildRail1Detail } from "@/lib/rail-status-builders";

export const GET = withBotApi("/api/v1/bot/check/rail1", async (_request, { bot }) => {
  const detail = await buildRail1Detail(bot.botId);
  return NextResponse.json(detail);
});
