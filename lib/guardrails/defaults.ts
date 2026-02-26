export const GUARDRAIL_DEFAULTS = {
  master: {
    maxPerTxUsdc: 500,
    dailyBudgetUsdc: 2000,
    monthlyBudgetUsdc: 10000,
    enabled: true,
  },

  rail1: {
    maxPerTxUsdc: 100,
    dailyBudgetUsdc: 1000,
    monthlyBudgetUsdc: 10000,
    requireApprovalAbove: null as number | null,
    autoPauseOnZero: true,
  },

  rail2: {
    maxPerTxUsdc: 100,
    dailyBudgetUsdc: 500,
    monthlyBudgetUsdc: 2000,
    requireApprovalAbove: 0,
    autoPauseOnZero: true,
  },

  rail4: {
    approvalMode: "ask_for_everything",
    perTransactionCents: 2500,
    dailyCents: 5000,
    monthlyCents: 50000,
    askApprovalAboveCents: 1000,
    recurringAllowed: false,
  },
} as const;
