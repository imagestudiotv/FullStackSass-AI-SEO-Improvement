import * as cheerio from "cheerio";

import { plainScript as videoPlainScript, stripHighlight } from "@/remotion/editorial";
import { productionParts } from "@/remotion/production";
import type { SceneMedia } from "@/remotion/props";

import type { StoredAsset } from "./assets";
import type { EditorialImage, ProductionChoices, ShotPlan, VideoFormat, VideoScript } from "./formats";

/**
 * The editorial videos' pictures (client, 2026-11-26: "grabbing images from
 * the blog post, insert few captions there as carousel and making the photos
 * carousel looking premium ... reads images from blog posts and website").
 * Pure: what counts as a photograph worth a slide, where it is found in a
 * page, in which order an idea uses them, and which scene shows which. The
 * fetching, the copies in the video bucket and the cache are in
 * editorial-pictures.ts.
 *
 * Also the highlight marks: an editorial idea's on-screen texts mark one or
 * two words with *asterisks* (src/remotion renders and strips them). They
 * never reach anything else - post texts, titles, the voice, tags - so
 * plainText() takes them out there.
 */

/* ------------------------------------------------------------ highlights */

/**
 * A text without its *highlight* marks: "*Use it*" reads "Use it". Every
 * asterisk goes, paired or not - a post text or a voice never needs one.
 * One rule for the video and everything else: src/remotion/editorial.ts stripHighlight.
 */
export const plainText: (text: string) => string = stripHighlight;

/** The longest point title (kept with the video rules in src/remotion/editorial.ts, so the editor reads it without this module's HTML parser). */
export { EDITORIAL_TITLE_MAX, pointTitleMax } from "@/remotion/editorial";

/** A script with every text plain (plainText): for any idea that is not editorial. The video's own rule (src/remotion/editorial.ts). */
export const plainScript: (script: VideoScript) => VideoScript = videoPlainScript;

/* -------------------------------------------------------------- pictures */

/** A picture of the website's own, before it is copied: where it is and what its page says about it. */
export type PictureCandidate = {
  url: string;
  alt: string | null;
  source: EditorialImage["source"];
  pageUrl: string | null;
  /** From the page's attributes or srcset when it says; null = not known until downloaded. */
  width: number | null;
  height: number | null;
  /** The article it comes from (source "article"). */
  articleId: string | null;
};

/** An EditorialImage of the website's pool (a copy in the video bucket), with the article it comes from. */
export type SitePicture = EditorialImage & { articleId: string | null };

/** The shortest side a slide's picture may have (1080 px wide slides; a little upscaling is fine, a thumbnail is not). */
export const MIN_SHORT_SIDE = 600;
/** Wider or taller than this is a banner or a strip, not a photograph to crop to 4:5 or 9:16. */
export const MAX_RATIO = 2.6;
/** The most pictures one idea carries (a cover, up to six points, the proof and the CTA). */
export const MAX_IDEA_PICTURES = 8;

/** Words in a file name or alt text that mean a logo, an icon or a graphic - never a slide's photograph. */
const NOT_PHOTO = new Set([
  "logo", "logos", "icon", "icons", "favicon", "sprite", "sprites", "pixel", "spacer", "blank", "placeholder",
  "avatar", "avatars", "gravatar", "badge", "badges", "emoji", "loader", "loading", "spinner", "arrow", "arrows",
  "flag", "flags", "payment", "payments", "visa", "mastercard", "paypal", "rating", "stars", "qr", "signature",
  "watermark", "button", "btn", "banner", "thumb", "thumbnail", "svg", "gif", "dummy", "transparent",
]);

/** Hosts that serve tracking pixels and ad beacons, never pictures. */
const TRACKING_HOSTS = /(^|\.)(facebook\.com|facebook\.net|google-analytics\.com|googletagmanager\.com|doubleclick\.net|googlesyndication\.com|bing\.com|linkedin\.com|twitter\.com|t\.co|pinterest\.com|hotjar\.com|clarity\.ms|gravatar\.com|wp\.com\/latex)$/i;

const PHOTO_EXTENSION = /\.(jpe?g|png|webp|avif)$/i;
const OTHER_EXTENSION = /\.[a-z0-9]{2,5}$/i;

const words = (text: string) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** Whether a picture may be a photograph worth a slide, from its address, alt text and declared size alone. */
export function isLikelyPhoto(candidate: Pick<PictureCandidate, "url" | "alt" | "width" | "height">): boolean {
  let url: URL;
  try {
    url = new URL(candidate.url);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (TRACKING_HOSTS.test(url.hostname)) return false;
  const file = decodeURIComponent(url.pathname.split("/").pop() ?? "").toLowerCase();
  // A known non-photo extension (svg, gif, ico, pdf...) is refused; none at all is a CDN address and may be fine.
  if (OTHER_EXTENSION.test(file) && !PHOTO_EXTENSION.test(file)) return false;
  if ([...words(file.replace(PHOTO_EXTENSION, "")), ...words(candidate.alt ?? "")].some((word) => NOT_PHOTO.has(word))) return false;
  if (/\/(icons?|logos?|emoji|avatars?|sprites?|flags?)\//i.test(url.pathname)) return false;
  return sizeFits(candidate.width, candidate.height);
}

/** Whether a known size is big enough and not a strip; an unknown one passes (it is checked once downloaded). */
export function sizeFits(width: number | null, height: number | null): boolean {
  if (width !== null && height !== null) {
    if (Math.min(width, height) < MIN_SHORT_SIDE) return false;
    return Math.max(width, height) / Math.max(1, Math.min(width, height)) <= MAX_RATIO;
  }
  const known = width ?? height;
  return known === null || known >= MIN_SHORT_SIDE;
}

/**
 * The same picture whatever size or copy of it a page links: no query, no
 * WordPress size suffix ("-300x200"), no "-scaled", lower case, no scheme.
 */
export function pictureKey(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname
      .replace(/-\d{2,5}x\d{2,5}(?=\.[a-z0-9]+$)/i, "")
      .replace(/-scaled(?=\.[a-z0-9]+$)/i, "")
      .replace(/@\dx(?=\.[a-z0-9]+$)/i, "");
    return `${parsed.hostname.replace(/^www\./, "")}${path}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

/** Candidates once each (by pictureKey), the first occurrence kept, in order. */
export function dedupePictures<T extends { url: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((item) => {
    const key = pictureKey(item.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const number = (value: string | undefined): number | null => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const absolute = (raw: string | undefined, base: string): string | null => {
  const value = (raw ?? "").trim();
  if (!value || value.startsWith("data:") || value.startsWith("blob:")) return null;
  try {
    const url = new URL(value, base);
    url.hash = "";
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
};

/** The largest picture a srcset offers ("a.jpg 300w, b.jpg 1200w"), with its width when it says. */
export function largestInSrcset(srcset: string | undefined, base: string): { url: string; width: number | null } | null {
  if (!srcset?.trim()) return null;
  let best: { url: string; width: number | null; score: number } | null = null;
  for (const entry of srcset.split(/,\s+(?=\S)/)) {
    const [raw, descriptor = ""] = entry.trim().split(/\s+/);
    const url = absolute(raw, base);
    if (!url) continue;
    const w = /^(\d+)w$/i.exec(descriptor);
    const x = /^([\d.]+)x$/i.exec(descriptor);
    const width = w ? Number(w[1]) : null;
    const score = width ?? (x ? Number(x[1]) * 1000 : 1);
    if (!best || score > best.score) best = { url, width, score };
  }
  return best ? { url: best.url, width: best.width } : null;
}

/** Where a page's chrome is: pictures there are logos, menus and footers, not the content's. */
const CHROME = "header, nav, footer, aside, form, [role=banner], [role=navigation], [role=contentinfo], .logo, .site-header, .site-footer, .menu, .widget, .sidebar, .cookie, #cookie-notice";

/**
 * A page's pictures, in the order a reader meets them: its share picture
 * (og:image / twitter:image) first for a website page, then the pictures of
 * its main content (inside <main> or <article> when the page has one), never
 * those in its header, menus, sidebar or footer. Lazy-loading addresses
 * (data-src, data-srcset) are read, and a srcset's largest picture wins.
 * Only isLikelyPhoto ones, each once.
 */
export function picturesInHtml(html: string, pageUrl: string, source: EditorialImage["source"], articleId: string | null = null): PictureCandidate[] {
  if (!html) return [];
  const $ = cheerio.load(html);
  const out: PictureCandidate[] = [];
  const add = (candidate: PictureCandidate) => {
    if (isLikelyPhoto(candidate)) out.push(candidate);
  };
  if (source === "website") {
    for (const property of ["og:image", "og:image:secure_url", "twitter:image"]) {
      const meta = $(`meta[property="${property}"], meta[name="${property}"]`).first();
      const url = absolute(meta.attr("content"), pageUrl);
      if (!url) continue;
      const width = number($('meta[property="og:image:width"]').attr("content"));
      const height = number($('meta[property="og:image:height"]').attr("content"));
      const alt = $('meta[property="og:image:alt"]').attr("content")?.trim() || null;
      add({ url, alt, source, pageUrl, width, height, articleId });
      break;
    }
  }
  const root = $("main, article, [role=main]").first();
  const images = (root.length ? root.find("img") : $("img")).toArray();
  for (const element of images) {
    const image = $(element);
    // The page's chrome is skipped; a header or aside inside the content itself (an article's hero) is content.
    const chrome = image.closest(CHROME);
    if (chrome.length && !chrome.closest("main, article, [role=main]").length) continue;
    const declaredWidth = number(image.attr("width"));
    const declaredHeight = number(image.attr("height"));
    const set = largestInSrcset(image.attr("data-srcset") ?? image.attr("srcset"), pageUrl);
    const src = absolute(image.attr("data-src") ?? image.attr("data-lazy-src") ?? image.attr("data-original") ?? image.attr("src"), pageUrl);
    const url = set?.url ?? src;
    if (!url) continue;
    let width = declaredWidth;
    let height = declaredHeight;
    if (set?.width) {
      // The srcset's largest file is bigger than the displayed size: scale the declared shape to it.
      height = declaredWidth && declaredHeight ? Math.round((declaredHeight * set.width) / declaredWidth) : null;
      width = set.width;
    } else if (set) {
      width = null;
      height = null;
    }
    add({ url, alt: image.attr("alt")?.trim() || null, source, pageUrl, width, height, articleId });
  }
  return dedupePictures(out);
}

/** Paths of pages worth a look for a business's pictures, in the languages customers write in. */
const IMPORTANT_PAGE = /(about|despre|sobre|chi-siamo|a-propos|uber-uns|ueber-uns|services?|servicii|servicios|servizi|leistungen|products?|produse|productos|prodotti|shop|magazin|tienda|menu|meniu|gallery|galerie|galeria|portfolio|work|projects?|proiecte|team|echipa|rooms?|camere|treatments?|tratamente|collections?|offer|oferta)/i;
const NOT_A_PAGE = /(\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|xml)$)|(\/(wp-admin|wp-login|login|signin|cart|checkout|account|my-account|feed|tag|author|search)(\/|$))|privacy|cookie|terms|gdpr|confidentialitate|termeni/i;

/**
 * Up to `max` of a page's links to the site's important pages (about,
 * services, products, gallery...), shortest paths first; the home page and
 * anything that is not a page (files, logins, carts, policies) left out.
 */
export function importantPageLinks(html: string, pageUrl: string, inSite: (url: string) => boolean, max = 5): string[] {
  if (!html) return [];
  const $ = cheerio.load(html);
  const found = new Map<string, number>();
  for (const element of $("a[href]").toArray()) {
    const url = absolute($(element).attr("href"), pageUrl);
    if (!url || !inSite(url)) continue;
    const parsed = new URL(url);
    parsed.search = "";
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    if (path === "/" || NOT_A_PAGE.test(path) || !IMPORTANT_PAGE.test(path)) continue;
    const depth = path.split("/").filter(Boolean).length;
    if (depth > 2) continue;
    const key = `${parsed.origin}${path}`;
    if (!found.has(key)) found.set(key, depth * 1000 + path.length);
  }
  return [...found.entries()]
    .sort((a, b) => a[1] - b[1])
    .slice(0, max)
    .map(([url]) => url);
}

const squareish = (picture: { width: number | null; height: number | null }) =>
  picture.width !== null && picture.height !== null && Math.abs(picture.width / Math.max(1, picture.height) - 1) < 0.08;

/** Landscape and portrait photographs before near-squares (often graphics), the order kept otherwise. */
export function photosFirst<T extends { width: number | null; height: number | null }>(list: T[]): T[] {
  return [...list.filter((item) => !squareish(item)), ...list.filter(squareish)];
}

const rotate = <T>(list: T[], by: number): T[] => (list.length ? list.map((_, i) => list[(i + by) % list.length]) : list);

/**
 * An idea's pictures, cover first: those of the article it is about, then the
 * website's other articles', then its pages' - the other articles' and the
 * pages' turned by the idea's place in the batch, so the day's ideas open on
 * different pictures. At most `max`, each once.
 */
export function picturesForIdea(pool: SitePicture[], articleId: string | null | undefined, index: number, max = MAX_IDEA_PICTURES): EditorialImage[] {
  const own = articleId ? photosFirst(pool.filter((picture) => picture.articleId === articleId)) : [];
  const articles = photosFirst(pool.filter((picture) => picture.source === "article" && (!articleId || picture.articleId !== articleId)));
  const pages = photosFirst(pool.filter((picture) => picture.source === "website"));
  const shift = Math.max(0, Math.trunc(index));
  const ordered = dedupePictures([...own, ...rotate(articles, shift), ...rotate(pages, shift)]);
  return ordered.slice(0, Math.max(0, max)).map(({ url, alt, source, pageUrl, width, height }) => ({ url, alt, source, pageUrl, width, height }));
}

/* ---------------------------------------------------------------- scenes */

/** The parts (spokenParts indexes) an editorial video shows, in order: a carousel always has its cover (the hook). */
export function editorialParts(script: VideoScript, production: ProductionChoices, plan: ShotPlan | null | undefined, format: VideoFormat): number[] {
  return productionParts(script, format === "carousel" ? { ...production, showHook: true } : production, plan).map((part) => part.part);
}

/** Which picture each shown part uses: in order, the cover on the first, again from the start when there are fewer pictures than parts. */
export function pictureForParts(images: readonly EditorialImage[], parts: readonly number[]): Map<number, EditorialImage> {
  const out = new Map<number, EditorialImage>();
  if (images.length === 0) return out;
  parts.forEach((part, order) => out.set(part, images[order % images.length]));
  return out;
}

/** The scenes' media of an editorial idea (per spokenParts index; null = a part not shown), for the preview before it is made. */
export function editorialSceneMedia(images: readonly EditorialImage[], parts: readonly number[], total: number): (SceneMedia | null)[] | null {
  const chosen = pictureForParts(images, parts);
  if (chosen.size === 0) return null;
  return Array.from({ length: total }, (_, part) => {
    const image = chosen.get(part);
    return image ? { url: image.url, kind: "image" as const, source: "article" as const } : null;
  });
}

/** The licence recorded for a website's own picture. */
export const OWN_PICTURE_LICENCE = "The website's own picture";

/**
 * An editorial video's assets, made from its plan's pictures (never stock or
 * AI): one per shown part, the ones already resolved (a retry) kept.
 */
export function editorialAssets(images: readonly EditorialImage[], parts: readonly number[], existing: readonly StoredAsset[] = []): StoredAsset[] {
  const kept = existing.filter((asset) => parts.includes(asset.sceneIndex));
  const done = new Set(kept.map((asset) => asset.sceneIndex));
  const chosen = pictureForParts(images, parts);
  const made: StoredAsset[] = parts.flatMap((part) => {
    const image = chosen.get(part);
    if (done.has(part) || !image) return [];
    return [
      {
        sceneIndex: part,
        url: image.url,
        kind: "image" as const,
        source: "article" as const,
        provider: image.source,
        providerId: null,
        licence: OWN_PICTURE_LICENCE,
        sourceUrl: image.pageUrl,
        author: null,
        assetId: null,
        width: image.width,
        height: image.height,
      },
    ];
  });
  return [...kept, ...made].sort((a, b) => a.sceneIndex - b.sceneIndex);
}
