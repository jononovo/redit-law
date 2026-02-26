import { NextResponse } from "next/server";
import { withBotApi } from "@/lib/agent-management/agent-api/middleware";
import { storage } from "@/server/storage";

export const GET = withBotApi("/api/v1/bot/status", async (_request, { bot }) => {
  if (bot.walletStatus === "pending") {
    return NextResponse.json({
      bot_id: bot.botId,
      bot_name: bot.botName,
      status: "pending",
      default_rail: null,
      message: "Owner has not claimed this bot yet. Share your claim token with your human.",
      rails: {},
      master_guardrails: null,
    });
  }

  const [
    wallet,
    privyWallet,
    crossmintWallet,
    rail4Cards,
    rail5Card,
    permissions,
  ] = await Promise.all([
    storage.getWalletByBotId(bot.botId),
    storage.privyGetWalletByBotId(bot.botId),
    storage.crossmintGetWalletByBotId(bot.botId),
    storage.getRail4CardsByBotId(bot.botId),
    storage.getRail5CardByBotId(bot.botId),
    storage.getSpendingPermissions(bot.botId),
  ]);

  const rails: Record<string, any> = {};

  if (wallet) {
    const monthlySpent = await storage.getMonthlySpend(wallet.id);
    rails.card_wallet = {
      status: wallet.balanceCents > 0 ? "active" : "empty",
      balance_usd: wallet.balanceCents / 100,
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
    };
  }

  if (privyWallet) {
    rails.stripe_wallet = {
      status: privyWallet.status === "active" ? "active" : "inactive",
      balance_usd: privyWallet.balanceUsdc / 1_000_000,
      address: privyWallet.address,
    };
  }

  if (crossmintWallet) {
    rails.shopping_wallet = {
      status: crossmintWallet.status === "active" ? "active" : "inactive",
      balance_usd: crossmintWallet.balanceUsdc / 1_000_000,
      address: crossmintWallet.address,
    };
  }

  if (rail4Cards.length > 0) {
    const activeCards = rail4Cards.filter(c => c.botId === bot.botId);
    rails.self_hosted_cards = {
      status: activeCards.length > 0 ? "active" : "inactive",
      card_count: activeCards.length,
      cards: activeCards.map(c => ({
        card_id: c.cardId,
        card_name: c.cardName,
        use_case: c.useCase,
      })),
    };
  }

  if (rail5Card) {
    rails.sub_agent_cards = {
      status: "active",
      card_id: rail5Card.cardId,
    };
  }

  let masterGuardrails = null;
  if (bot.ownerUid) {
    const guardrailConfig = await storage.getMasterGuardrails(bot.ownerUid);
    if (guardrailConfig && guardrailConfig.enabled) {
      masterGuardrails = {
        per_transaction_usd: guardrailConfig.maxPerTxUsdc,
        daily_budget_usd: guardrailConfig.dailyBudgetUsdc,
        monthly_budget_usd: guardrailConfig.monthlyBudgetUsdc,
      };
    }
  }

  const activeRailCount = Object.keys(rails).length;

  return NextResponse.json({
    bot_id: bot.botId,
    bot_name: bot.botName,
    status: bot.walletStatus === "frozen" ? "frozen" : (activeRailCount > 0 ? "active" : "inactive"),
    default_rail: bot.defaultRail || null,
    active_rails: Object.keys(rails),
    rails,
    master_guardrails: masterGuardrails,
  });
});
