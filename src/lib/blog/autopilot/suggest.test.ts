import { asc } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { blogAutopilotTopics, blogPosts } from "@/lib/db/schema";
import { message } from "@/test/blog-autopilot";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Topics RepGet chooses itself from search data once the client's list runs
 * out (client's choice 3): real searched phrases, nothing the blog already
 * covers, each topic targeting one phrase exactly, added after his topics.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn() } }));
const ai = vi.hoisted(() => ({ stream: vi.fn() }));
vi.mock("@/lib/ai/client", () => ({
  anthropic: { messages: { stream: ai.stream } },
  MODELS: { EXTRACTION: "claude-haiku-4-5", GENERATION: "claude-sonnet-5", BLOG: "claude-sonnet-5" },
  isAiConfigured: () => true,
}));
const search = vi.hoisted(() => ({ ideas: vi.fn(), configured: vi.fn(() => true) }));
vi.mock("@/lib/providers/dataforseo", () => ({ keywordIdeas: search.ideas, isDataForSeoConfigured: search.configured }));

import type { KeywordMetrics } from "@/lib/providers/dataforseo";

import { candidates, SuggestError, suggestTopics } from "./suggest";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

const row = (term: string, volume: number | null, difficulty: number | null, intent: KeywordMetrics["intent"] = "informational"): KeywordMetrics => ({
  term,
  volume,
  difficulty,
  cpc: null,
  intent,
  source: "dataforseo_ideas",
});

const IDEAS = [
  row("how to improve local seo", 900, 20),
  row("google business profile categories", 1_600, 15),
  row("what is a meta description", 2_400, 30),
  row("local seo checklist", 1_000, 25),
  row("seo", 500_000, 95),
  row("ahrefs site audit", 3_000, 20),
  row("seo jobs remote", 2_000, 10),
  row("buy seo services", 700, 20, "transactional"),
  row("rare long tail question", 10, 5),
  row("hard keyword phrase", 5_000, 90),
];

beforeEach(async () => {
  await test.db.delete(blogAutopilotTopics);
  await test.db.delete(blogPosts);
  ai.stream.mockReset();
  search.ideas.mockReset();
  search.ideas.mockResolvedValue({ metrics: IDEAS, cached: false });
  search.configured.mockReturnValue(true);
});

describe("the search phrases a topic can target", () => {
  it("are real searches of a few words, not too hard, not brands or jobs, not already covered - the most promising first", () => {
    const picked = candidates(IDEAS, new Set(["local seo checklist"])).map((metrics) => metrics.term);
    expect(picked).toEqual(["google business profile categories", "what is a meta description", "how to improve local seo"]);
  });
});

describe("suggesting topics", () => {
  const answer = (topics: { topic: string; keyword: string; angle: string }[]) =>
    ai.stream.mockImplementationOnce(() => ({ finalMessage: async () => message({ topics }) }));

  it("adds the chosen topics after the client's, marked as RepGet's, with the search data in the notes", async () => {
    await test.db.insert(blogPosts).values({
      slug: "local-seo-small-business",
      title: "Local SEO for Small Businesses",
      category: "Guides",
      author: "RepGet team",
      primaryKeyword: "local seo for small businesses",
      secondaryKeywords: ["local seo checklist"],
    });
    await test.db.insert(blogAutopilotTopics).values({ topic: "The client's own topic", sortOrder: 3 });
    answer([
      { topic: "Choosing Google Business Profile categories", keyword: "Google Business Profile Categories", angle: "Which categories to pick and why." },
      { topic: "What a meta description is for", keyword: "what is a meta description", angle: "What it does and how to write one." },
      { topic: "A made-up phrase", keyword: "not a candidate", angle: "Dropped." },
      { topic: "Same phrase twice", keyword: "what is a meta description", angle: "Dropped." },
    ]);
    const result = await suggestTopics({ count: 3 });
    expect(result.added).toEqual(["Choosing Google Business Profile categories", "What a meta description is for"]);
    expect(result.costUsd).toBeGreaterThan(0);

    expect(search.ideas).toHaveBeenCalledWith(expect.arrayContaining(["local seo", "google search console", "llms.txt"]), "United States", "English", 500);
    const request = (ai.stream.mock.calls[0][0] as { messages: { content: string }[] }).messages[0].content;
    // What the blog covers is shown, and its phrases are not offered again.
    expect(request).toContain('Local SEO for Small Businesses (targets "local seo for small businesses")');
    expect(request).toContain("- The client's own topic");
    expect(request).not.toContain("local seo checklist |");
    expect(request).toContain("google business profile categories | 1600 searches | difficulty 15");

    const rows = await test.db.select().from(blogAutopilotTopics).orderBy(asc(blogAutopilotTopics.sortOrder));
    expect(rows.map((topic) => [topic.topic, topic.source, topic.sortOrder])).toEqual([
      ["The client's own topic", "admin", 3],
      ["Choosing Google Business Profile categories", "suggested", 4],
      ["What a meta description is for", "suggested", 5],
    ]);
    expect(rows[1]).toMatchObject({
      keyword: "google business profile categories",
      status: "queued",
      createdBy: "Blog autopilot",
      notes: "Which categories to pick and why. Search data (United States): about 1600 searches a month, difficulty 15/100.",
    });
  });

  it("never adds a topic or a phrase twice", async () => {
    await test.db.insert(blogAutopilotTopics).values({ topic: "What a meta description is for", sortOrder: 1, status: "written" });
    answer([
      { topic: "what a meta description  is for", keyword: "what is a meta description", angle: "" },
      { topic: "How to improve local SEO", keyword: "how to improve local seo", angle: "" },
    ]);
    expect((await suggestTopics()).added).toEqual(["How to improve local SEO"]);
  });

  it("says why when there is no search data to choose from", async () => {
    search.configured.mockReturnValue(false);
    await expect(suggestTopics()).rejects.toThrow(SuggestError);
    search.configured.mockReturnValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});
    search.ideas.mockRejectedValueOnce(new Error("40501"));
    await expect(suggestTopics()).rejects.toThrow("The search data could not be read just now");
    search.ideas.mockResolvedValueOnce({ metrics: [row("ahrefs", 9_000, 10)], cached: true });
    await expect(suggestTopics()).rejects.toThrow("no new phrases");
    expect(ai.stream).not.toHaveBeenCalled();
  });
});
