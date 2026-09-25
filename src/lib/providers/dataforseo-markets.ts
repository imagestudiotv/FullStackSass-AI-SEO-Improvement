/**
 * The country and language pairs DataForSEO Labs has keyword data for, and how
 * to pick one when a website's own pair is not among them.
 *
 * WHY. Labs rejects any other pair outright - "40501 Invalid Field:
 * 'language_name'" - and it only knows a country's own languages. Italy is
 * Italian only; English exists for 27 countries. So imagestudio.com, an
 * Italian studio writing in English, failed at this call on every keyword
 * research run, and its plan was built from AI-suggested terms with no search
 * volume or difficulty at all.
 *
 * The website profile is NOT restricted to these pairs, deliberately: the same
 * language setting decides what language articles are written in, and "an
 * Italian business writing in English" is a perfectly good profile. Only the
 * keyword lookup needs a pair Labs accepts.
 *
 * SNAPSHOT of /v3/dataforseo_labs/locations_and_languages, taken 2026-09-25.
 * DataForSEO adds markets rarely; a missing new one only means a fallback
 * where the real pair would have worked, never a failed request.
 */
const LABS_MARKETS: Record<string, string[]> = {
  "Albania": ["Albanian"],
  "Algeria": ["French","Arabic"],
  "Angola": ["Portuguese"],
  "Argentina": ["Spanish"],
  "Armenia": ["Armenian"],
  "Australia": ["English"],
  "Austria": ["German"],
  "Azerbaijan": ["Azeri"],
  "Bahrain": ["Arabic"],
  "Bangladesh": ["Bengali"],
  "Belgium": ["French","Dutch","German"],
  "Bolivia": ["Spanish"],
  "Bosnia and Herzegovina": ["Bosnian"],
  "Brazil": ["Portuguese"],
  "Bulgaria": ["Bulgarian"],
  "Burkina Faso": ["French"],
  "Cambodia": ["English"],
  "Cameroon": ["French"],
  "Canada": ["English","French"],
  "Chile": ["Spanish"],
  "Colombia": ["Spanish"],
  "Costa Rica": ["Spanish"],
  "Cote d'Ivoire": ["French"],
  "Croatia": ["Croatian"],
  "Cyprus": ["Greek","English"],
  "Czechia": ["Czech"],
  "Denmark": ["Danish"],
  "Ecuador": ["Spanish"],
  "Egypt": ["Arabic","English"],
  "El Salvador": ["Spanish"],
  "Estonia": ["Estonian"],
  "Finland": ["Finnish"],
  "France": ["French"],
  "Germany": ["German"],
  "Ghana": ["English"],
  "Greece": ["Greek","English"],
  "Guatemala": ["Spanish"],
  "Hong Kong": ["English","Chinese (Traditional)"],
  "Hungary": ["Hungarian"],
  "India": ["English","Hindi"],
  "Indonesia": ["English","Indonesian"],
  "Ireland": ["English"],
  "Israel": ["Hebrew","Arabic"],
  "Italy": ["Italian"],
  "Japan": ["Japanese"],
  "Jordan": ["Arabic"],
  "Kazakhstan": ["Russian"],
  "Kenya": ["English"],
  "Latvia": ["Latvian"],
  "Lithuania": ["Lithuanian"],
  "Malaysia": ["English","Malay"],
  "Malta": ["English"],
  "Mexico": ["Spanish"],
  "Moldova": ["Romanian"],
  "Monaco": ["French"],
  "Morocco": ["Arabic","French"],
  "Myanmar (Burma)": ["English"],
  "Netherlands": ["Dutch"],
  "New Zealand": ["English"],
  "Nicaragua": ["Spanish"],
  "Nigeria": ["English"],
  "North Macedonia": ["Macedonian"],
  "Norway": ["Norwegian (Bokmål)"],
  "Pakistan": ["English","Urdu"],
  "Panama": ["Spanish"],
  "Paraguay": ["Spanish"],
  "Peru": ["Spanish"],
  "Philippines": ["English","Tagalog"],
  "Poland": ["Polish"],
  "Portugal": ["Portuguese"],
  "Romania": ["Romanian"],
  "Saudi Arabia": ["Arabic","English"],
  "Senegal": ["French"],
  "Serbia": ["Serbian"],
  "Singapore": ["English","Chinese (Simplified)"],
  "Slovakia": ["Slovak"],
  "Slovenia": ["Slovenian"],
  "South Africa": ["English"],
  "South Korea": ["Korean"],
  "Spain": ["Spanish"],
  "Sri Lanka": ["English"],
  "Sweden": ["Swedish"],
  "Switzerland": ["German","French","Italian"],
  "Taiwan": ["Chinese (Traditional)"],
  "Thailand": ["Thai"],
  "Tunisia": ["Arabic"],
  "Turkiye": ["Turkish"],
  "Ukraine": ["Ukrainian","Russian"],
  "United Arab Emirates": ["Arabic","English"],
  "United Kingdom": ["English"],
  "United States": ["English","Spanish"],
  "Uruguay": ["Spanish"],
  "Venezuela": ["Spanish"],
  "Vietnam": ["English","Vietnamese"],};

/**
 * Where a language's keywords are looked up when the website's own country
 * does not offer it: the largest search market for that language, which for a
 * business writing in a foreign language is usually the audience it is
 * writing for - an Italian wedding studio writing in English is selling to
 * American and British couples.
 */
const LANGUAGE_HOME: Record<string, string> = {
  English: "United States",
  Spanish: "Spain",
  French: "France",
  German: "Germany",
  Portuguese: "Brazil",
  Italian: "Italy",
  Dutch: "Netherlands",
  Arabic: "Saudi Arabia",
};

export type LabsMarket = {
  location: string;
  language: string;
  /** Why the website's own pair was not used, or null when it was. */
  fallback: string | null;
};

const canonical = (value: string, options: string[]) =>
  options.find((option) => option.toLowerCase() === value.trim().toLowerCase());

/**
 * The pair to send to Labs for a website's country and language.
 *
 * In order: the website's own pair; the same language in its home market; the
 * website's country in its own first language; English in the United States.
 * Every result is a pair Labs accepts.
 */
export function labsMarket(country: string, language: string): LabsMarket {
  const location = canonical(country, Object.keys(LABS_MARKETS));
  const allLanguages = [...new Set(Object.values(LABS_MARKETS).flat())];
  const lang = canonical(language, allLanguages);

  if (location && lang && LABS_MARKETS[location].includes(lang)) {
    return { location, language: lang, fallback: null };
  }

  if (lang) {
    const home =
      LANGUAGE_HOME[lang] ??
      Object.keys(LABS_MARKETS).find((name) => LABS_MARKETS[name].includes(lang));
    if (home && LABS_MARKETS[home]?.includes(lang)) {
      return {
        location: home,
        language: lang,
        fallback: `${lang} keywords are not available for ${country}; using ${home}`,
      };
    }
  }

  if (location) {
    return {
      location,
      language: LABS_MARKETS[location][0],
      fallback: `${language} keywords are not available anywhere; using ${location}'s own language`,
    };
  }

  return {
    location: "United States",
    language: "English",
    fallback: `${country} / ${language} is not a supported market; using United States / English`,
  };
}
