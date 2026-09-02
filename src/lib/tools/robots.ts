import { normalizeWebsiteUrl, InvalidUrlError } from "@/lib/websites/url";

/**
 * robots.txt and sitemap checker.
 *
 * Two problems this catches, both of which make a site invisible and neither
 * of which is visible from the site itself:
 *
 *  - a robots.txt that blocks search engines, usually left over from a staging
 *    site and never changed after launch
 *  - no sitemap, so a crawler has to find every page by following links
 *
 * The first is the one that matters. A site with "Disallow: /" is not ranking
 * badly, it is not in the index at all, and the owner has no way to tell from
 * looking at their own website.
 */

const TIMEOUT_MS = 10_000;

/** Enough to read any reasonable robots.txt; a huge one is a red flag itself. */
const MAX_BYTES = 512_000;

export type RobotsResult = {
  domain: string;
  /** The file's own URL, so the visitor can open it. */
  robotsUrl: string;
  found: boolean;
  /** True when a rule blocks all crawlers from the whole site. */
  blocksEverything: boolean;
  /** Sitemap URLs declared in the file. */
  sitemaps: string[];
  /** Rules that block something, for display. */
  disallowed: string[];
  /** The raw file, capped, so someone can read what we read. */
  content: string;
};

export type RobotsOutcome =
  | { ok: true; result: RobotsResult }
  | { ok: false; error: string };

/**
 * Parses robots.txt.
 *
 * Deliberately simple. A full parser handles wildcards, precedence and
 * crawl-delay; this answers one question — "is anything blocking everyone from
 * everything" — and reports the raw file for anything subtler. Claiming to
 * fully interpret robots.txt and getting an edge case wrong would be worse
 * than showing the file.
 */
function parseRobots(text: string): {
  blocksEverything: boolean;
  sitemaps: string[];
  disallowed: string[];
} {
  const sitemaps: string[] = [];
  const disallowed: string[] = [];

  /** Which user-agent block we are inside. */
  let currentAgent: string | null = null;
  let wildcardBlocksRoot = false;

  for (const rawLine of text.split(/\r?\n/)) {
    // Comments and blank lines carry no rules.
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;

    const separator = line.indexOf(":");
    if (separator === -1) continue;

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      currentAgent = value.toLowerCase();
      continue;
    }

    if (field === "sitemap" && value) {
      sitemaps.push(value);
      continue;
    }

    if (field === "disallow" && value) {
      disallowed.push(currentAgent ? `${currentAgent}: ${value}` : value);
      /**
       * "Disallow: /" under "User-agent: *" blocks the entire site for every
       * crawler. This is the check that matters, and the one people get wrong
       * by copying a staging config into production.
       */
      if (currentAgent === "*" && value === "/") {
        wildcardBlocksRoot = true;
      }
    }
  }

  return { blocksEverything: wildcardBlocksRoot, sitemaps, disallowed };
}

/**
 * Fetches and checks a site's robots.txt.
 *
 * The URL is normalised and SSRF-checked before any request, because this
 * takes an address from an anonymous visitor and fetches it from our server —
 * exactly the shape of request that could otherwise reach our own network.
 */
export async function checkRobots(input: string): Promise<RobotsOutcome> {
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

  const robotsUrl = `${normalized.url.replace(/\/+$/, "")}/robots.txt`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(robotsUrl, {
      signal: controller.signal,
      headers: { accept: "text/plain", "user-agent": "SEOVisionBot/1.0" },
    });
  } catch {
    return {
      ok: false,
      error: "We could not reach that website. Check the address and try again.",
    };
  } finally {
    clearTimeout(timer);
  }

  /**
   * A missing robots.txt is a valid, reportable answer rather than an error:
   * it means everything is crawlable, which is usually fine and occasionally
   * exactly what the visitor wanted to confirm.
   */
  if (response.status === 404) {
    return {
      ok: true,
      result: {
        domain: normalized.domain,
        robotsUrl,
        found: false,
        blocksEverything: false,
        sitemaps: [],
        disallowed: [],
        content: "",
      },
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: `That website returned an error (HTTP ${response.status}) for robots.txt.`,
    };
  }

  const raw = await response.text();
  const content = raw.slice(0, MAX_BYTES);
  const parsed = parseRobots(content);

  return {
    ok: true,
    result: {
      domain: normalized.domain,
      robotsUrl,
      found: true,
      ...parsed,
      content,
    },
  };
}
