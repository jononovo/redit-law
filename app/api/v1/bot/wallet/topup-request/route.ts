import { NextRequest, NextResponse } from "next/server";
import { authenticateBot } from "@/lib/bot-auth";
import { storage } from "@/server/storage";
import { topupRequestSchema } from "@/shared/schema";
import { sendTopupRequestEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const bot = await authenticateBot(request);
    if (!bot) {
      return NextResponse.json(
        { error: "unauthorized", message: "Invalid API key" },
        { status: 401 }
      );
    }

    if (bot.walletStatus === "pending") {
      return NextResponse.json(
        { error: "wallet_not_active", message: "Wallet not yet activated. Owner must claim this bot first." },
        { status: 403 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "invalid_json", message: "Request body must be valid JSON" },
        { status: 400 }
      );
    }

    const parsed = topupRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", message: "Invalid request body", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { amount_usd, reason } = parsed.data;
    const amountCents = Math.round(amount_usd * 100);

    const topupReq = await storage.createTopupRequest({
      botId: bot.botId,
      amountCents,
      reason: reason || null,
      status: "sent",
    });

    sendTopupRequestEmail({
      ownerEmail: bot.ownerEmail,
      botName: bot.botName,
      amountUsd: amount_usd,
      reason,
    }).catch((err) => {
      console.error("Failed to send topup request email:", err);
    });

    return NextResponse.json({
      topup_request_id: topupReq.id,
      status: "sent",
      amount_usd,
      owner_notified: true,
      message: "Your owner has been emailed a top-up request.",
    });
  } catch (error: any) {
    console.error("Topup request failed:", error?.message || error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to create top-up request." },
      { status: 500 }
    );
  }
}
