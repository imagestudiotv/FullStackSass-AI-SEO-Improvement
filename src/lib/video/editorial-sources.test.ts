import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { blogListingLink, blogPostLinks, editorialAssets, editorialSceneMedia, picturesForIdea, type SitePicture } from "./editorial-images";
import { gatherPictures, gatherStock, looksLikeGraphic, MAX_STOCK, normalizePicture, stockQueries, websiteCandidates, type PictureCache, type StockDeps } from "./editorial-pictures";
import type { StockCandidate } from "./footage";

/**
 * Where an editorial idea's pictures come from beyond the articles RepGet
 * wrote (owner, 2026-11-26): the website's own blog listing and posts, and -
 * for a website with too few pictures of its own - licensed stock photos,
 * copied and fixed with the idea so its preview is the video.
 */

const inSite = (url: string) => new URL(url).hostname.replace(/^www\./, "") === "shop.example";

const image = (n: number, extra: Partial<SitePicture> = {}): SitePicture => ({
  url: `https://store.example/shared/editorial/w/${n}.jpg`,
  alt: `Picture ${n}`,
  source: "article",
  pageUrl: "https://shop.example/blog/a",
  width: 1600,
  height: 1000,
  articleId: null,
  ...extra,
});

const stockPicture = (n: number, tags: string): SitePicture =>
  image(n, {
    source: "stock",
    alt: tags,
    pageUrl: `https://pixabay.com/photos/${n}/`,
    credit: { provider: "pixabay", providerId: String(n), author: "someone", licence: "Pixabay Content License" },
  });

describe("a website's own blog", () => {
  it("is found from its home page: the shortest listing link on the site, in any of the customers' languages", () => {
    const home = `<a href="/blog/some-post">A post</a><a href="https://shop.example/en/blog/">Blog</a><a href="/blog">Blog</a><a href="https://other.example/blog">Theirs</a>`;
    expect(blogListingLink(home, "https://shop.example/", inSite)).toBe("https://shop.example/blog");
    expect(blogListingLink(`<a href="/articole/">Articole</a>`, "https://shop.example/", inSite)).toBe("https://shop.example/articole");
    expect(blogListingLink(`<a href="/about">About</a>`, "https://shop.example/", inSite)).toBeNull();
  });

  it("gives its newest posts: under the listing, never its pages, tags, categories or another site", () => {
    const listing = `
      <a href="/blog/newest-post">Newest</a>
      <a href="/blog/page/2">Older posts</a>
      <a href="/blog/tag/tips">Tips</a>
      <a href="/blog/category/news/">News</a>
      <a href="/blog/second-post?utm=x">Second</a>
      <a href="/blog/newest-post#comments">Comments</a>
      <a href="https://other.example/blog/theirs">Theirs</a>
      <a href="/blog/third-post">Third</a>`;
    expect(blogPostLinks(listing, "https://shop.example/blog", inSite, 4)).toEqual([
      "https://shop.example/blog/newest-post",
      "https://shop.example/blog/second-post",
      "https://shop.example/blog/third-post",
    ]);
    expect(blogPostLinks(listing, "https://shop.example/blog", inSite, 1)).toEqual(["https://shop.example/blog/newest-post"]);
  });

  it("finds posts at the site's root (WordPress) from the listing's post titles", () => {
    const listing = `<nav><a href="/contact">Contact</a></nav>
      <article><h2><a href="/how-we-shoot-weddings/">How we shoot weddings</a></h2></article>
      <article><h2><a href="/category/weddings/">Weddings</a></h2><h2><a href="/our-new-studio/">Our new studio</a></h2></article>`;
    expect(blogPostLinks(listing, "https://shop.example/blog", inSite)).toEqual(["https://shop.example/how-we-shoot-weddings", "https://shop.example/our-new-studio"]);
  });

  it("gives its posts' pictures with the home page's, before the important pages'", async () => {
    const pages: Record<string, string> = {
      "https://shop.example/": `<main><img src="https://shop.example/uploads/home.jpg"><a href="/blog">Blog</a><a href="/about">About</a></main>`,
      "https://shop.example/blog": `<main><a href="/blog/one">One</a><a href="/blog/two">Two</a></main>`,
      "https://shop.example/blog/one": `<article><img src="https://shop.example/uploads/post-one.jpg"></article>`,
      "https://shop.example/blog/two": `<article><img src="https://shop.example/uploads/post-two.jpg"></article>`,
      "https://shop.example/about": `<main><img src="https://shop.example/uploads/about.jpg"></main>`,
    };
    const fetchHtml = vi.fn(async (url: string) => (pages[url] ? { finalUrl: url, html: pages[url] } : null));
    const { candidates, answered } = await websiteCandidates({ url: "https://shop.example/", domain: "shop.example" }, { fetchHtml, expired: () => false });
    expect(answered).toBe(true);
    expect(candidates.map((candidate) => candidate.url)).toEqual([
      "https://shop.example/uploads/home.jpg",
      "https://shop.example/uploads/post-one.jpg",
      "https://shop.example/uploads/post-two.jpg",
      "https://shop.example/uploads/about.jpg",
    ]);
  });
});

/* ------------------------------------------------------------------ stock */

const candidate = (n: number, extra: Partial<StockCandidate> = {}): StockCandidate => ({
  provider: "pixabay",
  providerId: String(n),
  kind: "image",
  downloadUrl: `https://cdn.pixabay.example/${n}.jpg`,
  width: 853,
  height: 1280,
  durationMs: null,
  sizeBytes: null,
  licence: "Pixabay Content License",
  sourceUrl: `https://pixabay.com/photos/${n}/`,
  author: `author${n}`,
  tags: ["dentist", "clinic", `tag${n}`],
  ...extra,
});

function stockDeps(results: Record<string, StockCandidate[]>, now = new Date("2026-11-26T08:00:00Z"), overrides: Partial<StockDeps> = {}) {
  const searches: string[] = [];
  const downloads: string[] = [];
  let stored = 0;
  const deps: StockDeps = {
    search: vi.fn(async (query: string) => {
      searches.push(query);
      return results[query] ?? [];
    }),
    download: vi.fn(async (url: string) => {
      downloads.push(url);
      return Buffer.from(url);
    }),
    normalize: vi.fn(async (data: Buffer) => ({ data, width: 853, height: 1280, hash: data.toString() })),
    store: vi.fn(async () => `https://store.example/shared/editorial/w/stock-${++stored}.jpg`),
    now: () => now,
    expired: () => false,
    ...overrides,
  };
  return { deps, searches, downloads };
}

describe("the stock top-up", () => {
  it("searches the website's industry, services and keywords as short phrases, never twice, at most three", () => {
    expect(stockQueries(["Dental Clinic!", null, "teeth whitening at home in two weeks flat", "dental clinic", "  ", "invisalign", "veneers"])).toEqual([
      "dental clinic",
      "teeth whitening at home",
      "invisalign",
    ]);
    expect(stockQueries([null, undefined, "a"])).toEqual([]);
  });

  it("copies licensed photos into our storage with their credit and tags, spread over the searches", async () => {
    const results = {
      "dental clinic": Array.from({ length: 12 }, (_, i) => candidate(i + 1)),
      invisalign: [candidate(100), candidate(101, { width: 400, height: 300 }), candidate(102, { kind: "video" })],
    };
    const { deps, downloads } = stockDeps(results);
    const { pictures, cache } = await gatherStock({ topics: ["dental clinic", "invisalign"], cache: undefined }, deps);
    expect(pictures).toHaveLength(MAX_STOCK - 4);
    // Half the photos each search may give, a small or non-photo result never.
    expect(pictures.filter((picture) => picture.credit?.providerId.startsWith("10"))).toHaveLength(1);
    expect(downloads.every((url) => url.startsWith("https://cdn.pixabay.example/"))).toBe(true);
    expect(pictures[0]).toMatchObject({
      url: "https://store.example/shared/editorial/w/stock-1.jpg",
      source: "stock",
      pageUrl: "https://pixabay.com/photos/1/",
      alt: "dentist, clinic, tag1",
      articleId: null,
      credit: { provider: "pixabay", providerId: "1", author: "author1", licence: "Pixabay Content License" },
    });
    expect(cache).toMatchObject({ at: "2026-11-26T08:00:00.000Z", query: "dental clinic|invisalign" });
  });

  it("is reused for a week for the same topics, then searched again without copying a known photo twice", async () => {
    const results = { "dental clinic": [candidate(1), candidate(2)] };
    const first = stockDeps(results);
    const { cache } = await gatherStock({ topics: ["dental clinic"], cache: undefined }, first.deps);
    const again = stockDeps(results, new Date("2026-11-30T08:00:00Z"));
    expect((await gatherStock({ topics: ["dental clinic"], cache }, again.deps)).pictures).toEqual(cache!.pictures);
    expect(again.searches).toEqual([]);
    const later = stockDeps({ "dental clinic": [candidate(2), candidate(3)] }, new Date("2026-12-04T08:00:00Z"));
    const refreshed = await gatherStock({ topics: ["dental clinic"], cache }, later.deps);
    expect(later.searches).toEqual(["dental clinic"]);
    expect(later.downloads).toEqual(["https://cdn.pixabay.example/3.jpg"]);
    expect(refreshed.pictures.map((picture) => picture.credit?.providerId)).toEqual(["2", "3"]);
  });

  it("keeps what it had when a search or the storage fails, and needs no search without topics", async () => {
    const cache: PictureCache["stock"] = { at: "2026-11-01T08:00:00.000Z", query: "dental clinic", pictures: [stockPicture(7, "dentist")] };
    const failing = stockDeps({}, undefined, { search: vi.fn(async () => Promise.reject(new Error("429"))) });
    expect((await gatherStock({ topics: ["dental clinic"], cache }, failing.deps)).pictures).toEqual(cache.pictures);
    const broken = stockDeps({ "dental clinic": [candidate(1)] }, undefined, { store: vi.fn(async () => Promise.reject(new Error("down"))) });
    expect((await gatherStock({ topics: ["dental clinic"], cache }, broken.deps)).pictures).toEqual(cache.pictures);
    const none = stockDeps({});
    expect(await gatherStock({ topics: [], cache: undefined }, none.deps)).toEqual({ pictures: [], cache: undefined });
    expect(none.searches).toEqual([]);
  });
});

describe("an idea's pictures with stock photos", () => {
  const pool: SitePicture[] = [image(1, { articleId: "a" }), image(2, { source: "website", pageUrl: "https://shop.example/" }), stockPicture(10, "office, laptop, team"), stockPicture(11, "dentist, smile, teeth")];

  it("come after the website's own, those matching the idea's words first, with their credit kept", () => {
    const chosen = picturesForIdea(pool, "a", 0, 8, "Whiter teeth before the wedding");
    expect(chosen.map((picture) => picture.url.replace(/.*\//, ""))).toEqual(["1.jpg", "2.jpg", "11.jpg", "10.jpg"]);
    expect(chosen[2].credit).toMatchObject({ provider: "pixabay", providerId: "11" });
    expect(chosen[0]).not.toHaveProperty("credit");
  });

  it("are recorded as stock with the provider's licence and author when the video is made, and previewed as the same files", () => {
    const images = picturesForIdea([stockPicture(11, "dentist"), image(1)], null, 0);
    const assets = editorialAssets(images, [0, 1]);
    expect(assets[0]).toMatchObject({ url: image(1).url, source: "article", provider: "article", licence: "The website's own picture" });
    expect(assets[1]).toMatchObject({
      url: stockPicture(11, "").url,
      source: "stock",
      provider: "pixabay",
      providerId: "11",
      licence: "Pixabay Content License",
      author: "someone",
      sourceUrl: "https://pixabay.com/photos/11/",
    });
    // The preview shows exactly the files the video is made with.
    const media = editorialSceneMedia(images, [0, 1], 2)!;
    expect(media.map((item) => item?.url)).toEqual(assets.map((asset) => asset.url));
    expect(media[1]?.source).toBe("stock");
  });
});

/* --------------------------------------------------------------- diagrams */

describe("a diagram among the pictures", () => {
  const flat = () =>
    sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 250, g: 250, b: 252 } } })
      .composite([{ input: Buffer.from('<svg width="1200" height="800"><rect x="100" y="100" width="400" height="200" fill="#4f46e5"/><rect x="700" y="400" width="300" height="250" fill="#f97316"/></svg>'), left: 0, top: 0 }])
      .jpeg()
      .toBuffer();
  const noisy = () => {
    const pixels = Buffer.alloc(1200 * 800 * 3);
    let seed = 7;
    for (let i = 0; i < pixels.length; i++) pixels[i] = (seed = (seed * 1103515245 + 12345) & 0x7fffffff) >> 23;
    return sharp(pixels, { raw: { width: 1200, height: 800, channels: 3 } }).blur(1.2).jpeg().toBuffer();
  };

  it("is told apart from a photograph when it is copied", async () => {
    expect(await looksLikeGraphic(await flat())).toBe(true);
    expect(await looksLikeGraphic(await noisy())).toBe(false);
    expect(await looksLikeGraphic(Buffer.from("not a picture"))).toBe(false);
    expect(await normalizePicture(await flat())).toMatchObject({ graphic: true });
    expect(await normalizePicture(await noisy())).toMatchObject({ graphic: false });
  });

  it("comes after the photographs in an idea's pictures, marked so the video frames it", () => {
    const pool = [image(1, { articleId: "a", graphic: true }), image(2, { articleId: "a" }), image(3, { source: "website", graphic: true })];
    const chosen = picturesForIdea(pool, "a", 0);
    expect(chosen.map((picture) => [picture.url.replace(/.*\//, ""), picture.graphic ?? false])).toEqual([
      ["2.jpg", false],
      ["1.jpg", true],
      ["3.jpg", true],
    ]);
  });

  it("is learnt for a copy made before: made again once, kept as it was when that fails", async () => {
    const site = { url: "https://shop.example", domain: "shop.example" };
    const articles = [{ id: "a1", pageUrl: "https://shop.example/blog/one", imageUrl: "https://shop.example/uploads/one.jpg", imageAlt: null, bodyHtml: null }];
    const old: PictureCache = {
      v: 1,
      pagesAt: "2026-11-26T07:00:00.000Z",
      website: [],
      copies: { "shop.example/uploads/one.jpg": { url: "https://store.example/old.jpg", width: 1600, height: 1000, hash: "h", at: "2026-11-26T07:00:00.000Z" } },
    };
    const base = {
      fetchHtml: vi.fn(async () => null),
      normalize: vi.fn(async (data: Buffer) => ({ data, width: 1600, height: 1000, hash: "h", graphic: true })),
      store: vi.fn(async () => "https://store.example/new.jpg"),
      now: () => new Date("2026-11-26T09:00:00Z"),
      expired: () => false,
    };
    const learnt = await gatherPictures({ site, articles, cache: old }, { ...base, download: vi.fn(async () => Buffer.from("x")) });
    expect(learnt.pictures[0]).toMatchObject({ url: "https://store.example/new.jpg", graphic: true });
    // Known now: never made again.
    const again = { ...base, download: vi.fn(async () => Buffer.from("x")) };
    await gatherPictures({ site, articles, cache: learnt.cache }, again);
    expect(again.download).not.toHaveBeenCalled();
    const down = await gatherPictures({ site, articles, cache: old }, { ...base, download: vi.fn(async () => null) });
    expect(down.pictures[0]).toMatchObject({ url: "https://store.example/old.jpg" });
    expect(down.pictures[0].graphic).toBeUndefined();
  });
});
