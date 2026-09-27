/**
 * Word matching for internal links: which of a site's pages an article is
 * about, and which phrase in the article can carry the link.
 *
 * Pure, with no database or network, so the HTML pass and the tests can use
 * it on their own.
 *
 * Unicode-aware. The first version kept only [a-z0-9], so "città" split into
 * "citt" and "à", and a Spanish or Italian site matched on fragments. Letters
 * and digits from any script count as word characters now.
 */

/**
 * Words too common to signal that two pages are about the same thing.
 * Matching on these produces links between unrelated pages.
 */
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "for", "of", "to", "in", "on", "at",
  "by", "with", "from", "as", "is", "are", "was", "were", "be", "been", "it",
  "its", "this", "that", "these", "those", "you", "your", "we", "our", "how",
  "what", "why", "when", "where", "which", "who", "can", "do", "does", "will",
  "best", "top", "guide", "tips", "new", "more", "most", "about", "home",
  "page", "html", "index",
]);

/** Distinctive words in a phrase, lowercased and de-duplicated. */
export function keyWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .split(/[\s-]+/)
      .filter((word) => [...word].length > 3 && !STOP_WORDS.has(word)),
  );
}

/** Distinctive words shared by two phrases (or word sets). */
export function overlap(a: string | Set<string>, b: string | Set<string>): number {
  const wordsA = typeof a === "string" ? keyWords(a) : a;
  const wordsB = typeof b === "string" ? keyWords(b) : b;
  let shared = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) shared += 1;
  }
  return shared;
}

/**
 * The words in a URL's path: "/it/servizi/foto-matrimonio/" reads as
 * "it servizi foto matrimonio". Used to judge a page that has no known title
 * yet, such as a sitemap entry, and whether a redirect landed somewhere
 * related. Never used to BUILD a URL.
 */
export function pathWords(url: string): string {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return "";
  }
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // A malformed escape: read the path as written.
  }
  return decoded.replace(/\.[a-z0-9]+$/i, "").replace(/[/_.+-]+/g, " ").trim();
}

/** A match for `word` as a whole word, in any script. */
export function wholeWord(word: string): RegExp {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu");
}
