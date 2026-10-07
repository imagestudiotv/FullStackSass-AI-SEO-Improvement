import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { agencyWorkspaces, keywords, websites } from "@/lib/db/schema";
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

import { renewalReplan } from "@/inngest/functions/renewal-replan";
import { startResearchJob } from "./research-job";
import { RENEWAL_GRACE_MS, renewalCandidates, replanIfRenewed } from "./renewal";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(() => {
  inngestMock.send.mockReset();
  inngestMock.send.mockResolvedValue({ ids: [] });
});

const DAY = 24 * 60 * 60 * 1000;

/** A researched website whose monthly allowance opened `openedAgo` ms ago. */
async function siteRenewed(openedAgo: number, options: { status?: string | null } = {}) {
  const { orgId, websiteId } = await seedWebsite(test, { status: options.status });
  await test.client.query("update subscriptions set current_period_start = $2 where website_id = $1", [
    websiteId,
    new Date(Date.now() - openedAgo).toISOString(),
  ]);
  await test.db.insert(keywords).values({ websiteId, term: "wedding photographer", source: "ai_seed" });
  return { orgId, websiteId };
}

/** What the job does when it ends: the site is ready again. */
const finish = (websiteId: string) =>
  test.db.update(websites).set({ status: "ready" }).where(eq(websites.id, websiteId));

async function researchJobs(websiteId: string) {
  const { rows } = await test.client.query<{ data: { trigger?: string } }>(
    "select data from job_outbox where name = 'website/research.requested' and data ->> 'websiteId' = $1",
    [websiteId],
  );
  return rows.map((row) => row.data);
}

describe("replanIfRenewed", () => {
  it("queues one research run for a site whose month renewed a day ago, marked as the renewal", async () => {
    const { websiteId } = await siteRenewed(DAY);

    expect(await replanIfRenewed(websiteId)).toBe("queued");

    const jobs = await researchJobs(websiteId);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].trigger).toBe("renewal");
    const [site] = await test.db.select({ status: websites.status }).from(websites).where(eq(websites.id, websiteId));
    // The content page follows the run from the moment it is queued.
    expect(site.status).toBe("researching");
  });

  it("runs once a month: after that run, later checks leave the site alone", async () => {
    const { websiteId } = await siteRenewed(DAY);
    expect(await replanIfRenewed(websiteId)).toBe("queued");
    await finish(websiteId);

    expect(await replanIfRenewed(websiteId)).toBe("already_planned");
    expect(await replanIfRenewed(websiteId, new Date(Date.now() + 2 * 3600 * 1000))).toBe("already_planned");
    expect(await researchJobs(websiteId)).toHaveLength(1);
  });

  it("takes only one run when two checks overlap", async () => {
    const { websiteId } = await siteRenewed(DAY);
    const outcomes = await Promise.all([replanIfRenewed(websiteId), replanIfRenewed(websiteId)]);
    expect(outcomes.filter((o) => o === "queued")).toHaveLength(1);
    expect(await researchJobs(websiteId)).toHaveLength(1);
  });

  it("tries again next hour when the run handed its reservations back before spending", async () => {
    const { websiteId } = await siteRenewed(DAY);
    expect(await replanIfRenewed(websiteId)).toBe("queued");
    // The job failed before any paid call: research-keywords' onFailure releases them.
    await test.client.query("update spend_reservations set state = 'released' where website_id = $1", [websiteId]);
    await finish(websiteId);

    expect(await replanIfRenewed(websiteId)).toBe("queued");
  });

  it("leaves a month whose plan Refresh or added keywords already built", async () => {
    const { orgId, websiteId } = await siteRenewed(DAY);
    expect(await startResearchJob(websiteId, orgId, { refuseIfRunning: true })).toBe("queued");
    await finish(websiteId);

    expect(await replanIfRenewed(websiteId)).toBe("already_planned");
    expect((await researchJobs(websiteId)).map((job) => job.trigger)).toEqual([undefined]);
  });

  it("does not rebuild a plan mid-month", async () => {
    const { websiteId } = await siteRenewed(RENEWAL_GRACE_MS + DAY);
    expect(await replanIfRenewed(websiteId)).toBe("not_renewed");
    expect(await researchJobs(websiteId)).toHaveLength(0);
  });

  it("skips a site whose run is going right now", async () => {
    const { websiteId } = await siteRenewed(DAY);
    await test.db.update(websites).set({ status: "researching", updatedAt: new Date() }).where(eq(websites.id, websiteId));
    expect(await replanIfRenewed(websiteId)).toBe("running");
  });

  it("does nothing for a cancelled subscription", async () => {
    const { websiteId } = await siteRenewed(DAY, { status: "canceled" });
    expect(await replanIfRenewed(websiteId)).toBe("not_entitled");
  });
});

describe("renewalCandidates", () => {
  it("lists researched sites on a live plan or an agency workspace, ready to run", async () => {
    const live = await siteRenewed(DAY);
    const cancelled = await siteRenewed(DAY, { status: "canceled" });
    const unresearched = await seedWebsite(test);
    const busy = await siteRenewed(DAY);
    await test.db.update(websites).set({ status: "researching" }).where(eq(websites.id, busy.websiteId));
    const agency = await siteRenewed(DAY, { status: null });
    await test.db.insert(agencyWorkspaces).values({ organizationId: agency.orgId });

    const ids = new Set(await renewalCandidates());
    expect(ids.has(live.websiteId)).toBe(true);
    expect(ids.has(agency.websiteId)).toBe(true);
    expect(ids.has(cancelled.websiteId)).toBe(false);
    expect(ids.has(unresearched.websiteId)).toBe(false);
    expect(ids.has(busy.websiteId)).toBe(false);
  });
});

describe("the hourly renewal job", () => {
  it("queues the renewed sites and reports what it did", async () => {
    const renewed = await siteRenewed(DAY);
    const midMonth = await siteRenewed(10 * DAY);
    const job = renewalReplan as unknown as {
      handler: (ctx: unknown) => Promise<Record<string, number>>;
    };

    const result = await job.handler({
      step: { run: async (_id: string, fn: () => unknown) => fn() },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });

    expect(await researchJobs(renewed.websiteId)).toHaveLength(1);
    expect(await researchJobs(midMonth.websiteId)).toHaveLength(0);
    expect(result.queued).toBeGreaterThanOrEqual(1);
    expect(result.not_renewed).toBeGreaterThanOrEqual(1);
  });
});
