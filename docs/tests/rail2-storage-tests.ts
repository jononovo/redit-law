import { storage } from "@/server/storage";

async function runStorageTests() {
  const results: { test: string; pass: boolean; error?: string }[] = [];

  function log(test: string, pass: boolean, error?: string) {
    results.push({ test, pass, error });
    console.log(`${pass ? "✅" : "❌"} ${test}${error ? ` — ${error}` : ""}`);
  }

  const TEST_BOT_ID = "bot_test_main_agent";
  const TEST_OWNER_UID = "test_owner_uid";
  let walletId: number | null = null;

  try {
    const wallet = await storage.crossmintCreateWallet({
      botId: TEST_BOT_ID,
      ownerUid: TEST_OWNER_UID,
      crossmintWalletId: "cm_test_wallet_001",
      address: "0xTEST0000000000000000000000000000000001",
    });
    walletId = wallet.id;
    log("crossmintCreateWallet", !!wallet && wallet.botId === TEST_BOT_ID);
  } catch (e: any) {
    log("crossmintCreateWallet", false, e.message);
  }

  try {
    const wallet = await storage.crossmintGetWalletById(walletId!);
    log("crossmintGetWalletById", !!wallet && wallet.id === walletId);
  } catch (e: any) {
    log("crossmintGetWalletById", false, e.message);
  }

  try {
    const wallet = await storage.crossmintGetWalletByBotId(TEST_BOT_ID);
    log("crossmintGetWalletByBotId", !!wallet && wallet.botId === TEST_BOT_ID);
  } catch (e: any) {
    log("crossmintGetWalletByBotId", false, e.message);
  }

  try {
    const wallets = await storage.crossmintGetWalletsByOwnerUid(TEST_OWNER_UID);
    log("crossmintGetWalletsByOwnerUid", wallets.length > 0 && wallets[0].ownerUid === TEST_OWNER_UID);
  } catch (e: any) {
    log("crossmintGetWalletsByOwnerUid", false, e.message);
  }

  try {
    const updated = await storage.crossmintUpdateWalletBalance(walletId!, 5000000);
    log("crossmintUpdateWalletBalance", !!updated && updated.balanceUsdc === 5000000);
  } catch (e: any) {
    log("crossmintUpdateWalletBalance", false, e.message);
  }

  try {
    const updated = await storage.crossmintUpdateWalletStatus(walletId!, "paused", TEST_OWNER_UID);
    log("crossmintUpdateWalletStatus (pause)", !!updated && updated.status === "paused");
  } catch (e: any) {
    log("crossmintUpdateWalletStatus (pause)", false, e.message);
  }

  try {
    const updated = await storage.crossmintUpdateWalletStatus(walletId!, "active", TEST_OWNER_UID);
    log("crossmintUpdateWalletStatus (activate)", !!updated && updated.status === "active");
  } catch (e: any) {
    log("crossmintUpdateWalletStatus (activate)", false, e.message);
  }

  try {
    const guardrails = await storage.crossmintUpsertGuardrails(walletId!, {
      maxPerTxUsdc: 10000000,
      dailyBudgetUsdc: 50000000,
      monthlyBudgetUsdc: 200000000,
      requireApprovalAbove: 0,
      allowlistedMerchants: ["amazon"],
      blocklistedMerchants: ["ebay"],
      autoPauseOnZero: true,
    });
    log("crossmintUpsertGuardrails (create)", !!guardrails && guardrails.maxPerTxUsdc === 10000000);
  } catch (e: any) {
    log("crossmintUpsertGuardrails (create)", false, e.message);
  }

  try {
    const guardrails = await storage.crossmintGetGuardrails(walletId!);
    log("crossmintGetGuardrails", !!guardrails && guardrails.walletId === walletId);
  } catch (e: any) {
    log("crossmintGetGuardrails", false, e.message);
  }

  try {
    const updated = await storage.crossmintUpsertGuardrails(walletId!, {
      dailyBudgetUsdc: 75000000,
    });
    log("crossmintUpsertGuardrails (update)", !!updated && updated.dailyBudgetUsdc === 75000000);
  } catch (e: any) {
    log("crossmintUpsertGuardrails (update)", false, e.message);
  }

  let txId: number | null = null;
  try {
    const tx = await storage.crossmintCreateTransaction({
      walletId: walletId!,
      type: "purchase",
      amountUsdc: 2500000,
      productLocator: "amazon:B08N5WRWNW",
      productName: "Test Product",
      quantity: 1,
      shippingAddress: { name: "Test User", line1: "123 Test St", city: "Testville", state: "CA", zip: "90210", country: "US" },
      status: "requires_approval",
      orderStatus: "pending",
    });
    txId = tx.id;
    log("crossmintCreateTransaction", !!tx && tx.amountUsdc === 2500000);
  } catch (e: any) {
    log("crossmintCreateTransaction", false, e.message);
  }

  try {
    const txs = await storage.crossmintGetTransactionsByWalletId(walletId!);
    log("crossmintGetTransactionsByWalletId", txs.length > 0 && txs[0].walletId === walletId);
  } catch (e: any) {
    log("crossmintGetTransactionsByWalletId", false, e.message);
  }

  try {
    const tx = await storage.crossmintGetTransactionById(txId!);
    log("crossmintGetTransactionById", !!tx && tx.id === txId);
  } catch (e: any) {
    log("crossmintGetTransactionById", false, e.message);
  }

  try {
    const updated = await storage.crossmintUpdateTransaction(txId!, { status: "confirmed", crossmintOrderId: "order_test_001" });
    log("crossmintUpdateTransaction", !!updated && updated.status === "confirmed");
  } catch (e: any) {
    log("crossmintUpdateTransaction", false, e.message);
  }

  try {
    const daily = await storage.crossmintGetDailySpend(walletId!);
    log("crossmintGetDailySpend", typeof daily === "number" && daily >= 0);
  } catch (e: any) {
    log("crossmintGetDailySpend", false, e.message);
  }

  try {
    const monthly = await storage.crossmintGetMonthlySpend(walletId!);
    log("crossmintGetMonthlySpend", typeof monthly === "number" && monthly >= 0);
  } catch (e: any) {
    log("crossmintGetMonthlySpend", false, e.message);
  }

  let approvalId: number | null = null;
  try {
    const approval = await storage.crossmintCreateApproval({
      walletId: walletId!,
      transactionId: txId!,
      amountUsdc: 2500000,
      productLocator: "amazon:B08N5WRWNW",
      productName: "Test Product",
      shippingAddress: { name: "Test User", line1: "123 Test St", city: "Testville", state: "CA", zip: "90210", country: "US" },
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    approvalId = approval.id;
    log("crossmintCreateApproval", !!approval && approval.status === "pending");
  } catch (e: any) {
    log("crossmintCreateApproval", false, e.message);
  }

  try {
    const approval = await storage.crossmintGetApproval(approvalId!);
    log("crossmintGetApproval", !!approval && approval.id === approvalId);
  } catch (e: any) {
    log("crossmintGetApproval", false, e.message);
  }

  try {
    const approvals = await storage.crossmintGetPendingApprovalsByOwnerUid(TEST_OWNER_UID);
    log("crossmintGetPendingApprovalsByOwnerUid", approvals.length > 0);
  } catch (e: any) {
    log("crossmintGetPendingApprovalsByOwnerUid", false, e.message);
  }

  try {
    const decided = await storage.crossmintDecideApproval(approvalId!, "approved", TEST_OWNER_UID);
    log("crossmintDecideApproval", !!decided && decided.status === "approved");
  } catch (e: any) {
    log("crossmintDecideApproval", false, e.message);
  }

  try {
    const noPending = await storage.crossmintGetPendingApprovalsByOwnerUid(TEST_OWNER_UID);
    log("crossmintGetPendingApprovalsByOwnerUid (after decide)", noPending.length === 0);
  } catch (e: any) {
    log("crossmintGetPendingApprovalsByOwnerUid (after decide)", false, e.message);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`Storage Tests: ${passed} passed, ${failed} failed out of ${results.length} total`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (failed > 0) {
    console.log("Failed tests:");
    results.filter(r => !r.pass).forEach(r => console.log(`  ❌ ${r.test}: ${r.error}`));
  }

  return { passed, failed, total: results.length };
}

runStorageTests().then((r) => {
  process.exit(r.failed > 0 ? 1 : 0);
}).catch((e) => {
  console.error("Test runner failed:", e);
  process.exit(1);
});
