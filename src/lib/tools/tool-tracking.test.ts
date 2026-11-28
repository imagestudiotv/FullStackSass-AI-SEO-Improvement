import { sql } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { creditSettings, spendReservations } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Tracking for every free tool (owner, 2026-11-27): uses by path, distinct
 * visitors, AI cost, sign-ups from a tool and cost per sign-up - all in the
 * existing spend ledger - and the tools' switches and caps.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
  isDatabaseConfigured: () => true,
}));

import { parseToolCookie, toolCookieValue } from "./free-tools";
import {
  captureToolSignup,
  disabledTools,
  readToolSettings,
  recordReportedUse,
  recordToolUse,
  REPORTED_USES_PER_VISITOR_PER_DAY,
  toolReport,
  toolSpendUsd,
} from "./tool-tracking";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  await test.db.delete(spendReservations);
  await test.db.delete(creditSettings);
});

const NOW = new Date("2026-11-27T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);
const haiku = (inputTokens: number, outputTokens: number) => ({ model: "claude-haiku-4-5", inputTokens, outputTokens });
const cookieContext = (value: string) => ({ headers: new Headers({ cookie: `other=1; repget_tool=${encodeURIComponent(value)}` }) });

describe("the report", () => {
  it("adds up uses by path, visitors, AI cost, sign-ups and cost per sign-up, for the period only", async () => {
    await recordToolUse({ tool: "blog-writer", path: "server", visitor: "v1", locale: "en", usage: haiku(1000, 1000), now: NOW });
    await recordToolUse({ tool: "blog-writer", path: "server", visitor: "v1", locale: "en", usage: haiku(1000, 1000), now: daysAgo(1) });
    await recordToolUse({ tool: "blog-writer", path: "on_device", visitor: "v2", locale: "it", now: daysAgo(2) });
    await recordToolUse({ tool: "blog-writer", path: "template", visitor: "v3", locale: "de", now: daysAgo(3) });
    // A paid call with no usable answer: its cost counts, the use does not.
    await recordToolUse({ tool: "blog-writer", path: "server", visitor: "v4", usage: haiku(1000, 0), failed: true, now: daysAgo(1) });
    // Outside a 7-day period.
    await recordToolUse({ tool: "blog-writer", path: "server", visitor: "v5", usage: haiku(1000, 1000), now: daysAgo(20) });
    await recordToolUse({ tool: "robots-checker", path: "server", visitor: "v1", now: daysAgo(1) });
    await captureToolSignup({ id: "user-1" }, cookieContext(toolCookieValue("blog-writer", daysAgo(1))), NOW);
    await captureToolSignup({ id: "user-2" }, cookieContext(toolCookieValue("blog-writer", daysAgo(2))), NOW);

    const rows = await toolReport(daysAgo(7), NOW);
    const blog = rows.find((row) => row.tool === "blog-writer")!;
    expect(blog).toMatchObject({
      uses: { server: 2, on_device: 1, template: 1 },
      totalUses: 4,
      visitors: 4,
      failedCalls: 1,
      signups: 2,
    });
    // Three Haiku calls: 2 x $0.006 + $0.001.
    expect(blog.costUsd).toBeCloseTo(0.013, 6);
    expect(blog.costPerSignupUsd).toBeCloseTo(0.0065, 6);
    expect(blog.todayUsd).toBeCloseTo(0.006, 6);
    expect(rows.find((row) => row.tool === "robots-checker")).toMatchObject({ totalUses: 1, costUsd: 0, signups: 0, costPerSignupUsd: null });
    // Every free tool has a row, used or not.
    expect(rows.find((row) => row.tool === "snippet-preview")).toMatchObject({ totalUses: 0, visitors: 0 });

    expect((await toolReport(daysAgo(30), NOW)).find((row) => row.tool === "blog-writer")!.totalUses).toBe(5);
  });

  it.each(["Pacific/Kiritimati", "America/Los_Angeles", "UTC"])("counts today from midnight UTC whatever the database session's time zone (%s)", async (zone) => {
    await test.db.execute(sql.raw(`set time zone '${zone}'`));
    try {
      // Just after and just before midnight UTC: only the first is today's spend.
      await recordToolUse({ tool: "blog-writer", path: "server", visitor: "v1", usage: haiku(1000, 1000), now: new Date("2026-11-27T00:30:00Z") });
      await recordToolUse({ tool: "blog-writer", path: "server", visitor: "v2", usage: haiku(1000, 0), now: new Date("2026-11-26T23:30:00Z") });
      const blog = (await toolReport(daysAgo(7), NOW)).find((row) => row.tool === "blog-writer")!;
      expect(blog.costUsd).toBeCloseTo(0.007, 6);
      expect(blog.todayUsd).toBeCloseTo(0.006, 6);
      // The cap's own reading agrees.
      expect(await toolSpendUsd("blog-writer", new Date("2026-11-27T00:00:00Z"))).toBeCloseTo(0.006, 6);
    } finally {
      await test.db.execute(sql.raw("set time zone 'UTC'"));
    }
  });

  it("stores the visitor's hash and the cost, never an address", async () => {
    await recordToolUse({ tool: "blog-writer", path: "server", visitor: "0123abcd", locale: "fr", usage: haiku(10, 10), now: NOW });
    const [row] = await test.db.select().from(spendReservations);
    expect(row).toMatchObject({ key: "free-tool:use:blog-writer", operation: "free_tool.use", state: "consumed" });
    expect(JSON.stringify(row.metadata)).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
    expect(await toolSpendUsd("blog-writer", daysAgo(1))).toBeCloseTo(0.00006, 8);
  });
});

describe("uses the browser reports", () => {
  it("are recorded up to a daily limit per visitor, so the endpoint cannot fill the ledger", async () => {
    for (let i = 0; i < REPORTED_USES_PER_VISITOR_PER_DAY; i++) {
      expect(await recordReportedUse({ tool: "blog-writer", path: "template", visitor: "v1", locale: "en" })).toBe(true);
    }
    expect(await recordReportedUse({ tool: "blog-writer", path: "template", visitor: "v1", locale: "en" })).toBe(false);
    expect(await recordReportedUse({ tool: "blog-writer", path: "on_device", visitor: "v2", locale: "en" })).toBe(true);
    const rows = await toolReport(new Date(Date.now() - 86_400_000), new Date());
    expect(rows.find((row) => row.tool === "blog-writer")!.uses).toEqual({ on_device: 1, server: 0, template: REPORTED_USES_PER_VISITOR_PER_DAY });
  });
});

describe("sign-ups from a tool", () => {
  it("count once per new account, for the tool used in the last 30 days", async () => {
    const used = toolCookieValue("social-media-post-generator", daysAgo(3));
    expect(await captureToolSignup({ id: "user-1" }, cookieContext(used), NOW)).toBe("social-media-post-generator");
    // A repeated hook for the same account is one sign-up.
    await captureToolSignup({ id: "user-1" }, cookieContext(used), NOW);
    // Too old, forged, or no cookie: nothing.
    expect(await captureToolSignup({ id: "user-2" }, cookieContext(toolCookieValue("blog-writer", daysAgo(31))), NOW)).toBeNull();
    expect(await captureToolSignup({ id: "user-3" }, cookieContext("audit.1700000000"), NOW)).toBeNull();
    expect(await captureToolSignup({ id: "user-4" }, { headers: new Headers() }, NOW)).toBeNull();
    // Better Auth's own cookie reader, when it has one.
    expect(await captureToolSignup({ id: "user-5" }, { getCookie: () => toolCookieValue("blog-writer", NOW) }, NOW)).toBe("blog-writer");

    const rows = await test.db.select().from(spendReservations);
    expect(rows.map((row) => [row.key, row.subjectId]).sort()).toEqual([
      ["free-tool:signup:blog-writer", "user-5"],
      ["free-tool:signup:social-media-post-generator", "user-1"],
    ]);
  });

  it("reads only well-formed cookies", () => {
    expect(parseToolCookie("blog-writer.1764000000")).toEqual({ tool: "blog-writer", usedAt: new Date(1_764_000_000_000) });
    expect(parseToolCookie("blog-writer")).toBeNull();
    expect(parseToolCookie("blog-writer.abc")).toBeNull();
    expect(parseToolCookie("../admin.1")).toBeNull();
  });
});

describe("the switches and caps", () => {
  it("default to on, with a $1.00 daily cap for the Blog Writer only", async () => {
    const settings = await readToolSettings();
    expect(settings["blog-writer"]).toEqual({ enabled: true, dailyCapCents: 100, capFromSetting: false });
    expect(settings["social-media-post-generator"]).toEqual({ enabled: true, dailyCapCents: null, capFromSetting: false });
    expect(await disabledTools()).toEqual([]);
  });

  it("follow the administrator's settings", async () => {
    await test.db.insert(creditSettings).values([
      { key: "tool_enabled:robots-checker", value: 0 },
      { key: "tool_daily_cap_cents:social-media-post-generator", value: 250 },
      // Not a tool setting: ignored.
      { key: "price:article", value: 3 },
    ]);
    const settings = await readToolSettings();
    expect(settings["robots-checker"].enabled).toBe(false);
    expect(settings["social-media-post-generator"]).toEqual({ enabled: true, dailyCapCents: 250, capFromSetting: true });
    expect(await disabledTools()).toEqual(["robots-checker"]);
  });
});
