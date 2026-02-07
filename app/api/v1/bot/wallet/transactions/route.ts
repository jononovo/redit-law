import { NextRequest, NextResponse } from "next/server";
import { authenticateBot } from "@/lib/bot-auth";
import { storage } from "@/server/storage";

export async function GET(request: NextRequest) {
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
        { error: "wallet_not_active", message: "Wallet not yet activated." },
        { status: 403 }
      );
    }

    const wallet = await storage.getWalletByBotId(bot.botId);
    if (!wallet) {
      return NextResponse.json({ transactions: [] });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    const txs = await storage.getTransactionsByWalletId(wallet.id, limit);

    return NextResponse.json({
      transactions: txs.map((tx) => ({
        id: tx.id,
        type: tx.type,
        amount_usd: tx.amountCents / 100,
        description: tx.description,
        created_at: tx.createdAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error("Bot transactions fetch failed:", error?.message || error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}
