import type { SiteType } from "./score";

/**
 * Whether a website sells something or lives from its readers, read from the
 * profile analysis already wrote (industry, description, services).
 *
 * Inferred on every research run rather than stored: nothing else needs it
 * yet, and a profile the customer edits is then always read as it is now. The
 * intent step (lib/keywords/intent.ts) asks the model the same question with
 * the same profile and its answer wins; this is the answer when that step
 * does not run (no provider rows to classify, or no model).
 *
 * Words in the languages RepGet's customers write in, and the Slavic ones the
 * first publisher customer used (2026-11-27, a Ukrainian greetings site).
 * Stems, matched at the start of a word, so "magazine" and "magazines",
 * "журнал" and "журналу" all count.
 */
const PUBLISHER = [
  // English
  "blog", "magazine", "news", "newspaper", "publisher", "publishing", "media outlet", "online media",
  "content site", "editorial", "journal", "webzine", "e-zine", "information portal", "info portal",
  "recipes", "greetings", "wishes", "horoscope", "reviews site", "affiliate", "entertainment portal",
  // Spanish, French, Italian, German, Portuguese, Polish, Romanian
  "revista", "periódico", "periodico", "noticias", "notícias", "portal de", "bloguero",
  "actualités", "journal en ligne", "magazine en ligne", "média", "rivista", "notizie", "giornale",
  "nachrichten", "zeitschrift", "zeitung", "ratgeberportal", "online-magazin", "czasopismo",
  "wiadomości", "serwis informacyjny", "portal informacyjny", "știri", "stiri", "revistă",
  // Ukrainian, Russian, Bulgarian, Serbian
  "блог", "журнал", "новин", "новост", "видання", "издание", "медіа", "медиа", "портал",
  "інформаційн", "информационн", "привітан", "поздравлен", "статті", "статьи", "рецепт", "гороскоп",
  "списание", "вести", "часопис",
];

/** Things only a business has: a sale, a booking, a quote. */
const BUSINESS = [
  "shop", "store", "e-commerce", "ecommerce", "agency", "clinic", "studio", "law firm", "restaurant",
  "hotel", "booking", "consultancy", "manufacturer", "installer", "contractor", "saas", "software company",
  "tienda", "agencia", "clínica", "boutique", "cabinet", "agenzia", "negozio", "laden", "agentur",
  "praxis", "sklep", "magazin online", "магазин", "агентство", "клініка", "клиника", "послуги", "услуги",
];

function mentions(text: string, words: string[]): number {
  return words.filter((word) => new RegExp(`(?:^|[^\\p{L}])${escape(word)}`, "iu").test(text)).length;
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function inferSiteType(profile: {
  industry: string | null;
  description: string | null;
  services?: string[] | null;
}): SiteType {
  const text = [profile.industry, profile.description, ...(profile.services ?? [])]
    .filter((part): part is string => typeof part === "string" && part.trim() !== "")
    .join(" \n ")
    .normalize("NFC");
  if (!text) return "business";
  const publisher = mentions(text, PUBLISHER);
  const business = mentions(text, BUSINESS);
  // The industry line is the profile's own verdict: it counts double.
  const industryPublisher = profile.industry ? mentions(profile.industry.normalize("NFC"), PUBLISHER) : 0;
  return publisher + industryPublisher > business ? "publisher" : "business";
}
