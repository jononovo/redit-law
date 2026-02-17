import { computeVersionDiff, detectChangedFields, hasBreakingChanges } from "@/lib/procurement-skills/versioning/diff";
import { generateAllFiles, computeChecksum, bumpVersion, prepareVersionData } from "@/lib/procurement-skills/versioning/version";
import { generateSkillJson, inferRequiredRails } from "@/lib/procurement-skills/package/skill-json";
import { generatePaymentsMd } from "@/lib/procurement-skills/package/payments-md";
import { generateDescriptionMd } from "@/lib/procurement-skills/package/description-md";
import type { VendorSkill } from "@/lib/procurement-skills/types";

function runEdgeTests() {
  const results: { test: string; pass: boolean; error?: string }[] = [];

  function log(test: string, pass: boolean, error?: string) {
    results.push({ test, pass, error });
    console.log(`${pass ? "✅" : "❌"} ${test}${error ? ` — ${error}` : ""}`);
  }

  const makeVendor = (overrides: Partial<VendorSkill> = {}): VendorSkill => ({
    slug: "test-vendor",
    name: "Test Vendor",
    category: "retail",
    url: "https://example.com",
    checkoutMethods: ["native_api"],
    capabilities: ["guest_checkout"],
    maturity: "verified",
    methodConfig: {
      native_api: { requiresAuth: false, notes: "REST API" },
    },
    search: { pattern: "Search by name" },
    checkout: { guestCheckout: true, taxExemptField: false, poNumberField: false },
    shipping: { estimatedDays: "3-5 days", businessShipping: false },
    tips: ["Use JSON API"],
    version: "1.0.0",
    lastVerified: "2026-01-01",
    generatedBy: "manual",
    ...overrides,
  });

  console.log("\n═══════════════════════════════════════════════");
  console.log("  SECTION 1: Diff Edge Cases");
  console.log("═══════════════════════════════════════════════\n");

  {
    const v1 = makeVendor({ capabilities: [] });
    const v2 = makeVendor({ capabilities: ["guest_checkout", "order_tracking", "bulk_ordering"] });
    const diff = computeVersionDiff(v1, v2, "1.0.0", "1.1.0");
    log("Diff: empty to many capabilities is breaking", diff.breakingChanges > 0);
    const capField = diff.fields.find(f => f.field === "capabilities");
    log("Diff: capabilities field exists in diff", capField !== undefined);
    log("Diff: capabilities type is 'changed'", capField?.type === "changed");
  }

  {
    const v1 = makeVendor({
      methodConfig: { native_api: { requiresAuth: false, notes: "v1" } },
    });
    const v2 = makeVendor({
      methodConfig: { native_api: { requiresAuth: true, notes: "v2" } },
    });
    const diff = computeVersionDiff(v1, v2, "1.0.0", "1.1.0");
    log("Diff: methodConfig change is breaking severity", diff.breakingChanges > 0);
  }

  {
    const v1 = makeVendor({
      search: { pattern: "old pattern" },
    });
    const v2 = makeVendor({
      search: { pattern: "new pattern", urlTemplate: "https://example.com/search?q={query}" },
    });
    const diff = computeVersionDiff(v1, v2, "1.0.0", "1.1.0");
    log("Diff: search pattern change detected", diff.fields.some(f => f.field === "search.pattern"));
    log("Diff: urlTemplate addition detected", diff.fields.some(f => f.field === "search.urlTemplate"));
    log("Diff: search.pattern is breaking", diff.fields.find(f => f.field === "search.pattern")?.severity === "breaking");
    log("Diff: search.urlTemplate is breaking", diff.fields.find(f => f.field === "search.urlTemplate")?.severity === "breaking");
  }

  {
    const v1 = makeVendor({
      checkout: { guestCheckout: true, taxExemptField: false, poNumberField: false },
    });
    const v2 = makeVendor({
      checkout: { guestCheckout: false, taxExemptField: true, poNumberField: true },
    });
    const diff = computeVersionDiff(v1, v2, "1.0.0", "1.0.1");
    log("Diff: multiple checkout changes detected", diff.fields.filter(f => f.field.startsWith("checkout.")).length === 3);
    log("Diff: checkout changes are notable severity", diff.fields.filter(f => f.field.startsWith("checkout.")).every(f => f.severity === "notable"));
  }

  {
    const v1 = makeVendor({ maturity: "experimental" as any });
    const v2 = makeVendor({ maturity: "verified" });
    const diff = computeVersionDiff(v1, v2, "1.0.0", "1.0.1");
    log("Diff: maturity change is notable", diff.fields.find(f => f.field === "maturity")?.severity === "notable");
  }

  {
    const v1 = makeVendor({ tips: [] });
    const v2 = makeVendor({ tips: [] });
    const diff = computeVersionDiff(v1, v2, "1.0.0", "1.0.1");
    log("Diff: empty arrays both sides = no change", diff.totalChanges === 0);
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  SECTION 2: Version Bumping Edge Cases");
  console.log("═══════════════════════════════════════════════\n");

  {
    const v1 = makeVendor();
    log("bumpVersion: null oldSkill returns 1.0.0", bumpVersion("5.3.2", null, v1) === "1.0.0");
    log("bumpVersion: empty string version returns 1.0.0", bumpVersion("", null, v1) === "1.0.0");
  }

  {
    const v1 = makeVendor({ tips: ["a"] });
    const v2 = makeVendor({ tips: ["a", "b"] });
    const v3 = makeVendor({ tips: ["a", "b", "c"] });
    const ver1 = bumpVersion("1.0.0", v1, v2);
    const ver2 = bumpVersion(ver1, v2, v3);
    log("bumpVersion: sequential patches 1.0.0 → 1.0.1 → 1.0.2", ver1 === "1.0.1" && ver2 === "1.0.2");
  }

  {
    const v1 = makeVendor({ checkoutMethods: ["native_api"] });
    const v2 = makeVendor({ checkoutMethods: ["browser_automation"] });
    const v3 = makeVendor({ checkoutMethods: ["native_api", "x402"] });
    const ver1 = bumpVersion("1.0.5", v1, v2);
    const ver2 = bumpVersion(ver1, v2, v3);
    log("bumpVersion: breaking then breaking = minor resets patch", ver1 === "1.1.0" && ver2 === "1.2.0");
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  SECTION 3: Checksum Edge Cases");
  console.log("═══════════════════════════════════════════════\n");

  {
    const v1 = makeVendor({ name: "A" });
    const v2 = makeVendor({ name: "B" });
    const c1 = computeChecksum(v1);
    const c2 = computeChecksum(v2);
    log("Checksum: single field difference produces unique hash", c1 !== c2);
  }

  {
    const v1 = makeVendor({ tips: ["a", "b"] });
    const v2 = makeVendor({ tips: ["b", "a"] });
    const c1 = computeChecksum(v1);
    const c2 = computeChecksum(v2);
    log("Checksum: array order matters", c1 !== c2);
  }

  {
    const checksum = computeChecksum(makeVendor());
    log("Checksum: is 64 chars (SHA-256 hex)", checksum.length === 64);
    log("Checksum: is lowercase hex", /^[0-9a-f]{64}$/.test(checksum));
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  SECTION 4: Package Generator Edge Cases");
  console.log("═══════════════════════════════════════════════\n");

  {
    const vendor = makeVendor({ checkoutMethods: ["x402"] });
    const rails = inferRequiredRails(vendor);
    log("inferRequiredRails: x402 maps to stripe_wallet", rails.includes("stripe_wallet"));
  }

  {
    const vendor = makeVendor({ checkoutMethods: ["crossmint_world"] });
    const rails = inferRequiredRails(vendor);
    log("inferRequiredRails: crossmint maps to card_wallet", rails.includes("card_wallet"));
  }

  {
    const vendor = makeVendor({ checkoutMethods: ["self_hosted_card"] });
    const rails = inferRequiredRails(vendor);
    log("inferRequiredRails: self_hosted_card maps to self_hosted", rails.includes("self_hosted"));
  }

  {
    const vendor = makeVendor({ checkoutMethods: ["native_api", "x402", "self_hosted_card"] });
    const rails = inferRequiredRails(vendor);
    log("inferRequiredRails: multi-method deduplicates", rails.length === new Set(rails).size);
    log("inferRequiredRails: multi-method includes all rails", rails.length >= 2);
  }

  {
    const vendor = makeVendor({
      shipping: { estimatedDays: "1-2 days", businessShipping: true, freeThreshold: 50 },
    });
    const md = generatePaymentsMd(vendor);
    log("payments.md: includes spending limits", md.toLowerCase().includes("spending limits"));
    log("payments.md: includes payment rails", md.toLowerCase().includes("payment rail"));
  }

  {
    const vendor = makeVendor({ checkoutMethods: ["native_api", "x402"] });
    const md = generatePaymentsMd(vendor);
    log("payments.md: lists multiple rails", md.includes("Card Wallet") && md.includes("Stripe Wallet"));
  }

  {
    const vendor = makeVendor({ name: "Special & <Vendor> \"Test\"" });
    const desc = generateDescriptionMd(vendor, "2.0.0");
    log("description.md: handles special characters in name", desc.includes("Special"));
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  SECTION 5: prepareVersionData Rollback Flow");
  console.log("═══════════════════════════════════════════════\n");

  {
    const v1 = makeVendor({ name: "Original" });
    const data = prepareVersionData({
      vendorSlug: "test-vendor",
      vendorData: v1,
      changeType: "rollback",
      changeSummary: "Rollback to v1",
      publishedBy: "admin",
      sourceType: "registry",
      previousVersion: {
        id: 5,
        version: "2.3.0",
        vendorData: makeVendor({ name: "Current" }),
      },
    });
    log("Rollback: version increments from previous", data.version === "2.3.1");
    log("Rollback: changeType is rollback", data.changeType === "rollback");
    log("Rollback: previousVersionId references current", data.previousVersionId === 5);
    log("Rollback: isActive is true", data.isActive === true);
    log("Rollback: changeSummary preserved", data.changeSummary === "Rollback to v1");
  }

  {
    const data = prepareVersionData({
      vendorSlug: "new-vendor",
      vendorData: makeVendor({ slug: "new-vendor" }),
      changeType: "initial",
      changeSummary: "First version",
      publishedBy: "user1",
      sourceType: "community",
      sourceDraftId: 42,
    });
    log("Initial: no previousVersionId", data.previousVersionId === null);
    log("Initial: no changedFields", data.changedFields === undefined);
    log("Initial: sourceDraftId preserved", data.sourceDraftId === 42);
    log("Initial: sourceType is community", data.sourceType === "community");
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  SECTION 6: Diff Summary Formatting");
  console.log("═══════════════════════════════════════════════\n");

  {
    const v1 = makeVendor();
    const v2 = makeVendor();
    const diff = computeVersionDiff(v1, v2, "1.0.0", "1.0.0");
    log("Diff summary: no changes says 'No changes'", diff.summary === "No changes");
  }

  {
    const v1 = makeVendor({ tips: ["a"], name: "A", checkoutMethods: ["native_api"] });
    const v2 = makeVendor({ tips: ["b"], name: "B", checkoutMethods: ["browser_automation"] });
    const diff = computeVersionDiff(v1, v2, "1.0.0", "1.1.0");
    log("Diff summary: includes 'breaking' when breaking exists", diff.summary.includes("breaking"));
    log("Diff summary: includes 'minor' when minor exists", diff.summary.includes("minor"));
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  RESULTS SUMMARY");
  console.log("═══════════════════════════════════════════════\n");

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`  Total: ${results.length}  |  ✅ Passed: ${passed}  |  ❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log("\n  Failed tests:");
    results.filter(r => !r.pass).forEach(r => console.log(`    ❌ ${r.test} ${r.error ? `(${r.error})` : ""}`));
  }

  return { total: results.length, passed, failed };
}

runEdgeTests();
