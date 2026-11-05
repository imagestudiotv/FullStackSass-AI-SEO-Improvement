import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import { articles, backlinkRequests, placements, platformControls } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * The client's two-step article flow (2026-11-02) behind the
 * two_step_articles switch: 1. every new draft goes to the RepGet team, whose
 * ONE approval makes it ready - sources included; 2. the customer publishes,
 * and a later change to the revision goes back to the team. With the switch
 * off, everything behaves as before. The whole delivery, path by path, is in
 * two-step-delivery.test.ts.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { checkReleasable, afterArticleEdit, reviewHash, reviewStatusForNewDraft, sendableRevision } from "./review";
import { approveArticle } from "@/lib/backlinks/managed";
import { switchControl } from "@/lib/publishing/controls";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
afterAll(async () => {
  await test.client.close();
});

async function twoStep(enabled: boolean) {
  await test.db.transaction((tx) => switchControl(tx, "two_step_articles", enabled, { reason: "test", actor: "test" }));
}
beforeEach(async () => {
  await test.db.delete(platformControls).where(eq(platformControls.key, "two_step_articles"));
});

/** A draft on a website outside the Partner Network, its sources flagged for a check. */
async function draft(fields: Partial<typeof articles.$inferInsert> = {}) {
  const site = await seedWebsite(test);
  const [article] = await test.db
    .insert(articles)
    .values({ websiteId: site.websiteId, title: "First article", bodyHtml: "<p>Saved article</p>", status: "draft", researchReviewRequired: true, ...fields })
    .returning();
  return { site, article };
}

async function approve(articleId: string) {
  const [row] = await test.db.select().from(articles).where(eq(articles.id, articleId));
  return approveArticle({ articleId, expectedVersion: row.reviewVersion, expectedHash: reviewHash(row), actorEmail: "team@repget.test" });
}

async function edit(articleId: string, bodyHtml: string) {
  await test.db.transaction(async (tx) => {
    await tx.update(articles).set({ bodyHtml }).where(eq(articles.id, articleId));
    await afterArticleEdit(articleId, tx);
  });
  const [row] = await test.db.select().from(articles).where(eq(articles.id, articleId));
  return row;
}

describe("step 1: new drafts go to the team", () => {
  it("off: a website outside the network keeps the old rule", async () => {
    const { site } = await draft();
    expect(await test.db.transaction((tx) => reviewStatusForNewDraft(tx, site.websiteId))).toBeNull();
  });

  it("on: every new draft waits for the team, network or not", async () => {
    await twoStep(true);
    const { site } = await draft();
    expect(await test.db.transaction((tx) => reviewStatusForNewDraft(tx, site.websiteId))).toBe("pending");
  });

  it("switching on hands the team the drafts waiting for a customer's source approval", async () => {
    const waiting = await draft();
    const approvedByCustomer = await draft();
    await test.db.update(articles).set({ researchApprovedHash: reviewHash(approvedByCustomer.article) }).where(eq(articles.id, approvedByCustomer.article.id));
    const published = await draft({ status: "published", publishedUrl: "https://example.test/live" });

    await twoStep(true);
    const status = async (id: string) => (await test.db.select({ s: articles.reviewStatus }).from(articles).where(eq(articles.id, id)))[0].s;
    expect(await status(waiting.article.id)).toBe("pending");
    // Never approved by the team: every path now checks that.
    expect(await status(approvedByCustomer.article.id)).toBe("pending");
    expect(await status(published.article.id)).toBeNull();
  });
});

describe("the team's one approval", () => {
  it("on: covers the sources, so the article is ready with nothing asked of the customer", async () => {
    await twoStep(true);
    const { article } = await draft({ reviewStatus: "pending" });
    expect(await checkReleasable(article.id)).toEqual({ ok: false, reason: "pending_review" });
    await approve(article.id);
    expect(await checkReleasable(article.id)).toEqual({ ok: true });
  });

  it("off: the sources still wait for their own approval, as before", async () => {
    const { article } = await draft({ reviewStatus: "pending" });
    await approve(article.id);
    expect(await checkReleasable(article.id)).toEqual({ ok: false, reason: "pending_review" });
  });
});

describe("step 2: the customer's own edits", () => {
  it("on: go back to the team, who approve one exact revision; nothing is asked of the customer", async () => {
    await twoStep(true);
    const { article } = await draft({ reviewStatus: "pending" });
    await approve(article.id);
    const after = await edit(article.id, "<p>Saved article, with the customer's own sentence.</p>");
    expect(after.reviewStatus).toBe("pending");
    expect(after.reviewApprovedHash).toBeNull();
    // What may go out is the approved revision, stored, never the edit.
    const held = sendableRevision(after);
    expect(held).toMatchObject({ ok: true, from: "stored" });
    expect(held.ok && held.revision.bodyHtml).toBe("<p>Saved article</p>");
    await approve(article.id);
    expect(await checkReleasable(article.id)).toEqual({ ok: true });
  });

  it("on: an edit that keeps or removes a placed network link goes back alike; approval then checks the link", async () => {
    await twoStep(true);
    const partner = await seedWebsite(test);
    const target = `https://${partner.orgId}.example/services`;
    const { site, article } = await draft({ reviewStatus: "pending", bodyHtml: `<p>Saved article with <a href="${target}">a partner</a>.</p>` });
    const [request] = await test.db.insert(backlinkRequests).values({ websiteId: partner.websiteId, targetUrl: target }).returning();
    await test.db.insert(placements).values({ requestId: request.id, hostWebsiteId: site.websiteId, articleId: article.id, status: "drafted", managed: true });
    await approve(article.id);

    const kept = await edit(article.id, `<p>Reworded, still with <a href="${target}">a partner</a>.</p>`);
    expect(kept.reviewStatus).toBe("pending");
    await approve(article.id);
    const removed = await edit(article.id, "<p>Reworded without the link.</p>");
    expect(removed.reviewStatus).toBe("pending");
    await expect(approve(article.id)).rejects.toThrow(/placed link is missing/);
  });

  it("off: any edit goes back to the team, as before", async () => {
    const { article } = await draft({ reviewStatus: "pending", researchReviewRequired: false });
    await approve(article.id);
    const after = await edit(article.id, "<p>Changed after approval</p>");
    expect(after.reviewStatus).toBe("pending");
  });
});
