import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import {
  dedupePictures,
  editorialAssets,
  editorialParts,
  editorialSceneMedia,
  importantPageLinks,
  isLikelyPhoto,
  largestInSrcset,
  pictureKey,
  picturesForIdea,
  picturesInHtml,
  plainScript,
  plainText,
  pointTitleMax,
  type SitePicture,
} from "./editorial-images";
import { articleCandidates, gatherPictures, MAX_DOWNLOADS, normalizePicture, type PictureCache, type PictureDeps } from "./editorial-pictures";
import type { EditorialImage, ProductionChoices, ShotPlan, VideoScript } from "./formats";
import { previewSceneProps } from "./preview-media";
import { allowedDirections, assignDirections, buildPlan, isEditorialSlot, settleDirections, type Slot } from "./strategy/creative";

/**
 * The editorial structure (client, 2026-11-26: "a second one that reads
 * images from blog posts and website and create a clean carousel"): which
 * pictures count, where they are found, in which order an idea uses them,
 * which ideas are editorial, and the *highlight* marks kept out of every
 * text that is not on screen.
 */

const SCRIPT: VideoScript = {
  hook: "Instagram just gave you *an advantage*",
  points: [
    { title: "Reply the *same day*", detail: "People *remember* who answered.", stat: null },
    { title: "Post your *real* work", detail: "", stat: null },
    { title: "Pin the *best* three", detail: "First impressions decide.", stat: null },
  ],
  proof: "*Use it*",
  cta: "Book your *shoot*",
};

const PRODUCTION: ProductionChoices = { audio: "text_music", narration: "natural", captionStyle: "bold", music: "auto", duration: "30-45", showHook: true, includeCta: true, ctaText: null };

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

describe("the highlight marks", () => {
  it("are taken out of a text, paired or stray", () => {
    expect(plainText("Instagram just gave you *an advantage*. *Use it*")).toBe("Instagram just gave you an advantage. Use it");
    expect(plainText("**Bold** and a stray * star")).toBe("Bold and a stray star");
    expect(plainText("No marks here")).toBe("No marks here");
  });

  it("are taken out of every text of a script", () => {
    expect(JSON.stringify(plainScript(SCRIPT))).not.toContain("*");
    expect(plainScript(SCRIPT).points[0]).toEqual({ title: "Reply the same day", detail: "People remember who answered.", stat: null });
  });

  it("leave an editorial point title room for a statement", () => {
    expect(pointTitleMax("editorial")).toBeGreaterThanOrEqual(80);
    expect(pointTitleMax("footage")).toBe(48);
  });
});

describe("which pictures count", () => {
  it("refuses logos, icons, tracking pixels, SVGs and GIFs, small and strip-shaped pictures", () => {
    const ok = { alt: null, width: null, height: null };
    expect(isLikelyPhoto({ url: "https://shop.example/wp-content/uploads/2026/05/studio-shoot.jpg", ...ok })).toBe(true);
    expect(isLikelyPhoto({ url: "https://cdn.example/images/abc123?w=1600", ...ok })).toBe(true);
    expect(isLikelyPhoto({ url: "https://shop.example/logo.png", ...ok })).toBe(false);
    expect(isLikelyPhoto({ url: "https://shop.example/a.jpg", alt: "Company logo", width: null, height: null })).toBe(false);
    expect(isLikelyPhoto({ url: "https://shop.example/icons/cart.png", ...ok })).toBe(false);
    expect(isLikelyPhoto({ url: "https://shop.example/hero.svg", ...ok })).toBe(false);
    expect(isLikelyPhoto({ url: "https://shop.example/anim.gif", ...ok })).toBe(false);
    expect(isLikelyPhoto({ url: "https://www.facebook.com/tr?id=1&ev=PageView", ...ok })).toBe(false);
    expect(isLikelyPhoto({ url: "data:image/png;base64,AAAA", ...ok })).toBe(false);
    expect(isLikelyPhoto({ url: "https://shop.example/a.jpg", alt: null, width: 400, height: 300 })).toBe(false);
    expect(isLikelyPhoto({ url: "https://shop.example/a.jpg", alt: null, width: 3000, height: 700 })).toBe(false);
    expect(isLikelyPhoto({ url: "https://shop.example/a.jpg", alt: null, width: 1200, height: 800 })).toBe(true);
  });

  it("knows one picture in its sizes and copies", () => {
    expect(pictureKey("https://www.shop.example/uploads/team-1024x683.jpg?ver=2")).toBe(pictureKey("https://shop.example/uploads/team.jpg"));
    expect(pictureKey("https://shop.example/uploads/team-scaled.jpg")).toBe(pictureKey("https://shop.example/uploads/team.jpg"));
    expect(dedupePictures([{ url: "https://shop.example/a-300x200.jpg" }, { url: "https://shop.example/b.jpg" }, { url: "https://shop.example/a.jpg" }])).toEqual([
      { url: "https://shop.example/a-300x200.jpg" },
      { url: "https://shop.example/b.jpg" },
    ]);
  });

  it("takes a srcset's largest picture", () => {
    expect(largestInSrcset("/a-300.jpg 300w, /a-1600.jpg 1600w, /a-800.jpg 800w", "https://shop.example/page")).toEqual({ url: "https://shop.example/a-1600.jpg", width: 1600 });
    expect(largestInSrcset("", "https://shop.example/")).toBeNull();
  });
});

describe("where a page's pictures are", () => {
  const page = `<html><head>
      <meta property="og:image" content="/uploads/share.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
    </head><body>
      <header><img src="/uploads/header-photo.jpg" width="1600" height="900"></header>
      <nav><img src="/uploads/menu-photo.jpg"></nav>
      <main>
        <img src="/uploads/thumb-small.jpg" width="150" height="150">
        <img data-src="/uploads/lazy.jpg" src="data:image/gif;base64,R0lGOD" alt="Our studio">
        <img src="/uploads/hero-768x512.jpg" srcset="/uploads/hero-768x512.jpg 768w, /uploads/hero.jpg 1800w" width="768" height="512" alt="A product shoot">
        <img src="/uploads/hero.jpg">
        <a href="/about/">About</a><a href="/services">Services</a><a href="/privacy-policy">Privacy</a>
        <a href="/blog/2026/05/a-very-long-post">Post</a><a href="https://other.example/services">Elsewhere</a><a href="/">Home</a>
      </main>
      <footer><img src="/uploads/footer.jpg"></footer>
    </body></html>`;

  it("are its share picture, then its main content's, never the header, menu or footer's", () => {
    const found = picturesInHtml(page, "https://shop.example/", "website");
    expect(found.map((picture) => picture.url)).toEqual(["https://shop.example/uploads/share.jpg", "https://shop.example/uploads/lazy.jpg", "https://shop.example/uploads/hero.jpg"]);
    expect(found[0]).toMatchObject({ source: "website", pageUrl: "https://shop.example/", width: 1200, height: 630 });
    // The srcset's 1800 px file, its declared shape scaled to it.
    expect(found[2]).toMatchObject({ width: 1800, height: 1200, alt: "A product shoot" });
  });

  it("links to its important pages only, on the site", () => {
    const inSite = (url: string) => new URL(url).hostname === "shop.example";
    expect(importantPageLinks(page, "https://shop.example/", inSite)).toEqual(["https://shop.example/about", "https://shop.example/services"]);
  });

  it("of an article are every picture in its text, with the article", () => {
    const body = `<h2>One</h2><p>x</p><img src="https://shop.example/uploads/one.jpg" alt="One" width="1280" height="720"><img src="https://shop.example/uploads/icon.png">`;
    const found = articleCandidates([{ id: "a1", pageUrl: "https://shop.example/blog/a", imageUrl: "https://shop.example/uploads/cover.jpg", imageAlt: "Cover", bodyHtml: body }]);
    expect(found.map((picture) => [picture.url, picture.articleId, picture.source])).toEqual([
      ["https://shop.example/uploads/cover.jpg", "a1", "article"],
      ["https://shop.example/uploads/one.jpg", "a1", "article"],
    ]);
  });
});

describe("an idea's pictures", () => {
  const pool: SitePicture[] = [
    image(1, { articleId: "a" }),
    image(2, { articleId: "b" }),
    image(3, { articleId: "a" }),
    image(4, { articleId: "c" }),
    image(5, { source: "website", articleId: null, pageUrl: "https://shop.example/" }),
    image(6, { source: "website", articleId: null, pageUrl: "https://shop.example/about" }),
  ];
  const urls = (list: EditorialImage[]) => list.map((picture) => Number(/(\d+)\.jpg$/.exec(picture.url)![1]));

  it("are its own article's first, then the other articles', then the pages'", () => {
    expect(urls(picturesForIdea(pool, "a", 0))).toEqual([1, 3, 2, 4, 5, 6]);
    expect(urls(picturesForIdea(pool, null, 0))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("open on different pictures across the batch, each once, at most the limit", () => {
    expect(urls(picturesForIdea(pool, null, 1))[0]).not.toBe(urls(picturesForIdea(pool, null, 0))[0]);
    expect(picturesForIdea(pool, "a", 2, 3)).toHaveLength(3);
    expect(new Set(urls(picturesForIdea([...pool, ...pool], null, 0))).size).toBe(6);
    // The pool's own field is not part of the plan's pictures.
    expect(picturesForIdea(pool, "a", 0)[0]).not.toHaveProperty("articleId");
  });

  it("put landscape and portrait photographs before near-squares", () => {
    const square = image(7, { width: 1000, height: 1000 });
    expect(urls(picturesForIdea([square, image(8)], null, 0))).toEqual([8, 7]);
  });
});

describe("the scenes' pictures", () => {
  const plan = { direction: "editorial", pacing: "calm", captionStyle: "bold", musicMood: null, scenes: [], recipe: "r", images: [image(1), image(2)] } as ShotPlan;

  it("follow the parts shown, cover first, again from the start", () => {
    const parts = editorialParts(SCRIPT, PRODUCTION, plan, "reel");
    expect(parts).toEqual([0, 1, 2, 3, 4, 5]);
    const media = editorialSceneMedia(plan.images!, parts, 6)!;
    expect(media.map((item) => item?.url)).toEqual([1, 2, 1, 2, 1, 2].map((n) => image(n).url));
    expect(media[0]).toEqual({ url: image(1).url, kind: "image", source: "article" });
  });

  it("always have the cover on a carousel, and nothing on a part not shown", () => {
    const off = { ...PRODUCTION, showHook: false, includeCta: false };
    expect(editorialParts(SCRIPT, off, plan, "carousel")).toEqual([0, 1, 2, 3, 4]);
    expect(editorialParts(SCRIPT, off, plan, "reel")).toEqual([1, 2, 3, 4]);
    const media = editorialSceneMedia(plan.images!, [1, 2, 3, 4], 6)!;
    expect(media[0]).toBeNull();
    expect(media[5]).toBeNull();
    expect(media[1]?.url).toBe(image(1).url);
  });

  it("are the made video's assets: the website's own pictures, never stock or AI, a retry's kept", () => {
    const assets = editorialAssets(plan.images!, [0, 1, 2]);
    expect(assets).toHaveLength(3);
    expect(assets[0]).toMatchObject({ sceneIndex: 0, url: image(1).url, kind: "image", source: "article", provider: "article", licence: "The website's own picture", sourceUrl: "https://shop.example/blog/a" });
    expect(editorialAssets([image(5, { source: "website" })], [0])[0].provider).toBe("website");
    const kept = { ...assets[1], url: "https://store.example/kept.jpg" };
    expect(editorialAssets(plan.images!, [0, 1, 2], [kept]).find((asset) => asset.sceneIndex === 1)?.url).toBe("https://store.example/kept.jpg");
  });

  it("are the preview's media before the video is made; other ideas keep their clip", () => {
    const withScenes = { ...plan, scenes: [] };
    expect(previewSceneProps(false, withScenes, SCRIPT, PRODUCTION, "carousel", null).sceneMedia?.[0]?.url).toBe(image(1).url);
    expect(previewSceneProps(true, withScenes, SCRIPT, PRODUCTION, "reel", null)).toEqual({});
    const clip = { url: "https://store.example/clip.mp4", kind: "video" as const, source: "stock" as const };
    expect(previewSceneProps(false, { ...withScenes, direction: "meme", images: null }, SCRIPT, PRODUCTION, "reel", clip)).toEqual({ sceneMedia: [clip] });
    expect(previewSceneProps(false, null, SCRIPT, PRODUCTION, "reel", null)).toEqual({});
  });
});

describe("which ideas are editorial", () => {
  it("every non-viral one, carousel, reel or Story, while the website has two pictures of its own", () => {
    expect(isEditorialSlot("educational", 2)).toBe(true);
    expect(isEditorialSlot("promotional", 5)).toBe(true);
    expect(isEditorialSlot("authority", 1)).toBe(false);
    expect(isEditorialSlot("viral", 10)).toBe(false);
    for (const format of ["reel", "story", "carousel"] as const) {
      expect(allowedDirections("educational", format, "auto", true)).toEqual(["editorial"]);
      expect(allowedDirections("viral", format, "auto", true)).not.toContain("editorial");
    }
  });

  it("are assigned and settled as editorial, the viral ones and the rest unchanged", () => {
    const slots: Slot[] = [
      { category: "viral", format: "reel" },
      { category: "educational", format: "reel", editorial: true },
      { category: "authority", format: "carousel", editorial: true },
      { category: "viral", format: "story" },
      { category: "promotional", format: "story", editorial: true },
      { category: "educational", format: "reel", editorial: true },
    ];
    const planned = assignDirections(slots, "auto", { seed: 4 });
    slots.forEach((slot, index) => {
      if (slot.editorial) expect(planned[index]).toBe("editorial");
      else expect(["meme", "storytelling", "footage", "text_music"]).toContain(planned[index]);
    });
    // The writer may not switch an editorial idea away, nor make a viral one editorial.
    const settled = settleDirections(slots, planned, ["editorial", "voiceover", "footage", "editorial", "animated", null], "auto");
    slots.forEach((slot, index) => (slot.editorial ? expect(settled[index]).toBe("editorial") : expect(settled[index]).not.toBe("editorial")));
    // Without the pictures nothing is editorial.
    const plain = assignDirections(slots.map(({ category, format }) => ({ category, format })), "auto", { seed: 4 });
    expect(plain).not.toContain("editorial");
  });

  it("have a plan of the website's pictures: one scene per part, its pictures, the cover in its recipe", () => {
    const input = {
      direction: "editorial" as const,
      format: "reel" as const,
      script: SCRIPT,
      scenes: [{ query: "photographer with camera", kind: "video" as const, overlay: "x", reaction: "y" }],
      captionStyle: "bold" as const,
      music: "auto" as const,
      ownMedia: true,
      articlePicture: true,
      fallbackQuery: "Instagram",
      images: [image(1), image(2)],
    };
    const plan = buildPlan(input);
    expect(Array.isArray(plan.scenes)).toBe(true);
    expect(plan.scenes).toHaveLength(6);
    expect(plan.scenes.every((scene) => scene.visual.source === "article" && scene.visual.kind === "image" && scene.overlay === null)).toBe(true);
    expect(plan.images).toEqual([image(1), image(2)]);
    expect(plan.recipe).toMatch(/^editorial\|.*\|cover-/);
    expect(buildPlan({ ...input, images: [image(2), image(1)] }).recipe).not.toBe(plan.recipe);
    // Another direction never carries pictures.
    expect(buildPlan({ ...input, direction: "footage" }).images).toBeUndefined();
  });
});

/* ------------------------------------------------------------- collecting */

const HOME = `<html><head><meta property="og:image" content="https://shop.example/uploads/share.jpg"></head><body><main>
  <img src="https://cdn.example/team.jpg" alt="The team"><a href="/about">About</a></main></body></html>`;
const ABOUT = `<html><body><main><img src="https://shop.example/uploads/workshop.jpg"></main></body></html>`;

function fakeDeps(overrides: Partial<PictureDeps> = {}, now = new Date("2026-11-26T08:00:00Z")) {
  const downloads: string[] = [];
  const stored: number[] = [];
  const deps: PictureDeps = {
    fetchHtml: vi.fn(async (url: string) => (url === "https://shop.example" || url === "https://shop.example/" ? { finalUrl: "https://shop.example/", html: HOME } : url.endsWith("/about") ? { finalUrl: url, html: ABOUT } : null)),
    download: vi.fn(async (url: string) => {
      downloads.push(url);
      return Buffer.from(url);
    }),
    normalize: vi.fn(async (data: Buffer) => {
      const url = data.toString();
      if (url.includes("small")) return { rejected: "small" };
      return { data, width: 1600, height: 1067, hash: url.includes("twin") ? "same" : url };
    }),
    store: vi.fn(async () => {
      stored.push(stored.length);
      return `https://store.example/shared/editorial/w/${stored.length}.jpg`;
    }),
    now: () => now,
    expired: () => false,
    ...overrides,
  };
  return { deps, downloads, stored };
}

const SITE = { url: "https://shop.example", domain: "shop.example" };
const ARTICLES = [
  { id: "a1", pageUrl: "https://shop.example/blog/one", imageUrl: "https://shop.example/uploads/cover-one.jpg", imageAlt: "Cover one", bodyHtml: '<img src="https://shop.example/uploads/small.jpg">' },
  { id: "a2", pageUrl: "https://shop.example/blog/two", imageUrl: "https://shop.example/uploads/cover-two.jpg", imageAlt: null, bodyHtml: '<img src="https://shop.example/uploads/twin-a.jpg"><img src="https://shop.example/uploads/twin-b.jpg">' },
];

describe("collecting a website's pictures", () => {
  it("copies its articles' pictures first, then its pages', refusing what a slide cannot use and the same photograph twice", async () => {
    const { deps } = fakeDeps();
    const { pictures, cache } = await gatherPictures({ site: SITE, articles: ARTICLES, cache: null }, deps);
    expect(pictures.map((picture) => [picture.source, picture.pageUrl, picture.articleId])).toEqual([
      ["article", "https://shop.example/blog/one", "a1"],
      ["article", "https://shop.example/blog/two", "a2"],
      ["article", "https://shop.example/blog/two", "a2"],
      ["website", "https://shop.example/", null],
      ["website", "https://shop.example/", null],
      ["website", "https://shop.example/about", null],
    ]);
    // Every picture is our copy, never the website's address.
    expect(pictures.every((picture) => picture.url.startsWith("https://store.example/shared/editorial/"))).toBe(true);
    expect(pictures[0]).toMatchObject({ alt: "Cover one", width: 1600, height: 1067 });
    expect(cache.copies[pictureKey("https://shop.example/uploads/small.jpg")]).toMatchObject({ rejected: "small" });
    expect(cache.pagesAt).toBe("2026-11-26T08:00:00.000Z");
  });

  it("stores each picture once: the cache's copies are reused, refused ones never fetched again, pages read again after a week", async () => {
    const first = fakeDeps();
    const { cache } = await gatherPictures({ site: SITE, articles: ARTICLES, cache: null }, first.deps);
    const again = fakeDeps({}, new Date("2026-11-28T08:00:00Z"));
    const second = await gatherPictures({ site: SITE, articles: ARTICLES, cache: JSON.parse(JSON.stringify(cache)) as PictureCache }, again.deps);
    expect(again.downloads).toEqual([]);
    expect(again.deps.fetchHtml).not.toHaveBeenCalled();
    expect(second.pictures).toHaveLength(6);
    const week = fakeDeps({}, new Date("2026-12-04T08:00:00Z"));
    await gatherPictures({ site: SITE, articles: ARTICLES, cache }, week.deps);
    expect(week.deps.fetchHtml).toHaveBeenCalled();
    expect(week.downloads).toEqual([]);
  });

  it("tries a failed download again the next day, and a site that did not answer the next day", async () => {
    const down = fakeDeps({ download: vi.fn(async () => null), fetchHtml: vi.fn(async () => null) });
    const { pictures, cache } = await gatherPictures({ site: SITE, articles: ARTICLES.slice(0, 1), cache: null }, down.deps);
    expect(pictures).toEqual([]);
    const sameDay = fakeDeps({}, new Date("2026-11-26T12:00:00Z"));
    await gatherPictures({ site: SITE, articles: ARTICLES.slice(0, 1), cache }, sameDay.deps);
    expect(sameDay.downloads).toEqual([]);
    expect(sameDay.deps.fetchHtml).not.toHaveBeenCalled();
    const nextDay = fakeDeps({}, new Date("2026-11-27T09:00:00Z"));
    const later = await gatherPictures({ site: SITE, articles: ARTICLES.slice(0, 1), cache }, nextDay.deps);
    expect(nextDay.downloads).toContain("https://shop.example/uploads/cover-one.jpg");
    expect(nextDay.deps.fetchHtml).toHaveBeenCalled();
    expect(later.pictures.length).toBeGreaterThan(0);
  });

  it("downloads at most MAX_DOWNLOADS new pictures a time, and nothing once its time is up", async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: `a${i}`, pageUrl: null, imageUrl: `https://shop.example/uploads/p${i}.jpg`, imageAlt: null, bodyHtml: null }));
    const capped = fakeDeps({ fetchHtml: vi.fn(async () => null) });
    await gatherPictures({ site: SITE, articles: many, cache: null }, capped.deps);
    expect(capped.downloads.length).toBe(MAX_DOWNLOADS);
    const late = fakeDeps({ expired: () => true });
    const result = await gatherPictures({ site: SITE, articles: many, cache: null }, late.deps);
    expect(late.downloads).toEqual([]);
    expect(result.pictures).toEqual([]);
  });

  it("survives a failing download or store: fewer pictures, never an error", async () => {
    const broken = fakeDeps({ store: vi.fn(async () => Promise.reject(new Error("storage down"))) });
    const { pictures, cache } = await gatherPictures({ site: SITE, articles: ARTICLES, cache: null }, broken.deps);
    expect(pictures).toEqual([]);
    expect(Object.values(cache.copies).some((entry) => "failed" in entry)).toBe(true);
  });
});

describe("a downloaded picture", () => {
  const make = (width: number, height: number, options: { alpha?: boolean; format?: "jpeg" | "png" } = {}) =>
    sharp({ create: { width, height, channels: options.alpha ? 4 : 3, background: options.alpha ? { r: 10, g: 20, b: 30, alpha: 0.5 } : { r: 200, g: 120, b: 40 } } })
      [options.format ?? "jpeg"]()
      .toBuffer();

  it("is re-encoded as a JPEG of at most 1920 px with its real size", async () => {
    const result = await normalizePicture(await make(2400, 1600));
    expect(result).toMatchObject({ width: 1920, height: 1280 });
    if ("data" in result) expect((await sharp(result.data).metadata()).format).toBe("jpeg");
  });

  it("is refused when small, strip-shaped, transparent (a graphic) or not a picture", async () => {
    expect(await normalizePicture(await make(800, 500))).toEqual({ rejected: "small" });
    expect(await normalizePicture(await make(3000, 700))).toEqual({ rejected: "strip" });
    expect(await normalizePicture(await make(1200, 900, { alpha: true, format: "png" }))).toEqual({ rejected: "graphic" });
    expect(await normalizePicture(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toMatchObject({ rejected: expect.any(String) });
    expect(await normalizePicture(Buffer.from("not a picture"))).toEqual({ rejected: "unreadable" });
  });
});
