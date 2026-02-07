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
      return NextResponse.json({
        wallet_status: "pending",
        balance_usd: 0,
        card_status: "inactive",
        message: "Owner has not claimed this bot yet. Share your claim token with your human.",
      });
    }

    const wallet = await storage.getWalletByBotId(bot.botId);
    if (!wallet) {
      return NextResponse.json({
        wallet_status: "inactive",
        balance_usd: 0,
        card_status: "inactive",
      });
    }

    const permissions = await storage.getSpendingPermissions(bot.botId);
    const monthlySpent = await storage.getMonthlySpend(wallet.id);

    return NextResponse.json({
      wallet_status: wallet.balanceCents > 0 ? "active" : "empty",
      balance_usd: wallet.balanceCents / 100,
      card_status: wallet.balanceCents > 0 ? "active" : "empty",
      spending_limits: permissions
        ? {
            per_transaction_usd: permissions.perTransactionCents / 100,
            monthly_usd: permissions.monthlyCents / 100,
            monthly_spent_usd: monthlySpent / 100,
            monthly_remaining_usd: Math.max(0, (permissions.monthlyCents - monthlySpent) / 100),
          }
        : {
            per_transaction_usd: 25.0,
            monthly_usd: 500.0,
            monthly_spent_usd: monthlySpent / 100,
            monthly_remaining_usd: Math.max(0, (50000 - monthlySpent) / 100),
          },
      pending_topups: 0,
    });
  } catch (error: any) {
    console.error("Wallet check failed:", error?.message || error);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to check wallet" },
      { status: 500 }
    );
  }
}
