import "server-only";

import { sanitizeHtml } from "@/lib/articles/sanitize";
import { blogSlug, FAQ_ANSWER_LIMIT, hasText, TEAM_AUTHOR, type BlogCategory, type BlogFaq, type BlogSource } from "@/lib/blog/shared";
import { SEARCH_LIMITS, secondaryKeywordList } from "@/lib/blog/keywords";
import { siteUrl } from "@/lib/site-url";

/**
 * The rules every blog post's fields pass before they are stored - the same
 * whether an administrator saves the post (lib/admin/blog.ts) or the blog
 * autopilot writes it (lib/blog/autopilot). Moved out of the admin actions
 * so a background job can use them: a "use server" module may only export
 * actions, and every one of those checks for a signed-in administrator.
 */
export type BlogPostInput = {
  title: string;
  /** Empty: made from the title. */
  slug: string;
  description: string;
  /** Empty: the browser and search title is the title (lib/blog/keywords.ts). */
  seoTitle: string;
  primaryKeyword: string;
  /** As typed: tidied, and repeats dropped, on save. */
  secondaryKeywords: string[];
  /** Empty: the breadcrumb ends with the title. */
  breadcrumbLabel: string;
  category: string;
  author: string;
  shortAnswer: string;
  bodyHtml: string;
  faqs: BlogFaq[];
  sources: BlogSource[];
  /** The language, for a new post only (lib/blog/locale.ts); empty is English. A post keeps its language. */
  locale?: string;
};

/** Paths under /blog that are not posts. */
export const RESERVED_SLUGS = new Set(["category", "author", "sponsorship"]);

/** A rule the post breaks, in words for the administrator (or the autopilot's run log). */
export class BlogPostError extends Error {}

/** Links to RepGet's own site stay followed internal links (see sanitize.ts). */
export function blogSiteHosts(): Set<string> {
  const host = new URL(siteUrl()).hostname.toLowerCase();
  return new Set([host, host.startsWith("www.") ? host.slice(4) : `www.${host}`]);
}

export type CleanBlogPost = {
  title: string;
  slug: string;
  description: string;
  seoTitle: string | null;
  primaryKeyword: string | null;
  secondaryKeywords: string[];
  breadcrumbLabel: string | null;
  category: BlogCategory;
  author: string;
  shortAnswer: string | null;
  bodyHtml: string;
  faqs: BlogFaq[];
  sources: BlogSource[];
};

/** Validates and tidies what the editor sent; `publishing` also requires what a live post needs. */
export function cleanBlogPost(input: BlogPostInput, publishing: boolean): CleanBlogPost {
  const title = String(input.title ?? "").trim().slice(0, 200);
  if (!title) throw new BlogPostError("Give the post a title");

  const slug = blogSlug(String(input.slug ?? "").trim() || title);
  if (!slug) throw new BlogPostError("Give the post an address (slug) with letters or numbers");
  if (RESERVED_SLUGS.has(slug)) throw new BlogPostError(`"${slug}" is used by the blog itself - choose another address`);

  // That it exists is checked when saving, with the category row locked (saveBlogPost).
  const category = String(input.category ?? "").trim();
  if (!category) throw new BlogPostError("Choose a category");

  const description = String(input.description ?? "").trim().slice(0, 300);

  const primaryKeyword = oneLine(input.primaryKeyword).slice(0, SEARCH_LIMITS.keyword);
  const secondaryKeywords = secondaryKeywordList(Array.isArray(input.secondaryKeywords) ? input.secondaryKeywords : [], primaryKeyword);
  // Refused rather than cut, like the FAQs: dropping the 31st phrase would lose one the writer meant to keep.
  if (secondaryKeywords.length > SEARCH_LIMITS.secondaryKeywords) {
    throw new BlogPostError(
      `Up to ${SEARCH_LIMITS.secondaryKeywords} secondary keywords - this post has ${secondaryKeywords.length}. Remove some before saving.`,
    );
  }
  const tooLong = secondaryKeywords.find((keyword) => keyword.length > SEARCH_LIMITS.keyword);
  if (tooLong) {
    throw new BlogPostError(`The secondary keyword "${tooLong.slice(0, 40)}…" is too long - keep each one under ${SEARCH_LIMITS.keyword} characters`);
  }
  const bodyHtml = sanitizeHtml(String(input.bodyHtml ?? ""), { siteHosts: blogSiteHosts() });

  const faqRows = Array.isArray(input.faqs) ? input.faqs.slice(0, 30) : [];
  const faqs: BlogFaq[] = [];
  for (const [index, faq] of faqRows.entries()) {
    const question = String(faq?.question ?? "").trim().slice(0, 300);
    const answer = sanitizeHtml(String(faq?.answer ?? "").trim(), { siteHosts: blogSiteHosts() });
    // An answer without a word in it ("<p></p>" from an emptied editor) is no answer.
    if (!question && !hasText(answer)) continue;
    if (!question || !hasText(answer)) throw new BlogPostError("Each FAQ needs both a question and an answer");
    /*
      Refused rather than cut. Cutting at the limit never happened while
      answers came from a textarea with a maxLength; they are the editor's
      HTML now, and the sanitiser neither closes tags nor removes half of
      one: a cut through '<a href="…' would keep the fragment, which on the
      page runs on into the FAQs after it, and a cut before a closing
      </strong> would make the rest of the page bold.

      Measured as stored, not as written. The sanitiser can lengthen what the
      editor writes (each <br> becomes <br />), so an answer written just
      under the limit was stored over it, and from then on every save of the
      post - even one that left the answer alone - was refused. Sanitising
      what is stored changes nothing, so a stored answer always passes again.
      The editor counts the same form (previewHtml) and warns first.
    */
    if (answer.length > FAQ_ANSWER_LIMIT) {
      throw new BlogPostError(
        `The answer to question ${index + 1} is too long: ${answer.length} characters with its formatting, and the limit is ${FAQ_ANSWER_LIMIT}. Shorten it or split it into two questions.`,
      );
    }
    faqs.push({ question, answer });
  }

  const sourceRows = Array.isArray(input.sources) ? input.sources.slice(0, 30) : [];
  const sources: BlogSource[] = [];
  for (const source of sourceRows) {
    const label = String(source?.label ?? "").trim().slice(0, 200);
    const url = String(source?.url ?? "").trim();
    if (!label && !url) continue;
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BlogPostError(`"${url || label}" is not a web address - sources need a full address starting with https://`);
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new BlogPostError(`"${url}" is not a web address - sources need a full address starting with https://`);
    }
    sources.push({ label: label || parsed.hostname, url: parsed.toString() });
  }

  if (publishing) {
    if (!description) throw new BlogPostError("Add a description before publishing - search results and the blog's cards show it");
    if (!hasText(bodyHtml)) throw new BlogPostError("The post has no text yet");
  }

  return {
    title,
    slug,
    description,
    seoTitle: oneLine(input.seoTitle).slice(0, SEARCH_LIMITS.seoTitle) || null,
    primaryKeyword: primaryKeyword || null,
    secondaryKeywords,
    breadcrumbLabel: oneLine(input.breadcrumbLabel).slice(0, SEARCH_LIMITS.breadcrumb) || null,
    category,
    author: oneLine(input.author).slice(0, 100) || TEAM_AUTHOR,
    shortAnswer: String(input.shortAnswer ?? "").trim().slice(0, 1000) || null,
    bodyHtml,
    faqs,
    sources,
  };
}

/** A one-line field: trimmed, inner runs of spaces made one. */
export function oneLine(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

/** True for Postgres's unique-violation error, however the driver wraps it. */
export function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string; cause?: { code?: string } } | null)?.code ?? (error as { cause?: { code?: string } } | null)?.cause?.code;
  return code === "23505";
}

