import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { member, user } from "@/lib/db/auth-tables";
import { agencyWorkspaces, articles, calendarItems, freePlanAccounts, spendReservations, websites } from "@/lib/db/schema";
import { FIRST_PLAN_ATTEMPTS, FIRST_PLAN_WINDOW_MS } from "@/lib/keywords/first-plan";
import { researchSiteKey } from "@/lib/keywords/research-job";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/** Why a website has no article, as an administrator is told (client, 2026-11-24). */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/inngest/client", () => ({ inngest: { send: vi.fn(), createFunction: vi.fn() } }));

import { firstArticleStatus } from "./first-article-status";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

async function owner(orgId: string, emailVerified: boolean) {
  const id = `user_${randomUUID()}`;
  await test.db.insert(user).values({ id, name: "Owner", email: `${id}@example.test`, emailVerified, createdAt: new Date(), updatedAt: new Date() });
  await test.db.insert(member).values({ id: randomUUID(), organizationId: orgId, userId: id, role: "owner", createdAt: new Date() });
  return id;
}
async function free() {
  const site = await seedWebsite(test, { status: null });
  const userId = await owner(site.orgId, true);
  await test.db.insert(freePlanAccounts).values({ organizationId: site.orgId, websiteId: site.websiteId, domain: `${site.orgId}.example`, userId });
  return site;
}
const set = (websiteId: string, values: Partial<typeof websites.$inferInsert>) => test.db.update(websites).set(values).where(eq(websites.id, websiteId));
async function topic(websiteId: string, inDays = 0, article?: Partial<typeof articles.$inferInsert>) {
  const [item] = await test.db
    .insert(calendarItems)
    .values({ websiteId, title: "Topic", status: "planned", scheduledFor: new Date(Date.now() + inDays * 86_400_000) })
    .returning({ id: calendarItems.id });
  if (article) await test.db.insert(articles).values({ websiteId, calendarItemId: item.id, title: "Topic", ...article });
}
const runs = (websiteId: string, states: string[]) =>
  test.db.insert(spendReservations).values(states.map((s) => ({ key: researchSiteKey(websiteId), operation: "keywords.research", websiteId, state: s, limitValue: 3 })));
const code = async (websiteId: string) => (await firstArticleStatus(websiteId))?.code;

describe("firstArticleStatus", () => {
  it("knows nothing about a website that does not exist", async () => {
    expect(await firstArticleStatus(randomUUID())).toBeNull();
  });

  it("says when it has one, or one is being written", async () => {
    const { websiteId } = await free();
    await topic(websiteId, 0, { status: "generating" });
    expect(await code(websiteId)).toBe("writing");
    await test.db.update(articles).set({ status: "draft", bodyHtml: "<p>x</p>" }).where(eq(articles.websiteId, websiteId));
    expect(await firstArticleStatus(websiteId)).toMatchObject({ code: "written", waiting: false });
  });

  it("names the analysis", async () => {
    const { websiteId } = await free();
    await set(websiteId, { status: "crawling" });
    expect(await code(websiteId)).toBe("analysing");
    await set(websiteId, { status: "failed" });
    expect(await firstArticleStatus(websiteId)).toMatchObject({ code: "analysis_failed", waiting: false });
  });

  it("names a plan that was never started, an unconfirmed email and an ended plan", async () => {
    const none = await seedWebsite(test, { status: null });
    await owner(none.orgId, true);
    expect(await firstArticleStatus(none.websiteId)).toMatchObject({ code: "no_plan", waiting: false });
    const unconfirmed = await seedWebsite(test, { status: null });
    await owner(unconfirmed.orgId, false);
    expect(await code(unconfirmed.websiteId)).toBe("email_unconfirmed");
    const ended = await seedWebsite(test, { status: "canceled" });
    expect(await code(ended.websiteId)).toBe("plan_inactive");
  });

  it("follows the research: not started, running, waiting for its next try, given up", async () => {
    const { websiteId } = await free();
    expect(await firstArticleStatus(websiteId)).toMatchObject({ code: "research_not_started", waiting: true });
    await set(websiteId, { status: "researching", updatedAt: new Date() });
    expect(await code(websiteId)).toBe("researching");
    await set(websiteId, { status: "ready" });
    await runs(websiteId, ["released"]);
    expect(await firstArticleStatus(websiteId)).toMatchObject({ code: "research_waiting", waiting: true });
    await runs(websiteId, Array.from({ length: FIRST_PLAN_ATTEMPTS }, () => "consumed"));
    expect(await firstArticleStatus(websiteId)).toMatchObject({ code: "research_gave_up", waiting: false });
  });

  it("says when nobody will start it: an old website, an agency's", async () => {
    const old = await free();
    await set(old.websiteId, { createdAt: new Date(Date.now() - FIRST_PLAN_WINDOW_MS - 60_000) });
    expect(await firstArticleStatus(old.websiteId)).toMatchObject({ code: "research_not_started", waiting: false });
    const agency = await seedWebsite(test, { status: null });
    await test.db.insert(agencyWorkspaces).values({ organizationId: agency.orgId });
    expect(await firstArticleStatus(agency.websiteId)).toMatchObject({ code: "research_not_started", waiting: false });
  });

  it("names Free's pause, manual writing, a failed writing, and the day it is due", async () => {
    const site = await free();
    await topic(site.websiteId);
    expect(await firstArticleStatus(site.websiteId)).toMatchObject({ code: "due_now", waiting: true });
    process.env.FREE_PLAN_DAILY_AI_BUDGET_CENTS = "0";
    try {
      expect(await code(site.websiteId)).toBe("free_paused");
    } finally {
      delete process.env.FREE_PLAN_DAILY_AI_BUDGET_CENTS;
    }
    await set(site.websiteId, { generationMode: "manual" });
    expect(await code(site.websiteId)).toBe("manual");

    const later = await free();
    await topic(later.websiteId, 5);
    expect(await code(later.websiteId)).toBe("due_later");

    const failed = await free();
    await topic(failed.websiteId, 0, { status: "failed", error: "The model declined" });
    const status = await firstArticleStatus(failed.websiteId);
    expect(status?.code).toBe("writing_failed");
    expect(status?.message).toContain("The model declined");
  });
});
