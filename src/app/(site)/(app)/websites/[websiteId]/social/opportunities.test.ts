import { describe, expect, it } from "vitest";

import {
  customerStatus,
  discussionUrl,
  groupRows,
  matches,
  nextScheduled,
  openAction,
  postedLink,
  stageOf,
  tabCounts,
  visibleRows,
  whereOf,
  type SuggestionView,
} from "./opportunities";

/**
 * The Opportunities page's list (client's design, 2026-11-03): the stage of
 * each status, the tabs' counts, search, filter and sort, and the post
 * RepGet publishes next.
 */

let n = 0;
const row = (over: Partial<SuggestionView> = {}): SuggestionView => ({
  id: `s${(n += 1)}`,
  platform: "reddit",
  kind: "reply",
  status: "new",
  threadUrl: "https://www.reddit.com/r/photography/comments/abc123/",
  threadTitle: "Soft light indoors?",
  threadSnippet: "What do you use?",
  title: null,
  body: "A window and a white sheet.",
  warmup: false,
  link: null,
  imageUrl: null,
  scheduledFor: null,
  postedAt: null,
  postedUrl: null,
  error: null,
  createdAt: "2026-11-02T10:00:00Z",
  ...over,
});

describe("the stages", () => {
  it("map every status, a draft its own and an unknown one as suggested", () => {
    expect(["new", "draft", "scheduled", "posting", "failed", "posted", "odd"].map(stageOf)).toEqual([
      "suggested",
      "draft",
      "scheduled",
      "publishing",
      "failed",
      "published",
      "suggested",
    ]);
  });

  it("count in their tabs, a failed post under All only", () => {
    const rows = [row(), row({ status: "draft" }), row({ status: "scheduled" }), row({ status: "posting" }), row({ status: "failed" }), row({ status: "posted" })];
    expect(tabCounts(rows)).toEqual({ all: 6, suggested: 1, scheduled: 2, drafts: 1, published: 1 });
  });
});

describe("the list", () => {
  const failed = row({ status: "failed", createdAt: "2026-11-01T10:00:00Z" });
  const later = row({ status: "scheduled", platform: "x", scheduledFor: "2026-11-03T15:00:00Z" });
  const sooner = row({ status: "scheduled", platform: "bluesky", scheduledFor: "2026-11-03T09:00:00Z" });
  const fresh = row({ platform: "quora", threadUrl: "https://it.quora.com/Come-scegliere", createdAt: "2026-11-03T08:00:00Z" });
  const draft = row({ status: "draft", body: "My own words about lenses." });
  const posted = row({ status: "posted", postedAt: "2026-11-03T11:00:00Z" });
  const all = [posted, draft, fresh, sooner, later, failed];

  it("recommends what needs the customer first, then RepGet's next post, then the rest", () => {
    expect(visibleRows(all, { tab: "all", platform: "all", query: "", sort: "recommended" })).toEqual([failed, sooner, later, fresh, draft, posted]);
  });

  it("sorts newest first", () => {
    expect(visibleRows(all, { tab: "all", platform: "all", query: "", sort: "newest" })[0]).toBe(posted);
  });

  it("goes in one group per platform, in the platforms' order, an empty one only while nothing is filtered out", () => {
    const rows = visibleRows(all, { tab: "all", platform: "all", query: "", sort: "recommended" });
    expect(groupRows(rows, { keepEmpty: true }).map((group) => [group.platform, group.rows.length, group.fresh])).toEqual([
      ["reddit", 3, 0],
      ["quora", 1, 1],
      ["x", 1, 0],
      ["threads", 0, 0],
      ["pinterest", 0, 0],
      ["bluesky", 1, 0],
    ]);
    expect(groupRows([fresh], { keepEmpty: false }).map((group) => group.platform)).toEqual(["quora"]);
  });

  it("filters by tab, platform and search", () => {
    expect(visibleRows(all, { tab: "drafts", platform: "all", query: "", sort: "recommended" })).toEqual([draft]);
    expect(visibleRows(all, { tab: "all", platform: "quora", query: "", sort: "recommended" })).toEqual([fresh]);
    expect(visibleRows(all, { tab: "all", platform: "all", query: "LENSES", sort: "recommended" })).toEqual([draft]);
    expect(matches(fresh, "it.quora")).toBe(true);
  });

  it("puts the soonest scheduled post next", () => {
    expect(nextScheduled(all)).toBe(sooner);
    expect(nextScheduled([fresh, posted])).toBeNull();
  });
});

describe("what a customer is told about a post that did not go out", () => {
  it("is only what they can do something about: the provider's words stay on the server", () => {
    for (const error of ["bundle.social POST /post/ failed (403): Monthly post limit reached. Limit for this month is 20 posts.", "Duplicate content", null]) {
      expect(customerStatus({ status: "failed", error })).toEqual({ status: "new", error: null });
    }
    expect(customerStatus({ status: "failed", error: "not_enough_credits" })).toEqual({ status: "failed", error: "not_enough_credits" });
    expect(customerStatus({ status: "failed", error: "free_posts_used" })).toEqual({ status: "failed", error: "free_posts_used" });
    // Never as posted, and a draft kept from a refused post loses the provider's words too.
    expect(customerStatus({ status: "draft", error: "Duplicate content" })).toEqual({ status: "draft", error: null });
    expect(customerStatus({ status: "posted", error: null })).toEqual({ status: "posted", error: null });
  });
});

describe("the button that opens the real place", () => {
  it("is on everything the customer may post, whatever its stage", () => {
    for (const status of ["new", "draft", "failed", "scheduled"]) {
      expect(openAction(row({ status }), true)).toEqual({ kind: "post" });
      expect(openAction(row({ status, kind: "post", threadUrl: null }), true)).toEqual({ kind: "post" });
    }
    // Posted, with no address from the platform: the discussion, or the own post again (free).
    expect(openAction(row({ status: "posted" }), true)).toEqual({ kind: "link", href: "https://www.reddit.com/r/photography/comments/abc123/", published: false });
    expect(openAction(row({ status: "posted", kind: "post", threadUrl: null }), true)).toEqual({ kind: "post" });
    expect(openAction(row({ status: "posted", postedUrl: "https://www.reddit.com/user/me/comments/x/" }), true)).toMatchObject({ kind: "link", published: true });
    // Being handed over right now: it would go out twice.
    expect(openAction(row({ status: "posting", kind: "post", threadUrl: null }), true)).toBeNull();
  });

  it("only opens the discussion for a viewer", () => {
    expect(openAction(row(), false)).toMatchObject({ kind: "link", published: false });
    expect(openAction(row({ kind: "post", threadUrl: null }), false)).toBeNull();
  });

  it("never opens anything but the platform's own discussion or an https post", () => {
    for (const threadUrl of ["javascript:alert(1)", "https://evil.example/r/a/comments/abc123/", "https://www.reddit.com/user/me/"]) {
      expect(discussionUrl(row({ threadUrl }))).toBeNull();
    }
    for (const postedUrl of ["javascript:alert(1)", "http://x.com/a", "https://user:pass@x.com/a", "nonsense"]) expect(postedLink({ postedUrl })).toBeNull();
  });
});

describe("where a reply goes", () => {
  it("reads it from the discussion's address", () => {
    expect(whereOf(row())).toBe("r/photography");
    expect(whereOf({ platform: "x", threadUrl: "https://x.com/someone/status/123" })).toBe("@someone");
    expect(whereOf({ platform: "threads", threadUrl: "https://www.threads.com/@maker/post/Abc12" })).toBe("@maker");
    expect(whereOf({ platform: "bluesky", threadUrl: "https://bsky.app/profile/me.bsky.social/post/3abc" })).toBe("@me.bsky.social");
    expect(whereOf({ platform: "quora", threadUrl: "https://www.quora.com/How-to" })).toBe("quora.com");
    expect(whereOf({ platform: "x", threadUrl: null })).toBeNull();
  });
});
