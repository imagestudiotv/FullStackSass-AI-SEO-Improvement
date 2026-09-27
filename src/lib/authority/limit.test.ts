import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { domainMetrics, networkSites, spendReservations, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * AUTHORITY_DAILY_REQUESTS as an operator actually leaves it: usually unset.
 * Unlike collect.test.ts, nothing here stubs the setting unless the test is
 * about a specific value. The provider is a recorded-shape fixture.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));

import { collectDueAuthority, parseDailyRequestLimit } from "@/lib/authority/collect";

let test: TestDb;
const fetchMock = vi.fn();
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(async () => {
  delete process.env.AUTHORITY_DAILY_REQUESTS;
  vi.stubEnv("DATAFORSEO_LOGIN", "fixture-login");
  vi.stubEnv("DATAFORSEO_PASSWORD", "fixture-password-not-real");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  await test.db.delete(domainMetrics);
  await test.db.delete(spendReservations);
  await test.db.delete(networkSites);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  delete process.env.AUTHORITY_DAILY_REQUESTS;
});

function ranks(target: string, rank: number) {
  return new Response(
    JSON.stringify({ status_code: 20000, status_message: "Ok.", tasks: [{ status_code: 20000, status_message: "Ok.", result: [{ items: [{ target, rank }] }] }] }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

async function payingSite() {
  const domain = `l-${randomUUID().slice(0, 6)}.test`;
  const { websiteId } = await seedWebsite(test);
  await test.db.update(websites).set({ domain, url: `https://${domain}` }).where(eq(websites.id, websiteId));
  await test.db.insert(networkSites).values({ websiteId, acceptingLinks: true, monthlyCap: 3 });
  return domain;
}

describe("AUTHORITY_DAILY_REQUESTS", () => {
  it("parses deliberately", () => {
    expect(parseDailyRequestLimit(undefined)).toEqual({ limit: 4, source: "default" });
    expect(parseDailyRequestLimit("")).toEqual({ limit: 4, source: "default" });
    expect(parseDailyRequestLimit("   ")).toEqual({ limit: 4, source: "default" });
    expect(parseDailyRequestLimit("0")).toEqual({ limit: 0, source: "disabled" });
    expect(parseDailyRequestLimit("12")).toEqual({ limit: 12, source: "configured" });
    expect(parseDailyRequestLimit(" 7 ")).toEqual({ limit: 7, source: "configured" });
    for (const bad of ["-1", "2.5", "abc", "1e3", "0x10", "Infinity"]) {
      expect(parseDailyRequestLimit(bad)).toEqual({ limit: 0, source: "invalid" });
    }
  });

  it("unset: the default of four applies and collection reaches the provider", async () => {
    expect(process.env.AUTHORITY_DAILY_REQUESTS).toBeUndefined();
    const domain = await payingSite();
    fetchMock.mockResolvedValueOnce(ranks(domain, 12));
    await expect(collectDueAuthority()).resolves.toMatchObject({ status: "collected", domains: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("explicit zero disables collection - nothing is requested", async () => {
    vi.stubEnv("AUTHORITY_DAILY_REQUESTS", "0");
    await payingSite();
    await expect(collectDueAuthority()).resolves.toEqual({ status: "disabled" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("an invalid value fails safe (disabled) instead of spending", async () => {
    vi.stubEnv("AUTHORITY_DAILY_REQUESTS", "-3");
    await payingSite();
    await expect(collectDueAuthority()).resolves.toEqual({ status: "invalid_limit" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
