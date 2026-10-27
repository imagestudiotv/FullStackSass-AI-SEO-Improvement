import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * Spending credits on REAL Postgres through postgres-js, the production
 * driver, with simultaneous spends on separate connections - PGlite has one
 * connection, so it can only run them in turn. Skipped unless
 * TEST_POSTGRES_URL names a disposable server (src/test/postgres.ts).
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));

import { creditHistory, creditOverview } from "@/lib/credits/overview";
import { refundSpend, spendCredits } from "@/lib/credits/spend";
import { creditLedger, creditSettings, organization, websites } from "@/lib/db/schema";

const available = Boolean(testPostgresUrl());

describe.skipIf(!available)("credit spends on real Postgres", () => {
  type Db = typeof import("@/lib/db").db;
  let dbs: Db[];
  let dispose: () => Promise<void>;

  beforeAll(async () => {
    const created = await createPostgresTestDb(3);
    dbs = created.dbs as unknown as Db[];
    state.db = dbs[0];
    dispose = created.dispose;
    await dbs[0].insert(creditSettings).values({ key: "price:audit_rerun", value: 3 });
  }, 120_000);

  afterAll(async () => {
    await dispose?.();
  });

  async function workspace(balance: number) {
    const orgId = `org_${randomUUID().slice(0, 8)}`;
    await dbs[0].insert(organization).values({ id: orgId, name: "W", slug: orgId, createdAt: new Date() });
    const [site] = await dbs[0]
      .insert(websites)
      .values({ organizationId: orgId, url: `https://${orgId}.test`, domain: `${orgId}.test` })
      .returning({ id: websites.id });
    await dbs[0].insert(creditLedger).values({ organizationId: orgId, type: "purchase", amount: balance });
    return { orgId, websiteId: site.id };
  }

  it("lets through only what the balance covers, however many arrive at once", async () => {
    const { orgId } = await workspace(7);
    const results = await Promise.all(
      Array.from({ length: 9 }, (_, i) =>
        dbs[i % 3].transaction((tx) => spendCredits(tx, { organizationId: orgId, action: "audit_rerun", key: `race:${randomUUID()}` })),
      ),
    );
    expect(results.filter((result) => result.ok)).toHaveLength(2);
    expect((await creditOverview(orgId)).balance).toBe(1);
  });

  it("charges one key once, from two connections at the same moment", async () => {
    const { orgId } = await workspace(10);
    const key = `twice:${randomUUID()}`;
    await Promise.all(
      [0, 1].map((i) => dbs[i].transaction((tx) => spendCredits(tx, { organizationId: orgId, action: "audit_rerun", key }))),
    );
    expect((await creditOverview(orgId)).balance).toBe(7);
  });

  it("refunds, and lists the spend and its refund with their website", async () => {
    const { orgId, websiteId } = await workspace(5);
    const key = `refund:${randomUUID()}`;
    await dbs[0].transaction((tx) => spendCredits(tx, { organizationId: orgId, action: "audit_rerun", key, websiteId }));
    expect(await refundSpend(key)).toEqual({ refunded: true, credits: 3 });
    const history = await creditHistory(orgId, { page: 1, pageSize: 25 });
    expect(history.rows.map((row) => [row.type, row.amount, row.action, row.websiteDomain])).toEqual([
      ["spend_refund", 3, "audit_rerun", `${orgId}.test`],
      ["spend", -3, "audit_rerun", `${orgId}.test`],
      ["purchase", 5, null, null],
    ]);
    // A real date through postgres-js (the ledger's own clock is the server's: UTC in production).
    expect(Number.isNaN(history.rows[0].at.getTime())).toBe(false);
  });
});
