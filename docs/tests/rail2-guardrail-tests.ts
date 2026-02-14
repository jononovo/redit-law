import { evaluateGuardrails } from "@/lib/guardrails/evaluate";
import { isApprovalExpired, getApprovalExpiresAt, RAIL2_APPROVAL_TTL_MINUTES } from "@/lib/approvals/lifecycle";
import { centsToMicroUsdc, microUsdcToUsd } from "@/lib/guardrails/master";

function runGuardrailTests() {
  const results: { test: string; pass: boolean; error?: string }[] = [];

  function log(test: string, pass: boolean, error?: string) {
    results.push({ test, pass, error });
    console.log(`${pass ? "✅" : "❌"} ${test}${error ? ` — ${error}` : ""}`);
  }

  const baseRules = {
    maxPerTxUsdc: 5,
    dailyBudgetUsdc: 25,
    monthlyBudgetUsdc: 100,
    requireApprovalAbove: null as number | null,
    autoPauseOnZero: true,
  };

  {
    const result = evaluateGuardrails(baseRules, { amountUsdc: 1_000_000 }, { dailyUsdc: 0, monthlyUsdc: 0 });
    log("Allow tx within limits", result.action === "allow");
  }

  {
    const result = evaluateGuardrails(baseRules, { amountUsdc: 10_000_000 }, { dailyUsdc: 0, monthlyUsdc: 0 });
    log("Block tx exceeding per-tx limit", result.action === "block");
  }

  {
    const result = evaluateGuardrails(baseRules, { amountUsdc: 1_000_000 }, { dailyUsdc: 25_000_000, monthlyUsdc: 25_000_000 });
    log("Block tx exceeding daily budget", result.action === "block");
  }

  {
    const result = evaluateGuardrails(baseRules, { amountUsdc: 1_000_000 }, { dailyUsdc: 0, monthlyUsdc: 100_000_000 });
    log("Block tx exceeding monthly budget", result.action === "block");
  }

  {
    const rules = { ...baseRules, requireApprovalAbove: 2 };
    const result = evaluateGuardrails(rules, { amountUsdc: 3_000_000 }, { dailyUsdc: 0, monthlyUsdc: 0 });
    log("Require approval above threshold", result.action === "require_approval");
  }

  {
    const rules = { ...baseRules, requireApprovalAbove: 2 };
    const result = evaluateGuardrails(rules, { amountUsdc: 1_000_000 }, { dailyUsdc: 0, monthlyUsdc: 0 });
    log("Allow tx below approval threshold", result.action === "allow");
  }

  {
    const rules = { ...baseRules, allowlistedMerchants: ["amazon", "walmart"] };
    const result = evaluateGuardrails(rules, { amountUsdc: 1_000_000, merchant: "amazon" }, { dailyUsdc: 0, monthlyUsdc: 0 });
    log("Allow allowlisted merchant", result.action === "allow");
  }

  {
    const rules = { ...baseRules, allowlistedMerchants: ["amazon", "walmart"] };
    const result = evaluateGuardrails(rules, { amountUsdc: 1_000_000, merchant: "ebay" }, { dailyUsdc: 0, monthlyUsdc: 0 });
    log("Block non-allowlisted merchant", result.action === "block");
  }

  {
    const rules = { ...baseRules, blocklistedMerchants: ["ebay", "aliexpress"] };
    const result = evaluateGuardrails(rules, { amountUsdc: 1_000_000, merchant: "ebay" }, { dailyUsdc: 0, monthlyUsdc: 0 });
    log("Block blocklisted merchant", result.action === "block");
  }

  {
    const rules = { ...baseRules, blocklistedMerchants: ["ebay", "aliexpress"] };
    const result = evaluateGuardrails(rules, { amountUsdc: 1_000_000, merchant: "amazon" }, { dailyUsdc: 0, monthlyUsdc: 0 });
    log("Allow non-blocklisted merchant", result.action === "allow");
  }

  {
    const rules = { ...baseRules, allowlistedMerchants: ["amazon"] };
    const result = evaluateGuardrails(rules, { amountUsdc: 0, merchant: "ebay" }, { dailyUsdc: 0, monthlyUsdc: 0 });
    log("Block non-allowlisted merchant even with zero amount", result.action === "block");
  }

  {
    const rules = { ...baseRules, blocklistedMerchants: ["ebay"] };
    const result = evaluateGuardrails(rules, { amountUsdc: 0, merchant: "ebay" }, { dailyUsdc: 0, monthlyUsdc: 0 });
    log("Block blocklisted merchant even with zero amount", result.action === "block");
  }

  {
    const expires = getApprovalExpiresAt(RAIL2_APPROVAL_TTL_MINUTES);
    log("RAIL2_APPROVAL_TTL_MINUTES is 15", RAIL2_APPROVAL_TTL_MINUTES === 15);
    const diffMs = expires.getTime() - Date.now();
    log("getApprovalExpiresAt returns ~15 min from now", diffMs > 14 * 60 * 1000 && diffMs < 16 * 60 * 1000);
  }

  {
    const notExpired = isApprovalExpired({ expiresAt: new Date(Date.now() + 60000) } as any);
    log("isApprovalExpired returns false for future expiry", notExpired === false);
  }

  {
    const expired = isApprovalExpired({ expiresAt: new Date(Date.now() - 60000) } as any);
    log("isApprovalExpired returns true for past expiry", expired === true);
  }

  // ─── Shopify merchant tests ─────────────────────────────────────
  {
    const rules = { ...baseRules, allowlistedMerchants: ["amazon", "shopify"] };
    const result = evaluateGuardrails(rules, { amountUsdc: 1_000_000, merchant: "shopify" }, { dailyUsdc: 0, monthlyUsdc: 0 });
    log("Allow shopify on allowlist", result.action === "allow");
  }

  {
    const rules = { ...baseRules, allowlistedMerchants: ["amazon"] };
    const result = evaluateGuardrails(rules, { amountUsdc: 1_000_000, merchant: "shopify" }, { dailyUsdc: 0, monthlyUsdc: 0 });
    log("Block shopify when not on allowlist", result.action === "block");
  }

  {
    const rules = { ...baseRules, blocklistedMerchants: ["shopify"] };
    const result = evaluateGuardrails(rules, { amountUsdc: 1_000_000, merchant: "shopify" }, { dailyUsdc: 0, monthlyUsdc: 0 });
    log("Block shopify on blocklist", result.action === "block");
  }

  {
    const rules = { ...baseRules, allowlistedMerchants: ["amazon", "shopify", "url"] };
    const result = evaluateGuardrails(rules, { amountUsdc: 1_000_000, merchant: "url" }, { dailyUsdc: 0, monthlyUsdc: 0 });
    log("Allow url merchant on allowlist", result.action === "allow");
  }

  // ─── Master guardrails utility functions ────────────────────────
  {
    log("centsToMicroUsdc(100) = 1_000_000", centsToMicroUsdc(100) === 1_000_000);
  }

  {
    log("centsToMicroUsdc(1) = 10_000", centsToMicroUsdc(1) === 10_000);
  }

  {
    log("centsToMicroUsdc(0) = 0", centsToMicroUsdc(0) === 0);
  }

  {
    log("microUsdcToUsd(1_000_000) = 1", microUsdcToUsd(1_000_000) === 1);
  }

  {
    log("microUsdcToUsd(5_500_000) = 5.5", microUsdcToUsd(5_500_000) === 5.5);
  }

  {
    log("microUsdcToUsd(0) = 0", microUsdcToUsd(0) === 0);
  }

  // ─── Master guardrails via evaluateGuardrails (no approval threshold) ───
  {
    const masterRules = {
      maxPerTxUsdc: 50,
      dailyBudgetUsdc: 200,
      monthlyBudgetUsdc: 1000,
      requireApprovalAbove: null as number | null,
      autoPauseOnZero: false,
    };
    const result = evaluateGuardrails(masterRules, { amountUsdc: 10_000_000 }, { dailyUsdc: 0, monthlyUsdc: 0 });
    log("Master: allow tx within limits", result.action === "allow");
  }

  {
    const masterRules = {
      maxPerTxUsdc: 50,
      dailyBudgetUsdc: 200,
      monthlyBudgetUsdc: 1000,
      requireApprovalAbove: null as number | null,
      autoPauseOnZero: false,
    };
    const result = evaluateGuardrails(masterRules, { amountUsdc: 60_000_000 }, { dailyUsdc: 0, monthlyUsdc: 0 });
    log("Master: block tx exceeding per-tx max", result.action === "block");
  }

  {
    const masterRules = {
      maxPerTxUsdc: 50,
      dailyBudgetUsdc: 200,
      monthlyBudgetUsdc: 1000,
      requireApprovalAbove: null as number | null,
      autoPauseOnZero: false,
    };
    const result = evaluateGuardrails(masterRules, { amountUsdc: 10_000_000 }, { dailyUsdc: 200_000_000, monthlyUsdc: 200_000_000 });
    log("Master: block tx exceeding daily budget", result.action === "block");
  }

  {
    const masterRules = {
      maxPerTxUsdc: 50,
      dailyBudgetUsdc: 200,
      monthlyBudgetUsdc: 1000,
      requireApprovalAbove: null as number | null,
      autoPauseOnZero: false,
    };
    const result = evaluateGuardrails(masterRules, { amountUsdc: 10_000_000 }, { dailyUsdc: 0, monthlyUsdc: 1000_000_000 });
    log("Master: block tx exceeding monthly budget", result.action === "block");
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`Guardrail Tests: ${passed} passed, ${failed} failed out of ${results.length} total`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (failed > 0) {
    console.log("Failed tests:");
    results.filter(r => !r.pass).forEach(r => console.log(`  ❌ ${r.test}: ${r.error}`));
  }

  return { passed, failed, total: results.length };
}

const r = runGuardrailTests();
process.exit(r.failed > 0 ? 1 : 0);
