import { ArrowLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Page building blocks for the admin area: one header, one surface, one
 * figure tile, so every admin page reads the same way. Server components:
 * nothing here needs the browser.
 */

/** The content column. "wide" for data-heavy lists; "default" for most pages; "narrow" for forms. */
export function AdminPage({
  children,
  width = "wide",
  className,
}: {
  children: ReactNode;
  width?: "narrow" | "default" | "wide";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full min-w-0 space-y-6",
        width === "wide" && "max-w-[1440px]",
        width === "default" && "max-w-6xl",
        width === "narrow" && "max-w-3xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Title, one line of purpose, and the page's own actions on the right.
 * `back` keeps a detail page's way out of it next to its title.
 */
export function AdminPageHeader({
  title,
  description,
  actions,
  back,
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
  /** Small facts under the title (status, website, dates). */
  meta?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 space-y-1.5">
        {back ? (
          <Link
            href={back.href}
            className="inline-flex items-center gap-1 rounded text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            {back.label}
          </Link>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground [overflow-wrap:anywhere] md:text-[28px] md:leading-9">
          {title}
        </h1>
        {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
        {meta ? <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-0.5 text-sm text-muted-foreground">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

/** A white surface with an optional heading row. */
export function AdminSection({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  id,
  tone = "default",
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
  /** "danger" frames actions that delete, refund or stop things. */
  tone?: "default" | "danger";
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={title ? headingId : undefined}
      className={cn(
        "min-w-0 rounded-xl border bg-card text-card-foreground shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
        tone === "danger" && "border-destructive/30",
        className,
      )}
    >
      {title || actions ? (
        <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-0.5">
            {title ? (
              <h2 id={headingId} className={cn("text-base font-semibold", tone === "danger" && "text-destructive")}>
                {title}
              </h2>
            ) : null}
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn("min-w-0", bodyClassName ?? "p-5")}>{children}</div>
    </section>
  );
}

/**
 * One figure. Links to the list behind it when there is one; a figure with
 * no list behind it does not look clickable. `unavailable` is shown instead
 * of a value when its query failed - never a zero that is not true.
 */
export function AdminStat({
  label,
  value,
  hint,
  href,
  unavailable,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  unavailable?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {href ? (
          <ArrowUpRight
            className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
            aria-hidden="true"
          />
        ) : null}
      </div>
      <p className="mt-2 text-[26px] font-semibold leading-none tracking-tight text-foreground">
        {unavailable ? <span className="text-base font-medium text-muted-foreground">Unavailable</span> : value}
      </p>
      {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );
  const frame = cn(
    "group block min-w-0 rounded-xl border bg-card p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
    href && "outline-none transition-colors hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );
  return href ? (
    <Link href={href} className={frame}>
      {body}
    </Link>
  ) : (
    <div className={frame}>{body}</div>
  );
}

/** A label/value list for detail pages and inspectors. */
export function AdminFacts({ items, className }: { items: { label: string; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid gap-x-4 gap-y-3 text-sm sm:grid-cols-[minmax(120px,auto)_1fr]", className)}>
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 [overflow-wrap:anywhere]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
