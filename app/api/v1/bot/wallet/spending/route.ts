import { NextResponse } from "next/server";
import { withBotApi } from "@/lib/bot-api";
import { storage } from "@/server/storage";

const DEFAULT_BLOCKED = ["gambling", "adult_content", "cryptocurrency", "cash_advances"];

export const GET = withBotApi("/api/v1/bot/wallet/spending", async (_request, { bot }) => {
  if (bot.walletStatus === "pending") {
    return NextResponse.json(
      { error: "wallet_not_active", message: "Wallet not yet activated. Owner must claim this bot first." },
      { status: 403 }
    );
  }

  const permissions = await storage.getSpendingPermissions(bot.botId);

  if (!permissions) {
    return NextResponse.json({
      approval_mode: "ask_for_everything",
      limits: {
        per_transaction_usd: 25.0,
        daily_usd: 50.0,
        monthly_usd: 500.0,
        ask_approval_above_usd: 10.0,
      },
      approved_categories: [],
      blocked_categories: DEFAULT_BLOCKED,
      recurring_allowed: false,
      notes: null,
      updated_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    approval_mode: permissions.approvalMode,
    limits: {
      per_transaction_usd: permissions.perTransactionCents / 100,
      daily_usd: permissions.dailyCents / 100,
      monthly_usd: permissions.monthlyCents / 100,
      ask_approval_above_usd: permissions.askApprovalAboveCents / 100,
    },
    approved_categories: permissions.approvedCategories,
    blocked_categories: permissions.blockedCategories.length > 0 ? permissions.blockedCategories : DEFAULT_BLOCKED,
    recurring_allowed: permissions.recurringAllowed,
    notes: permissions.notes,
    updated_at: permissions.updatedAt.toISOString(),
  });
});
