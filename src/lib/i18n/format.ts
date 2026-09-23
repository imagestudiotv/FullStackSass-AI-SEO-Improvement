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

/**
 * Fills {name} placeholders in a message.
 *
 * These messages used to be functions in the dictionary — `connectedTo: (name)
 * => \`Connected to ${name}\`` — which read well and typechecked, but a
 * function cannot be serialized. Every screen that handed a translated section
 * to a client component therefore crashed in production with "Functions cannot
 * be passed directly to Client Components": billing, publishing, websites,
 * backlinks, add-ons and the website switcher. Plain strings cross that
 * boundary, so the interpolation moved here and the dictionary went back to
 * being data.
 *
 * An unknown placeholder is left as written rather than replaced with
 * "undefined": a visible {name} in an unusual branch is a bug report, while
 * "Connected to undefined" looks like a broken product.
 */
export function format(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}

/**
 * Picks the singular or plural half of a "one|many" message, then fills it.
 *
 * Several of these strings inflect more than the noun — Italian's "1 sito
 * disponibile" against "2 siti disponibili" changes two words, and Spanish's
 * "Queda 1 paso" against "Quedan 2 pasos" changes the verb. Storing both
 * whole forms separated by a pipe keeps each language's grammar in that
 * language's entry, where a translator can see it, instead of encoding it as
 * a ternary in shared code.
 *
 * Only the two-form languages we ship are handled (en, es, fr, it, de all
 * distinguish exactly one from everything else). A language with dual or
 * paucal forms would need Intl.PluralRules here.
 */
export function plural(
  template: string,
  count: number,
  values: Record<string, string | number> = {},
): string {
  const [one = "", many = ""] = template.split("|");
  return format(count === 1 ? one : many, { ...values, count });
}
