import { AsyncLocalStorage } from "node:async_hooks";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * The free tools' abuse protection on REAL Postgres, every request on its own
 * connection - as separate server instances would be. PGlite has one
 * connection and cannot show these races.
 *
 *  - concurrent requests from one visitor admit exactly the limit;
 *  - concurrent requests for one site run the fetch once;
 *  - never more fetches at once than the pool has slots.
 */

const route = vi.hoisted(() => ({ store: null as unknown as AsyncLocalStorage<unknown>, fallback: null as unknown }));
vi.mock("@/lib/db", async () => {
  const { AsyncLocalStorage: Als } = await import("node:async_hooks");
  route.store = new Als();
  return {
    db: new Proxy({}, { get: (_t, p) => Reflect.get((route.store.getStore() ?? route.fallback) as object, p) }),
  };
});

import { guardPublicTool, POOL_SLOTS, PUBLIC_TOOL_LIMITS } from "./public-guard";

const available = Boolean(testPostgresUrl());
const CONNECTIONS = 12;

describe.skipIf(!available)("free tool limits on real Postgres", () => {
  type Db = typeof import("@/lib/db").db;
  let dbs: Db[];
  let dispose: () => Promise<void>;
  const on = <T>(i: number, fn: () => Promise<T>) => (route.store as AsyncLocalStorage<unknown>).run(dbs[i % dbs.length], fn);
  const saved = { limits: { ...PUBLIC_TOOL_LIMITS.robots }, slots: { ...POOL_SLOTS } };

  beforeAll(async () => {
    const created = await createPostgresTestDb(CONNECTIONS);
    dbs = created.dbs as unknown as Db[];
    dispose = created.dispose;
    route.fallback = dbs[0];
  }, 180_000);
  afterAll(async () => {
    await dispose?.();
  });
  afterEach(() => {
    Object.assign(PUBLIC_TOOL_LIMITS.robots, saved.limits);
    Object.assign(POOL_SLOTS, saved.slots);
  });

  const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  it("admits exactly the per-visitor limit when its requests arrive together", async () => {
    // Slots out of the way, so only the quota decides.
    Object.assign(POOL_SLOTS, { fetch: 100 });
    Object.assign(PUBLIC_TOOL_LIMITS.robots, { perVisitorPerHour: 4, perSitePerHour: 1000, globalPerHour: 1000 });
    for (let round = 0; round < 3; round++) {
      const visitor = `race-visitor-${round}-${Math.random()}`;
      const run = vi.fn(async () => "fetched");
      const outcomes = await Promise.all(
        Array.from({ length: CONNECTIONS }, (_, i) =>
          on(i, () => guardPublicTool({ tool: "robots", site: `site-${round}-${i}.example`, visitor, run })),
        ),
      );
      expect(outcomes.filter((o) => o.ok)).toHaveLength(4);
      expect(outcomes.filter((o) => !o.ok && o.refusal.kind === "rate_limited")).toHaveLength(CONNECTIONS - 4);
      expect(run).toHaveBeenCalledTimes(4);
    }
  });

  it("fetches a site once when it is asked for many times at once", async () => {
    Object.assign(POOL_SLOTS, { fetch: 100 });
    const site = `same-site-${Math.random()}.example`;
    const run = vi.fn(async () => {
      await pause(300);
      return "fetched";
    });
    const outcomes = await Promise.all(
      Array.from({ length: CONNECTIONS }, (_, i) =>
        on(i, () => guardPublicTool({ tool: "robots", site, visitor: `v-${i}-${Math.random()}`, run })),
      ),
    );
    expect(run).toHaveBeenCalledTimes(1);
    expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
    expect(outcomes.filter((o) => !o.ok && o.refusal.kind === "in_progress")).toHaveLength(CONNECTIONS - 1);
  });

  it("never runs more fetches at once than the pool has slots", async () => {
    Object.assign(POOL_SLOTS, { fetch: 3 });
    let running = 0;
    let peak = 0;
    const run = vi.fn(async () => {
      running += 1;
      peak = Math.max(peak, running);
      await pause(300);
      running -= 1;
      return "fetched";
    });
    const outcomes = await Promise.all(
      Array.from({ length: CONNECTIONS }, (_, i) =>
        on(i, () => guardPublicTool({ tool: "robots", site: `pool-${i}-${Math.random()}.example`, visitor: `pool-v-${i}-${Math.random()}`, run })),
      ),
    );
    expect(peak).toBeLessThanOrEqual(3);
    expect(run.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(outcomes.filter((o) => o.ok)).toHaveLength(run.mock.calls.length);
    expect(outcomes.filter((o) => !o.ok).every((o) => !o.ok && o.refusal.kind === "busy")).toBe(true);
  });
});
