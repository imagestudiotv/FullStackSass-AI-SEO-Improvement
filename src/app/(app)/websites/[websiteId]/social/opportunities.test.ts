import { describe, expect, it } from "vitest";

import { matches, nextScheduled, stageOf, tabCounts, visibleRows, whereOf, type SuggestionView } from "./opportunities";

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

  it("sorts newest first and by platform", () => {
    expect(visibleRows(all, { tab: "all", platform: "all", query: "", sort: "newest" })[0]).toBe(posted);
    expect(visibleRows(all, { tab: "all", platform: "all", query: "", sort: "platform" }).map((r) => r.platform)).toEqual([
      "reddit",
      "reddit",
      "reddit",
      "quora",
      "x",
      "bluesky",
    ]);
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
