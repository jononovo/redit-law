import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { sections } from "@/docs/content/sections";

export async function GET() {
  const parts: string[] = [
    "# CreditClaw — Full Documentation",
    "",
    "CreditClaw is a financial infrastructure platform that gives AI agents the ability to spend money on your behalf — safely, with limits you control.",
    "",
    "---",
    "",
  ];

  for (const section of sections) {
    parts.push(`# ${section.title}`);
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
