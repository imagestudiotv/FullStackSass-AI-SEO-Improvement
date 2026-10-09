import { plainText } from "@/lib/blog/shared";

/**
 * A blog post's search fields (client, 2026-10-08): an optional SEO title,
 * a primary keyword, secondary keywords and a breadcrumb label, written in
 * Admin -> Blog beside the description.
 *
 * WHERE THE KEYWORDS GO. The client asked how they are best reflected on the
 * live page. Search engines rank the words readers see - the title, the
 * headings, the text - and have ignored a "keywords" meta tag for years;
 * hidden or repeated copy is a spam signal. So the keywords are never added
 * to the page as text. They are listed in the post's structured data
 * (BlogPosting "keywords"), and in the editor they drive the checks below,
 * which show where the writing already uses them.
 *
 * Shared by the editor (browser) and the server's save (lib/admin/blog.ts),
 * so a limit is the same on both sides.
 */

export const SEARCH_LIMITS = {
  /** Stored length. Search results show about SEO_TITLE_TARGET of it. */
  seoTitle: 200,
  keyword: 150,
  secondaryKeywords: 30,
  breadcrumb: 100,
};

/** About what a search result shows of a title before cutting it off. */
export const SEO_TITLE_TARGET = 60;

/**
 * The secondary keywords as typed in the editor's one field: separated by
 * commas, spaces tidied, empty entries and repeats (any letter case, or the
 * primary keyword again) dropped, first spelling kept.
 */
export function secondaryKeywordList(values: readonly string[], primary = ""): string[] {
  const seen = new Set([primary.trim().replace(/\s+/g, " ").toLowerCase()].filter(Boolean));
  const list: string[] = [];
  for (const value of values) {
    const keyword = String(value ?? "").trim().replace(/\s+/g, " ");
    const key = keyword.toLowerCase();
    if (!keyword || seen.has(key)) continue;
    seen.add(key);
    list.push(keyword);
  }
  return list;
}

/** The editor's field split into entries; an emptied field is no entries, not one empty one. */
export function splitKeywords(field: string): string[] {
  return field.trim() === "" ? [] : field.split(",");
}

/**
 * Text reduced to lower-case words, accents and punctuation gone, so
 * "Café SEO" is found in "cafe-seo" and in "…the café: SEO…".
 */
function words(text: string): string {
  return ` ${text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()} `;
}

/** Whole-word match: "seo" is not found in "seoul". */
function contains(haystack: string, keyword: string): boolean {
  const needle = words(keyword);
  return needle.trim() !== "" && words(haystack).includes(needle);
}

/** How often the phrase is used, whole words only. */
function occurrences(haystack: string, keyword: string): number {
  const needle = words(keyword);
  if (needle.trim() === "") return 0;
  const text = words(haystack);
  let count = 0;
  // Each match's closing space can open the next one: "seo seo" is two.
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + needle.length - 1)) count += 1;
  return count;
}

export type KeywordPlacement = { id: string; label: string; found: boolean };

export type KeywordReport = {
  /** Where the primary keyword appears; empty while there is none. */
  primary: KeywordPlacement[];
  /** Times the primary keyword is used in the text (short answer, body, FAQ answers). */
  primaryUses: number;
  /** Each secondary keyword, and whether the text uses it. */
  secondary: { keyword: string; found: boolean }[];
};

/**
 * Where a post's keywords appear: the places a reader and a search engine
 * look first. Guidance for the writer only - nothing here changes the page.
 */
export function keywordReport(post: {
  title: string;
  seoTitle?: string | null;
  description: string;
  slug: string;
  shortAnswer: string;
  bodyHtml: string;
  faqs: { question: string; answer: string }[];
  primaryKeyword?: string | null;
  secondaryKeywords?: readonly string[];
}): KeywordReport {
  const body = plainText(post.bodyHtml);
  const text = [post.shortAnswer, body, ...post.faqs.flatMap((faq) => [faq.question, plainText(faq.answer)])].join("\n");
  // The opening a reader sees first: the short answer, else the text's first paragraph.
  const opening = post.shortAnswer.trim() || body.split("\n")[0] || "";
  const subheadings = [...post.bodyHtml.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((match) => plainText(match[1]));
  const primary = (post.primaryKeyword ?? "").trim();

  return {
    primary: primary
      ? [
          { id: "search-title", label: "Search title", found: contains(post.seoTitle?.trim() || post.title, primary) },
          { id: "heading", label: "Article title (H1)", found: contains(post.title, primary) },
          { id: "description", label: "Description", found: contains(post.description, primary) },
          { id: "address", label: "Address", found: contains(post.slug, primary) },
          { id: "opening", label: "Opening paragraph", found: contains(opening, primary) },
          { id: "subheading", label: "A subheading (H2)", found: subheadings.some((heading) => contains(heading, primary)) },
        ]
      : [],
    primaryUses: primary ? occurrences(text, primary) : 0,
    secondary: secondaryKeywordList(post.secondaryKeywords ?? [], primary).map((keyword) => ({
      keyword,
      found: contains(text, keyword),
    })),
  };
}
