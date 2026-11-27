import { normalizeLanguage } from "@/lib/websites/languages";

/**
 * Which language and market an AI visibility question is asked in.
 *
 * The review of 2026-11-27 found a Ukrainian website, writing Ukrainian
 * articles about greetings and gifts, tracked on twenty ENGLISH questions
 * about recipes and films: the questions were written from the domain alone,
 * with no language at all. A customer in Kyiv asks an assistant in
 * Ukrainian, and the businesses named in an English answer are mostly
 * American, so the 0/100 it showed measured nothing the customer could act
 * on. Questions are now written in the website's ARTICLE language for its
 * market, and the assistants are told where the asker is.
 *
 * Pure: no database, no client.
 */

export type Market = {
  /** The language questions are written and answered in ("Ukrainian"). */
  language: string;
  /** The market, as the profile names it ("Ukraine"); null when the profile has none. */
  region: string | null;
  /** Its ISO 3166-1 alpha-2 code ("UA"), for the assistants' location settings; null when unknown. */
  countryCode: string | null;
};

/**
 * A value shaped like a language name, as article generation accepts one
 * (lib/articles/generate.ts isLanguageName): letters, up to three words.
 * Copied rather than imported, so this stays free of the article pipeline.
 */
function looksLikeLanguage(value: string): boolean {
  return /^\p{L}[\p{L}' ()-]{0,29}$/u.test(value) && value.trim().split(/\s+/).length <= 3;
}

/**
 * The article language of a website, as questions are written in it:
 * "Spanish" for "es" or "español", the stored name for a language RepGet
 * does not list ("Ukrainian"), English when none is set.
 */
export function questionLanguage(language: string | null | undefined): string {
  const value = language?.trim() ?? "";
  if (!value) return "English";
  const known = normalizeLanguage(value);
  if (known) return known;
  return looksLikeLanguage(value) ? value.charAt(0).toUpperCase() + value.slice(1) : "English";
}

let byName: Map<string, string> | null = null;

/** Every region code Intl can name, by its English name, lower case. Built once. */
function namesToCodes(): Map<string, string> {
  if (byName) return byName;
  byName = new Map();
  const names = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      const name = names.of(code);
      if (name) byName.set(name.toLowerCase(), code);
    }
  }
  // The profile's usual spellings that Intl names otherwise.
  for (const [name, code] of [
    ["usa", "US"], ["united states of america", "US"], ["uk", "GB"], ["england", "GB"], ["great britain", "GB"],
    ["czech republic", "CZ"], ["holland", "NL"], ["south korea", "KR"], ["russia", "RU"], ["turkey", "TR"],
  ] as const) {
    byName.set(name, code);
  }
  return byName;
}

/** "Ukraine" -> "UA", "ua" -> "UA"; null for anything it cannot place. */
export function countryCode(country: string | null | undefined): string | null {
  const value = country?.trim() ?? "";
  if (!value) return null;
  const named = namesToCodes().get(value.toLowerCase());
  if (named) return named;
  return /^[a-z]{2}$/i.test(value) ? value.toUpperCase() : null;
}

/** The language and market a website's questions are written and asked in. */
export function marketOf(site: { language: string | null; country: string | null }): Market {
  const region = site.country?.trim() || null;
  return { language: questionLanguage(site.language), region, countryCode: countryCode(region) };
}

/**
 * How many of the questions we wrote are not in the website's language, or
 * were written before questions had one (2026-11-27: always English, from
 * the domain alone). The page offers to write them again when this is above
 * zero; the customer's own questions are never counted.
 */
export function questionsToRewrite(
  prompts: { isSuggested: boolean; language?: string | null }[],
  siteLanguage: string | null,
): number {
  const wanted = questionLanguage(siteLanguage);
  return prompts.filter((p) => p.isSuggested && (p.language ?? null) !== wanted).length;
}

/** Top-level domains that say nothing about a country, though some are country codes. */
const GENERIC_CC = new Set(["co", "io", "ai", "me", "tv", "cc", "ly", "fm", "gg", "to", "ws", "app", "dev", "sh", "is", "so", "vc", "la", "eu"]);

/**
 * The country a web address belongs to by its top-level domain ("shop.com.br"
 * -> "BR", "example.co.uk" -> "GB"), or null for .com, .org and the country
 * codes used as generic words (.io, .ai, .tv...).
 */
export function domainCountry(host: string): string | null {
  const tld = host.toLowerCase().split(".").pop() ?? "";
  if (tld.length !== 2 || GENERIC_CC.has(tld)) return null;
  return tld === "uk" ? "GB" : tld.toUpperCase();
}
