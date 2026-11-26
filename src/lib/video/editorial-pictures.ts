import "server-only";

import { createHash } from "node:crypto";

import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import sharp, { type Metadata } from "sharp";

import { siteScope, inScope } from "@/lib/articles/link-guard";
import { fetchWithinScope } from "@/lib/articles/link-verify";
import { heldFromCustomerSql, publicFieldSql, publicRevisionSql } from "@/lib/articles/review";
import { db } from "@/lib/db";
import { articles, providerCache } from "@/lib/db/schema";
import { safeFetch } from "@/lib/net/safe-fetch";

import { configuredProviders, searchProvider, STOCK_PROVIDERS, type StockCandidate } from "./footage";
import {
  blogListingLink,
  blogPostLinks,
  dedupePictures,
  importantPageLinks,
  isLikelyPhoto,
  MAX_RATIO,
  MIN_SHORT_SIDE,
  pictureKey,
  picturesInHtml,
  type PictureCandidate,
  type SitePicture,
} from "./editorial-images";
import { isVideoStorageConfigured, MAX_PHOTO_BYTES, storeSharedFile } from "./storage";

/**
 * A website's own pictures for its editorial videos (client, 2026-11-26:
 * "reads images from blog posts and website"), collected when its ideas are
 * written:
 *
 *  1. its live articles' pictures - each one's cover (articles.image_url) and
 *     the pictures in its text - newest articles first (public revision only);
 *  2. its pages': the home page and up to five important ones it links to
 *     (about, services, products, gallery...): each one's share picture and
 *     the large pictures of its main content. Fetched through the SSRF-safe
 *     layer (fetchWithinScope: public addresses only, redirects kept on the
 *     site), 8 s and 768 KB a page, once a week;
 *  3. its newest blog posts', read from its own blog listing (/blog, /news...)
 *     even when RepGet does not write that blog (owner, 2026-11-26).
 *
 * Below STOCK_TOP_UP_BELOW pictures of its own, the pool is topped up with
 * licensed stock photos on the website's topics (gatherStock), after its own,
 * copied the same way - so every editorial idea shows real pictures, fixed
 * with the idea, and its preview is the video.
 *
 * Each picture is then COPIED into the video bucket, once per website: the
 * render runs in a Vercel Sandbox and the preview in the customer's browser,
 * and a customer's own address is not reliably reachable from either - a
 * firewall refusing headless Chrome, hotlink protection, plain http, a
 * picture renamed next week. The copy is re-encoded (a JPEG at most 1920 px,
 * EXIF orientation applied, metadata stripped), which also gives its real
 * size: under MIN_SHORT_SIDE on the short side, a strip, an animation or a
 * transparent graphic (a logo) is refused. Copies live under
 * shared/editorial/<website>/ - outside the website's folder, so deleting
 * one video (lib/video/delete.ts) never removes a picture the others use.
 *
 * No migration: what was found and copied is one provider_cache row per
 * website (provider EDITORIAL_CACHE, endpoint the website id), like the link
 * checks' cache (lib/articles/link-verify.ts).
 *
 * Without video storage (tests; a production without storage cannot make
 * videos anyway) nothing is fetched and there are no pictures: the ideas keep
 * their usual directions. A developer's machine stores in public/ as
 * storage.ts does. Every failure means fewer pictures, never a failed batch.
 */

const EDITORIAL_CACHE = "video-editorial-pictures";
const PAGES_FRESH_MS = 7 * 86_400_000;
/** A page that did not answer is tried again the next day, not the next week. */
const PAGES_RETRY_MS = 86_400_000;
/** A picture that failed to download is tried again after this; a refused one is not. */
const FAILED_RETRY_MS = 86_400_000;
const CACHE_DAYS = 180;
const MAX_COPIES_KEPT = 120;
const MAX_ARTICLES = 12;
const MAX_ARTICLE_CANDIDATES = 24;
const MAX_WEBSITE_CANDIDATES = 20;
const MAX_EXTRA_PAGES = 5;
/** Blog posts read from the website's own blog listing (a blog RepGet does not write included). */
const MAX_BLOG_POSTS = 4;
/** New downloads one collection may make; the rest wait for the next batch. */
export const MAX_DOWNLOADS = 12;
/** The most pictures a website's pool holds. */
export const MAX_POOL = 24;
const PAGE_BYTES = 768 * 1024;
const PICTURE_TIMEOUT_MS = 8_000;
/** The whole collection's time; what does not fit waits for the next batch. */
const BUDGET_MS = 40_000;
const MAX_INPUT_PIXELS = 40_000_000;
const OUTPUT_LONG_SIDE = 1920;

export type CopyEntry =
  | { url: string; width: number; height: number; hash: string; at: string; graphic?: boolean }
  | { rejected: string; at: string }
  | { failed: true; at: string };

export type PictureCache = {
  v: 1;
  /** When the website's pages were last read (null: never). */
  pagesAt: string | null;
  /** The pictures found on its pages then. */
  website: PictureCandidate[];
  /** pictureKey(original address) -> its copy, or why there is none. */
  copies: Record<string, CopyEntry>;
  /** The stock photos a website with few pictures of its own was given, and for which searches (stockQueries). */
  stock?: { at: string; query: string; pictures: SitePicture[] };
};

export type ArticlePictures = { id: string; pageUrl: string | null; imageUrl: string | null; imageAlt: string | null; bodyHtml: string | null };

export type Normalized = { data: Buffer; width: number; height: number; hash: string; graphic?: boolean } | { rejected: string };

export type PictureDeps = {
  /** A page of the website (null: no usable answer). */
  fetchHtml(url: string): Promise<{ finalUrl: string; html: string } | null>;
  /** A picture's bytes (null: no usable answer). */
  download(url: string): Promise<Buffer | null>;
  normalize(data: Buffer): Promise<Normalized>;
  /** Stores a normalized JPEG, returning its public address. */
  store(data: Buffer): Promise<string>;
  now(): Date;
  /** True once the collection's time is up: nothing new is started. */
  expired(): boolean;
};

const emptyCache = (): PictureCache => ({ v: 1, pagesAt: null, website: [], copies: {} });

/** The article candidates: each article's cover, then its text's pictures, newest article first. */
export function articleCandidates(list: ArticlePictures[]): PictureCandidate[] {
  const out: PictureCandidate[] = [];
  for (const article of list) {
    const cover: PictureCandidate | null = article.imageUrl
      ? { url: article.imageUrl, alt: article.imageAlt?.trim() || null, source: "article", pageUrl: article.pageUrl, width: null, height: null, articleId: article.id }
      : null;
    if (cover && isLikelyPhoto(cover)) out.push(cover);
    if (article.bodyHtml) out.push(...picturesInHtml(article.bodyHtml, article.pageUrl ?? "https://invalid.example/", "article", article.id));
  }
  return dedupePictures(out).slice(0, MAX_ARTICLE_CANDIDATES);
}

/**
 * The website's pages' candidates: the home page's, then its newest blog
 * posts' (read from its own blog listing, so a blog RepGet does not write
 * counts too), then up to MAX_EXTRA_PAGES important pages'.
 */
export async function websiteCandidates(site: { url: string; domain?: string | null }, deps: Pick<PictureDeps, "fetchHtml" | "expired">): Promise<{ candidates: PictureCandidate[]; answered: boolean }> {
  const home = await deps.fetchHtml(site.url).catch(() => null);
  if (!home) return { candidates: [], answered: false };
  const scope = siteScope(site);
  const inSite = (url: string) => inScope(url, scope);
  const found = picturesInHtml(home.html, home.finalUrl, "website");
  const listingUrl = blogListingLink(home.html, home.finalUrl, inSite);
  const links = importantPageLinks(home.html, home.finalUrl, inSite, MAX_EXTRA_PAGES);
  const [listing, ...pages] = await Promise.all([
    listingUrl && !deps.expired() ? deps.fetchHtml(listingUrl).catch(() => null) : null,
    ...links.map((url) => (deps.expired() ? null : deps.fetchHtml(url).catch(() => null))),
  ]);
  if (listing) {
    const postLinks = blogPostLinks(listing.html, listing.finalUrl, inSite, MAX_BLOG_POSTS);
    const posts = await Promise.all(postLinks.map((url) => (deps.expired() ? null : deps.fetchHtml(url).catch(() => null))));
    for (const post of posts) if (post) found.push(...picturesInHtml(post.html, post.finalUrl, "website"));
  }
  for (const page of pages) if (page) found.push(...picturesInHtml(page.html, page.finalUrl, "website"));
  return { candidates: dedupePictures(found).slice(0, MAX_WEBSITE_CANDIDATES), answered: true };
}

/* ------------------------------------------------------------ stock top-up */

/**
 * Below this many pictures of its own a website's editorial ideas are topped
 * up with licensed stock photos (owner, 2026-11-26: every idea shows real
 * pictures, chosen with the idea, so its preview is the video - never the old
 * text-only slides with "footage chosen later").
 */
export const STOCK_TOP_UP_BELOW = 4;
/** The most stock photos a website's pool holds. */
export const MAX_STOCK = 10;
const MAX_STOCK_QUERIES = 3;
const STOCK_FRESH_MS = 7 * 86_400_000;

/**
 * The stock searches for a website: its industry, services and article
 * keywords, as short plain phrases, each once, at most MAX_STOCK_QUERIES.
 * Never the brand name (a search for it finds nothing of the business). Pure.
 */
export function stockQueries(topics: readonly (string | null | undefined)[]): string[] {
  const out: string[] = [];
  for (const topic of topics) {
    const phrase = (topic ?? "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 4)
      .join(" ");
    if (phrase.length < 3 || out.includes(phrase)) continue;
    out.push(phrase);
    if (out.length >= MAX_STOCK_QUERIES) break;
  }
  return out;
}

export type StockDeps = Pick<PictureDeps, "download" | "normalize" | "store" | "now" | "expired"> & {
  /** Photo search (the first configured stock provider that answers); [] when none is set up. */
  search(query: string): Promise<StockCandidate[]>;
};

const stockKey = (credit: { provider: string; providerId: string }) => `${credit.provider}:${credit.providerId}`;

/**
 * The website's stock photos, each copied into the video bucket like its own
 * pictures: reused for a week for the same searches, then searched again. A
 * search or download that fails means fewer photos, never a failed batch; with
 * nothing new the ones found before are kept.
 */
export async function gatherStock(
  input: { topics: readonly (string | null | undefined)[]; cache: PictureCache["stock"] | undefined },
  deps: StockDeps,
): Promise<{ pictures: SitePicture[]; cache: PictureCache["stock"] | undefined }> {
  const queries = stockQueries(input.topics);
  const now = deps.now();
  const previous = input.cache;
  if (queries.length === 0) return { pictures: previous?.pictures ?? [], cache: previous };
  const key = queries.join("|");
  if (previous && previous.query === key && previous.pictures.length > 0 && now.getTime() - new Date(previous.at).getTime() < STOCK_FRESH_MS) {
    return { pictures: previous.pictures, cache: previous };
  }
  const per = Math.ceil(MAX_STOCK / queries.length);
  const chosen: StockCandidate[] = [];
  const seen = new Set<string>();
  for (const query of queries) {
    if (deps.expired()) break;
    const found = await deps.search(query).catch(() => [] as StockCandidate[]);
    const usable = found.filter((candidate) => candidate.kind === "image" && Math.min(candidate.width, candidate.height) >= MIN_SHORT_SIDE && !seen.has(stockKey(candidate)));
    for (const candidate of usable.slice(0, per)) {
      seen.add(stockKey(candidate));
      chosen.push(candidate);
    }
  }
  const known = new Map((previous?.pictures ?? []).flatMap((picture) => (picture.credit ? [[stockKey(picture.credit), picture] as const] : [])));
  const copied = await inTurn(chosen.slice(0, MAX_STOCK), 4, async (candidate): Promise<SitePicture | null> => {
    const again = known.get(stockKey(candidate));
    if (again) return again;
    if (deps.expired()) return null;
    try {
      const bytes = await deps.download(candidate.downloadUrl);
      if (!bytes) return null;
      const picture = await deps.normalize(bytes);
      if ("rejected" in picture) return null;
      const url = await deps.store(picture.data);
      return {
        url,
        // The provider's tags: what picturesForIdea matches an idea's words against.
        alt: candidate.tags.slice(0, 6).join(", ") || null,
        source: "stock",
        pageUrl: candidate.sourceUrl,
        width: picture.width,
        height: picture.height,
        ...(picture.graphic ? { graphic: true } : {}),
        articleId: null,
        credit: { provider: candidate.provider, providerId: candidate.providerId, author: candidate.author, licence: candidate.licence },
      };
    } catch {
      return null;
    }
  });
  const pictures = copied.filter((picture): picture is SitePicture => picture !== null);
  if (pictures.length === 0) return { pictures: previous?.pictures ?? [], cache: previous };
  return { pictures, cache: { at: now.toISOString(), query: key, pictures } };
}

/** Runs `work` over `items`, `limit` at a time, results in order. */
async function inTurn<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        out[index] = await work(items[index]);
      }
    }),
  );
  return out;
}

/**
 * The website's picture pool from its articles and pages, each a copy of
 * ours, in order (articles first), and the cache to keep. Pictures copied
 * before are reused, never downloaded again; at most MAX_DOWNLOADS new ones.
 */
export async function gatherPictures(
  input: { site: { url: string; domain?: string | null }; articles: ArticlePictures[]; cache: PictureCache | null },
  deps: PictureDeps,
): Promise<{ pictures: SitePicture[]; cache: PictureCache }> {
  const now = deps.now();
  const cache: PictureCache = input.cache?.v === 1 ? { ...input.cache, copies: { ...input.cache.copies } } : emptyCache();
  const pagesAge = cache.pagesAt ? now.getTime() - new Date(cache.pagesAt).getTime() : Infinity;
  if (!(pagesAge < PAGES_FRESH_MS)) {
    const read = await websiteCandidates(input.site, deps);
    if (read.answered) {
      cache.website = read.candidates;
      cache.pagesAt = now.toISOString();
    } else {
      // Kept as they were; read again in a day.
      cache.pagesAt = new Date(now.getTime() - PAGES_FRESH_MS + PAGES_RETRY_MS).toISOString();
    }
  }
  const candidates = dedupePictures([...articleCandidates(input.articles), ...cache.website]);

  // What needs a download: never copied, not refused, not failed lately.
  const wanted = candidates.filter((candidate) => {
    const entry = cache.copies[pictureKey(candidate.url)];
    if (!entry) return true;
    // A copy made before diagrams were told apart (2026-11-26) is made again once, to learn which it is.
    if ("url" in entry) return entry.graphic === undefined;
    return "failed" in entry && now.getTime() - new Date(entry.at).getTime() > FAILED_RETRY_MS;
  });
  await inTurn(wanted.slice(0, MAX_DOWNLOADS), 4, async (candidate) => {
    if (deps.expired()) return;
    const key = pictureKey(candidate.url);
    const at = deps.now().toISOString();
    // A copy being made again only to learn whether it is a diagram stays as it was when that fails (a photograph).
    const before = cache.copies[key];
    const failed = (): CopyEntry => (before && "url" in before ? { ...before, graphic: false } : { failed: true, at });
    try {
      const bytes = await deps.download(candidate.url);
      if (!bytes) {
        cache.copies[key] = failed();
        return;
      }
      const picture = await deps.normalize(bytes);
      if ("rejected" in picture) {
        cache.copies[key] = { rejected: picture.rejected, at };
        return;
      }
      const url = await deps.store(picture.data);
      cache.copies[key] = { url, width: picture.width, height: picture.height, hash: picture.hash, at, graphic: picture.graphic === true };
    } catch {
      cache.copies[key] = failed();
    }
  });

  const hashes = new Set<string>();
  const pictures: SitePicture[] = [];
  for (const candidate of candidates) {
    const entry = cache.copies[pictureKey(candidate.url)];
    if (!entry || !("url" in entry)) continue;
    // The same photograph under two addresses is used once.
    if (hashes.has(entry.hash)) continue;
    hashes.add(entry.hash);
    pictures.push({ url: entry.url, alt: candidate.alt, source: candidate.source, pageUrl: candidate.pageUrl, width: entry.width, height: entry.height, ...(entry.graphic ? { graphic: true } : {}), articleId: candidate.articleId });
    if (pictures.length >= MAX_POOL) break;
  }
  cache.copies = trimCopies(cache.copies);
  return { pictures, cache };
}

/** The newest MAX_COPIES_KEPT entries. */
function trimCopies(copies: Record<string, CopyEntry>): Record<string, CopyEntry> {
  const entries = Object.entries(copies);
  if (entries.length <= MAX_COPIES_KEPT) return copies;
  return Object.fromEntries(entries.sort((a, b) => b[1].at.localeCompare(a[1].at)).slice(0, MAX_COPIES_KEPT));
}

/* ------------------------------------------------------------ the real IO */

/**
 * A downloaded picture as a slide can use it: a photograph format, one frame,
 * no transparency (a logo or a graphic), at least MIN_SHORT_SIDE on its short
 * side and no strip; re-encoded as a JPEG of at most OUTPUT_LONG_SIDE.
 */
export async function normalizePicture(data: Buffer): Promise<Normalized> {
  let meta: Metadata;
  try {
    meta = await sharp(data, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    return { rejected: "unreadable" };
  }
  if (!meta.format || !["jpeg", "png", "webp", "avif", "heif"].includes(meta.format)) return { rejected: "format" };
  if ((meta.pages ?? 1) > 1) return { rejected: "animated" };
  if (meta.hasAlpha && meta.format !== "jpeg") return { rejected: "graphic" };
  const turned = (meta.orientation ?? 1) >= 5;
  const width = (turned ? meta.height : meta.width) ?? 0;
  const height = (turned ? meta.width : meta.height) ?? 0;
  if (Math.min(width, height) < MIN_SHORT_SIDE) return { rejected: "small" };
  if (Math.max(width, height) / Math.max(1, Math.min(width, height)) > MAX_RATIO) return { rejected: "strip" };
  try {
    const out = await sharp(data, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width: OUTPUT_LONG_SIDE, height: OUTPUT_LONG_SIDE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 84, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    return { data: out.data, width: out.info.width, height: out.info.height, hash: createHash("sha1").update(data).digest("hex"), graphic: await looksLikeGraphic(out.data) };
  } catch {
    return { rejected: "unreadable" };
  }
}

/**
 * Whether a picture is a diagram, chart or screenshot rather than a photograph:
 * most of it in a few flat colours and little tonal detail. Measured on
 * repget.com's blog diagrams (entropy 3.9-4.7, 86-89% in eight colours)
 * against photographs (6.4-7.6, at most 73%). Never throws: false.
 */
export async function looksLikeGraphic(data: Buffer): Promise<boolean> {
  try {
    const small = await sharp(data).resize(96, 96, { fit: "fill" }).removeAlpha().raw().toBuffer();
    const counts = new Map<number, number>();
    for (let i = 0; i + 2 < small.length; i += 3) {
      const key = ((small[i] >> 4) << 8) | ((small[i + 1] >> 4) << 4) | (small[i + 2] >> 4);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const flat = [...counts.values()].sort((a, b) => b - a).slice(0, 8).reduce((sum, n) => sum + n, 0) / (small.length / 3);
    const { entropy } = await sharp(data).stats();
    return flat >= 0.8 && entropy < 5.5;
  } catch {
    return false;
  }
}

const PAGE_HEADERS = {
  "user-agent": "Mozilla/5.0 (compatible; RepGetVideoPictures/1.0; +https://repget.com)",
  accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
};

/** A photo search: the configured providers in turn (Pixabay, then Pexels), the first with results. */
async function searchStockPhotos(query: string): Promise<StockCandidate[]> {
  for (const provider of configuredProviders(STOCK_PROVIDERS)) {
    if (provider.id === "collection") continue;
    const found = await searchProvider(provider, { query, kind: "image", perPage: 15 }).catch(() => [] as StockCandidate[]);
    if (found.length > 0) return found;
  }
  return [];
}

function realDeps(site: { id: string; url: string; domain?: string | null }): PictureDeps {
  const started = Date.now();
  const scope = siteScope(site);
  return {
    async fetchHtml(url) {
      const page = await fetchWithinScope(url, scope, { maxBytes: PAGE_BYTES, readBody: (type) => /html/i.test(type) });
      return page.ok && page.body ? { finalUrl: page.finalUrl, html: page.body } : null;
    },
    async download(url) {
      // Any public address (a CDN), checked at connect time and on every redirect hop.
      const response = await safeFetch(url, {
        headers: { "user-agent": PAGE_HEADERS["user-agent"], accept: "image/avif,image/webp,image/jpeg,image/png;q=0.9,*/*;q=0.1" },
        timeoutMs: PICTURE_TIMEOUT_MS,
        maxBytes: MAX_PHOTO_BYTES,
      });
      const type = response.headers.get("content-type") ?? "";
      if (response.status !== 200 || !/^image\//i.test(type) || /svg/i.test(type)) {
        await response.arrayBuffer().catch(() => null);
        return null;
      }
      return Buffer.from(await response.arrayBuffer());
    },
    normalize: normalizePicture,
    store: (data) => storeSharedFile(`editorial/${site.id}`, data, "image/jpeg"),
    now: () => new Date(),
    expired: () => Date.now() - started > BUDGET_MS,
  };
}

const cacheHash = (websiteId: string) => createHash("sha256").update(`${EDITORIAL_CACHE}|${websiteId}`).digest("hex");

async function readCache(websiteId: string): Promise<PictureCache | null> {
  const [row] = await db
    .select({ response: providerCache.response })
    .from(providerCache)
    .where(and(eq(providerCache.provider, EDITORIAL_CACHE), eq(providerCache.endpoint, websiteId), eq(providerCache.paramsHash, cacheHash(websiteId))));
  const value = row?.response as PictureCache | null | undefined;
  return value && value.v === 1 && typeof value.copies === "object" && Array.isArray(value.website) ? value : null;
}

async function writeCache(websiteId: string, cache: PictureCache, now: Date): Promise<void> {
  const expiresAt = new Date(now.getTime() + CACHE_DAYS * 86_400_000);
  await db
    .insert(providerCache)
    .values({ provider: EDITORIAL_CACHE, endpoint: websiteId, paramsHash: cacheHash(websiteId), response: cache, expiresAt })
    .onConflictDoUpdate({ target: providerCache.paramsHash, set: { response: cache, expiresAt, createdAt: now } });
}

/** The live articles' pictures as the public sees them (a held working copy's never). */
async function readArticles(websiteId: string): Promise<ArticlePictures[]> {
  const rows = await db
    .select({
      id: articles.id,
      pageUrl: articles.publishedUrl,
      imageUrl: publicFieldSql(articles.imageUrl, "imageUrl"),
      imageAlt: sql<string | null>`(case when ${heldFromCustomerSql} then ${articles.approvedRevision} ->> 'imageAlt' else ${articles.imageAlt} end)`,
      bodyHtml: sql<string | null>`(case when ${heldFromCustomerSql} then ${articles.approvedRevision} ->> 'bodyHtml' else ${articles.bodyHtml} end)`,
    })
    .from(articles)
    .where(and(eq(articles.websiteId, websiteId), isNotNull(articles.publishedUrl), isNotNull(articles.firstLiveAt), sql`${publicRevisionSql}`))
    .orderBy(desc(articles.firstLiveAt))
    .limit(MAX_ARTICLES);
  return rows;
}

/** Whether pictures can be copied here (see above): video storage, or a developer's machine. */
export function canCollectPictures(): boolean {
  return isVideoStorageConfigured() || process.env.NODE_ENV === "development";
}

/**
 * The website's editorial picture pool, collected and copied as above; an
 * empty pool on any failure (the ideas then keep their usual directions).
 */
export async function collectSitePictures(site: { id: string; url: string; domain?: string | null }, topics: readonly (string | null | undefined)[] = []): Promise<SitePicture[]> {
  if (!canCollectPictures()) return [];
  try {
    const [articleRows, cache] = await Promise.all([readArticles(site.id), readCache(site.id)]);
    const deps = realDeps(site);
    const result = await gatherPictures({ site, articles: articleRows, cache }, deps);
    let pictures = result.pictures;
    // Too few pictures of its own: licensed stock photos on its topics, after its own (owner, 2026-11-26).
    if (pictures.length < STOCK_TOP_UP_BELOW) {
      const stock = await gatherStock({ topics, cache: result.cache.stock }, { ...deps, search: searchStockPhotos });
      result.cache.stock = stock.cache;
      pictures = [...pictures, ...stock.pictures];
    }
    await writeCache(site.id, result.cache, deps.now()).catch((error) => console.error("[video] the editorial pictures were not cached", { websiteId: site.id, error }));
    return pictures;
  } catch (error) {
    console.error("[video] the editorial pictures could not be collected", { websiteId: site.id, error: error instanceof Error ? error.message : error });
    return [];
  }
}

/** `topics`: the website's industry, services and article keywords, for the stock top-up's searches. */
export type PictureSource = (site: { id: string; url: string; domain?: string | null }, topics?: readonly (string | null | undefined)[]) => Promise<SitePicture[]>;
