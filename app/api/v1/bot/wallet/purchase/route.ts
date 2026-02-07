import { NextRequest, NextResponse } from "next/server";
import { authenticateBot } from "@/lib/bot-auth";
import { storage } from "@/server/storage";
import { purchaseRequestSchema } from "@/shared/schema";

export async function POST(request: NextRequest) {
  try {
    const bot = await authenticateBot(request);
    if (!bot) {
      return NextResponse.json(
        { error: "unauthorized", message: "Invalid API key" },
        { status: 401 }
      );
    }

    if (bot.walletStatus !== "active") {
      return NextResponse.json(
        { error: "wallet_not_active", message: "Wallet is not active. Current status: " + bot.walletStatus },
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

    const parsed = purchaseRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "validation_error", message: "Invalid request body", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { amount_cents, merchant, description, category } = parsed.data;

    const wallet = await storage.getWalletByBotId(bot.botId);
    if (!wallet) {
      return NextResponse.json(
        { error: "no_wallet", message: "No wallet found for this bot" },
        { status: 404 }
      );
    }

    if (wallet.balanceCents < amount_cents) {
      return NextResponse.json(
        {
          error: "insufficient_funds",
          balance_usd: wallet.balanceCents / 100,
          required_usd: amount_cents / 100,
          message: "Insufficient wallet balance. Request a top-up from your owner.",
        },
        { status: 402 }
      );
    }

    const permissions = await storage.getSpendingPermissions(bot.botId);

    const blockedCategories = permissions?.blockedCategories?.length
      ? permissions.blockedCategories
      : ["gambling", "adult_content", "cryptocurrency", "cash_advances"];

    if (category && blockedCategories.includes(category)) {
      return NextResponse.json(
        { error: "category_blocked", message: `Spending category "${category}" is blocked by your owner.` },
        { status: 403 }
      );
    }

    const perTxLimit = permissions?.perTransactionCents ?? 2500;
    if (amount_cents > perTxLimit) {
      return NextResponse.json(
        {
          error: "exceeds_per_transaction_limit",
          limit_usd: perTxLimit / 100,
          requested_usd: amount_cents / 100,
          message: "Amount exceeds per-transaction limit set by your owner.",
        },
        { status: 403 }
      );
    }

    const dailySpent = await storage.getDailySpend(wallet.id);
    const dailyLimit = permissions?.dailyCents ?? 5000;
    if (dailySpent + amount_cents > dailyLimit) {
      return NextResponse.json(
        {
          error: "exceeds_daily_limit",
          daily_limit_usd: dailyLimit / 100,
          daily_spent_usd: dailySpent / 100,
          requested_usd: amount_cents / 100,
          message: "This purchase would exceed the daily spending limit.",
        },
        { status: 403 }
      );
    }

    const monthlySpent = await storage.getMonthlySpend(wallet.id);
    const monthlyLimit = permissions?.monthlyCents ?? 50000;
    if (monthlySpent + amount_cents > monthlyLimit) {
      return NextResponse.json(
        {
          error: "exceeds_monthly_limit",
          monthly_limit_usd: monthlyLimit / 100,
          monthly_spent_usd: monthlySpent / 100,
          requested_usd: amount_cents / 100,
          message: "This purchase would exceed the monthly spending limit.",
        },
        { status: 403 }
      );
    }

    const approvalMode = permissions?.approvalMode ?? "ask_for_everything";
    const askAbove = permissions?.askApprovalAboveCents ?? 1000;

    if (approvalMode === "ask_for_everything") {
      // pass through — in a future phase this would queue for owner approval
    } else if (approvalMode === "auto_approve_under_threshold") {
      if (amount_cents > askAbove) {
        return NextResponse.json(
          {
            error: "requires_owner_approval",
            threshold_usd: askAbove / 100,
            requested_usd: amount_cents / 100,
            message: "This amount requires owner approval. Request a top-up or ask your owner to raise the threshold.",
          },
          { status: 403 }
        );
      }
    } else if (approvalMode === "auto_approve_by_category") {
      const approved = permissions?.approvedCategories || [];
      if (category && !approved.includes(category)) {
        if (amount_cents > askAbove) {
          return NextResponse.json(
            {
              error: "requires_owner_approval",
              message: `Category "${category}" is not auto-approved, and amount exceeds threshold.`,
            },
            { status: 403 }
          );
        }
      }
    }

    const updated = await storage.debitWallet(wallet.id, amount_cents);
    if (!updated) {
      return NextResponse.json(
        { error: "debit_failed", message: "Failed to debit wallet. Balance may have changed." },
        { status: 409 }
      );
    }

    const purchaseDesc = description
      ? `${merchant}: ${description}`
      : merchant;

    const tx = await storage.createTransaction({
      walletId: wallet.id,
      type: "purchase",
      amountCents: amount_cents,
      description: purchaseDesc,
    });

    return NextResponse.json({
      status: "approved",
      transaction_id: tx.id,
      amount_usd: amount_cents / 100,
      merchant,
      description: purchaseDesc,
      new_balance_usd: updated.balanceCents / 100,
      message: "Purchase approved. Wallet debited.",
    });
  } catch (error: any) {
    console.error("Purchase failed:", error?.message || error);
    return NextResponse.json(
      { error: "internal_error", message: "Purchase failed. Please try again." },
      { status: 500 }
    );
  }
}
