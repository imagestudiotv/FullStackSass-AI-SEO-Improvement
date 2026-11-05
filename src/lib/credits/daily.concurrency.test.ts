import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createPostgresTestDb, testPostgresUrl } from "@/test/postgres";

/**
 * The daily check-in on REAL Postgres through postgres-js, the production
 * driver, with claims racing on separate connections. Skipped unless
 * TEST_POSTGRES_URL names a disposable server (src/test/postgres.ts).
 *
 * Every moment here is passed in, and no assertion compares a database-default
 * timestamp with one: a local server's zone is not UTC. Streaks over trial rows
 * written before claims set their created_at explicitly, as UTC wall-clock.
 */

const state = vi.hoisted(() => ({ db: null as unknown, pick: null as (() => unknown) | null, sessionOrg: "", writes: 0 }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get((state.pick ? state.pick() : state.db) as object, p) }) }));
// Counts the claims that reached the insert, to show a race really got as far as the unique key.
vi.mock("@/lib/backlinks/credits", async (actual) => {
  const real = await actual<typeof import("@/lib/backlinks/credits")>();
  return {
    ...real,
    recordCredit: (...args: Parameters<typeof real.recordCredit>) => {
      state.writes += 1;
      return real.recordCredit(...args);
    },
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/tenant", () => ({ requireOrg: async () => ({ orgId: state.sessionOrg, userId: "user_1", role: "owner" }) }));

import { claimDailyCredits, dailyGrantKey, readDailyStatus, trialGrantKey } from "@/lib/credits/daily";
import { claimDailyCreditsAction } from "@/lib/credits/daily-actions";
import { creditOverview } from "@/lib/credits/overview";
import { creditLedger, creditSettings, organization, plans, subscriptions, websites } from "@/lib/db/schema";

const available = Boolean(testPostgresUrl());
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe.skipIf(!available)("the daily check-in on real Postgres", () => {
  type Db = typeof import("@/lib/db").db;
  let dbs: Db[];
  let dispose: () => Promise<void>;
  let planId: string;

  beforeAll(async () => {
    const created = await createPostgresTestDb(3);
    dbs = created.dbs as unknown as Db[];
    state.db = dbs[0];
    dispose = created.dispose;
    const [plan] = await dbs[0]
      .insert(plans)
      .values({ name: "Test plan", tier: `tier_${randomUUID().slice(0, 8)}`, priceCents: 1000, articleLimit: 10, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0 })
      .returning({ id: plans.id });
    planId = plan.id;
  }, 400_000);

  afterAll(async () => {
    await dispose?.();
  }, 300_000);

  beforeEach(async () => {
    await dbs[0].delete(creditSettings);
    await dbs[0].insert(creditSettings).values([
      { key: "daily_free", value: 3 },
      { key: "trial_daily_free", value: 15 },
    ]);
  });

  /** A workspace on `status` (null for no subscription); a trial's free articles start at `trialStart`. */
  async function workspace(status: string | null = "active", trialStart?: Date) {
    const orgId = `org_${randomUUID().slice(0, 8)}`;
    await dbs[0].insert(organization).values({ id: orgId, name: "W", slug: orgId, createdAt: new Date() });
    const [site] = await dbs[0]
      .insert(websites)
      .values({ organizationId: orgId, url: `https://${orgId}.test`, domain: `${orgId}.test` })
      .returning({ id: websites.id });
    if (status) {
      await dbs[0].insert(subscriptions).values({
        organizationId: orgId,
        websiteId: site.id,
        planId,
        status,
        currentPeriodStart: trialStart ?? new Date("2026-10-01T00:00:00Z"),
        currentPeriodEnd: new Date((trialStart ?? new Date("2026-10-01T00:00:00Z")).getTime() + 30 * DAY),
      });
    }
    return orgId;
  }

  async function grantsOf(orgId: string) {
    const rows = await dbs[0].select().from(creditLedger).where(eq(creditLedger.organizationId, orgId));
    return rows.filter((row) => row.type === "daily_grant");
  }

  const NOON = new Date("2026-11-05T12:00:00Z");

  it("two tabs claiming at once, each on its own connection, award once", async () => {
    const orgId = await workspace();
    // Every query takes the next connection, so the inserts really race: only the unique key can stop the second.
    let next = 0;
    state.writes = 0;
    state.pick = () => dbs[next++ % dbs.length];
    const race = await Promise.all(Array.from({ length: 9 }, () => claimDailyCredits(orgId, NOON))).finally(() => {
      state.pick = null;
    });
    expect(state.writes).toBeGreaterThan(1);
    expect(race.filter((claim) => claim.outcome === "claimed")).toHaveLength(1);
    expect(race.filter((claim) => claim.outcome === "already_claimed")).toHaveLength(8);
    expect(race.every((claim) => claim.amount === 3 && claim.status.today === 3)).toBe(true);
    expect(await grantsOf(orgId)).toHaveLength(1);
    expect((await creditOverview(orgId, NOON)).balance).toBe(3);
  });

  it("racing through the action itself awards once to the session's workspace", async () => {
    const orgId = await workspace();
    state.sessionOrg = orgId;
    const results = await Promise.all([claimDailyCreditsAction(), claimDailyCreditsAction(), claimDailyCreditsAction()]);
    expect(results.filter((result) => result.outcome === "claimed")).toHaveLength(1);
    expect(await grantsOf(orgId)).toHaveLength(1);
  });

  it("a page load, a status read and the overview award nothing, on any plan", async () => {
    for (const orgId of [await workspace(), await workspace("trialing", new Date(NOON.getTime() - HOUR)), await workspace(null)]) {
      await readDailyStatus(orgId, NOON);
      await Promise.all([creditOverview(orgId, NOON), creditOverview(orgId, NOON)]);
      expect(await grantsOf(orgId)).toHaveLength(0);
      expect((await creditOverview(orgId, NOON)).balance).toBe(0);
    }
  });

  it("reports an open day, then a claimed one, with the next opening at UTC midnight", async () => {
    const orgId = await workspace();
    expect(await readDailyStatus(orgId, NOON)).toMatchObject({ plan: "paid", eligible: true, perDay: 3, today: 0, claimable: true, nextAt: null, streak: 0 });
    const claim = await claimDailyCredits(orgId, NOON);
    expect(claim).toMatchObject({ outcome: "claimed", amount: 3 });
    expect(claim.status).toMatchObject({ today: 3, claimable: false, nextAt: new Date("2026-11-06T00:00:00Z"), streak: 1 });
  });

  it("a grant already made on the day claims go live cannot be claimed twice", async () => {
    const orgId = await workspace();
    // What the old automatic path wrote earlier that day: same key, same note, no reference.
    await dbs[0].insert(creditLedger).values({ organizationId: orgId, type: "daily_grant", amount: 3, note: "Daily credits", idempotencyKey: dailyGrantKey(orgId, NOON) });
    expect(await readDailyStatus(orgId, NOON)).toMatchObject({ today: 3, claimable: false });
    expect(await claimDailyCredits(orgId, NOON)).toMatchObject({ outcome: "already_claimed", amount: 3 });
    expect(await grantsOf(orgId)).toHaveLength(1);
  });

  it("reports the amount the ledger holds, not today's setting, if an administrator changed it", async () => {
    const orgId = await workspace();
    await claimDailyCredits(orgId, NOON);
    await dbs[0].update(creditSettings).set({ value: 9 }).where(eq(creditSettings.key, "daily_free"));
    expect(await claimDailyCredits(orgId, NOON)).toMatchObject({ outcome: "already_claimed", amount: 3 });
  });

  it("the UTC day boundary: a second before midnight is today, midnight is the next day", async () => {
    const orgId = await workspace();
    expect(await claimDailyCredits(orgId, new Date("2026-11-05T23:59:59Z"))).toMatchObject({ outcome: "claimed" });
    expect(await claimDailyCredits(orgId, new Date("2026-11-05T23:59:59.999Z"))).toMatchObject({ outcome: "already_claimed" });
    expect(await claimDailyCredits(orgId, new Date("2026-11-06T00:00:00Z"))).toMatchObject({ outcome: "claimed", amount: 3 });
    expect((await grantsOf(orgId)).map((row) => row.idempotencyKey).sort()).toEqual([
      dailyGrantKey(orgId, new Date("2026-11-05T12:00:00Z")),
      dailyGrantKey(orgId, new Date("2026-11-06T12:00:00Z")),
    ]);
  });

  it("the next day works; missed days are not offered or paid; the streak restarts", async () => {
    const orgId = await workspace();
    const day = (n: number) => new Date(NOON.getTime() + n * DAY);
    expect((await claimDailyCredits(orgId, day(0))).status.streak).toBe(1);
    expect((await claimDailyCredits(orgId, day(1))).status.streak).toBe(2);
    // Still alive while the next day's is open; broken once a day has passed.
    expect((await readDailyStatus(orgId, day(2))).streak).toBe(2);
    expect((await readDailyStatus(orgId, day(4))).streak).toBe(0);
    const back = await claimDailyCredits(orgId, day(4));
    expect(back).toMatchObject({ outcome: "claimed", amount: 3 });
    expect(back.status.streak).toBe(1);
    // Only three days were ever paid, and day 2 and 3 show as missed.
    expect(await grantsOf(orgId)).toHaveLength(3);
    expect((await creditOverview(orgId, day(4))).balance).toBe(9);
    expect(back.status.progress.slice(0, 5)).toEqual([
      { day: 1, when: "past", claimed: true },
      { day: 2, when: "past", claimed: true },
      { day: 3, when: "past", claimed: false },
      { day: 4, when: "past", claimed: false },
      { day: 5, when: "today", claimed: true },
    ]);
  });

  it("the seven days cycle, and day 7 pays what day 1 pays", async () => {
    const orgId = await workspace();
    const day = (n: number) => new Date(NOON.getTime() + n * DAY);
    for (let n = 0; n < 7; n += 1) expect((await claimDailyCredits(orgId, day(n))).amount).toBe(3);
    expect((await readDailyStatus(orgId, day(6))).progress.every((cell) => cell.claimed)).toBe(true);
    const eighth = await readDailyStatus(orgId, day(7));
    expect(eighth.progress[0]).toEqual({ day: 1, when: "today", claimed: false });
    expect(eighth.progress.slice(1).every((cell) => cell.when === "future" && !cell.claimed)).toBe(true);
    // The balance did not reset, and the streak carries on.
    expect((await creditOverview(orgId, day(7))).balance).toBe(21);
    expect(eighth.streak).toBe(7);
  });

  it("not eligible: no plan, a failed payment, or an amount of 0", async () => {
    for (const orgId of [await workspace(null), await workspace("past_due"), await workspace("canceled")]) {
      expect(await readDailyStatus(orgId, NOON)).toMatchObject({ plan: "none", eligible: false, claimable: false, today: 0 });
      expect(await claimDailyCredits(orgId, NOON)).toMatchObject({ outcome: "not_eligible", amount: 0 });
      expect(await grantsOf(orgId)).toHaveLength(0);
    }
    await dbs[0].update(creditSettings).set({ value: 0 }).where(eq(creditSettings.key, "daily_free"));
    const off = await workspace();
    expect(await claimDailyCredits(off, NOON)).toMatchObject({ outcome: "not_eligible" });
    expect(await grantsOf(off)).toHaveLength(0);
  });

  describe("on a trial", () => {
    // Started late in a UTC day: its days are 24 hours from here, not calendar days.
    const START = new Date("2026-11-02T23:00:00Z");
    const at = (hours: number) => new Date(START.getTime() + hours * HOUR);

    it("gets the trial's amount, not 3, keyed by trial day, with its own three days", async () => {
      const orgId = await workspace("trialing", START);
      const before = await readDailyStatus(orgId, at(1));
      expect(before).toMatchObject({ plan: "trial", perDay: 15, claimable: true, trialEndsAt: at(72) });
      expect(before.progress).toEqual([
        { day: 1, when: "today", claimed: false },
        { day: 2, when: "future", claimed: false },
        { day: 3, when: "future", claimed: false },
      ]);
      const claim = await claimDailyCredits(orgId, at(1));
      expect(claim).toMatchObject({ outcome: "claimed", amount: 15 });
      // The next opening is the trial's next 24 hours, not UTC midnight.
      expect(claim.status.nextAt).toEqual(at(24));
      expect((await grantsOf(orgId)).map((row) => row.idempotencyKey)).toEqual([trialGrantKey(orgId, 0)]);
    });

    it("a new UTC day inside the same trial day is not a new claim", async () => {
      const orgId = await workspace("trialing", START);
      await claimDailyCredits(orgId, at(0.5));
      // 23:30 the first night, then 22:00 UTC the next calendar day: one trial day.
      expect(await claimDailyCredits(orgId, at(23))).toMatchObject({ outcome: "already_claimed", amount: 15 });
      expect(await claimDailyCredits(orgId, at(24))).toMatchObject({ outcome: "claimed", amount: 15 });
    });

    it("a missed trial day stays missed; nothing comes on the last day's next", async () => {
      const orgId = await workspace("trialing", START);
      await claimDailyCredits(orgId, at(1));
      const last = await claimDailyCredits(orgId, at(50));
      expect(last).toMatchObject({ outcome: "claimed", amount: 15 });
      expect(last.status.nextAt).toBeNull();
      expect(last.status.progress).toEqual([
        { day: 1, when: "past", claimed: true },
        { day: 2, when: "past", claimed: false },
        { day: 3, when: "today", claimed: true },
      ]);
      expect(await grantsOf(orgId)).toHaveLength(2);
      // Day 4: the allowance has ended, though the free articles go on.
      expect(await claimDailyCredits(orgId, at(73))).toMatchObject({ outcome: "not_eligible" });
      expect(await readDailyStatus(orgId, at(73))).toMatchObject({ plan: "trial_over", eligible: false, trialEndsAt: at(72) });
    });

    it("counts a trial's claims by the UTC day they were made on, recorded on the row", async () => {
      const orgId = await workspace("trialing", START);
      // Nov 2 23:30 UTC, Nov 3 23:30 UTC: trial days 1 and 2, on consecutive calendar days.
      await claimDailyCredits(orgId, at(0.5));
      const second = await claimDailyCredits(orgId, at(24.5));
      expect(second.status.streak).toBe(2);
      expect((await grantsOf(orgId)).map((row) => row.referenceId).sort()).toEqual(["2026-11-02", "2026-11-03"]);
    });

    it("two claims in one calendar day from two trial days count one day of streak", async () => {
      const orgId = await workspace("trialing", START);
      // Nov 3 10:00 UTC (trial day 1) and Nov 3 23:30 UTC (trial day 2).
      await claimDailyCredits(orgId, at(11));
      const second = await claimDailyCredits(orgId, at(24.5));
      expect(second).toMatchObject({ outcome: "claimed", amount: 15 });
      expect(second.status.streak).toBe(1);
    });

    it("falls back to the stored timestamp for a trial row from before claims", async () => {
      const orgId = await workspace("trialing", START);
      await dbs[0].insert(creditLedger).values({
        organizationId: orgId,
        type: "daily_grant",
        amount: 15,
        idempotencyKey: trialGrantKey(orgId, 0),
        createdAt: new Date("2026-11-03T10:00:00Z"),
      });
      expect(await claimDailyCredits(orgId, at(11))).toMatchObject({ outcome: "already_claimed", amount: 15 });
      expect((await readDailyStatus(orgId, at(11))).streak).toBe(1);
    });

    it("once the plan starts, the paid amount applies, with the seven days from the first paid claim", async () => {
      const orgId = await workspace("trialing", START);
      await claimDailyCredits(orgId, at(1));
      await dbs[0].update(subscriptions).set({ status: "active" }).where(eq(subscriptions.organizationId, orgId));
      const paid = await claimDailyCredits(orgId, at(30));
      expect(paid).toMatchObject({ outcome: "claimed", amount: 3 });
      expect(paid.status.progress).toHaveLength(7);
      expect(paid.status.progress[0]).toEqual({ day: 1, when: "today", claimed: true });
      expect((await creditOverview(orgId, at(30))).balance).toBe(18);
    });
  });

  describe("a forged workspace", () => {
    it("is ignored: the action only ever credits the session's own", async () => {
      const own = await workspace();
      const victim = await workspace();
      state.sessionOrg = own;
      // What a hand-made request could send. The action declares no parameters.
      const forge = claimDailyCreditsAction as unknown as (input: unknown) => ReturnType<typeof claimDailyCreditsAction>;
      const result = await forge({ organizationId: victim, orgId: victim });
      expect(result.outcome).toBe("claimed");
      expect(await grantsOf(victim)).toHaveLength(0);
      expect(await grantsOf(own)).toHaveLength(1);
      expect(JSON.stringify(result)).not.toContain(victim);
    });

    it("the action answers a workspace that cannot claim, whatever is sent", async () => {
      const own = await workspace(null);
      const paid = await workspace();
      state.sessionOrg = own;
      const forge = claimDailyCreditsAction as unknown as (input: unknown) => ReturnType<typeof claimDailyCreditsAction>;
      expect(await forge(paid)).toMatchObject({ outcome: "not_eligible" });
      expect(await grantsOf(paid)).toHaveLength(0);
      expect(await grantsOf(own)).toHaveLength(0);
    });
  });
});
