import type { Locale } from "@/lib/i18n/config";
import { formatDate, intlTag } from "@/lib/i18n/format";

/** The time of day only, e.g. "10:45 UTC", under a date shown on its own. */
export function formatTime(value: Date | string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString(intlTag(locale), {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

/**
 * A stored time in the reader's language, always in UTC and labelled so.
 *
 * These render in a client component that is also rendered on the server; a
 * time zone left to the runtime would differ between the two (and between
 * customers), so it is fixed, as the rest of the app does for stored times.
 */
export function formatWhen(value: Date | string, locale: Locale, withTime = false): string {
  return formatDate(value, locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", timeZoneName: "short" } : {}),
  });
}
