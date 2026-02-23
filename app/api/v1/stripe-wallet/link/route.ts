import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { storage } from "@/server/storage";

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const { wallet_id, bot_id } = body;

    if (!wallet_id || !bot_id) {
      return NextResponse.json({ error: "wallet_id and bot_id are required" }, { status: 400 });
    }

    const wallet = await storage.privyGetWalletById(Number(wallet_id));
    if (!wallet || wallet.ownerUid !== user.uid) {
      return NextResponse.json({ error: "Wallet not found or not owned by you" }, { status: 404 });
    }

    if (wallet.botId && wallet.botId.length > 0) {
      return NextResponse.json({ error: "Wallet already has a bot linked. Unlink it first." }, { status: 400 });
    }

    const bot = await storage.getBotByBotId(bot_id);
    if (!bot || bot.ownerUid !== user.uid) {
      return NextResponse.json({ error: "Bot not found or not owned by you" }, { status: 404 });
    }

    const updated = await storage.privyLinkBot(Number(wallet_id), bot_id, user.uid);

    if (!updated) {
      return NextResponse.json({ error: "Failed to link bot" }, { status: 500 });
    }

    return NextResponse.json({
      wallet_id: updated.id,
      bot_id: updated.botId,
      message: "Bot linked successfully",
    });
  } catch (error) {
    console.error("POST /api/v1/stripe-wallet/link error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
