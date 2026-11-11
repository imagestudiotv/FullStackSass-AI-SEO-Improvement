import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

/**
 * The customer directory's addresses (client, 2026-11-11 round 2): /discover
 * lists the businesses, /discover/<slug> shows one; in another language under
 * its prefix (/it/discover/<slug>). The directory is in TRANSLATED_PATHS; a
 * profile is a database page with addresses of its own in each language, so
 * it is built here rather than by localePath (which only prefixes the fixed
 * pages).
 */
export function discoverPath(locale: Locale, slug?: string): string {
  const base = locale === DEFAULT_LOCALE ? "/discover" : `/${locale}/discover`;
  return slug ? `${base}/${slug}` : base;
}

/**
 * hreflang for a profile: its page in every language with a published
 * version of it, plus x-default - the English page when there is one,
 * otherwise the first. Nothing when fewer than two (as a blog category's,
 * lib/blog/locale.ts categoryAlternates).
 */
export function discoverAlternates(slug: string, locales: readonly Locale[]): Record<string, string> | undefined {
  if (locales.length < 2) return undefined;
  const map: Record<string, string> = Object.fromEntries(locales.map((locale) => [locale, discoverPath(locale, slug)]));
  map["x-default"] = map[DEFAULT_LOCALE] ?? discoverPath(locales[0], slug);
  return map;
}
