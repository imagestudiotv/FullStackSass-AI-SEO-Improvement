import { Info } from "lucide-react";

import type { AuthorityReading } from "@/lib/authority/metric";
import { format, formatDate } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import type { Messages } from "@/lib/i18n/messages";
import { cn } from "@/lib/utils";

type Text = Messages["app"]["reports"];

/**
 * The website's authority, always named by its real provider and scale
 * ("DataForSEO Rank", 0-100) and never shown as a zero when it is unknown.
 * The explanation is a native <details>, so it works by keyboard and with a
 * screen reader without any script.
 */
export function AuthorityBadge({
  reading,
  t,
  locale,
  className,
  compact = false,
}: {
  reading: AuthorityReading | null;
  t: Text;
  locale: Locale;
  className?: string;
  compact?: boolean;
}) {
  const status = reading?.status ?? "not_configured";
  const value = reading?.status === "ok" && reading.value !== null ? reading.value : null;
  const state =
    value !== null
      ? reading?.stale
        ? format(t.authorityStale, { date: formatDate(reading.observedAt!, locale, { day: "numeric", month: "short", year: "numeric" }) })
        : format(t.authorityUpdated, { date: formatDate(reading!.observedAt!, locale, { day: "numeric", month: "short", year: "numeric" }) })
      : status === "collecting" ? t.authorityCollecting
      : status === "no_access" ? t.authorityNoAccess
      : status === "no_data" ? t.authorityNoData
      : status === "error" ? t.authorityError
      : t.authorityNotConfigured;

  return (
    <div className={cn("rounded-lg border bg-card px-3 py-2 text-sm shadow-xs", className)}>
      <div className="flex items-center gap-2">
        <span className="font-medium">{t.authorityLabel}</span>
        {value !== null ? (
          <span
            className="rounded-full bg-violet-600 px-2 py-0.5 text-xs font-semibold tabular-nums text-white"
            aria-label={format(t.authorityValueAria, { value, max: reading!.scaleMax })}
          >
            {value}
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{t.unknownShort}</span>
        )}
      </div>
      {!compact ? (
        <details className="group mt-0.5">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
            <span>{state}</span>
            <Info className="size-3" aria-hidden="true" />
            <span className="sr-only">{t.authorityWhat}</span>
          </summary>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">{t.authorityHelp}</p>
        </details>
      ) : (
        <p className="text-xs text-muted-foreground">{state}</p>
      )}
    </div>
  );
}

/** A small inline rank for table rows: the value, or an honest dash. */
export function RankPill({ reading, t }: { reading: AuthorityReading | null; t: Text }) {
  if (reading?.status === "ok" && reading.value !== null) {
    const strong = reading.value >= 40;
    return (
      <span
        className={cn(
          "inline-flex min-w-9 justify-center rounded-md border px-1.5 py-0.5 text-xs font-medium tabular-nums",
          strong
            ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
            : "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300",
          reading.stale && "opacity-70",
        )}
        title={reading.stale ? t.rankStaleTitle : t.authorityLabel}
      >
        {reading.value}
      </span>
    );
  }
  const title =
    reading?.status === "collecting" ? t.authorityCollecting
    : reading?.status === "no_access" ? t.authorityNoAccess
    : reading?.status === "no_data" ? t.authorityNoData
    : reading?.status === "error" ? t.authorityError
    : t.authorityNotConfigured;
  return (
    <span className="text-xs text-muted-foreground" title={title}>
      <span aria-hidden="true">-</span>
      <span className="sr-only">{title}</span>
    </span>
  );
}
