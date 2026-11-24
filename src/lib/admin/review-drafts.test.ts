import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  adminAuditLog,
  articles,
  articleVersions,
  backlinkRequests,
  calendarItems,
  creditLedger,
  networkSites,
  placements,
  publicationDispatches,
  publishLogs,
} from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * Cleaning the review queue: the true count, paging and website filter; what
 * "Delete selected" deletes, what it keeps and why; that a deleted topic is
 * never written again; and that the one-off script chooses exactly the same.
 */

const state = vi.hoisted(() => ({ db: null as unknown, session: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));
vi.mock("@/lib/auth", () => ({ ensureOrganization: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: () => {}, notFound: () => {} }));
vi.mock("@/inngest/client", () => ({
  inngest: { send: vi.fn(async () => ({ ids: [] })), createFunction: (config: unknown, handler: unknown) => ({ config, handler }) },
}));

import { deleteDrafts, keptCounts, surveyDrafts } from "@/lib/admin/draft-cleanup.mjs";
import { DRAFT_KEEP_RULES, DROPPED_TOPIC_STATUS } from "@/lib/admin/draft-deletion-rules.mjs";
import { getReviewQueue } from "@/lib/admin/network";
import { deleteReviewDrafts } from "@/lib/admin/review-drafts";
import { reviewHash } from "@/lib/articles/review";
import { getAvailable } from "@/lib/backlinks/credits";
import { replaceUnstartedPlan } from "@/lib/keywords/replan";
import { moveMissedTopicsForward } from "@/lib/publishing/missed-days";
import { coveredTopics } from "@/lib/sites/covered";

let test: TestDb;
const ADMIN = "admin@repget.test";
const asAdmin = { user: { id: "admin_user", email: ADMIN, emailVerified: true }, session: { id: "s", activeOrganizationId: null } };

beforeAll(async () => {
  vi.stubEnv("ADMIN_EMAILS", ADMIN);
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  state.session = asAdmin;
  await test.client.exec("delete from placements; delete from backlink_requests; delete from articles; delete from calendar_items; delete from admin_audit_log;");
});

type Article = typeof articles.$inferInsert;

async function draft(websiteId: string, over: Partial<Article> = {}, topic = true) {
  let calendarItemId: string | null = null;
  if (topic) {
    const [item] = await test.db
      .insert(calendarItems)
      .values({ websiteId, title: `Topic ${randomUUID()}`, targetKeyword: `keyword ${randomUUID()}`, scheduledFor: new Date("2026-12-04T12:00:00Z"), status: "generated" })
      .returning();
    calendarItemId = item.id;
  }
  const [row] = await test.db
    .insert(articles)
    .values({ websiteId, title: `Draft ${randomUUID()}`, bodyHtml: "<p>Text</p>", status: "draft", reviewStatus: "pending", calendarItemId, createdAt: new Date("2026-10-10T00:00:00Z"), ...over })
    .returning();
  return row;
}

const exists = async (id: string) => (await test.db.select({ id: articles.id }).from(articles).where(eq(articles.id, id))).length > 0;
const topicOf = async (id: string | null) => (await test.db.select().from(calendarItems).where(eq(calendarItems.id, id!)))[0];

async function dispatch(article: { id: string; websiteId: string }, status: string, claimedAt = new Date()) {
  await test.db.insert(publicationDispatches).values({ articleId: article.id, websiteId: article.websiteId, channel: "direct", trigger: "manual", revisionHash: "h", requestedStatus: "draft", status, claimedAt });
}

async function link(article: { id: string; websiteId: string }, status: string) {
  const partner = await seedWebsite(test);
  await test.db.insert(creditLedger).values({ organizationId: partner.orgId, type: "purchase", amount: 100, idempotencyKey: randomUUID() });
  const [request] = await test.db
    .insert(backlinkRequests)
    .values({ websiteId: partner.websiteId, targetUrl: "https://partner.test/x", status: ["removed", "cancelled"].includes(status) ? "cancelled" : "matched", creditsReserved: ["pending", "drafted"].includes(status) ? 40 : 0 })
    .returning();
  await test.db.insert(placements).values({ requestId: request.id, hostWebsiteId: article.websiteId, articleId: article.id, credits: 40, status, managed: true });
  return partner;
}

/** One draft for every reason to keep one, by the rule's code. */
async function oneOfEach(websiteId: string): Promise<Record<string, string>> {
  const kept: Record<string, string> = {};
  kept.published = (await draft(websiteId, { publishedUrl: "https://host.test/p" })).id;
  kept.published_2 = (await draft(websiteId, { firstLiveAt: new Date() })).id;
  const original = await draft(websiteId);
  kept.translated = original.id;
  kept.translation = (await draft(websiteId, { translationOf: original.id, languageCode: "it", calendarItemId: null })).id;
  const flying = await draft(websiteId);
  await dispatch(flying, "in_flight");
  kept.in_flight = flying.id;
  for (const status of ["sent", "uncertain", "expired", "abandoned", "released"]) {
    const row = await draft(websiteId);
    await dispatch(row, status);
    kept[`delivered_${status}`] = row.id;
  }
  const logged = await draft(websiteId);
  await test.db.insert(publishLogs).values({ articleId: logged.id, status: "published", remoteId: "7", remoteStatus: "draft" });
  kept.delivered_log = logged.id;
  kept.requested = (await draft(websiteId, { publishRequested: "publish" })).id;
  kept.approved = (await draft(websiteId, { reviewStatus: "approved", reviewApprovedHash: "earlier text" })).id;
  kept.approved_revision = (await draft(websiteId, { approvedRevision: { source: "approved", title: "t" } })).id;
  for (const status of ["published", "live", "unverified"]) {
    const row = await draft(websiteId);
    await link(row, status);
    kept[`live_link_${status}`] = row.id;
  }
  for (const status of ["pending", "drafted"]) {
    const row = await draft(websiteId);
    await link(row, status);
    kept[`reserved_credits_${status}`] = row.id;
  }
  return kept;
}

describe("the queue", () => {
  it("shows the true total, every page of it, and one website's when asked", async () => {
    const a = await seedWebsite(test);
    const b = await seedWebsite(test);
    await test.db.insert(networkSites).values({ websiteId: a.websiteId, acceptingLinks: true });
    await test.db.insert(articles).values(
      Array.from({ length: 230 }, (_, i) => ({ websiteId: a.websiteId, title: `A ${i}`, status: "draft", reviewStatus: "pending", bodyHtml: "<p>x</p>", createdAt: new Date(Date.UTC(2026, 9, 1, 0, i)) })),
    );
    const approvedText = { title: "Approved", slug: null, metaDescription: null, bodyHtml: "<p>y</p>", imageUrl: null, imageAlt: null };
    await test.db.insert(articles).values([
      { websiteId: b.websiteId, title: "B", status: "draft", reviewStatus: "pending" },
      { websiteId: b.websiteId, ...approvedText, status: "draft", reviewStatus: "approved", reviewApprovedHash: reviewHash(approvedText) },
      { websiteId: b.websiteId, title: "Changed", status: "draft", reviewStatus: "approved", reviewApprovedHash: "old" },
    ]);

    const first = await getReviewQueue();
    expect(first.pending).toMatchObject({ total: 232, matching: 232, changed: 1, page: 1 });
    expect(first.approved.total).toBe(1);
    const size = first.pending.pageSize;
    expect(first.articles.filter((row) => !row.approvedCurrent)).toHaveLength(size);
    const seen = new Set<string>();
    for (let page = 1; page <= Math.ceil(232 / size); page++) {
      for (const row of (await getReviewQueue({ page })).articles) if (!row.approvedCurrent) seen.add(row.id);
    }
    expect(seen.size).toBe(232);
    // Past the end is the last page, not an empty one.
    expect((await getReviewQueue({ page: 99 })).pending.page).toBe(3);

    const onlyB = await getReviewQueue({ websiteId: b.websiteId });
    expect(onlyB.pending).toMatchObject({ total: 232, matching: 2 });
    expect(onlyB.articles.filter((row) => !row.approvedCurrent).map((row) => row.title).sort()).toEqual(["B", "Changed"]);
    expect(onlyB.pending.websites).toHaveLength(2);
    // A website with nothing waiting (any more) is an empty list, never everybody's.
    expect((await getReviewQueue({ websiteId: randomUUID() })).pending.matching).toBe(0);
    expect((await getReviewQueue({ websiteId: "x'; drop table articles" })).pending.matching).toBe(232);
  });
});

describe("deleting selected drafts", () => {
  it("needs an administrator, the typed word and a reason", async () => {
    const { websiteId } = await seedWebsite(test);
    const row = await draft(websiteId);
    expect((await deleteReviewDrafts([row.id], "Old tests", "delete")).ok).toBe(false);
    expect((await deleteReviewDrafts([row.id], "x", "DELETE")).ok).toBe(false);
    expect((await deleteReviewDrafts([], "Old tests", "DELETE")).ok).toBe(false);
    expect((await deleteReviewDrafts(Array.from({ length: 101 }, () => randomUUID()), "Old tests", "DELETE")).ok).toBe(false);
    for (const who of [null, { ...asAdmin, user: { ...asAdmin.user, email: "customer@shop.example" } }]) {
      state.session = who;
      await expect(deleteReviewDrafts([row.id], "Old tests", "DELETE")).rejects.toThrow("Not found");
    }
    expect(await exists(row.id)).toBe(true);
  });

  it("deletes them with their versions, one audit entry each, and takes their topics off the calendar", async () => {
    const { websiteId } = await seedWebsite(test);
    const rows = [await draft(websiteId), await draft(websiteId), await draft(websiteId, {}, false)];
    const other = await draft(websiteId);
    await test.db.insert(articleVersions).values({ articleId: rows[0].id, bodyHtml: "<p>old</p>" });
    // Provably refused by the site: nothing of it exists there.
    await dispatch(rows[1], "failed");

    const result = await deleteReviewDrafts(rows.map((row) => row.id), "Old tests", "DELETE");
    expect(result).toEqual({ ok: true, data: { deleted: 3, failures: [] } });
    for (const row of rows) expect(await exists(row.id)).toBe(false);
    expect(await exists(other.id)).toBe(true);
    expect(await test.db.select().from(articleVersions)).toHaveLength(0);
    expect(await topicOf(rows[0].calendarItemId!)).toMatchObject({ status: DROPPED_TOPIC_STATUS, scheduledFor: null });
    expect(await topicOf(other.calendarItemId!)).toMatchObject({ status: "generated" });
    const log = await test.db.select().from(adminAuditLog);
    expect(log).toHaveLength(3);
    expect(log[0]).toMatchObject({ actorEmail: ADMIN, action: "article.deleted", targetType: "article" });
    expect(log.map((entry) => (entry.detail as { reason: string }).reason)).toEqual(["Old tests", "Old tests", "Old tests"]);
  });

  it("keeps everything the rules protect, says why, and changes nothing about it", async () => {
    const { websiteId } = await seedWebsite(test);
    const kept = await oneOfEach(websiteId);
    const gone = await draft(websiteId);
    const before = await test.db.select().from(placements);

    const result = await deleteReviewDrafts([...Object.values(kept), gone.id], "Old tests", "DELETE");
    if (!result.ok) throw new Error(result.error);
    expect(result.data.deleted).toBe(1);
    const errors = new Map(result.data.failures.map((failure) => [failure.id, failure.error]));
    for (const [name, id] of Object.entries(kept)) {
      expect(await exists(id), name).toBe(true);
      const code = DRAFT_KEEP_RULES.map((rule) => rule.code).sort((x, y) => y.length - x.length).find((c) => name.startsWith(c))!;
      if (name === "in_flight") expect(errors.get(id), name).toBeTruthy();
      else expect(errors.get(id), name).toBe(DRAFT_KEEP_RULES.find((rule) => rule.code === code)!.label);
    }
    expect(await test.db.select().from(placements)).toEqual(before);
    expect(await test.db.select().from(adminAuditLog)).toHaveLength(1);
  });

  it("never touches another workspace's held credits", async () => {
    const { websiteId } = await seedWebsite(test);
    const row = await draft(websiteId);
    const partner = await link(row, "drafted");
    expect((await getAvailable(partner.orgId)).available).toBe(60);
    await deleteReviewDrafts([row.id], "Old tests", "DELETE");
    expect((await getAvailable(partner.orgId)).available).toBe(60);
    expect(await exists(row.id)).toBe(true);
  });

  it("refuses what is not in the queue, and reports what is already gone", async () => {
    const { websiteId } = await seedWebsite(test);
    const unmanaged = await draft(websiteId, { reviewStatus: null });
    const missing = randomUUID();
    const result = await deleteReviewDrafts([unmanaged.id, missing], "Old tests", "DELETE");
    expect(result).toMatchObject({ ok: true, data: { deleted: 0, failures: [{ id: unmanaged.id, error: "It is not waiting for review." }, { id: missing }] } });
  });

  it("a topic another article was written from stays", async () => {
    const { websiteId } = await seedWebsite(test);
    const row = await draft(websiteId);
    await draft(websiteId, { calendarItemId: row.calendarItemId, status: "published", publishedUrl: "https://host.test/x", reviewStatus: null }, false);
    await deleteReviewDrafts([row.id], "Old tests", "DELETE");
    expect(await exists(row.id)).toBe(false);
    expect((await topicOf(row.calendarItemId!)).status).toBe("generated");
  });
});

describe("a deleted topic", () => {
  it("is not planned, moved forward or re-planned, and counts as covered", async () => {
    const { websiteId } = await seedWebsite(test);
    const row = await draft(websiteId);
    // Even one still "planned" (written by hand ahead of the scheduler).
    await test.db.update(calendarItems).set({ status: "planned", scheduledFor: new Date("2026-10-04T12:00:00Z") }).where(eq(calendarItems.id, row.calendarItemId!));
    const topic = await topicOf(row.calendarItemId!);
    await deleteReviewDrafts([row.id], "Old tests", "DELETE");

    expect((await moveMissedTopicsForward(websiteId)).moved).toBe(0);
    await replaceUnstartedPlan(websiteId, []);
    expect(await topicOf(topic.id)).toMatchObject({ status: DROPPED_TOPIC_STATUS, scheduledFor: null });
    const covered = await coveredTopics(websiteId);
    expect(covered.writtenTitles).toContain(topic.title);
    expect(covered.writtenKeywords).toContain(topic.targetKeyword);
  });
});

describe("the one-off script", () => {
  const query = async (text: string, params: unknown[]) => (await test.client.query(text, params)).rows as Record<string, never>[];
  const scope = (websiteId: string) => ({ websiteId, before: "2026-11-01T00:00:00" });
  const run = (websiteId: string, backup: (data: Record<string, unknown>) => Promise<void>) =>
    test.client.transaction(async (tx) => {
      const inTx = async (text: string, params: unknown[]) => (await tx.query(text, params)).rows as Record<string, never>[];
      return deleteDrafts(inTx, { ...scope(websiteId), backup, actor: "ops script", note: "Old tests" });
    });

  it("chooses exactly what the page would delete, for one website, before the date", async () => {
    const { websiteId } = await seedWebsite(test);
    const elsewhere = await seedWebsite(test);
    const kept = await oneOfEach(websiteId);
    const doomed = [await draft(websiteId), await draft(websiteId, { reviewStatus: null })];
    const late = await draft(websiteId, { createdAt: new Date("2026-11-01T00:00:00Z") });
    const foreign = await draft(elsewhere.websiteId);

    const survey = await surveyDrafts(query, scope(websiteId));
    const chosen = survey.filter((row) => row.keep === null).map((row) => row.id as string);
    expect(chosen.sort()).toEqual(doomed.map((row) => row.id).sort());
    expect(survey.map((row) => row.id)).not.toContain(late.id);
    expect(survey.map((row) => row.id)).not.toContain(foreign.id);
    const counts = keptCounts(survey);
    expect(counts.reduce((sum, row) => sum + row.drafts, 0)).toBe(Object.keys(kept).length);
  });

  it("backs up every row first, then deletes, marks the topics and leaves one audit entry", async () => {
    const { websiteId } = await seedWebsite(test);
    const a = await draft(websiteId);
    const b = await draft(websiteId);
    await test.db.insert(articleVersions).values({ articleId: a.id, bodyHtml: "<p>old</p>" });
    const finished = await link(b, "cancelled");
    expect(finished).toBeTruthy();
    const kept = await draft(websiteId, { publishedUrl: "https://host.test/p" });

    let saved: Record<string, unknown[]> = {};
    const result = await run(websiteId, async (data) => {
      saved = JSON.parse(JSON.stringify(data));
    });
    expect(result).toMatchObject({ deleted: 2, topics: 2 });
    expect(saved.articles.map((row) => (row as { id: string }).id).sort()).toEqual([a.id, b.id].sort());
    expect((saved.articles[0] as { body_html: string }).body_html).toBe("<p>Text</p>");
    expect(saved.article_versions).toHaveLength(1);
    expect(saved.placements).toHaveLength(1);
    expect(saved.calendar_items.map((row) => (row as { status: string }).status)).toEqual(["generated", "generated"]);
    expect([await exists(a.id), await exists(b.id), await exists(kept.id)]).toEqual([false, false, true]);
    expect((await topicOf(a.calendarItemId!)).status).toBe(DROPPED_TOPIC_STATUS);
    const log = await test.db.select().from(adminAuditLog);
    expect(log).toHaveLength(1);
    expect(log[0].summary).toMatch(/^Deleted 2 unpublished drafts of /);
    // Again: nothing more.
    expect((await run(websiteId, async () => {})).deleted).toBe(0);
  });

  it("changes nothing when the backup cannot be written", async () => {
    const { websiteId } = await seedWebsite(test);
    const row = await draft(websiteId);
    await expect(
      run(websiteId, async () => {
        throw new Error("disk full");
      }),
    ).rejects.toThrow("disk full");
    expect(await exists(row.id)).toBe(true);
    expect((await topicOf(row.calendarItemId!)).status).toBe("generated");
    expect(await test.db.select().from(adminAuditLog)).toHaveLength(0);
  });
});
