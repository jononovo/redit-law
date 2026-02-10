import { NextResponse } from "next/server";
import { withBotApi } from "@/lib/bot-api";
import { completeEvent, getEventForVerification } from "@/lib/obfuscation-engine/events";
import { recordObfuscationEvent } from "@/lib/obfuscation-engine/state-machine";
import { z } from "zod";

const completeSchema = z.object({
  event_id: z.number().int().min(1),
});

export const POST = withBotApi("/api/v1/bot/obfuscation/complete", async (request, { bot }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  const parsed = completeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", message: "Invalid request body", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { event_id } = parsed.data;

  const event = await getEventForVerification(event_id, bot.botId);
  if (!event) {
    return NextResponse.json(
      { error: "not_found", message: "No pending obfuscation event found with this ID." },
      { status: 404 }
    );
  }

  const completed = await completeEvent(event_id);
  if (!completed) {
    return NextResponse.json(
      { error: "completion_failed", message: "Failed to mark event as completed." },
      { status: 500 }
    );
  }

  await recordObfuscationEvent(bot.botId);

  return NextResponse.json({
    status: "completed",
    event_id: completed.id,
    merchant_name: completed.merchantName,
    item_name: completed.itemName,
    amount_usd: completed.amountCents / 100,
    profile_index: completed.profileIndex,
    message: "Purchase completed and recorded.",
  });
});
