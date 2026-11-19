/**
 * AdSense on the blog's articles (ticket 2026-11-19, item 7: "start inserting
 * adsense ads on our repget blog articles to start being approved by
 * google"). The deployment's settings, read from NEXT_PUBLIC_* variables, so
 * the browser bundle, the pages and src/proxy.ts (the CSP) agree.
 *
 * NO IMPORTS: src/proxy.ts reads this.
 *
 *   NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-8510275614015789   the publisher; the switch
 *   NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE_TOP=1234567890      in-article unit after the introduction
 *   NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE_END=1234567890      display unit after the article body
 *
 * ARTICLE PAGES ONLY - /blog/<slug> and /<locale>/blog/<slug> - never the
 * home page, pricing, the app or checkout, and never "auto ads": the loader
 * is added by components/ads/adsense-slot.tsx on those pages alone, and only
 * after the visitor accepted cookies (lib/consent.ts). With the client set
 * and no slot ids yet, the loader still comes (after consent) and no unit
 * is drawn.
 */

export type AdsenseConfig = {
  /** "ca-pub-…", or null when AdSense is off. */
  client: string | null;
  slots: { top: string | null; end: string | null };
};

const CLIENT_RE = /^ca-pub-\d{10,20}$/;
const SLOT_RE = /^\d{6,14}$/;

export function adsenseConfig(env: Record<string, string | undefined>): AdsenseConfig {
  const client = env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim() ?? "";
  if (!CLIENT_RE.test(client)) return { client: null, slots: { top: null, end: null } };
  const slot = (raw: string | undefined) => (SLOT_RE.test(raw?.trim() ?? "") ? raw!.trim() : null);
  return { client, slots: { top: slot(env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE_TOP), end: slot(env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE_END) } };
}

/** The pages that are not articles under /blog/: its index, categories, the author page, sponsorship's thank-you. */
const NOT_ARTICLES = new Set(["category", "author", "sponsorship", "feed", "rss"]);

/** Whether a path is one blog article: /blog/<slug> or /<locale>/blog/<slug>, nothing deeper. */
export function isBlogArticlePath(pathname: string): boolean {
  const match = /^(?:\/[a-z]{2})?\/blog\/([^/]+)\/?$/.exec(pathname);
  return Boolean(match && !NOT_ARTICLES.has(match[1]));
}

export function adsenseScriptUrl(client: string): string {
  return `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
}
