import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { sections } from "@/docs/content/sections";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://creditclaw.com";

  const parts: string[] = [
    "# CreditClaw — Complete Reference",
    "",
    "CreditClaw is a financial infrastructure platform that gives AI agents the ability to spend money on your behalf — safely, with limits you control. Think of it as giving your bot a debit card with strict guardrails: spending caps, category restrictions, and approval workflows that keep you in the loop.",
    "",
    "---",
    "",
    "# Site Overview",
    "",
    "## Homepage",
    "",
    `URL: ${baseUrl}`,
    "",
    "CreditClaw is built for anyone who operates AI agents (bots) that need to make purchases or payments as part of their workflow. Whether your bot is buying software licenses, paying for API access, ordering physical goods, or processing customer checkouts, CreditClaw provides the financial rails and safety controls to make it happen.",
    "",
    "## How It Works",
    "",
    `URL: ${baseUrl}/how-it-works`,
    "",
    "1. **Add your card** — Connect any Visa, Mastercard, or Amex. Stripe handles the security. Setup takes under 60 seconds.",
    "2. **Set guardrails** — Define spending limits, category restrictions, and approval thresholds. Control what your bot can and cannot buy.",
    "3. **Let your bot shop** — Your bot uses the CreditClaw API to browse vendors, make purchases, and track orders. All within the limits you set.",
    "4. **Stay in the loop** — Get real-time notifications, approve high-value purchases, and review transaction history from the dashboard.",
    "",
    "## Safety & Security",
    "",
    `URL: ${baseUrl}/safety`,
    "",
    "- **Stripe-powered payments** — PCI-DSS Level 1 certified. Card details stored by Stripe, never on CreditClaw servers.",
    "- **Spending controls** — Per-transaction, daily, and monthly caps. Category blocking and merchant allowlists/blocklists.",
    "- **Human-in-the-loop approvals** — Require manual approval for purchases above a threshold.",
    "- **Wallet freeze** — Instantly freeze any wallet to stop all transactions.",
    "- **Split-knowledge card model** — For self-hosted cards, CreditClaw never has access to the full card details.",
    "- **Encryption** — End-to-end encryption for sub-agent card flows.",
    "",
    "## Procurement Skills",
    "",
    `URL: ${baseUrl}/skills`,
    "",
    "A curated library of vendor shopping skills that teach bots how to buy from specific merchants. Each skill includes checkout methods, capabilities, agent-friendliness scores, and step-by-step instructions. Users can browse, search, and submit new vendors.",
    "",
    "## Key Pages",
    "",
    `- Dashboard: ${baseUrl}/app`,
    `- Claim a bot: ${baseUrl}/claim`,
    `- Onboarding: ${baseUrl}/onboarding`,
    `- Skills catalog: ${baseUrl}/skills`,
    `- Privacy policy: ${baseUrl}/privacy`,
    `- Terms of service: ${baseUrl}/terms`,
    "",
    "---",
    "",
    "# Documentation",
    "",
    `Browse online: ${baseUrl}/docs`,
    "",
  ];

  for (const section of sections) {
    parts.push(`# ${section.title} (${section.audience === "user" ? "User Guide" : "Developer Docs"})`);
    parts.push("");

    for (const page of section.pages) {
      const mdPath = path.join(process.cwd(), "docs", "content", ...section.slug.split("/"), `${page.slug}.md`);
      try {
        const content = fs.readFileSync(mdPath, "utf-8");
        parts.push(content);
      } catch {
        parts.push(`## ${page.title}\n\nThis page is coming soon.`);
      }
      parts.push("");
      parts.push("---");
      parts.push("");
    }
  }

  const content = parts.join("\n");

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
