import type { GuardrailRules, TransactionRequest, CumulativeSpend, GuardrailDecision } from "./types";

function usdToMicroUsdc(usd: number): number {
  return Math.round(usd * 1_000_000);
}

export function evaluateGuardrails(
  rules: GuardrailRules,
  tx: TransactionRequest,
  spend: CumulativeSpend
): GuardrailDecision {
  const maxPerTxMicro = usdToMicroUsdc(rules.maxPerTxUsdc);
  if (tx.amountUsdc > maxPerTxMicro) {
    return { action: "block", reason: `Amount exceeds per-transaction limit of $${rules.maxPerTxUsdc}` };
  }

  const dailyLimitMicro = usdToMicroUsdc(rules.dailyBudgetUsdc);
  if (spend.dailyUsdc + tx.amountUsdc > dailyLimitMicro) {
    return { action: "block", reason: "Would exceed daily budget" };
  }

  const monthlyLimitMicro = usdToMicroUsdc(rules.monthlyBudgetUsdc);
  if (spend.monthlyUsdc + tx.amountUsdc > monthlyLimitMicro) {
    return { action: "block", reason: "Would exceed monthly budget" };
  }

  if (tx.resourceUrl && rules.allowlistedDomains && rules.allowlistedDomains.length > 0) {
    try {
      const domain = new URL(tx.resourceUrl).hostname;
      if (!rules.allowlistedDomains.includes(domain)) {
        return { action: "block", reason: "Domain not on allowlist" };
      }
    } catch {
      return { action: "block", reason: "Invalid resource URL" };
    }
  }

  if (tx.resourceUrl && rules.blocklistedDomains && rules.blocklistedDomains.length > 0) {
    try {
      const domain = new URL(tx.resourceUrl).hostname;
      if (rules.blocklistedDomains.includes(domain)) {
        return { action: "block", reason: "Domain is blocklisted" };
      }
    } catch {
      return { action: "block", reason: "Invalid resource URL" };
    }
  }

  if (tx.merchant && rules.allowlistedMerchants && rules.allowlistedMerchants.length > 0) {
    if (!rules.allowlistedMerchants.includes(tx.merchant)) {
      return { action: "block", reason: `Merchant "${tx.merchant}" not on allowlist` };
    }
  }

  if (tx.merchant && rules.blocklistedMerchants && rules.blocklistedMerchants.length > 0) {
    if (rules.blocklistedMerchants.includes(tx.merchant)) {
      return { action: "block", reason: `Merchant "${tx.merchant}" is blocklisted` };
    }
  }

  if (rules.requireApprovalAbove !== null && rules.requireApprovalAbove !== undefined) {
    const approvalThresholdMicro = usdToMicroUsdc(rules.requireApprovalAbove);
    if (tx.amountUsdc >= approvalThresholdMicro) {
      return { action: "require_approval", reason: `Amount exceeds approval threshold of $${rules.requireApprovalAbove}` };
    }
  }

  return { action: "allow" };
}
