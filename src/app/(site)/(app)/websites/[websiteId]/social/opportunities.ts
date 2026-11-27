import { isSocialPlatform, PLATFORMS, SOCIAL_PLATFORMS, threadFromUrl, type SocialPlatform } from "@/lib/social/platforms";

/**
 * The Opportunities page's list logic (client's design, 2026-11-03): which
 * stage a suggestion is in, the tabs, search, platform filter and sort.
 * Pure, so the page and its tests share it; no server imports.
 */

export type AccountView = {
  platform: string;
  username: string;
  /** Connected through bundle.social: RepGet can publish own posts. */
  connected: boolean;
  autoPost: boolean;
  warmupEndsAt: string;
  /** Still in the warm-up (decided on the server, as the rules are). */
  inWarmup: boolean;
  /** Automatic posting is paused. Why is never sent to the browser (lib/social/pause.ts): administrators read it in Admin. */
  paused: boolean;
  target: string | null;
};

export type SuggestionView = {
  id: string;
  platform: string;
  kind: string;
  status: string;
  threadUrl: string | null;
  threadTitle: string | null;
  threadSnippet: string | null;
  title: string | null;
  body: string;
  warmup: boolean;
  /** A Pin's link: what the page opened for it needs (lib/social/post-target.ts). */
  link: string | null;
  imageUrl: string | null;
  scheduledFor: string | null;
  postedAt: string | null;
  postedUrl: string | null;
  error: string | null;
  createdAt: string;
};

/**
 * The design's stages. "publishing" is RepGet handing a scheduled post to
 * the platform right now; "failed" is one that waits for credits or for next
 * month's free posts (customerStatus), shown under All only, with what to do.
 */
export type Stage = "suggested" | "draft" | "scheduled" | "publishing" | "failed" | "published";

/** Our own reasons a post did not go out, which the customer can do something about. */
const OWN_ERRORS = ["not_enough_credits", "free_posts_used"];

/**
 * A suggestion's status as its customer sees it (Daniel, 2026-11-24: "I think
 * we don't need to show this message to the clients, because they still can
 * use manual submissions"). One the provider or the platform refused is
 * simply ready to post by hand, like a new one, without the provider's words;
 * it stays "failed", with its error, in the database for administrators.
 */
export function customerStatus(row: { status: string; error: string | null }): { status: string; error: string | null } {
  if (row.status !== "failed") return { status: row.status, error: null };
  return row.error && OWN_ERRORS.includes(row.error) ? { status: "failed", error: row.error } : { status: "new", error: null };
}

export function stageOf(status: string): Stage {
  switch (status) {
    case "draft":
      return "draft";
    case "scheduled":
      return "scheduled";
    case "posting":
      return "publishing";
    case "failed":
      return "failed";
    case "posted":
      return "published";
    default:
      return "suggested";
  }
}

export const TABS = ["all", "suggested", "scheduled", "drafts", "published"] as const;
export type Tab = (typeof TABS)[number];

export function inTab(stage: Stage, tab: Tab): boolean {
  switch (tab) {
    case "all":
      return true;
    case "suggested":
      return stage === "suggested";
    case "scheduled":
      return stage === "scheduled" || stage === "publishing";
    case "drafts":
      return stage === "draft";
    case "published":
      return stage === "published";
  }
}

export function tabCounts(rows: SuggestionView[]): Record<Tab, number> {
  const stages = rows.map((row) => stageOf(row.status));
  return Object.fromEntries(TABS.map((tab) => [tab, stages.filter((stage) => inTab(stage, tab)).length])) as Record<Tab, number>;
}

export const SORTS = ["recommended", "newest"] as const;
export type Sort = (typeof SORTS)[number];

/** Recommended: what needs the customer first, then what RepGet does next, then what is done. */
const RANK: Record<Stage, number> = { failed: 0, publishing: 1, scheduled: 2, suggested: 3, draft: 4, published: 5 };

const time = (value: string | null) => (value ? new Date(value).getTime() : 0);

/** When it happened, for "Newest first" and the row's meta line: posted, else suggested. */
export const latest = (row: SuggestionView) => row.postedAt ?? row.createdAt;

function recommended(a: SuggestionView, b: SuggestionView): number {
  const sa = stageOf(a.status);
  const sb = stageOf(b.status);
  if (sa !== sb) return RANK[sa] - RANK[sb];
  // The soonest scheduled post first; otherwise the newest.
  if (sa === "scheduled") return time(a.scheduledFor) - time(b.scheduledFor);
  return time(latest(b)) - time(latest(a));
}

export function sortRows(rows: SuggestionView[], sort: Sort): SuggestionView[] {
  const copy = [...rows];
  if (sort === "newest") return copy.sort((a, b) => time(latest(b)) - time(latest(a)));
  return copy.sort(recommended);
}

export const platformName = (platform: string) => (isSocialPlatform(platform) ? PLATFORMS[platform].name : platform);

/** Waiting for the customer and untouched: the dot, and the platform's "N new". */
export const isNew = (row: Pick<SuggestionView, "status">) => stageOf(row.status) === "suggested";

export type PlatformGroup = { platform: SocialPlatform; rows: SuggestionView[]; fresh: number };

/**
 * The list as the ticket has it (screenshot 06): one group per platform, in
 * the platforms' own order, each keeping the rows' order. A platform with
 * nothing is listed only while nothing is filtered out.
 */
export function groupRows(
  rows: SuggestionView[],
  options: { keepEmpty: boolean; platforms?: readonly SocialPlatform[] },
): PlatformGroup[] {
  // An empty group only for a platform the page shows (LinkedIn: lib/social/platforms.ts NEEDS_BUNDLE).
  return SOCIAL_PLATFORMS.flatMap((platform) => {
    if (options.platforms && !options.platforms.includes(platform) && !rows.some((row) => row.platform === platform)) return [];
    const own = rows.filter((row) => row.platform === platform);
    return own.length > 0 || options.keepEmpty ? [{ platform, rows: own, fresh: own.filter(isNew).length }] : [];
  });
}

/** The group's heading writes X as the connections panel does. */
export const groupName = (platform: SocialPlatform) => (platform === "x" ? "X (Twitter)" : PLATFORMS[platform].name);

/** The discussion a reply answers, in its canonical https address on the platform's own site; null for anything else. */
export function discussionUrl(row: Pick<SuggestionView, "platform" | "threadUrl">): string | null {
  if (!row.threadUrl || !isSocialPlatform(row.platform)) return null;
  return threadFromUrl(row.platform, row.threadUrl)?.url ?? null;
}

/** A published post's address, as a link only when it is https. */
export function postedLink(row: Pick<SuggestionView, "postedUrl">): string | null {
  if (!row.postedUrl) return null;
  try {
    const url = new URL(row.postedUrl);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * What a row's "Open on / Create on" button does:
 *  - "post": the one-click post - copies the text, opens the discussion (to
 *    comment) or the platform's page for a new post, and counts as posted;
 *  - "link": opens the published post or the discussion, nothing else;
 *  - null: nothing to open. Only an own post RepGet is handing over right
 *    now, where posting it by hand would publish it twice, and a viewer's own
 *    post (posting is the owner's, and costs).
 */
export function openAction(row: SuggestionView, editable: boolean): { kind: "post" } | { kind: "link"; href: string; published: boolean } | null {
  const stage = stageOf(row.status);
  const discussion = discussionUrl(row);
  if (stage === "published") {
    const posted = postedLink(row);
    if (posted) return { kind: "link", href: posted, published: true };
    if (discussion) return { kind: "link", href: discussion, published: false };
    return editable ? { kind: "post" } : null;
  }
  if (stage === "publishing") return discussion ? { kind: "link", href: discussion, published: false } : null;
  if (editable) return { kind: "post" };
  return discussion ? { kind: "link", href: discussion, published: false } : null;
}

/**
 * Where a reply goes, from its discussion's address: r/subreddit, @account,
 * or Quora's site. Null for an own post (it goes to the customer's profile).
 */
export function whereOf(row: Pick<SuggestionView, "platform" | "threadUrl">): string | null {
  if (!row.threadUrl) return null;
  let url: URL;
  try {
    url = new URL(row.threadUrl);
  } catch {
    return null;
  }
  const path = url.pathname;
  switch (row.platform) {
    case "reddit": {
      const sub = path.match(/^\/r\/([^/]+)/)?.[1];
      return sub ? `r/${sub}` : null;
    }
    case "x": {
      const user = path.match(/^\/([^/]+)\/status\//)?.[1];
      return user ? `@${user}` : null;
    }
    case "threads": {
      const user = path.match(/^\/@([^/]+)/)?.[1];
      return user ? `@${user}` : null;
    }
    case "bluesky": {
      const handle = path.match(/^\/profile\/([^/]+)/)?.[1];
      return handle ? `@${handle}` : null;
    }
    default:
      return url.hostname.replace(/^www\./, "");
  }
}

/** Search across the discussion and the text, in any case. */
export function matches(row: SuggestionView, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return [row.threadTitle, row.threadSnippet, row.title, row.body, platformName(row.platform), whereOf(row)].some((value) =>
    value?.toLocaleLowerCase().includes(needle),
  );
}

export function visibleRows(rows: SuggestionView[], view: { tab: Tab; platform: string; query: string; sort: Sort }): SuggestionView[] {
  return sortRows(
    rows.filter(
      (row) =>
        inTab(stageOf(row.status), view.tab) && (view.platform === "all" || row.platform === view.platform) && matches(row, view.query),
    ),
    view.sort,
  );
}

/** The scheduled own post RepGet publishes next: the page's "Next to publish" strip. */
export function nextScheduled(rows: SuggestionView[]): SuggestionView | null {
  return (
    rows
      .filter((row) => row.status === "scheduled" && row.scheduledFor)
      .sort((a, b) => time(a.scheduledFor) - time(b.scheduledFor))[0] ?? null
  );
}

/** The text as it is pasted: a title (Reddit, Pinterest posts) on top of the body. */
export const pasteText = (title: string | null, body: string) => (title?.trim() ? `${title.trim()}\n\n${body}` : body);
