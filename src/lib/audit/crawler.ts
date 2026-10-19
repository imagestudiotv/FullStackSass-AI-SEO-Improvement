import { CrawlError, fetchHomepage, type PageSnapshot } from "@/lib/websites/crawl";
import { isPublicWebsiteUrl } from "@/lib/websites/url";

/**
 * Breadth-first site crawler for the audit.
 *
 * Bounded on purpose. An unbounded crawl of a customer's site can run for
 * hours, hammer their server, and cost us compute for diminishing returns — the
 * issues found on page 200 are almost always the same ones found on page 20.
 * The cap is a plan-level decision, passed in by the caller.
 *
 * Breadth-first rather than depth-first so a shallow crawl still covers the
 * pages linked from the homepage — the ones that matter most — instead of
 * descending one branch.
 */

export type CrawlResult = {
  pages: PageSnapshot[];
  /** URLs that could not be fetched, with the reason. */
  failures: { url: string; reason: string }[];
  /** Distinct internal URLs discovered, whether or not they were fetched. */
  discovered: number;
};

/** Politeness gap between requests to the same host. */
const DELAY_MS = 300;

/**
 * Paths that are never worth auditing.
 *
 * Feeds, admin screens and asset directories either are not indexable pages or
 * are not the customer's content, and crawling them wastes the page budget.
 */
const SKIP_PATTERNS = [
  /\/wp-admin\//i,
  /\/wp-json\//i,
  /\/feed\/?$/i,
  /\.(jpe?g|png|gif|svg|webp|avif|pdf|zip|mp4|mp3|css|js|ico|woff2?)$/i,
  /\/(cart|checkout|basket|my-account|login|signin|logout)\/?$/i,
];

function shouldSkip(url: string): boolean {
  return SKIP_PATTERNS.some((pattern) => pattern.test(url));
}

/** Normalises a URL so the same page is not queued twice. */
function canonicalise(raw: string): string | null {
  try {
    const url = new URL(raw);
    url.hash = "";
    url.search = "";
    // Trailing slash is the same document as without, except at the root.
    if (url.pathname !== "/" && url.pathname.endsWith("/")) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    return url.toString();
  } catch {
    return null;
  }
}

/** A host without its "www.": example.com and www.example.com are one site. */
function siteHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

export async function crawlSite(
  startUrl: string,
  maxPages: number,
  onProgress?: (crawled: number, found: number) => Promise<void>,
): Promise<CrawlResult> {
  const start = canonicalise(startUrl);
  if (!start) {
    throw new CrawlError("Invalid start URL", "unreachable");
  }

  const startAt = new URL(start);
  let origin = startAt.origin;
  const queue: string[] = [start];
  const seen = new Set<string>([start]);
  /** Where each page read landed: a page reached twice (two links, a redirect) is read once. */
  const read = new Set<string>();
  const pages: PageSnapshot[] = [];
  const failures: { url: string; reason: string }[] = [];

  while (queue.length > 0 && pages.length < maxPages) {
    const url = queue.shift() as string;

    try {
      const snapshot = await fetchHomepage(url, isPublicWebsiteUrl);
      const landed = new URL(snapshot.finalUrl);
      const landedAt = canonicalise(snapshot.finalUrl) ?? url;
      const duplicate = read.has(landedAt);
      if (!duplicate) {
        read.add(landedAt);
        // Not queued again from a link to the address it landed on.
        seen.add(landedAt);
        pages.push(snapshot);
      }

      /**
       * The site's own address is where its FIRST page lands. Addresses are
       * stored without "www." (lib/websites/url.ts), and most sites redirect
       * that to their www address, or http to https. Following links only on
       * the address we started from read one page of every such site - the
       * homepage - and called that an audit. The same host with or without
       * "www." on the same port is the same site; anything else is not.
       */
      if (
        !duplicate &&
        pages.length === 1 &&
        landed.origin !== origin &&
        siteHost(landed.hostname) === siteHost(startAt.hostname) &&
        landed.port === startAt.port
      ) {
        origin = landed.origin;
      }

      /**
       * Links are followed from the FINAL url after redirects, and only within
       * the same origin. A redirect to another domain must not turn a site
       * audit into a crawl of somewhere we were never asked to touch.
       */
      if (!duplicate && landed.origin === origin) {
        for (const link of snapshot.internalUrls) {
          const next = canonicalise(link);
          if (!next || seen.has(next)) continue;
          if (new URL(next).origin !== origin) continue;
          if (shouldSkip(next)) continue;

          seen.add(next);
          // Queue beyond the cap is pointless, but a small buffer lets the
          // discovered count stay meaningful.
          if (queue.length < maxPages * 2) queue.push(next);
        }
      }
    } catch (error) {
      failures.push({
        url,
        reason:
          error instanceof CrawlError
            ? `${error.kind}: ${error.message}`
            : "unknown error",
      });
    }

    if (onProgress) {
      await onProgress(pages.length + failures.length, seen.size);
    }

    // Skipped after the last page so the crawl does not idle at the end.
    if (queue.length > 0 && pages.length < maxPages) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  return { pages, failures, discovered: seen.size };
}
