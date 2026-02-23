import { storage } from "@/server/storage";

export async function buildRail1Detail(botId: string) {
  const wallet = await storage.privyGetWalletByBotId(botId);
  if (!wallet) return { status: "inactive" as const };

  const [guardrails, dailySpend, monthlySpend, pendingApprovals] = await Promise.all([
    storage.privyGetGuardrails(wallet.id),
    storage.privyGetDailySpend(wallet.id),
    storage.privyGetMonthlySpend(wallet.id),
    storage.privyGetPendingApprovals(wallet.id),
  ]);

  const maxPerTx = guardrails?.maxPerTxUsdc ?? 100;
  const dailyBudget = guardrails?.dailyBudgetUsdc ?? 1000;
  const monthlyBudget = guardrails?.monthlyBudgetUsdc ?? 10000;
  const dailySpendUsd = dailySpend / 1_000_000;
  const monthlySpendUsd = monthlySpend / 1_000_000;

  return {
    status: wallet.status === "active" ? "active" as const : "inactive" as const,
    balance_usd: wallet.balanceUsdc / 1_000_000,
    address: wallet.address,
    guardrails: {
      max_per_tx_usd: maxPerTx,
      daily_budget_usd: dailyBudget,
      monthly_budget_usd: monthlyBudget,
      daily_spent_usd: dailySpendUsd,
      daily_remaining_usd: Math.max(0, dailyBudget - dailySpendUsd),
      monthly_spent_usd: monthlySpendUsd,
      monthly_remaining_usd: Math.max(0, monthlyBudget - monthlySpendUsd),
      require_approval_above_usd: guardrails?.requireApprovalAbove ?? null,
    },
    domain_rules: {
      allowlisted: guardrails?.allowlistedDomains ?? [],
      blocklisted: guardrails?.blocklistedDomains ?? [],
    },
    pending_approvals: pendingApprovals.length,
  };
}

export async function buildRail2Detail(botId: string) {
  const wallet = await storage.crossmintGetWalletByBotId(botId);
  if (!wallet) return { status: "inactive" as const };

  const [guardrails, dailySpend, monthlySpend] = await Promise.all([
    storage.crossmintGetGuardrails(wallet.id),
    storage.crossmintGetDailySpend(wallet.id),
    storage.crossmintGetMonthlySpend(wallet.id),
  ]);

  const maxPerTx = guardrails?.maxPerTxUsdc ?? 100;
  const dailyBudget = guardrails?.dailyBudgetUsdc ?? 500;
  const monthlyBudget = guardrails?.monthlyBudgetUsdc ?? 2000;
  const dailySpendUsd = dailySpend / 1_000_000;
  const monthlySpendUsd = monthlySpend / 1_000_000;

  return {
    status: wallet.status === "active" ? "active" as const : "inactive" as const,
    balance_usd: wallet.balanceUsdc / 1_000_000,
    address: wallet.address,
    guardrails: {
      max_per_tx_usd: maxPerTx,
      daily_budget_usd: dailyBudget,
      monthly_budget_usd: monthlyBudget,
      daily_spent_usd: dailySpendUsd,
      daily_remaining_usd: Math.max(0, dailyBudget - dailySpendUsd),
      monthly_spent_usd: monthlySpendUsd,
      monthly_remaining_usd: Math.max(0, monthlyBudget - monthlySpendUsd),
      require_approval_above_usd: guardrails?.requireApprovalAbove ?? 0,
    },
    merchant_rules: {
      allowlisted: guardrails?.allowlistedMerchants ?? [],
      blocklisted: guardrails?.blocklistedMerchants ?? [],
    },
  };
}

function getAllowanceWindowStart(duration: "day" | "week" | "month"): Date {
  const now = new Date();
  if (duration === "day") {
    now.setHours(0, 0, 0, 0);
    return now;
  }
  if (duration === "week") {
    const day = now.getDay();
    now.setDate(now.getDate() - day);
    now.setHours(0, 0, 0, 0);
    return now;
  }
  now.setDate(1);
  now.setHours(0, 0, 0, 0);
  return now;
}

function getAllowanceWindowEnd(duration: "day" | "week" | "month"): string {
  const now = new Date();
  if (duration === "day") {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toISOString();
  }
  if (duration === "week") {
    const day = now.getDay();
    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + (7 - day));
    nextWeek.setHours(0, 0, 0, 0);
    return nextWeek.toISOString();
  }
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toISOString();
}

export async function buildRail4Detail(botId: string) {
  const cards = await storage.getRail4CardsByBotId(botId);
  if (cards.length === 0) return { status: "inactive" as const };

  const cardDetails = await Promise.all(
    cards.map(async (card) => {
      let profiles: any[] = [];
      let permissionsList: any[] = [];
      if (card.profilePermissions) {
        try {
          permissionsList = JSON.parse(card.profilePermissions);
          if (!Array.isArray(permissionsList)) permissionsList = [permissionsList];
        } catch {}
      }

      for (const perm of permissionsList) {
        const duration = perm.allowance_duration || "month";
        const windowStart = getAllowanceWindowStart(duration);
        const resetsAt = getAllowanceWindowEnd(duration);
        const profileIndex = perm.profile_index ?? card.realProfileIndex;

        const usage = await storage.getProfileAllowanceUsage(
          card.cardId,
          profileIndex,
          windowStart,
        );

        const allowanceValueUsd = perm.allowance_value ?? 0;
        const spentUsd = (usage?.spentCents ?? 0) / 100;

        profiles.push({
          profile_index: profileIndex,
          allowance_usd: allowanceValueUsd,
          spent_usd: spentUsd,
          remaining_usd: Math.max(0, allowanceValueUsd - spentUsd),
          resets_at: resetsAt,
        });
      }

      const realProfilePerm = permissionsList.find(p => p.profile_index === card.realProfileIndex);

      return {
        card_id: card.cardId,
        card_name: card.cardName,
        use_case: card.useCase,
        status: card.status,
        profiles,
        approval_mode: realProfilePerm?.human_permission_required ?? "all",
        approval_threshold_usd: realProfilePerm?.confirmation_exempt_limit ?? 0,
      };
    }),
  );

  return {
    status: "active" as const,
    card_count: cards.length,
    cards: cardDetails,
  };
}

export async function buildRail5Detail(botId: string) {
  const card = await storage.getRail5CardByBotId(botId);
  if (!card) return { status: "inactive" as const };

  return {
    status: card.status === "active" ? "active" as const : card.status,
    card_id: card.cardId,
    card_name: card.cardName,
    card_brand: card.cardBrand,
    last4: card.cardLast4,
    limits: {
      per_transaction_usd: card.spendingLimitCents / 100,
      daily_usd: card.dailyLimitCents / 100,
      monthly_usd: card.monthlyLimitCents / 100,
      human_approval_above_usd: card.humanApprovalAboveCents / 100,
    },
  };
}
