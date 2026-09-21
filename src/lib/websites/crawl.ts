import * as cheerio from "cheerio";

import { fetchPage } from "@/lib/websites/fetch-page";

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
    /**
     * The HTTP status, when the failure came with one.
     *
     * `kind` alone cannot tell a refusal from an outage: 403 and 503 are both
     * "http_error", and they need opposite handling — one is the site's
     * settled policy and must not be retried, the other is a site having a
     * moment and should be. Undefined for a timeout or a refused connection,
     * where no response existed to carry a status.
     */
    readonly status?: number,
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
  /* --- audit signals ------------------------------------------------- */
  /** Absolute internal URLs, for crawling beyond the first page. */
  internalUrls: string[];
  /** Images with whether they carry alt text. */
  images: { src: string; alt: string | null }[];
  canonical: string | null;
  /** Counted, not just the first: multiple H1s is itself the finding. */
  h1Count: number;
  /** True when a robots meta tag asks engines not to index the page. */
  noindex: boolean;
  /** Bytes of HTML, a rough page-weight signal. */
  htmlBytes: number;
  /* --- branding, for the onboarding preview -------------------------- */
  /**
   * The site's own icon and social image, absolute.
   *
   * Read here rather than fetched separately because the markup is already
   * parsed at this point — a second request for the same page to find one
   * <link rel="icon"> would double the wait on the screen that shows them.
   *
   * Null when absent rather than guessed at: /favicon.ico is a convention
   * rather than a guarantee, and a broken image in the preview looks worse
   * than no image.
   */
  faviconUrl: string | null;
  ogImageUrl: string | null;
  /**
   * Strings that might name the platform: stylesheet and script URLs, and the
   * generator meta tag.
   *
   * Collected here because this is the only place the original markup exists —
   * script and style elements are stripped moments later so they do not
   * pollute the visible text, and by the time anything downstream sees the
   * snapshot the fingerprints are gone.
   */
  platformSignals: string[];
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
    /*
      fetchPage, not fetch: Cloudflare blocks undici (the client behind Node's
      global fetch) by TLS fingerprint and answers 403 before the origin sees
      the request. See lib/websites/fetch-page.ts for the measurements.
    */
    return await fetchPage(
      url,
      {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml",
        /**
         * Any language, no preference.
         *
         * This asked for "en". On a multilingual site that served us the
         * English version, which we then auto-detected as English and wrote
         * over the customer's real language — so a Spanish business was
         * analysed, and had its articles planned, as though it were English.
         *
         * No preference means the site serves its own default: the version its
         * customers actually see, and therefore the one we should read.
         */
        "accept-language": "*",
      },
      FETCH_TIMEOUT_MS,
      controller.signal,
    );
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
/**
 * Reads a body, TRUNCATING at MAX_BYTES rather than failing.
 *
 * It used to throw, which meant a page over the cap produced nothing at all.
 * wix.com is the case that showed this up: 308KB compressed but far past 2MB
 * expanded, so a Wix site — one of the platforms we most want to recognise —
 * came back as "Page is too large to analyse" and the customer saw an error
 * on the first screen of setup.
 *
 * Two megabytes of a page is plenty. Everything that matters here lives in the
 * <head> and the first screens of markup: the title, the meta tags, the
 * stylesheet and script URLs that name the platform. What gets cut is the tail
 * of the body copy, which only shortens the text sample the model reads.
 *
 * The cap itself stays — it is what stops one hostile response exhausting a
 * worker — it simply stops being fatal.
 */
async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      // Keep what arrived, drop the rest, stop downloading.
      chunks.push(value);
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }

  const size = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  /*
    fatal: false, because truncating mid-page can cut a multi-byte character
    in half. A replacement character at the very end costs nothing; throwing
    on it would undo the point of truncating.
  */
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
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
      /**
       * A REFUSAL IS EXPLAINED, not reported as a number.
       *
       * "The site returned 403" is accurate and useless: the customer looks
       * at a site that loads perfectly in their browser and concludes our
       * product is broken. It is not — hermes.com and rolex.com refuse a
       * real Chrome user-agent from a residential IP too, because they run
       * enterprise bot management (DataDome, Akamai) that blocks every
       * automated client by policy.
       *
       * So the message says who is doing what, and that their site is fine.
       * 401 is separated because it has a fix the customer controls; a 403
       * from a bot wall does not, and pretending otherwise sends them hunting
       * for a setting that is not there.
       */
      if (response.status === 403 || response.status === 451) {
        throw new CrawlError(
          "This site blocks automated visitors, so we cannot read it. " +
            "Your site is fine — the block is a security setting on it.",
          "http_error",
          response.status,
        );
      }

      if (response.status === 401) {
        throw new CrawlError(
          "This site asks for a password before it will show a page.",
          "http_error",
          response.status,
        );
      }

      throw new CrawlError(
        `The site returned ${response.status}`,
        "http_error",
        response.status,
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

  /**
   * Platform fingerprints, read BEFORE the strip below.
   *
   * That line removes script and style elements so they do not pollute the
   * visible text — which also removes the most reliable evidence of what the
   * site is built with. Squarespace and Webflow name themselves hundreds of
   * times in a page and almost never in an image URL.
   */
  const platformSignals: string[] = [];
  $("link[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (href && platformSignals.length < 120) platformSignals.push(href);
  });
  $("script[src]").each((_, element) => {
    const src = $(element).attr("src");
    if (src && platformSignals.length < 200) platformSignals.push(src);
  });
  const generator = $('meta[name="generator"]').attr("content");
  if (generator) platformSignals.push(generator);
  // Class names on <html> and <body> carry it too: Ghost uses gh-*, WordPress
  // adds wp-* body classes.
  for (const attr of [$("html").attr("class"), $("body").attr("class")]) {
    if (attr) platformSignals.push(attr);
  }

  // Script, style and template content is markup noise, never page copy.
  $("script, style, noscript, template, svg").remove();

  const headings: string[] = [];
  $("h1, h2, h3").each((_, element) => {
    const text = $(element).text().trim().replace(/\s+/g, " ");
    if (text && headings.length < 40) headings.push(text);
  });

  const origin = new URL(finalUrl).origin;

  /**
   * Resolves a possibly-relative asset path against the page it came from.
   *
   * Returns null for anything that will not load in an <img>: a data URI is
   * fine but pointless to store, and a malformed value would render as a
   * broken image in the preview.
   */
  const absolute = (value: string | null | undefined): string | null => {
    const raw = value?.trim();
    if (!raw || raw.startsWith("data:")) return null;
    try {
      return new URL(raw, finalUrl).toString();
    } catch {
      return null;
    }
  };

  /**
   * The favicon, preferring the larger declarations.
   *
   * apple-touch-icon first because it is typically 180px and looks right in a
   * preview, where a 16px .ico does not. Falls back through the standard
   * declarations and stops — no guess at /favicon.ico, since a 404 there
   * renders as a broken image.
   */
  const faviconUrl = (): string | null => {
    for (const selector of [
      'link[rel="apple-touch-icon"]',
      'link[rel="apple-touch-icon-precomposed"]',
      'link[rel="icon"][sizes]',
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
    ]) {
      const href = absolute($(selector).first().attr("href"));
      if (href) return href;
    }
    return null;
  };
  const internal = new Set<string>();
  // Absolute form, so the audit crawler can fetch these directly.
  const internalAbsolute = new Set<string>();
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
      if (internalAbsolute.size < 200) {
        // Fragments and queries point at the same document.
        resolved.hash = "";
        resolved.search = "";
        internalAbsolute.add(resolved.toString());
      }
    } else if (external.size < 50) {
      external.add(resolved.hostname.replace(/^www\./, ""));
    }
  });

  const text = $("body").text().replace(/\s+/g, " ").trim();

  const images: { src: string; alt: string | null }[] = [];
  $("img").each((_, element) => {
    if (images.length >= 100) return;
    const src = $(element).attr("src");
    if (!src) return;
    const alt = $(element).attr("alt");
    images.push({
      src: src.slice(0, 500),
      // An empty alt is valid for decorative images, so "" and a missing
      // attribute are recorded differently.
      alt: alt === undefined ? null : alt.trim(),
    });
  });

  const robots = ($('meta[name="robots"]').attr("content") ?? "").toLowerCase();

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
    internalUrls: [...internalAbsolute],
    images,
    platformSignals,
    faviconUrl: faviconUrl(),
    ogImageUrl: absolute(
      $('meta[property="og:image"]').attr("content") ??
        $('meta[name="twitter:image"]').attr("content") ??
        null,
    ),
    canonical: $('link[rel="canonical"]').attr("href")?.trim() || null,
    h1Count: $("h1").length,
    noindex: robots.includes("noindex"),
    htmlBytes: html.length,
  };
}
