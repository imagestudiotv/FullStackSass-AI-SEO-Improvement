/**
 * Languages articles can be written in.
 *
 * The field was free text, which meant "Spanish", "spanish", "Español" and
 * "Spansh" all reached the prompt as-is. The first three work by luck; the
 * fourth quietly produces an English article, and the customer has no way to
 * tell why.
 *
 * Stored as the English name rather than an ISO code because that string goes
 * straight into a prompt, where "Spanish" is a clearer instruction than "es".
 *
 * This list is not a limit on what the model can write — it is the set we are
 * willing to say we support. The brief named Spanish, French, Italian and
 * German; the rest are here because they cost nothing to include and a
 * customer who needs one would otherwise be blocked entirely.
 */

export type SupportedLanguage = {
  /** Stored value, and the word used in the prompt. */
  value: string;
  /** Shown in the picker: the name in its own language, then in English. */
  label: string;
};

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { value: "English", label: "English" },
  { value: "Spanish", label: "Español (Spanish)" },
  { value: "French", label: "Français (French)" },
  { value: "Italian", label: "Italiano (Italian)" },
  { value: "German", label: "Deutsch (German)" },
  { value: "Portuguese", label: "Português (Portuguese)" },
  { value: "Dutch", label: "Nederlands (Dutch)" },
  { value: "Polish", label: "Polski (Polish)" },
];

/**
 * Maps a stored or detected value onto a supported language.
 *
 * Detection returns free text and older rows hold whatever was typed, so this
 * accepts common spellings and native names. Returns null when nothing matches
 * rather than guessing — a wrong guess writes an article in the wrong
 * language, which is worse than falling back to the default.
 */
const ALIASES: Record<string, string> = {
  english: "English",
  en: "English",
  spanish: "Spanish",
  espanol: "Spanish",
  "español": "Spanish",
  es: "Spanish",
  french: "French",
  francais: "French",
  "français": "French",
  fr: "French",
  italian: "Italian",
  italiano: "Italian",
  it: "Italian",
  german: "German",
  deutsch: "German",
  de: "German",
  portuguese: "Portuguese",
  "português": "Portuguese",
  portugues: "Portuguese",
  pt: "Portuguese",
  dutch: "Dutch",
  nederlands: "Dutch",
  nl: "Dutch",
  polish: "Polish",
  polski: "Polish",
  pl: "Polish",
};

export function normalizeLanguage(value: string | null): string | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  if (!key) return null;
  return ALIASES[key] ?? null;
}

/** True when a value is one we support exactly. */
export function isSupportedLanguage(value: string | null): boolean {
  return SUPPORTED_LANGUAGES.some((lang) => lang.value === value);
}
