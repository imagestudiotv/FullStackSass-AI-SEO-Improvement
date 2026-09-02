/**
 * Article statistics, counted from the article itself.
 *
 * The brief asks the editor to show word count, keywords, images, internal
 * links, external links and social mentions. None of these are stored — and
 * they should not be, because the customer can edit the body at any time and a
 * stored count would immediately be wrong.
 *
 * So they are derived from the HTML on read. It is a few hundred bytes of
 * string work on a page that already loads the body.
 *
 * Regex rather than a DOM parser: this runs on the server for a single
 * article, the input is HTML we generated, and adding a parser dependency for
 * six counts is not a trade worth making. Every pattern below is deliberately
 * loose — an approximate count of images is fine, a wrong one is not.
 */

export type ArticleStats = {
  words: number;
  /** Links to the customer's own site. */
  internalLinks: number;
  /** Links to anywhere else. */
  externalLinks: number;
  images: number;
  /** Links to the social platforms the brief names. */
  socialMentions: number;
  /** How many times the target keyword appears in the body. */
  keywordUses: number;
  /** Headings, as a rough measure of structure. */
  headings: number;
};

/** The platforms the brief names for social mentions. */
const SOCIAL_HOSTS = [
  "instagram.com",
  "facebook.com",
  "youtube.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
];

/** Strips tags so words are counted from text rather than markup. */
function textOf(html: string): string {
  return html
    // Script and style contents are not readable text.
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    // Entities become a space rather than being counted as a word.
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Every href in the document. */
function hrefs(html: string): string[] {
  const out: string[] = [];
  const pattern = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    out.push(match[1]);
  }
  return out;
}

/**
 * Counts everything the editor displays.
 *
 * `domain` decides which links are internal. Without it — a website row with
 * no domain, which should not happen but might — relative links still count as
 * internal, since they can only point at the same site.
 */
export function articleStats(
  html: string | null,
  options: { domain?: string | null; targetKeyword?: string | null } = {},
): ArticleStats {
  if (!html) {
    return {
      words: 0,
      internalLinks: 0,
      externalLinks: 0,
      images: 0,
      socialMentions: 0,
      keywordUses: 0,
      headings: 0,
    };
  }

  const text = textOf(html);
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;

  const domain = options.domain?.toLowerCase().replace(/^www\./, "") ?? null;

  let internalLinks = 0;
  let externalLinks = 0;
  let socialMentions = 0;

  for (const href of hrefs(html)) {
    const lower = href.toLowerCase();

    // Anchors and mail links are neither internal nor external navigation.
    if (lower.startsWith("#") || lower.startsWith("mailto:") || lower.startsWith("tel:")) {
      continue;
    }

    if (SOCIAL_HOSTS.some((host) => lower.includes(host))) {
      socialMentions += 1;
      // A social profile is also an external link; counted as both, because
      // both numbers answer a different question.
      externalLinks += 1;
      continue;
    }

    // Relative links can only point at the same site.
    const isRelative = !/^https?:\/\//i.test(lower);
    if (isRelative || (domain && lower.includes(domain))) {
      internalLinks += 1;
    } else {
      externalLinks += 1;
    }
  }

  const images = (html.match(/<img\b/gi) ?? []).length;
  const headings = (html.match(/<h[2-6]\b/gi) ?? []).length;

  /**
   * Keyword uses are counted case-insensitively on word boundaries, so
   * "dentist" does not match inside "dentistry". Whole-phrase, since that is
   * what a target keyword is.
   */
  let keywordUses = 0;
  const keyword = options.targetKeyword?.trim();
  if (keyword) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    keywordUses = (text.match(new RegExp(`\\b${escaped}\\b`, "gi")) ?? []).length;
  }

  return {
    words,
    internalLinks,
    externalLinks,
    images,
    socialMentions,
    keywordUses,
    headings,
  };
}
