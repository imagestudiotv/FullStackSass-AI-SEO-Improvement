import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Standard page header.
 *
 * Every page previously hand-rolled its own title block, which drifted into
 * four different type treatments and three container widths — so the layout
 * visibly shifted as you moved between pages. One component keeps the answer
 * to "where am I, and what is this page for" identical everywhere.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  /** One sentence in plain language. Not a feature list. */
  description?: string;
  /** Existing page-level actions only. */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Page shell.
 *
 * Fixes the container width in one place. Pages were split between max-w-3xl,
 * 5xl and 6xl, so the content column jumped width on navigation.
 *
 * 6xl rather than the 4xl this started at. The app sits beside a 15rem sidebar,
 * so a 4xl column left a band of empty background down the right on any normal
 * laptop — the dashboard's website list ran to less than half the window. It
 * also disagreed with the marketing pages, which are mostly 5xl and 6xl, so the
 * layout narrowed at exactly the point someone signed in.
 *
 * Reading width is handled where it matters instead: prose keeps its own
 * max-w-2xl, so widening the shell gives room to cards, tables and charts
 * without stretching sentences.
 */
export function PageShell({
  children,
  width = "default",
  className,
}: {
  children: ReactNode;
  /** "default" for most pages; "wide" for data tables that need the room. */
  width?: "default" | "wide";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full space-y-6",
        width === "wide" ? "max-w-7xl" : "max-w-6xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
