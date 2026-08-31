import { and, eq, isNotNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { articles, pages } from "@/lib/db/schema";

/**
 * Internal linking.
 *
 * The audit already reports pages that nothing links to; it has never been able
 * to fix them. This adds the links, which is the half customers are paying for.
 *
 * Links are inserted AFTER generation rather than requested in the prompt. Asked
 * to add links itself, the model invents plausible URLs that do not exist —
 * broken links on a customer's live site are worse than no links, and there is
 * no reliable way to talk a model out of it. Here every href comes from a row
 * we crawled, so a link either exists or is never written.
 *
 * Matching is by title and keyword overlap. The pages table has an embedding
 * column, but nothing populates it (that needs an embedding provider we do not
 * have a key for), so semantic matching is not available. Overlap is cruder but
 * it is honest about what it knows, and it never invents a target.
 */

/** Links added to one article. Beyond this, a page reads as spam. */
const MAX_LINKS = 4;

/** A candidate must share at least this many distinctive words to qualify. */
const MIN_OVERLAP = 2;

export type LinkTarget = {
  url: string;
  title: string;
  /** How many distinctive words this target shares with the article. */
  score: number;
};

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
]);

/** Distinctive words in a phrase, lowercased and de-duplicated. */
export function keyWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/[\s-]+/)
      .filter((word) => word.length > 3 && !STOP_WORDS.has(word)),
  );
}

/** Distinctive words shared by two phrases. */
export function overlap(a: string, b: string): number {
  const wordsB = keyWords(b);
  let shared = 0;
  for (const word of keyWords(a)) {
    if (wordsB.has(word)) shared += 1;
  }
  return shared;
}

/**
 * Finds pages on the customer's own site worth linking to from this article.
 *
 * Ranked by shared words, and anything under MIN_OVERLAP is dropped entirely
 * rather than padded out to fill MAX_LINKS. A weak link is worse than no link:
 * it dilutes the page and reads as filler to both search engines and readers.
 */
export async function findLinkTargets(
  websiteId: string,
  articleTitle: string,
  targetKeyword: string | null,
  excludeUrl: string | null,
): Promise<LinkTarget[]> {
  const crawled = await db
    .select({ url: pages.url, title: pages.title })
    .from(pages)
    .where(and(eq(pages.websiteId, websiteId), isNotNull(pages.title)));

  /**
   * Published articles are candidates too, so a site's own content links to
   * itself as the library grows — the compounding effect customers expect.
   */
  const published = await db
    .select({ url: articles.publishedUrl, title: articles.title })
    .from(articles)
    .where(
      and(
        eq(articles.websiteId, websiteId),
        eq(articles.status, "published"),
        isNotNull(articles.publishedUrl),
      ),
    );

  const subject = `${articleTitle} ${targetKeyword ?? ""}`;
  const seen = new Set<string>();
  const candidates: LinkTarget[] = [];

  for (const row of [...crawled, ...published]) {
    if (!row.url || !row.title) continue;
    // Never link a page to itself, and never link the same target twice.
    if (excludeUrl && row.url === excludeUrl) continue;
    if (seen.has(row.url)) continue;
    seen.add(row.url);

    const score = overlap(subject, row.title);
    if (score >= MIN_OVERLAP) {
      candidates.push({ url: row.url, title: row.title, score });
    }
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, MAX_LINKS);
}

/** Escapes a string for safe use inside a regular expression. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** HTML-escapes an attribute value. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Inserts links into article HTML.
 *
 * Anchor text is an existing phrase in the body, not text we add: rewriting a
 * sentence to fit a link changes the customer's copy, and a link that reads as
 * bolted on is worse for the reader than no link.
 *
 * Only the FIRST occurrence of a phrase is linked, and only inside a paragraph.
 * Linking every occurrence produces the over-optimised look search engines
 * penalise, and linking inside a heading breaks the page outline.
 */
export function insertLinks(html: string, targets: LinkTarget[]): string {
  let result = html;
  let inserted = 0;

  for (const target of targets) {
    if (inserted >= MAX_LINKS) break;

    /**
     * Longest words first: a specific phrase makes better anchor text than a
     * single common word, and reads more naturally to a human.
     */
    const phrases = [...keyWords(target.title)].sort(
      (a, b) => b.length - a.length,
    );

    for (const phrase of phrases) {
      /**
       * Matched only in body text: the negative lookahead skips anything
       * already inside a tag or an existing anchor, so links are never nested
       * and attributes are never corrupted.
       */
      const pattern = new RegExp(
        `(<p>(?:(?!</p>|<a\\b).)*?)\\b(${escapeRegExp(phrase)})\\b`,
        "i",
      );

      if (!pattern.test(result)) continue;

      result = result.replace(
        pattern,
        `$1<a href="${escapeAttr(target.url)}">$2</a>`,
      );
      inserted += 1;
      break;
    }
  }

  return result;
}

/**
 * Adds internal links to an article body.
 *
 * Returns the original HTML unchanged when there is nothing worth linking to —
 * a new site with three crawled pages genuinely has no good targets, and
 * forcing links there would create exactly the low-quality pattern this is
 * meant to avoid.
 */
export async function addInternalLinks(
  websiteId: string,
  articleTitle: string,
  targetKeyword: string | null,
  bodyHtml: string,
  excludeUrl: string | null = null,
): Promise<{ html: string; linked: LinkTarget[] }> {
  const targets = await findLinkTargets(
    websiteId,
    articleTitle,
    targetKeyword,
    excludeUrl,
  );

  if (targets.length === 0) {
    return { html: bodyHtml, linked: [] };
  }

  const html = insertLinks(bodyHtml, targets);

  /**
   * Reports only the targets whose URL actually appears in the result. A phrase
   * may not be present in the body, in which case no link was written, and
   * claiming otherwise would misreport what we did to the customer's article.
   */
  const linked = targets.filter((t) => html.includes(`href="${escapeAttr(t.url)}"`));

  return { html, linked };
}
