import { NextResponse } from "next/server";
import { sections } from "@/docs/content/sections";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://creditclaw.com";

  const lines: string[] = [
    "# CreditClaw",
    "",
    "> CreditClaw is a financial infrastructure platform that gives AI agents the ability to spend money on your behalf — safely, with limits you control. It provides prepaid wallets, spending guardrails, multi-rail payment support, and a bot-facing API for autonomous purchases, invoicing, and sales.",
    "",
    "## Documentation",
    "",
  ];

  for (const section of sections) {
    lines.push(`### ${section.title}`);
    for (const page of section.pages) {
      const mdUrl = `${baseUrl}/api/docs/${section.slug}/${page.slug}`;
      lines.push(`- [${page.title}](${mdUrl})`);
    }
    lines.push("");
  }

  lines.push("## Additional Resources");
  lines.push("");
  lines.push(`- [Full documentation (single file)](${baseUrl}/llms-full.txt)`);
  lines.push(`- [Bot skill file](${baseUrl}/checkout.md)`);
  lines.push(`- [API base URL](${baseUrl}/api/v1/)`);
  lines.push("");

  const content = lines.join("\n");

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
