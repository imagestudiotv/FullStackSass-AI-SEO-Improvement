import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { BLOG_CHROME, fill } from "@/lib/blog/locale";
import { BLOG_PAGE_SIZE, blogPageHref } from "@/lib/blog/pagination";
import type { Locale } from "@/lib/i18n/config";
import { pageItems } from "@/lib/pagination";
import { cn } from "@/lib/utils";

const STEP =
  "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border px-5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * A blog listing's pages, as the client's reference draws them (2026-10-08):
 * "← Newer", the page numbers - the current one in a dark circle, gaps as
 * "…" - and "Older →". Newer is always there, greyed out on the first page,
 * and Older on the last, so the row keeps its shape from page to page.
 *
 * Real links (crawlable, and they work without JavaScript). Phones get
 * "Page X of Y" between the two buttons instead of the numbers, which do not
 * fit beside them.
 *
 * In the listing's language (lib/blog/locale.ts): /it/blog, its category
 * pages and the team's Italian page pass "it". The English listings may pass
 * nothing.
 */
export function BlogPagination({
  page,
  total,
  path,
  locale = "en",
}: {
  page: number;
  total: number;
  path: string;
  locale?: Locale;
}) {
  const pages = Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE));
  if (pages < 2) return null;
  const t = BLOG_CHROME[locale];

  return (
    <nav aria-label={t.pagination} className="mt-14 flex items-center justify-center gap-3 sm:gap-4">
      <Step href={page > 1 ? blogPageHref(path, page - 1) : null} rel="prev">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t.newer}
      </Step>

      <ol className="hidden items-center gap-1 sm:flex">
        {pageItems(page, pages).map((item, index) =>
          item === "gap" ? (
            <li key={`gap-${index}`} aria-hidden="true" className="w-8 text-center text-sm text-muted-foreground">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                href={blogPageHref(path, item)}
                aria-label={fill(t.pageN, { page: item })}
                aria-current={item === page ? "page" : undefined}
                className={cn(
                  "inline-flex size-11 items-center justify-center rounded-full text-sm font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  item === page ? "bg-foreground text-background" : "hover:bg-muted",
                )}
              >
                {item}
              </Link>
            </li>
          ),
        )}
      </ol>
      <p className="text-sm text-muted-foreground tabular-nums sm:hidden">
        {fill(t.pageOf, { page, pages })}
      </p>

      <Step href={page < pages ? blogPageHref(path, page + 1) : null} rel="next">
        {t.older}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Step>
    </nav>
  );
}

/** Newer or Older: a link, or the same pill greyed out where there is no page that way. */
function Step({ href, rel, children }: { href: string | null; rel: "prev" | "next"; children: ReactNode }) {
  if (!href) {
    return (
      <span aria-disabled="true" className={cn(STEP, "cursor-default border-border/60 text-muted-foreground/60")}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} rel={rel} className={cn(STEP, "hover:border-foreground/40 hover:bg-muted")}>
      {children}
    </Link>
  );
}
