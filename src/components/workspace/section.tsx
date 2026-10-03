import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The surface every redesigned workspace page is built from.
 *
 * Deliberately the Dashboard's and Backlink Exchange's own card -
 * `rounded-xl border bg-card p-5`, no shadow - so Settings, Article Settings,
 * the article workspace and the reports read as the same product rather than
 * a second design system. One heading scale for every section (base,
 * semibold), one muted line under it, and an optional icon tile in the
 * Partner Network card's style (primary/10 on primary).
 *
 * `id` makes the section a target for the section navigation and for links
 * like /settings#referral; scroll-mt keeps its heading clear of the sticky
 * app header when jumped to.
 */
export function WorkspaceSection({
  id,
  title,
  description,
  icon: Icon,
  actions,
  footer,
  children,
  className,
  bodyClassName,
  tone = "default",
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  /** Controls that act on the whole section, top right. */
  actions?: ReactNode;
  /** A strip under the body, e.g. a section's own Save. */
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** "danger" frames destructive actions (delete, cancel) apart from routine ones. */
  tone?: "default" | "danger";
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(
        "min-w-0 scroll-mt-20 rounded-xl border bg-card",
        tone === "danger" && "border-destructive/30",
        className,
      )}
    >
      <div className="flex flex-col gap-3 p-5 pb-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg",
                tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
              )}
              aria-hidden="true"
            >
              <Icon className="size-4" />
            </span>
          ) : null}
          <div className="min-w-0 space-y-1">
            <h2 id={headingId} className="text-base font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {description ? <div className="max-w-3xl text-sm text-muted-foreground">{description}</div> : null}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div className={cn("p-5", bodyClassName)}>{children}</div>
      {footer ? <div className="rounded-b-xl border-t bg-muted/30 px-5 py-3">{footer}</div> : null}
    </section>
  );
}

/** A labelled group inside a section, for long sections that need a second level. */
export function WorkspaceSubsection({
  title,
  description,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4 border-t pt-5 first:border-t-0 first:pt-0", className)}>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? <p className="max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}
