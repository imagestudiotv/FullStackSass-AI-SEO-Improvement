import { InvalidUrlError, isPublicWebsiteUrl, normalizeWebsiteUrl } from "@/lib/websites/url";

/**
 * Sitemap finder and validator.
 *
 * Finds a sitemap the way a crawler does — robots.txt first, then the usual
 * locations — then checks it actually parses and reports what is in it.
 *
 * The common failures this catches are all silent: a sitemap listing staging
 * URLs, one that 404s while robots.txt still points at it, or an index file
 * nested so deep nothing reads it.
 */

const TIMEOUT_MS = 10_000;

/** Sitemaps are XML and can be large; this is well past any sensible one. */
const MAX_BYTES = 5_000_000;

/** Locations to try when robots.txt names none. */
const COMMON_PATHS = [
  "/sitemap.xml",
  "/sitemap_index.xml",
  "/sitemap-index.xml",
  "/sitemap1.xml",
  "/wp-sitemap.xml",
  "/sitemap/sitemap.xml",
];

export type SitemapFinding = {
  url: string;
  /** How we found it — robots.txt is the one search engines read first. */
  source: "robots.txt" | "common location" | "sitemap index";
  status: number;
  ok: boolean;
  /** True when the file is a <sitemapindex> pointing at other sitemaps. */
  isIndex: boolean;
  /** URLs listed, or child sitemaps for an index. Capped for display. */
  entries: string[];
  /** Total entries found, including any beyond `entries`. */
  entryCount: number;
  /** Why it is not usable, when it is not. */
  problem: string | null;
};

export type SitemapResult = {
  domain: string;
  robotsUrl: string;
  /** Sitemaps declared in robots.txt, whether or not they work. */
  declaredInRobots: string[];
  found: SitemapFinding[];
  /** Total page URLs across every working non-index sitemap we read. */
  totalUrls: number;
  /** Child sitemaps listed by any index files found. */
  childSitemaps: number;
};

export type SitemapOutcome =
  | { ok: true; result: SitemapResult }
  | { ok: false; error: string };

/** Entries listed per sitemap in the UI. */
const ENTRIES_SHOWN = 10;

/** Sitemaps fetched per run, so an index with 50 children cannot hang us. */
const MAX_FETCHES = 6;

async function fetchText(
  url: string,
): Promise<{ status: number; text: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "SEOVisionBot/1.0", accept: "application/xml,text/xml,*/*" },
    });

    // Read only as much as we allow, rather than buffering a huge file.
    const buffer = await response.arrayBuffer();
    const text = new TextDecoder().decode(buffer.slice(0, MAX_BYTES));
    return { status: response.status, text };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pulls locations out of sitemap XML.
 *
 * Regex rather than an XML parser: we need the <loc> values and nothing else,
 * the input is untrusted, and a malformed document should still give up
 * whatever it does contain rather than throwing the whole result away.
 */
function parseSitemap(xml: string): { isIndex: boolean; locs: string[] } {
  const isIndex = /<sitemapindex[\s>]/i.test(xml);
  const locs: string[] = [];

  for (const match of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
    const value = match[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
    if (value) locs.push(value);
  }

  return { isIndex, locs };
}

/** Reads robots.txt for declared sitemaps. */
async function sitemapsFromRobots(origin: string): Promise<string[]> {
  const fetched = await fetchText(`${origin}/robots.txt`);
  if (!fetched || fetched.status !== 200) return [];

  const found: string[] = [];
  for (const line of fetched.text.split(/\r?\n/)) {
    const clean = line.split("#")[0].trim();
    const match = /^sitemap\s*:\s*(\S+)$/i.exec(clean);
    if (match) found.push(match[1]);
  }
  return found;
}

/** Checks one sitemap URL and describes what it found. */
async function checkOne(
  url: string,
  source: SitemapFinding["source"],
): Promise<SitemapFinding> {
  const base: SitemapFinding = {
    url,
    source,
    status: 0,
    ok: false,
    isIndex: false,
    entries: [],
    entryCount: 0,
    problem: null,
  };

  // Re-checked per URL: robots.txt is attacker-controlled input, and a
  // declared sitemap could point at a private address.
  if (!isPublicWebsiteUrl(url)) {
    return { ...base, problem: "Not a public web address." };
  }

  const fetched = await fetchText(url);
  if (!fetched) {
    return { ...base, problem: "Could not be reached." };
  }

  if (fetched.status !== 200) {
    return {
      ...base,
      status: fetched.status,
      problem: `Returns ${fetched.status} instead of loading.`,
    };
  }

  const { isIndex, locs } = parseSitemap(fetched.text);

  if (locs.length === 0) {
    const looksHtml = /^\s*<(?:!doctype\s+html|html)[\s>]/i.test(fetched.text);
    return {
      ...base,
      status: fetched.status,
      problem: looksHtml
        ? "This is a web page, not a sitemap."
        : "No URLs found in the file.",
    };
  }

  return {
    ...base,
    status: fetched.status,
    ok: true,
    isIndex,
    entries: locs.slice(0, ENTRIES_SHOWN),
    entryCount: locs.length,
  };
}

/** Finds and validates the sitemaps for a domain. */
export async function checkSitemap(input: string): Promise<SitemapOutcome> {
  let normalized;
  try {
    normalized = normalizeWebsiteUrl(input);
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof InvalidUrlError
          ? error.message
          : "Enter a valid website address",
    };
  }

  const origin = new URL(normalized.url).origin;
  const declaredInRobots = await sitemapsFromRobots(origin);

  /**
   * robots.txt first, since that is what search engines read, then the usual
   * locations. Deduplicated so a sitemap declared AND at a common path is
   * checked once and attributed to robots.txt.
   */
  const seen = new Set<string>();
  const queue: { url: string; source: SitemapFinding["source"] }[] = [];

  for (const url of declaredInRobots) {
    if (seen.has(url)) continue;
    seen.add(url);
    queue.push({ url, source: "robots.txt" });
  }
  for (const path of COMMON_PATHS) {
    const url = `${origin}${path}`;
    if (seen.has(url)) continue;
    seen.add(url);
    queue.push({ url, source: "common location" });
  }

  const found: SitemapFinding[] = [];
  let fetches = 0;

  for (const candidate of queue) {
    if (fetches >= MAX_FETCHES) break;
    const finding = await checkOne(candidate.url, candidate.source);
    fetches += 1;

    /**
     * A missing file at a guessed location is not a finding — it is the normal
     * case for five of the six paths we try. Only report guesses that worked.
     */
    if (candidate.source === "common location" && !finding.ok) continue;
    found.push(finding);

    /**
     * An index lists other sitemaps, not pages, so on its own it reports zero
     * URLs — which reads as "your sitemap is empty" when it is perfectly
     * healthy. Following a few children gives a real page count.
     */
    if (finding.ok && finding.isIndex) {
      for (const child of finding.entries) {
        if (fetches >= MAX_FETCHES) break;
        if (seen.has(child)) continue;
        seen.add(child);
        const childFinding = await checkOne(child, "sitemap index");
        fetches += 1;
        if (childFinding.ok) found.push(childFinding);
      }
    }
  }

  return {
    ok: true,
    result: {
      domain: normalized.domain,
      robotsUrl: `${origin}/robots.txt`,
      declaredInRobots,
      found,
      totalUrls: found
        .filter((f) => f.ok && !f.isIndex)
        .reduce((sum, f) => sum + f.entryCount, 0),
      childSitemaps: found
        .filter((f) => f.ok && f.isIndex)
        .reduce((sum, f) => sum + f.entryCount, 0),
    },
  };
}
