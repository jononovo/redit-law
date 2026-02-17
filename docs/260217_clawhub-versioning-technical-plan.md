# CreditClaw — Skill Versioning & External Hub Publishing Technical Plan

## Overview

Two interconnected features that extend the procurement skills module:

1. **Skill Versioning & Diffing** — Full version history per vendor skill with semantic diffing and manual rollback. Every publish, edit, or community update creates an immutable version snapshot.
2. **Multi-File Skill Packages** — Skills become bundles of `SKILL.md` + `skill.json` + `payments.md`, displayed on existing vendor detail pages at `/skills/[vendor]`.
3. **External Hub Export** — A pipeline to package skills for listing on external marketing sites (ClawHub.ai, skills.sh). These are separate websites — not part of CreditClaw. Export is manual (weekly report of new/updated skills) with optional future automation.

The skill content is **identical everywhere** — CreditClaw is the single source of truth, and the same package is displayed on our vendor pages and listed on external hubs. Any minor differences (branding, URLs) are applied programmatically at export time.

---

## 1. Skill Versioning & Diffing

### 1.1 Database Schema

```typescript
// In shared/schema.ts

export const skillVersions = pgTable("skill_versions", {
  id: serial("id").primaryKey(),
  vendorSlug: text("vendor_slug").notNull(),
  version: text("version").notNull(),                    // semver: "1.0.0", "1.1.0"
  vendorData: jsonb("vendor_data").notNull(),             // Full VendorSkill snapshot (frozen)
  skillMd: text("skill_md").notNull(),                    // Generated SKILL.md content (frozen)
  skillJson: jsonb("skill_json"),                         // Structured metadata (frozen)
  paymentsMd: text("payments_md"),                        // Payment instructions (frozen)
  checksum: text("checksum").notNull(),                   // SHA-256 of vendorData JSON
  changeType: text("change_type").notNull(),              // "initial" | "edit" | "community_update" | "rollback"
  changeSummary: text("change_summary"),                  // Human-readable: "Updated checkout methods, added bulk pricing"
  changedFields: jsonb("changed_fields").$type<string[]>(), // ["checkoutMethods", "capabilities", "shipping.freeThreshold"]
  previousVersionId: integer("previous_version_id"),      // FK to prior version (null for initial)
  publishedBy: text("published_by"),                      // Firebase UID of publisher
  sourceType: text("source_type").notNull(),              // "registry" | "draft" | "community"
  sourceDraftId: integer("source_draft_id"),              // FK to skill_drafts if from builder
  isActive: boolean("is_active").default(true).notNull(), // Only one active version per slug
  exportedAt: timestamp("exported_at"),                   // When this version was last exported to external hubs
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Unique constraint: one active version per vendor slug
// Index on (vendorSlug, isActive) for fast lookups
// Index on (vendorSlug, createdAt DESC) for version history
```

### 1.2 Version Creation Rules

Versions are created at these trigger points:

| Trigger | changeType | How |
|---------|-----------|-----|
| First publish from registry | `initial` | When a vendor is first added to the registry, snapshot v1.0.0 |
| Draft published via review UI | `edit` | Reviewer approves a Skill Builder draft → new minor version |
| Community submission published | `community_update` | Community draft approved → new minor version |
| Manual edit in review UI | `edit` | Reviewer modifies fields and saves → new patch version |
| Admin rollback via UI | `rollback` | Admin clicks "Rollback" → creates new version entry with old data |

**Semver logic:**
- Breaking changes to `checkoutMethods` or `capabilities` → bump minor (1.0.0 → 1.1.0)
- Non-breaking changes (tips, shipping, notes) → bump patch (1.0.0 → 1.0.1)
- Rollbacks create a new version entry with the old data and incremented patch

### 1.3 Semantic Diff Algorithm

```typescript
// lib/procurement-skills/versioning/diff.ts

export interface FieldDiff {
  field: string;                    // Dot-notation path: "checkout.guestCheckout"
  label: string;                    // Human-readable: "Guest Checkout"
  type: "added" | "removed" | "changed" | "unchanged";
  oldValue: unknown;
  newValue: unknown;
  severity: "breaking" | "notable" | "minor";
}

export interface VersionDiff {
  fromVersion: string;
  toVersion: string;
  fields: FieldDiff[];
  breakingChanges: number;
  totalChanges: number;
  summary: string;                  // Auto-generated: "2 breaking changes, 3 minor updates"
}

// Fields grouped by diff severity:
const FIELD_SEVERITY: Record<string, "breaking" | "notable" | "minor"> = {
  "checkoutMethods":        "breaking",
  "capabilities":           "breaking",
  "methodConfig":           "breaking",
  "search.pattern":         "breaking",
  "search.urlTemplate":     "breaking",
  "checkout.guestCheckout": "notable",
  "checkout.taxExemptField":"notable",
  "checkout.poNumberField": "notable",
  "maturity":               "notable",
  "shipping.freeThreshold": "minor",
  "shipping.estimatedDays": "minor",
  "tips":                   "minor",
  "url":                    "notable",
  "name":                   "minor",
  "category":               "notable",
};

export function computeVersionDiff(
  oldSkill: VendorSkill,
  newSkill: VendorSkill
): VersionDiff {
  // 1. Flatten both objects to dot-notation paths
  // 2. Compare each path — detect added, removed, changed
  // 3. For arrays (checkoutMethods, capabilities, tips):
  //    - Diff as sets: show added/removed items
  //    - For ordered arrays (checkoutMethods): also flag reordering
  // 4. For objects (methodConfig, shipping):
  //    - Recursively diff nested fields
  // 5. Assign severity from FIELD_SEVERITY map
  // 6. Generate summary string
}
```

### 1.4 Rollback Mechanism

Manual rollback only — admin-initiated through the review UI.

```typescript
// lib/procurement-skills/versioning/rollback.ts

export async function rollbackToVersion(
  vendorSlug: string,
  targetVersionId: number,
  rolledBackBy: string,
  reason: string
): Promise<SkillVersion> {
  // 1. Fetch the target version's frozen vendorData, skillMd, skillJson, paymentsMd
  // 2. Deactivate the current active version (isActive = false)
  // 3. Create a NEW version entry with:
  //    - All content from target version
  //    - changeType: "rollback"
  //    - changeSummary: reason
  //    - previousVersionId: current active version's id
  //    - isActive: true
  //    - Bumped patch version
  // 4. Flag for manual sync if vendor is in the static registry
  // 5. Return the new version entry
}
```

### 1.5 API Routes

```
GET  /api/v1/skills/versions?vendor=staples
     → List all versions for a vendor, newest first

GET  /api/v1/skills/versions/:id
     → Get a specific version with full vendorData + all files

GET  /api/v1/skills/versions/:id/diff?compare=:otherId
     → Compute and return semantic diff between two versions

POST /api/v1/skills/versions/:id/rollback
     Body: { reason: string }
     → Rollback to this version (creates new version entry)
     → Auth required (admin)

GET  /api/v1/skills/versions/:id/files
     → Download all files for this version (SKILL.md, skill.json, payments.md)
```

### 1.6 Version History UI

Location: `/app/skills/review/[id]/versions` (linked from the review detail page)

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  ← Back to Draft    Staples Business            │
│                                                 │
│  Version History                                │
│  ┌─────────────────────────────────────────────┐│
│  │ v1.2.1  (active)           Feb 17, 2026     ││
│  │ ● rollback · "Reverted: checkout broke"     ││
│  │ By: admin@creditclaw.com                    ││
│  │ [View] [Diff with previous] [Files]         ││
│  ├─────────────────────────────────────────────┤│
│  │ v1.2.0                     Feb 15, 2026     ││
│  │ ● community_update · "Added bulk pricing"   ││
│  │ By: contributor@staples.com (Official)      ││
│  │ [View] [Diff with previous] [Rollback]      ││
│  ├─────────────────────────────────────────────┤│
│  │ v1.1.0                     Feb 10, 2026     ││
│  │ ● edit · "Updated checkout methods"         ││
│  │ [View] [Diff with previous] [Rollback]      ││
│  ├─────────────────────────────────────────────┤│
│  │ v1.0.0                     Feb 1, 2026      ││
│  │ ● initial · "First publish"                 ││
│  │ [View] [Rollback]                           ││
│  └─────────────────────────────────────────────┘│
│                                                 │
│  Diff View (when comparing two versions)        │
│  ┌─────────────────────────────────────────────┐│
│  │ v1.1.0 → v1.2.0                            ││
│  │ 1 breaking · 2 notable · 1 minor            ││
│  │                                              ││
│  │ 🔴 checkoutMethods (breaking)               ││
│  │   - Removed: "acp"                          ││
│  │   + Added: "self_hosted_card"                ││
│  │                                              ││
│  │ 🟡 capabilities (notable)                    ││
│  │   + Added: "bulk_pricing"                    ││
│  │                                              ││
│  │ 🟡 checkout.guestCheckout (notable)          ││
│  │   Changed: true → false                      ││
│  │                                              ││
│  │ 🟢 tips (minor)                              ││
│  │   + Added: "Use PO for orders > $500"        ││
│  └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

---

## 2. Multi-File Skill Packages

Each vendor skill is a bundle of three files. All three are generated from the same `VendorSkill` data and frozen together as a version.

### 2.1 File Structure

| File | Purpose | Generated From |
|------|---------|---------------|
| `SKILL.md` | Agent-facing instructions — how to search, browse, add to cart, checkout at this vendor | Existing generator (`lib/procurement-skills/generator.ts`) |
| `skill.json` | Structured metadata for programmatic consumption — capabilities, checkout methods, search patterns, config | `VendorSkill` object serialized with computed fields |
| `payments.md` | CreditClaw-specific payment instructions — which wallet endpoint to use, spending limit info, rail requirements | Generated from vendor's checkout methods + CreditClaw payment config |

### 2.2 skill.json Format

```typescript
// lib/procurement-skills/package/skill-json.ts

export interface SkillJsonPackage {
  slug: string;
  name: string;
  version: string;
  category: VendorCategory;
  url: string;

  checkoutMethods: CheckoutMethod[];
  capabilities: VendorCapability[];
  maturity: SkillMaturity;
  agentFriendliness: number;

  search: {
    pattern: string;
    urlTemplate?: string;
    productIdFormat?: string;
  };

  checkout: {
    guestCheckout: boolean;
    taxExemptField: boolean;
    poNumberField: boolean;
  };

  shipping: {
    freeThreshold?: number;
    estimatedDays: string;
    businessShipping: boolean;
  };

  methodConfig: Record<string, {
    locatorFormat?: string;
    searchEndpoint?: string;
    requiresAuth: boolean;
    notes: string;
  }>;

  tips: string[];

  creditclaw: {
    requiredRails: string[];
    paymentEndpoint: string;
    walletTypes: string[];
  };

  generatedBy: "skill_builder" | "manual";
  lastVerified: string;
}

export function generateSkillJson(vendor: VendorSkill): SkillJsonPackage {
  return {
    slug: vendor.slug,
    name: vendor.name,
    version: vendor.version,
    category: vendor.category,
    url: vendor.url,
    checkoutMethods: vendor.checkoutMethods,
    capabilities: vendor.capabilities,
    maturity: vendor.maturity,
    agentFriendliness: computeAgentFriendliness(vendor),
    search: vendor.search,
    checkout: vendor.checkout,
    shipping: vendor.shipping,
    methodConfig: vendor.methodConfig as Record<string, any>,
    tips: vendor.tips,
    creditclaw: {
      requiredRails: inferRequiredRails(vendor),
      paymentEndpoint: "/api/v1/bot/wallets/:walletId/purchase",
      walletTypes: inferWalletTypes(vendor),
    },
    generatedBy: vendor.generatedBy,
    lastVerified: vendor.lastVerified,
  };
}
```

### 2.3 payments.md Generator

```typescript
// lib/procurement-skills/package/payments-md.ts

export function generatePaymentsMd(vendor: VendorSkill): string {
  const rails = inferRequiredRails(vendor);

  let md = `# Payment Instructions — ${vendor.name}\n\n`;
  md += `All purchases through this skill are processed via CreditClaw.\n\n`;

  md += `## Required Payment Rails\n\n`;
  for (const rail of rails) {
    md += `- **${RAIL_LABELS[rail]}**\n`;
  }

  md += `\n## Making a Purchase\n\n`;
  md += `1. Confirm the item and price with your owner's spending limits\n`;
  md += `2. Submit purchase request: \`POST /api/v1/bot/wallets/:walletId/purchase\`\n`;
  md += `3. Include the vendor, item details, and total amount\n`;
  md += `4. CreditClaw enforces guardrails (per-transaction caps, daily/monthly limits, category blocks)\n`;
  md += `5. If approved, payment is processed through the configured rail\n\n`;

  md += `## Spending Limits\n\n`;
  md += `Your spending limits are set by your owner and enforced by CreditClaw:\n`;
  md += `- Per-transaction maximum\n`;
  md += `- Daily spending cap\n`;
  md += `- Monthly spending cap\n`;
  md += `- Category-based restrictions\n\n`;

  md += `Do NOT use personal payment methods or bypass CreditClaw payment rails.\n`;

  return md;
}
```

### 2.4 Vendor Detail Page Updates

The existing vendor detail pages at `/skills/[vendor]` are updated to display all three files with a tabbed interface:

```
┌──────────────────────────────────────────────────────┐
│  ← Back to Catalog    Staples Business               │
│  v1.2.1 · Verified · ⭐⭐⭐⭐                        │
│                                                      │
│  [SKILL.md]  [skill.json]  [payments.md]   [Download]│
│  ─────────                                           │
│  ┌──────────────────────────────────────────────────┐│
│  │ # Staples Business                               ││
│  │                                                   ││
│  │ ## Search                                         ││
│  │ URL: https://www.staples.com/search?query={q}     ││
│  │ Product ID format: Item Number                    ││
│  │                                                   ││
│  │ ## Checkout Flow                                  ││
│  │ 1. Search for product...                          ││
│  │ 2. Add to cart...                                 ││
│  │ ...                                               ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  Version History (3 versions)        [View All →]    │
│  v1.2.1 — Rollback: checkout fix    Feb 17           │
│  v1.2.0 — Added bulk pricing        Feb 15           │
│  v1.1.0 — Updated checkout methods  Feb 10           │
└──────────────────────────────────────────────────────┘
```

---

## 3. External Hub Export

ClawHub.ai and skills.sh are separate marketing websites that list skills to attract users. They are **not part of CreditClaw** — they're external sites that receive skill data from CreditClaw.

### 3.1 Export Tracking

```typescript
// In shared/schema.ts

export const skillExports = pgTable("skill_exports", {
  id: serial("id").primaryKey(),
  vendorSlug: text("vendor_slug").notNull(),
  versionId: integer("version_id").notNull(),           // FK to skill_versions
  destination: text("destination").notNull(),            // "clawhub" | "skills_sh"
  exportedBy: text("exported_by"),                       // Firebase UID or "system"
  exportedAt: timestamp("exported_at").defaultNow().notNull(),
});

// Index on (vendorSlug, destination) for checking export status
```

### 3.2 Weekly Export Report

An admin-facing report that surfaces which skills are new or updated since the last export to each hub.

```typescript
// lib/procurement-skills/export/report.ts

export interface ExportReportItem {
  vendorSlug: string;
  vendorName: string;
  currentVersion: string;
  lastExportedVersion: string | null;  // null = never exported
  changesSinceExport: string[];        // List of changed fields
  status: "new" | "updated" | "up_to_date";
  files: {
    skillMd: string;
    skillJson: object;
    paymentsMd: string;
  };
}

export async function generateExportReport(
  destination: "clawhub" | "skills_sh"
): Promise<ExportReportItem[]> {
  // 1. Get all active versions
  // 2. For each, check the last export to this destination
  // 3. If never exported → status: "new"
  // 4. If exported but version changed → status: "updated", compute diff
  // 5. If exported and version matches → status: "up_to_date"
  // 6. Return sorted: new first, then updated, exclude up_to_date
}
```

### 3.3 Export API & UI

```
GET  /api/v1/skills/export/report?destination=clawhub
     → Weekly export report (auth required)

POST /api/v1/skills/export/mark-exported
     Body: { vendorSlug, versionId, destination }
     → Mark a skill as exported to a destination (auth required)

POST /api/v1/skills/export/mark-batch
     Body: { items: [{ vendorSlug, versionId }], destination }
     → Bulk mark multiple skills as exported (auth required)

GET  /api/v1/skills/export/download/:vendorSlug
     → Download the complete skill package (SKILL.md + skill.json + payments.md)
     → Applies any programmatic tweaks for the destination
```

**Export UI** at `/app/skills/export`:

```
┌──────────────────────────────────────────────────────┐
│  Skill Export                                        │
│                                                      │
│  Destination: [ClawHub.ai ▼]  Last export: Feb 10    │
│                                                      │
│  ┌─ New Skills (3) ─────────────────────────────────┐│
│  │ ☐ Grainger Industrial       v1.0.0  [Download]   ││
│  │ ☐ Fastenal                  v1.0.0  [Download]   ││
│  │ ☐ McMaster-Carr             v1.0.0  [Download]   ││
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  ┌─ Updated Skills (2) ────────────────────────────┐ │
│  │ ☐ Staples Business  v1.1.0 → v1.2.1  [Diff]    │ │
│  │     Changed: checkoutMethods, capabilities      │ │
│  │ ☐ Home Depot        v1.0.0 → v1.0.1  [Diff]    │ │
│  │     Changed: shipping.freeThreshold             │ │
│  └──────────────────────────────────────────────────┘│
│                                                      │
│  [Mark Selected as Exported]  [Download All as ZIP]  │
└──────────────────────────────────────────────────────┘
```

### 3.4 Programmatic Tweaks at Export

When exporting for external hubs, minor adjustments can be applied:

```typescript
// lib/procurement-skills/export/transform.ts

export interface ExportOptions {
  destination: "clawhub" | "skills_sh";
  includeBranding?: boolean;         // Add CreditClaw attribution
  includePaymentsMd?: boolean;       // Some hubs may not need payment instructions
}

export function transformForExport(
  skillMd: string,
  skillJson: SkillJsonPackage,
  paymentsMd: string,
  options: ExportOptions
): { skillMd: string; skillJson: SkillJsonPackage; paymentsMd: string } {
  let transformedMd = skillMd;
  const transformedJson = { ...skillJson };

  if (options.includeBranding !== false) {
    transformedMd += `\n\n---\n*Powered by [CreditClaw](https://creditclaw.com) — Prepaid spending controls for AI agents.*\n`;
  }

  // Any destination-specific URL or formatting tweaks go here
  // The core content stays identical

  return {
    skillMd: transformedMd,
    skillJson: transformedJson,
    paymentsMd: options.includePaymentsMd !== false ? paymentsMd : "",
  };
}
```

---

## 4. Implementation Order

| Phase | What | Depends On |
|-------|------|-----------|
| **Phase 1** | `skill_versions` table + version creation on draft publish | Existing draft publish flow |
| **Phase 2** | Multi-file generators: `skill.json` + `payments.md` | Phase 1 |
| **Phase 3** | Diff algorithm + diff API routes | Phase 1 |
| **Phase 4** | Version history UI + rollback UI | Phase 1 + 3 |
| **Phase 5** | Vendor detail page updates (tabbed file view + version history) | Phase 2 |
| **Phase 6** | `skill_exports` table + export report API | Phase 1 |
| **Phase 7** | Export UI at `/app/skills/export` | Phase 6 |

**Seven phases, each independently deployable and testable.**

---

## 5. Test Plan

### Versioning Tests
- Version created on draft publish with correct semver, snapshot data, and all three files
- Only one active version per vendor slug at any time
- Version history returns ordered list (newest first)
- Checksum validates integrity of frozen data
- Rollback creates new version with old data, deactivates current
- Rollback bumps patch version correctly

### Diff Tests
- Diff detects added/removed/changed fields with correct severity
- Array diffs (checkoutMethods, capabilities) show added/removed items
- Nested object diffs (shipping, checkout) work correctly
- Empty diff when comparing identical versions
- Summary string generated correctly

### Multi-File Tests
- skill.json contains all required fields from VendorSkill
- payments.md includes correct rails based on checkout methods
- All three files frozen in version snapshot
- Files served correctly from vendor detail page

### Export Tests
- Export report correctly identifies new/updated/up-to-date skills
- Mark-exported updates export tracking
- Bulk mark works for multiple skills
- Programmatic tweaks applied correctly per destination
- Download returns all three files
