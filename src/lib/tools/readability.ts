import * as cheerio from "cheerio";

import { InvalidUrlError, isPublicWebsiteUrl, normalizeWebsiteUrl } from "@/lib/websites/url";

/**
 * Two checks that both need the raw HTML of one page.
 *
 * Keyword density — what a page actually talks about, which is often not what
 * its owner thinks. Useful for catching a page that never once says the thing
 * someone would search for.
 *
 * LLM readability — how much of the page survives with JavaScript switched
 * off. This is the one that matters for AI: assistants read the HTML that
 * comes back from the server, so a site that renders its content client-side
 * is invisible to them however good it looks in a browser.
 */

const TIMEOUT_MS = 12_000;
const MAX_BYTES = 3_000_000;

/**
 * Words too common to be worth reporting.
 *
 * Without this the top terms for every English page are "the", "and", "to".
 * Deliberately short — an aggressive list would strip words that genuinely
 * matter to some businesses.
 */
const STOP_WORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "any", "can", "her",
  "was", "one", "our", "out", "day", "get", "has", "him", "his", "how", "its",
  "new", "now", "old", "see", "two", "way", "who", "boy", "did", "use", "with",
  "that", "this", "from", "they", "will", "your", "have", "what", "when",
  "there", "their", "would", "about", "which", "were", "been", "more", "into",
  "some", "than", "then", "them", "these", "those", "here", "just", "also",
  "only", "over", "such", "very", "much", "most", "other", "after", "before",
  "because", "while", "where", "each", "make", "made", "like", "want", "need",
  "https", "http", "www", "com",
]);

export type KeywordCount = {
  term: string;
  count: number;
  /** Share of all counted words, as a percentage. */
  density: number;
};

export type ReadabilityResult = {
  domain: string;
  finalUrl: string;

  /* --- keyword density ------------------------------------------------ */
  wordCount: number;
  topWords: KeywordCount[];
  topPhrases: KeywordCount[];

  /* --- LLM readability ------------------------------------------------ */
  htmlBytes: number;
  /** Characters of visible text an assistant would actually read. */
  textChars: number;
  /** Text as a share of the whole document, as a percentage. */
  textRatio: number;
  /** True when the page carries almost no server-rendered text. */
  needsJavaScript: boolean;
  /** Structural signals an assistant uses to understand a page. */
  structure: {
    title: string | null;
    h1: string | null;
    headings: number;
    paragraphs: number;
    /** JSON-LD blocks, which state facts about the page unambiguously. */
    structuredData: number;
    images: number;
    imagesWithAlt: number;
  };
};

export type ReadabilityOutcome =
  | { ok: true; result: ReadabilityResult }
  | { ok: false; error: string };

/** Words and phrases listed in the UI. */
const TERMS_SHOWN = 12;

/** Below this share of text, a page is effectively empty without JavaScript. */
const JS_REQUIRED_RATIO = 1.5;

/** Splits text into comparable words. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    // Keep letters, digits and internal apostrophes; everything else splits.
    .split(/[^\p{L}\p{N}']+/u)
    .map((word) => word.replace(/^'+|'+$/g, ""))
    .filter((word) => word.length > 2);
}

function countTerms(
  terms: string[],
  total: number,
  limit: number,
): KeywordCount[] {
  const counts = new Map<string, number>();
  for (const term of terms) {
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term, count]) => ({
      term,
      count,
      density: total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0,
    }));
}

export async function checkReadability(
  input: string,
): Promise<ReadabilityOutcome> {
  let normalized;
  try {
    normalized = normalizeWebsiteUrl(input);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof InvalidUrlError
          ? error.message
          : "Enter a valid website address",
    };
  }

  if (!isPublicWebsiteUrl(normalized.url)) {
    return { ok: false, error: "That address is not publicly reachable." };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let html: string;
  let finalUrl: string;
  try {
    const response = await fetch(normalized.url, {
      signal: controller.signal,
      headers: {
        "user-agent": "SEOVisionBot/1.0",
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `That page returned ${response.status} instead of loading.`,
      };
    }
    const buffer = await response.arrayBuffer();
    html = new TextDecoder().decode(buffer.slice(0, MAX_BYTES));
    finalUrl = response.url || normalized.url;
  } catch {
    return {
      ok: false,
      error: "We could not reach that page. Check the address and try again.",
    };
  } finally {
    clearTimeout(timer);
  }

  const htmlBytes = new TextEncoder().encode(html).length;
  const $ = cheerio.load(html);

  // Counted before stripping — JSON-LD lives in a script tag.
  const structuredData = $('script[type="application/ld+json"]').length;

  const title = $("title").first().text().trim() || null;

  $("script, style, noscript, template, svg").remove();

  const h1 = $("h1").first().text().trim().replace(/\s+/g, " ") || null;
  const headings = $("h1, h2, h3, h4, h5, h6").length;
  const paragraphs = $("p").length;
  const images = $("img").length;
  const imagesWithAlt = $("img[alt]").filter((_, el) => {
    const alt = $(el).attr("alt");
    return Boolean(alt && alt.trim());
  }).length;

  /**
   * A space after every block-level tag before reading the text.
   *
   * cheerio's .text() concatenates without separators, so markup like
   * "<a>Developers</a><a>Source code</a>" comes back as "DevelopersSource
   * code" — which then counts as the phrase "developerssource code". Real
   * enough to look like a finding, and entirely an artefact of our parsing.
   */
  $("body")
    .find("br, p, div, li, td, th, tr, section, article, header, footer, nav, h1, h2, h3, h4, h5, h6, a, span, button, label")
    .after(" ");

  const text = $("body").text().replace(/\s+/g, " ").trim();
  const textChars = text.length;
  const textRatio =
    htmlBytes > 0 ? Number(((textChars / htmlBytes) * 100).toFixed(1)) : 0;

  const words = tokenize(text);
  const meaningful = words.filter((word) => !STOP_WORDS.has(word));

  /**
   * Two-word phrases, built from the ORIGINAL word order so the pairs are real
   * adjacent phrases. Pairs where both halves are stop words are dropped —
   * "of the" is not a finding — but a pair with one is kept, since "for
   * dentists" is exactly the kind of phrase that matters.
   */
  const phrases: string[] = [];
  for (let i = 0; i < words.length - 1; i += 1) {
    const first = words[i];
    const second = words[i + 1];
    if (STOP_WORDS.has(first) && STOP_WORDS.has(second)) continue;
    phrases.push(`${first} ${second}`);
  }

  return {
    ok: true,
    result: {
      domain: normalized.domain,
      finalUrl,
      wordCount: words.length,
      topWords: countTerms(meaningful, words.length, TERMS_SHOWN),
      topPhrases: countTerms(phrases, Math.max(phrases.length, 1), TERMS_SHOWN),
      htmlBytes,
      textChars,
      textRatio,
      // A real page with content always clears this comfortably.
      needsJavaScript: textRatio < JS_REQUIRED_RATIO || words.length < 50,
      structure: {
        title,
        h1,
        headings,
        paragraphs,
        structuredData,
        images,
        imagesWithAlt,
      },
    },
  };
}
