/**
 * The blog's types and pure helpers, shared by the public pages (server), the
 * admin editor and its preview (browser). Reading and writing posts is in
 * lib/blog/posts.ts and lib/admin/blog.ts.
 *
 * Posts used to be TypeScript constants, on the reasoning that a handful of
 * posts did not need a CMS "until a non-developer needs to publish". That
 * point came (2026-09-29): posts now live in blog_posts and administrators
 * write them in the admin panel.
 *
 * The blog exists to be found. Every post carries the fields search engines
 * and social previews actually read: a description, real dates, and a
 * canonical slug that never changes once published - changing a slug breaks
 * every link and discards whatever ranking the post has earned.
 */

/**
 * Sections of the blog.
 *
 * Three, matching how the posts actually differ: an explainer, a comparison,
 * and a step-by-step. More categories than there are posts to fill them makes
 * an index look abandoned, so these stay few until the writing justifies more.
 */
export type BlogCategory = "Guides" | "Comparisons" | "Playbooks";

export const BLOG_CATEGORIES: {
  name: BlogCategory;
  slug: string;
  blurb: string;
}[] = [
  {
    name: "Guides",
    slug: "guides",
    blurb:
      "Plain-English explanations of how search and AI assistants actually work.",
  },
  {
    name: "Comparisons",
    slug: "comparisons",
    blurb: "How the options differ, and which one fits the job you have.",
  },
  {
    name: "Playbooks",
    slug: "playbooks",
    blurb: "Step-by-step work you can do this week, in the order to do it.",
  },
];

export function isBlogCategory(value: string): value is BlogCategory {
  return BLOG_CATEGORIES.some((category) => category.name === value);
}

/** A question and its answer, rendered as an expandable block. */
export type BlogFaq = {
  question: string;
  /** HTML, sanitised on save like `body`. */
  answer: string;
};

/** An external reference backing a claim in the post. */
export type BlogSource = {
  label: string;
  url: string;
};

export type BlogPost = {
  /** URL segment. Permanent once published. */
  slug: string;
  title: string;
  /** Meta description and card summary. Kept under ~160 characters. */
  description: string;
  category: BlogCategory;
  /** ISO date (YYYY-MM-DD), UTC. Drives ordering and the sitemap. */
  publishedAt: string;
  /** ISO date, when revised after publication. Search engines read this. */
  updatedAt?: string;
  /** Shown on the post. A real name, since a byline nobody owns reads as spam. */
  author: string;
  /** Rough read time in minutes, counted from the words (readingMinutes). */
  readingMinutes: number;
  /**
   * The one-paragraph answer, shown above the article. Plain text.
   *
   * This is the part an assistant can quote whole, and the part a reader who
   * will not scroll actually needs. Writing it forces the post to have a point.
   */
  shortAnswer?: string;
  /** Questions appended to the post, and emitted as FAQPage structured data. */
  faqs?: BlogFaq[];
  /** Where the claims come from. Absent when a post makes none worth citing. */
  sources?: BlogSource[];
  /** Body as HTML, sanitised on every save (lib/articles/sanitize.ts). */
  body: string;
};

/**
 * A post's address from what was typed (or its title): lower case, accents
 * stripped, words joined by hyphens. The server saves exactly this, and the
 * editor shows it as you type.
 */
export function blogSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/, "");
}

/** The category a URL slug names, or null when the slug is unknown. */
export function categoryBySlug(
  slug: string,
): (typeof BLOG_CATEGORIES)[number] | null {
  return BLOG_CATEGORIES.find((category) => category.slug === slug) ?? null;
}

/** How many of these posts each category holds, for the index's filter chips. */
export function categoryCounts(posts: Pick<BlogPost, "category">[]): Record<BlogCategory, number> {
  const counts: Record<BlogCategory, number> = { Guides: 0, Comparisons: 0, Playbooks: 0 };
  for (const post of posts) counts[post.category] += 1;
  return counts;
}

/** Words a reader reads: the short answer, the body and the FAQ answers. */
function wordsIn(post: Pick<BlogPost, "body" | "shortAnswer" | "faqs">): number {
  const text = [post.shortAnswer ?? "", post.body, ...(post.faqs ?? []).flatMap((faq) => [faq.question, faq.answer])]
    .join(" ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .trim();
  return text ? text.split(/\s+/).length : 0;
}

/** Minutes to read, at about 200 words a minute; never less than one. */
export function readingMinutes(post: Pick<BlogPost, "body" | "shortAnswer" | "faqs">): number {
  return Math.max(1, Math.round(wordsIn(post) / 200));
}

export type TocEntry = { id: string; text: string };

/**
 * Turns a heading into a URL fragment.
 *
 * Shared by the extractor and the renderer so an anchor and its link cannot
 * drift apart — the failure mode is a table of contents whose links go nowhere,
 * which is worse than having none.
 */
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Pulls the h2 headings out of a post body for the table of contents.
 *
 * Regex rather than a parser: the body is sanitised to a small set of plain
 * tags, we need only the h2 text, and adding a DOM dependency to a page for
 * this would be disproportionate.
 */
export function tableOfContents(body: string): TocEntry[] {
  const entries: TocEntry[] = [];
  for (const match of body.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)) {
    const text = match[1].replace(/<[^>]+>/g, "").trim();
    if (text) entries.push({ id: headingId(text), text });
  }
  return entries;
}

/**
 * Adds an id to every h2 so the contents list can link to it.
 *
 * Done at render time rather than stored in the body, so the ids always match
 * whatever `headingId` currently produces.
 */
export function withHeadingIds(body: string): string {
  return body.replace(
    /<h2([^>]*)>([\s\S]*?)<\/h2>/gi,
    (whole, attrs: string, inner: string) => {
      // Never overwrite an id a post set deliberately.
      if (/\bid\s*=/.test(attrs)) return whole;
      const text = inner.replace(/<[^>]+>/g, "").trim();
      if (!text) return whole;
      return `<h2${attrs} id="${headingId(text)}">${inner}</h2>`;
    },
  );
}

/**
 * JSON for a <script type="application/ld+json"> block. Posts are typed by
 * people now, so "</script>" in a title or FAQ answer must not end the block:
 * "<" is written as its JSON escape, which parses to the same text.
 */
export function jsonLdScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
