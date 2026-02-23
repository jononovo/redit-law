import { NextResponse } from "next/server";
import { withBotApi } from "@/lib/bot-api";
import { buildRail2Detail } from "@/lib/rail-status-builders";

export const GET = withBotApi("/api/v1/bot/check/rail2", async (_request, { bot }) => {
  const detail = await buildRail2Detail(bot.botId);
  return NextResponse.json(detail);
});
