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
 * Sections of the blog: blog_categories rows, managed in Admin -> Blog
 * (lib/admin/blog.ts) and read by lib/blog/categories.ts.
 *
 * They were three constants (Guides, Comparisons, Playbooks) until the client
 * asked to add his own (2026-10-01); migration 0048 keeps those three. A post
 * names its category by name, so this is just the name.
 */
export type BlogCategory = string;

/** A category as pages and the editor use it. */
export type BlogCategoryInfo = {
  name: string;
  /** Its page: /blog/category/<slug>. Permanent once created. */
  slug: string;
  /** One line under its heading, and its meta description. */
  blurb: string;
};

/** A question and its answer, rendered as an expandable block. */
export type BlogFaq = {
  question: string;
  /** HTML, sanitised on save like `body`. */
  answer: string;
};

/**
 * The most a FAQ answer's HTML may run to as stored (sanitised), formatting
 * included. The editor warns past it and the server refuses it
 * (lib/admin/blog.ts).
 */
export const FAQ_ANSWER_LIMIT = 5000;

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
  /** Its category's page: /blog/category/<categorySlug>. */
  categorySlug: string;
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

/** How many of these posts each category holds, for the index's filter chips. */
export function categoryCounts(posts: Pick<BlogPost, "category">[]): Record<BlogCategory, number> {
  const counts: Record<BlogCategory, number> = {};
  for (const post of posts) counts[post.category] = (counts[post.category] ?? 0) + 1;
  return counts;
}

/**
 * Tags that end a line of text. Any other tag (strong, em, a) sits inside a
 * word as often as between two, so it goes without leaving a space. The
 * attribute part matches quoted values whole, as the sanitiser's does, so a
 * ">" inside one does not end the tag early.
 */
const BLOCK_TAG =
  /<\/?(?:p|div|br|hr|li|ul|ol|h[1-6]|blockquote|pre|table|thead|tbody|tfoot|tr|td|th|caption|figure|figcaption|dl|dt|dd)\b(?:"[^"]*"|'[^']*'|[^>"'])*>/gi;
const ANY_TAG = /<\/?[a-z][a-z0-9:-]*(?:"[^"]*"|'[^']*'|[^>"'])*>/gi;

/**
 * The named references worth decoding. The editor writes only &amp;, &lt;,
 * &gt; and &nbsp;; older posts and pasted text bring the typographic ones.
 * Any other stays as written rather than being guessed at.
 */
const NAMED_REFERENCES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  copy: "©",
  reg: "®",
  trade: "™",
  euro: "€",
  pound: "£",
};

function decodeReference(whole: string, ref: string): string {
  if (ref[0] !== "#") return NAMED_REFERENCES[ref.toLowerCase()] ?? whole;
  const code = ref[1] === "x" || ref[1] === "X" ? parseInt(ref.slice(2), 16) : Number(ref.slice(1));
  // An out-of-range reference reads as nothing rather than throwing on one bad paste.
  return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
}

/**
 * The words of a piece of post HTML (a FAQ answer, the body) as plain text:
 * one line per paragraph, list item or other block, character references
 * decoded, runs of spaces collapsed.
 *
 * For structured data, which wants text, and for telling an answer with words
 * in it from the markup an emptied editor leaves behind ("<p></p>"). Stripping
 * the tags alone glued list items together ("<li>a</li><li>b</li>" read "ab")
 * and left "&amp;" and "&nbsp;" in the text.
 *
 * Regex rather than a parser, as with the helpers below: it runs in the
 * editor as well as on the server, on HTML the sanitiser has reduced to a few
 * plain tags (or the editor wrote).
 */
export function plainText(html: string): string {
  return (
    html
      // A line break in the source is only a space to a browser.
      .replace(/\s+/g, " ")
      .replace(BLOCK_TAG, "\n")
      .replace(ANY_TAG, "")
      // After the tags are gone, so a decoded "&lt;p&gt;" stays text.
      .replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, decodeReference)
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n")
  );
}

/**
 * True when the HTML has a word in it. "<p></p>", "<p>&nbsp;</p>" and
 * "<ul><li></li></ul>" do not: they are what an editor holds once its text is
 * deleted, and count as an empty answer, not a written one.
 */
export function hasText(html: string): boolean {
  return plainText(html) !== "";
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
