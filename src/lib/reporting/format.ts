import { intlTag } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";

export type ValueUnit = { kind: "count" } | { kind: "currency"; currency: string };

/**
 * A count or an amount of money in the reader's locale. Shared by server
 * and client components (it must not live in a "use client" module, or a
 * server page could not call it).
 */
export function formatValue(value: number, unit: ValueUnit, locale: Locale, compact = false): string {
  const tag = intlTag(locale);
  /*
    Both fraction-digit bounds are always explicit: left to defaults, Node's
    and the browser's ICU disagree (compact zero renders "US$0.0" on the
    server and "US$0" in Chrome), which breaks hydration.
  */
  if (unit.kind === "currency") {
    const digits = compact ? { min: 0, max: 1 } : value !== 0 && Math.abs(value) < 100 ? { min: 2, max: 2 } : { min: 0, max: 0 };
    return new Intl.NumberFormat(tag, {
      style: "currency",
      currency: unit.currency,
      notation: compact ? "compact" : "standard",
      minimumFractionDigits: digits.min,
      maximumFractionDigits: digits.max,
    }).format(value);
  }
  return new Intl.NumberFormat(tag, {
    notation: compact ? "compact" : "standard",
    minimumFractionDigits: 0,
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value);
}
