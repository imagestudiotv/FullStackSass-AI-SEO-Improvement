import Link from "next/link";

import { format } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

import { GOOGLE_RANGES, googleRangeDays, googleRangeHref, type GoogleRange } from "./range";

/**
 * The period for every figure, chart and table on the Google page, as links
 * (the Dashboard's segmented range control). Each is a URL, so the server
 * reads the period and nothing is computed in the browser; scroll={false}
 * keeps the reader where they were.
 */
export function GoogleRangeNav({
  websiteId,
  range,
  dates,
  t,
}: {
  websiteId: string;
  range: GoogleRange;
  /** The period's first and last day, already formatted. */
  dates: { start: string; end: string };
  t: Messages["app"]["analytics"];
}) {
  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <nav aria-label={t.rangeLabel}>
        <ul className="flex rounded-lg border bg-card p-0.5 text-sm">
          {GOOGLE_RANGES.map((option) => (
            <li key={option}>
              <Link
                href={googleRangeHref(websiteId, option)}
                scroll={false}
                aria-current={option === range ? "page" : undefined}
                className={cn(
                  "block rounded-md px-2.5 py-1 whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none",
                  option === range ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {format(t.rangeDays, { days: googleRangeDays(option) })}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <p className="text-xs text-muted-foreground tabular-nums">{format(t.periodDates, dates)}</p>
    </div>
  );
}
