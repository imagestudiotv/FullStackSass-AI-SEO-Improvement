import * as cheerio from "cheerio";

/**
 * Homepage fetching and HTML extraction.
 *
 * Deliberately fetches ONE page. Onboarding needs enough signal to describe the
 * business; a full site crawl belongs to the audit, runs far longer, and would
 * make the user wait on a screen for it.
 */

/** Caps chosen so one hostile response cannot stall or exhaust a worker. */
const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 2_000_000; // 2 MB of HTML is already far past normal.
const MAX_REDIRECTS = 5;

const USER_AGENT =
  "Mozilla/5.0 (compatible; AiSeoPlatformBot/1.0; +https://example.com/bot)";

export class CrawlError extends Error {
  constructor(
    message: string,
    readonly kind:
      | "unreachable"
      | "timeout"
      | "http_error"
      | "not_html"
      | "too_large",
  ) {
    super(message);
    this.name = "CrawlError";
  }
}

export type PageSnapshot = {
  /** URL after redirects — the site's real address. */
  finalUrl: string;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  ogSiteName: string | null;
  lang: string | null;
  h1: string | null;
  headings: string[];
  /** Visible text, collapsed and truncated. Input for extraction. */
  text: string;
  /** Internal link paths, for a sense of the site's structure. */
  internalLinks: string[];
  /** Outbound hosts — a weak but free competitor/partner signal. */
  externalHosts: string[];
  wordCount: number;
};

/**
 * Fetches a URL with a timeout and a hard byte ceiling.
 *
 * `redirect: "manual"` is deliberate: an automatic redirect could land on a
 * private address that normalizeWebsiteUrl already rejected at the entry point.
 * Each hop is re-validated by the caller instead.
 */
async function fetchOnce(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "manual",
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new CrawlError(`Timed out after ${FETCH_TIMEOUT_MS}ms`, "timeout");
    }
    throw new CrawlError(
      error instanceof Error ? error.message : "Could not reach the site",
      "unreachable",
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Reads a body, aborting once MAX_BYTES is exceeded. */
async function readCapped(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) {
    throw new CrawlError("Page is too large to analyse", "too_large");
  }

  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new CrawlError("Page is too large to analyse", "too_large");
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder("utf-8").decode(merged);
}

/**
 * Follows redirects manually, re-validating every hop.
 *
 * `isAllowedHost` comes from the caller (normalizeWebsiteUrl's rules) so an
 * open redirect on a customer's site cannot walk us onto localhost or a cloud
 * metadata endpoint.
 */
async function fetchFollowing(
  startUrl: string,
  isAllowedHost: (url: string) => boolean,
): Promise<{ response: Response; finalUrl: string }> {
  let url = startUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetchOnce(url);

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        return { response, finalUrl: url };
      }
      const next = new URL(location, url).toString();
      if (!isAllowedHost(next)) {
        throw new CrawlError(
          "The site redirected somewhere we will not follow",
          "unreachable",
        );
      }
      url = next;
      continue;
    }

    if (response.status >= 400) {
      throw new CrawlError(
        `The site returned ${response.status}`,
        "http_error",
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
      throw new CrawlError("That address is not a web page", "not_html");
    }

    return { response, finalUrl: url };
  }

  throw new CrawlError("Too many redirects", "unreachable");
}

/** Text sent to the model. Enough for context, bounded for cost. */
const MAX_TEXT_CHARS = 12_000;

export async function fetchHomepage(
  url: string,
  isAllowedHost: (candidate: string) => boolean,
): Promise<PageSnapshot> {
  const { response, finalUrl } = await fetchFollowing(url, isAllowedHost);
  const html = await readCapped(response);
  const $ = cheerio.load(html);

  // Script, style and template content is markup noise, never page copy.
  $("script, style, noscript, template, svg").remove();

  const headings: string[] = [];
  $("h1, h2, h3").each((_, element) => {
    const text = $(element).text().trim().replace(/\s+/g, " ");
    if (text && headings.length < 40) headings.push(text);
  });

  const origin = new URL(finalUrl).origin;
  const internal = new Set<string>();
  const external = new Set<string>();

  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (!href || href.startsWith("#")) return;
    let resolved: URL;
    try {
      resolved = new URL(href, finalUrl);
    } catch {
      return;
    }
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return;

    if (resolved.origin === origin) {
      if (internal.size < 100) internal.add(resolved.pathname);
    } else if (external.size < 50) {
      external.add(resolved.hostname.replace(/^www\./, ""));
    }
  });

  const text = $("body").text().replace(/\s+/g, " ").trim();

  return {
    finalUrl,
    statusCode: response.status,
    title: $("title").first().text().trim() || null,
    metaDescription:
      $('meta[name="description"]').attr("content")?.trim() ||
      $('meta[property="og:description"]').attr("content")?.trim() ||
      null,
    ogSiteName: $('meta[property="og:site_name"]').attr("content")?.trim() || null,
    lang: $("html").attr("lang")?.trim().slice(0, 10) || null,
    h1: $("h1").first().text().trim().replace(/\s+/g, " ") || null,
    headings,
    text: text.slice(0, MAX_TEXT_CHARS),
    internalLinks: [...internal],
    externalHosts: [...external],
    wordCount: text ? text.split(/\s+/).length : 0,
  };
}
