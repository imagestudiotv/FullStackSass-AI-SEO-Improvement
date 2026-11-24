import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { user } from "@/lib/db/auth-tables";
import { agencyWorkspaces, articles, calendarItems, freePlanAccounts, keywords, websites } from "@/lib/db/schema";
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
import { FIRST_PLAN_ATTEMPTS, FIRST_PLAN_WAITS_MS, FIRST_PLAN_WINDOW_MS, firstPlanCandidates, planFirstIfDue } from "./first-plan";
import { startResearchJob } from "./research-job";

/**
 * The first content plan starts by itself (client, 2026-11-21: the first Free
 * sign-up stopped before the onboarding's "Build my content plan" and got no
 * article): an analysed website with a plan - paid or Free - that was never
 * planned gets its research run; and one whose run brought no calendar is
 * tried again, bounded, instead of counting as planned for ever (client,
 * 2026-11-24: three sign-ups at once, one article).
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

    // While it runs, and once it brought its calendar: never a second automatic run.
    expect(await planFirstIfDue(websiteId)).toBe("running");
    await finish(websiteId);
    await test.db.insert(calendarItems).values({ websiteId, title: "A topic" });
    expect(await planFirstIfDue(websiteId)).toBe("already_planned");
    expect(await researchJobs(websiteId)).toHaveLength(1);
  });

  it("tries again when a run ended without a calendar - keywords or not - waiting longer each time, then gives up", async () => {
    const { websiteId } = await freeSite();
    const start = new Date();
    const at = (ms: number) => new Date(start.getTime() + ms);
    // Each run's reservation is stamped with the real clock: move them to the test's.
    const stamp = (when: Date) =>
      test.client.query("update spend_reservations set created_at = $2, counted_at = $2, state = 'consumed' where website_id = $1 and created_at > $3", [
        websiteId, when.toISOString(), at(-1000).toISOString(),
      ]);
    expect(await planFirstIfDue(websiteId, start)).toBe("queued");
    await stamp(at(-10_000));
    await finish(websiteId);
    // Its clustering failed after the keywords were stored: a paid run, and nothing to write.
    await test.db.insert(keywords).values({ websiteId, term: "wedding videographer", source: "ai_seed" });
    expect(await firstPlanCandidates()).toContain(websiteId);
    expect(await planFirstIfDue(websiteId, start)).toBe("waiting");

    let clock = FIRST_PLAN_WAITS_MS[0];
    for (let run = 2; run <= FIRST_PLAN_ATTEMPTS; run += 1) {
      // Two hours on, the hourly research limits have room too.
      expect(await planFirstIfDue(websiteId, at(clock))).toBe("queued");
      await finish(websiteId);
      await test.client.query("update spend_reservations set created_at = $2, counted_at = $2, state = 'consumed' where website_id = $1 and state = 'reserved'", [websiteId, at(clock).toISOString()]);
      expect(await planFirstIfDue(websiteId, at(clock + 60_000))).toBe(run < FIRST_PLAN_ATTEMPTS ? "waiting" : "gave_up");
      clock += FIRST_PLAN_WAITS_MS[run - 1];
    }
    expect(await planFirstIfDue(websiteId, at(clock + 10 * 24 * 3600 * 1000))).toBe("gave_up");
    expect(await researchJobs(websiteId)).toHaveLength(FIRST_PLAN_ATTEMPTS);
  });

  it("waits between runs that failed before spending anything, but does not count them as tries", async () => {
    const { websiteId } = await freeSite();
    expect(await planFirstIfDue(websiteId)).toBe("queued");
    await test.client.query("update spend_reservations set state = 'released' where website_id = $1", [websiteId]);
    await finish(websiteId);
    expect(await planFirstIfDue(websiteId)).toBe("waiting");
    expect(await planFirstIfDue(websiteId, new Date(Date.now() + FIRST_PLAN_WAITS_MS[0] + 1000))).toBe("queued");
    const [job] = (await researchJobs(websiteId)) as { data: { trigger?: string } }[];
    // So its failure is not reported to the customer: RepGet tries again by itself.
    expect(job.data.trigger).toBe("first");
  });

  it("takes over a run that never ended, and waits out Free's AI pause", async () => {
    const stuck = await freeSite();
    await test.db.update(websites).set({ status: "researching", updatedAt: new Date(Date.now() - 3600_000) }).where(eq(websites.id, stuck.websiteId));
    expect(await firstPlanCandidates()).toContain(stuck.websiteId);
    expect(await planFirstIfDue(stuck.websiteId)).toBe("queued");

    const paused = await freeSite();
    process.env.FREE_PLAN_DAILY_AI_BUDGET_CENTS = "0";
    try {
      expect(await planFirstIfDue(paused.websiteId)).toBe("paused");
    } finally {
      delete process.env.FREE_PLAN_DAILY_AI_BUDGET_CENTS;
    }
    expect(await researchJobs(paused.websiteId)).toHaveLength(0);
    expect(await planFirstIfDue(paused.websiteId)).toBe("queued");
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

  it("leaves alone a website already planned: a calendar or an article; and waits after the onboarding step's run", async () => {
    const withArticle = await seedWebsite(test);
    await test.db.insert(articles).values({ websiteId: withArticle.websiteId, title: "Written" });
    expect(await planFirstIfDue(withArticle.websiteId)).toBe("already_planned");

    const withCalendar = await seedWebsite(test);
    await test.db.insert(calendarItems).values({ websiteId: withCalendar.websiteId, title: "A topic" });
    expect(await planFirstIfDue(withCalendar.websiteId)).toBe("already_planned");

    // The onboarding's "Build my content plan" (or the Content page's button) ran first.
    const pressed = await seedWebsite(test);
    expect(await startResearchJob(pressed.websiteId, pressed.orgId, { refuseIfRunning: true })).toBe("queued");
    await finish(pressed.websiteId);
    expect(await planFirstIfDue(pressed.websiteId)).toBe("waiting");
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
