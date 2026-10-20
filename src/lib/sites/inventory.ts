import "server-only";

import * as cheerio from "cheerio";
import { asc, eq } from "drizzle-orm";

import { isEntitledToSpend } from "@/lib/billing/entitled";
import { db } from "@/lib/db";
import { siteImages, sitePosts, websites } from "@/lib/db/schema";
import { safeFetch } from "@/lib/net/safe-fetch";

/**
 * What a customer's own WordPress site already has (client, 2026-10-20,
 * Image Studio): its articles in every language and the pictures in its media
 * library, read from WordPress's public REST API - the one every WordPress
 * site serves at /wp-json/, no plugin or password needed.
 *
 *  - Planning skips topics the site already covers, and new ideas are judged
 *    against the articles it has ("search for the actual blog posts first,
 *    and come with a new article idea").
 *  - Articles can use the site's own pictures ("searching for images from
 *    our current images and place inside the article").
 *  - Translations can link the post in their own language.
 *
 * Read gently: the site may sit behind a bot check (Image Studio is on Kinsta
 * and Cloudflare), so a run makes at most INVENTORY_LIMITS.requests requests,
 * a pause apart, once a day, and stops at the first sign of a challenge page
 * rather than retrying. What it read last time is kept when a read fails.
 */

export type InventoryPost = {
  postType: string;
  remoteId: number;
  title: string;
  url: string;
  language: string | null;
  publishedAt: Date | null;
};

export type InventoryImage = {
  remoteId: number;
  url: string;
  alt: string | null;
  title: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  uploadedAt: Date | null;
};

export type InventoryResult =
  | { status: "ok"; languages: string[]; posts: InventoryPost[]; images: InventoryImage[]; requests: number }
  | { status: "not_wordpress" | "blocked" | "error"; reason: string; requests: number };

export const INVENTORY_LIMITS = {
  /** Requests in one read, all together. */
  requests: 60,
  /** Article types read (posts first, then the site's own types). */
  types: 4,
  /** Articles read per type and language. */
  postsPerType: 1000,
  images: 2000,
  perPage: 100,
  /** Between two requests, so a read never looks like a crawl. */
  pauseMs: 300,
  timeoutMs: 20_000,
  maxBytes: 5 * 1024 * 1024,
} as const;

/** How often a site is read again; one without the public API is asked again weekly. */
export const INVENTORY_REFRESH_MS = 24 * 60 * 60 * 1000;
export const NOT_WORDPRESS_RECHECK_MS = 7 * INVENTORY_REFRESH_MS;

const USER_AGENT = "RepGet/1.0 (+https://www.repget.com)";

/** WordPress's own types and the usual plugins' that are never articles. */
const NOT_ARTICLES = new Set([
  "attachment",
  "page",
  "nav_menu_item",
  "product",
  "product_variation",
  "shop_order",
  "shop_coupon",
  "e-floating-buttons",
  "rm_content_editor",
  "rank_math_schema",
  "wpcode",
  "wpforms",
]);
const NOT_ARTICLE_PATTERN = /^wp_|elementor|template|snippet|schema|block|font|menu|navigation|popup|form|hook/i;

export type InventoryFetch = (url: string) => Promise<{ status: number; contentType: string; totalPages: number | null; text: string }>;

async function defaultFetch(url: string): ReturnType<InventoryFetch> {
  const response = await safeFetch(url, {
    headers: { accept: "application/json, text/html;q=0.8", "user-agent": USER_AGENT },
    timeoutMs: INVENTORY_LIMITS.timeoutMs,
    maxBytes: INVENTORY_LIMITS.maxBytes,
  });
  const pages = Number(response.headers.get("x-wp-totalpages"));
  return {
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    totalPages: Number.isFinite(pages) && pages > 0 ? pages : null,
    text: await response.text(),
  };
}

/** A bot check (Cloudflare, Kinsta) rather than the site: stop, never push through. */
function isChallenge(status: number, text: string): boolean {
  return status === 403 || status === 429 || status === 503 || /ki-cf-botcl|Checking your browser|cf-chl|Just a moment\.\.\./i.test(text.slice(0, 20_000));
}

const plainText = (html: unknown) => (typeof html === "string" ? cheerio.load(`<div>${html}</div>`)("div").text().replace(/\s+/g, " ").trim() : "");
const rendered = (value: unknown) => plainText((value as { rendered?: unknown } | null)?.rendered);
const dateOf = (value: unknown) => {
  if (typeof value !== "string") return null;
  const date = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};
const whole = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null);

/**
 * The languages a site publishes in, from the hreflang links on its home page
 * (WPML and the other multilingual plugins write them), default first - the
 * one whose address has no language folder. `extra` adds languages the
 * customer named that have no home page yet (Image Studio's Spanish).
 */
export function languagesFrom(homeHtml: string, origin: string, extra: string[] = []): string[] {
  const $ = cheerio.load(homeHtml);
  const found: { code: string; prefixed: boolean }[] = [];
  for (const el of $('link[rel="alternate"][hreflang]').toArray()) {
    const raw = ($(el).attr("hreflang") ?? "").toLowerCase();
    if (!raw || raw === "x-default") continue;
    const code = raw.split(/[-_]/)[0];
    if (!/^[a-z]{2,3}$/.test(code) || found.some((entry) => entry.code === code)) continue;
    let prefixed = true;
    try {
      const href = new URL($(el).attr("href") ?? "", origin);
      prefixed = new RegExp(`^/${code}(?:/|$)`, "i").test(href.pathname);
    } catch {
      // A broken href says nothing about which language is the default.
    }
    found.push({ code, prefixed });
  }
  const ordered = [...found.filter((entry) => !entry.prefixed), ...found.filter((entry) => entry.prefixed)].map((entry) => entry.code);
  for (const code of extra.map((value) => value.toLowerCase())) if (/^[a-z]{2,3}$/.test(code) && !ordered.includes(code)) ordered.push(code);
  return ordered.length > 1 ? ordered : [];
}

/**
 * A post's language from its address: a language folder ("/it/..."), or the
 * ?lang= some sites use; else the default language (the first). The address
 * decides, not the language asked for, in case a site ignores ?lang=.
 */
export function languageOf(url: string, asked: string | null, languages: string[]): string | null {
  if (!asked) return null;
  try {
    const address = new URL(url);
    const first = address.pathname.split("/")[1]?.toLowerCase();
    if (first && languages.includes(first)) return first;
    const param = address.searchParams.get("lang")?.toLowerCase();
    if (param && languages.includes(param)) return param;
  } catch {
    return asked;
  }
  return languages[0] ?? asked;
}

/**
 * Whether a page was the last. WordPress's own count decides: a page can come
 * back short while more follow, because it leaves out what it hides after
 * counting (Image Studio: 72 and 82 pictures on pages of 100, of 913 in 10
 * pages). A short page ends the reading only when there is no count; an empty
 * one always does.
 */
function lastPage(received: number, totalPages: number | null, page: number): boolean {
  if (received === 0) return true;
  return totalPages !== null ? page >= totalPages : received < INVENTORY_LIMITS.perPage;
}

/** Reads one site's articles and pictures. Never throws: what went wrong is the result. */
export async function readWordPressInventory(
  siteUrl: string,
  options: { extraLanguages?: string[]; fetch?: InventoryFetch; pauseMs?: number } = {},
): Promise<InventoryResult> {
  const fetchPage = options.fetch ?? defaultFetch;
  const pause = options.pauseMs ?? INVENTORY_LIMITS.pauseMs;
  let requests = 0;
  let origin: string;
  try {
    origin = new URL(siteUrl).origin;
  } catch {
    return { status: "error", reason: "the website address is not valid", requests };
  }

  type Answer = { ok: true; json: unknown; totalPages: number | null } | { ok: false; result: InventoryResult };
  const ask = async (path: string, html = false): Promise<Answer | { ok: true; html: string }> => {
    if (requests >= INVENTORY_LIMITS.requests) return { ok: false, result: { status: "error", reason: "the site has more than one read can take", requests } };
    if (requests > 0 && pause > 0) await new Promise((resolve) => setTimeout(resolve, pause));
    requests += 1;
    let page: Awaited<ReturnType<InventoryFetch>>;
    try {
      page = await fetchPage(`${origin}${path}`);
    } catch (error) {
      return { ok: false, result: { status: "error", reason: error instanceof Error ? error.message.slice(0, 200) : "the site did not answer", requests } };
    }
    if (isChallenge(page.status, page.text)) {
      return { ok: false, result: { status: "blocked", reason: `the site answered ${page.status} with a bot check`, requests } };
    }
    if (html) return { ok: true, html: page.status < 400 ? page.text : "" };
    if (page.status === 404 || page.status === 401 || !/json/i.test(page.contentType)) {
      return { ok: false, result: { status: "not_wordpress", reason: `no public WordPress API (${page.status})`, requests } };
    }
    if (page.status >= 400) return { ok: false, result: { status: "error", reason: `the WordPress API answered ${page.status}`, requests } };
    try {
      return { ok: true, json: JSON.parse(page.text), totalPages: page.totalPages };
    } catch {
      return { ok: false, result: { status: "not_wordpress", reason: "the WordPress API did not answer JSON", requests } };
    }
  };

  // Which types hold articles.
  const types = await ask("/wp-json/wp/v2/types");
  if (!types.ok) return types.result;
  if (!("json" in types) || !types.json || typeof types.json !== "object") return { status: "not_wordpress", reason: "no list of content types", requests };
  const bases: { slug: string; base: string }[] = [];
  for (const [slug, raw] of Object.entries(types.json as Record<string, unknown>)) {
    const base = (raw as { rest_base?: unknown } | null)?.rest_base;
    if (typeof base !== "string" || !/^[a-z0-9_-]+$/i.test(base)) continue;
    if (slug !== "post" && (NOT_ARTICLES.has(slug) || NOT_ARTICLE_PATTERN.test(slug))) continue;
    bases.push({ slug, base });
  }
  bases.sort((a, b) => Number(b.slug === "post") - Number(a.slug === "post"));
  const articleTypes = bases.slice(0, INVENTORY_LIMITS.types);

  // Which languages.
  const home = await ask("/", true);
  if (!home.ok) return home.result;
  const languages = languagesFrom("html" in home ? home.html : "", origin, options.extraLanguages ?? []);
  const asks: (string | null)[] = languages.length > 1 ? languages : [null];

  const posts = new Map<string, InventoryPost>();
  for (const type of articleTypes) {
    for (const language of asks) {
      for (let page = 1; page <= INVENTORY_LIMITS.postsPerType / INVENTORY_LIMITS.perPage; page += 1) {
        const query = `per_page=${INVENTORY_LIMITS.perPage}&page=${page}&orderby=date&order=desc&_fields=id,link,title,date${language ? `&lang=${language}` : ""}`;
        const answer = await ask(`/wp-json/wp/v2/${type.base}?${query}`);
        if (!answer.ok) {
          // A type the site keeps private (401) or a page past the end: that type is done, the read goes on.
          if (answer.result.status === "not_wordpress" || answer.result.status === "error") break;
          return answer.result;
        }
        const list = "json" in answer && Array.isArray(answer.json) ? answer.json : [];
        for (const raw of list as Record<string, unknown>[]) {
          const url = typeof raw.link === "string" ? raw.link : "";
          const id = whole(raw.id);
          const title = rendered(raw.title);
          if (!url.startsWith("http") || id === null || !title || posts.has(url)) continue;
          posts.set(url, { postType: type.base, remoteId: id, title: title.slice(0, 300), url: url.slice(0, 1000), language: languageOf(url, language, languages), publishedAt: dateOf(raw.date) });
        }
        if (lastPage(list.length, "totalPages" in answer ? answer.totalPages : null, page)) break;
      }
    }
  }

  const images = new Map<string, InventoryImage>();
  for (let page = 1; page <= INVENTORY_LIMITS.images / INVENTORY_LIMITS.perPage; page += 1) {
    const answer = await ask(`/wp-json/wp/v2/media?media_type=image&per_page=${INVENTORY_LIMITS.perPage}&page=${page}&orderby=date&order=desc&_fields=id,source_url,alt_text,title,caption,media_details,date`);
    if (!answer.ok) {
      if (answer.result.status === "not_wordpress" || answer.result.status === "error") break;
      return answer.result;
    }
    const list = "json" in answer && Array.isArray(answer.json) ? answer.json : [];
    for (const raw of list as Record<string, unknown>[]) {
      const url = typeof raw.source_url === "string" ? raw.source_url : "";
      const id = whole(raw.id);
      if (!url.startsWith("http") || id === null || images.has(url)) continue;
      const details = (raw.media_details ?? {}) as { width?: unknown; height?: unknown };
      images.set(url, {
        remoteId: id,
        url: url.slice(0, 1000),
        alt: plainText(raw.alt_text).slice(0, 500) || null,
        title: rendered(raw.title).slice(0, 300) || null,
        caption: rendered(raw.caption).slice(0, 500) || null,
        width: whole(details.width),
        height: whole(details.height),
        uploadedAt: dateOf(raw.date),
      });
    }
    if (lastPage(list.length, "totalPages" in answer ? answer.totalPages : null, page)) break;
  }

  return { status: "ok", languages, posts: [...posts.values()], images: [...images.values()], requests };
}

/**
 * The websites whose inventory is due, among those with a plan (free
 * articles included: they write articles too), oldest read first.
 */
export async function websitesDueForInventory(limit = 50, now: Date = new Date()): Promise<string[]> {
  const rows = await db
    .select({ id: websites.id, inventoryCheckedAt: websites.inventoryCheckedAt, inventoryStatus: websites.inventoryStatus })
    .from(websites)
    .orderBy(asc(websites.inventoryCheckedAt));
  const due: string[] = [];
  for (const row of rows) {
    if (due.length >= limit) break;
    if (!inventoryDue(row, now)) continue;
    if ((await isEntitledToSpend(row.id, { freeArticles: true })).ok) due.push(row.id);
  }
  return due;
}

/** Whether a website's inventory is due to be read again. */
export function inventoryDue(site: { inventoryCheckedAt: Date | null; inventoryStatus: string | null }, now: Date = new Date()): boolean {
  if (!site.inventoryCheckedAt) return true;
  const age = now.getTime() - site.inventoryCheckedAt.getTime();
  return age >= (site.inventoryStatus === "not_wordpress" ? NOT_WORDPRESS_RECHECK_MS : INVENTORY_REFRESH_MS);
}

/**
 * Reads one website's inventory and stores it: replaced whole when the read
 * worked; kept as it was when the site was blocked or failed (a stale list
 * beats none); emptied when the site has no public WordPress API.
 */
export async function refreshSiteInventory(
  websiteId: string,
  options: { extraLanguages?: string[]; fetch?: InventoryFetch; pauseMs?: number; now?: Date } = {},
): Promise<{ status: InventoryResult["status"]; posts: number; images: number }> {
  const [site] = await db.select({ url: websites.url }).from(websites).where(eq(websites.id, websiteId)).limit(1);
  if (!site) return { status: "error", posts: 0, images: 0 };
  const result = await readWordPressInventory(site.url, options);
  const now = options.now ?? new Date();

  await db.transaction(async (tx) => {
    if (result.status === "ok" || result.status === "not_wordpress") {
      await tx.delete(sitePosts).where(eq(sitePosts.websiteId, websiteId));
      await tx.delete(siteImages).where(eq(siteImages.websiteId, websiteId));
    }
    if (result.status === "ok") {
      for (let start = 0; start < result.posts.length; start += 500) {
        await tx.insert(sitePosts).values(result.posts.slice(start, start + 500).map((post) => ({ ...post, websiteId }))).onConflictDoNothing();
      }
      for (let start = 0; start < result.images.length; start += 500) {
        await tx.insert(siteImages).values(result.images.slice(start, start + 500).map((image) => ({ ...image, websiteId }))).onConflictDoNothing();
      }
    }
    await tx
      .update(websites)
      .set({
        inventoryCheckedAt: now,
        inventoryStatus: result.status === "ok" || result.status === "not_wordpress" ? result.status : `${result.status}: ${result.reason}`.slice(0, 300),
        ...(result.status === "ok" ? { siteLanguages: result.languages } : {}),
      })
      .where(eq(websites.id, websiteId));
  });

  return result.status === "ok"
    ? { status: "ok", posts: result.posts.length, images: result.images.length }
    : { status: result.status, posts: 0, images: 0 };
}
