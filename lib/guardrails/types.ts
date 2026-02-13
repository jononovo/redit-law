export interface GuardrailRules {
  maxPerTxUsdc: number;
  dailyBudgetUsdc: number;
  monthlyBudgetUsdc: number;
  requireApprovalAbove: number | null;
  allowlistedDomains?: string[];
  blocklistedDomains?: string[];
  allowlistedMerchants?: string[];
  blocklistedMerchants?: string[];
  autoPauseOnZero: boolean;
}

export interface TransactionRequest {
  amountUsdc: number;
  resourceUrl?: string;
  merchant?: string;
}

export interface CumulativeSpend {
  dailyUsdc: number;
  monthlyUsdc: number;
}

export type GuardrailDecision =
  | { action: "allow" }
  | { action: "block"; reason: string }
  | { action: "require_approval"; reason: string };
