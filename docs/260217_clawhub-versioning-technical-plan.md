# CreditClaw — ClawHub Publishing & Skill Versioning Technical Plan

## Overview

Two interconnected features that extend the procurement skills module:

1. **ClawHub Publishing** — Package vendor skills as standalone, distributable units so agents outside CreditClaw's core platform can discover, install, and use them (still requiring CreditClaw for payment).
2. **Skill Versioning & Diffing** — Full version history per vendor skill with semantic diffing, rollback, and automatic regression detection tied to the feedback loop.

These features share a common dependency: every published package references a specific version, and every version can be diffed, rolled back, or flagged by security scans.

---

## 1. Skill Versioning & Diffing

Versioning is the foundation — ClawHub packages reference versions, so this must be built first.

### 1.1 Database Schema

```typescript
// In shared/schema.ts

export const skillVersions = pgTable("skill_versions", {
  id: serial("id").primaryKey(),
  vendorSlug: text("vendor_slug").notNull(),
  version: text("version").notNull(),                    // semver: "1.0.0", "1.1.0"
  vendorData: jsonb("vendor_data").notNull(),             // Full VendorSkill snapshot (frozen)
  skillMd: text("skill_md").notNull(),                    // Generated SKILL.md content (frozen)
  checksum: text("checksum").notNull(),                   // SHA-256 of vendorData JSON
  changeType: text("change_type").notNull(),              // "initial" | "edit" | "community_update" | "rollback" | "auto_rollback"
  changeSummary: text("change_summary"),                  // Human-readable: "Updated checkout methods, added bulk pricing"
  changedFields: jsonb("changed_fields").$type<string[]>(), // ["checkoutMethods", "capabilities", "shipping.freeThreshold"]
  previousVersionId: integer("previous_version_id"),      // FK to prior version (null for initial)
  publishedBy: text("published_by"),                      // Firebase UID of publisher
  sourceType: text("source_type").notNull(),              // "registry" | "draft" | "community"
  sourceDraftId: integer("source_draft_id"),              // FK to skill_drafts if from builder
  isActive: boolean("is_active").default(true).notNull(), // Only one active version per slug
  feedbackAtPublish: jsonb("feedback_at_publish"),        // Snapshot of success rate at time of publish
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Unique constraint: one active version per vendor slug
// Index on (vendorSlug, isActive) for fast lookups
// Index on (vendorSlug, createdAt DESC) for version history
```

### 1.2 Version Creation Rules

Versions are created automatically at these trigger points:

| Trigger | changeType | How |
|---------|-----------|-----|
| First publish from registry | `initial` | When a vendor is first added to the registry, snapshot v1.0.0 |
| Draft published via review UI | `edit` | Reviewer approves a Skill Builder draft → new minor version |
| Community submission published | `community_update` | Community draft approved → new minor version |
| Manual edit in review UI | `edit` | Reviewer modifies fields and saves → new patch version |
| Rollback via UI | `rollback` | Admin clicks "Rollback" → reactivates a prior version snapshot |
| Auto-rollback from feedback | `auto_rollback` | Success rate drops below threshold → system reverts to last good version |

**Semver logic:**
- Breaking changes to `checkoutMethods` or `capabilities` → bump minor (1.0.0 → 1.1.0)
- Non-breaking changes (tips, shipping, notes) → bump patch (1.0.0 → 1.0.1)
- Rollbacks do not change version — they create a new version entry with the old data and incremented patch

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

```typescript
// lib/procurement-skills/versioning/rollback.ts

export async function rollbackToVersion(
  vendorSlug: string,
  targetVersionId: number,
  rolledBackBy: string,
  reason: string
): Promise<SkillVersion> {
  // 1. Fetch the target version's frozen vendorData and skillMd
  // 2. Deactivate the current active version (isActive = false)
  // 3. Create a NEW version entry with:
  //    - vendorData from target version
  //    - skillMd from target version
  //    - changeType: "rollback"
  //    - changeSummary: reason
  //    - previousVersionId: current active version's id
  //    - isActive: true
  //    - Bumped patch version
  // 4. Update the live registry if the vendor is in the static registry
  //    (flag for manual sync — static registry requires code change)
  // 5. Return the new version entry
}
```

### 1.5 API Routes

```
GET  /api/v1/skills/versions?vendor=staples
     → List all versions for a vendor, newest first

GET  /api/v1/skills/versions/:id
     → Get a specific version with full vendorData + skillMd

GET  /api/v1/skills/versions/:id/diff?compare=:otherId
     → Compute and return semantic diff between two versions

POST /api/v1/skills/versions/:id/rollback
     Body: { reason: string }
     → Rollback to this version (creates new version entry)

GET  /api/v1/skills/versions/:id/skillmd
     → Download the frozen SKILL.md for this version
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
│  │ [View] [Diff with previous] [SKILL.md]      ││
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

### 1.7 Feedback Loop Integration (Auto-Rollback)

When the feedback loop detects a success rate drop:

```typescript
// lib/procurement-skills/versioning/auto-rollback.ts

export async function checkForAutoRollback(vendorSlug: string): Promise<void> {
  const currentVersion = await storage.getActiveVersion(vendorSlug);
  if (!currentVersion) return;

  const currentFeedback = await storage.getSkillFeedback(vendorSlug, { days: 7 });
  const currentSuccessRate = computeSuccessRate(currentFeedback);

  const publishFeedback = currentVersion.feedbackAtPublish as FeedbackSnapshot | null;
  const publishSuccessRate = publishFeedback?.successRate ?? 1.0;

  // Auto-rollback conditions:
  // 1. Success rate dropped >20% since this version was published
  // 2. At least 10 events in the window (avoid noise from small samples)
  // 3. Previous version had a better success rate
  if (
    currentSuccessRate < publishSuccessRate - 0.20 &&
    currentFeedback.length >= 10
  ) {
    const previousVersion = await storage.getVersionById(currentVersion.previousVersionId);
    if (previousVersion) {
      await rollbackToVersion(
        vendorSlug,
        previousVersion.id,
        "system",
        `Auto-rollback: success rate dropped from ${(publishSuccessRate * 100).toFixed(0)}% to ${(currentSuccessRate * 100).toFixed(0)}%`
      );
      await notifyAutoRollback(vendorSlug, currentVersion.version, previousVersion.version);
    }
  }
}
```

---

## 2. ClawHub Publishing

### 2.1 Package Format

A ClawHub package is a JSON manifest + the generated SKILL.md, stored in the database and served via API.

```typescript
// lib/clawhub/types.ts

export interface ClawHubPackage {
  slug: string;                     // "staples-business" — matches vendor slug
  name: string;                     // "Staples Business Procurement Skill"
  description: string;              // Auto-generated from vendor capabilities
  version: string;                  // Semver, matches skill version
  versionId: number;                // FK to skill_versions.id
  checksum: string;                 // SHA-256 of the SKILL.md content

  metadata: {
    category: VendorCategory;
    checkoutMethods: CheckoutMethod[];
    capabilities: VendorCapability[];
    maturity: SkillMaturity;
    agentFriendliness: number;
    submitterType: "official" | "community" | "creditclaw";
  };

  requirements: {
    creditclaw: boolean;            // Always true — payment requires CreditClaw
    minApiVersion: string;          // Minimum CreditClaw API version needed
    rails: string[];                // Which payment rails this skill needs: ["stripe_wallet", "card_wallet"]
  };

  distribution: {
    downloadUrl: string;            // /api/v1/clawhub/packages/:slug/download
    installCommand: string;         // "clawhub install staples-business"
    size: number;                   // SKILL.md file size in bytes
  };

  publisher: {
    name: string;                   // "CreditClaw" or community submitter name
    type: "creditclaw" | "official" | "community";
    verified: boolean;
  };

  stats: {
    installs: number;
    activeAgents: number;
    successRate: number | null;
    lastUpdated: string;
  };

  createdAt: string;
  updatedAt: string;
}
```

### 2.2 Database Schema

```typescript
// In shared/schema.ts

export const clawHubPackages = pgTable("clawhub_packages", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  currentVersionId: integer("current_version_id").notNull(), // FK to skill_versions
  metadata: jsonb("metadata").notNull(),
  requirements: jsonb("requirements").notNull(),
  publisherName: text("publisher_name").notNull(),
  publisherType: text("publisher_type").notNull(),           // "creditclaw" | "official" | "community"
  isPublished: boolean("is_published").default(false).notNull(),
  isListed: boolean("is_listed").default(true).notNull(),    // Unlisted packages exist but don't appear in search
  installs: integer("installs").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const clawHubInstalls = pgTable("clawhub_installs", {
  id: serial("id").primaryKey(),
  packageSlug: text("package_slug").notNull(),
  botId: text("bot_id").notNull(),
  ownerUid: text("owner_uid").notNull(),
  versionAtInstall: text("version_at_install").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  installedAt: timestamp("installed_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
});

// Index on (packageSlug, botId) for deduplication
// Index on (ownerUid) for listing user's installed packages
```

### 2.3 Publishing Pipeline

```
Registry Entry or Approved Draft
        │
        ▼
  Create Skill Version (§1.2)
        │
        ▼
  Generate SKILL.md from frozen VendorSkill
        │
        ▼
  Compute checksum (SHA-256)
        │
        ▼
  Create/update ClawHub Package entry
  (link to version, set metadata, compute requirements)
        │
        ▼
  Package is live on the public registry API
```

```typescript
// lib/clawhub/publish.ts

export async function publishToClawHub(
  vendorSlug: string,
  versionId: number
): Promise<ClawHubPackage> {
  const version = await storage.getSkillVersion(versionId);
  if (!version) throw new Error("Version not found");

  const vendorData = version.vendorData as VendorSkill;
  const skillMd = version.skillMd;
  const checksum = computeSHA256(skillMd);

  const requirements = {
    creditclaw: true,
    minApiVersion: "1.0.0",
    rails: inferRequiredRails(vendorData),
  };

  const metadata = {
    category: vendorData.category,
    checkoutMethods: vendorData.checkoutMethods,
    capabilities: vendorData.capabilities,
    maturity: vendorData.maturity,
    agentFriendliness: computeAgentFriendliness(vendorData),
    submitterType: version.sourceType === "community" ? "community" : "creditclaw",
  };

  // Upsert package
  const pkg = await storage.upsertClawHubPackage({
    slug: vendorSlug,
    name: `${vendorData.name} Procurement Skill`,
    description: generateDescription(vendorData),
    currentVersionId: versionId,
    metadata,
    requirements,
    publisherName: version.sourceType === "community"
      ? (version.publishedBy || "Community")
      : "CreditClaw",
    publisherType: version.sourceType === "community" ? "community" : "creditclaw",
    isPublished: true,
  });

  return pkg;
}

function inferRequiredRails(vendor: VendorSkill): string[] {
  const rails: string[] = [];
  if (vendor.checkoutMethods.includes("x402")) rails.push("stripe_wallet");
  if (vendor.checkoutMethods.includes("crossmint_world")) rails.push("card_wallet");
  if (vendor.checkoutMethods.includes("self_hosted_card")) rails.push("self_hosted");
  if (rails.length === 0) rails.push("stripe_wallet"); // Default
  return rails;
}
```

### 2.4 Public Registry API

These endpoints are publicly readable but download/install requires a valid CreditClaw API key.

```
Public (no auth):
GET  /api/v1/clawhub/packages
     ?category=hardware
     ?checkout=acp,native_api
     ?capability=bulk_pricing
     ?search=staples
     ?sort=installs|updated|friendliness
     → Paginated list of published packages

GET  /api/v1/clawhub/packages/:slug
     → Full package metadata + current version info

GET  /api/v1/clawhub/packages/:slug/versions
     → Version history for a package


Authenticated (requires CreditClaw bot API key):
GET  /api/v1/clawhub/packages/:slug/download
     Headers: Authorization: Bearer <bot-api-key>
     → Returns the SKILL.md content for the current version
     → Increments install counter
     → Records install in clawhub_installs

POST /api/v1/clawhub/packages/:slug/install
     Headers: Authorization: Bearer <bot-api-key>
     Body: { botId: string }
     → Registers this bot as an active user of the package
     → Returns: { skillMd, version, requirements, paymentConfig }

DELETE /api/v1/clawhub/packages/:slug/install
     Headers: Authorization: Bearer <bot-api-key>
     Body: { botId: string }
     → Uninstalls the package for this bot
```

### 2.5 Payment Enforcement

The SKILL.md itself is not secret — it's markdown describing how to shop at a vendor. The enforcement happens at the payment layer:

1. **Every SKILL.md references CreditClaw payment endpoints.** The generated skill files instruct agents to use CreditClaw's payment API for purchases, not arbitrary payment methods.
2. **Install tracking.** When a bot installs a package, CreditClaw knows which skills it's using. If a bot tries to make a purchase through a skill without a valid CreditClaw wallet, the payment API rejects it.
3. **API key gating on download.** Bots must authenticate to download skill files, creating a billing relationship.

```typescript
// In the SKILL.md generator, always include:
const PAYMENT_FOOTER = `
## Payment
All purchases through this skill MUST be processed via CreditClaw.
- Wallet endpoint: POST /api/v1/bot/wallets/:walletId/purchase
- Payment methods: Controlled by your CreditClaw wallet configuration
- Spending limits: Enforced by your owner's guardrails

Do NOT use personal payment methods or bypass CreditClaw payment rails.
`;
```

### 2.6 ClawHub Catalog Page

Location: `/clawhub` (public, no auth required)

**Layout:**
```
┌────────────────────────────────────────────────────────┐
│  🦞 ClawHub — Skill Packages for AI Agents            │
│                                                        │
│  Search: [________________________] [Filter ▼]         │
│                                                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ 📦 Staples   │ │ 📦 Amazon    │ │ 📦 Home Depot│   │
│  │ Business     │ │ Business     │ │              │   │
│  │              │ │              │ │              │   │
│  │ v1.2.1       │ │ v2.0.0       │ │ v1.0.0       │   │
│  │ ⭐⭐⭐⭐     │ │ ⭐⭐⭐⭐⭐  │ │ ⭐⭐⭐       │   │
│  │ 142 installs │ │ 891 installs │ │ 37 installs  │   │
│  │              │ │              │ │              │   │
│  │ [native_api] │ │ [crossmint]  │ │ [browser]    │   │
│  │ [bulk] [tax] │ │ [api] [track]│ │ [guest]      │   │
│  │              │ │              │ │              │   │
│  │ By CreditClaw│ │ By CreditClaw│ │ Community    │   │
│  │ [Install]    │ │ [Install]    │ │ [Install]    │   │
│  └──────────────┘ └──────────────┘ └──────────────┘   │
│                                                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ ...          │ │ ...          │ │ ...          │   │
│  └──────────────┘ └──────────────┘ └──────────────┘   │
└────────────────────────────────────────────────────────┘
```

**Package Detail Page** (`/clawhub/[slug]`):
```
┌────────────────────────────────────────────────────────┐
│  ← Back to ClawHub                                     │
│                                                        │
│  📦 Staples Business Procurement Skill                 │
│  v1.2.1 · By CreditClaw · ⭐⭐⭐⭐ (4/5)             │
│  142 installs · 94% success rate                       │
│                                                        │
│  [Install]  [View SKILL.md]  [Version History]         │
│                                                        │
│  ┌─ Requirements ─────────────────────────────────┐    │
│  │ ✓ CreditClaw account required                  │    │
│  │ ✓ Payment rails: Stripe Wallet, Card Wallet    │    │
│  │ ✓ Min API version: 1.0.0                       │    │
│  └────────────────────────────────────────────────┘    │
│                                                        │
│  ┌─ Capabilities ─────────────────────────────────┐    │
│  │ ✅ Price Lookup  ✅ Stock Check  ✅ Bulk Pricing│    │
│  │ ✅ Tax Exemption ✅ PO Numbers  ❌ Returns     │    │
│  └────────────────────────────────────────────────┘    │
│                                                        │
│  ┌─ Checkout Methods ─────────────────────────────┐    │
│  │ 1. native_api (preferred)                      │    │
│  │ 2. self_hosted_card (fallback)                  │    │
│  └────────────────────────────────────────────────┘    │
│                                                        │
│  ┌─ SKILL.md Preview ─────────────────────────────┐    │
│  │ # Staples Business                             │    │
│  │ ## Checkout Flow                               │    │
│  │ 1. Search: GET /search?query={q}               │    │
│  │ 2. Add to cart: POST /cart/add                  │    │
│  │ ...                                             │    │
│  └────────────────────────────────────────────────┘    │
│                                                        │
│  ┌─ Recent Versions ──────────────────────────────┐    │
│  │ v1.2.1 (current) - Rollback: checkout fix      │    │
│  │ v1.2.0 - Added bulk pricing capability          │    │
│  │ v1.1.0 - Updated checkout methods               │    │
│  │ v1.0.0 - Initial publish                        │    │
│  │ [View Full History]                              │    │
│  └────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────┘
```

---

## 3. Integration Points

### 3.1 Version → Package Sync

When a new skill version is created (via publish, community update, or rollback), automatically update the ClawHub package:

```typescript
// Post-publish hook in the draft publish flow
async function onVersionCreated(version: SkillVersion): Promise<void> {
  const existingPackage = await storage.getClawHubPackage(version.vendorSlug);
  if (existingPackage) {
    await publishToClawHub(version.vendorSlug, version.id);
  }
  // If no package exists, admin must explicitly create it first
}
```

### 3.2 Security Scanner → Diff Analysis

When the security scanner runs on updates (Future C), it consumes the version diff:

```typescript
async function securityScanOnUpdate(newVersionId: number): Promise<SecurityReport> {
  const newVersion = await storage.getSkillVersion(newVersionId);
  const previousVersion = newVersion.previousVersionId
    ? await storage.getSkillVersion(newVersion.previousVersionId)
    : null;

  if (previousVersion) {
    const diff = computeVersionDiff(
      previousVersion.vendorData as VendorSkill,
      newVersion.vendorData as VendorSkill
    );

    // Flag suspicious patterns in diffs:
    // - URLs changed to different domains
    // - New methodConfig pointing to non-vendor endpoints
    // - Tips that mention sending credentials somewhere
    return scanDiffForThreats(diff, newVersion);
  }

  return scanFreshSkill(newVersion);
}
```

### 3.3 Feedback Loop → Auto-Rollback → Package Update

```
Bot reports failure
      │
      ▼
recordSkillFeedback() updates success rate
      │
      ▼
checkForAutoRollback() evaluates thresholds
      │ (if triggered)
      ▼
rollbackToVersion() creates new version entry
      │
      ▼
onVersionCreated() updates ClawHub package
      │
      ▼
Bots downloading the package now get the rolled-back version
```

---

## 4. Implementation Order

| Phase | What | Depends On |
|-------|------|-----------|
| **Phase 1** | `skill_versions` table + version creation on publish | Existing draft publish flow |
| **Phase 2** | Diff algorithm + diff API | Phase 1 |
| **Phase 3** | Version history UI + rollback UI | Phase 1 + 2 |
| **Phase 4** | `clawhub_packages` + `clawhub_installs` tables | Phase 1 |
| **Phase 5** | ClawHub publish pipeline + public registry API | Phase 4 |
| **Phase 6** | ClawHub catalog page + package detail page | Phase 5 |
| **Phase 7** | Install/download endpoints with API key auth | Phase 5 |
| **Phase 8** | Auto-rollback from feedback loop | Phase 3 + Feedback Loop (§3 of v3 plan) |
| **Phase 9** | Security scanner diff integration | Phase 2 + Security Scanner (Future C) |

**Estimated scope:** ~8 phases, each independently deployable and testable.

---

## 5. Test Plan

### Versioning Tests
- Version created on draft publish (correct semver, snapshot data)
- Version diff detects added/removed/changed fields with correct severity
- Rollback creates new version with old data, deactivates current
- Only one active version per vendor slug at any time
- Version history returns ordered list
- Checksum validates integrity of frozen data

### ClawHub Tests
- Package created from version with correct metadata
- Public registry API returns published packages only
- Download requires valid API key (401 without)
- Install increments counter and records in clawhub_installs
- Uninstall deactivates the install record
- Package auto-updates when new version published
- Search/filter by category, checkout method, capability

### Integration Tests
- End-to-end: submit vendor → analyze → publish draft → version created → package published → bot downloads
- Rollback propagates to package
- Auto-rollback triggers on success rate drop (mock feedback data)
