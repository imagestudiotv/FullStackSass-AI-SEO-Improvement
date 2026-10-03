import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The frame every admin list sits in: a white surface whose table gets one
 * consistent density - 40px header row in small muted type, 14px body text,
 * comfortable row height, numbers in tabular figures (cells marked
 * `data-numeric`), multi-line cells top-aligned (`data-align="top"`). Styled
 * from here by descendant selectors so each page's table markup stays plain.
 *
 * The table scrolls inside this frame on a narrow screen; the page never
 * scrolls sideways.
 */
export function AdminTableCard({
  children,
  footer,
  toolbar,
  className,
}: {
  children: ReactNode;
  /** Pagination, usually. */
  footer?: ReactNode;
  /** A bar above the rows, inside the frame (e.g. a selection bar). */
  toolbar?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
        "[&_thead_tr]:border-b [&_thead_tr]:bg-muted/40 [&_th]:h-10 [&_th]:px-4 [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted-foreground",
        // Middle-aligned by default; a cell holding several lines opts out with data-align="top".
        "[&_td]:px-4 [&_td]:py-3 [&_td]:align-middle [&_td[data-align=top]]:align-top [&_tbody_tr]:border-b [&_tbody_tr:last-child]:border-b-0 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-muted/30",
        "[&_[data-numeric]]:text-right [&_[data-numeric]]:tabular-nums",
        /*
          Cells wrap. The ui Table's cells are nowrap, so one long name or
          domain made the table wider than its card - even at 1440px beside
          the sidebar - and the row's actions menu sat behind a sideways
          scroll. A column still gets its full width when there is room; it
          wraps only when there is not. Phones may also break inside long
          emails and domains.
        */
        "[&_td]:whitespace-normal [&_td]:[overflow-wrap:break-word] max-md:[&_td]:[overflow-wrap:anywhere]",
        // Phones: tighter cell padding, so status pills (which never wrap) and the actions button fit beside the name.
        "max-sm:[&_td]:px-2.5 max-sm:[&_th]:px-2.5",
        className,
      )}
    >
      {toolbar}
      {children}
      {footer ? <div className="border-t px-4 py-3">{footer}</div> : null}
    </div>
  );
}

/**
 * Shown while rows are selected: how many, WHAT the selection covers (this
 * page only - never implied to be every match), and the actions for them.
 */
export function AdminSelectionBar({
  count,
  scope = "on this page",
  children,
  onClear,
}: {
  count: number;
  scope?: string;
  children: ReactNode;
  onClear?: () => void;
}) {
  if (count === 0) return null;
  return (
    <div
      role="region"
      aria-label="Selection"
      className="flex flex-wrap items-center gap-3 border-b bg-primary/5 px-4 py-2.5 text-sm"
    >
      <p className="font-medium tabular-nums">
        {count} selected <span className="font-normal text-muted-foreground">{scope}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="ml-auto rounded text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          Clear selection
        </button>
      ) : null}
    </div>
  );
}
