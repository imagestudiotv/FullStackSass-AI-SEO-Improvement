import { toCsv } from "@/lib/partners/presentation/csv";
import { PLATFORMS } from "@/lib/social/platforms";
import { VIDEO_PLATFORM_SPECS } from "@/lib/video/formats";

/**
 * The free AI Social Media Post Generator (client, 2026-11-13,
 * repget-free-ai-social-media-post-generator.html): what the page and the
 * server share. No server imports - the tool's client component uses these.
 *
 * The limits are the product's own, where it has them: the social posts'
 * (lib/social/platforms.ts) for X, Threads, Pinterest, Reddit and Bluesky,
 * and the video captions' (lib/video/formats.ts) for Instagram, TikTok,
 * Facebook and LinkedIn.
 */

export const FREE_SOCIAL_PLATFORMS = ["instagram", "linkedin", "x", "facebook", "threads", "tiktok", "pinterest", "reddit", "bluesky"] as const;
export type FreeSocialPlatform = (typeof FREE_SOCIAL_PLATFORMS)[number];

export function isFreeSocialPlatform(value: unknown): value is FreeSocialPlatform {
  return typeof value === "string" && (FREE_SOCIAL_PLATFORMS as readonly string[]).includes(value);
}

export type FreeSocialSpec = {
  name: string;
  /** The design's little mark on the platform button. */
  symbol: string;
  /** The longest post the platform takes, in its own way of counting (countCharacters). */
  max: number;
};

export const FREE_SOCIAL_SPECS: Record<FreeSocialPlatform, FreeSocialSpec> = {
  instagram: { name: VIDEO_PLATFORM_SPECS.instagram.name, symbol: "◎", max: VIDEO_PLATFORM_SPECS.instagram.captionMax },
  linkedin: { name: VIDEO_PLATFORM_SPECS.linkedin.name, symbol: "in", max: VIDEO_PLATFORM_SPECS.linkedin.captionMax },
  x: { name: PLATFORMS.x.name, symbol: "𝕏", max: PLATFORMS.x.maxLength },
  facebook: { name: VIDEO_PLATFORM_SPECS.facebook.name, symbol: "f", max: VIDEO_PLATFORM_SPECS.facebook.captionMax },
  threads: { name: PLATFORMS.threads.name, symbol: "@", max: PLATFORMS.threads.maxLength },
  tiktok: { name: VIDEO_PLATFORM_SPECS.tiktok.name, symbol: "♪", max: VIDEO_PLATFORM_SPECS.tiktok.captionMax },
  pinterest: { name: PLATFORMS.pinterest.name, symbol: "P", max: PLATFORMS.pinterest.maxLength },
  reddit: { name: PLATFORMS.reddit.name, symbol: "r/", max: PLATFORMS.reddit.maxLength },
  bluesky: { name: PLATFORMS.bluesky.name, symbol: "☁", max: PLATFORMS.bluesky.maxLength },
};

/** The first six are shown; the rest behind "Show 3 more platforms", as in the design. */
export const FIRST_PLATFORMS = 6;

export const FREE_SOCIAL_GOALS = ["introduce", "traffic", "engage", "educate"] as const;
export type FreeSocialGoal = (typeof FREE_SOCIAL_GOALS)[number];
export const FREE_SOCIAL_TONES = ["natural", "professional", "friendly", "bold"] as const;
export type FreeSocialTone = (typeof FREE_SOCIAL_TONES)[number];

export function isFreeSocialGoal(value: unknown): value is FreeSocialGoal {
  return typeof value === "string" && (FREE_SOCIAL_GOALS as readonly string[]).includes(value);
}
export function isFreeSocialTone(value: unknown): value is FreeSocialTone {
  return typeof value === "string" && (FREE_SOCIAL_TONES as readonly string[]).includes(value);
}

/** The "example" action's address. */
export const EXAMPLE_URL = "https://www.repget.com";

/** The longest address accepted. */
export const MAX_URL_CHARS = 2_048;

export type FreeSocialPost = {
  /** A short label for the post's angle, in the page's language ("Brand story"). */
  angle: string;
  text: string;
};

export type FreeSocialSource = {
  /** The page as read, after redirects. */
  url: string;
  domain: string;
  title: string | null;
};

/** Why there are no posts; the browser says it in the page's language. */
export type FreeSocialRefusal =
  /** Not a public http(s) website or article address. */
  | "invalid_url"
  /** The page could not be read, or had too little text to write from. */
  | "extraction_failed"
  /** The model failed or answered with something unusable. */
  | "provider_failed"
  /** This visitor's free batch (or its one retry) is used. */
  | "limit"
  /** Too many addresses tried by this visitor in the last hour. */
  | "rate_limited"
  /** Every visitor together: the hourly cap or every concurrent slot is taken. */
  | "busy"
  /** No model configured, or the quota store cannot be reached. */
  | "unavailable";

export type FreeSocialOutcome =
  | { ok: true; platform: FreeSocialPlatform; posts: FreeSocialPost[]; source: FreeSocialSource }
  | {
      ok: false;
      reason: FreeSocialRefusal;
      /** After a provider failure: whether the one retry is still there. */
      retryAvailable?: boolean;
    };

export type FreeSocialStatus = {
  /** True while this visitor may still generate their free batch. */
  available: boolean;
};

/**
 * A quick check in the browser, before anything is sent: an http(s) address
 * with a dotted host and no credentials. The server checks properly
 * (lib/websites/url.ts, and the fetch guard checks every resolved address).
 */
export function looksLikePublicUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_URL_CHARS || /\s/.test(trimmed)) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) return false;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    const host = url.hostname.replace(/\.$/, "");
    if (url.username || url.password || !host.includes(".")) return false;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) return false;
    return !/(^|\.)(localhost|local|internal|test|invalid)$/i.test(host);
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------------- */
/* Character counting                                                         */
/* ------------------------------------------------------------------------- */

const URL_PATTERN = /https?:\/\/[^\s]+/gi;
/** X counts every link as this many characters, whatever its length (t.co). */
const X_URL_WEIGHT = 23;
/** The code point ranges X counts as one character; everything else counts two (twitter-text v3). */
const X_LIGHT_RANGES: [number, number][] = [
  [0, 4351],
  [8192, 8205],
  [8208, 8223],
  [8242, 8247],
];

function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text), (part) => part.segment);
  }
  return Array.from(text);
}

function xWeight(text: string): number {
  let total = 0;
  const withoutUrls = text.replace(URL_PATTERN, () => {
    total += X_URL_WEIGHT;
    return "";
  });
  for (const cluster of graphemes(withoutUrls)) {
    // An emoji, however many code points it is made of, counts two.
    if (/\p{Extended_Pictographic}/u.test(cluster)) {
      total += 2;
      continue;
    }
    for (const char of cluster) {
      const code = char.codePointAt(0) ?? 0;
      total += X_LIGHT_RANGES.some(([low, high]) => code >= low && code <= high) ? 1 : 2;
    }
  }
  return total;
}

/**
 * A post's length the way its platform counts it:
 *  - X: weighted, as X counts - a link is 23, an emoji or a CJK character 2;
 *  - Bluesky: graphemes (what a reader sees as one character);
 *  - the others: Unicode characters (code points), so an accent or an emoji
 *    is not counted twice the way JavaScript's .length would.
 */
export function countCharacters(platform: FreeSocialPlatform, text: string): number {
  if (platform === "x") return xWeight(text);
  if (platform === "bluesky") return graphemes(text).length;
  return Array.from(text).length;
}

export function isOverLimit(platform: FreeSocialPlatform, text: string): boolean {
  return countCharacters(platform, text) > FREE_SOCIAL_SPECS[platform].max;
}

/* ------------------------------------------------------------------------- */
/* Copy all and CSV                                                           */
/* ------------------------------------------------------------------------- */

/** Every post as one text, for "Copy all". `heading` is "Post {n}" in the page's language. */
export function allPostsText(posts: FreeSocialPost[], heading: (n: number) => string): string {
  return posts.map((post, index) => `${heading(index + 1)}${post.angle ? ` - ${post.angle}` : ""}\n${post.text}`).join("\n\n---\n\n");
}

/**
 * The posts as CSV (lib/partners/presentation/csv.ts: RFC 4180, UTF-8 with a
 * BOM, and a cell starting with = + - @ is prefixed with a quote so a
 * spreadsheet never runs it as a formula - a post can start with "-" or "@").
 * `header` is in the page's language.
 */
export function postsCsv(
  header: [string, string, string, string, string, string],
  platform: FreeSocialPlatform,
  posts: FreeSocialPost[],
  sourceUrl: string,
): string {
  const spec = FREE_SOCIAL_SPECS[platform];
  return toCsv(
    header,
    posts.map((post, index) => [spec.name, String(index + 1), post.angle, post.text, String(countCharacters(platform, post.text)), sourceUrl]),
  );
}
