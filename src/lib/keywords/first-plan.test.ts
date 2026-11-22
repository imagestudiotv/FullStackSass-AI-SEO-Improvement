import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { user } from "@/lib/db/auth-tables";
import { agencyWorkspaces, calendarItems, freePlanAccounts, keywords, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
// Jobs go through the real outbox to this send; nothing leaves the process.
const inngestMock = vi.hoisted(() => ({
  send: vi.fn(),
  createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })),
}));
vi.mock("@/inngest/client", () => ({ inngest: inngestMock }));
vi.mock("@/lib/notifications/create", () => ({ notify: vi.fn() }));

import { firstContentPlan } from "@/inngest/functions/first-content-plan";
import { FIRST_PLAN_WINDOW_MS, firstPlanCandidates, planFirstIfDue } from "./first-plan";
import { startResearchJob } from "./research-job";

/**
 * The first content plan starts by itself (client, 2026-11-21: the first Free
 * sign-up stopped before the onboarding's "Build my content plan" and got no
 * article): an analysed website with a plan - paid or Free - that was never
 * planned gets one research run, once, ever.
 */

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(() => {
  inngestMock.send.mockReset();
  inngestMock.send.mockResolvedValue({ ids: [] });
});

async function researchJobs(websiteId: string) {
  const { rows } = await test.client.query("select data from job_outbox where name = 'website/research.requested' and data ->> 'websiteId' = $1", [websiteId]);
  return rows;
}
const statusOf = async (websiteId: string) => (await test.db.select({ status: websites.status }).from(websites).where(eq(websites.id, websiteId)))[0]?.status;
/** What the research job does when it ends: the site is ready again. */
const finish = (websiteId: string) => test.db.update(websites).set({ status: "ready" }).where(eq(websites.id, websiteId));

/** A website on the Free plan: no subscription, a free_plan_accounts row. */
async function freeSite() {
  const site = await seedWebsite(test, { status: null });
  const userId = `user_${randomUUID()}`;
  const now = new Date();
  await test.db.insert(user).values({ id: userId, name: "Free owner", email: `${userId}@example.test`, emailVerified: true, createdAt: now, updatedAt: now });
  await test.db.insert(freePlanAccounts).values({ organizationId: site.orgId, websiteId: site.websiteId, domain: `${site.orgId}.example`, userId });
  return site;
}

describe("planFirstIfDue", () => {
  it("starts the first content plan of a Free website, once", async () => {
    const { websiteId } = await freeSite();
    expect(await planFirstIfDue(websiteId)).toBe("queued");
    expect(await researchJobs(websiteId)).toHaveLength(1);
    // The Content page follows the run from the moment it is queued.
    expect(await statusOf(websiteId)).toBe("researching");

    // While it runs, and after it ended without keywords: never a second automatic run.
    expect(await planFirstIfDue(websiteId)).toBe("running");
    await finish(websiteId);
    expect(await planFirstIfDue(websiteId)).toBe("already_planned");
    expect(await researchJobs(websiteId)).toHaveLength(1);
  });

  it("starts it for a paying website too", async () => {
    const { websiteId } = await seedWebsite(test);
    expect(await planFirstIfDue(websiteId)).toBe("queued");
    expect(await researchJobs(websiteId)).toHaveLength(1);
  });

  it("waits for the analysis, and for a plan", async () => {
    const analysing = await seedWebsite(test);
    await test.db.update(websites).set({ status: "crawling" }).where(eq(websites.id, analysing.websiteId));
    expect(await planFirstIfDue(analysing.websiteId)).toBe("not_ready");

    const noPlan = await seedWebsite(test, { status: null });
    expect(await planFirstIfDue(noPlan.websiteId)).toBe("not_entitled");
    expect(await researchJobs(analysing.websiteId)).toHaveLength(0);
    expect(await researchJobs(noPlan.websiteId)).toHaveLength(0);
  });

  it("leaves alone a website already planned: keywords, a calendar, or a research run by the onboarding step", async () => {
    const withKeywords = await seedWebsite(test);
    await test.db.insert(keywords).values({ websiteId: withKeywords.websiteId, term: "wedding videographer", source: "ai_seed" });
    expect(await planFirstIfDue(withKeywords.websiteId)).toBe("already_planned");

    const withCalendar = await seedWebsite(test);
    await test.db.insert(calendarItems).values({ websiteId: withCalendar.websiteId, title: "A topic" });
    expect(await planFirstIfDue(withCalendar.websiteId)).toBe("already_planned");

    // The onboarding's "Build my content plan" (or the Content page's button) ran first.
    const pressed = await seedWebsite(test);
    expect(await startResearchJob(pressed.websiteId, pressed.orgId, { refuseIfRunning: true })).toBe("queued");
    await finish(pressed.websiteId);
    expect(await planFirstIfDue(pressed.websiteId)).toBe("already_planned");
    expect(await researchJobs(pressed.websiteId)).toHaveLength(1);
  });

  it("never plans an agency workspace's website", async () => {
    const agency = await seedWebsite(test);
    await test.db.insert(agencyWorkspaces).values({ organizationId: agency.orgId });
    expect(await planFirstIfDue(agency.websiteId)).toBe("agency");
    expect(await researchJobs(agency.websiteId)).toHaveLength(0);
  });
});

describe("the sweep (first-content-plan, every 10 minutes)", () => {
  it("looks only at recent, analysed, never-planned websites outside agency workspaces", async () => {
    const fresh = await seedWebsite(test);
    const old = await seedWebsite(test);
    await test.db.update(websites).set({ createdAt: new Date(Date.now() - FIRST_PLAN_WINDOW_MS - 60_000) }).where(eq(websites.id, old.websiteId));
    const agency = await seedWebsite(test);
    await test.db.insert(agencyWorkspaces).values({ organizationId: agency.orgId });

    const candidates = await firstPlanCandidates();
    expect(candidates).toContain(fresh.websiteId);
    expect(candidates).not.toContain(old.websiteId);
    expect(candidates).not.toContain(agency.websiteId);
  });

  it("starts the plan of a Free website that stopped before the onboarding step, and nothing on its next run", async () => {
    const { websiteId } = await freeSite();
    const job = firstContentPlan as unknown as { handler: (ctx: unknown) => Promise<Record<string, number>> };
    const ctx = { step: { run: async (_id: string, fn: () => unknown) => fn() }, logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } };

    const result = await job.handler(ctx);
    expect(result.queued).toBeGreaterThanOrEqual(1);
    expect(await researchJobs(websiteId)).toHaveLength(1);

    await finish(websiteId);
    await job.handler(ctx);
    expect(await researchJobs(websiteId)).toHaveLength(1);
  });
});
