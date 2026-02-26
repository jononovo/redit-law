export const GUARDRAIL_DEFAULTS = {
  master: {
    maxPerTxUsdc: 5,
    dailyBudgetUsdc: 20,
    monthlyBudgetUsdc: 100,
    enabled: true,
  },

  rail1: {
    maxPerTxUsdc: 5,
    dailyBudgetUsdc: 10,
    monthlyBudgetUsdc: 50,
    requireApprovalAbove: null as number | null,
    autoPauseOnZero: true,
  },

  rail2: {
    maxPerTxUsdc: 5,
    dailyBudgetUsdc: 10,
    monthlyBudgetUsdc: 50,
    requireApprovalAbove: 0,
    autoPauseOnZero: true,
  },

  rail4: {
    approvalMode: "ask_for_everything",
    perTransactionCents: 500,
    dailyCents: 1000,
    monthlyCents: 5000,
    askApprovalAboveCents: 500,
    recurringAllowed: false,
  },
} as const;
