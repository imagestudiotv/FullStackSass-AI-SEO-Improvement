import type { PageSnapshot } from "@/lib/websites/crawl";

/**
 * SEO audit rules.
 *
 * Every rule reports something a site owner can actually fix, with the URL it
 * applies to. Rules that only produce advice ("write better content") are
 * deliberately absent — an audit full of unactionable findings trains people to
 * ignore it.
 *
 * Thresholds follow what search engines actually truncate or penalise rather
 * than round numbers: 60 characters for a title and 158 for a description are
 * where Google cuts them off in results.
 */

export type Severity = "critical" | "warning" | "info";

export type Issue = {
  type: string;
  severity: Severity;
  url: string | null;
  detail: string;
};

/** Ranges used in several rules, kept together so they are easy to tune. */
export const LIMITS = {
  titleMin: 30,
  titleMax: 60,
  metaMin: 70,
  metaMax: 158,
  thinContentWords: 300,
  largePageBytes: 1_500_000,
} as const;

/**
 * Points removed per issue, per page.
 *
 * Read as: an average page carrying one critical issue costs 25 points, one
 * warning costs 8, one info costs 2. Deliberately steep for critical issues —
 * a page search engines cannot index deserves more alarm than twenty missing
 * alt attributes.
 *
 * An earlier version divided the raw issue count by pages and used much
 * smaller weights, which scored a site where EVERY page was missing a title at
 * 92/100. A score that reassuring on a broken site is worse than no score.
 */
const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 25,
  warning: 8,
  info: 2,
};

/** Checks that apply to one page. */
export function auditPage(page: PageSnapshot): Issue[] {
  const issues: Issue[] = [];
  const url = page.finalUrl;

  if (page.noindex) {
    issues.push({
      type: "noindex",
      severity: "critical",
      url,
      detail:
        "This page asks search engines not to index it, so it cannot rank.",
    });
  }

  if (page.statusCode >= 400) {
    issues.push({
      type: "broken_page",
      severity: "critical",
      url,
      detail: `The page returned HTTP ${page.statusCode}.`,
    });
  }

  if (!page.title) {
    issues.push({
      type: "missing_title",
      severity: "critical",
      url,
      detail: "No title tag. This is the headline shown in search results.",
    });
  } else if (page.title.length > LIMITS.titleMax) {
    issues.push({
      type: "title_too_long",
      severity: "warning",
      url,
      detail: `Title is ${page.title.length} characters and will be cut off after about ${LIMITS.titleMax}.`,
    });
  } else if (page.title.length < LIMITS.titleMin) {
    issues.push({
      type: "title_too_short",
      severity: "info",
      url,
      detail: `Title is only ${page.title.length} characters; there is room to say more.`,
    });
  }

  if (!page.metaDescription) {
    issues.push({
      type: "missing_meta_description",
      severity: "warning",
      url,
      detail:
        "No meta description, so search engines will invent the snippet shown under your link.",
    });
  } else if (page.metaDescription.length > LIMITS.metaMax) {
    issues.push({
      type: "meta_description_too_long",
      severity: "info",
      url,
      detail: `Description is ${page.metaDescription.length} characters and will be truncated after about ${LIMITS.metaMax}.`,
    });
  } else if (page.metaDescription.length < LIMITS.metaMin) {
    issues.push({
      type: "meta_description_too_short",
      severity: "info",
      url,
      detail: `Description is only ${page.metaDescription.length} characters.`,
    });
  }

  if (page.h1Count === 0) {
    issues.push({
      type: "missing_h1",
      severity: "warning",
      url,
      detail: "No H1 heading, so the page's main topic is unclear.",
    });
  } else if (page.h1Count > 1) {
    issues.push({
      type: "multiple_h1",
      severity: "info",
      url,
      detail: `${page.h1Count} H1 headings. One main heading per page is clearer.`,
    });
  }

  if (page.wordCount < LIMITS.thinContentWords && page.statusCode < 400) {
    issues.push({
      type: "thin_content",
      severity: "warning",
      url,
      detail: `Only ${page.wordCount} words. Pages this short rarely rank for competitive terms.`,
    });
  }

  const missingAlt = page.images.filter((image) => image.alt === null).length;
  if (missingAlt > 0) {
    issues.push({
      type: "images_missing_alt",
      severity: "info",
      url,
      detail: `${missingAlt} of ${page.images.length} images have no alt text, which hurts accessibility and image search.`,
    });
  }

  if (!page.canonical) {
    issues.push({
      type: "missing_canonical",
      severity: "info",
      url,
      detail:
        "No canonical link. If this page is reachable at several URLs, search engines must guess which is authoritative.",
    });
  }

  if (!page.lang) {
    issues.push({
      type: "missing_lang",
      severity: "info",
      url,
      detail: "The html tag has no lang attribute.",
    });
  }

  if (page.htmlBytes > LIMITS.largePageBytes) {
    issues.push({
      type: "large_page",
      severity: "warning",
      url,
      detail: `The HTML alone is ${Math.round(page.htmlBytes / 1024)} KB, which slows loading.`,
    });
  }

  return issues;
}

/**
 * Checks that only make sense across the whole site.
 *
 * Duplicate titles and descriptions are the clearest example: neither page is
 * wrong on its own, but together they compete for the same searches.
 */
export function auditSite(pages: PageSnapshot[]): Issue[] {
  const issues: Issue[] = [];

  const byTitle = new Map<string, string[]>();
  const byMeta = new Map<string, string[]>();

  for (const page of pages) {
    if (page.title) {
      const key = page.title.trim().toLowerCase();
      byTitle.set(key, [...(byTitle.get(key) ?? []), page.finalUrl]);
    }
    if (page.metaDescription) {
      const key = page.metaDescription.trim().toLowerCase();
      byMeta.set(key, [...(byMeta.get(key) ?? []), page.finalUrl]);
    }
  }

  for (const [title, urls] of byTitle) {
    if (urls.length > 1) {
      issues.push({
        type: "duplicate_title",
        severity: "warning",
        url: urls[0],
        detail: `${urls.length} pages share the title "${title.slice(0, 60)}". They will compete with each other.`,
      });
    }
  }

  for (const [, urls] of byMeta) {
    if (urls.length > 1) {
      issues.push({
        type: "duplicate_meta_description",
        severity: "info",
        url: urls[0],
        detail: `${urls.length} pages share the same meta description.`,
      });
    }
  }

  // A site with no internal linking cannot pass authority between its pages.
  const orphanCandidates = pages.filter(
    (page) => page.internalUrls.length === 0 && page.statusCode < 400,
  );
  if (orphanCandidates.length > 0 && pages.length > 1) {
    issues.push({
      type: "no_internal_links",
      severity: "info",
      url: orphanCandidates[0].finalUrl,
      detail: `${orphanCandidates.length} page(s) link to nothing else on the site.`,
    });
  }

  return issues;
}

export type AuditSummary = {
  score: number;
  pagesCrawled: number;
  counts: Record<Severity, number>;
  /** Issue types by frequency, so the UI can lead with the biggest problem. */
  topIssues: { type: string; count: number }[];
};

/**
 * Scores 0-100 from the issues found.
 *
 * Normalised per page so a 50-page site is not punished for being larger than
 * a 5-page one: what matters is how many problems the AVERAGE page has, not
 * the raw total. The floor is 0 rather than a negative number, which would be
 * meaningless to a customer.
 */
export function scoreAudit(issues: Issue[], pagesCrawled: number): AuditSummary {
  const counts: Record<Severity, number> = {
    critical: 0,
    warning: 0,
    info: 0,
  };
  const byType = new Map<string, number>();

  for (const issue of issues) {
    counts[issue.severity] += 1;
    byType.set(issue.type, (byType.get(issue.type) ?? 0) + 1);
  }

  const pages = Math.max(pagesCrawled, 1);
  const penalty =
    (counts.critical * SEVERITY_WEIGHT.critical +
      counts.warning * SEVERITY_WEIGHT.warning +
      counts.info * SEVERITY_WEIGHT.info) /
    pages;

  const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));

  const topIssues = [...byType.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return { score, pagesCrawled, counts, topIssues };
}

/** Human labels for issue types, used by the UI. */
export const ISSUE_LABELS: Record<string, string> = {
  noindex: "Blocked from search engines",
  broken_page: "Page returns an error",
  missing_title: "Missing title tag",
  title_too_long: "Title too long",
  title_too_short: "Title too short",
  missing_meta_description: "Missing meta description",
  meta_description_too_long: "Meta description too long",
  meta_description_too_short: "Meta description too short",
  missing_h1: "Missing H1 heading",
  multiple_h1: "More than one H1",
  thin_content: "Not enough content",
  images_missing_alt: "Images without alt text",
  missing_canonical: "No canonical link",
  missing_lang: "No language set",
  large_page: "Page is heavy",
  duplicate_title: "Duplicate titles",
  duplicate_meta_description: "Duplicate meta descriptions",
  no_internal_links: "No internal links",
};
