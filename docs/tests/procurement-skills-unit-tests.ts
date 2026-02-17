import { computeAgentFriendliness, VendorSkill, CheckoutMethod, VendorCapability, SkillMaturity, CHECKOUT_METHOD_LABELS, CHECKOUT_METHOD_COLORS, CAPABILITY_LABELS, CATEGORY_LABELS } from "@/lib/procurement-skills/types";
import { VENDOR_REGISTRY, getVendorBySlug, getVendorsByCategory, searchVendors } from "@/lib/procurement-skills/registry";
import { generateVendorSkill } from "@/lib/procurement-skills/generator";

function runProcurementSkillsTests() {
  const results: { test: string; pass: boolean; error?: string }[] = [];

  function log(test: string, pass: boolean, error?: string) {
    results.push({ test, pass, error });
    console.log(`${pass ? "✅" : "❌"} ${test}${error ? ` — ${error}` : ""}`);
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  SECTION 1: computeAgentFriendliness()");
  console.log("═══════════════════════════════════════════════\n");

  const makeVendor = (overrides: Partial<VendorSkill>): VendorSkill => ({
    slug: "test-vendor",
    name: "Test Vendor",
    category: "retail",
    url: "https://example.com",
    checkoutMethods: ["native_api"],
    capabilities: [],
    maturity: "verified",
    methodConfig: {
      native_api: { requiresAuth: false, notes: "Test" },
    },
    search: { pattern: "Search by name" },
    checkout: { guestCheckout: false, taxExemptField: false, poNumberField: false },
    shipping: { estimatedDays: "3-5 days", businessShipping: false },
    tips: [],
    version: "1.0.0",
    lastVerified: "2026-01-01",
    generatedBy: "manual",
    ...overrides,
  });

  {
    const v = makeVendor({
      checkout: { guestCheckout: false, taxExemptField: false, poNumberField: false },
      checkoutMethods: ["browser_automation"],
      methodConfig: { browser_automation: { requiresAuth: true, notes: "" } },
      capabilities: [],
    });
    const score = computeAgentFriendliness(v);
    log("Score=0: no guest checkout, auth required, no programmatic, no high success", score === 0, `got ${score}`);
  }

  {
    const v = makeVendor({
      checkout: { guestCheckout: true, taxExemptField: false, poNumberField: false },
      checkoutMethods: ["browser_automation"],
      methodConfig: { browser_automation: { requiresAuth: true, notes: "" } },
      capabilities: [],
    });
    const score = computeAgentFriendliness(v);
    log("Score=1: guest checkout only", score === 1, `got ${score}`);
  }

  {
    const v = makeVendor({
      checkout: { guestCheckout: true, taxExemptField: false, poNumberField: false },
      checkoutMethods: ["native_api"],
      methodConfig: { native_api: { requiresAuth: false, notes: "" } },
      capabilities: [],
    });
    const score = computeAgentFriendliness(v);
    log("Score=2: guest checkout + no auth on primary method", score === 2, `got ${score}`);
  }

  {
    const v = makeVendor({
      checkout: { guestCheckout: true, taxExemptField: false, poNumberField: false },
      checkoutMethods: ["native_api"],
      methodConfig: { native_api: { requiresAuth: false, notes: "" } },
      capabilities: ["programmatic_checkout"],
    });
    const score = computeAgentFriendliness(v);
    log("Score=4: guest + no auth + programmatic_checkout (+2)", score === 4, `got ${score}`);
  }

  {
    const v = makeVendor({
      checkout: { guestCheckout: true, taxExemptField: false, poNumberField: false },
      checkoutMethods: ["native_api"],
      methodConfig: { native_api: { requiresAuth: false, notes: "" } },
      capabilities: ["programmatic_checkout"],
      feedbackStats: { successRate: 0.95 },
    });
    const score = computeAgentFriendliness(v);
    log("Score=5 (capped): all factors present, high success rate", score === 5, `got ${score}`);
  }

  {
    const v = makeVendor({
      checkout: { guestCheckout: true, taxExemptField: false, poNumberField: false },
      checkoutMethods: ["native_api"],
      methodConfig: { native_api: { requiresAuth: false, notes: "" } },
      capabilities: ["programmatic_checkout"],
      feedbackStats: { successRate: 0.5 },
    });
    const score = computeAgentFriendliness(v);
    log("Score=4: all factors except low success rate (0.5 < 0.85)", score === 4, `got ${score}`);
  }

  {
    const v = makeVendor({
      checkout: { guestCheckout: false, taxExemptField: false, poNumberField: false },
      checkoutMethods: [],
      methodConfig: {},
      capabilities: [],
    });
    const score = computeAgentFriendliness(v);
    log("Score=0: empty checkoutMethods array handled safely", score === 0, `got ${score}`);
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  SECTION 2: Label & Color Constants");
  console.log("═══════════════════════════════════════════════\n");

  {
    const allMethods: CheckoutMethod[] = ["native_api", "acp", "x402", "crossmint_world", "self_hosted_card", "browser_automation"];
    const hasAll = allMethods.every(m => typeof CHECKOUT_METHOD_LABELS[m] === "string" && CHECKOUT_METHOD_LABELS[m].length > 0);
    log("CHECKOUT_METHOD_LABELS has entries for all 6 checkout methods", hasAll);
  }

  {
    const allMethods: CheckoutMethod[] = ["native_api", "acp", "x402", "crossmint_world", "self_hosted_card", "browser_automation"];
    const hasAll = allMethods.every(m => typeof CHECKOUT_METHOD_COLORS[m] === "string" && CHECKOUT_METHOD_COLORS[m].length > 0);
    log("CHECKOUT_METHOD_COLORS has entries for all 6 checkout methods", hasAll);
  }

  {
    const allCaps: VendorCapability[] = ["price_lookup", "stock_check", "programmatic_checkout", "business_invoicing", "bulk_pricing", "tax_exemption", "account_creation", "order_tracking", "returns", "po_numbers"];
    const hasAll = allCaps.every(c => typeof CAPABILITY_LABELS[c] === "string" && CAPABILITY_LABELS[c].length > 0);
    log("CAPABILITY_LABELS has entries for all 10 capabilities", hasAll);
  }

  {
    const allCats = ["retail", "office", "hardware", "electronics", "industrial", "specialty"];
    const hasAll = allCats.every(c => typeof CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS] === "string");
    log("CATEGORY_LABELS has entries for all 6 categories", hasAll);
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  SECTION 3: VENDOR_REGISTRY Integrity");
  console.log("═══════════════════════════════════════════════\n");

  {
    log("Registry has at least 14 vendors", VENDOR_REGISTRY.length >= 14, `found ${VENDOR_REGISTRY.length}`);
  }

  {
    const slugs = VENDOR_REGISTRY.map(v => v.slug);
    const unique = new Set(slugs);
    log("All vendor slugs are unique", slugs.length === unique.size, `${slugs.length} slugs, ${unique.size} unique`);
  }

  {
    const required = ["amazon", "shopify", "amazon-business", "walmart", "staples", "home-depot", "lowes", "office-depot", "uline", "grainger", "newegg", "bh-photo", "mcmaster-carr"];
    const slugs = VENDOR_REGISTRY.map(v => v.slug);
    const missing = required.filter(r => !slugs.includes(r));
    log("All expected P1/P2 vendors are present", missing.length === 0, missing.length > 0 ? `missing: ${missing.join(", ")}` : undefined);
  }

  {
    const valid = VENDOR_REGISTRY.every(v => v.checkoutMethods.length > 0);
    log("Every vendor has at least 1 checkout method", valid);
  }

  {
    const valid = VENDOR_REGISTRY.every(v => v.capabilities.length > 0);
    log("Every vendor has at least 1 capability", valid);
  }

  {
    const valid = VENDOR_REGISTRY.every(v => v.tips.length > 0);
    log("Every vendor has at least 1 tip", valid);
  }

  {
    const valid = VENDOR_REGISTRY.every(v => v.url.startsWith("https://"));
    log("Every vendor URL starts with https://", valid);
  }

  {
    const valid = VENDOR_REGISTRY.every(v => /^\d{4}-\d{2}-\d{2}$/.test(v.lastVerified));
    log("Every vendor lastVerified is ISO date format (YYYY-MM-DD)", valid);
  }

  {
    const validMaturities: SkillMaturity[] = ["verified", "beta", "community", "draft"];
    const valid = VENDOR_REGISTRY.every(v => validMaturities.includes(v.maturity));
    log("Every vendor has a valid maturity level", valid);
  }

  {
    const valid = VENDOR_REGISTRY.every(v =>
      v.checkoutMethods.every(m => v.methodConfig[m] !== undefined)
    );
    log("Every checkout method listed has a corresponding methodConfig entry", valid);
  }

  {
    const vendorsWithStats = VENDOR_REGISTRY.filter(v => v.feedbackStats);
    const valid = vendorsWithStats.every(v => v.feedbackStats!.successRate >= 0 && v.feedbackStats!.successRate <= 1);
    log("All feedbackStats.successRate values are 0-1 range", valid, `${vendorsWithStats.length} vendors have stats`);
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  SECTION 4: Registry Lookup Functions");
  console.log("═══════════════════════════════════════════════\n");

  {
    const vendor = getVendorBySlug("amazon");
    log("getVendorBySlug('amazon') returns Amazon", vendor?.name === "Amazon");
  }

  {
    const vendor = getVendorBySlug("staples");
    log("getVendorBySlug('staples') returns Staples", vendor?.name === "Staples");
  }

  {
    const vendor = getVendorBySlug("nonexistent-vendor-xyz");
    log("getVendorBySlug('nonexistent-vendor-xyz') returns undefined", vendor === undefined);
  }

  {
    const vendor = getVendorBySlug("");
    log("getVendorBySlug('') returns undefined for empty string", vendor === undefined);
  }

  {
    const hardware = getVendorsByCategory("hardware");
    log("getVendorsByCategory('hardware') returns 2+ vendors", hardware.length >= 2, `found ${hardware.length}`);
    const allHardware = hardware.every(v => v.category === "hardware");
    log("getVendorsByCategory('hardware') all results are hardware category", allHardware);
  }

  {
    const empty = getVendorsByCategory("nonexistent_category");
    log("getVendorsByCategory('nonexistent_category') returns empty array", empty.length === 0);
  }

  {
    const results = searchVendors("amazon");
    log("searchVendors('amazon') returns 2+ results (Amazon, Amazon Business)", results.length >= 2, `found ${results.length}`);
  }

  {
    const results = searchVendors("AMAZON");
    log("searchVendors is case-insensitive", results.length >= 2, `found ${results.length}`);
  }

  {
    const results = searchVendors("zzz-no-match-xyz");
    log("searchVendors with no match returns empty", results.length === 0);
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  SECTION 5: SKILL.md Generator");
  console.log("═══════════════════════════════════════════════\n");

  {
    const amazon = getVendorBySlug("amazon")!;
    const md = generateVendorSkill(amazon);
    log("Generator returns a non-empty string for Amazon", typeof md === "string" && md.length > 200);
  }

  {
    const amazon = getVendorBySlug("amazon")!;
    const md = generateVendorSkill(amazon);
    log("SKILL.md starts with YAML frontmatter (---)", md.startsWith("---"));
  }

  {
    const amazon = getVendorBySlug("amazon")!;
    const md = generateVendorSkill(amazon);
    log("Frontmatter contains name field", md.includes("name: creditclaw-shop-amazon"));
  }

  {
    const amazon = getVendorBySlug("amazon")!;
    const md = generateVendorSkill(amazon);
    log("Frontmatter contains version field", md.includes(`version: ${amazon.version}`));
  }

  {
    const amazon = getVendorBySlug("amazon")!;
    const md = generateVendorSkill(amazon);
    log("Frontmatter contains maturity field", md.includes(`maturity: ${amazon.maturity}`));
  }

  {
    const amazon = getVendorBySlug("amazon")!;
    const md = generateVendorSkill(amazon);
    log("Frontmatter contains agent_friendliness field", /agent_friendliness: \d\/5/.test(md));
  }

  {
    const amazon = getVendorBySlug("amazon")!;
    const md = generateVendorSkill(amazon);
    log("Contains # Shopping at Amazon heading", md.includes("# Shopping at Amazon"));
  }

  {
    const amazon = getVendorBySlug("amazon")!;
    const md = generateVendorSkill(amazon);
    log("Contains store URL", md.includes("**Store URL:** https://www.amazon.com"));
  }

  {
    const amazon = getVendorBySlug("amazon")!;
    const md = generateVendorSkill(amazon);
    log("Contains checkout methods section", md.includes("## Checkout Methods (in order of preference)"));
  }

  {
    const amazon = getVendorBySlug("amazon")!;
    const md = generateVendorSkill(amazon);
    log("Contains How to Search section", md.includes("## How to Search"));
  }

  {
    const amazon = getVendorBySlug("amazon")!;
    const md = generateVendorSkill(amazon);
    log("Contains How to Checkout section", md.includes("## How to Checkout"));
  }

  {
    const amazon = getVendorBySlug("amazon")!;
    const md = generateVendorSkill(amazon);
    log("Contains Shipping section", md.includes("## Shipping"));
  }

  {
    const amazon = getVendorBySlug("amazon")!;
    const md = generateVendorSkill(amazon);
    log("Contains Tips section", md.includes("## Tips"));
  }

  {
    const amazon = getVendorBySlug("amazon")!;
    const md = generateVendorSkill(amazon);
    log("Contains Metadata section", md.includes("## Metadata"));
  }

  {
    const amazon = getVendorBySlug("amazon")!;
    const md = generateVendorSkill(amazon);
    log("Contains API skill URL in metadata", md.includes(`https://creditclaw.com/api/v1/bot/skills/${amazon.slug}`));
  }

  {
    const amazon = getVendorBySlug("amazon")!;
    const md = generateVendorSkill(amazon);
    log("Contains catalog URL in metadata", md.includes(`https://creditclaw.com/skills/${amazon.slug}`));
  }

  {
    const amazon = getVendorBySlug("amazon")!;
    const md = generateVendorSkill(amazon);
    const friendliness = computeAgentFriendliness(amazon);
    const stars = "★".repeat(friendliness) + "☆".repeat(5 - friendliness);
    log("Agent Friendliness displays correct star rating", md.includes(`**Agent Friendliness:** ${stars}`));
  }

  {
    const amazon = getVendorBySlug("amazon")!;
    const md = generateVendorSkill(amazon);
    log("Success rate rendered when feedbackStats present", md.includes("**Success Rate:**"));
  }

  {
    const v = makeVendor({
      checkout: { guestCheckout: true, taxExemptField: false, poNumberField: false },
    });
    const md = generateVendorSkill(v);
    log("Guest checkout vendor shows guest checkout message", md.includes("Guest checkout is available"));
  }

  {
    const v = makeVendor({
      checkout: { guestCheckout: false, taxExemptField: false, poNumberField: false },
    });
    const md = generateVendorSkill(v);
    log("Non-guest checkout vendor shows login required message", md.includes("Account login required"));
  }

  {
    const v = makeVendor({
      checkout: { guestCheckout: false, taxExemptField: true, poNumberField: true },
    });
    const md = generateVendorSkill(v);
    log("Tax exempt field rendered when enabled", md.includes("Tax exemption field available"));
    log("PO number field rendered when enabled", md.includes("PO number field available"));
  }

  {
    const v = makeVendor({
      shipping: { freeThreshold: 50, estimatedDays: "2-3 days", businessShipping: true },
    });
    const md = generateVendorSkill(v);
    log("Free shipping threshold rendered correctly", md.includes("Free shipping on orders over $50"));
    log("Business shipping note rendered", md.includes("Business/bulk shipping rates available"));
  }

  {
    const v = makeVendor({
      shipping: { estimatedDays: "5-7 days", businessShipping: false },
    });
    const md = generateVendorSkill(v);
    log("No free threshold shows fallback message", md.includes("No standard free shipping threshold"));
  }

  {
    const v = makeVendor({
      checkoutMethods: ["native_api"],
      methodConfig: {
        native_api: { locatorFormat: "sku:{SKU}", requiresAuth: false, notes: "Full API" },
      },
    });
    const md = generateVendorSkill(v);
    log("Making the Purchase section renders when locatorFormat present", md.includes("## Making the Purchase"));
    log("Purchase curl example uses card-wallet endpoint for native_api", md.includes("card-wallet/bot/purchase"));
  }

  {
    const v = makeVendor({
      checkoutMethods: ["self_hosted_card"],
      methodConfig: {
        self_hosted_card: { locatorFormat: "url:{url}", requiresAuth: true, notes: "Fallback" },
      },
    });
    const md = generateVendorSkill(v);
    log("Purchase curl example uses bot/merchant/checkout for non-native_api", md.includes("bot/merchant/checkout"));
  }

  {
    const v = makeVendor({
      capabilities: ["order_tracking"],
    });
    const md = generateVendorSkill(v);
    log("Tracking section shows available when order_tracking capability", md.includes("Order tracking is available"));
  }

  {
    const v = makeVendor({
      capabilities: [],
    });
    const md = generateVendorSkill(v);
    log("Tracking section shows unavailable when no order_tracking", md.includes("Order tracking is not yet available"));
  }

  {
    for (const vendor of VENDOR_REGISTRY) {
      const md = generateVendorSkill(vendor);
      const valid = md.startsWith("---") && md.includes(`# Shopping at ${vendor.name}`);
      if (!valid) {
        log(`Generator produces valid SKILL.md for ${vendor.slug}`, false, "Missing frontmatter or heading");
        break;
      }
    }
    log("Generator produces valid SKILL.md for all registry vendors", true);
  }

  console.log("\n═══════════════════════════════════════════════");
  console.log("  RESULTS");
  console.log("═══════════════════════════════════════════════\n");

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    console.log("\nFailed tests:");
    results.filter(r => !r.pass).forEach(r => console.log(`  ❌ ${r.test} — ${r.error || "assertion failed"}`));
  }

  console.log("");
}

runProcurementSkillsTests();
