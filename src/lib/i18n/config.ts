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
  /*
    "/index" IS THE HOME PAGE. When the deployed site regenerates the cached
    home page (it revalidates), Next renders it under its internal route name,
    so usePathname() returns "/index" on the server while the browser has "/".
    The language switcher hides itself on paths it cannot translate, so the
    served HTML had no switcher, the browser rendered one, and React threw
    hydration error #418 on every visit to https://www.repget.com/ - then
    re-rendered the whole page in the browser, which is what Lighthouse
    counted as blocking time. Nothing in the app is called "index", so a
    trailing "index" segment always means the page itself.
  */
  const segments = pathname.split("/").filter(Boolean);
  if (segments.at(-1) === "index") segments.pop();
  const first = segments[0];

  if (first && isLocale(first) && first !== DEFAULT_LOCALE) {
    return { locale: first, path: `/${segments.slice(1).join("/")}` };
  }

  return { locale: DEFAULT_LOCALE, path: `/${segments.join("/")}` };
}

/**
 * The pages that exist in every language: the home page and the folders
 * under app/(marketing)/[locale] (config.test.ts keeps the two in step).
 * Everything else - the free check, the tools, the docs, the blog - is
 * English-only and has no /es/... address.
 */
export const TRANSLATED_PATHS: ReadonlySet<string> = new Set([
  "/",
  "/pricing",
  "/about",
  "/faq",
  "/contact",
  "/success-stories",
  "/publishers",
  "/affiliate",
  "/backlink-exchange",
]);

/**
 * Builds a path for a locale. English stays unprefixed, and so does any page
 * that is English-only: a Spanish page links to /audit, not to an /es/audit
 * that does not exist. Every translated page's "free check" button and its
 * tools and docs links used to be exactly that - 404s (found by the 404
 * logging review, 2026-10-04). A ?query or #fragment is kept.
 */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === DEFAULT_LOCALE) return clean;
  const cut = clean.search(/[?#]/);
  const pathname = cut === -1 ? clean : clean.slice(0, cut);
  const suffix = cut === -1 ? "" : clean.slice(cut);
  if (!TRANSLATED_PATHS.has(pathname)) return clean;
  return `/${locale}${pathname === "/" ? "" : pathname}${suffix}`;
}

/**
 * The hreflang alternates for one page: its address in every locale, plus
 * x-default for searchers whose language we do not serve.
 *
 * ONE DEFINITION FOR BOTH SIDES. hreflang only counts when it is reciprocal:
 * Google ignores a translation that points at the original unless the
 * original points back. The localised pages declared their alternates and the
 * English ones did not, so the whole set was discarded (client's launch
 * review, 2026-10-03). Every page - English and translated - now reads this,
 * so the two sides cannot drift apart again.
 *
 * x-default is the English, unprefixed page: the one served to anybody whose
 * language is not in LOCALES.
 */
export function languageAlternates(
  path: string,
): Record<Locale | "x-default", string> {
  const byLocale = Object.fromEntries(
    LOCALES.map((locale) => [locale, localePath(locale, path)]),
  ) as Record<Locale, string>;
  return { ...byLocale, "x-default": localePath(DEFAULT_LOCALE, path) };
}
