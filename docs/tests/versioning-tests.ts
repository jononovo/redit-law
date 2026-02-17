import { computeVersionDiff, detectChangedFields, hasBreakingChanges } from "@/lib/procurement-skills/versioning/diff";
import { generateAllFiles, computeChecksum, bumpVersion, prepareVersionData } from "@/lib/procurement-skills/versioning/version";
import { generateSkillJson } from "@/lib/procurement-skills/package/skill-json";
import { generatePaymentsMd } from "@/lib/procurement-skills/package/payments-md";
import { generateDescriptionMd } from "@/lib/procurement-skills/package/description-md";
import type { VendorSkill } from "@/lib/procurement-skills/types";

function runVersioningTests() {
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
  console.log("  SECTION 1: Multi-File Package Generators");
  console.log("═══════════════════════════════════════════════\n");

  {
    const vendor = makeVendor();
    const json = generateSkillJson(vendor);
    log("skill.json: has slug", json.slug === "test-vendor");
    log("skill.json: has name", json.name === "Test Vendor");
    log("skill.json: has category", json.category === "retail");
    log("skill.json: has checkoutMethods", Array.isArray(json.checkoutMethods) && json.checkoutMethods.includes("native_api"));
    log("skill.json: has capabilities", Array.isArray(json.capabilities));
    log("skill.json: has agentFriendliness score", typeof json.agentFriendliness === "number");
    log("skill.json: has version", typeof json.version === "string");
    log("skill.json: has creditclaw config", json.creditclaw !== undefined);
  }

  {
    const vendor = makeVendor();
    const md = generatePaymentsMd(vendor);
    log("payments.md: contains vendor name", md.includes("Test Vendor"));
    log("payments.md: contains payment rules", md.toLowerCase().includes("payment"));
    log("payments.md: is non-empty", md.length > 100);
  }

  {
    const vendor = makeVendor();
    const md = generateDescriptionMd(vendor, "1.0.0");
    log("description.md: contains vendor name", md.includes("Test Vendor"));
    log("description.md: is non-empty", md.length > 50);
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  SECTION 2: Diff Algorithm");
  console.log("═══════════════════════════════════════════════\n");

  {
    const v1 = makeVendor();
    const v2 = makeVendor();
    const diff = computeVersionDiff(v1, v2, "1.0.0", "1.0.1");
    log("Diff: identical vendors have 0 changes", diff.totalChanges === 0);
  }

  {
    const v1 = makeVendor({ name: "Old Name" });
    const v2 = makeVendor({ name: "New Name" });
    const diff = computeVersionDiff(v1, v2, "1.0.0", "1.0.1");
    log("Diff: name change detected", diff.totalChanges > 0);
    const nameField = diff.fields.find(f => f.field === "name");
    log("Diff: name field type is 'changed'", nameField?.type === "changed");
    log("Diff: name old value correct", nameField?.oldValue === "Old Name");
    log("Diff: name new value correct", nameField?.newValue === "New Name");
  }

  {
    const v1 = makeVendor({ checkoutMethods: ["native_api"] });
    const v2 = makeVendor({ checkoutMethods: ["native_api", "browser_automation"] });
    const diff = computeVersionDiff(v1, v2, "1.0.0", "1.0.1");
    log("Diff: checkout method added detected", diff.totalChanges > 0);
  }

  {
    const v1 = makeVendor({ checkoutMethods: ["native_api", "browser_automation"] });
    const v2 = makeVendor({ checkoutMethods: ["browser_automation"] });
    const diff = computeVersionDiff(v1, v2, "1.0.0", "1.0.1");
    log("Diff: checkout method removed is breaking", diff.breakingChanges > 0);
  }

  {
    const v1 = makeVendor({ url: "https://old.com" });
    const v2 = makeVendor({ url: "https://new.com" });
    const diff = computeVersionDiff(v1, v2, "1.0.0", "1.0.1");
    log("Diff: URL change is notable", diff.totalChanges > 0 && diff.fields.some(f => f.field === "url" && f.severity === "notable"));
  }

  {
    const v1 = makeVendor({ tips: ["tip1"] });
    const v2 = makeVendor({ tips: ["tip1", "tip2"] });
    const diff = computeVersionDiff(v1, v2, "1.0.0", "1.0.1");
    log("Diff: tips change is minor", diff.totalChanges > 0 && diff.breakingChanges === 0);
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  SECTION 3: detectChangedFields");
  console.log("═══════════════════════════════════════════════\n");

  {
    const v1 = makeVendor();
    const v2 = makeVendor({ name: "Changed", url: "https://new.com" });
    const fields = detectChangedFields(v1, v2);
    log("detectChangedFields: includes 'name'", fields.includes("name"));
    log("detectChangedFields: includes 'url'", fields.includes("url"));
    log("detectChangedFields: does not include 'slug'", !fields.includes("slug"));
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  SECTION 4: hasBreakingChanges");
  console.log("═══════════════════════════════════════════════\n");

  {
    const v1 = makeVendor({ checkoutMethods: ["native_api", "browser_automation"] });
    const v2 = makeVendor({ checkoutMethods: ["browser_automation"] });
    log("hasBreakingChanges: checkout method removed is breaking", hasBreakingChanges(v1, v2) === true);
  }

  {
    const v1 = makeVendor();
    const v2 = makeVendor({ tips: ["new tip"] });
    log("hasBreakingChanges: tips change is NOT breaking", hasBreakingChanges(v1, v2) === false);
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  SECTION 5: bumpVersion");
  console.log("═══════════════════════════════════════════════\n");

  {
    const v1 = makeVendor();
    const v2 = makeVendor({ tips: ["different tip"] });
    log("bumpVersion: initial (no current)", bumpVersion("", null, v1) === "1.0.0");
    log("bumpVersion: patch bump (non-breaking)", bumpVersion("1.0.0", v1, v2) === "1.0.1");

    const v3 = makeVendor({ checkoutMethods: ["browser_automation"] });
    log("bumpVersion: minor bump (breaking)", bumpVersion("1.0.0", v1, v3) === "1.1.0");

    const v4 = makeVendor({ checkoutMethods: ["browser_automation"] });
    log("bumpVersion: minor from 1.2.3", bumpVersion("1.2.3", v1, v4) === "1.3.0");
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  SECTION 6: generateAllFiles");
  console.log("═══════════════════════════════════════════════\n");

  {
    const vendor = makeVendor();
    const files = generateAllFiles(vendor, "1.0.0");
    log("generateAllFiles: has skillMd", typeof files.skillMd === "string" && files.skillMd.length > 0);
    log("generateAllFiles: has skillJson object", typeof files.skillJson === "object" && files.skillJson !== null);
    log("generateAllFiles: has paymentsMd", typeof files.paymentsMd === "string" && files.paymentsMd.length > 0);
    log("generateAllFiles: has descriptionMd", typeof files.descriptionMd === "string" && files.descriptionMd.length > 0);
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  SECTION 7: computeChecksum");
  console.log("═══════════════════════════════════════════════\n");

  {
    const v1 = makeVendor();
    const checksum1 = computeChecksum(v1);
    const checksum2 = computeChecksum(v1);
    log("computeChecksum: deterministic", checksum1 === checksum2);
    log("computeChecksum: non-empty", checksum1.length > 0);

    const v2 = makeVendor({ name: "Different" });
    const checksum3 = computeChecksum(v2);
    log("computeChecksum: different content = different checksum", checksum1 !== checksum3);
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  SECTION 8: prepareVersionData");
  console.log("═══════════════════════════════════════════════\n");

  {
    const vendor = makeVendor();
    const data = prepareVersionData({
      vendorSlug: "test-vendor",
      vendorData: vendor,
      changeType: "initial",
      changeSummary: "First publish",
      publishedBy: "user123",
      sourceType: "draft",
    });
    log("prepareVersionData: vendorSlug set", data.vendorSlug === "test-vendor");
    log("prepareVersionData: version is 1.0.0", data.version === "1.0.0");
    log("prepareVersionData: isActive is true", data.isActive === true);
    log("prepareVersionData: has skillMd", typeof data.skillMd === "string" && data.skillMd.length > 0);
    log("prepareVersionData: has skillJson", data.skillJson !== null);
    log("prepareVersionData: has paymentsMd", typeof data.paymentsMd === "string");
    log("prepareVersionData: has descriptionMd", typeof data.descriptionMd === "string");
    log("prepareVersionData: has checksum", typeof data.checksum === "string");
    log("prepareVersionData: changeType is initial", data.changeType === "initial");
    log("prepareVersionData: publishedBy set", data.publishedBy === "user123");
  }

  {
    const v1 = makeVendor({ name: "Old", checkoutMethods: ["native_api", "browser_automation"] });
    const v2 = makeVendor({ name: "New", checkoutMethods: ["browser_automation"] });
    const data = prepareVersionData({
      vendorSlug: "test-vendor",
      vendorData: v2,
      changeType: "edit",
      changeSummary: "Updated name and checkout methods",
      publishedBy: "user123",
      sourceType: "draft",
      previousVersion: {
        id: 1,
        version: "1.0.0",
        vendorData: v1,
      },
    });
    log("prepareVersionData with prev: version bumped", data.version !== "1.0.0");
    log("prepareVersionData with prev: previousVersionId set", data.previousVersionId === 1);
    log("prepareVersionData with prev: changedFields includes name", data.changedFields?.includes("name") ?? false);
    log("prepareVersionData with prev: breaking change bumps minor", data.version === "1.1.0");
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

runVersioningTests();
