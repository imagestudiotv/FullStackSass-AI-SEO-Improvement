import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { ArticleDetail } from "@/lib/articles/actions";
import { reviewHash } from "@/lib/articles/review";
import { articles, calendarItems, platformControls, publicationDispatches, publishLogs } from "@/lib/db/schema";
import type { IntegrationView } from "@/lib/publishing/shared";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * The publishing facts the article page reads (article-data.ts), against a
 * real schema: the review gate, the claim's already-sent rule, an in-flight
 * delivery, the freeze, the latest outcome as the CMS reported it, and the
 * history - bounded, tenant-scoped, and with no raw error text.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("@/lib/tenant", () => ({ requireWebsite: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { loadPublishing, pickDestination } from "./article-data";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

async function seedArticle(websiteId: string, values: Partial<typeof articles.$inferInsert> = {}) {
  const [row] = await test.db
    .insert(articles)
    .values({
      websiteId,
      title: "Wedding films in Italy",
      slug: "wedding-films-italy",
      bodyHtml: "<p>Text.</p>",
      metaDescription: "Short films.",
      status: "draft",
      ...values,
    })
    .returning();
  return row;
}

/** The ArticleDetail shape the page passes in. */
function detail(row: typeof articles.$inferSelect): ArticleDetail {
  return {
    id: row.id,
    calendarItemId: row.calendarItemId,
    title: row.title,
    slug: row.slug,
    targetKeyword: row.targetKeyword,
    wordCount: row.wordCount,
    status: row.status,
    generationStep: row.generationStep,
    error: row.error,
    updatedAt: row.updatedAt,
    bodyHtml: row.bodyHtml,
    metaDescription: row.metaDescription,
    imageUrl: row.imageUrl,
    imageAlt: row.imageAlt,
    imageAttempts: row.imageAttempts,
    publishedUrl: row.publishedUrl,
    publishRequested: row.publishRequested,
  };
}

const DIRECT = { kind: "direct" as const, name: "WordPress", provider: "wordpress", site: null };

function load(siteId: string, row: typeof articles.$inferSelect, extra: { now?: Date } = {}) {
  return loadPublishing({
    siteId,
    article: detail(row),
    autoPublish: true,
    publishAs: "draft",
    destination: DIRECT,
    uncertain: false,
    locale: "en",
    ...extra,
  });
}

describe("loadPublishing", () => {
  it("an article never sent: nothing held, nothing delivered, settings and plan read", async () => {
    const { websiteId } = await seedWebsite(test);
    const [item] = await test.db
      .insert(calendarItems)
      .values({ websiteId, title: "Planned", scheduledFor: new Date("2099-01-15T12:00:00Z") })
      .returning({ id: calendarItems.id });
    const row = await seedArticle(websiteId, { calendarItemId: item.id });
    const { facts, history } = await load(websiteId, row);
    expect(facts).toMatchObject({
      review: "none",
      frozen: false,
      delivering: false,
      liveOnSite: false,
      alreadySent: { publish: false, draft: false },
      lastOutcome: { kind: "none" },
      planned: "15 January 2099",
      plannedInFuture: true,
      autoPublish: "draft",
      latestDispatchId: null,
      latestLogId: null,
    });
    expect(history).toEqual([]);
  });

  it("the exact saved version already sent live is recognised; a changed one is not", async () => {
    const { websiteId } = await seedWebsite(test);
    const row = await seedArticle(websiteId, { status: "published", publishedUrl: "https://example.com/p" });
    const hash = reviewHash(row);
    const [dispatch] = await test.db
      .insert(publicationDispatches)
      .values({
        articleId: row.id,
        websiteId,
        channel: "direct",
        trigger: "manual",
        revisionHash: hash,
        requestedStatus: "publish",
        status: "sent",
        remoteStatus: "publish",
      })
      .returning({ id: publicationDispatches.id });
    await test.db.insert(publishLogs).values({
      articleId: row.id,
      dispatchId: dispatch.id,
      status: "published",
      remoteStatus: "publish",
      remoteUrl: "https://example.com/p",
    });

    const sent = await load(websiteId, row);
    expect(sent.facts.alreadySent).toEqual({ publish: true, draft: false });
    expect(sent.facts.liveOnSite).toBe(true);
    expect(sent.facts.lastOutcome.kind).toBe("live");
    expect(sent.facts.latestDispatchId).toBe(dispatch.id);

    const edited = await load(websiteId, { ...row, title: "Edited title" });
    expect(edited.facts.alreadySent).toEqual({ publish: false, draft: false });
  });

  it("a delivery in flight counts only within the in-flight timeout", async () => {
    const { websiteId } = await seedWebsite(test);
    const row = await seedArticle(websiteId);
    await test.db.insert(publicationDispatches).values({
      articleId: row.id,
      websiteId,
      channel: "direct",
      trigger: "manual",
      revisionHash: "x",
      requestedStatus: "publish",
      status: "in_flight",
      claimedAt: new Date("2026-10-03T10:00:00Z"),
    });
    expect((await load(websiteId, row, { now: new Date("2026-10-03T10:05:00Z") })).facts.delivering).toBe(true);
    expect((await load(websiteId, row, { now: new Date("2026-10-03T10:30:00Z") })).facts.delivering).toBe(false);
  });

  it("reads the review gate as the publish path applies it", async () => {
    const { websiteId } = await seedWebsite(test);
    const pending = await seedArticle(websiteId, { reviewStatus: "pending" });
    expect((await load(websiteId, pending)).facts.review).toBe("pending");

    const approvedRow = await seedArticle(websiteId, { reviewStatus: "approved" });
    const hash = reviewHash(approvedRow);
    await test.db.update(articles).set({ reviewApprovedHash: hash }).where(eq(articles.id, approvedRow.id));
    expect((await load(websiteId, approvedRow)).facts.review).toBe("approved");
    expect((await load(websiteId, { ...approvedRow, bodyHtml: "<p>Changed after approval.</p>" })).facts.review).toBe("changed");
  });

  it("history is newest first, at most ten, failures classified and never quoted", async () => {
    const { websiteId } = await seedWebsite(test);
    const row = await seedArticle(websiteId);
    for (let index = 0; index < 12; index += 1) {
      await test.db.insert(publishLogs).values({
        articleId: row.id,
        status: index === 11 ? "failed" : "published",
        error: index === 11 ? "auth: Request failed with status code 401 secret-body" : null,
        remoteStatus: index === 11 ? null : "draft",
        createdAt: new Date(Date.UTC(2026, 9, 1, index)),
      });
    }
    const { facts, history } = await load(websiteId, row);
    expect(history).toHaveLength(10);
    expect(history[0]).toMatchObject({ status: "failed", errorKind: "auth" });
    expect(JSON.stringify(history)).not.toContain("secret-body");
    expect(facts.lastOutcome).toMatchObject({ kind: "failed", errorKind: "auth" });
    expect(history[0].when).toMatch(/UTC$/);
  });

  it("another website's article reads nothing", async () => {
    const mine = await seedWebsite(test);
    const theirs = await seedWebsite(test);
    const row = await seedArticle(theirs.websiteId);
    await test.db.insert(publishLogs).values({ articleId: row.id, status: "published", remoteStatus: "publish" });
    const { history, facts } = await load(mine.websiteId, row);
    expect(history).toEqual([]);
    expect(facts.lastOutcome.kind).toBe("none");
  });

  it("the publication freeze is reported", async () => {
    const { websiteId } = await seedWebsite(test);
    const row = await seedArticle(websiteId);
    await test.db.insert(platformControls).values({ key: "publication_freeze", enabled: true }).onConflictDoUpdate({
      target: platformControls.key,
      set: { enabled: true },
    });
    expect((await load(websiteId, row)).facts.frozen).toBe(true);
    await test.db.update(platformControls).set({ enabled: false });
  });
});

describe("pickDestination", () => {
  const view = (over: Partial<IntegrationView>): IntegrationView => ({
    id: "i",
    kind: "wordpress",
    providerName: "WordPress",
    status: "connected",
    verifiedAt: new Date("2026-01-01"),
    siteName: null,
    accountLabel: null,
    secretHints: {},
    ...over,
  });

  it("names the connection the publish job uses: connected, newest verified first; else the plugin; else none", () => {
    const older = view({ id: "a", kind: "ghost", providerName: "Ghost", verifiedAt: new Date("2026-01-01") });
    const newer = view({ id: "b", kind: "shopify", providerName: "Shopify", verifiedAt: new Date("2026-06-01") });
    const broken = view({ id: "c", status: "error", verifiedAt: new Date("2026-09-01") });
    expect(pickDestination([older, newer, broken], true)).toMatchObject({ kind: "direct", name: "Shopify", provider: "shopify" });
    expect(pickDestination([broken], true)).toEqual({ kind: "plugin" });
    expect(pickDestination([], false)).toEqual({ kind: "none" });
  });
});
