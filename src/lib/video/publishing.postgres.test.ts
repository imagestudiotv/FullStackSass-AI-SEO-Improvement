import { AsyncLocalStorage } from "node:async_hooks";

import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * Publishing's races on REAL Postgres, each contender on its own connection:
 * X's monthly spending limit (one conditional UPDATE per reservation) and the
 * automatic posting slots (unique website + hour, frequency counted under the
 * website's lock).
 */

const route = vi.hoisted(() => ({ store: null as unknown as AsyncLocalStorage<unknown>, fallback: null as unknown }));
vi.mock("@/lib/db", async () => {
  const { AsyncLocalStorage: Als } = await import("node:async_hooks");
  route.store = new Als();
  return {
    db: new Proxy({}, { get: (_t, p) => Reflect.get((route.store.getStore() ?? route.fallback) as object, p) }),
  };
});

import { organization } from "@/lib/db/auth-tables";
import { providerSpend, providerSpendEvents, videoIdeas, videoScheduleSlots, websites } from "@/lib/db/schema";

import { autoPublishTime, releaseScheduleSlot } from "./schedule";
import { chargeXSpend, releaseXSpend, reserveXSpend, spendPeriod, X_SPEND_SCOPE, xVideoStatus } from "./x-spend";

const available = Boolean(testPostgresUrl());
const NOW = new Date("2026-11-16T05:00:00Z"); // a Monday

describe.skipIf(!available)("publishing on real Postgres", () => {
  type Db = typeof import("@/lib/db").db;
  let dbs: Db[];
  let dispose: () => Promise<void>;
  const on = <T>(i: number, fn: () => Promise<T>) => (route.store as AsyncLocalStorage<unknown>).run(dbs[i % dbs.length], fn);

  beforeAll(async () => {
    const created = await createPostgresTestDb(6);
    dbs = created.dbs as unknown as Db[];
    dispose = created.dispose;
    route.fallback = dbs[0];
  }, 300_000);
  afterAll(async () => {
    await dispose?.();
  }, 180_000);
  afterEach(() => vi.unstubAllEnvs());

  async function website(country = "Ireland") {
    const orgId = `org_${crypto.randomUUID()}`;
    await dbs[0].insert(organization).values({ id: orgId, name: "Test", slug: orgId, createdAt: new Date() });
    const [site] = await dbs[0]
      .insert(websites)
      .values({ organizationId: orgId, url: `https://${orgId}.example`, domain: `${orgId}.example`, status: "ready", country })
      .returning({ id: websites.id });
    return site.id;
  }

  async function ideas(websiteId: string, count: number, values: Partial<typeof videoIdeas.$inferInsert> = {}) {
    return dbs[0]
      .insert(videoIdeas)
      .values(
        Array.from({ length: count }, (_, i) => ({
          websiteId,
          day: "2026-11-16",
          style: "bold",
          language: "en",
          title: `Idea ${i}`,
          script: {},
          caption: "c",
          status: "making",
          ...values,
        })),
      )
      .returning();
  }

  describe("X's spending limit", () => {
    const configure = (limit: string, cost = "0.02") => {
      vi.stubEnv("X_VIDEO_POSTS_ENABLED", "1");
      vi.stubEnv("X_VIDEO_MONTHLY_LIMIT_USD", limit);
      vi.stubEnv("X_VIDEO_COST_PER_POST_USD", cost);
    };
    const month = async () => {
      await dbs[0].delete(providerSpendEvents);
      await dbs[0].delete(providerSpend);
    };

    it("never lets simultaneous posts go over the month's limit", async () => {
      await month();
      configure("0.10"); // room for exactly five posts at 0.02
      const results = await Promise.all(
        Array.from({ length: 24 }, (_, i) => on(i, () => reserveXSpend({ key: `x:race-${i}:1`, websiteId: null, ideaId: null, now: NOW }))),
      );
      expect(results.filter((r) => r.ok)).toHaveLength(5);
      expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.reason === "limit_reached")).toBe(true);
      const [row] = await dbs[0].select().from(providerSpend).where(eq(providerSpend.period, spendPeriod(NOW)));
      expect(Number(row.reservedUsd) + Number(row.spentUsd)).toBeCloseTo(0.1, 6);
      expect(await dbs[0].select().from(providerSpendEvents)).toHaveLength(5);
    });

    it("reserves once per key, however many times a retried step asks at once", async () => {
      await month();
      configure("1.00");
      const results = await Promise.all(Array.from({ length: 6 }, (_, i) => on(i, () => reserveXSpend({ key: "x:same:1", websiteId: null, ideaId: null, now: NOW }))));
      expect(results.every((r) => r.ok)).toBe(true);
      expect(results.filter((r) => r.ok && !r.reused)).toHaveLength(1);
      const [row] = await dbs[0].select().from(providerSpend);
      expect(Number(row.reservedUsd)).toBeCloseTo(0.02, 6);
    });

    it("charges once, releases once, and a release gives the room back", async () => {
      await month();
      configure("0.04");
      expect((await reserveXSpend({ key: "x:a:1", websiteId: null, ideaId: null, now: NOW })).ok).toBe(true);
      expect((await reserveXSpend({ key: "x:b:1", websiteId: null, ideaId: null, now: NOW })).ok).toBe(true);
      expect(await reserveXSpend({ key: "x:c:1", websiteId: null, ideaId: null, now: NOW })).toEqual({ ok: false, reason: "limit_reached" });

      const charged = await Promise.all([0, 1, 2].map((i) => on(i, () => chargeXSpend("x:a:1"))));
      expect(charged.filter((amount) => amount !== null)).toEqual([0.02]);
      const released = await Promise.all([0, 1, 2].map((i) => on(i, () => releaseXSpend("x:b:1", "refused"))));
      expect(released.filter((amount) => amount !== null)).toEqual([0.02]);
      // A charged reservation is never released afterwards.
      expect(await releaseXSpend("x:a:1")).toBeNull();

      const [row] = await dbs[0].select().from(providerSpend);
      expect(Number(row.spentUsd)).toBeCloseTo(0.02, 6);
      expect(Number(row.reservedUsd)).toBeCloseTo(0, 6);
      expect((await xVideoStatus(NOW)).available).toBe(true);
      // The released key can be reserved again by the same attempt; the room it gave back is used.
      expect(await reserveXSpend({ key: "x:b:1", websiteId: null, ideaId: null, now: NOW })).toMatchObject({ ok: true, reused: false });
      expect(await reserveXSpend({ key: "x:c:1", websiteId: null, ideaId: null, now: NOW })).toEqual({ ok: false, reason: "limit_reached" });
      expect(await xVideoStatus(NOW)).toMatchObject({ available: false, reason: "limit_reached" });
    });

    it("is closed without the flag or a positive limit, and nothing is written", async () => {
      await month();
      vi.stubEnv("X_VIDEO_POSTS_ENABLED", "");
      vi.stubEnv("X_VIDEO_MONTHLY_LIMIT_USD", "50");
      expect(await reserveXSpend({ key: "x:off:1", websiteId: null, ideaId: null, now: NOW })).toEqual({ ok: false, reason: "disabled" });
      configure("0");
      expect(await reserveXSpend({ key: "x:off:1", websiteId: null, ideaId: null, now: NOW })).toEqual({ ok: false, reason: "no_limit" });
      expect(await dbs[0].select().from(providerSpend).where(eq(providerSpend.scope, X_SPEND_SCOPE))).toHaveLength(0);
    });
  });

  describe("automatic posting slots", () => {
    it("never gives two simultaneous videos the same hour, within the frequency", async () => {
      const websiteId = await website();
      const made = await ideas(websiteId, 8);
      const settings = { publishMode: "auto" as const, frequency: "2_day" as const };
      const times = await Promise.all(
        made.map((idea, i) => on(i, () => autoPublishTime({ id: idea.id, websiteId, reviewStatus: "none", reviewedHash: null }, settings, NOW))),
      );
      const hours = times.map((t) => t!.toISOString());
      expect(new Set(hours).size).toBe(8);
      // Two a day at most (Ireland: the best hours 12:07, 18:07, 20:07 UTC).
      const perDay = new Map<string, number>();
      for (const hour of hours) perDay.set(hour.slice(0, 10), (perDay.get(hour.slice(0, 10)) ?? 0) + 1);
      expect(Math.max(...perDay.values())).toBe(2);
      expect([...perDay.keys()].sort()).toEqual(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"]);
      expect(await dbs[0].select().from(videoScheduleSlots).where(eq(videoScheduleSlots.websiteId, websiteId))).toHaveLength(8);
    });

    it("keeps three a week on separate days, and a released slot is free again", async () => {
      const websiteId = await website();
      const made = await ideas(websiteId, 4);
      const settings = { publishMode: "auto" as const, frequency: "3_week" as const };
      const times: Date[] = [];
      for (const idea of made) times.push((await autoPublishTime({ id: idea.id, websiteId, reviewStatus: "none", reviewedHash: null }, settings, NOW))!);
      // Mon, Wed, Fri of this week; the fourth goes to next week.
      expect(times.map((t) => t.toISOString().slice(0, 10))).toEqual(["2026-11-16", "2026-11-18", "2026-11-20", "2026-11-23"]);
      await releaseScheduleSlot(made[1].id);
      const again = await autoPublishTime({ id: made[1].id, websiteId, reviewStatus: "none", reviewedHash: null }, settings, NOW);
      expect(again?.toISOString().slice(0, 10)).toBe("2026-11-18");
    });

    it("holds a video that needs review, and never schedules in manual or draft mode", async () => {
      const websiteId = await website();
      const [idea] = await ideas(websiteId, 1);
      const held = await autoPublishTime({ id: idea.id, websiteId, reviewStatus: "required", reviewedHash: null }, { publishMode: "auto", frequency: "1_day" }, NOW);
      expect(held).toBeNull();
      for (const publishMode of ["manual", "draft"] as const) {
        expect(await autoPublishTime({ id: idea.id, websiteId, reviewStatus: "none", reviewedHash: null }, { publishMode, frequency: "1_day" }, NOW)).toBeNull();
      }
      expect(await dbs[0].select().from(videoScheduleSlots).where(eq(videoScheduleSlots.websiteId, websiteId))).toHaveLength(0);
    });
  });
});
