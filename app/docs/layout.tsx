"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronRight, Book, Code } from "lucide-react";
import {
  sections,
  getSectionsByAudience,
  getAudienceFromSlug,
  type Audience,
  type DocSection,
} from "@/docs/content/sections";

function Sidebar({
  audience,
  onAudienceChange,
  currentPath,
  onNavigate,
}: {
  audience: Audience;
  onAudienceChange: (a: Audience) => void;
  currentPath: string;
  onNavigate?: () => void;
}) {
  const filteredSections = getSectionsByAudience(audience);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-neutral-200">
        <Link
          href="/docs"
          className="text-lg font-bold text-neutral-900 hover:text-neutral-700 transition-colors"
          onClick={onNavigate}
          data-testid="link-docs-home"
        >
          Documentation
        </Link>
        <div className="mt-3 flex rounded-lg bg-neutral-100 p-0.5" data-testid="toggle-audience">
          <button
            onClick={() => onAudienceChange("user")}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-md transition-all cursor-pointer ${
              audience === "user"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
            data-testid="button-audience-user"
          >
            <Book className="w-3.5 h-3.5" />
            User Guide
          </button>
          <button
            onClick={() => onAudienceChange("developer")}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-md transition-all cursor-pointer ${
              audience === "developer"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
            data-testid="button-audience-developer"
          >
            <Code className="w-3.5 h-3.5" />
            Developers
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-5" data-testid="docs-sidebar-nav">
        {filteredSections.map((section) => (
          <SidebarSection
            key={section.slug}
            section={section}
            currentPath={currentPath}
            onNavigate={onNavigate}
          />
        ))}
      </nav>
    </div>
  );
}

function SidebarSection({
  section,
  currentPath,
  onNavigate,
}: {
  section: DocSection;
  currentPath: string;
  onNavigate?: () => void;
}) {
  return (
    <div>
      <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
        {section.title}
      </h3>
      <ul className="space-y-0.5">
        {section.pages.map((page) => {
          const href = `/docs/${section.slug}/${page.slug}`;
          const isActive = currentPath === href;
          return (
            <li key={page.slug}>
              <Link
                href={href}
                onClick={onNavigate}
                className={`block text-sm py-1.5 px-3 rounded-md transition-colors ${
                  isActive
                    ? "bg-neutral-900 text-white font-medium"
                    : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
                }`}
                data-testid={`link-doc-${section.slug}-${page.slug}`}
              >
                {page.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const slugParts = pathname.replace("/docs/", "").replace("/docs", "").split("/").filter(Boolean);
  const detectedAudience = slugParts.length > 0 ? getAudienceFromSlug(slugParts) : "user";
  const [audience, setAudience] = useState<Audience>(detectedAudience);

  const handleAudienceChange = useCallback((a: Audience) => {
    setAudience(a);
  }, []);

  return (
    <div className="min-h-screen bg-white flex" data-testid="docs-layout">
      <aside className="hidden lg:flex flex-col w-72 border-r border-neutral-200 sticky top-0 h-screen shrink-0">
        <Sidebar
          audience={audience}
          onAudienceChange={handleAudienceChange}
          currentPath={pathname}
        />
      </aside>

      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-neutral-200 px-4 py-3 flex items-center justify-between">
        <Link href="/docs" className="text-base font-bold text-neutral-900" data-testid="link-docs-home-mobile">
          Docs
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-md hover:bg-neutral-100 cursor-pointer"
          data-testid="button-mobile-menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-white pt-14 overflow-y-auto">
          <Sidebar
            audience={audience}
            onAudienceChange={handleAudienceChange}
            currentPath={pathname}
            onNavigate={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      <main className="flex-1 min-w-0 lg:py-0 pt-14">
        {children}
      </main>
    </div>
  );
}
