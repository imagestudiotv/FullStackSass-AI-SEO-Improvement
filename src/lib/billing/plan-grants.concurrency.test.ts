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
 * The unique key makes ONE period idempotent; the first-month rule is about
 * two DIFFERENT keys (the first period and a re-anchored one inside the same
 * month - an interval change), so two page loads either side of the webhook
 * must still grant the month once. Since 2026-10-09 a trial grants nothing,
 * so a trial's conversion is no longer such a race.
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

  it("a grant for the first period and one for an interval change inside its month, racing, grant the month once", async () => {
    const orgId = `org_${randomUUID().slice(0, 8)}`;
    await dbs[0].insert(organization).values({ id: orgId, name: "W", slug: orgId, createdAt: new Date() });
    const [site] = await dbs[0]
      .insert(websites)
      .values({ organizationId: orgId, url: `https://${orgId}.test`, domain: `${orgId}.test` })
      .returning({ id: websites.id });
    const [plan, annual] = await dbs[0]
      .insert(plans)
      .values([
        { name: "Grow", tier: `t_${orgId}`, interval: "month", priceCents: 4900, articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 25 },
        { name: "Grow yearly", tier: `t_${orgId}`, interval: "year", priceCents: 49000, articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 60 },
      ])
      .returning({ id: plans.id });
    const [sub] = await dbs[0]
      .insert(subscriptions)
      .values({
        organizationId: orgId,
        websiteId: site.id,
        planId: plan.id,
        status: "active",
        currentPeriodStart: d("2026-10-01T18:50:18Z"),
        currentPeriodEnd: d("2026-11-01T18:50:18Z"),
        createdAt: d("2026-10-01T18:50:40Z"),
      })
      .returning({ id: subscriptions.id });
    const firstKey = planGrantKey(sub.id, d("2026-10-01T18:50:18Z"));
    await readPageLoadPids();

    /*
      An open transaction holds the first period's key, so the page load that
      reads that period stops at its INSERT - after it has decided to grant.
      That is the window in which, without the per-subscription lock, the
      re-anchored period's page load also decides to grant in full.
    */
    const held = gate();
    const hold = gate();
    const holder = clients[0]
      .begin(async (tx) => {
        await tx`insert into credit_ledger (organization_id, type, amount, reference_id, idempotency_key)
                 values (${orgId}, 'plan_grant', 25, ${firstKey}, ${firstKey})`;
        held.release();
        await hold.promise;
        throw new Rollback();
      })
      .catch((error: unknown) => {
        if (!(error instanceof Rollback)) throw error;
      });
    await held.promise;

    const firstRead = on(1, () => grantMonthlyCredits(orgId, d("2026-10-10T08:59:00Z")));
    expect(await until(async () => (await waiting()) >= 1)).toBe(true);

    /*
      The interval change's webhook commits; a second page load reads the
      re-anchored period. Text, not Date parameters: the columns hold UTC
      wall-clock time, and a Date would be converted to the server's zone.
    */
    await sql`update subscriptions set plan_id = ${annual.id},
                current_period_start = ${"2026-10-10T09:00:00Z"}::timestamp,
                current_period_end = ${"2027-10-10T09:00:00Z"}::timestamp
              where id = ${sub.id}`;
    let changedDone = false;
    const changedRead = on(2, () => grantMonthlyCredits(orgId, d("2026-10-10T09:01:00Z"))).finally(() => {
      changedDone = true;
    });
    // It queues behind the first (the subscription's grant lock), or - with no lock - finishes alone.
    await until(async () => changedDone || (await waiting()) >= 2);

    hold.release();
    await holder;
    const granted = await Promise.all([firstRead, changedRead]);

    // The month holds the new plan's 60: 25, then topped up by 35 - never 25 + 60.
    expect(granted.sort((a, b) => a - b)).toEqual([25, 35]);
    const rows = await dbs[0]
      .select({ amount: creditLedger.amount, key: creditLedger.idempotencyKey })
      .from(creditLedger)
      .where(eq(creditLedger.organizationId, orgId));
    expect(rows.reduce((sum, row) => sum + row.amount, 0)).toBe(60);
    expect(rows.map((row) => row.key).sort()).toEqual(
      [firstKey, planGrantKey(sub.id, d("2026-10-10T09:00:00Z"))].sort(),
    );
  });
});
