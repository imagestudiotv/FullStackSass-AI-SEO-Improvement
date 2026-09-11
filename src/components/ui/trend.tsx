import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Change against a previous period.
 *
 * The product's whole claim is that a number moved, so the movement needs to
 * be as readable as the number itself. Shown only where a real earlier value
 * exists: pass `previous={null}` before there is one and this renders nothing
 * rather than implying a rise from zero on the first measurement.
 *
 * Direction carries an arrow as well as a colour, so it survives greyscale and
 * colour blindness — the same rule StatusBadge follows.
 */

/**
 * Movement when the change is already known.
 *
 * Some queries return a delta rather than the earlier value — the dashboard's
 * search performance is one — so there is nothing to subtract. Same rules as
 * Trend: no percentage without a baseline to divide by, an arrow as well as a
 * colour, and nothing rendered when the figure has not moved.
 */
export function Delta({
  value,
  higherIsBetter = true,
  label,
  /** Formats the magnitude, e.g. a compact "1.2k". Defaults to the number. */
  format,
  className,
}: {
  value: number;
  higherIsBetter?: boolean;
  label?: string;
  format?: (value: number) => string;
  className?: string;
}) {
  if (value === 0) return null;

  const improved = higherIsBetter ? value > 0 : value < 0;
  const Icon = value > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        improved
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-red-600 dark:text-red-400",
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span className="tabular-nums">
        {value > 0 ? "+" : "-"}
        {format ? format(Math.abs(value)) : Math.abs(value)}
      </span>
      {label ? (
        <span className="font-normal text-muted-foreground">{label}</span>
      ) : null}
    </span>
  );
}

export function Trend({
  current,
  previous,
  /**
   * Whether a rise is good. False for things like average position, where
   * moving from 5th to 2nd is an improvement but a smaller number.
   */
  higherIsBetter = true,
  /** Shown after the change, e.g. "vs last check". */
  label,
  className,
}: {
  current: number;
  previous: number | null;
  higherIsBetter?: boolean;
  label?: string;
  className?: string;
}) {
  // Nothing to compare against yet: this is the first measurement.
  if (previous === null) return null;

  const delta = current - previous;
  const rounded = Math.round(delta * 10) / 10;

  /**
   * Percentages are deliberately not shown against a zero baseline: a move
   * from 0 to 3 is not "+300%", it is the first time anything was recorded.
   */
  const percent =
    previous !== 0 ? Math.round((delta / Math.abs(previous)) * 100) : null;

  const flat = rounded === 0;
  const improved = higherIsBetter ? delta > 0 : delta < 0;

  const Icon = flat ? ArrowRight : delta > 0 ? ArrowUpRight : ArrowDownRight;

  const tone = flat
    ? "text-muted-foreground"
    : improved
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400";

  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs font-medium", tone, className)}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span className="tabular-nums">
        {flat ? "No change" : `${delta > 0 ? "+" : ""}${rounded}`}
        {percent !== null && !flat ? ` (${percent > 0 ? "+" : ""}${percent}%)` : ""}
      </span>
      {label ? (
        <span className="font-normal text-muted-foreground">{label}</span>
      ) : null}
    </span>
  );
}
