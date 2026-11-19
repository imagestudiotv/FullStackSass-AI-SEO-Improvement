import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * The Free plan's launch cap on REAL Postgres, each sign-up on its own
 * connection (PGlite has one, so it can only run them in turn). Skipped
 * unless TEST_POSTGRES_URL names a disposable server (src/test/postgres.ts).
 *
 * The brief: "two signups at 499/500 must not both pass". startFreePlan
 * counts and inserts under one advisory lock, so they are admitted one after
 * the other and exactly one gets the last spot.
 */

vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: () => { throw new Error("the shared db is not used here"); } }), isDatabaseConfigured: () => true }));

import { creditSettings, freePlanAccounts, organization, websites } from "@/lib/db/schema";
import { FREE_PLAN_CAP_KEY, startFreePlan } from "./free-plan-server";

const available = Boolean(testPostgresUrl());

describe.skipIf(!available)("the Free plan's cap on real Postgres", () => {
  type Created = Awaited<ReturnType<typeof createPostgresTestDb>>;
  let dbs: Created["dbs"];
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    const created = await createPostgresTestDb(4, { prefix: "free_plan_test" });
    dbs = created.dbs;
    dispose = created.dispose;
  }, 120_000);

  afterAll(async () => {
    await dispose?.();
  });

  async function site() {
    const orgId = `org_${randomUUID()}`;
    await dbs[0].insert(organization).values({ id: orgId, name: "Test", slug: orgId, createdAt: new Date() });
    const [row] = await dbs[0]
      .insert(websites)
      .values({ organizationId: orgId, url: `https://${orgId}.example`, domain: `${orgId}.example`, status: "ready" })
      .returning({ id: websites.id });
    return { organizationId: orgId, websiteId: row.id, userId: null, emailVerified: true };
  }

  it("admits exactly one of two sign-ups racing for the last spot (cap 4, 3 taken)", async () => {
    await dbs[0].insert(creditSettings).values({ key: FREE_PLAN_CAP_KEY, value: 4 });
    for (let i = 0; i < 3; i++) expect((await startFreePlan(await site(), dbs[0])).ok).toBe(true);

    const [a, b] = [await site(), await site()];
    const results = await Promise.all([startFreePlan(a, dbs[1] as never), startFreePlan(b, dbs[2] as never)]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([{ ok: false, reason: "full" }]);
    expect(await dbs[0].select().from(freePlanAccounts)).toHaveLength(4);
  });

  it("starts once when the same website is started twice at the same moment (idempotent)", async () => {
    await dbs[0].update(creditSettings).set({ value: 100 });
    const one = await site();
    const results = await Promise.all([startFreePlan(one, dbs[1] as never), startFreePlan(one, dbs[3] as never)]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(results.map((result) => result.ok && result.alreadyStarted).sort()).toEqual([false, true]);
  });
});
