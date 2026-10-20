import { normalizeLanguage } from "@/lib/websites/languages";

/**
 * Which languages a website's articles can also be published in
 * (lib/articles/translations.ts): the languages the site itself publishes
 * in (websites.site_languages, from its hreflang links - WPML's codes, "it",
 * "es") other than its own, that RepGet writes. Pure, for the settings page,
 * the save action and the translation job alike.
 */

const CODES: Record<string, string> = {
  English: "en", Spanish: "es", French: "fr", Italian: "it", German: "de", Portuguese: "pt", Dutch: "nl", Polish: "pl",
};

/** "it" -> "Italian": a language RepGet writes, or null. */
export function languageName(code: string): string | null {
  return normalizeLanguage(code.split("-")[0]);
}

/** The website's own language ("English") as a code ("en"). */
export function mainLanguageCode(language: string | null): string {
  return CODES[normalizeLanguage(language) ?? "English"] ?? "en";
}

/** The languages a website can also publish in: its site's others that RepGet writes. */
export function extraLanguageChoices(site: { language: string | null; siteLanguages: string[] }): string[] {
  const main = mainLanguageCode(site.language);
  return site.siteLanguages.filter((code) => code.split("-")[0] !== main && languageName(code) !== null);
}
