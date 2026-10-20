import { AlertTriangle, CheckCircle2, CircleDashed, Info, XCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Building blocks of the partner portal pages. Server components that only
 * lay out words and figures already formatted by presentation/views.ts.
 */

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE: Record<Tone, { className: string; icon: LucideIcon }> = {
  success: { className: "bg-success-soft text-success border-success/20", icon: CheckCircle2 },
  warning: { className: "bg-warning-soft text-warning border-warning/25", icon: AlertTriangle },
  danger: { className: "bg-danger-soft text-danger border-danger/20", icon: XCircle },
  info: { className: "bg-info-soft text-info border-info/20", icon: Info },
  neutral: { className: "bg-muted text-foreground/75 border-border", icon: CircleDashed },
};

/** A status: an icon AND a word, never colour alone. */
export function StatusPill({ tone, label }: { tone: Tone; label: string }) {
  const Icon = TONE[tone].icon;
  return (
    <span className={cn("inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", TONE[tone].className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function PortalSection({ id, title, description, children, actions }: { id: string; title: string; description?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-6" aria-labelledby={id}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id} className="font-semibold">
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** One dashboard figure with its definition right under it. */
export function Figure({ label, value, definition, details }: { label: string; value: string; definition: string; details?: string[] }) {
  return (
    <div className="min-w-0 rounded-lg border bg-background p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 wrap-break-word text-xl font-semibold tabular-nums">{value}</dd>
      <dd className="mt-1 text-xs text-muted-foreground">{definition}</dd>
      {details && details.length > 0 ? (
        <dd className="mt-2 border-t pt-2">
          <ul className="space-y-1 text-xs text-muted-foreground tabular-nums">
            {details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </dd>
      ) : null}
    </div>
  );
}

export function PortalEmpty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</p>;
}

export function PortalPager({
  basePath,
  pager,
  params = {},
}: {
  basePath: string;
  pager: { page: number; pages: number; label: string; previous: number | null; next: number | null; previousLabel: string; nextLabel: string };
  params?: Record<string, string | undefined>;
}) {
  if (pager.pages <= 1) return null;
  const href = (page: number) => {
    const query = new URLSearchParams(Object.entries({ ...params, page: String(page) }).filter((entry): entry is [string, string] => Boolean(entry[1])));
    return `${basePath}?${query.toString()}`;
  };
  const link = "rounded-md border px-3 py-1.5 text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  return (
    <nav aria-label={pager.label} className="mt-4 flex items-center justify-between gap-3">
      {pager.previous ? (
        <Link href={href(pager.previous)} className={link} rel="prev">
          {pager.previousLabel}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted-foreground">{pager.label}</span>
      {pager.next ? (
        <Link href={href(pager.next)} className={link} rel="next">
          {pager.nextLabel}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/**
 * A list that is a table on wide screens and stacked cards on a phone, so
 * nothing scrolls sideways. `columns` label the cells; the first column is
 * the row's heading on a phone.
 */
export function ResponsiveList({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: { key: string; label: string; align?: "end" }[];
  rows: { id: string; cells: Record<string, ReactNode> }[];
}) {
  return (
    <>
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              {columns.map((column) => (
                <th key={column.key} scope="col" className={cn("px-2 py-2 font-medium", column.align === "end" && "text-right")}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0 align-top">
                {columns.map((column) => (
                  <td key={column.key} className={cn("px-2 py-3", column.align === "end" && "text-right tabular-nums")}>
                    {row.cells[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={row.id} className="rounded-lg border bg-background p-3">
            <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
              {columns.map((column) => (
                <div key={column.key} className="contents">
                  <dt className="text-muted-foreground">{column.label}</dt>
                  <dd className="min-w-0 break-words text-right">{row.cells[column.key]}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
