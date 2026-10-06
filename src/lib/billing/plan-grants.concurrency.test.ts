import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * "One grant per allowance month" (grantMonthlyCredits) on REAL Postgres,
 * each page load on its own connection - PGlite has one, so it can only run
 * them in turn. Skipped unless TEST_POSTGRES_URL names a disposable server
 * (src/test/postgres.ts).
 *
 * The unique key makes ONE period idempotent; the trial rule is about two
 * DIFFERENT keys (the trial's period and the paid period after it), so two
 * page loads either side of the conversion webhook must still grant once.
 */

const route = vi.hoisted(() => ({ store: null as unknown as AsyncLocalStorage<unknown>, fallback: null as unknown }));
vi.mock("@/lib/db", async () => {
  const { AsyncLocalStorage: Als } = await import("node:async_hooks");
  route.store = new Als();
  return {
    db: new Proxy({}, { get: (_t, p) => Reflect.get((route.store.getStore() ?? route.fallback) as object, p) }),
  };
});

import { grantMonthlyCredits, planGrantKey } from "@/lib/backlinks/credits";
import { creditLedger, organization, plans, subscriptions, websites } from "@/lib/db/schema";

const available = Boolean(testPostgresUrl());
const d = (iso: string) => new Date(iso);

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

class Rollback extends Error {}

describe.skipIf(!available)("plan grants on real Postgres", () => {
  type Db = typeof import("@/lib/db").db;
  type Created = Awaited<ReturnType<typeof createPostgresTestDb>>;
  let dbs: Db[];
  let clients: Created["clients"];
  let sql: Created["sql"];
  let dispose: () => Promise<void>;
  const on = <T>(i: number, fn: () => Promise<T>) => (route.store as AsyncLocalStorage<unknown>).run(dbs[i], fn);

  beforeAll(async () => {
    const created = await createPostgresTestDb(3);
    dbs = created.dbs as unknown as Db[];
    clients = created.clients;
    sql = created.sql;
    dispose = created.dispose;
    route.fallback = dbs[0];
  }, 120_000);

  afterAll(async () => {
    await dispose?.();
  });

  /*
    The backend pids of the page loads' connections (1 and 2), read while
    they are idle: once one is blocked, a query on it would queue behind it.
  */
  let pageLoadPids: number[] = [];
  async function readPageLoadPids() {
    pageLoadPids = [];
    for (const client of clients.slice(1)) {
      const [row] = await client<{ pid: number }[]>`select pg_backend_pid() as pid`;
      pageLoadPids.push(row.pid);
    }
  }

  /** Lock requests of the page loads' connections waiting right now. */
  async function waiting(): Promise<number> {
    const [row] = await sql<{ n: number }[]>`
      select count(*)::int as n from pg_locks where not granted and pid in ${sql(pageLoadPids)}`;
    return row.n;
  }

  async function until(check: () => Promise<boolean> | boolean, ms = 5_000): Promise<boolean> {
    const deadline = Date.now() + ms;
    while (Date.now() < deadline) {
      if (await check()) return true;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return false;
  }

  it("a grant for the trial's period and one for the paid period, racing across the conversion, grant once", async () => {
    const orgId = `org_${randomUUID().slice(0, 8)}`;
    await dbs[0].insert(organization).values({ id: orgId, name: "W", slug: orgId, createdAt: new Date() });
    const [site] = await dbs[0]
      .insert(websites)
      .values({ organizationId: orgId, url: `https://${orgId}.test`, domain: `${orgId}.test` })
      .returning({ id: websites.id });
    const [plan] = await dbs[0]
      .insert(plans)
      .values({ name: "Grow", tier: `t_${orgId}`, interval: "month", priceCents: 4900, articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 25 })
      .returning({ id: plans.id });
    const [sub] = await dbs[0]
      .insert(subscriptions)
      .values({
        organizationId: orgId,
        websiteId: site.id,
        planId: plan.id,
        status: "trialing",
        currentPeriodStart: d("2026-10-01T18:50:18Z"),
        currentPeriodEnd: d("2026-10-04T18:50:18Z"),
        createdAt: d("2026-10-01T18:50:40Z"),
      })
      .returning({ id: subscriptions.id });
    const trialKey = planGrantKey(sub.id, d("2026-10-01T18:50:18Z"));
    await readPageLoadPids();

    /*
      An open transaction holds the trial period's key, so the page load that
      reads the trial stops at its INSERT - after it has decided to grant.
      That is the window in which, without the per-subscription lock, the
      paid period's page load also decides to grant.
    */
    const held = gate();
    const hold = gate();
    const holder = clients[0]
      .begin(async (tx) => {
        await tx`insert into credit_ledger (organization_id, type, amount, reference_id, idempotency_key)
                 values (${orgId}, 'plan_grant', 25, ${trialKey}, ${trialKey})`;
        held.release();
        await hold.promise;
        throw new Rollback();
      })
      .catch((error: unknown) => {
        if (!(error instanceof Rollback)) throw error;
      });
    await held.promise;

    const trialRead = on(1, () => grantMonthlyCredits(orgId, d("2026-10-04T18:50:10Z")));
    expect(await until(async () => (await waiting()) >= 1)).toBe(true);

    /*
      The conversion webhook commits; a second page load reads the paid
      period. Text, not Date parameters: the columns hold UTC wall-clock
      time, and a Date would be converted to the server's zone.
    */
    await sql`update subscriptions set status = 'active',
                current_period_start = ${"2026-10-04T18:50:18Z"}::timestamp,
                current_period_end = ${"2026-11-04T18:50:18Z"}::timestamp
              where id = ${sub.id}`;
    let paidDone = false;
    const paidRead = on(2, () => grantMonthlyCredits(orgId, d("2026-10-04T18:51:00Z"))).finally(() => {
      paidDone = true;
    });
    // It queues behind the first (the subscription's grant lock), or - with no lock - finishes alone.
    await until(async () => paidDone || (await waiting()) >= 2);

    hold.release();
    await holder;
    const granted = await Promise.all([trialRead, paidRead]);

    expect(granted.sort((a, b) => a - b)).toEqual([0, 25]);
    const rows = await dbs[0]
      .select({ amount: creditLedger.amount, key: creditLedger.idempotencyKey })
      .from(creditLedger)
      .where(eq(creditLedger.organizationId, orgId));
    expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(25);
    expect(rows.map((row) => row.key).sort()).toEqual(
      [trialKey, planGrantKey(sub.id, d("2026-10-04T18:50:18Z"))].sort(),
    );
  });
});
