"use client";

import { useState } from "react";
import Link from "next/link";
import { Book, Code, ChevronRight } from "lucide-react";
import { getSectionsByAudience, type Audience } from "@/docs/content/sections";

export default function DocsIndexPage() {
  const [audience, setAudience] = useState<Audience>("user");
  const filteredSections = getSectionsByAudience(audience);

  return (
    <div className="max-w-3xl mx-auto px-6 py-12" data-testid="docs-index">
      <h1 className="text-3xl font-bold text-neutral-900 mb-3">CreditClaw Documentation</h1>
      <p className="text-neutral-500 text-lg mb-8">
        Everything you need to know about using CreditClaw.
      </p>

      <div className="space-y-8">
        {filteredSections.map((section) => (
          <div key={section.slug} data-testid={`docs-index-section-${section.slug}`}>
            <h2 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-3">
              {section.title}
            </h2>
            <div className="grid gap-2">
              {section.pages.map((page) => (
                <Link
                  key={page.slug}
                  href={`/docs/${section.slug}/${page.slug}`}
                  className="group flex items-center justify-between px-4 py-3 rounded-xl border border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 transition-all"
                  data-testid={`docs-index-link-${section.slug}-${page.slug}`}
                >
                  <span className="text-sm font-medium text-neutral-700 group-hover:text-neutral-900">
                    {page.title}
                  </span>
                  <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:text-neutral-500 transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
