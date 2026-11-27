/**
 * The social media platforms and what RepGet can do on each (client,
 * 2026-10-27; docs/social-media.md).
 *
 * THE MIX the client chose: RepGet publishes the customer's OWN posts itself,
 * through bundle.social; REPLIES in other people's discussions are always
 * posted by the customer, with one click - RepGet writes the reply, copies
 * it and opens the discussion. Automated replies into strangers' threads are
 * what platforms ban accounts for, and no posting API offers them anyway.
 *
 * Quora has no API at all, so it is a username and one click for everything.
 * Pinterest has no discussions to answer, so it is own posts (Pins) only.
 * LinkedIn (Daniel, 2026-11-27: "Can we add LinkedIn too") is own posts only
 * as well: LinkedIn's API lets an app post for a member or a company page,
 * but not search or read other people's posts, and scraping them is against
 * its terms - so there are no LinkedIn conversations to suggest. It is shown
 * only where RepGet can publish to it (NEEDS_BUNDLE): the same bundle.social
 * connection the Videos page uses, profile or company page as chosen there.
 *
 * No server imports: the Social page's client component uses these too.
 */

export const SOCIAL_PLATFORMS = ["reddit", "quora", "x", "threads", "pinterest", "bluesky", "linkedin"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export function isSocialPlatform(value: string): value is SocialPlatform {
  return (SOCIAL_PLATFORMS as readonly string[]).includes(value);
}

/**
 * Platforms that exist in Social only while bundle.social is set up
 * (BUNDLE_SOCIAL_API_KEY): without it they are hidden everywhere - the page,
 * the plan's platforms (lib/social/accounts.ts socialAccess), the daily run.
 */
export const NEEDS_BUNDLE: readonly SocialPlatform[] = ["linkedin"];

/** The platforms Social shows and uses, given whether bundle.social is set up. */
export function availablePlatforms(bundle: boolean): readonly SocialPlatform[] {
  return bundle ? SOCIAL_PLATFORMS : SOCIAL_PLATFORMS.filter((platform) => !NEEDS_BUNDLE.includes(platform));
}

/** What a trial may use (client, 2026-10-27: "trials get social media but only Quora"). */
export const TRIAL_PLATFORMS: readonly SocialPlatform[] = ["quora"];

/** Suggestions a website gets a day, replies and own posts together (client). */
export const SUGGESTIONS_PER_DAY = 10;

/** The first days of an account: no links and no product names (client, 2026-10-27: 7). */
export const WARMUP_DAYS = 7;

export type BundleType = "REDDIT" | "TWITTER" | "THREADS" | "PINTEREST" | "BLUESKY" | "LINKEDIN";

export type PlatformSpec = {
  name: string;
  /** bundle.social's name for it; null where there is no API (Quora). */
  bundleType: BundleType | null;
  /** Whether there are discussions to reply to. */
  replies: boolean;
  /** Whether the customer's own posts are suggested. */
  ownPosts: boolean;
  /** The longest text the platform takes, in characters. */
  maxLength: number;
  /** A post's title, where the platform has one (Reddit, Pinterest). */
  titleMax?: number;
  /** The Google query prefix that finds its public discussions. */
  search?: string;
  /**
   * Only discussions from the last N months. Reddit archives a thread after
   * six months: no more comments or votes (client, 2026-11-04: every Reddit
   * opportunity he opened was an archived thread). One month short of that
   * leaves time to reply.
   */
  maxAgeMonths?: number;
};

export const PLATFORMS: Record<SocialPlatform, PlatformSpec> = {
  reddit: { name: "Reddit", bundleType: "REDDIT", replies: true, ownPosts: true, maxLength: 4000, titleMax: 300, search: "site:reddit.com", maxAgeMonths: 5 },
  quora: { name: "Quora", bundleType: null, replies: true, ownPosts: false, maxLength: 4000, search: "site:quora.com" },
  x: { name: "X", bundleType: "TWITTER", replies: true, ownPosts: true, maxLength: 280, search: "site:x.com" },
  threads: { name: "Threads", bundleType: "THREADS", replies: true, ownPosts: true, maxLength: 500, search: "site:threads.com OR site:threads.net" },
  pinterest: { name: "Pinterest", bundleType: "PINTEREST", replies: false, ownPosts: true, maxLength: 800, titleMax: 100 },
  bluesky: { name: "Bluesky", bundleType: "BLUESKY", replies: true, ownPosts: true, maxLength: 300, search: "site:bsky.app" },
  // A post takes 3,000 characters; no conversations (see the top of this file).
  linkedin: { name: "LinkedIn", bundleType: "LINKEDIN", replies: false, ownPosts: true, maxLength: 3000 },
};

/**
 * Where discussions are searched for although the website has no account
 * there (Daniel, 2026-11-24). Google lists Reddit's and Quora's discussions
 * well; X, Threads and Bluesky posts hardly at all, and each search costs.
 */
export const SEARCH_WITHOUT_ACCOUNT: readonly SocialPlatform[] = ["reddit", "quora"];

/** A public discussion a reply can answer, in its one canonical form. */
export type Thread = {
  platform: SocialPlatform;
  url: string;
  /** X's status id, Threads' shortcode: what the platform's reply link needs. */
  replyTo?: string;
  /** Quora's: each language is its own site (it.quora.com), quora.com English. */
  language?: string;
};

/**
 * The discussion a search result points at, or null when it is not one (a
 * profile, a topic page, a search page). Canonical, so the same discussion
 * reached by two URLs is suggested once.
 */
export function threadFromUrl(platform: SocialPlatform, raw: string): Thread | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^(www|old|new|m|mobile)\./, "");
  const path = url.pathname;

  switch (platform) {
    case "reddit": {
      const match = host === "reddit.com" && path.match(/^\/r\/([A-Za-z0-9_]{2,21})\/comments\/([a-z0-9]{4,12})(?:\/|$)/i);
      return match ? { platform, url: `https://www.reddit.com/r/${match[1]}/comments/${match[2].toLowerCase()}/` } : null;
    }
    case "quora": {
      // A question is one hyphenated segment; an answer adds /answer/<name>, and Google often
      // links a question nobody has answered yet as /unanswered/<question>. Quora's other
      // languages are two-letter subdomains (it.quora.com); any other subdomain is a Space.
      const language = host === "quora.com" ? "en" : host.match(/^([a-z]{2})\.quora\.com$/)?.[1];
      const match = language && path.match(/^(?:\/unanswered)?\/([A-Za-z0-9][^/]*-[^/]+)(?:\/answers?\/[^/]+)?\/?$/);
      if (!match) return null;
      const slug = match[1];
      if (/^(profile|topic|q|spaces?|search|about|unanswered|answer)$/i.test(slug)) return null;
      return { platform, url: `https://${language === "en" ? "www" : language}.quora.com/${slug}`, language };
    }
    case "x": {
      const match = (host === "x.com" || host === "twitter.com") && path.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})(?:\/|$)/);
      if (!match || /^(i|home|search|explore)$/i.test(match[1])) return null;
      return { platform, url: `https://x.com/${match[1]}/status/${match[2]}`, replyTo: match[2] };
    }
    case "threads": {
      const match = (host === "threads.com" || host === "threads.net") && path.match(/^\/@([A-Za-z0-9._]{1,30})\/post\/([A-Za-z0-9_-]{5,20})(?:\/|$)/);
      return match ? { platform, url: `https://www.threads.com/@${match[1]}/post/${match[2]}`, replyTo: match[2] } : null;
    }
    case "bluesky": {
      const match = host === "bsky.app" && path.match(/^\/profile\/([A-Za-z0-9.:-]{3,253})\/post\/([a-z0-9]{6,20})\/?$/i);
      return match ? { platform, url: `https://bsky.app/profile/${match[1]}/post/${match[2]}` } : null;
    }
    case "pinterest":
    case "linkedin":
      return null;
  }
}

const enc = encodeURIComponent;

/**
 * Where the one-click "Post" button sends the customer for a reply: the
 * platform's own reply box with the text filled in where it has one (X,
 * Threads), otherwise the discussion itself - the text is on their clipboard.
 */
export function replyUrl(thread: Thread, text: string): string {
  if (thread.platform === "x" && thread.replyTo) {
    return `https://x.com/intent/post?in_reply_to=${enc(thread.replyTo)}&text=${enc(text)}`;
  }
  if (thread.platform === "threads" && thread.replyTo) {
    return `https://www.threads.com/intent/post?reply_post_shortcode=${enc(thread.replyTo)}&text=${enc(text)}`;
  }
  return thread.url;
}

/** The longest address a platform's compose page is opened with. */
const MAX_COMPOSE_URL = 6000;

/** Where "Post" sends the customer for an own post that RepGet does not publish itself. */
export function composeUrl(
  platform: SocialPlatform,
  post: { title?: string | null; body: string; link?: string | null; imageUrl?: string | null },
): string {
  switch (platform) {
    case "x":
      return `https://x.com/intent/post?text=${enc(post.body)}`;
    case "threads":
      return `https://www.threads.com/intent/post?text=${enc(post.body)}`;
    case "bluesky":
      return `https://bsky.app/intent/compose?text=${enc(post.body)}`;
    case "reddit": {
      const base = `https://www.reddit.com/submit?type=TEXT&title=${enc(post.title ?? "")}`;
      // A long post makes an address servers refuse; its text is on the clipboard.
      const full = `${base}&text=${enc(post.body)}`;
      return full.length > MAX_COMPOSE_URL ? base : full;
    }
    case "pinterest": {
      const params = [
        ...(post.link ? [`url=${enc(post.link)}`] : []),
        ...(post.imageUrl ? [`media=${enc(post.imageUrl)}`] : []),
        `description=${enc(post.body)}`,
      ];
      return `https://www.pinterest.com/pin/create/button/?${params.join("&")}`;
    }
    case "linkedin": {
      // LinkedIn's share box with the text in it; a long post opens it empty, its text on the clipboard.
      const full = `https://www.linkedin.com/feed/?shareActive=true&text=${enc(post.body)}`;
      return full.length > MAX_COMPOSE_URL ? "https://www.linkedin.com/feed/?shareActive=true" : full;
    }
    case "quora":
      return "https://www.quora.com/";
  }
}

/** A profile link for a connected username. */
export function profileUrl(platform: SocialPlatform, username: string): string {
  const name = enc(username);
  switch (platform) {
    case "reddit":
      return `https://www.reddit.com/user/${name}/`;
    case "quora":
      return `https://www.quora.com/profile/${name}`;
    case "x":
      return `https://x.com/${name}`;
    case "threads":
      return `https://www.threads.com/@${name}`;
    case "pinterest":
      return `https://www.pinterest.com/${name}/`;
    case "bluesky":
      return `https://bsky.app/profile/${name}`;
    case "linkedin":
      return `https://www.linkedin.com/in/${name}/`;
  }
}

/** A username as typed - "@name", "u/name", a profile link - reduced to the name, or null. */
export function cleanUsername(platform: SocialPlatform, raw: string): string | null {
  let value = raw.trim();
  try {
    if (/^https?:\/\//i.test(value)) {
      const parts = new URL(value).pathname.split("/").filter(Boolean);
      value = (parts[0] === "user" || parts[0] === "u" || parts[0] === "profile" || parts[0] === "in" ? parts[1] : parts[0]) ?? "";
    }
  } catch {
    return null;
  }
  value = value.replace(/^(u\/|\/u\/|@)/i, "");
  const pattern =
    platform === "bluesky" ? /^[A-Za-z0-9.-]{3,253}$/ : platform === "quora" ? /^[A-Za-z0-9-]{2,100}$/ : /^[A-Za-z0-9._-]{1,50}$/;
  return pattern.test(value) ? value : null;
}
