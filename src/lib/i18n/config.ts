/**
 * Marketing site languages.
 *
 * The brief: "To completely translate the website in 4 more languages for
 * major reach, not just google translate but a proper translation /es, /it,
 * etc." — Spanish, French, Italian, German.
 *
 * MARKETING PAGES ONLY. The brief says "the website" and gives /es and /it as
 * examples, which are public URLs: those are the pages Google indexes and the
 * ones "major reach" refers to. Translating the signed-in app is a much larger
 * job — every form, error and empty state — and it reaches nobody who has not
 * already signed up.
 *
 * English has no prefix. Adding /en would break every existing link, and the
 * canonical tags already point at unprefixed URLs.
 */

export const DEFAULT_LOCALE = "en" as const;

export const LOCALES = ["en", "es", "fr", "it", "de"] as const;

export type Locale = (typeof LOCALES)[number];

/** Language names in their own language, for the switcher. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  it: "Italiano",
  de: "Deutsch",
};

/**
 * Locales other than the default, i.e. the ones that appear in a URL.
 * `/es/pricing` is Spanish; `/pricing` is English.
 */
export const PREFIXED_LOCALES = LOCALES.filter(
  (locale) => locale !== DEFAULT_LOCALE,
);

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Splits a pathname into its locale and the rest.
 *
 * "/es/pricing" -> { locale: "es", path: "/pricing" }
 * "/pricing"    -> { locale: "en", path: "/pricing" }
 */
export function splitLocale(pathname: string): {
  locale: Locale;
  path: string;
} {
  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];

  if (first && isLocale(first) && first !== DEFAULT_LOCALE) {
    return { locale: first, path: `/${segments.slice(1).join("/")}` };
  }

  return { locale: DEFAULT_LOCALE, path: pathname };
}

/** Builds a path for a locale. English stays unprefixed. */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return clean;
  return `/${locale}${clean === "/" ? "" : clean}`;
}
