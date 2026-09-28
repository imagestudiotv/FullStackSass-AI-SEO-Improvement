import { isPublicWebsiteUrl } from "@/lib/websites/url";
import { safeFetch } from "@/lib/net/safe-fetch";

/**
 * Checks whether a placed link is still on the page.
 *
 * Links vanish: sites get redesigned, posts get deleted, and some hosts quietly
 * strip outbound links after earning the credit. The client's requirement is
 * explicit — refund the credit AND remove it from the dashboard, because a link
 * that stays listed after disappearing generates the same support question over
 * and over.
 */

const TIMEOUT_MS = 20_000;
const MAX_BYTES = 3_000_000;

export type LinkCheckResult = {
  /** True when the target URL appears as an href on the page. */
  alive: boolean;
  /**
   * The rel attribute of the matching link as the page has it ("" when it
   * has none). Only set when the link was found - otherwise unknown.
   */
  rel?: string | null;
  httpStatus: number | null;
  /** Set when the page could not be fetched at all. */
  error: string | null;
};

/**
 * Normalises a URL for comparison.
 *
 * A host may render the link with or without a trailing slash, with http
 * instead of https, or with "www." — all of which still point at the customer's
 * page. Comparing raw strings would report a live link as removed and refund a
 * credit that was legitimately earned.
 */
function comparable(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const path = parsed.pathname.replace(/\/+$/, "");
    return `${host}${path}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Extracts href values without a full HTML parse.
 *
 * Deliberately not cheerio: this runs against every placement on a schedule,
 * and a regex over the raw HTML is enough to answer "is this URL linked".
 */
function anchors(html: string): Array<{ href: string; rel: string | null }> {
  const found: Array<{ href: string; rel: string | null }> = [];
  const pattern = /<a\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const attributes = ` ${match[1]}`;
    const href = /\shref\s*=\s*["']([^"']+)["']/i.exec(attributes);
    if (!href) continue;
    // The rel the page really has - what search engines see - not what we sent.
    const rel = /\srel\s*=\s*["']([^"']*)["']/i.exec(attributes);
    found.push({
      href: href[1],
      rel: rel ? rel[1].trim().toLowerCase().replace(/\s+/g, " ").slice(0, 100) : null,
    });
    if (found.length > 2000) break;
  }
  return found;
}

export async function checkLink(
  pageUrl: string,
  targetUrl: string,
): Promise<LinkCheckResult> {
  const [result] = await checkLinks(pageUrl, [targetUrl]);
  return result;
}

/**
 * Checks several target URLs against ONE fetch of the page, one result per
 * target in the same order.
 *
 * An article can carry up to 15 network links (lib/backlinks/managed.ts), all
 * on the same published page: fetching it once per link would send the host
 * fifteen identical requests. A page that cannot be fetched gives every
 * target the same result.
 */
export async function checkLinks(
  pageUrl: string,
  targetUrls: string[],
): Promise<LinkCheckResult[]> {
  const same = (result: LinkCheckResult) => targetUrls.map(() => ({ ...result }));

  // The page URL comes from a host site we do not control; the same private
  // address rules apply here as everywhere else user-supplied URLs are fetched.
  if (!isPublicWebsiteUrl(pageUrl)) {
    return same({ alive: false, httpStatus: null, error: "not a public URL" });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await safeFetch(pageUrl, {
      signal: controller.signal,
      redirect: "follow",
      // The reader below stops at MAX_BYTES; this bounds the transfer and
      // keeps the deadline running while it reads.
      maxBytes: MAX_BYTES,
      overflow: "truncate",
      timeoutMs: TIMEOUT_MS,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; AiSeoPlatformBot/1.0; +https://example.com/bot)",
        accept: "text/html",
      },
    });
  } catch (error) {
    return same({
      alive: false,
      httpStatus: null,
      error: error instanceof Error ? error.name === "AbortError" ? "timeout" : error.message : "fetch failed",
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    return same({ alive: false, httpStatus: response.status, error: null });
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return same({ alive: false, httpStatus: response.status, error: "empty body" });
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total > MAX_BYTES ? MAX_BYTES : total);
  let offset = 0;
  for (const chunk of chunks) {
    if (offset + chunk.length > merged.length) break;
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  const html = new TextDecoder("utf-8").decode(merged);

  // Resolved against the page so relative hrefs are handled.
  const links = anchors(html).flatMap(({ href, rel }) => {
    try {
      return [{ url: comparable(new URL(href, pageUrl).toString()), rel }];
    } catch {
      return [];
    }
  });

  return targetUrls.map((targetUrl) => {
    const wanted = comparable(targetUrl);
    const found = links.find(({ url }) => url === wanted);
    return {
      alive: Boolean(found),
      // "" is a plain followed link; null (not found) is unknown.
      rel: found ? (found.rel ?? "") : null,
      httpStatus: response.status,
      error: null,
    };
  });
}
