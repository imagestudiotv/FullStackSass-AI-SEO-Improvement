import { and, eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  articles,
  creditLedger,
  creditSettings,
  creditSpends,
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
import { connectSocialUsername, editScheduledPost, postSocialSuggestion } from "./actions";
import { checkPublished, publishSuggestion } from "./publish";
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
  return { cached: false, items: (RESULTS[prefix] ?? []).map((url) => ({ url, title: `About ${url}`, description: "A question." })) };
});
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
    expect(threads).toEqual([]);
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
    expect(slots).toEqual([expect.objectContaining({ platform: "pinterest", imageUrl: "https://cdn.example.com/older.webp", topic: "older" })]);
    const pins = await test.db
      .select({ imageUrl: socialSuggestions.imageUrl })
      .from(socialSuggestions)
      .where(and(eq(socialSuggestions.websiteId, websiteId), eq(socialSuggestions.platform, "pinterest")));
    expect(pins.map((pin) => pin.imageUrl).sort()).toEqual(["https://cdn.example.com/newest.webp", "https://cdn.example.com/older.webp"]);

    // Every picture pinned: no Pin until the next article.
    const next = writer({ posts: [], replies: [] });
    await suggestForWebsite(websiteId, { now: new Date(NOW.getTime() + DAY), search, write: next });
    expect(next).not.toHaveBeenCalled();
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
      ).map((url) => ({ url, title: url, description: "" })),
    }));
    const write = writer({ posts: [], replies: [] });
    await suggestForWebsite(websiteId, { now: NOW, search: crossed, write });
    const [, threads] = vi.mocked(write).mock.calls[0];
    expect(threads.map((thread) => thread.platform).sort()).toEqual(["quora", "reddit"]);
    expect(threads.find((thread) => thread.platform === "quora")!.title).toBe("https://www.quora.com/How-do-I-choose-a-wedding-photographer");
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
      ).map((url) => ({ url, title: url, description: "" })),
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
      data: { url: "https://x.com/intent/post?in_reply_to=1234567890&text=Shoot%20a%20test%20session%20first!" },
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
      data: { url: "https://www.quora.com/How-do-I-choose-a-wedding-photographer" },
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
