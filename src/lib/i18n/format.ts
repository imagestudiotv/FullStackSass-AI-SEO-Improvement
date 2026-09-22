import type { Locale } from "@/lib/i18n/config";

/**
 * Dates and numbers in the reader's language.
 *
 * The app formatted dates three different ways: some hardcoded "en-GB", some
 * "en-US", and some with no locale at all — which follows the BROWSER rather
 * than the account, so the same screen could show two conventions at once. A
 * German customer reading a German dashboard saw 21/09/2026 beside 9/21/2026.
 *
 * BCP 47 tags rather than the bare locale: "de" alone is a valid tag, but
 * pinning the region fixes the conventions that vary within a language —
 * en-GB is 21/09/2026 where en-US is 9/21/2026, and both are "en".
 */
const DATE_TAGS: Record<Locale, string> = {
  en: "en-GB",
  es: "es-ES",
  fr: "fr-FR",
  it: "it-IT",
  de: "de-DE",
};

/** The BCP 47 tag for a locale, for any Intl call. */
export function intlTag(locale: Locale): string {
  return DATE_TAGS[locale] ?? "en-GB";
}

/** A date in the reader's convention. Accepts what the database returns. */
export function formatDate(
  value: Date | string | number,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = value instanceof Date ? value : new Date(value);
  // An unparseable value renders as an em dash rather than "Invalid Date",
  // which is a stack trace leaking into the interface.
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(intlTag(locale), options);
}

/** A number with the reader's separators: 1,000 / 1.000 / 1 000. */
export function formatNumber(value: number, locale: Locale): string {
  return value.toLocaleString(intlTag(locale));
}
