import { NextResponse } from "next/server";
import { withBotApi } from "@/lib/bot-api";
import { buildRail4Detail } from "@/lib/rail-status-builders";

export const GET = withBotApi("/api/v1/bot/check/rail4", async (_request, { bot }) => {
  const detail = await buildRail4Detail(bot.botId);
  return NextResponse.json(detail);
});
