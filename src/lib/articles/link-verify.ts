import { createHash } from "node:crypto";

import * as cheerio from "cheerio";
import { and, eq, gte, inArray } from "drizzle-orm";

import { inScope, type LinkStatus, type LinkVerdict, type SiteScope } from "@/lib/articles/link-guard";
import { keyWords, overlap, pathWords } from "@/lib/articles/link-words";
import { db } from "@/lib/db";
import { providerCache } from "@/lib/db/schema";
import { UnsafeUrlError, type SafeFetchDeps } from "@/lib/net/safe-fetch";
import { fetchPage } from "@/lib/websites/fetch-page";

/**
 * Does a page on the customer's own site exist? Checked over the network,
 * with every request through the SSRF-safe layer (fetchPage -> safeFetch):
 * public addresses only, checked at connect time, every redirect hop checked.
 *
 * THE ANSWERS ARE KEPT APART. A 404 or 410, an error page served as 200, and
 * a redirect to the homepage are proof that a page is gone ("missing"). A
 * timeout, a 5xx, a 429 or a firewall's 403 are not: they are "unavailable",
 * and nothing is deleted because of one.
 *
 * Results are cached per website in provider_cache, keyed by a hash of the
 * website id and the URL, so one tenant's answers are never read for
 * another's, and a plugin poll does not re-check a page checked an hour ago.
 */

/** Identified as ourselves first; fetchPage retries a 403 once with browser headers. */
const HEADERS = {
  "user-agent": "Mozilla/5.0 (compatible; RepGetLinkCheck/1.0; +https://repget.com)",
  accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
};

/** One request, body included. */
const REQUEST_TIMEOUT_MS = 8_000;
/** Enough of a page to read its title and headings; the rest is never downloaded. */
const MAX_PAGE_BYTES = 256 * 1024;
const MAX_REDIRECTS = 5;

/** How long an answer is trusted before the page is checked again. */
export const FRESHNESS_MS: Record<LinkStatus, number> = {
  ok: 7 * 24 * 60 * 60 * 1000,
  missing: 24 * 60 * 60 * 1000,
  rejected: 24 * 60 * 60 * 1000,
  // Short: a temporary failure should be retried soon, not remembered.
  unavailable: 15 * 60 * 1000,
};

const CACHE_PROVIDER = "internal-link";

export type VerifyDeps = {
  /** Test seam: simulated DNS and sockets for the SSRF layer. */
  net?: SafeFetchDeps;
  now?: () => Date;
};

/* ------------------------------------------------------------------------ */
/* One fetch, bounded                                                       */
/* ------------------------------------------------------------------------ */

type Fetched =
  | { ok: true; status: number; finalUrl: string; contentType: string; body: string | null }
  | { ok: false; status: LinkStatus; reason: string; httpStatus?: number };

/**
 * Reads a body to its end. Bodies here are requested with overflow
 * "truncate", so safeFetch ends them at the byte limit and drops the
 * connection itself: nothing is ever cancelled part way. (Cancelling a
 * safeFetch body mid-stream can make Node's stream bridge throw "Controller is
 * already closed" outside any handler - an uncaught error in a worker.)
 */
async function drain(response: Response): Promise<string> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  // fatal: false - a truncated page may end mid-character.
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

/**
 * GET within the site: follows at most MAX_REDIRECTS same-site redirects
 * itself, and refuses to follow one that leaves the site - it is never
 * fetched, so an open redirect cannot walk us anywhere.
 */
export async function fetchWithinScope(
  url: string,
  scope: SiteScope,
  options: { maxBytes: number; readBody: (contentType: string) => boolean },
  deps: VerifyDeps = {},
): Promise<Fetched> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!inScope(current, scope)) {
      return { ok: false, status: "rejected", reason: `redirects off the website (${safeHost(current)})` };
    }
    let response: Response;
    try {
      response = await fetchPage(
        current,
        HEADERS,
        REQUEST_TIMEOUT_MS,
        AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        deps.net ?? {},
        { maxBytes: options.maxBytes, overflow: "truncate" },
      );
    } catch (error) {
      if (error instanceof UnsafeUrlError) {
        return { ok: false, status: "rejected", reason: "not a public address" };
      }
      return { ok: false, status: "unavailable", reason: "no response (timeout or network error)" };
    }

    if (response.status >= 300 && response.status < 400) {
      await drain(response).catch(() => "");
      const location = response.headers.get("location");
      if (!location) return { ok: false, status: "unavailable", reason: "redirect without a destination", httpStatus: response.status };
      try {
        current = new URL(location, current).toString();
      } catch {
        return { ok: false, status: "unavailable", reason: "unreadable redirect", httpStatus: response.status };
      }
      continue;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (response.status >= 200 && response.status < 300) {
      let text: string;
      try {
        text = await drain(response);
      } catch {
        return { ok: false, status: "unavailable", reason: "the page stopped loading part way" };
      }
      const body = options.readBody(contentType) ? text : null;
      return { ok: true, status: response.status, finalUrl: current, contentType, body };
    }

    await drain(response).catch(() => "");
    if (response.status === 404 || response.status === 410) {
      return { ok: false, status: "missing", reason: `the page does not exist (${response.status})`, httpStatus: response.status };
    }
    if (response.status === 429) {
      return { ok: false, status: "unavailable", reason: "rate limited (429)", httpStatus: 429 };
    }
    if (response.status === 401 || response.status === 403 || response.status === 451) {
      return { ok: false, status: "unavailable", reason: `the site refused the check (${response.status})`, httpStatus: response.status };
    }
    return { ok: false, status: "unavailable", reason: `the site answered ${response.status}`, httpStatus: response.status };
  }
  return { ok: false, status: "unavailable", reason: "too many redirects" };
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

/* ------------------------------------------------------------------------ */
/* Judging a page                                                           */
/* ------------------------------------------------------------------------ */

/** Titles and headings of an error page, in the languages customers write in. */
const ERROR_PAGE =
  /(^|[^\p{L}])(404|page not found|not found|nothing (was )?found|no encontrad[ao]|página no encontrada|pagina non trovata|non trovat[ao]|page (non )?introuvable|seite nicht gefunden|nicht gefunden|pagina niet gevonden|página não encontrada)([^\p{L}]|$)/iu;

const LOGIN_PATH = /\/(wp-login\.php|wp-admin(\/|$)|login|log-in|signin|sign-in|my-account|account\/login)(\/|$|\?)/i;

/** A verdict for one URL, from what the site actually answered. */
export async function verifyUrl(url: string, scope: SiteScope, deps: VerifyDeps = {}): Promise<LinkVerdict> {
  const now = (deps.now ?? (() => new Date()))();
  const base = { url, checkedAt: now.toISOString() };

  if (!inScope(url, scope)) {
    return { ...base, status: "rejected", finalUrl: null, httpStatus: null, reason: "not on the website", title: null, isHtml: false };
  }

  const fetched = await fetchWithinScope(
    url,
    scope,
    { maxBytes: MAX_PAGE_BYTES, readBody: (type) => /html/i.test(type) },
    deps,
  );
  if (!fetched.ok) {
    return {
      ...base,
      status: fetched.status,
      finalUrl: null,
      httpStatus: fetched.httpStatus ?? null,
      reason: fetched.reason,
      title: null,
      isHtml: false,
    };
  }

  const isHtml = /html/i.test(fetched.contentType);
  const answered = (status: LinkStatus, reason: string, title: string | null): LinkVerdict => ({
    ...base,
    status,
    finalUrl: fetched.finalUrl,
    httpStatus: fetched.status,
    reason,
    title,
    isHtml,
  });

  const original = new URL(url);
  const final = new URL(fetched.finalUrl);
  const moved = fetched.finalUrl !== url;

  // A missing page sent to the homepage is a missing page.
  if (moved && original.pathname.replace(/\/+$/, "") !== "" && final.pathname.replace(/\/+$/, "") === "" && !final.search) {
    return answered("missing", "redirected to the homepage", null);
  }
  if (LOGIN_PATH.test(final.pathname + final.search)) {
    return answered("rejected", "a login page", null);
  }

  let title: string | null = null;
  if (isHtml && fetched.body !== null) {
    const $ = cheerio.load(fetched.body);
    title = $("title").first().text().replace(/\s+/g, " ").trim() || null;
    const h1 = $("h1").first().text().replace(/\s+/g, " ").trim();
    const bodyClass = $("body").attr("class") ?? "";
    // WordPress marks its not-found template with body class "error404".
    if (/(^|\s)error404(\s|$)/.test(bodyClass) || (title && ERROR_PAGE.test(title)) || (h1 && ERROR_PAGE.test(h1))) {
      return answered("missing", "an error page served as a normal page", title);
    }
    if ($('input[type="password"]').length > 0 && /log ?in|sign ?in|accedi|iniciar sesi|connexion|anmelden/i.test(`${title} ${h1}`)) {
      return answered("rejected", "a login page", title);
    }
  }

  // A moved page must still be about the same thing.
  if (moved) {
    const wanted = keyWords(pathWords(url));
    const landed = new Set([...keyWords(pathWords(fetched.finalUrl)), ...keyWords(title ?? "")]);
    if (wanted.size >= 2 && overlap(wanted, landed) === 0) {
      return answered("rejected", "redirected to an unrelated page", title);
    }
    return answered("ok", "redirected to a related page", title);
  }

  return answered("ok", "the page exists", title);
}

/* ------------------------------------------------------------------------ */
/* Many URLs, cached, within a time budget                                  */
/* ------------------------------------------------------------------------ */

export function cacheKey(websiteId: string, url: string): string {
  return createHash("sha256").update(`internal-link|${websiteId}|${url}`).digest("hex");
}

export type VerifyOptions = VerifyDeps & {
  /** Wall-clock budget for network checks; what does not fit is "unavailable". */
  budgetMs?: number;
  concurrency?: number;
  /** False for a dry run: nothing is written, not even the cache. */
  writeCache?: boolean;
};

/** Cached answers for this website that are still fresh. */
export async function cachedVerdicts(
  websiteId: string,
  urls: string[],
  now: Date = new Date(),
): Promise<Map<string, LinkVerdict>> {
  const out = new Map<string, LinkVerdict>();
  if (urls.length === 0) return out;
  const byHash = new Map(urls.map((url) => [cacheKey(websiteId, url), url]));
  const rows = await db
    .select({ paramsHash: providerCache.paramsHash, response: providerCache.response })
    .from(providerCache)
    .where(
      and(
        eq(providerCache.provider, CACHE_PROVIDER),
        eq(providerCache.endpoint, websiteId),
        inArray(providerCache.paramsHash, [...byHash.keys()]),
        gte(providerCache.expiresAt, now),
      ),
    );
  for (const row of rows) {
    const url = byHash.get(row.paramsHash);
    const verdict = row.response as LinkVerdict | null;
    // The hash already binds website and URL; the payload is checked too.
    if (url && verdict && verdict.url === url) out.set(url, verdict);
  }
  return out;
}

/** Every fresh "ok" page cached for this website: verified targets at no network cost. */
export async function cachedPages(websiteId: string, now: Date = new Date()): Promise<LinkVerdict[]> {
  const rows = await db
    .select({ response: providerCache.response })
    .from(providerCache)
    .where(
      and(
        eq(providerCache.provider, CACHE_PROVIDER),
        eq(providerCache.endpoint, websiteId),
        gte(providerCache.expiresAt, now),
      ),
    )
    .limit(1000);
  return rows
    .map((row) => row.response as LinkVerdict | null)
    .filter((verdict): verdict is LinkVerdict => Boolean(verdict && verdict.status === "ok"));
}

async function storeVerdict(websiteId: string, verdict: LinkVerdict, now: Date): Promise<void> {
  const expiresAt = new Date(now.getTime() + FRESHNESS_MS[verdict.status]);
  await db
    .insert(providerCache)
    .values({
      provider: CACHE_PROVIDER,
      endpoint: websiteId,
      paramsHash: cacheKey(websiteId, verdict.url),
      response: verdict,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: providerCache.paramsHash,
      set: { response: verdict, expiresAt, createdAt: now },
    });
}

/**
 * Verdicts for a website's URLs: fresh cached answers first, then network
 * checks, a few at a time, until the budget runs out. A URL not reached in
 * time is "unavailable", which removes nothing from stored content.
 */
export async function verifyUrls(
  websiteId: string,
  urls: string[],
  scope: SiteScope,
  options: VerifyOptions = {},
): Promise<Map<string, LinkVerdict>> {
  const now = (options.now ?? (() => new Date()))();
  const unique = [...new Set(urls)];
  const verdicts = await cachedVerdicts(websiteId, unique, now);
  const pending = unique.filter((url) => !verdicts.has(url));

  const deadline = Date.now() + (options.budgetMs ?? 10_000);
  const concurrency = Math.max(1, options.concurrency ?? 4);
  let next = 0;

  const worker = async () => {
    while (next < pending.length) {
      const url = pending[next++];
      if (Date.now() >= deadline) {
        verdicts.set(url, {
          url,
          status: "unavailable",
          finalUrl: null,
          httpStatus: null,
          reason: "not checked in time",
          title: null,
          isHtml: false,
          checkedAt: now.toISOString(),
        });
        continue;
      }
      const verdict = await verifyUrl(url, scope, options);
      verdicts.set(url, verdict);
      if (options.writeCache !== false) {
        await storeVerdict(websiteId, verdict, now).catch(() => {
          // A cache write failing costs a re-check later, nothing more.
        });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
  return verdicts;
}
