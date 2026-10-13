import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestDb, type TestDb } from "@/test/db";

/**
 * Abuse protection for the free tools (lib/tools/public-guard.ts), on PGlite.
 * The cross-connection races are in public-guard.postgres.test.ts.
 *
 * Reproduced first: the public audit's "60 an hour" counted cached successful
 * results, so 70 FAILED attempts in a row all reached the crawler.
 */

const state = vi.hoisted(() => ({ db: null as unknown, broken: false }));
vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    {
      get: (_t, p) => {
        if (state.broken) throw new Error("connection refused (simulated quota-store outage)");
        return Reflect.get(state.db as object, p);
      },
    },
  ),
}));
const crawler = vi.hoisted(() => ({ crawlSite: vi.fn() }));
vi.mock("@/lib/audit/crawler", () => crawler);
vi.mock("@/lib/audit/robots", () => ({ fetchRobotsTxt: vi.fn(async () => null) }));

import { runPublicAudit } from "@/lib/audit/public-audit";
import { clientAddress, visitorIdentity, visitorKey } from "@/lib/visitor-key";

import { guardPublicTool, PUBLIC_TOOL_LIMITS } from "./public-guard";
import { acquireLease } from "@/lib/billing/spend-quota";

let test: TestDb;
beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

let n = 0;
/** A fresh visitor and site for each test, so tests never share buckets. */
function fresh() {
  n += 1;
  return { visitor: `visitor-${n}-${Math.random()}`, site: `site-${n}-${Math.random()}.example` };
}

beforeEach(() => {
  state.broken = false;
  crawler.crawlSite.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("guardPublicTool", () => {
  it("counts every request that reached the network - failed ones too", async () => {
    const { visitor } = fresh();
    const run = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    const limit = PUBLIC_TOOL_LIMITS.audit.perVisitorPerHour;
    for (let i = 0; i < limit; i++) {
      await expect(guardPublicTool({ tool: "audit", site: `${fresh().site}`, visitor, run })).rejects.toThrow("ECONNRESET");
    }
    const refused = await guardPublicTool({ tool: "audit", site: fresh().site, visitor, run });
    expect(refused).toMatchObject({ ok: false, refusal: { kind: "rate_limited" } });
    expect(run).toHaveBeenCalledTimes(limit); // the refused one never reached the network
  });

  it("limits one site across visitors", async () => {
    const { site } = fresh();
    const run = vi.fn(async () => "empty");
    for (let i = 0; i < PUBLIC_TOOL_LIMITS.audit.perSitePerHour; i++) {
      expect((await guardPublicTool({ tool: "audit", site, visitor: fresh().visitor, run })).ok).toBe(true);
    }
    expect(await guardPublicTool({ tool: "audit", site, visitor: fresh().visitor, run })).toMatchObject({
      ok: false,
      refusal: { kind: "rate_limited", message: expect.stringMatching(/That website has been checked several times/) },
    });
  });

  it("serves a result cached by an earlier request without counting", async () => {
    const { site, visitor } = fresh();
    const run = vi.fn(async () => "fetched");
    for (let i = 0; i < 20; i++) {
      const outcome = await guardPublicTool({ tool: "audit", site, visitor, run, beforeRun: async () => "cached" });
      expect(outcome).toEqual({ ok: true, value: "cached" });
    }
    expect(run).not.toHaveBeenCalled();
    // Capacity untouched: the visitor can still run the real thing.
    expect(await guardPublicTool({ tool: "audit", site, visitor, run })).toEqual({ ok: true, value: "fetched" });
  });

  it("checks the same site once at a time", async () => {
    const { site, visitor } = fresh();
    const digest = (await import("node:crypto")).createHash("sha256").update(site).digest("hex").slice(0, 32);
    // Another request (another instance) is crawling this site right now.
    expect(await acquireLease(`public-tool:audit:in-flight:${digest}`, 60)).not.toBeNull();
    const run = vi.fn(async () => "fetched");
    expect(await guardPublicTool({ tool: "audit", site, visitor, run })).toMatchObject({ ok: false, refusal: { kind: "in_progress" } });
    expect(run).not.toHaveBeenCalled();
  });

  it("lets capacity come back once the window has passed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = new Date("2026-10-12T10:00:00Z");
    vi.setSystemTime(start);
    const { visitor } = fresh();
    const run = vi.fn(async () => "ok");
    for (let i = 0; i < PUBLIC_TOOL_LIMITS.audit.perVisitorPerHour; i++) {
      await guardPublicTool({ tool: "audit", site: fresh().site, visitor, run });
    }
    expect((await guardPublicTool({ tool: "audit", site: fresh().site, visitor, run })).ok).toBe(false);
    vi.setSystemTime(new Date(start.getTime() + 61 * 60_000));
    expect((await guardPublicTool({ tool: "audit", site: fresh().site, visitor, run })).ok).toBe(true);
  });

  it("fails closed when the quota store is unreachable", async () => {
    state.broken = true;
    const run = vi.fn(async () => "fetched");
    expect(await guardPublicTool({ tool: "robots", site: fresh().site, visitor: fresh().visitor, run })).toMatchObject({
      ok: false,
      refusal: { kind: "unavailable" },
    });
    expect(run).not.toHaveBeenCalled();
  });
});

describe("the public audit", () => {
  it("70 failed attempts no longer all reach the crawler", async () => {
    crawler.crawlSite.mockRejectedValue(new Error("ENOTFOUND"));
    let refused = 0;
    for (let i = 0; i < 70; i++) {
      // A different visitor and site every time: only the global limit applies.
      const { site, visitor } = fresh();
      const outcome = await runPublicAudit(site, visitor);
      expect(outcome.ok).toBe(false);
      if (!outcome.ok && outcome.error.kind === "rate_limited") refused += 1;
    }
    expect(crawler.crawlSite.mock.calls.length).toBeLessThanOrEqual(PUBLIC_TOOL_LIMITS.audit.globalPerHour);
    expect(refused).toBe(70 - crawler.crawlSite.mock.calls.length);
  });

  it("an empty crawl counts too", async () => {
    // Past the hour the previous test filled the global limit in.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(Date.now() + 2 * 3_600_000));
    crawler.crawlSite.mockResolvedValue({ pages: [] });
    const { visitor } = fresh();
    for (let i = 0; i < PUBLIC_TOOL_LIMITS.audit.perVisitorPerHour; i++) {
      expect(await runPublicAudit(fresh().site, visitor)).toMatchObject({ ok: false, error: { kind: "unreachable" } });
    }
    expect(await runPublicAudit(fresh().site, visitor)).toMatchObject({ ok: false, error: { kind: "rate_limited" } });
  });
});

describe("visitor identity (trusted ingress only)", () => {
  const spoofed = new Headers({ "x-forwarded-for": "198.51.100.7", "x-real-ip": "198.51.100.8" });

  it("ignores client-supplied forwarding headers off Vercel", () => {
    expect(clientAddress(spoofed, {})).toBeNull();
    expect(visitorKey(spoofed, {})).toBe(visitorKey(new Headers(), {}));
  });

  it("uses the edge's headers on Vercel, which overwrites them", () => {
    expect(clientAddress(spoofed, { VERCEL: "1" })).toBe("198.51.100.8");
    expect(clientAddress(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }), { VERCEL: "1" })).toBe("203.0.113.5");
  });

  it("counts an IPv6 visitor per /64, so cycling through their own block does not reset limits", () => {
    expect(visitorIdentity("2001:db8:1:2:aaaa::1")).toBe("2001:db8:1:2::/64");
    expect(visitorIdentity("2001:DB8:1:2:bbbb:cccc:dddd:9")).toBe("2001:db8:1:2::/64");
    expect(visitorIdentity("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(visitorIdentity("2001:db8:1:3::1")).not.toBe(visitorIdentity("2001:db8:1:2::1"));
    expect(visitorIdentity("::ffff:198.51.100.7")).toBe("198.51.100.7");
    expect(visitorIdentity("203.0.113.9")).toBe("203.0.113.9");
    expect(visitorIdentity(null)).toBe("unknown");
    const env = { VERCEL: "1" };
    const keys = new Set(
      Array.from({ length: 50 }, (_, i) => visitorKey(new Headers({ "x-real-ip": `2001:db8:1:2::${(i + 1).toString(16)}` }), env)),
    );
    expect(keys.size).toBe(1);
  });

  it("uses only the configured header behind another proxy, and only a valid address", () => {
    const env = { TRUSTED_CLIENT_IP_HEADER: "CF-Connecting-IP" };
    expect(clientAddress(new Headers({ "cf-connecting-ip": "2001:db8::1", "x-forwarded-for": "198.51.100.9" }), env)).toBe("2001:db8::1");
    expect(clientAddress(new Headers({ "cf-connecting-ip": "not-an-ip", "x-forwarded-for": "198.51.100.9" }), env)).toBeNull();
  });
});
