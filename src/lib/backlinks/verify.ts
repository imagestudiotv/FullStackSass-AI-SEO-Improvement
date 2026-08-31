import { isPublicWebsiteUrl } from "@/lib/websites/url";

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
function hrefs(html: string): string[] {
  const found: string[] = [];
  const pattern = /<a\b[^>]*\shref\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    found.push(match[1]);
    if (found.length > 2000) break;
  }
  return found;
}

export async function checkLink(
  pageUrl: string,
  targetUrl: string,
): Promise<LinkCheckResult> {
  // The page URL comes from a host site we do not control; the same private
  // address rules apply here as everywhere else user-supplied URLs are fetched.
  if (!isPublicWebsiteUrl(pageUrl)) {
    return { alive: false, httpStatus: null, error: "not a public URL" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(pageUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; AiSeoPlatformBot/1.0; +https://example.com/bot)",
        accept: "text/html",
      },
    });
  } catch (error) {
    return {
      alive: false,
      httpStatus: null,
      error: error instanceof Error ? error.name === "AbortError" ? "timeout" : error.message : "fetch failed",
    };
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    return { alive: false, httpStatus: response.status, error: null };
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return { alive: false, httpStatus: response.status, error: "empty body" };
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

  const wanted = comparable(targetUrl);
  const alive = hrefs(html).some((href) => {
    try {
      // Resolved against the page so relative hrefs are handled.
      return comparable(new URL(href, pageUrl).toString()) === wanted;
    } catch {
      return false;
    }
  });

  return { alive, httpStatus: response.status, error: null };
}

/**
 * Consecutive failures before a link is treated as removed.
 *
 * A site being down for an hour is not the same as a link being deleted.
 * Refunding on the first failure would delete real, live links every time a
 * customer's host had a bad afternoon.
 */
export const FAILURES_BEFORE_REMOVED = 3;
