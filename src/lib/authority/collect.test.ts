import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { domainMetrics, networkSites, spendReservations, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * The authority adapter (DataForSEO Backlinks API, bulk_ranks) against
 * recorded-shape fixtures - no real request is made. Collection is spend-
 * reserved, entitlement-filtered, deduplicated and backs off; reading never
 * calls the provider.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));

import { collectDueAuthority, trackedDomains } from "@/lib/authority/collect";
import { AUTHORITY_METRIC, readAuthority } from "@/lib/authority/metric";

let test: TestDb;
const fetchMock = vi.fn();
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(async () => {
  vi.stubEnv("DATAFORSEO_LOGIN", "fixture-login");
  vi.stubEnv("DATAFORSEO_PASSWORD", "fixture-password-not-real");
  vi.stubEnv("AUTHORITY_DAILY_REQUESTS", "3");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  await test.db.delete(domainMetrics);
  await test.db.delete(spendReservations);
  await test.db.delete(networkSites);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/** The shape DataForSEO documents for POST /v3/backlinks/bulk_ranks/live. */
function ranksResponse(items: Array<{ target: string; rank: number }>) {
  return new Response(
    JSON.stringify({
      version: "0.1.20250101",
      status_code: 20000,
      status_message: "Ok.",
      time: "0.2 sec.",
      cost: 0.02,
      tasks_count: 1,
      tasks_error: 0,
      tasks: [
        {
          id: "09271200-1535-0402-0000-4f2d4a6b1a2c",
          status_code: 20000,
          status_message: "Ok.",
          time: "0.1 sec.",
          cost: 0.02,
          result_count: 1,
          path: ["v3", "backlinks", "bulk_ranks", "live"],
          data: { api: "backlinks", function: "bulk_ranks", rank_scale: "one_hundred" },
          result: [{ total_count: items.length, items_count: items.length, items }],
        },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

/** What an account WITHOUT the Backlinks API subscription gets back. */
function noAccessResponse() {
  return new Response(
    JSON.stringify({
      status_code: 20000,
      status_message: "Ok.",
      tasks: [
        {
          status_code: 40204,
          status_message: "Access denied. Visit Plans and Subscriptions to activate your subscription and get access to this API: https://app.dataforseo.com/backlinks-subscription",
          result: null,
        },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

/** A paying Partner Network website. */
async function paying(domain: string) {
  const { websiteId } = await seedWebsite(test);
  await test.db.update(websites).set({ domain, url: `https://${domain}` }).where(eq(websites.id, websiteId));
  await test.db.insert(networkSites).values({ websiteId, acceptingLinks: true, monthlyCap: 3 });
  return websiteId;
}

describe("collecting DataForSEO Rank", () => {
  it("stores the provider's value with its metric, scale and time, in one request for many domains", async () => {
    const a = `a-${randomUUID().slice(0, 6)}.test`;
    const b = `www.b-${randomUUID().slice(0, 6)}.test`;
    await paying(a);
    await paying(b);
    const bare = b.replace(/^www\./, "");
    fetchMock.mockResolvedValueOnce(ranksResponse([{ target: a, rank: 47 }, { target: bare, rank: 0 }]));

    const outcome = await collectDueAuthority();
    expect(outcome).toMatchObject({ status: "collected", domains: 2, withValue: 2 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toBe("https://api.dataforseo.com/v3/backlinks/bulk_ranks/live");
    const [task] = JSON.parse(init.body);
    expect(task.rank_scale).toBe("one_hundred");
    expect(task.targets.sort()).toEqual([a, bare].sort());

    const readings = await readAuthority([a, b]);
    expect(readings.get(a)).toMatchObject({ status: "ok", value: 47, scaleMax: 100, stale: false });
    // Zero is DataForSEO's answer "no backlinks detected" - a value, shown as 0.
    expect(readings.get(bare)).toMatchObject({ status: "ok", value: 0 });
    const [row] = await test.db.select().from(domainMetrics).where(eq(domainMetrics.domain, a));
    expect(row).toMatchObject({ provider: AUTHORITY_METRIC.provider, metric: AUTHORITY_METRIC.metric, scaleMax: 100 });
    expect(row.observedAt).toBeInstanceOf(Date);

    // Not due again for a month: a second run spends nothing.
    expect(await collectDueAuthority()).toEqual({ status: "nothing_due" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("an account without the Backlinks API: every domain says so, nothing is charged, no retry for a week", async () => {
    const a = `a-${randomUUID().slice(0, 6)}.test`;
    await paying(a);
    fetchMock.mockResolvedValueOnce(noAccessResponse());
    expect(await collectDueAuthority()).toMatchObject({ status: "no_access", domains: 1 });
    expect((await readAuthority([a])).get(a)).toMatchObject({ status: "no_access", value: null });
    // The refused request handed its spend reservation back.
    const reservations = await test.db.select().from(spendReservations);
    expect(reservations.map((r) => r.state)).toEqual(["released"]);
    expect(await collectDueAuthority()).toEqual({ status: "nothing_due" });
  });

  it("a timeout is treated as spent (it may have been billed), keeps any earlier value, and backs off", async () => {
    const a = `a-${randomUUID().slice(0, 6)}.test`;
    await paying(a);
    fetchMock.mockResolvedValueOnce(ranksResponse([{ target: a, rank: 30 }]));
    await collectDueAuthority();
    // Force it due again, then fail.
    await test.db.update(domainMetrics).set({ nextAttemptAt: new Date(0), observedAt: new Date(Date.now() - 40 * 86_400_000) }).where(eq(domainMetrics.domain, a));
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("aborted"), { name: "AbortError" }));
    expect(await collectDueAuthority()).toMatchObject({ status: "failed" });
    const reading = (await readAuthority([a])).get(a);
    expect(reading).toMatchObject({ status: "ok", value: 30, stale: true });
    // The reason is kept for operators, never put in a customer's reading.
    expect(reading).not.toHaveProperty("lastError");
    const [stored] = await test.db.select().from(domainMetrics).where(eq(domainMetrics.domain, a));
    expect(stored.error).toMatch(/timed out/);
    const states = (await test.db.select().from(spendReservations)).map((r) => r.state).sort();
    expect(states).toEqual(["consumed", "consumed"]);
  });

  it("stops at the daily request cap", async () => {
    vi.stubEnv("AUTHORITY_DAILY_REQUESTS", "1");
    const a = `a-${randomUUID().slice(0, 6)}.test`;
    await paying(a);
    fetchMock.mockResolvedValue(ranksResponse([{ target: a, rank: 5 }]));
    await collectDueAuthority();
    await test.db.update(domainMetrics).set({ nextAttemptAt: new Date(0) });
    expect(await collectDueAuthority()).toEqual({ status: "quota_reached" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("tracks only paying network websites and the sites linking to them, each once", async () => {
    const a = `a-${randomUUID().slice(0, 6)}.test`;
    await paying(a);
    await paying(`www.${a}`);
    const { websiteId: unpaid } = await seedWebsite(test, { status: null });
    await test.db.update(websites).set({ domain: "unpaid.test" }).where(eq(websites.id, unpaid));
    await test.db.insert(networkSites).values({ websiteId: unpaid, acceptingLinks: true, monthlyCap: 3 });
    const domains = await trackedDomains();
    expect(domains.filter((d) => d === a)).toHaveLength(1);
    expect(domains).not.toContain("unpaid.test");
  });

  it("does nothing without credentials, and reading never calls the provider", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "");
    const a = `a-${randomUUID().slice(0, 6)}.test`;
    await paying(a);
    expect(await collectDueAuthority()).toEqual({ status: "not_configured" });
    expect((await readAuthority([a])).get(a)).toMatchObject({ status: "not_configured", value: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
