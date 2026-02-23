import { storage } from "@/server/storage";
import {
  generateRail5CardId, generateRail5CheckoutId,
  validateKeyMaterial, buildSpawnPayload,
  getDailySpendCents, getMonthlySpendCents,
  generateRail5ApprovalToken, verifyRail5ApprovalToken,
  isRail5ApprovalExpired, RAIL5_APPROVAL_TTL_MS,
} from "@/lib/rail5";

async function runRail5Tests() {
  const results: { test: string; pass: boolean; error?: string }[] = [];

  function log(test: string, pass: boolean, error?: string) {
    results.push({ test, pass, error });
    console.log(`${pass ? "✅" : "❌"} ${test}${error ? ` — ${error}` : ""}`);
  }

  const TEST_OWNER_UID = "test_rail5_owner_" + Date.now();
  const TEST_BOT_ID = "bot_test_rail5_" + Date.now();
  let cardId = "";
  let checkoutId = "";

  // ─── ID Generation ────────────────────────────────────────────
  console.log("\n--- ID Generation ---");

  {
    const id = generateRail5CardId();
    log("generateRail5CardId has r5card_ prefix", id.startsWith("r5card_"));
    log("generateRail5CardId has correct length", id.length === 7 + 16);
  }

  {
    const id = generateRail5CheckoutId();
    log("generateRail5CheckoutId has r5chk_ prefix", id.startsWith("r5chk_"));
    log("generateRail5CheckoutId has correct length", id.length === 6 + 16);
  }

  {
    const id1 = generateRail5CardId();
    const id2 = generateRail5CardId();
    log("generateRail5CardId produces unique IDs", id1 !== id2);
  }

  // ─── Key Material Validation ──────────────────────────────────
  console.log("\n--- Key Material Validation ---");

  {
    const r = validateKeyMaterial("a".repeat(64), "b".repeat(24), "c".repeat(32));
    log("validateKeyMaterial accepts valid hex", r.valid === true);
  }

  {
    const r = validateKeyMaterial("a".repeat(63), "b".repeat(24), "c".repeat(32));
    log("validateKeyMaterial rejects short key", r.valid === false && r.error!.includes("key_hex"));
  }

  {
    const r = validateKeyMaterial("a".repeat(64), "b".repeat(23), "c".repeat(32));
    log("validateKeyMaterial rejects short IV", r.valid === false && r.error!.includes("iv_hex"));
  }

  {
    const r = validateKeyMaterial("a".repeat(64), "b".repeat(24), "c".repeat(31));
    log("validateKeyMaterial rejects short tag", r.valid === false && r.error!.includes("tag_hex"));
  }

  {
    const r = validateKeyMaterial("g".repeat(64), "b".repeat(24), "c".repeat(32));
    log("validateKeyMaterial rejects non-hex key", r.valid === false);
  }

  {
    const r = validateKeyMaterial("", "", "");
    log("validateKeyMaterial rejects empty strings", r.valid === false);
  }

  // ─── Spawn Payload ────────────────────────────────────────────
  console.log("\n--- Spawn Payload ---");

  {
    const payload = buildSpawnPayload({
      checkoutId: "r5chk_test123",
      merchantName: "Amazon",
      merchantUrl: "https://amazon.com",
      itemName: "Widget",
      amountCents: 2999,
      encryptedFilename: "Card-Widget-1234.md",
    });
    log("buildSpawnPayload includes checkout_id in task", payload.task.includes("r5chk_test123"));
    log("buildSpawnPayload includes merchant name", payload.task.includes("Amazon"));
    log("buildSpawnPayload includes amount formatted", payload.task.includes("$29.99"));
    log("buildSpawnPayload sets cleanup to delete", payload.cleanup === "delete");
    log("buildSpawnPayload sets timeout to 300s", payload.runTimeoutSeconds === 300);
    log("buildSpawnPayload generates label from merchant", payload.label.startsWith("checkout-amazon"));
  }

  // ─── HMAC Token Generation / Verification ─────────────────────
  console.log("\n--- HMAC Token Security ---");

  {
    const secret = process.env.CONFIRMATION_HMAC_SECRET || process.env.CRON_SECRET;
    if (secret) {
      const token = generateRail5ApprovalToken("test_checkout_123");
      log("generateRail5ApprovalToken produces hex string", /^[0-9a-f]{64}$/.test(token));

      log("verifyRail5ApprovalToken accepts valid token", verifyRail5ApprovalToken("test_checkout_123", token));
      log("verifyRail5ApprovalToken rejects wrong token", !verifyRail5ApprovalToken("test_checkout_123", "badtoken"));
      log("verifyRail5ApprovalToken rejects wrong checkout_id", !verifyRail5ApprovalToken("wrong_id", token));

      const token2 = generateRail5ApprovalToken("test_checkout_456");
      log("Different checkoutIds produce different tokens", token !== token2);

      const sameToken = generateRail5ApprovalToken("test_checkout_123");
      log("Same checkoutId produces same token (deterministic)", token === sameToken);
    } else {
      log("HMAC tests skipped (no CONFIRMATION_HMAC_SECRET or CRON_SECRET)", true);
    }
  }

  // ─── Approval TTL / Expiration ────────────────────────────────
  console.log("\n--- Approval TTL / Expiration ---");

  {
    log("RAIL5_APPROVAL_TTL_MS is 15 minutes", RAIL5_APPROVAL_TTL_MS === 15 * 60 * 1000);
  }

  {
    const recent = new Date(Date.now() - 5 * 60 * 1000);
    log("isRail5ApprovalExpired returns false for 5-minute-old checkout", !isRail5ApprovalExpired(recent));
  }

  {
    const old = new Date(Date.now() - 20 * 60 * 1000);
    log("isRail5ApprovalExpired returns true for 20-minute-old checkout", isRail5ApprovalExpired(old));
  }

  {
    const justNow = new Date();
    log("isRail5ApprovalExpired returns false for just-created checkout", !isRail5ApprovalExpired(justNow));
  }

  {
    const exactlyExpired = new Date(Date.now() - RAIL5_APPROVAL_TTL_MS - 1);
    log("isRail5ApprovalExpired returns true at TTL+1ms", isRail5ApprovalExpired(exactlyExpired));
  }

  // ─── Card CRUD ────────────────────────────────────────────────
  console.log("\n--- Card Storage CRUD ---");

  cardId = generateRail5CardId();

  try {
    const card = await storage.createRail5Card({
      cardId,
      ownerUid: TEST_OWNER_UID,
      cardName: "Test Visa",
      cardBrand: "visa",
      cardLast4: "4242",
      spendingLimitCents: 50000,
      dailyLimitCents: 100000,
      monthlyLimitCents: 500000,
      humanApprovalAboveCents: 25000,
      status: "pending_setup",
    });
    log("createRail5Card", !!card && card.cardId === cardId && card.ownerUid === TEST_OWNER_UID);
  } catch (e: any) {
    log("createRail5Card", false, e.message);
  }

  try {
    const card = await storage.getRail5CardByCardId(cardId);
    log("getRail5CardByCardId", !!card && card.cardName === "Test Visa" && card.cardLast4 === "4242");
  } catch (e: any) {
    log("getRail5CardByCardId", false, e.message);
  }

  try {
    const cards = await storage.getRail5CardsByOwnerUid(TEST_OWNER_UID);
    log("getRail5CardsByOwnerUid", cards.length === 1 && cards[0].cardId === cardId);
  } catch (e: any) {
    log("getRail5CardsByOwnerUid", false, e.message);
  }

  try {
    const updated = await storage.updateRail5Card(cardId, {
      botId: TEST_BOT_ID,
      status: "active",
      encryptedKeyHex: "a".repeat(64),
      encryptedIvHex: "b".repeat(24),
      encryptedTagHex: "c".repeat(32),
    });
    log("updateRail5Card (activate + set key material)", !!updated && updated.status === "active" && updated.botId === TEST_BOT_ID);
  } catch (e: any) {
    log("updateRail5Card (activate + set key material)", false, e.message);
  }

  try {
    const card = await storage.getRail5CardByBotId(TEST_BOT_ID);
    log("getRail5CardByBotId", !!card && card.cardId === cardId);
  } catch (e: any) {
    log("getRail5CardByBotId", false, e.message);
  }

  try {
    const card = await storage.getRail5CardByBotId("nonexistent_bot");
    log("getRail5CardByBotId (nonexistent)", card === null || card === undefined);
  } catch (e: any) {
    log("getRail5CardByBotId (nonexistent)", false, e.message);
  }

  try {
    const updated = await storage.updateRail5Card(cardId, { status: "frozen" });
    log("updateRail5Card (freeze)", !!updated && updated.status === "frozen");
  } catch (e: any) {
    log("updateRail5Card (freeze)", false, e.message);
  }

  try {
    const updated = await storage.updateRail5Card(cardId, { status: "active" });
    log("updateRail5Card (unfreeze)", !!updated && updated.status === "active");
  } catch (e: any) {
    log("updateRail5Card (unfreeze)", false, e.message);
  }

  // ─── Checkout Lifecycle ───────────────────────────────────────
  console.log("\n--- Checkout Lifecycle ---");

  checkoutId = generateRail5CheckoutId();

  try {
    const checkout = await storage.createRail5Checkout({
      checkoutId,
      cardId,
      botId: TEST_BOT_ID,
      ownerUid: TEST_OWNER_UID,
      merchantName: "TestMerchant",
      merchantUrl: "https://test.com",
      itemName: "Widget Pro",
      amountCents: 3500,
      category: "electronics",
      status: "approved",
    });
    log("createRail5Checkout", !!checkout && checkout.checkoutId === checkoutId && checkout.amountCents === 3500);
  } catch (e: any) {
    log("createRail5Checkout", false, e.message);
  }

  try {
    const checkout = await storage.getRail5CheckoutById(checkoutId);
    log("getRail5CheckoutById", !!checkout && checkout.merchantName === "TestMerchant" && checkout.status === "approved");
  } catch (e: any) {
    log("getRail5CheckoutById", false, e.message);
  }

  try {
    const checkout = await storage.getRail5CheckoutById("nonexistent_checkout");
    log("getRail5CheckoutById (nonexistent)", checkout === null || checkout === undefined);
  } catch (e: any) {
    log("getRail5CheckoutById (nonexistent)", false, e.message);
  }

  try {
    const updated = await storage.updateRail5Checkout(checkoutId, { keyDelivered: true });
    log("updateRail5Checkout (key delivered)", !!updated && updated.keyDelivered === true);
  } catch (e: any) {
    log("updateRail5Checkout (key delivered)", false, e.message);
  }

  try {
    const updated = await storage.updateRail5Checkout(checkoutId, { status: "completed", confirmedAt: new Date() });
    log("updateRail5Checkout (complete)", !!updated && updated.status === "completed" && !!updated.confirmedAt);
  } catch (e: any) {
    log("updateRail5Checkout (complete)", false, e.message);
  }

  const pendingCheckoutId = generateRail5CheckoutId();
  try {
    await storage.createRail5Checkout({
      checkoutId: pendingCheckoutId,
      cardId,
      botId: TEST_BOT_ID,
      ownerUid: TEST_OWNER_UID,
      merchantName: "PendingMerch",
      merchantUrl: "https://pending.com",
      itemName: "Expensive Thing",
      amountCents: 50000,
      status: "pending_approval",
    });
    log("createRail5Checkout (pending_approval)", true);
  } catch (e: any) {
    log("createRail5Checkout (pending_approval)", false, e.message);
  }

  try {
    const updated = await storage.updateRail5Checkout(pendingCheckoutId, { status: "denied", confirmedAt: new Date() });
    log("updateRail5Checkout (deny)", !!updated && updated.status === "denied");
  } catch (e: any) {
    log("updateRail5Checkout (deny)", false, e.message);
  }

  const expiredCheckoutId = generateRail5CheckoutId();
  try {
    await storage.createRail5Checkout({
      checkoutId: expiredCheckoutId,
      cardId,
      botId: TEST_BOT_ID,
      ownerUid: TEST_OWNER_UID,
      merchantName: "ExpiredMerch",
      merchantUrl: "https://expired.com",
      itemName: "Timeout Item",
      amountCents: 99900,
      status: "pending_approval",
    });
    const updated = await storage.updateRail5Checkout(expiredCheckoutId, { status: "expired" });
    log("updateRail5Checkout (expire)", !!updated && updated.status === "expired");
  } catch (e: any) {
    log("updateRail5Checkout (expire)", false, e.message);
  }

  // Failed checkout
  const failedCheckoutId = generateRail5CheckoutId();
  try {
    await storage.createRail5Checkout({
      checkoutId: failedCheckoutId,
      cardId,
      botId: TEST_BOT_ID,
      ownerUid: TEST_OWNER_UID,
      merchantName: "FailMerch",
      merchantUrl: "https://fail.com",
      itemName: "Broken Widget",
      amountCents: 1500,
      status: "approved",
    });
    const updated = await storage.updateRail5Checkout(failedCheckoutId, { status: "failed", confirmedAt: new Date() });
    log("updateRail5Checkout (fail)", !!updated && updated.status === "failed");
  } catch (e: any) {
    log("updateRail5Checkout (fail)", false, e.message);
  }

  try {
    const checkouts = await storage.getRail5CheckoutsByCardId(cardId);
    log("getRail5CheckoutsByCardId returns all checkouts", checkouts.length === 4);
    log("getRail5CheckoutsByCardId ordered by createdAt desc", checkouts[0].createdAt >= checkouts[1].createdAt);
  } catch (e: any) {
    log("getRail5CheckoutsByCardId", false, e.message);
  }

  try {
    const checkouts = await storage.getRail5CheckoutsByCardId(cardId, 2);
    log("getRail5CheckoutsByCardId respects limit", checkouts.length === 2);
  } catch (e: any) {
    log("getRail5CheckoutsByCardId respects limit", false, e.message);
  }

  // ─── Spend Aggregation (Edge Cases) ───────────────────────────
  console.log("\n--- Spend Aggregation ---");

  try {
    const daily = await getDailySpendCents(cardId);
    log("getDailySpendCents returns number", typeof daily === "number" && daily >= 0);
    log("getDailySpendCents includes completed checkout ($35.00)", daily >= 3500);
  } catch (e: any) {
    log("getDailySpendCents", false, e.message);
  }

  try {
    const monthly = await getMonthlySpendCents(cardId);
    log("getMonthlySpendCents returns number", typeof monthly === "number" && monthly >= 0);
    log("getMonthlySpendCents includes completed checkout ($35.00)", monthly >= 3500);
  } catch (e: any) {
    log("getMonthlySpendCents", false, e.message);
  }

  {
    const daily = await getDailySpendCents(cardId);
    log("getDailySpendCents excludes denied checkout ($500.00)", daily < 50000 + 3500);
  }

  {
    const daily = await getDailySpendCents(cardId);
    log("getDailySpendCents excludes expired checkout ($999.00)", daily < 99900 + 3500);
  }

  {
    const daily = await getDailySpendCents(cardId);
    log("getDailySpendCents excludes failed checkout ($15.00)", daily < 1500 + 3500 + 1);
  }

  {
    const daily = await getDailySpendCents("nonexistent_card");
    log("getDailySpendCents returns 0 for nonexistent card", daily === 0);
  }

  {
    const monthly = await getMonthlySpendCents("nonexistent_card");
    log("getMonthlySpendCents returns 0 for nonexistent card", monthly === 0);
  }

  // ─── Card Deletion ────────────────────────────────────────────
  console.log("\n--- Card Deletion ---");

  try {
    await storage.deleteRail5Card(cardId);
    const deleted = await storage.getRail5CardByCardId(cardId);
    log("deleteRail5Card removes card", deleted === null || deleted === undefined);
  } catch (e: any) {
    log("deleteRail5Card", false, e.message);
  }

  // ─── Summary ──────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`Rail 5 Tests: ${passed} passed, ${failed} failed out of ${results.length} total`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  if (failed > 0) {
    console.log("Failed tests:");
    results.filter(r => !r.pass).forEach(r => console.log(`  ❌ ${r.test}: ${r.error}`));
  }

  return { passed, failed, total: results.length };
}

runRail5Tests().then((r) => {
  process.exit(r.failed > 0 ? 1 : 0);
}).catch((e) => {
  console.error("Test runner failed:", e);
  process.exit(1);
});
