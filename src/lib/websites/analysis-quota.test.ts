import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { organization } from "@/lib/db/auth-tables";
import { networkSites, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

const state = vi.hoisted(() => ({ db: null as unknown, orgId: "", guestOrgId: null as string | null }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));

// Auth mocked at the tenant boundary; entitlement, quotas and rows are real.
async function contextFor(websiteId: string) {
  const db = state.db as TestDb["db"];
  const [site] = await db.select().from(websites).where(eq(websites.id, websiteId));
  // A guest editor acts from their own workspace; the site's owner pays.
  return state.guestOrgId
    ? { site, orgId: state.guestOrgId, userId: "guest", access: "editor" as const }
    : { site, orgId: site.organizationId, userId: "user_1", access: "owner" as const };
}
vi.mock("@/lib/tenant", () => ({
  requireOrg: vi.fn(async () => ({ orgId: state.orgId, userId: "user_1" })),
  requireWebsite: vi.fn(contextFor),
  WebsiteNotFoundError: class extends Error {},
}));
vi.mock("@/lib/websites/require-editor", () => ({
  requireEditor: vi.fn(async (id: string) => ({ ok: true, context: await contextFor(id) })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// The queue: jobs go through the real outbox (lib/jobs/outbox.ts) to this send.
const inngestMock = vi.hoisted(() => ({
  send: vi.fn(),
  createFunction: vi.fn((config: unknown, handler: unknown) => ({ config, handler })),
}));
vi.mock("@/inngest/client", () => ({ inngest: inngestMock }));

import { addWebsite, reanalyzeWebsite } from "./actions";
import {
  ANALYSES_PER_WORKSPACE_PER_HOUR,
  FREE_ANALYSES_PER_WORKSPACE_PER_DAY,
} from "./analysis-quota";
import { analyzeWebsite } from "@/inngest/functions/analyze-website";
import { deliverJobs, MAX_DELIVERY_ATTEMPTS } from "@/lib/jobs/outbox";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  inngestMock.send.mockReset();
  inngestMock.send.mockResolvedValue({ ids: [] });
  state.guestOrgId = null;
  await test.client.exec("delete from spend_reservations; delete from job_outbox;");
});

async function newWorkspace() {
  state.orgId = `org_${crypto.randomUUID()}`;
  await test.db
    .insert(organization)
    .values({ id: state.orgId, name: "W", slug: state.orgId, createdAt: new Date() });
  return state.orgId;
}

async function markReady(websiteId: string) {
  await test.db.update(websites).set({ status: "ready" }).where(eq(websites.id, websiteId));
}

describe("adding websites (free analysis)", () => {
  it("stops a workspace after its daily free allowance, before creating a row", async () => {
    const orgId = await newWorkspace();
    const outcomes = [];
    for (let i = 0; i < FREE_ANALYSES_PER_WORKSPACE_PER_DAY + 3; i += 1) {
      outcomes.push(await addWebsite(`https://site-${i}-${orgId.slice(4, 12)}.com`));
    }
    expect(outcomes.filter((o) => o.ok)).toHaveLength(FREE_ANALYSES_PER_WORKSPACE_PER_DAY);
    expect(outcomes.at(-1)).toEqual({ ok: false, error: expect.stringMatching(/Choose a plan/) });
    const rows = await test.db.select().from(websites).where(eq(websites.organizationId, orgId));
    expect(rows).toHaveLength(FREE_ANALYSES_PER_WORKSPACE_PER_DAY);
    expect(inngestMock.send).toHaveBeenCalledTimes(FREE_ANALYSES_PER_WORKSPACE_PER_DAY);
  });

  it("a new website gets the client's defaults from the application, and joins the Partner Network", async () => {
    await newWorkspace();
    const added = await addWebsite(`https://d-${state.orgId.slice(4, 12)}.com`);
    if (!added.ok) throw new Error(added.error);
    const [site] = await test.db.select().from(websites).where(eq(websites.id, added.data.id));
    expect(site).toMatchObject({ autoPublish: true, publishAs: "live", tableOfContents: true, mentionSimilarProducts: true, poweredByLink: true });
    const [network] = await test.db.select().from(networkSites).where(eq(networkSites.websiteId, added.data.id));
    expect(network).toMatchObject({ acceptingLinks: true, monthlyCap: 3 });
  });

  it("accepts a website while the queue is down, and hands the slot back only when delivery is given up", async () => {
    await newWorkspace();
    inngestMock.send.mockRejectedValue(new Error("queue down"));
    const added = await addWebsite(`https://q-${state.orgId.slice(4, 12)}.com`);
    if (!added.ok) throw new Error(added.error);

    // The site says "pending" honestly: its job is recorded and retrying.
    const [site] = await test.db.select().from(websites).where(eq(websites.id, added.data.id));
    expect(site.status).toBe("pending");
    expect(await states()).toEqual({ reserved: 3 });

    await giveUpDelivery();
    const [after] = await test.db.select().from(websites).where(eq(websites.id, added.data.id));
    expect(after.status).toBe("failed");
    expect(await states()).toEqual({ released: 3 });
  });
});

describe("reanalyzeWebsite", () => {
  it("queues one analysis for simultaneous presses", async () => {
    const { websiteId } = await seedWebsite(test);
    const outcomes = await Promise.all(
      Array.from({ length: 6 }, () => reanalyzeWebsite(websiteId)),
    );
    expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
    expect(inngestMock.send).toHaveBeenCalledTimes(1);
    // Refused presses rolled back with their claim: one reservation, one job.
    expect(await states()).toEqual({ reserved: 1 });
    const { rows } = await test.client.query("select 1 from job_outbox");
    expect(rows).toHaveLength(1);
  });

  it("gives a paying website the hourly ceiling, not the free allowance", async () => {
    const { websiteId } = await seedWebsite(test);
    const outcomes = [];
    for (let i = 0; i < ANALYSES_PER_WORKSPACE_PER_HOUR + 2; i += 1) {
      outcomes.push(await reanalyzeWebsite(websiteId));
      await markReady(websiteId);
    }
    expect(outcomes.filter((o) => o.ok)).toHaveLength(ANALYSES_PER_WORKSPACE_PER_HOUR);
  });

  it("limits an unpaid website to the free allowance", async () => {
    const { websiteId } = await seedWebsite(test, { status: "canceled" });
    const outcomes = [];
    for (let i = 0; i < FREE_ANALYSES_PER_WORKSPACE_PER_DAY + 2; i += 1) {
      outcomes.push(await reanalyzeWebsite(websiteId));
      await markReady(websiteId);
    }
    expect(outcomes.filter((o) => o.ok)).toHaveLength(FREE_ANALYSES_PER_WORKSPACE_PER_DAY);
  });

  it("returns the slot when the analysis job fails for good", async () => {
    const { websiteId } = await seedWebsite(test, { status: null });
    expect((await reanalyzeWebsite(websiteId)).ok).toBe(true);
    const data = inngestMock.send.mock.calls[0][0].data;

    const job = analyzeWebsite as unknown as {
      config: { onFailure: (ctx: unknown) => Promise<void> };
    };
    await job.config.onFailure({
      event: { data: { event: { data } } },
      error: new Error("model unavailable"),
      logger: { error: vi.fn() },
    });

    expect(await states()).toEqual({ released: 3 });
    const [site] = await test.db.select().from(websites).where(eq(websites.id, websiteId));
    expect(site.status).toBe("failed");
  });

  it("keeps the slot when the model was paid and the job failed afterwards", async () => {
    const { websiteId } = await seedWebsite(test);
    expect((await reanalyzeWebsite(websiteId)).ok).toBe(true);
    const data = inngestMock.send.mock.calls[0][0].data;
    // extract-profile's paidCall recorded the spend before a later step failed.
    await test.client.query("update spend_reservations set state = 'consumed'");

    const job = analyzeWebsite as unknown as {
      config: { onFailure: (ctx: unknown) => Promise<void> };
    };
    await job.config.onFailure({
      event: { data: { event: { data } } },
      error: new Error("save failed"),
      logger: { error: vi.fn() },
    });
    expect(await states()).toEqual({ consumed: 1 });
  });

  it("bills a shared site's owner, not the invited editor's workspace", async () => {
    const { orgId: ownerOrgId, websiteId } = await seedWebsite(test);
    state.guestOrgId = await newWorkspace();

    expect((await reanalyzeWebsite(websiteId)).ok).toBe(true);

    const { rows } = await test.client.query<{ key: string; organization_id: string }>(
      "select key, organization_id from spend_reservations",
    );
    expect(rows).toEqual([{ key: `analysis:org:${ownerOrgId}`, organization_id: ownerOrgId }]);
    expect(inngestMock.send.mock.calls[0][0].data.organizationId).toBe(ownerOrgId);
  });

  it("reports a delivery that never succeeds truthfully, and only then returns the slot", async () => {
    const { websiteId } = await seedWebsite(test);
    inngestMock.send.mockRejectedValue(new Error("queue down"));

    expect(await reanalyzeWebsite(websiteId)).toEqual({ ok: true, data: null });
    const [waiting] = await test.db.select().from(websites).where(eq(websites.id, websiteId));
    expect(waiting.status).toBe("pending");
    expect(await states()).toEqual({ reserved: 1 });

    await giveUpDelivery();
    const [site] = await test.db.select().from(websites).where(eq(websites.id, websiteId));
    expect(site.status).toBe("failed");
    expect(await states()).toEqual({ released: 1 });
  });
});

/** Drives delivery past its last attempt, as the outbox cron would. */
async function giveUpDelivery() {
  await test.client.query("update job_outbox set attempts = $1 where status = 'pending'", [
    MAX_DELIVERY_ATTEMPTS - 1,
  ]);
  await deliverJobs(test.db, { now: new Date(Date.now() + 24 * 3600 * 1000) });
}

async function states() {
  const { rows } = await test.client.query<{ state: string; n: number }>(
    "select state, count(*)::int as n from spend_reservations group by state",
  );
  return Object.fromEntries(rows.map((r) => [r.state, r.n]));
}
