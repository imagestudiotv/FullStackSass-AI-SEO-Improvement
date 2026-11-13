import { isSocialPlatform, PLATFORMS, SOCIAL_PLATFORMS } from "@/lib/social/platforms";

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
  /** Why automatic posting is paused; null when it is not. */
  pausedReason: string | null;
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
  imageUrl: string | null;
  scheduledFor: string | null;
  postedAt: string | null;
  postedUrl: string | null;
  error: string | null;
  createdAt: string;
};

/**
 * The design's stages. "publishing" is RepGet handing a scheduled post to
 * the platform right now; "failed" is one it could not publish, shown under
 * All only, with its reason and a retry.
 */
export type Stage = "suggested" | "draft" | "scheduled" | "publishing" | "failed" | "published";

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

export const SORTS = ["recommended", "newest", "platform"] as const;
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

const platformIndex = (platform: string) => {
  const index = (SOCIAL_PLATFORMS as readonly string[]).indexOf(platform);
  return index < 0 ? SOCIAL_PLATFORMS.length : index;
};

export function sortRows(rows: SuggestionView[], sort: Sort): SuggestionView[] {
  const copy = [...rows];
  if (sort === "newest") return copy.sort((a, b) => time(latest(b)) - time(latest(a)));
  if (sort === "platform") return copy.sort((a, b) => platformIndex(a.platform) - platformIndex(b.platform) || recommended(a, b));
  return copy.sort(recommended);
}

export const platformName = (platform: string) => (isSocialPlatform(platform) ? PLATFORMS[platform].name : platform);

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
