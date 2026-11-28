import { availableEngineIds, DEFAULT_GEO_ENGINES, engineName, uncheckedEngineIds } from "@/lib/geo/engines";
import type { Locale } from "@/lib/i18n/config";

/**
 * The assistants the AI visibility check asks, in the visitor's language,
 * for the public pages (owner review, 2026-11-28: the landing, pricing FAQ,
 * feature page and home copy said "ChatGPT, Gemini, Claude" in five
 * languages whatever this deployment asks, so it over-claimed the moment a
 * key was missing or GEO_ENGINES narrowed the list).
 *
 * Copy writes {assistants} where the names go and {notChecked} where the
 * assistants left out go; the server fills them in from lib/geo/engines.ts.
 * Sentences are written so they read right for one assistant or three (the
 * names are an object: "RepGet asks {assistants}..."), and {notChecked} is
 * always two or more (Perplexity and Google's AI results are never asked).
 *
 * SERVER ONLY in practice: it reads environment variables, which a browser
 * bundle does not have. Client components are given the filled-in words.
 */

type Env = Record<string, string | undefined>;

const AND: Record<Locale, string> = { en: "and", es: "y", fr: "et", it: "e", de: "und" };

/** Google AI Overview and AI Mode, as the copy has always called them. */
const GOOGLE_AI: Record<Locale, string> = {
  en: "Google's AI results",
  es: "los resultados con IA de Google",
  fr: "les résultats IA de Google",
  it: "i risultati IA di Google",
  de: "die KI-Ergebnisse von Google",
};

/** "A", "A and B", "A, B and C", with the language's "and". */
export function joinWords(words: readonly string[], locale: Locale): string {
  if (words.length <= 1) return words[0] ?? "";
  return `${words.slice(0, -1).join(", ")} ${AND[locale]} ${words[words.length - 1]}`;
}

/**
 * The names of the assistants asked: ["Claude"], ["Claude", "ChatGPT", "Gemini"].
 * A deployment with no key at all (a preview, a laptop) asks nothing; its
 * pages describe the default set rather than print an empty list.
 */
export function assistantNames(env: Env = process.env): string[] {
  const ids = availableEngineIds(env);
  return (ids.length > 0 ? ids : DEFAULT_GEO_ENGINES).map(engineName);
}

/** "Claude", "Claude, ChatGPT y Gemini". */
export function assistantWords(locale: Locale, env: Env = process.env): string {
  return joinWords(assistantNames(env), locale);
}

/** "ChatGPT, Gemini, Perplexity and Google's AI results": what is NOT asked. */
export function notCheckedWords(locale: Locale, env: Env = process.env): string {
  const asked = assistantNames(env);
  const names = uncheckedEngineIds(env)
    .filter((id) => id !== "google-ai-overview")
    .map(engineName)
    .filter((name) => !asked.includes(name));
  return joinWords([...names, GOOGLE_AI[locale]], locale);
}

/** Fills {assistants} and {notChecked} in every string of a copy object, leaving the rest as it is. */
export function withAssistants<T>(copy: T, locale: Locale, env: Env = process.env): T {
  const assistants = assistantWords(locale, env);
  const notChecked = notCheckedWords(locale, env);
  const fill = (value: unknown): unknown => {
    if (typeof value === "string") {
      return value.includes("{") ? value.replaceAll("{assistants}", assistants).replaceAll("{notChecked}", notChecked) : value;
    }
    if (Array.isArray(value)) return value.map(fill);
    if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fill(item)]));
    }
    return value;
  };
  return fill(copy) as T;
}
