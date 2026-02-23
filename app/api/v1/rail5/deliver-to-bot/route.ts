import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";
import { fireWebhook } from "@/lib/webhooks";
import { z } from "zod";

const deliverSchema = z.object({
  card_id: z.string().min(1),
  bot_id: z.string().min(1),
  encrypted_file_content: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser(request);
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = deliverSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { card_id, bot_id, encrypted_file_content } = parsed.data;

  const card = await storage.getRail5CardByCardId(card_id);
  if (!card) {
    return NextResponse.json({ error: "card_not_found" }, { status: 404 });
  }
  if (card.ownerUid !== user.uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const bot = await storage.getBotByBotId(bot_id);
  if (!bot) {
    return NextResponse.json({ error: "bot_not_found" }, { status: 404 });
  }
  if (bot.ownerUid !== user.uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (!bot.callbackUrl) {
    return NextResponse.json(
      { error: "no_callback_url", message: "Bot does not have a callback URL configured. Use manual download instead." },
      { status: 422 }
    );
  }

  if (!bot.webhookSecret) {
    return NextResponse.json(
      { error: "no_webhook_secret", message: "Bot does not have a webhook secret configured. Use manual download instead." },
      { status: 422 }
    );
  }

  try {
    const delivered = await fireWebhook(bot, "rail5.card.delivered", {
      card_id,
      card_name: card.cardName,
      card_last4: card.cardLast4,
      encrypted_file_content,
    });

    if (delivered) {
      return NextResponse.json({
        delivered: true,
        bot_id,
        card_id,
        message: `Encrypted card file delivered to ${bot.botName}`,
      });
    } else {
      return NextResponse.json(
        {
          error: "delivery_failed",
          delivered: false,
          message: "Bot did not accept delivery. The encrypted file will be downloaded as a backup.",
        },
        { status: 502 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "delivery_failed",
        delivered: false,
        message: `Could not deliver to bot: ${err?.message || "unknown error"}. Use manual download instead.`,
      },
      { status: 502 }
    );
  }
}
