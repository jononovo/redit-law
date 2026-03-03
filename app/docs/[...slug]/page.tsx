import { notFound } from "next/navigation";
import fs from "fs";
import path from "path";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { sections, findPage, getAllPagesFlat, getAudienceFromSlug } from "@/docs/content/sections";
import { DocRenderer } from "./doc-renderer";

interface Props {
  params: Promise<{ slug: string[] }>;
}

export default async function DocPage({ params }: Props) {
  const { slug } = await params;
  const found = findPage(slug);

  if (!found) {
    notFound();
  }

  const { section, page, pageIndex } = found;
  const audience = getAudienceFromSlug(slug);
  const allPages = getAllPagesFlat(audience);

  const currentIndex = allPages.findIndex(
    (p) => p.path === `/docs/${section.slug}/${page.slug}`
  );
  const prevPage = currentIndex > 0 ? allPages[currentIndex - 1] : null;
  const nextPage = currentIndex < allPages.length - 1 ? allPages[currentIndex + 1] : null;

  const mdPath = path.join(process.cwd(), "docs", "content", ...section.slug.split("/"), `${page.slug}.md`);
  let content = "";
  try {
    content = fs.readFileSync(mdPath, "utf-8");
  } catch {
    content = `# ${page.title}\n\nThis page is coming soon.`;
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12" data-testid={`doc-page-${section.slug}-${page.slug}`}>
      <div className="mb-6">
        <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">
          {section.title}
        </p>
      </div>

      <article className="prose prose-lg prose-neutral max-w-none prose-headings:font-bold prose-h1:text-4xl prose-h1:mb-6 prose-h1:leading-tight prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3 prose-p:text-neutral-600 prose-p:leading-relaxed prose-p:mb-5 prose-li:text-neutral-600 prose-li:leading-relaxed prose-ul:my-4 prose-ol:my-4 prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline prose-code:text-sm prose-code:bg-neutral-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-neutral-900 prose-pre:text-neutral-100 prose-strong:text-neutral-900 prose-table:text-sm prose-th:text-left prose-th:text-neutral-500 prose-th:font-semibold prose-th:uppercase prose-th:tracking-wider prose-th:text-xs prose-td:py-2 prose-hr:my-8">
        <DocRenderer content={content} />
      </article>

      <div className="mt-12 pt-6 border-t border-neutral-200 flex items-center justify-between gap-4">
        {prevPage ? (
          <Link
            href={prevPage.path}
            className="group flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
            data-testid="link-doc-prev"
          >
            <ChevronLeft className="w-4 h-4" />
            <div className="text-right">
              <span className="text-xs text-neutral-400 block">Previous</span>
              <span className="font-medium">{prevPage.page.title}</span>
            </div>
          </Link>
        ) : (
          <div />
        )}
        {nextPage ? (
          <Link
            href={nextPage.path}
            className="group flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors text-right"
            data-testid="link-doc-next"
          >
            <div>
              <span className="text-xs text-neutral-400 block">Next</span>
              <span className="font-medium">{nextPage.page.title}</span>
            </div>
            <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}

export async function generateStaticParams() {
  const params: { slug: string[] }[] = [];
  for (const section of sections) {
    for (const page of section.pages) {
      params.push({ slug: [...section.slug.split("/"), page.slug] });
    }
  }
  return params;
}
