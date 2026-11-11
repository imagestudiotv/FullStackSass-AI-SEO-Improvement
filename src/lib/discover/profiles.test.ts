import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { user } from "@/lib/db/auth-tables";
import { blogComments, blogPosts, blogPostUpvotes, blogPostViewKeys, blogPostViews } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * The customer directory's data (client, 2026-11-11 round 2) on a disposable
 * database: only published Customer stories posts with a profile address are
 * listed, each business once in the visitor's language (else English), with
 * its upvotes, shown comments and views; a profile's week counts only the
 * last seven days; a view is counted once per visitor, profile and day, and
 * never for a robot or a post that is not a live profile.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));

import {
  getDiscoverProfile,
  impressionsThisWeek,
  isLikelyRobot,
  listDiscoverProfiles,
  recordProfileView,
  upvotesThisWeek,
  viewDay,
} from "@/lib/discover/profiles";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

const BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

async function member() {
  const id = `u_${randomUUID().slice(0, 8)}`;
  await test.db.insert(user).values({ id, name: "Ana", email: `${id}@example.test` });
  return id;
}

let n = 0;
async function story(fields: Partial<typeof blogPosts.$inferInsert> = {}) {
  n += 1;
  const [row] = await test.db
    .insert(blogPosts)
    .values({
      slug: `story-${n}-${randomUUID().slice(0, 6)}`,
      title: `Story ${n}`,
      description: `How business ${n} grew.`,
      category: "Customer stories",
      author: "RepGet team",
      bodyHtml: "<p>Text</p>",
      status: "published",
      publishedAt: new Date(Date.now() - (1000 - n) * 60_000),
      ...fields,
    })
    .returning({ id: blogPosts.id, slug: blogPosts.slug });
  return row;
}

describe("the directory", () => {
  it("lists only published customer stories with a profile address, one per business, in the visitor's language or English", async () => {
    const studio = await story({ businessSlug: "dir-studio", businessName: "Image Studio", businessCategory: "Creative", businessTagline: "Films" });
    const studioIt = await story({ businessSlug: "dir-studio", businessName: "Image Studio", businessCategory: "Creativo", locale: "it", translationOf: studio.id });
    const tours = await story({ businessSlug: "dir-tours", businessName: "Oxford Magic Tours", businessCategory: "Travel", businessWebsiteUrl: "https://oxfordmagictours.com/" });
    await story({ businessSlug: "dir-draft", businessName: "Draft Co", status: "draft", publishedAt: null });
    await story({ businessSlug: "dir-guide", businessName: "Guide Co", category: "Guides" });
    await story({ businessName: "No Address Co" });

    const en = await listDiscoverProfiles("en");
    const names = en.map((entry) => entry.name);
    expect(names).toEqual(expect.arrayContaining(["Image Studio", "Oxford Magic Tours"]));
    expect(names).not.toEqual(expect.arrayContaining(["Draft Co"]));
    expect(names).not.toContain("Guide Co");
    expect(names).not.toContain("No Address Co");
    expect(en.find((entry) => entry.slug === "dir-studio")?.postId).toBe(studio.id);
    expect(en.find((entry) => entry.slug === "dir-tours")?.websiteUrl).toBe("https://oxfordmagictours.com/");

    // Italian: the Italian story where there is one, the English one for the rest; never twice.
    const it = await listDiscoverProfiles("it");
    expect(it.filter((entry) => entry.slug === "dir-studio")).toHaveLength(1);
    expect(it.find((entry) => entry.slug === "dir-studio")).toMatchObject({ postId: studioIt.id, locale: "it", category: "Creativo" });
    expect(it.find((entry) => entry.slug === "dir-tours")).toMatchObject({ postId: tours.id, locale: "en" });
    // French has none of its own: the English ones.
    expect((await listDiscoverProfiles("fr")).find((entry) => entry.slug === "dir-studio")?.postId).toBe(studio.id);
  });

  it("counts every upvote, the shown comments and every view; most upvoted first, then newest", async () => {
    const quiet = await story({ businessSlug: "count-quiet", businessName: "Quiet" });
    const loud = await story({ businessSlug: "count-loud", businessName: "Loud" });
    const [a, b] = [await member(), await member()];
    await test.db.insert(blogPostUpvotes).values([
      { postId: loud.id, userId: a },
      { postId: loud.id, userId: b },
    ]);
    await test.db.insert(blogComments).values([
      { postId: loud.id, userId: a, body: "Great" },
      { postId: loud.id, userId: b, body: "Removed", removedAt: new Date() },
      { postId: loud.id, userId: b, body: "Deleted", deletedAt: new Date() },
    ]);
    await test.db.insert(blogPostViews).values([
      { postId: loud.id, day: "2026-01-01", views: 5 },
      { postId: loud.id, day: "2026-01-02", views: 2 },
    ]);
    const list = await listDiscoverProfiles("en");
    expect(list.find((entry) => entry.postId === loud.id)).toMatchObject({ upvotes: 2, comments: 1, views: 7 });
    expect(list.find((entry) => entry.postId === quiet.id)).toMatchObject({ upvotes: 0, comments: 0, views: 0 });
    expect(list.findIndex((entry) => entry.postId === loud.id)).toBeLessThan(list.findIndex((entry) => entry.postId === quiet.id));
  });
});

describe("a profile", () => {
  it("is the visitor's language's version, else the English one, and 404s for anything that is not a live profile", async () => {
    const original = await story({
      businessSlug: "one-studio",
      businessName: "One Studio",
      businessTags: ["Photography", "Film & Video"],
      businessServices: ["Weddings"],
      businessAbout: "First paragraph.\n\nSecond paragraph.",
      businessLocation: "Rome, Italy",
      businessAvailability: "Worldwide",
    });
    await story({ businessSlug: "one-studio", businessName: "One Studio", locale: "de", translationOf: original.id });
    await story({ businessSlug: "one-studio-draft", status: "draft", publishedAt: null });

    const en = await getDiscoverProfile("en", "one-studio");
    expect(en).toMatchObject({
      postId: original.id,
      locale: "en",
      tags: ["Photography", "Film & Video"],
      services: ["Weddings"],
      about: ["First paragraph.", "Second paragraph."],
      location: "Rome, Italy",
      availability: "Worldwide",
      locales: ["en", "de"],
      storyHref: `/blog/${original.slug}`,
    });
    expect((await getDiscoverProfile("de", "one-studio"))?.locale).toBe("de");
    expect((await getDiscoverProfile("it", "one-studio"))?.postId).toBe(original.id);

    expect(await getDiscoverProfile("en", "one-studio-draft")).toBeNull();
    expect(await getDiscoverProfile("en", "nobody")).toBeNull();
    expect(await getDiscoverProfile("en", "../etc")).toBeNull();
    await story({ businessSlug: "one-guide", category: "Guides" });
    expect(await getDiscoverProfile("en", "one-guide")).toBeNull();
  });

  it("without About, shows the story's description", async () => {
    await story({ businessSlug: "no-about", description: "The story's own summary." });
    expect((await getDiscoverProfile("en", "no-about"))?.about).toEqual(["The story's own summary."]);
  });
});

describe("this week", () => {
  it("counts upvotes and views from the last seven days, today included", async () => {
    const now = new Date("2026-11-11T12:00:00Z");
    const { id } = await story({ businessSlug: "week-studio" });
    const [a, b, c] = [await member(), await member(), await member()];
    await test.db.insert(blogPostUpvotes).values([
      { postId: id, userId: a, createdAt: new Date("2026-11-11T08:00:00Z") },
      { postId: id, userId: b, createdAt: new Date("2026-11-05T00:00:00Z") },
      { postId: id, userId: c, createdAt: new Date("2026-11-04T23:59:00Z") },
    ]);
    await test.db.insert(blogPostViews).values([
      { postId: id, day: "2026-11-11", views: 3 },
      { postId: id, day: "2026-11-05", views: 4 },
      { postId: id, day: "2026-11-04", views: 100 },
    ]);
    expect(await upvotesThisWeek(id, now)).toBe(2);
    expect(await impressionsThisWeek(id, now)).toBe(7);
    const profile = await getDiscoverProfile("en", "week-studio", now);
    expect(profile).toMatchObject({ upvotes: 3, upvotesWeek: 2, impressionsWeek: 7, views: 107 });
  });
});

describe("views", () => {
  it("counts one per visitor, profile and day; another visitor, or the next day, counts again", async () => {
    const { id } = await story({ businessSlug: "view-studio" });
    const day1 = new Date("2026-11-11T09:00:00Z");
    const views = async () =>
      (await test.db.select().from(blogPostViews).where(eq(blogPostViews.postId, id))).reduce((sum, row) => sum + row.views, 0);

    expect(await recordProfileView({ postId: id, visitor: "203.0.113.7", userAgent: BROWSER, now: day1 })).toBe(true);
    expect(await recordProfileView({ postId: id, visitor: "203.0.113.7", userAgent: BROWSER, now: new Date("2026-11-11T22:00:00Z") })).toBe(false);
    // Two at once: one counts.
    const both = await Promise.all([
      recordProfileView({ postId: id, visitor: "198.51.100.1", userAgent: BROWSER, now: day1 }),
      recordProfileView({ postId: id, visitor: "198.51.100.1", userAgent: BROWSER, now: day1 }),
    ]);
    expect(both.filter(Boolean)).toHaveLength(1);
    expect(await recordProfileView({ postId: id, visitor: "203.0.113.7", userAgent: BROWSER, now: new Date("2026-11-12T09:00:00Z") })).toBe(true);
    expect(await views()).toBe(3);
    expect(await impressionsThisWeek(id, new Date("2026-11-12T10:00:00Z"))).toBe(3);

    // Nothing that names the visitor is stored, and old keys go.
    const keys = await test.db.select().from(blogPostViewKeys);
    expect(keys.every((row) => !row.key.includes("203.0.113.7"))).toBe(true);
    await recordProfileView({ postId: id, visitor: "192.0.2.9", userAgent: BROWSER, now: new Date("2026-11-20T09:00:00Z") });
    expect((await test.db.select().from(blogPostViewKeys)).every((row) => row.day >= "2026-11-19")).toBe(true);
  });

  it("does not count robots, drafts, posts without a profile or unknown ids", async () => {
    const { id } = await story({ businessSlug: "robot-studio" });
    const draft = await story({ businessSlug: "robot-draft", status: "draft", publishedAt: null });
    const plain = await story();
    for (const ua of ["Googlebot/2.1 (+http://www.google.com/bot.html)", "facebookexternalhit/1.1", "curl/8.4.0", "Mozilla/5.0 HeadlessChrome/120", "", null]) {
      expect(await recordProfileView({ postId: id, visitor: "203.0.113.8", userAgent: ua }), String(ua)).toBe(false);
    }
    expect(await recordProfileView({ postId: draft.id, visitor: "203.0.113.8", userAgent: BROWSER })).toBe(false);
    expect(await recordProfileView({ postId: plain.id, visitor: "203.0.113.8", userAgent: BROWSER })).toBe(false);
    expect(await recordProfileView({ postId: "not-a-uuid", visitor: "203.0.113.8", userAgent: BROWSER })).toBe(false);
    expect(await test.db.select().from(blogPostViews).where(eq(blogPostViews.postId, id))).toHaveLength(0);
    expect(isLikelyRobot(BROWSER)).toBe(false);
    expect(viewDay(new Date("2026-11-11T23:59:59Z"))).toBe("2026-11-11");
  });
});
