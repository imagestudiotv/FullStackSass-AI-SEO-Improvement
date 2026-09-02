/**
 * How to fix each problem the audit finds.
 *
 * The brief: "on the audit to provide also the text with solution to fix the
 * errors. In this way they send a request and we review all errors and provide
 * the price for fixing."
 *
 * Two halves. This file is the free one — the audit named problems without
 * ever saying what to do about them, which makes a list of faults an anxiety
 * rather than a to-do list. The paid half is requesting a quote to have it
 * done for you.
 *
 * Written for a business owner, not an SEO. Each entry says what to change and
 * where, in the words they would use, and none of them assumes a developer is
 * available. Where a fix genuinely needs one, it says so rather than pretending
 * otherwise.
 */

export type IssueFix = {
  /** What to do, in one or two sentences. */
  fix: string;
  /** Roughly how much work, so someone can plan. */
  effort: "minutes" | "an hour" | "longer";
  /** True when this realistically needs whoever built the site. */
  needsDeveloper?: boolean;
};

export const ISSUE_FIXES: Record<string, IssueFix> = {
  noindex: {
    fix: "This page tells search engines to ignore it. Unless that is deliberate, remove the noindex tag — in WordPress it is usually a checkbox in your SEO plugin marked 'discourage search engines'.",
    effort: "minutes",
  },
  broken_page: {
    fix: "The page returns an error instead of loading. Either fix it, or if it should no longer exist, redirect it to the closest page that does so visitors and links are not lost.",
    effort: "an hour",
    needsDeveloper: true,
  },
  unreachable_page: {
    fix: "We could not load this page at all. Check it opens in your own browser — if it does, your host may be blocking automated visitors, which also blocks Google.",
    effort: "an hour",
    needsDeveloper: true,
  },
  missing_title: {
    fix: "Give the page a title describing what it is about. This is the headline people see in search results, so write it for them rather than stuffing keywords in.",
    effort: "minutes",
  },
  title_too_long: {
    fix: "Shorten the title so the important part is not cut off in search results. Put what matters first — the end is what gets trimmed.",
    effort: "minutes",
  },
  title_too_short: {
    fix: "Add detail to the title. A short title wastes space you are given for free, and often does not say enough for someone to know the page is what they wanted.",
    effort: "minutes",
  },
  missing_meta_description: {
    fix: "Write a description for this page. Without one, Google picks a sentence from the page itself, and it is often the wrong one.",
    effort: "minutes",
  },
  meta_description_too_long: {
    fix: "Shorten the description so it is not cut short in search results. Say why someone should click, and say it early.",
    effort: "minutes",
  },
  meta_description_too_short: {
    fix: "Expand the description. You have room for a sentence or two, and using it gives people a reason to choose your result over the others.",
    effort: "minutes",
  },
  missing_h1: {
    fix: "The page has no main heading. Add one that says what the page is about — it is the first thing both a reader and a search engine use to understand the page.",
    effort: "minutes",
  },
  multiple_h1: {
    fix: "The page has more than one main heading, so it is unclear which describes it. Keep one, and change the others to sub-headings.",
    effort: "minutes",
  },
  thin_content: {
    fix: "The page has very little text. Either expand it so it genuinely answers what someone came for, or merge it into a fuller page and redirect this one.",
    effort: "longer",
  },
  images_missing_alt: {
    fix: "Add a short description to each image saying what it shows. This is what screen readers announce, and it is how images get found in image search.",
    effort: "an hour",
  },
  missing_canonical: {
    fix: "The same content is reachable at more than one address, so search engines have to guess which is the real one. A canonical tag tells them — most SEO plugins add it automatically once switched on.",
    effort: "minutes",
    needsDeveloper: true,
  },
  missing_lang: {
    fix: "The page does not say what language it is written in. Setting it helps search engines serve your pages to the right people, and helps screen readers pronounce them correctly.",
    effort: "minutes",
    needsDeveloper: true,
  },
  large_page: {
    fix: "The page is heavy and slow to load, usually because of large images. Resize them to the size they are actually displayed at and save them as WebP.",
    effort: "an hour",
  },
  duplicate_title: {
    fix: "Two or more pages share this title, so search engines cannot tell them apart and may show neither. Give each page a title describing what only it covers.",
    effort: "minutes",
  },
  duplicate_meta_description: {
    fix: "Several pages share this description. Write one per page describing what that page specifically offers.",
    effort: "minutes",
  },
  no_internal_links: {
    fix: "Nothing on your site links to this page, so both visitors and search engines struggle to find it. Link to it from a related page — your homepage or a relevant article.",
    effort: "minutes",
  },
};

/** The fix for an issue type, or null when we have no specific advice. */
export function fixFor(issueType: string): IssueFix | null {
  return ISSUE_FIXES[issueType] ?? null;
}

/**
 * How many of these issues realistically need a developer.
 *
 * Used to set expectations before someone requests a quote: a list that is
 * mostly copy edits is one they can do themselves in an afternoon, and telling
 * them so is worth more than the sale.
 */
export function countNeedingDeveloper(issueTypes: string[]): number {
  const seen = new Set<string>();
  for (const type of issueTypes) {
    if (ISSUE_FIXES[type]?.needsDeveloper) seen.add(type);
  }
  return seen.size;
}
