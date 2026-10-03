import { intlTag } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import { MARKET_GLOBAL, MARKETS } from "@/lib/websites/markets";
import { SUPPORTED_LANGUAGES } from "@/lib/websites/languages";

import type { Option } from "./business-profile";

/**
 * Labels for the Business settings pickers, in the reader's language.
 *
 * Built on the SERVER and handed to the client as plain strings: Intl's
 * display names come from the runtime's ICU data, which differs between Node
 * and browsers, and a label computed in both places would not hydrate.
 *
 * The stored values do not change - the English language name the article
 * prompt reads, and the English country name keyword research matches - only
 * what is shown beside them.
 */

const LANGUAGE_CODES: Record<string, string> = {
  English: "en",
  Spanish: "es",
  French: "fr",
  Italian: "it",
  German: "de",
  Portuguese: "pt",
  Dutch: "nl",
  Polish: "pl",
};

function displayNames(locale: Locale, type: "language" | "region"): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames([intlTag(locale)], { type });
  } catch {
    return null;
  }
}

/**
 * "Español (Spanish)" for an English reader, "Español (Spanisch)" for a
 * German one, and just "Deutsch" where the two names are the same - the
 * language's own name first, as languages.ts intends, then the reader's.
 */
export function languageOptions(locale: Locale): Option[] {
  const names = displayNames(locale, "language");
  return SUPPORTED_LANGUAGES.map((language) => {
    const native = language.label.split(" (")[0];
    const code = LANGUAGE_CODES[language.value];
    let local: string | undefined;
    try {
      local = code ? names?.of(code) : undefined;
    } catch {
      local = undefined;
    }
    if (!local) return { value: language.value, label: language.label };
    return {
      value: language.value,
      label: local.toLowerCase() === native.toLowerCase() ? native : `${native} (${local})`,
    };
  });
}

/** The two-letter region a flag emoji spells, e.g. the Italian flag -> "IT". */
function regionFromFlag(flag: string): string | null {
  const letters = [...flag].map((char) => (char.codePointAt(0) ?? 0) - 0x1f1e6);
  if (letters.length !== 2 || letters.some((n) => n < 0 || n > 25)) return null;
  return String.fromCharCode(...letters.map((n) => n + 65));
}

/**
 * Suggestions for the primary-market field: the stored English country name
 * as the value, the reader's own name for it as the label where that differs.
 * "Global" is left out - it is stored as an empty field, not a word.
 */
export function marketSuggestions(locale: Locale): Option[] {
  const names = displayNames(locale, "region");
  return MARKETS.filter((market) => market.value !== MARKET_GLOBAL).map((market) => {
    const region = regionFromFlag(market.flag);
    let local: string | undefined;
    try {
      local = region ? names?.of(region) : undefined;
    } catch {
      local = undefined;
    }
    return { value: market.value, label: local && local !== market.value ? local : "" };
  });
}

/**
 * Every other name the listed markets go by - in the dashboard languages and
 * the article languages ("España", "Spagna", "Spanien", "Hiszpania") -
 * lowercased, mapped to the English name keyword research matches
 * (lib/providers/dataforseo-markets.ts compares English names only).
 *
 * The page uses it for a warning with a one-press fix, never to change a
 * value by itself: "España" stays stored until someone chooses "Spain".
 */
export function marketAliases(): Record<string, string> {
  const aliases: Record<string, string> = {};
  for (const tag of new Set(Object.values(LANGUAGE_CODES))) {
    let names: Intl.DisplayNames;
    try {
      names = new Intl.DisplayNames([tag], { type: "region" });
    } catch {
      continue;
    }
    for (const market of MARKETS) {
      if (market.value === MARKET_GLOBAL) continue;
      const region = regionFromFlag(market.flag);
      let name: string | undefined;
      try {
        name = region ? names.of(region) : undefined;
      } catch {
        name = undefined;
      }
      const key = name?.trim().toLowerCase();
      if (key && key !== market.value.toLowerCase()) aliases[key] = market.value;
    }
  }
  return aliases;
}

/** The dashboard language's name in that language's reader's words: "español", "Deutsch". */
export function dashboardLanguageName(locale: Locale): string {
  try {
    return new Intl.DisplayNames([intlTag(locale)], { type: "language" }).of(locale) ?? locale;
  } catch {
    return locale;
  }
}
