import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { BLOG_PAGE_SIZE, blogPageHref } from "@/lib/blog/pagination";
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
 */
export function BlogPagination({ page, total, path }: { page: number; total: number; path: string }) {
  const pages = Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE));
  if (pages < 2) return null;

  return (
    <nav aria-label="Blog pages" className="mt-14 flex items-center justify-center gap-3 sm:gap-4">
      <Step href={page > 1 ? blogPageHref(path, page - 1) : null} rel="prev">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Newer
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
                aria-label={`Page ${item}`}
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
        Page {page} of {pages}
      </p>

      <Step href={page < pages ? blogPageHref(path, page + 1) : null} rel="next">
        Older
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
