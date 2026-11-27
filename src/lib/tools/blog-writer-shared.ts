import type { Locale } from "@/lib/i18n/config";

/**
 * The free AI Blog Writer (owner, 2026-11-27, repget-blog-writer-free-preview.html):
 * what the page and the server share. No server imports - the tool's client
 * component uses these.
 *
 * The visitor gives a question their customers ask, a format and one
 * sentence of their own advice; the tool writes a title and an OPENING of
 * 90-140 words, never the article (the owner: "generate something for free,
 * maybe not complete and with popup to sign up for free"). Cheapest first:
 * the browser's own AI, then RepGet's server (lib/tools/blog-writer.ts),
 * then the template below.
 */

export const BLOG_FORMATS = ["guide", "comparison", "checklist"] as const;
export type BlogFormat = (typeof BLOG_FORMATS)[number];

export function isBlogFormat(value: unknown): value is BlogFormat {
  return typeof value === "string" && (BLOG_FORMATS as readonly string[]).includes(value);
}

/** The form's limits (the mockup's maxlength). */
export const MAX_TOPIC_CHARS = 550;
export const MAX_NOTES_CHARS = 1000;
/** The opening asked for, and the most ever shown: an opening, never the article. */
export const OPENING_MIN_WORDS = 90;
export const OPENING_MAX_WORDS = 140;
export const OPENING_HARD_MAX_WORDS = 170;
export const MAX_TITLE_CHARS = 160;

/** The brief kept on this device (the mockup's key and shape). */
export const BRIEF_STORAGE_KEY = "repget:article-brief:v1";
export type StoredBrief = { version: 1; topic: string; format: BlogFormat; notes: string };

export type BlogBrief = { topic: string; format: BlogFormat; notes: string };

export type BlogOpening = { title: string; opening: string };

export type BlogWriterRefusal =
  /** Switched off in Admin -> Free tools. */
  | "disabled"
  /** Today's spend cap for this tool is reached. */
  | "cap"
  /** This visitor's free openings for today are used. */
  | "limit"
  /** Every visitor together: today's openings are used. */
  | "busy"
  /** No AI key, or the quota store cannot be reached. */
  | "unavailable"
  /** The brief is empty or too long. */
  | "invalid"
  /** The model answered with nothing usable, or not at all. */
  | "failed";

export type BlogWriterOutcome = ({ ok: true } & BlogOpening) | { ok: false; reason: BlogWriterRefusal };

/** The format's name in English, for the prompts. */
export const FORMAT_NAMES_EN: Record<BlogFormat, string> = {
  guide: "How-to guide",
  comparison: "Comparison",
  checklist: "Checklist",
};

/** The language's name in English, for the prompts ("an Italian article"). */
export const LANGUAGE_FOR_PROMPT: Record<Locale, { name: string; article: "a" | "an" }> = {
  en: { name: "English", article: "an" },
  es: { name: "Spanish", article: "a" },
  fr: { name: "French", article: "a" },
  it: { name: "Italian", article: "an" },
  de: { name: "German", article: "a" },
};

/** Words that open a question, per language: the template's title gets its question mark. */
const QUESTION_WORDS: Record<Locale, string[]> = {
  en: ["how", "when", "where", "which", "why", "what", "who", "can", "should", "do", "does", "is", "are"],
  es: ["cómo", "como", "cuándo", "cuando", "dónde", "donde", "cuál", "cuáles", "por qué", "qué", "que", "quién", "cuánto", "cuánta", "cuántos", "cuántas", "puedo", "debo", "es", "son"],
  fr: ["comment", "quand", "où", "quel", "quelle", "quels", "quelles", "pourquoi", "que", "qui", "combien", "est-ce", "peut-on", "faut-il", "dois-je"],
  it: ["come", "quando", "dove", "quale", "quali", "perché", "cosa", "che", "chi", "quanto", "quanta", "quanti", "quante", "posso", "devo", "è"],
  de: ["wie", "wann", "wo", "welche", "welcher", "welches", "warum", "was", "wer", "kann", "soll", "sollte", "ist", "sind", "muss"],
};

function collapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function capitalise(text: string, locale: Locale): string {
  return text ? text.charAt(0).toLocaleUpperCase(locale) + text.slice(1) : text;
}

function looksLikeQuestion(text: string, locale: Locale): boolean {
  const lower = text.toLocaleLowerCase(locale).replace(/^¿/, "");
  return QUESTION_WORDS[locale].some((word) => lower === word || lower.startsWith(`${word} `));
}

/** The template's title: the question, capitalised, with its question mark. */
export function templateTitle(topic: string, locale: Locale): string {
  let title = capitalise(collapse(topic).replace(/[.!]+$/, ""), locale);
  if (title && !/[?？]$/.test(title) && looksLikeQuestion(title, locale)) {
    title = `${title}?`;
    if (locale === "es" && !title.startsWith("¿")) title = `¿${title}`;
  }
  return title.slice(0, MAX_TITLE_CHARS);
}

/** The visitor's sentence as the opening's first sentence: capitalised, with a full stop. */
function adviceSentence(notes: string, locale: Locale): string {
  const sentence = capitalise(collapse(notes), locale);
  return /[.!?…。]$/.test(sentence) ? sentence : `${sentence}.`;
}

/**
 * The template-assisted opening (the mockup's fallback, in the page's
 * language): the question as the title, the visitor's own advice, then the
 * format's closing line. `closings` is the copy's.
 */
export function templateOpening(brief: BlogBrief, locale: Locale, closings: Record<BlogFormat, string>): BlogOpening {
  return {
    title: templateTitle(brief.topic, locale),
    opening: `${adviceSentence(brief.notes, locale)} ${closings[brief.format]}`,
  };
}

/** Title and opening in the one editable field. */
export function openingText(opening: BlogOpening): string {
  return `${opening.title}\n\n${opening.opening}`;
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Never more than an opening: at most OPENING_HARD_MAX_WORDS words, cut at
 * the last full sentence inside them when there is one.
 */
export function clampOpening(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= OPENING_HARD_MAX_WORDS) return words.join(" ");
  const cut = words.slice(0, OPENING_HARD_MAX_WORDS).join(" ");
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return end > cut.length / 2 ? cut.slice(0, end + 1) : `${cut}…`;
}

/** Markdown and labels a model may add, removed: plain text only. */
function plain(text: string): string {
  return text
    .replace(/\*\*|__|`/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .trim();
}

const TITLE_LABEL = /^(title|título|titre|titolo|titel)\s*:\s*/i;
const OPENING_LABEL = /^(opening|introduction|intro|introducción|apertura|incipit|einleitung|einstieg)\s*:\s*/i;

/**
 * A model's plain-text answer as a title and an opening: the first line is
 * the title, the rest the opening. Null when either is missing.
 */
export function parseOpeningText(raw: string): BlogOpening | null {
  const lines = plain(raw)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;
  const title = lines[0].replace(TITLE_LABEL, "").replace(/^["“]|["”]$/g, "").trim().slice(0, MAX_TITLE_CHARS);
  const opening = clampOpening(lines.slice(1).join("\n\n").replace(OPENING_LABEL, ""));
  if (!title || wordCount(opening) < 20) return null;
  return { title, opening };
}

/** The brief checked and trimmed, or null when it cannot be written from. */
export function cleanBrief(input: { topic?: unknown; format?: unknown; notes?: unknown } | null | undefined): BlogBrief | null {
  const topic = typeof input?.topic === "string" ? collapse(input.topic) : "";
  const notes = typeof input?.notes === "string" ? collapse(input.notes) : "";
  if (!topic || !notes || topic.length > MAX_TOPIC_CHARS || notes.length > MAX_NOTES_CHARS) return null;
  return { topic, format: isBlogFormat(input?.format) ? input.format : "guide", notes };
}

/**
 * The on-device prompt (the mockup's, word for word, in the page's
 * language): the browser's AI writes only the title and the opening.
 */
export function onDevicePrompt(brief: BlogBrief, locale: Locale): string {
  const language = LANGUAGE_FOR_PROMPT[locale];
  return [
    `Write ${language.article} ${language.name} article title and a ${OPENING_MIN_WORDS}–${OPENING_MAX_WORDS} word opening in plain text.`,
    "Answer the question directly using the supplied experience.",
    "Respect the format.",
    "Avoid invented facts or testimonials.",
    "Return only the title and prose.",
    `Article brief: ${JSON.stringify({ question: brief.topic, format: FORMAT_NAMES_EN[brief.format], experience: brief.notes })}`,
  ].join(" ");
}
