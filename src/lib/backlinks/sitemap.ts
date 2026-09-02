import { isPublicWebsiteUrl, normalizeWebsiteUrl } from "@/lib/websites/url";

/**
 * Reading a site's own sitemap to find pages worth linking to.
 *
 * The brief: "We also search for sitemap to understand what backlinks to
 * insert on articles."
 *
 * Until now a customer typed the target URL by hand, which means they have to
 * remember their own URLs and type them correctly — and the page they pick is
 * often the homepage, which is the page that needs the link least.
 *
 * A sitemap is better than our crawl for this one job. The crawl follows links
 * and stops at 25 pages; a sitemap is the owner's own list of everything they
 * want indexed, including pages no internal link reaches — which are exactly
 * the pages a backlink helps most.
 */

const TIMEOUT_MS = 15_000;

/** A sitemap larger than this is being used for something else. */
const MAX_BYTES = 5_000_000;

/** Sitemap indexes point at more sitemaps; follow a few, not a tree. */
const MAX_CHILD_SITEMAPS = 5;

/** Enough for a person to choose from; more is a list nobody reads. */
export const MAX_TARGETS = 100;

export type SitemapPage = {
  url: string;
  /** Path only, for display: the domain is the same on every row. */
  path: string;
  /** From <lastmod>, when the sitemap provides it. */
  lastModified: string | null;
};

export type SitemapOutcome =
  | { ok: true; pages: SitemapPage[]; source: string }
  | { ok: false; error: string };

/**
 * Where a sitemap usually lives, in the order worth trying.
 *
 * Built from the ORIGIN, not the stored URL. A website row can carry a path —
 * one in the live database is stored as /wholesale_home_search — and appending
 * to that asks for /wholesale_home_search/sitemap.xml, which does not exist.
 * Sitemaps live at the domain root.
 */
function candidateUrls(origin: string): string[] {
  const root = origin.replace(/\/+$/, "");
  return [
    `${root}/sitemap.xml`,
    `${root}/sitemap_index.xml`,
    `${root}/wp-sitemap.xml`,
    `${root}/sitemap-index.xml`,
  ];
}

async function fetchText(url: string): Promise<string | null> {
  // Re-checked per URL: these come from a sitemap index, which is remote
  // content, so a hostile sitemap could otherwise point us at an internal
  // address.
  if (!isPublicWebsiteUrl(url)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/xml,text/xml", "user-agent": "SEOVisionBot/1.0" },
    });
    if (!response.ok) return null;

    const text = await response.text();
    return text.slice(0, MAX_BYTES);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pulls <loc> values out of a sitemap.
 *
 * Regex rather than an XML parser: the shape is fixed and shallow, the input
 * is capped, and adding a parser dependency for one tag is not a trade worth
 * making. Entities are decoded because & is legal and common in query strings.
 */
function extractLocs(xml: string): { loc: string; lastmod: string | null }[] {
  const out: { loc: string; lastmod: string | null }[] = [];

  // Each <url> or <sitemap> block, so lastmod stays paired with its loc.
  const blocks = xml.match(/<(?:url|sitemap)\b[\s\S]*?<\/(?:url|sitemap)>/gi) ?? [];

  for (const block of blocks) {
    const loc = block.match(/<loc>\s*([\s\S]*?)\s*<\/loc>/i)?.[1];
    if (!loc) continue;

    const lastmod = block.match(/<lastmod>\s*([\s\S]*?)\s*<\/lastmod>/i)?.[1] ?? null;

    out.push({
      loc: loc
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .trim(),
      lastmod: lastmod?.trim() || null,
    });
  }

  return out;
}

/** True when this looks like an index of other sitemaps rather than pages. */
function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

/**
 * Pages that are worth offering as a backlink target.
 *
 * Filters out the ones a link cannot help. The homepage already receives most
 * of a site's links, and feeds, tags and paginated archives are not pages
 * anyone should be building links to.
 */
function isUsefulTarget(url: string, origin: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // Only the customer's own site: a sitemap can legally list anything.
  if (parsed.origin !== origin) return false;

  const path = parsed.pathname.replace(/\/+$/, "");

  // The homepage. It needs the link least and is what people pick by default.
  if (path === "") return false;

  /**
   * Archive and utility paths are matched ANYWHERE in the path, not just at
   * the start: /blog/category/news is as poor a backlink target as
   * /category/news, and anchoring to the start missed exactly that.
   */
  const skip = [
    /(^|\/)(feed|rss|atom)(\/|$)/i,
    /(^|\/)(tag|tags|category|categories|author)\//i,
    /(^|\/)page\/\d+/i,
    /^\/(wp-content|wp-admin|wp-json)/i,
    /\.(xml|json|txt|pdf|jpe?g|png|gif|webp|svg|css|js)$/i,
    /^\/(cart|checkout|account|login|register|search)/i,
    /^\/(privacy|terms|refund|cookie)/i,
  ];

  return !skip.some((pattern) => pattern.test(path));
}

/**
 * Finds pages on a customer's site that are worth linking to.
 *
 * Returns a typed error rather than throwing: a missing sitemap is a normal
 * outcome, not a failure, and the customer can still type a URL by hand.
 */
export async function findLinkTargets(
  websiteUrl: string,
): Promise<SitemapOutcome> {
  let normalized;
  try {
    normalized = normalizeWebsiteUrl(websiteUrl);
  } catch {
    return { ok: false, error: "That website address is not valid" };
  }

  const origin = new URL(normalized.url).origin;

  for (const candidate of candidateUrls(origin)) {
    const xml = await fetchText(candidate);
    if (!xml || !/<(urlset|sitemapindex)\b/i.test(xml)) continue;

    let entries = extractLocs(xml);

    /**
     * A sitemap index lists other sitemaps. Follow a few and merge; a site
     * with fifty of them is a site we should sample rather than exhaust.
     */
    if (isSitemapIndex(xml)) {
      const children = entries.slice(0, MAX_CHILD_SITEMAPS);
      entries = [];
      for (const child of children) {
        const childXml = await fetchText(child.loc);
        if (childXml) entries.push(...extractLocs(childXml));
        if (entries.length >= MAX_TARGETS * 3) break;
      }
    }

    const seen = new Set<string>();
    const pages: SitemapPage[] = [];

    for (const entry of entries) {
      if (!isUsefulTarget(entry.loc, origin)) continue;
      if (seen.has(entry.loc)) continue;
      seen.add(entry.loc);

      pages.push({
        url: entry.loc,
        path: new URL(entry.loc).pathname,
        lastModified: entry.lastmod,
      });

      if (pages.length >= MAX_TARGETS) break;
    }

    if (pages.length === 0) {
      return {
        ok: false,
        error:
          "We found a sitemap but no pages worth linking to in it. Enter a page address instead.",
      };
    }

    return { ok: true, pages, source: candidate };
  }

  return {
    ok: false,
    error:
      "We could not find a sitemap for that website. Enter the page address you want linked instead.",
  };
}
