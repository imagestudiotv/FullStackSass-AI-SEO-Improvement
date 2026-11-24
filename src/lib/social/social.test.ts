import { and, eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  articles,
  creditLedger,
  creditSettings,
  creditSpends,
  freePlanAccounts,
  keywords,
  socialAccounts,
  socialSuggestions,
  socialTeams,
  subscriptions,
  websites,
} from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * Social media (client, 2026-10-27) on a real database: the day's ten
 * suggestions and the rules they pass, the one-click post and its credit, a
 * trial's Quora-only access, and RepGet publishing own posts through
 * bundle.social - pausing an account the platform refused.
 */

const state = vi.hoisted(() => ({ db: null as unknown, access: "owner" }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
async function contextFor(websiteId: string) {
  const db = state.db as TestDb["db"];
  const [site] = await db.select().from(websites).where(eq(websites.id, websiteId));
  if (!site) throw new Error("not found");
  return { site, orgId: site.organizationId, userId: "user_1", access: state.access };
}
vi.mock("@/lib/tenant", () => ({ requireWebsite: vi.fn(contextFor) }));
vi.mock("@/lib/websites/require-editor", () => ({
  requireEditor: vi.fn(async (id: string) => {
    const context = await contextFor(id);
    return context.access === "viewer" ? { ok: false, error: "You have view-only access to this website." } : { ok: true, context };
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const queue = vi.hoisted(() => ({ queueJob: vi.fn(async () => true) }));
vi.mock("@/inngest/send", () => queue);
vi.mock("@/lib/ai/client", () => ({
  anthropic: { messages: { create: vi.fn() } },
  isAiConfigured: () => true,
  MODELS: { GENERATION: "claude-sonnet-5" },
}));
vi.mock("@/lib/providers/dataforseo", () => ({ isDataForSeoConfigured: () => true, discussionSearch: vi.fn() }));

import { recordCredit } from "@/lib/backlinks/credits";
import { FREE_PLAN } from "@/lib/plans/free-plan";
import { connectSocialUsername, editScheduledPost, postSocialSuggestion, saveSocialDraft, skipSocialSuggestion } from "./actions";
import { dailySuggestionWebsites } from "./daily";
import { checkPublished, publishSuggestion } from "./publish";
import { resumeQuotaPauses } from "./recover";
import { suggestForWebsite, type SuggestDeps } from "./suggest";
import type { Drafts } from "./write";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

const NOW = new Date("2026-10-28T07:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  state.access = "owner";
  queue.queueJob.mockClear();
  await test.db.delete(creditSettings);
  await test.db.insert(creditSettings).values({ key: "price:social_post", value: 1 });
  vi.stubEnv("BUNDLE_SOCIAL_API_KEY", "test-key");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function site(options: { trial?: boolean } = {}) {
  const seeded = await seedWebsite(test, { status: options.trial ? "trialing" : "active" });
  await test.db.update(websites).set({ brandName: "Image Studio", language: "English", country: "Ireland" }).where(eq(websites.id, seeded.websiteId));
  if (options.trial) {
    await test.db
      .update(subscriptions)
      .set({ currentPeriodStart: new Date(Date.now() - DAY), currentPeriodEnd: new Date(Date.now() + 29 * DAY) })
      .where(eq(subscriptions.websiteId, seeded.websiteId));
  }
  await test.db.insert(keywords).values([
    { websiteId: seeded.websiteId, term: "wedding photography tips", priorityScore: 9 },
    { websiteId: seeded.websiteId, term: "image studio prices", priorityScore: 8 },
  ]);
  return seeded;
}

/** A website on the Free plan (lib/plans/free-plan.ts): no subscription, a free_plan_accounts row. */
async function freeSite() {
  const seeded = await seedWebsite(test, { status: null });
  await test.db.update(websites).set({ brandName: "Image Studio", language: "English", country: "Ireland" }).where(eq(websites.id, seeded.websiteId));
  await test.db.insert(freePlanAccounts).values({ organizationId: seeded.orgId, websiteId: seeded.websiteId, domain: `${seeded.orgId}.example` });
  await test.db.insert(keywords).values([{ websiteId: seeded.websiteId, term: "wedding photography tips", priorityScore: 9 }]);
  return seeded;
}

async function account(websiteId: string, platform: string, options: { warm?: boolean; bundle?: boolean } = {}) {
  await test.db.insert(socialAccounts).values({
    websiteId,
    platform,
    username: `${platform}_user`,
    bundleAccountId: options.bundle ? `acc_${platform}` : null,
    // A warm account is still in its warm-up both at NOW and on the real clock, which the
    // one-click post checks against (from NOW alone it ended on 2026-10-31 07:00).
    warmupEndsAt: options.warm ? new Date(Math.max(NOW.getTime(), Date.now()) + 3 * DAY) : new Date(NOW.getTime() - DAY),
  });
}

const RESULTS: Record<string, string[]> = {
  "site:reddit.com": ["https://www.reddit.com/r/photography/comments/abc123/tips/", "https://www.reddit.com/r/photography/"],
  "site:x.com": ["https://x.com/someone/status/1234567890"],
  "site:quora.com": ["https://www.quora.com/How-do-I-choose-a-wedding-photographer"],
};
const search: SuggestDeps["search"] = vi.fn(async (query: string) => {
  const prefix = Object.keys(RESULTS).find((key) => query.startsWith(key)) ?? "";
  return { cached: false, items: (RESULTS[prefix] ?? []).map((url) => ({ url, title: `About ${url}`, description: "A question.", postedAt: null })) };
});
/** The same results, counted for one test. */
const spySearch = () => vi.fn<SuggestDeps["search"]>((...args) => search(...args));
const writer = (drafts: Drafts): SuggestDeps["write"] =>
  vi.fn(async () => ({ drafts, usage: { inputTokens: 100, outputTokens: 50, model: "claude-sonnet-5" } }));

describe("the day's suggestions", () => {
  it("are written, checked and saved: own posts scheduled where RepGet can publish, replies one-click", async () => {
    const { websiteId } = await site();
    await account(websiteId, "reddit", { warm: true });
    await account(websiteId, "x", { bundle: true });

    // Slots go reddit then x (account order); threads: reddit's, then x's.
    const result = await suggestForWebsite(websiteId, {
      now: NOW,
      random: () => 0.5,
      search,
      write: writer({
        posts: [
          { slot: 1, title: "Soft light for portraits", body: "What is your go-to setup for soft light indoors?" },
          { slot: 2, title: null, body: "Golden hour is overrated for portraits. Shade does more." },
        ],
        replies: [
          // During the reddit warm-up: a brand name - dropped.
          { thread: 1, body: "Image Studio does this well." },
          { thread: 2, body: "Shoot a test session first, then decide." },
        ],
      }),
    });

    const rows = await test.db.select().from(socialSuggestions).where(eq(socialSuggestions.websiteId, websiteId));
    expect(result.created).toBe(3);
    const xPost = rows.find((row) => row.platform === "x" && row.kind === "post")!;
    expect(xPost.status).toBe("scheduled");
    expect(xPost.scheduledFor!.getTime() - NOW.getTime()).toBe((180 + 180) * 60_000);
    expect(result.scheduled).toEqual([{ id: xPost.id, at: xPost.scheduledFor }]);
    // A username-only account: its own post waits for the customer's click.
    expect(rows.find((row) => row.platform === "reddit" && row.kind === "post")).toMatchObject({ status: "new", warmup: true });
    expect(rows.filter((row) => row.kind === "reply")).toEqual([
      expect.objectContaining({ platform: "x", threadUrl: "https://x.com/someone/status/1234567890", status: "new" }),
    ]);
    // The brand's own keyword was never searched.
    expect(vi.mocked(search).mock.calls.map(([query]) => query).some((query) => query.includes("image studio"))).toBe(false);
  });

  it("stop at ten a day, however often they are asked for", async () => {
    const { websiteId } = await site();
    await account(websiteId, "x");
    await test.db.insert(socialSuggestions).values(
      Array.from({ length: 10 }, (_, i) => ({ websiteId, platform: "x", kind: "reply", day: "2026-10-28", body: `old ${i}` })),
    );
    const write = writer({ posts: [], replies: [] });
    expect(await suggestForWebsite(websiteId, { now: NOW, search, write })).toMatchObject({ created: 0, reason: "today's suggestions are made" });
    expect(write).not.toHaveBeenCalled();
  });

  it("never suggest a discussion twice, nor a link in a reply", async () => {
    const { websiteId } = await site();
    await account(websiteId, "reddit");
    await test.db.insert(socialSuggestions).values({
      websiteId,
      platform: "reddit",
      kind: "reply",
      day: "2026-10-27",
      threadUrl: "https://www.reddit.com/r/photography/comments/abc123/",
      body: "answered yesterday",
    });
    const write = writer({ posts: [], replies: [{ thread: 1, body: "See https://example.com" }] });
    const result = await suggestForWebsite(websiteId, { now: NOW, search, write });
    const [, threads] = vi.mocked(write).mock.calls[0];
    expect(threads.filter((thread) => thread.platform === "reddit")).toEqual([]);
    expect(result.created).toBe(0);
  });

  it("name the business in a reply only with a disclosure, added at the end", async () => {
    const { websiteId } = await site();
    await account(websiteId, "reddit");
    await account(websiteId, "x");
    const write = writer({
      posts: [],
      replies: [
        // Named in the body, as if by an unrelated customer: dropped.
        { thread: 1, body: "Image Studio did mine, they were great." },
        { thread: 2, body: "In my studio we always shoot a test session first.", disclosure: "Disclosure: I run Image Studio." },
      ],
    });
    await suggestForWebsite(websiteId, { now: NOW, search, write });
    const rows = await test.db.select().from(socialSuggestions).where(eq(socialSuggestions.websiteId, websiteId));
    expect(rows.map((row) => [row.platform, row.body])).toEqual([
      ["x", "In my studio we always shoot a test session first.\n\nDisclosure: I run Image Studio."],
    ]);
  });

  it("pin each article image once, newest first", async () => {
    const { websiteId, orgId } = await site();
    await account(websiteId, "pinterest");
    const live = (title: string, days: number) => ({
      websiteId,
      title,
      status: "published",
      // On the website itself: a Pin after the warm-up links to its article.
      publishedUrl: `https://${orgId}.example/${title}`,
      firstLiveAt: new Date(NOW.getTime() - days * DAY),
      imageUrl: `https://cdn.example.com/${title}.webp`,
    });
    await test.db.insert(articles).values([live("newest", 1), live("older", 5)]);
    // The newest article's picture was pinned on an earlier day.
    await test.db.insert(socialSuggestions).values({
      websiteId,
      platform: "pinterest",
      kind: "post",
      day: "2026-10-20",
      title: "Pinned before",
      body: "Pinned before.",
      imageUrl: "https://cdn.example.com/newest.webp",
      status: "posted",
    });
    const write = writer({ posts: [{ slot: 1, title: "Soft light at home", body: "Three ways to get soft light at home." }], replies: [] });
    await suggestForWebsite(websiteId, { now: NOW, search, write });
    const [, , slots] = vi.mocked(write).mock.calls[0];
    expect(slots.filter((slot) => slot.platform === "pinterest")).toEqual([
      expect.objectContaining({ platform: "pinterest", imageUrl: "https://cdn.example.com/older.webp", topic: "older" }),
    ]);
    const pins = await test.db
      .select({ imageUrl: socialSuggestions.imageUrl })
      .from(socialSuggestions)
      .where(and(eq(socialSuggestions.websiteId, websiteId), eq(socialSuggestions.platform, "pinterest")));
    expect(pins.map((pin) => pin.imageUrl).sort()).toEqual(["https://cdn.example.com/newest.webp", "https://cdn.example.com/older.webp"]);

    // Every picture pinned: no Pin until the next article.
    const next = writer({ posts: [], replies: [] });
    await suggestForWebsite(websiteId, { now: new Date(NOW.getTime() + DAY), search, write: next });
    const [, , later] = vi.mocked(next).mock.calls[0];
    expect(later.map((slot) => slot.platform)).not.toContain("pinterest");
  });

  it("count a discussion for its own platform, whichever search found it, in the website's language", async () => {
    const { websiteId } = await site();
    await account(websiteId, "reddit");
    await account(websiteId, "quora");
    // Google ignored "site:quora.com"; the Reddit search found the Quora questions.
    const crossed: SuggestDeps["search"] = vi.fn(async (query: string) => ({
      cached: false,
      items: (query.startsWith("site:reddit.com")
        ? [
            "https://www.reddit.com/r/photography/comments/abc123/tips/",
            "https://www.quora.com/How-do-I-choose-a-wedding-photographer",
            "https://it.quora.com/Come-scegliere-un-fotografo-di-matrimonio",
          ]
        : ["https://www.facebook.com/groups/123/posts/456/"]
      ).map((url) => ({ url, title: url, description: "", postedAt: null })),
    }));
    const write = writer({ posts: [], replies: [] });
    await suggestForWebsite(websiteId, { now: NOW, search: crossed, write });
    const [, threads] = vi.mocked(write).mock.calls[0];
    expect(threads.map((thread) => thread.platform).sort()).toEqual(["quora", "reddit"]);
    expect(threads.find((thread) => thread.platform === "quora")!.title).toBe("https://www.quora.com/How-do-I-choose-a-wedding-photographer");
  });

  it("ask Google for recent Reddit threads only and drop a dated one Reddit has archived", async () => {
    const { websiteId } = await site();
    await account(websiteId, "reddit");
    await account(websiteId, "quora");
    const dated: SuggestDeps["search"] = vi.fn(async (query: string) => ({
      cached: false,
      items: query.startsWith("site:reddit.com")
        ? [
            { url: "https://www.reddit.com/r/marketing/comments/old111/video/", title: "Old", description: "", postedAt: new Date(NOW.getTime() - 400 * DAY) },
            { url: "https://www.reddit.com/r/marketing/comments/new222/video/", title: "New", description: "", postedAt: new Date(NOW.getTime() - 20 * DAY) },
            { url: "https://www.reddit.com/r/marketing/comments/und333/video/", title: "Undated", description: "", postedAt: null },
          ]
        : [{ url: "https://www.quora.com/How-old-can-a-question-be", title: "Quora", description: "", postedAt: new Date(NOW.getTime() - 900 * DAY) }],
    }));
    const write = writer({ posts: [], replies: [] });
    await suggestForWebsite(websiteId, { now: NOW, search: dated, write });
    const options = vi.mocked(dated).mock.calls.map(([query, , , , opts]) => [query.split(" ")[0], opts]);
    // The first search uses Google's filter; the wider ones carry the date in the query.
    expect(options.find(([prefix]) => prefix === "site:reddit.com")![1]).toEqual({ maxAgeMonths: 5 });
    expect(
      vi
        .mocked(dated)
        .mock.calls.filter(([query, , , , opts]) => /reddit/.test(query) && !(opts as { maxAgeMonths?: number }).maxAgeMonths)
        .every(([query]) => query.includes("after:2026-05-31")),
    ).toBe(true);
    expect(options.filter(([prefix]) => prefix === "site:quora.com").every(([, opts]) => !(opts as { maxAgeMonths?: number }).maxAgeMonths)).toBe(true);
    const [, threads] = vi.mocked(write).mock.calls[0];
    // Quora questions take answers at any age; Reddit's old thread is gone.
    expect(threads.map((thread) => thread.title).sort()).toEqual(["New", "Quora", "Undated"]);
  });

  it("spend the day's searches where too little was found, never more of them", async () => {
    const { websiteId } = await site();
    await test.db.insert(keywords).values(
      ["wedding album ideas", "engagement shoot tips", "bridal portrait poses"].map((term, i) => ({ websiteId, term, priorityScore: 5 - i })),
    );
    await account(websiteId, "x");
    await account(websiteId, "quora");
    await account(websiteId, "reddit");
    const counted: SuggestDeps["search"] = vi.fn(async (query: string) => ({
      cached: false,
      items: (query.startsWith("site:x.com")
        ? Array.from({ length: 8 }, (_, i) => `https://x.com/someone/status/12345678${i}`)
        : query.startsWith("site:reddit.com")
          ? ["https://www.reddit.com/r/photography/comments/abc123/tips/"]
          : ["https://www.facebook.com/groups/123/posts/456/"]
      ).map((url) => ({ url, title: url, description: "", postedAt: null })),
    }));
    await suggestForWebsite(websiteId, { now: NOW, search: counted, write: writer({ posts: [], replies: [] }) });
    const queries = vi.mocked(counted).mock.calls.map(([query]) => query);
    const on = (prefix: string) => queries.filter((query) => query.startsWith(prefix));
    // Two a platform on average: X had plenty after one; Quora, finding nothing, got its three.
    expect(queries).toHaveLength(6);
    expect(on("site:x.com")).toHaveLength(1);
    expect(on("site:quora.com")).toHaveLength(3);
    expect(new Set(on("site:quora.com")).size).toBe(3);
    expect(on("site:reddit.com")).toHaveLength(2);
  });

  it("find Reddit discussions to reply to when the narrow searches are empty (Daniel, 2026-11-24)", async () => {
    const { websiteId } = await site();
    await test.db.insert(keywords).values([{ websiteId, term: "how to choose the best wedding photographer near me in 2026", priorityScore: 20 }]);
    for (const platform of ["reddit", "x", "bluesky", "pinterest"]) await account(websiteId, platform, { bundle: true });
    // What DataForSEO answers for a long keyword, inside one site, inside five months: 40102, an error.
    const empty: SuggestDeps["search"] = vi.fn(async (query: string) => {
      if (query.startsWith("site:")) throw new Error("DataForSEO task error 40102: No Search Results.");
      return {
        cached: false,
        items: [
          { url: "https://www.reddit.com/r/weddingplanning/comments/zz99aa/lost/", title: "We are lost, every photographer looks the same", description: "Help.", postedAt: new Date(NOW.getTime() - 10 * DAY) },
          { url: "https://www.reddit.com/r/weddingplanning/comments/zz00aa/old/", title: "Archived", description: "", postedAt: new Date(NOW.getTime() - 300 * DAY) },
        ],
      };
    });
    const write = writer({ posts: [], replies: [{ thread: 1, body: "Ask each one for a full gallery from one day." }] });
    const result = await suggestForWebsite(websiteId, { now: NOW, search: empty, write });
    const rows = await test.db.select().from(socialSuggestions).where(eq(socialSuggestions.websiteId, websiteId));
    expect(rows).toEqual([
      expect.objectContaining({ platform: "reddit", kind: "reply", status: "new", threadUrl: "https://www.reddit.com/r/weddingplanning/comments/zz99aa/" }),
    ]);
    expect(result.discussions!.reddit).toMatchObject({ searches: 3, failed: 2, found: 2, old: 1, offered: 1, written: 1, kept: 1 });
    // Two searches a replying platform, as before (Reddit, X, Bluesky, and Quora although it has no account).
    expect(vi.mocked(empty).mock.calls.length).toBeLessThanOrEqual(8);
    // A reply is always the customer's click, whatever the account.
    expect(result.scheduled).toEqual([]);
  });

  it("offer several Reddit discussions, so the model skipping some still leaves a reply", async () => {
    const { websiteId } = await site();
    for (const platform of ["quora", "x", "threads", "bluesky", "reddit"]) await account(websiteId, platform);
    const plenty: SuggestDeps["search"] = vi.fn(async (query: string) => ({
      cached: false,
      items: Array.from({ length: 8 }, (_, i) => ({
        url: query.startsWith("site:reddit.com")
          ? `https://www.reddit.com/r/photography/comments/many0${i}/t/`
          : query.startsWith("site:quora.com")
            ? `https://www.quora.com/Question-number-${i}`
            : query.startsWith("site:x.com")
              ? `https://x.com/a/status/5550${i}`
              : `https://bsky.app/profile/a.bsky.social/post/abcdef${i}`,
        title: `T${i}`,
        description: "",
        postedAt: null,
      })),
    }));
    const write = writer({ posts: [], replies: [] });
    await suggestForWebsite(websiteId, { now: NOW, search: plenty, write });
    const [, threads, , wanted] = vi.mocked(write).mock.calls[0];
    expect(threads[0].platform).toBe("reddit");
    expect(threads.filter((thread) => thread.platform === "reddit")).toHaveLength(5);
    // Four own posts (no picture to pin yet), six replies.
    expect(wanted).toBe(6);
  });

  it("need no connected account: own posts and discussions by hand, written as in a warm-up", async () => {
    const { websiteId } = await site();
    const write = writer({
      posts: [
        { slot: 1, title: "Soft light", body: "What is your go-to setup for soft light indoors?" },
        // A new account's rules: RepGet knows nothing about the account this goes out on.
        { slot: 2, title: null, body: "More at imagestudio.io" },
      ],
      replies: [
        { thread: 1, body: "Shoot a test session first, then decide." },
        { thread: 2, body: "Image Studio does this well." },
      ],
    });
    const counted = spySearch();
    const result = await suggestForWebsite(websiteId, { now: NOW, search: counted, write });
    const [, threads, slots] = vi.mocked(write).mock.calls[0];
    // No image to pin yet, so no Pin.
    expect(slots.map((slot) => slot.platform)).toEqual(["reddit", "x", "threads", "bluesky"]);
    expect(slots.every((slot) => slot.warmup && !slot.link)).toBe(true);
    expect(threads.every((thread) => thread.warmup)).toBe(true);
    const rows = await test.db.select().from(socialSuggestions).where(eq(socialSuggestions.websiteId, websiteId));
    expect(rows.map((row) => [row.platform, row.kind, row.status, row.warmup]).sort()).toEqual([
      ["reddit", "post", "new", true],
      ["reddit", "reply", "new", true],
    ]);
    expect(result.scheduled).toEqual([]);
    // Reddit and Quora only, two searches each.
    expect(counted.mock.calls.every(([query]) => /reddit|quora/.test(query))).toBe(true);
    expect(counted.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("fall back to what the analysis found when there are no keywords yet", async () => {
    const { websiteId } = await site();
    await test.db.delete(keywords).where(eq(keywords.websiteId, websiteId));
    await test.db.update(websites).set({ industry: "Wedding photography", services: ["Album design"] }).where(eq(websites.id, websiteId));
    const counted = spySearch();
    await suggestForWebsite(websiteId, { now: NOW, search: counted, write: writer({ posts: [], replies: [] }) });
    expect(counted.mock.calls.map(([query]) => query).join("\n")).toMatch(/wedding photography|album design/i);
  });

  it("wait for the website's analysis", async () => {
    const { websiteId } = await site();
    await test.db.update(websites).set({ status: "crawling" }).where(eq(websites.id, websiteId));
    const write = writer({ posts: [], replies: [] });
    expect(await suggestForWebsite(websiteId, { now: NOW, search, write })).toMatchObject({ created: 0, reason: "website not ready" });
    expect(write).not.toHaveBeenCalled();
  });

  it("are not written every morning for a page nobody uses, but are when asked for", async () => {
    const { websiteId } = await site();
    await test.db.insert(socialSuggestions).values(
      Array.from({ length: 10 }, (_, i) => ({ websiteId, platform: "x", kind: "post", day: "2026-10-26", body: `waiting ${i}` })),
    );
    const counted = spySearch();
    const write = writer({ posts: [], replies: [] });
    expect(await suggestForWebsite(websiteId, { now: NOW, search: counted, write }, { daily: true })).toMatchObject({ reason: "earlier suggestions are still waiting" });
    expect(counted).not.toHaveBeenCalled();
    await suggestForWebsite(websiteId, { now: NOW, search: counted, write });
    expect(write).toHaveBeenCalledTimes(1);
    // A week later they are off the page: one new run.
    await suggestForWebsite(websiteId, { now: new Date(NOW.getTime() + 8 * DAY), search: counted, write }, { daily: true });
    expect(write).toHaveBeenCalledTimes(2);
    // With an account connected the morning run goes on as before.
    await account(websiteId, "x");
    await suggestForWebsite(websiteId, { now: NOW, search: counted, write }, { daily: true });
    expect(write).toHaveBeenCalledTimes(3);
  });

  it("keep a Free website without accounts inside its month, and write nothing once its AI budget is spent", async () => {
    const { websiteId } = await freeSite();
    for (let n = 0; n < FREE_PLAN.socialSuggestionsPerMonth - 1; n += 1) {
      await suggestion(websiteId, { platform: "reddit", threadUrl: `https://www.reddit.com/r/photography/comments/g${n}aaa/x/`, day: "2026-10-02", status: "dismissed" });
    }
    const write = writer({
      posts: [{ slot: 1, title: "Soft light", body: "What is your go-to setup for soft light indoors?" }, { slot: 2, title: null, body: "Shade beats golden hour." }],
      replies: [],
    });
    expect((await suggestForWebsite(websiteId, { now: NOW, search, write })).created).toBe(1);
    vi.stubEnv("FREE_PLAN_DAILY_AI_BUDGET_CENTS", "0");
    const other = await freeSite();
    expect(await suggestForWebsite(other.websiteId, { now: NOW, search, write })).toMatchObject({ created: 0, reason: "no plan" });
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("on a trial use Quora only", async () => {
    const { websiteId } = await site({ trial: true });
    await account(websiteId, "reddit");
    await account(websiteId, "quora");
    const write = writer({ posts: [], replies: [{ thread: 1, body: "Meet two or three first and compare portfolios." }] });
    await suggestForWebsite(websiteId, { now: NOW, search, write });
    const rows = await test.db.select().from(socialSuggestions).where(eq(socialSuggestions.websiteId, websiteId));
    expect(rows.map((row) => row.platform)).toEqual(["quora"]);
  });
});

async function suggestion(websiteId: string, values: Partial<typeof socialSuggestions.$inferInsert> = {}) {
  const [row] = await test.db
    .insert(socialSuggestions)
    .values({
      websiteId,
      platform: "x",
      kind: "reply",
      day: "2026-10-28",
      threadUrl: "https://x.com/someone/status/1234567890",
      body: "Shoot a test session first.",
      ...values,
    })
    .returning();
  return row;
}

describe("the one-click post", () => {
  it("charges its credit once and returns the platform's reply box", async () => {
    const { orgId, websiteId } = await site();
    await account(websiteId, "x");
    await recordCredit(orgId, { type: "adjustment", amount: 5, note: "test" });
    const row = await suggestion(websiteId);

    const first = await postSocialSuggestion(websiteId, row.id, { body: "Shoot a test session first!" });
    expect(first).toEqual({
      ok: true,
      data: { url: "https://x.com/intent/post?in_reply_to=1234567890&text=Shoot%20a%20test%20session%20first!", filled: true },
    });
    // Clicking again (a closed tab) costs nothing more.
    expect((await postSocialSuggestion(websiteId, row.id, { body: "Shoot a test session first!" })).ok).toBe(true);
    const spends = await test.db.select().from(creditSpends).where(eq(creditSpends.organizationId, orgId));
    expect(spends).toEqual([expect.objectContaining({ action: "social_post", credits: 1, idempotencyKey: `social:${row.id}` })]);
    const [saved] = await test.db.select().from(socialSuggestions).where(eq(socialSuggestions.id, row.id));
    expect(saved).toMatchObject({ status: "posted", body: "Shoot a test session first!" });
  });

  it("is refused without the credit, changing nothing", async () => {
    const { websiteId } = await site();
    await account(websiteId, "x");
    const row = await suggestion(websiteId);
    expect(await postSocialSuggestion(websiteId, row.id, { body: row.body })).toEqual({
      ok: false,
      error: "not_enough_credits",
      price: 1,
      available: 0,
    });
    const [saved] = await test.db.select().from(socialSuggestions).where(eq(socialSuggestions.id, row.id));
    expect(saved.status).toBe("new");
  });

  it("is Quora only on a trial, and never for a viewer", async () => {
    const { orgId, websiteId } = await site({ trial: true });
    await recordCredit(orgId, { type: "adjustment", amount: 5, note: "test" });
    const x = await suggestion(websiteId);
    expect(await postSocialSuggestion(websiteId, x.id, { body: x.body })).toEqual({ ok: false, error: "not_included" });
    const quora = await suggestion(websiteId, { platform: "quora", threadUrl: "https://www.quora.com/How-do-I-choose-a-wedding-photographer" });
    expect(await postSocialSuggestion(websiteId, quora.id, { body: quora.body })).toEqual({
      ok: true,
      // Quora has no reply link: the customer pastes the copied text, and the page must know it.
      data: { url: "https://www.quora.com/How-do-I-choose-a-wedding-photographer", filled: false },
    });
    state.access = "viewer";
    expect(await postSocialSuggestion(websiteId, quora.id, { body: quora.body })).toEqual({ ok: false, error: "view_only" });
  });

  it("keeps the warm-up's rules when the customer edits the text", async () => {
    const { orgId, websiteId } = await site();
    await account(websiteId, "x", { warm: true });
    await recordCredit(orgId, { type: "adjustment", amount: 5, note: "test" });
    const row = await suggestion(websiteId);
    expect(await postSocialSuggestion(websiteId, row.id, { body: "More on my site: imagestudio.io" })).toEqual({ ok: false, error: "warmup_link" });
    expect(await postSocialSuggestion(websiteId, row.id, { body: "At Image Studio we test first." })).toEqual({ ok: false, error: "warmup_brand" });
    expect(await postSocialSuggestion(websiteId, row.id, { body: "x".repeat(281) })).toEqual({ ok: false, error: "too_long" });
  });
});

describe("the websites the morning run asks for", () => {
  it("are analysed, on a plan or Free - with or without accounts; a Free one without an account once a week", async () => {
    const paid = await site();
    const analysing = await site();
    await test.db.update(websites).set({ status: "crawling" }).where(eq(websites.id, analysing.websiteId));
    const none = await seedWebsite(test, { status: null });
    const ended = await seedWebsite(test, { status: "canceled" });
    const free = await freeSite();
    const freeConnected = await freeSite();
    await account(freeConnected.websiteId, "x");
    await test.db.update(websites).set({ createdAt: new Date(NOW.getTime() - 30 * DAY) }).where(eq(websites.id, free.websiteId));

    const days = await Promise.all(Array.from({ length: 7 }, (_, i) => dailySuggestionWebsites(new Date(NOW.getTime() + i * DAY))));
    for (const day of days) {
      expect(day).toContain(paid.websiteId);
      expect(day).toContain(freeConnected.websiteId);
      for (const id of [analysing.websiteId, none.websiteId, ended.websiteId]) expect(day).not.toContain(id);
      expect(new Set(day).size).toBe(day.length);
    }
    expect(days.filter((day) => day.includes(free.websiteId))).toHaveLength(1);
    // A new Free website does not wait for its weekday.
    await test.db.update(websites).set({ createdAt: new Date(NOW.getTime() - DAY) }).where(eq(websites.id, free.websiteId));
    expect(await dailySuggestionWebsites(NOW)).toContain(free.websiteId);
  });
});

describe("a post RepGet could not publish", () => {
  async function refused(error: { status: number; message: string }) {
    await test.db.delete(socialAccounts);
    const { orgId, websiteId } = await site();
    await account(websiteId, "bluesky", { bundle: true });
    await test.db.insert(socialTeams).values({ websiteId, teamId: `team_${websiteId}` });
    await recordCredit(orgId, { type: "adjustment", amount: 5, note: "test" });
    const row = await suggestion(websiteId, { platform: "bluesky", kind: "post", threadUrl: null, status: "scheduled", scheduledFor: NOW, body: "Shade beats golden hour." });
    const waiting = await suggestion(websiteId, { platform: "bluesky", kind: "post", threadUrl: null, status: "scheduled", scheduledFor: new Date(NOW.getTime() + DAY), body: "Second tip." });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: error.message }), { status: error.status })));
    expect(await publishSuggestion(row.id, NOW)).toBe("failed");
    const balance = async () => (await test.db.select().from(creditLedger).where(eq(creditLedger.organizationId, orgId))).reduce((sum, entry) => sum + entry.amount, 0);
    const read = async (id: string) => (await test.db.select().from(socialSuggestions).where(eq(socialSuggestions.id, id)))[0];
    const acct = async () => (await test.db.select().from(socialAccounts).where(eq(socialAccounts.websiteId, websiteId)))[0];
    return { orgId, websiteId, row, waiting, balance, read, acct };
  }
  const LIMIT = { status: 403, message: "Monthly post limit reached. Limit for this month is 20 posts." };

  it("keeps its text and error, gives the credit back, and is charged once when posted by hand", async () => {
    const { orgId, websiteId, row, balance, read } = await refused(LIMIT);
    // For administrators: the status and the provider's words stay on the row.
    expect(await read(row.id)).toMatchObject({ status: "failed", body: row.body, postedAt: null, error: expect.stringContaining("Monthly post limit reached") });
    expect(await balance()).toBe(5);

    expect((await postSocialSuggestion(websiteId, row.id, { body: row.body })).ok).toBe(true);
    expect(await balance()).toBe(4);
    // Clicked again (a closed tab): nothing more.
    expect((await postSocialSuggestion(websiteId, row.id, { body: row.body })).ok).toBe(true);
    expect(await balance()).toBe(4);
    expect(await read(row.id)).toMatchObject({ status: "posted", error: null, creditSpendKey: `social:${row.id}:hand` });
    expect((await test.db.select().from(creditSpends).where(eq(creditSpends.organizationId, orgId))).filter((spend) => !spend.refundedAt)).toHaveLength(1);
  });

  it("hands the account's other waiting posts to the customer, and can be kept as a draft", async () => {
    const { websiteId, row, waiting, balance, read } = await refused(LIMIT);
    expect(await read(waiting.id)).toMatchObject({ status: "new", scheduledFor: null, body: "Second tip." });
    expect(await saveSocialDraft(websiteId, row.id, { body: "Shade beats golden hour, always." })).toEqual({ ok: true, data: null });
    // The error stays for administrators (lib/admin/social-posting.ts).
    expect(await read(row.id)).toMatchObject({ status: "draft", body: "Shade beats golden hour, always.", error: expect.stringContaining("limit") });
    expect(await balance()).toBe(5);
  });

  it("starts again by itself after a provider limit, once, and pauses again if it is still there", async () => {
    const { websiteId, acct } = await refused(LIMIT);
    expect((await acct()).pausedReason).toContain("Monthly post limit reached");
    expect(await resumeQuotaPauses(new Date(NOW.getTime() + 2 * DAY))).toEqual([]);
    const resumed = await resumeQuotaPauses(new Date(NOW.getTime() + 3 * DAY));
    expect(resumed).toEqual([expect.objectContaining({ websiteId, platform: "bluesky" })]);
    expect(await acct()).toMatchObject({ pausedAt: null, pausedReason: null, autoPost: true });
    const again = await suggestion(websiteId, { platform: "bluesky", kind: "post", threadUrl: null, status: "scheduled", scheduledFor: NOW, body: "Third tip." });
    const later = new Date(NOW.getTime() + 3 * DAY);
    expect(await publishSuggestion(again.id, later)).toBe("failed");
    expect((await acct()).pausedAt).toEqual(later);
  });

  it("never starts again by itself after the platform's own refusal", async () => {
    const { acct } = await refused({ status: 403, message: "This account is suspended for spam" });
    expect(await resumeQuotaPauses(new Date(NOW.getTime() + 60 * DAY))).toEqual([]);
    expect((await acct()).pausedReason).toContain("suspended for spam");
  });
});

describe("a scheduled post the customer posts by hand", () => {
  it("goes out once: charged once, and RepGet no longer publishes it", async () => {
    const { orgId, websiteId } = await site();
    await account(websiteId, "x", { bundle: true });
    await test.db.insert(socialTeams).values({ websiteId, teamId: "team_hand" });
    await recordCredit(orgId, { type: "adjustment", amount: 5, note: "test" });
    const row = await suggestion(websiteId, { kind: "post", threadUrl: null, status: "scheduled", scheduledFor: NOW, body: "Shade beats golden hour." });
    expect(await postSocialSuggestion(websiteId, row.id, { body: row.body })).toMatchObject({ ok: true, data: { filled: true } });
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect(await publishSuggestion(row.id, NOW)).toBe("skipped");
    expect(fetch).not.toHaveBeenCalled();
    expect(await test.db.select().from(creditSpends).where(eq(creditSpends.organizationId, orgId))).toHaveLength(1);

    // One RepGet is handing over right now is not: it would go out twice.
    const handed = await suggestion(websiteId, { kind: "post", threadUrl: null, status: "posting", body: "Being published." });
    expect(await postSocialSuggestion(websiteId, handed.id, { body: handed.body })).toEqual({ ok: false, error: "already_handled" });
  });
});

describe("the Free plan's social posts", () => {
  const thread = (n: number) => `https://x.com/someone/status/${1000 + n}`;

  it("cost no credit and stop at the month's eight, however many credits the workspace has; a refused one is not counted", async () => {
    const { orgId, websiteId } = await freeSite();
    await account(websiteId, "x");
    // Bought credits do not post more on Free.
    await recordCredit(orgId, { type: "adjustment", amount: 50, note: "test" });
    const rows = [];
    for (let n = 0; n <= FREE_PLAN.socialPostsPerMonth; n += 1) rows.push(await suggestion(websiteId, { threadUrl: thread(n) }));

    for (const row of rows.slice(0, FREE_PLAN.socialPostsPerMonth)) {
      expect((await postSocialSuggestion(websiteId, row.id, { body: row.body })).ok).toBe(true);
    }
    const last = rows[FREE_PLAN.socialPostsPerMonth];
    expect(await postSocialSuggestion(websiteId, last.id, { body: last.body })).toEqual({ ok: false, error: "free_posts_used" });
    const [waiting] = await test.db.select().from(socialSuggestions).where(eq(socialSuggestions.id, last.id));
    expect(waiting.status).toBe("new");
    // Clicking a counted post again (a closed tab) takes nothing more.
    expect((await postSocialSuggestion(websiteId, rows[0].id, { body: rows[0].body })).ok).toBe(true);
    expect(await test.db.select().from(creditSpends).where(eq(creditSpends.organizationId, orgId))).toEqual([]);

    // A post the platform refused gives its place back.
    await test.db.update(socialSuggestions).set({ status: "failed" }).where(eq(socialSuggestions.id, rows[1].id));
    expect((await postSocialSuggestion(websiteId, last.id, { body: last.body })).ok).toBe(true);
  });

  it("count only this month's: last month's posts leave this month's eight", async () => {
    const { websiteId } = await freeSite();
    await account(websiteId, "x");
    const lastMonth = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1) - DAY);
    for (let n = 0; n < FREE_PLAN.socialPostsPerMonth; n += 1) {
      await suggestion(websiteId, { threadUrl: thread(n), status: "posted", postedAt: lastMonth });
    }
    const row = await suggestion(websiteId, { threadUrl: thread(50) });
    expect((await postSocialSuggestion(websiteId, row.id, { body: row.body })).ok).toBe(true);
  });

  it("are published by RepGet without a credit, until the month's are used", async () => {
    const { orgId, websiteId } = await freeSite();
    await account(websiteId, "x", { bundle: true });
    await test.db.insert(socialTeams).values({ websiteId, teamId: "team_free" });
    const first = await suggestion(websiteId, { kind: "post", threadUrl: null, status: "scheduled", scheduledFor: NOW, body: "Shade beats golden hour." });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ id: "post_free", status: "SCHEDULED", error: null, errors: null, externalData: null }), { status: 200 })));
    expect(await publishSuggestion(first.id, NOW)).toBe("posting");
    expect(await test.db.select().from(creditSpends).where(eq(creditSpends.organizationId, orgId))).toEqual([]);

    for (let n = 1; n < FREE_PLAN.socialPostsPerMonth; n += 1) {
      await suggestion(websiteId, { threadUrl: thread(n), status: "posted", postedAt: NOW });
    }
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const next = await suggestion(websiteId, { kind: "post", threadUrl: null, status: "scheduled", scheduledFor: NOW, body: "Another tip." });
    expect(await publishSuggestion(next.id, NOW)).toBe("free_posts_used");
    expect(fetch).not.toHaveBeenCalled();
    const [saved] = await test.db.select().from(socialSuggestions).where(eq(socialSuggestions.id, next.id));
    expect(saved).toMatchObject({ status: "failed", error: "free_posts_used" });
  });

  it("get the month's drafts from the AI, not ten a day", async () => {
    const { websiteId } = await freeSite();
    await account(websiteId, "reddit");
    for (let n = 0; n < FREE_PLAN.socialSuggestionsPerMonth; n += 1) {
      await suggestion(websiteId, { platform: "reddit", threadUrl: `https://www.reddit.com/r/photography/comments/f${n}/x/`, day: "2026-10-02", status: "dismissed" });
    }
    const write = writer({ posts: [], replies: [] });
    expect(await suggestForWebsite(websiteId, { now: NOW, search, write })).toMatchObject({ created: 0, reason: "this month's Free suggestions are made" });
    expect(write).not.toHaveBeenCalled();
  });
});

describe("a saved draft", () => {
  it("keeps the customer's edit without posting or charging, and posts later as saved", async () => {
    const { orgId, websiteId } = await site();
    await account(websiteId, "x");
    await recordCredit(orgId, { type: "adjustment", amount: 5, note: "test" });
    const row = await suggestion(websiteId);

    expect(await saveSocialDraft(websiteId, row.id, { body: "  Shoot a test session first, always.  " })).toEqual({ ok: true, data: null });
    let [saved] = await test.db.select().from(socialSuggestions).where(eq(socialSuggestions.id, row.id));
    expect(saved).toMatchObject({ status: "draft", body: "Shoot a test session first, always." });
    // Saved again: still a draft, with the newer text.
    expect(await saveSocialDraft(websiteId, row.id, { body: "Test session first." })).toEqual({ ok: true, data: null });
    expect(await test.db.select().from(creditSpends).where(eq(creditSpends.organizationId, orgId))).toEqual([]);

    const posted = await postSocialSuggestion(websiteId, row.id, { body: "Test session first." });
    expect(posted).toEqual({ ok: true, data: { url: "https://x.com/intent/post?in_reply_to=1234567890&text=Test%20session%20first.", filled: true } });
    [saved] = await test.db.select().from(socialSuggestions).where(eq(socialSuggestions.id, row.id));
    expect(saved.status).toBe("posted");
    expect(await test.db.select().from(creditSpends).where(eq(creditSpends.organizationId, orgId))).toHaveLength(1);
    // Once posted it is not a draft again.
    expect(await saveSocialDraft(websiteId, row.id, { body: "Too late." })).toEqual({ ok: false, error: "already_handled" });
  });

  it("is only for a suggestion waiting for the customer", async () => {
    const { websiteId } = await site();
    await account(websiteId, "x", { bundle: true });
    for (const status of ["scheduled", "posting", "dismissed"]) {
      const row = await suggestion(websiteId, { kind: "post", threadUrl: null, status });
      expect(await saveSocialDraft(websiteId, row.id, { body: "An edit." })).toEqual({ ok: false, error: "already_handled" });
      const [kept] = await test.db.select().from(socialSuggestions).where(eq(socialSuggestions.id, row.id));
      expect(kept).toMatchObject({ status, body: "Shoot a test session first." });
    }
  });

  it("is held to the platform's rules and the warm-up", async () => {
    const { websiteId } = await site();
    await account(websiteId, "x", { warm: true });
    const row = await suggestion(websiteId);
    expect(await saveSocialDraft(websiteId, row.id, { body: "   " })).toEqual({ ok: false, error: "empty" });
    expect(await saveSocialDraft(websiteId, row.id, { body: "x".repeat(281) })).toEqual({ ok: false, error: "too_long" });
    expect(await saveSocialDraft(websiteId, row.id, { body: "More on my site: imagestudio.io" })).toEqual({ ok: false, error: "warmup_link" });
    expect(await saveSocialDraft(websiteId, row.id, { body: "At Image Studio we test first." })).toEqual({ ok: false, error: "warmup_brand" });
    const [kept] = await test.db.select().from(socialSuggestions).where(eq(socialSuggestions.id, row.id));
    expect(kept).toMatchObject({ status: "new", body: "Shoot a test session first." });
  });

  it("never touches another website's suggestion, a viewer's or a trial's locked platform", async () => {
    const mine = await site();
    const theirs = await site();
    await account(theirs.websiteId, "x");
    const row = await suggestion(theirs.websiteId);
    expect(await saveSocialDraft(mine.websiteId, row.id, { body: "Not yours." })).toEqual({ ok: false, error: "not_found" });

    state.access = "viewer";
    expect(await saveSocialDraft(theirs.websiteId, row.id, { body: "Read only." })).toEqual({ ok: false, error: "view_only" });
    state.access = "owner";

    const trial = await site({ trial: true });
    const locked = await suggestion(trial.websiteId);
    expect(await saveSocialDraft(trial.websiteId, locked.id, { body: "Locked." })).toEqual({ ok: false, error: "not_included" });

    const rows = await test.db.select().from(socialSuggestions).where(eq(socialSuggestions.status, "draft"));
    expect(rows.filter((r) => r.id === row.id || r.id === locked.id)).toEqual([]);
  });

  it("can be skipped like a new suggestion", async () => {
    const { websiteId } = await site();
    await account(websiteId, "x");
    const row = await suggestion(websiteId, { status: "draft" });
    expect(await skipSocialSuggestion(websiteId, row.id)).toEqual({ ok: true, data: { drafted: false } });
    const [saved] = await test.db.select().from(socialSuggestions).where(eq(socialSuggestions.id, row.id));
    expect(saved.status).toBe("dismissed");
  });

  it("is where a skipped scheduled own post goes, and RepGet no longer publishes it (client, 2026-11-03)", async () => {
    const { websiteId } = await site();
    await account(websiteId, "x", { bundle: true });
    await test.db.insert(socialTeams).values({ websiteId, teamId: "team_skip" });
    const row = await suggestion(websiteId, { kind: "post", threadUrl: null, status: "scheduled", scheduledFor: NOW });
    expect(await skipSocialSuggestion(websiteId, row.id)).toEqual({ ok: true, data: { drafted: true } });
    const [saved] = await test.db.select().from(socialSuggestions).where(eq(socialSuggestions.id, row.id));
    expect(saved).toMatchObject({ status: "draft", scheduledFor: null, body: row.body });
    // The job that was waiting for its time finds nothing to publish.
    expect(await publishSuggestion(row.id, NOW)).toBe("skipped");
    // Skipped again from Drafts, it goes for good.
    expect(await skipSocialSuggestion(websiteId, row.id)).toEqual({ ok: true, data: { drafted: false } });
    const [gone] = await test.db.select().from(socialSuggestions).where(eq(socialSuggestions.id, row.id));
    expect(gone.status).toBe("dismissed");
  });

  it("is never published by RepGet, even on an account that publishes automatically", async () => {
    const { websiteId } = await site();
    await account(websiteId, "x", { bundle: true });
    await test.db.insert(socialTeams).values({ websiteId, teamId: "team_draft" });
    const row = await suggestion(websiteId, { kind: "post", threadUrl: null, status: "draft", scheduledFor: NOW });
    expect(await publishSuggestion(row.id, NOW)).toBe("skipped");
    const [saved] = await test.db.select().from(socialSuggestions).where(eq(socialSuggestions.id, row.id));
    expect(saved.status).toBe("draft");
  });
});

describe("connecting by username", () => {
  it("is for Quora once bundle.social is set up, and starts a warm-up", async () => {
    const { websiteId } = await site();
    expect(await connectSocialUsername(websiteId, "reddit", "someone")).toEqual({ ok: false, error: "use_connect" });
    expect(await connectSocialUsername(websiteId, "quora", "https://www.quora.com/profile/Jane-Doe")).toEqual({ ok: true, data: null });
    const [saved] = await test.db.select().from(socialAccounts).where(eq(socialAccounts.websiteId, websiteId));
    expect(saved.username).toBe("Jane-Doe");
    expect(saved.warmupEndsAt.getTime() - Date.now()).toBeGreaterThan(6.9 * DAY);
    expect(queue.queueJob).toHaveBeenCalledWith({ name: "social/suggest.requested", data: { websiteId } });
  });
});

describe("publishing own posts", () => {
  async function scheduled() {
    const { orgId, websiteId } = await site();
    await account(websiteId, "x", { bundle: true });
    await test.db.insert(socialTeams).values({ websiteId, teamId: "team_1" });
    await recordCredit(orgId, { type: "adjustment", amount: 5, note: "test" });
    const row = await suggestion(websiteId, { kind: "post", threadUrl: null, status: "scheduled", scheduledFor: NOW, body: "Shade beats golden hour." });
    return { orgId, websiteId, row };
  }

  function bundleReplies(...replies: unknown[]) {
    const fetch = vi.fn(async () => new Response(JSON.stringify(replies.shift()), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    return fetch;
  }

  it("hands the post to bundle.social, charges once and records the link", async () => {
    const { orgId, row } = await scheduled();
    const fetch = bundleReplies(
      { id: "post_1", status: "SCHEDULED", error: null, errors: null, externalData: null },
      { id: "post_1", status: "POSTED", error: null, errors: null, externalData: { TWITTER: { id: "9", permalink: "https://x.com/x_user/status/9" } } },
    );
    expect(await publishSuggestion(row.id, NOW)).toBe("posting");
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ teamId: "team_1", socialAccountTypes: ["TWITTER"], data: { TWITTER: { text: "Shade beats golden hour." } } });
    expect(await checkPublished(row.id, NOW)).toBe("posted");
    // Published once: a second job for it does nothing.
    expect(await publishSuggestion(row.id, NOW)).toBe("skipped");

    const [saved] = await test.db.select().from(socialSuggestions).where(eq(socialSuggestions.id, row.id));
    expect(saved).toMatchObject({ status: "posted", postedUrl: "https://x.com/x_user/status/9", bundlePostId: "post_1" });
    expect(await test.db.select().from(creditSpends).where(eq(creditSpends.organizationId, orgId))).toHaveLength(1);
  });

  it("gives the credit back and pauses the account when the platform refuses", async () => {
    const { orgId, websiteId, row } = await scheduled();
    bundleReplies(
      { id: "post_2", status: "SCHEDULED", error: null, errors: null, externalData: null },
      { id: "post_2", status: "ERROR", error: null, errors: { TWITTER: "Duplicate content" }, externalData: null },
    );
    expect(await publishSuggestion(row.id, NOW)).toBe("posting");
    expect(await checkPublished(row.id, NOW)).toBe("failed");

    const [saved] = await test.db.select().from(socialSuggestions).where(eq(socialSuggestions.id, row.id));
    expect(saved).toMatchObject({ status: "failed", error: "Duplicate content" });
    const [paused] = await test.db
      .select()
      .from(socialAccounts)
      .where(and(eq(socialAccounts.websiteId, websiteId), eq(socialAccounts.platform, "x")));
    expect(paused.pausedReason).toBe("Duplicate content");
    const ledger = await test.db.select().from(creditLedger).where(eq(creditLedger.organizationId, orgId));
    expect(ledger.reduce((sum, entry) => sum + entry.amount, 0)).toBe(5);

    // The next own post waits for the customer instead of being tried again.
    const next = await suggestion(websiteId, { kind: "post", threadUrl: null, status: "scheduled", scheduledFor: NOW, body: "Another tip." });
    expect(await publishSuggestion(next.id, NOW)).toBe("skipped");
    const [fallback] = await test.db.select().from(socialSuggestions).where(eq(socialSuggestions.id, next.id));
    expect(fallback.status).toBe("new");
  });

  it("is not charged without the credit", async () => {
    const { websiteId } = await site();
    await account(websiteId, "x", { bundle: true });
    await test.db.insert(socialTeams).values({ websiteId, teamId: "team_2" });
    const row = await suggestion(websiteId, { kind: "post", threadUrl: null, status: "scheduled", scheduledFor: NOW });
    const fetch = bundleReplies();
    expect(await publishSuggestion(row.id, NOW)).toBe("no_credits");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("can be edited before its time, within the rules", async () => {
    const { websiteId, row } = await scheduled();
    expect(await editScheduledPost(websiteId, row.id, { body: "Shade beats golden hour, every time." })).toEqual({ ok: true, data: null });
    expect(await editScheduledPost(websiteId, row.id, { body: "See other.com" })).toEqual({ ok: false, error: "bad_link" });
  });
});
