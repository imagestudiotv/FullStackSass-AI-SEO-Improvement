import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";
import { articles, nextActionPreferences } from "@/lib/db/schema";
const state = vi.hoisted(() => ({ db: null as unknown, context: null as unknown, editor: true }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/websites/require-editor", () => ({ requireEditor: async () => state.editor ? { ok: true, context: state.context } : { ok: false, error: "View-only" } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { checkReleasable, releasableSql, reviewHash } from "./review";
import { approveArticleResearch } from "./research-actions";
import { claimDispatch } from "@/lib/publishing/dispatch";
import { getNextActions } from "@/lib/dashboard/next-actions";
import { snoozeNextAction, restoreNextActions } from "@/lib/dashboard/next-action-actions";

let test: TestDb;
beforeAll(async () => { test = await createTestDb(); state.db = test.db; });
afterAll(async () => { await test.client.close(); });
beforeEach(() => { state.editor = true; });
async function fixture() {
  const site = await seedWebsite(test);
  state.context = { ownerOrgId: site.orgId, userId: "reviewer", site: { id: site.websiteId } };
  const [article] = await test.db.insert(articles).values({
    websiteId: site.websiteId, title: "Research pilot", bodyHtml: "<p>Saved article</p>",
    researchReviewRequired: true,
  }).returning();
  const form = new FormData(); form.set("revision", reviewHash(article)); form.set("reviewed", "yes");
  return { ...site, article, form };
}
describe("research publishing gate", () => {
  it("holds drafts in SQL selectors and direct dispatch, then approves only the reviewed revision", async () => {
    const f = await fixture();
    expect(await checkReleasable(f.article.id)).toEqual({ ok: false, reason: "pending_review" });
    expect(await test.db.select().from(articles).where(and(eq(articles.id, f.article.id), releasableSql))).toHaveLength(0);
    const claim = await claimDispatch({ articleId: f.article.id, websiteId: f.websiteId, trigger: "manual", channel: "direct" });
    expect(claim).toMatchObject({ ok: false, reason: "pending_review" });
    await approveArticleResearch(f.websiteId, f.article.id, f.form);
    expect(await checkReleasable(f.article.id)).toEqual({ ok: true });
    const actions = await getNextActions(f.websiteId, f.orgId, true);
    expect(actions.some(a => a.kind === "research")).toBe(false);
    expect(actions.some(a => a.kind === "draft")).toBe(true);
    expect(await test.db.select().from(articles).where(and(eq(articles.id, f.article.id), releasableSql))).toHaveLength(1);
    await test.db.update(articles).set({ bodyHtml: "<p>Changed after approval</p>" }).where(eq(articles.id, f.article.id));
    expect(await checkReleasable(f.article.id)).toEqual({ ok: false, reason: "changed_since_approval" });
    await expect(approveArticleResearch(f.websiteId, f.article.id, f.form)).rejects.toThrow(/changed/);
  });
  it("refuses viewers, foreign articles, and missing acknowledgement", async () => {
    const f = await fixture(), other = await seedWebsite(test);
    state.editor = false;
    await expect(approveArticleResearch(f.websiteId, f.article.id, f.form)).rejects.toThrow("View-only");
    state.editor = true;
    await expect(approveArticleResearch(other.websiteId, f.article.id, f.form)).rejects.toThrow(/not found/);
    f.form.delete("reviewed");
    await expect(approveArticleResearch(f.websiteId, f.article.id, f.form)).rejects.toThrow(/Review/);
  });
  it("does not bypass the independent Partner Network review", async () => {
    const f = await fixture();
    await test.db.update(articles).set({ reviewStatus: "pending" }).where(eq(articles.id, f.article.id));
    await approveArticleResearch(f.websiteId, f.article.id, f.form);
    expect(await checkReleasable(f.article.id)).toEqual({ ok: false, reason: "pending_review" });
  });
  it("authorizes task reminders and restoration on the server", async () => {
    const f = await fixture();
    const action = (await getNextActions(f.websiteId, f.orgId, true))[0];
    const form = new FormData(); form.set("taskId", action.id);
    state.editor = false;
    await expect(snoozeNextAction(f.websiteId, form)).rejects.toThrow("View-only");
    await expect(restoreNextActions(f.websiteId)).rejects.toThrow("View-only");
    state.editor = true;
    await snoozeNextAction(f.websiteId, form);
    expect(await test.db.select().from(nextActionPreferences).where(eq(nextActionPreferences.websiteId, f.websiteId))).toHaveLength(1);
    const foreign = await seedWebsite(test);
    await snoozeNextAction(foreign.websiteId, form);
    expect(await test.db.select().from(nextActionPreferences).where(eq(nextActionPreferences.websiteId, foreign.websiteId))).toHaveLength(0);
    await restoreNextActions(f.websiteId);
    expect(await test.db.select().from(nextActionPreferences).where(eq(nextActionPreferences.websiteId, f.websiteId))).toHaveLength(0);
  });
});
