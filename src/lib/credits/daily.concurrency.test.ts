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

import { getBalance, recordCredit } from "@/lib/backlinks/credits";
import { claimDailyCredits, dailyGrantKey, readDailyStatus, trialGrantKey } from "@/lib/credits/daily";
import { claimDailyCreditsAction } from "@/lib/credits/daily-actions";
import { creditHistory, creditOverview, creditToday } from "@/lib/credits/overview";
import { walletOf } from "@/lib/credits/spend";
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

  /** A workspace on `status` (null for no subscription); a trial starts at `trialStart` and lasts `days` (30: the legacy free articles). */
  async function workspace(status: string | null = "active", trialStart?: Date, days = 30) {
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
        currentPeriodEnd: new Date((trialStart ?? new Date("2026-10-01T00:00:00Z")).getTime() + days * DAY),
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
      // Every way the balance is read.
      await getBalance(orgId);
      await walletOf(dbs[0], orgId);
      await creditToday(orgId, NOON);
      await creditHistory(orgId, { page: 1, pageSize: 25 });
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

  describe("when the next claim opens", () => {
    it("paid: the UTC day. The next availability shown is the first moment a claim works", async () => {
      const orgId = await workspace();
      const late = new Date("2026-11-05T23:59:59.999Z");
      const { status } = await claimDailyCredits(orgId, late);
      expect(status.nextAt).toEqual(new Date("2026-11-06T00:00:00.000Z"));
      // The same moment read at any time that UTC day.
      expect((await readDailyStatus(orgId, new Date("2026-11-05T00:00:00.000Z"))).nextAt).toEqual(status.nextAt);
      const next = status.nextAt as Date;
      expect(await claimDailyCredits(orgId, new Date(next.getTime() - 1))).toMatchObject({ outcome: "already_claimed" });
      expect(await readDailyStatus(orgId, next)).toMatchObject({ claimable: true, today: 0, nextAt: null });
      const again = await claimDailyCredits(orgId, next);
      expect(again).toMatchObject({ outcome: "claimed" });
      expect(again.status.nextAt).toEqual(new Date("2026-11-07T00:00:00.000Z"));
    });

    it("paid: across a month's end, with no time zone in it", async () => {
      const orgId = await workspace();
      const { status } = await claimDailyCredits(orgId, new Date("2026-11-30T23:30:00Z"));
      expect(status.nextAt).toEqual(new Date("2026-12-01T00:00:00Z"));
    });

    const START = new Date("2026-11-02T23:00:00Z");
    const at = (hours: number) => new Date(START.getTime() + hours * HOUR);

    it("trial: 24 hours from its start, not midnight. The next availability shown is the first moment a claim works", async () => {
      const orgId = await workspace("trialing", START);
      const first = await claimDailyCredits(orgId, at(1));
      // Past UTC midnight is still the first trial day.
      expect(first.status.nextAt).toEqual(at(24));
      expect(await claimDailyCredits(orgId, new Date("2026-11-03T00:00:00Z"))).toMatchObject({ outcome: "already_claimed" });
      expect(await claimDailyCredits(orgId, new Date(at(24).getTime() - 1))).toMatchObject({ outcome: "already_claimed" });
      expect(await readDailyStatus(orgId, at(24))).toMatchObject({ claimable: true, today: 0, nextAt: null });
      const second = await claimDailyCredits(orgId, at(24));
      expect(second).toMatchObject({ outcome: "claimed", amount: 15 });
      expect(second.status.nextAt).toEqual(at(48));
    });

    it("trial: after the last day nothing is promised, and the end is exact", async () => {
      const orgId = await workspace("trialing", START);
      const last = await claimDailyCredits(orgId, at(71));
      expect(last.status).toMatchObject({ nextAt: null, trialEndsAt: at(72) });
      expect(await claimDailyCredits(orgId, new Date(at(72).getTime() - 1))).toMatchObject({ outcome: "already_claimed" });
      expect(await claimDailyCredits(orgId, at(72))).toMatchObject({ outcome: "not_eligible" });
    });
  });

  describe("the day claims go live", () => {
    /** A row exactly as the old automatic path wrote it (ensureDailyCredits): no reference. */
    async function automatic(orgId: string, key: string, amount: number, note: string) {
      await dbs[0].insert(creditLedger).values({ organizationId: orgId, type: "daily_grant", amount, note, idempotencyKey: key });
    }

    it("paid: the automatic grant and a manual claim cannot both award, even racing", async () => {
      const orgId = await workspace();
      await automatic(orgId, dailyGrantKey(orgId, NOON), 3, "Daily credits");
      const claims = await Promise.all([claimDailyCredits(orgId, NOON), claimDailyCredits(orgId, NOON)]);
      expect(claims.map((claim) => claim.outcome)).toEqual(["already_claimed", "already_claimed"]);
      expect(await grantsOf(orgId)).toHaveLength(1);
      expect((await creditOverview(orgId, NOON)).balance).toBe(3);
      // The next UTC day is a new period, and claims normally.
      expect(await claimDailyCredits(orgId, new Date(NOON.getTime() + DAY))).toMatchObject({ outcome: "claimed", amount: 3 });
    });

    it("trial: the automatic row's trial-day key stops a manual claim for that whole trial day", async () => {
      const START = new Date("2026-11-02T23:00:00Z");
      const at = (hours: number) => new Date(START.getTime() + hours * HOUR);
      const orgId = await workspace("trialing", START);
      await automatic(orgId, trialGrantKey(orgId, 0), 15, "Trial credits, day 1 of 3");
      expect(await readDailyStatus(orgId, at(2))).toMatchObject({ today: 15, claimable: false, nextAt: at(24) });
      const claims = await Promise.all([claimDailyCredits(orgId, at(2)), claimDailyCredits(orgId, at(23))]);
      expect(claims.map((claim) => claim.outcome)).toEqual(["already_claimed", "already_claimed"]);
      expect(await grantsOf(orgId)).toHaveLength(1);
      expect((await creditOverview(orgId, at(2))).balance).toBe(15);
      // The next trial day is a new period.
      expect(await claimDailyCredits(orgId, at(24))).toMatchObject({ outcome: "claimed", amount: 15 });
      expect((await grantsOf(orgId)).map((row) => row.idempotencyKey).sort()).toEqual([trialGrantKey(orgId, 0), trialGrantKey(orgId, 1)]);
    });
  });

  it("the other sources of credits: untouched by a claim, and still granted as before", async () => {
    const orgId = await workspace(null);
    const [site] = await dbs[0].select({ id: websites.id }).from(websites).where(eq(websites.organizationId, orgId));
    const [plan] = await dbs[0]
      .insert(plans)
      .values({ name: "With credits", tier: `tier_${randomUUID().slice(0, 8)}`, priceCents: 1000, articleLimit: 10, keywordLimit: 100, siteLimit: 1, monthlyCredits: 250 })
      .returning({ id: plans.id });
    const now = new Date();
    await dbs[0].insert(subscriptions).values({ organizationId: orgId, websiteId: site.id, planId: plan.id, status: "active", currentPeriodStart: new Date(now.getTime() - DAY), currentPeriodEnd: new Date(now.getTime() + 29 * DAY) });
    await recordCredit(orgId, { type: "purchase", amount: 100, idempotencyKey: `purchase:${orgId}` });
    await recordCredit(orgId, { type: "referral", amount: 100, idempotencyKey: `referral:${orgId}` });
    await recordCredit(orgId, { type: "reward", amount: 20, idempotencyKey: `earn:${orgId}` });

    const sorted = async () =>
      (await dbs[0].select().from(creditLedger).where(eq(creditLedger.organizationId, orgId)))
        .filter((row) => row.amount !== 0)
        .map((row) => ({ id: row.id, type: row.type, amount: row.amount, key: row.idempotencyKey }))
        .sort((a, b) => a.type.localeCompare(b.type));

    // Reading still grants the month's plan credits, once however often, and no daily ones.
    await creditOverview(orgId, now);
    await creditOverview(orgId, now);
    const before = await sorted();
    expect(before.map((row) => [row.type, row.amount])).toEqual([
      ["plan_grant", 250],
      ["purchase", 100],
      ["referral", 100],
      ["reward", 20],
    ]);

    const claim = await claimDailyCredits(orgId, now);
    expect(claim).toMatchObject({ outcome: "claimed", amount: 3 });
    const after = await sorted();
    // One row more, of its own type, and every other row exactly as it was.
    expect(after.filter((row) => row.type !== "daily_grant")).toEqual(before);
    expect(after.filter((row) => row.type === "daily_grant").map((row) => row.amount)).toEqual([3]);
    expect(await getBalance(orgId)).toBe(473);

    // A repeated purchase and another read change nothing either: their own keys still guard them.
    expect(await recordCredit(orgId, { type: "purchase", amount: 100, idempotencyKey: `purchase:${orgId}` })).toBe(false);
    await creditOverview(orgId, now);
    expect(await getBalance(orgId)).toBe(473);
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

    it("the 3-day free trial (TRIAL_DAYS, 2026-11-13) gets the same trial credits as the free articles did", async () => {
      const orgId = await workspace("trialing", START, 3);
      expect(await readDailyStatus(orgId, at(1))).toMatchObject({ plan: "trial", perDay: 15, claimable: true, trialEndsAt: at(72) });
      expect(await claimDailyCredits(orgId, at(1))).toMatchObject({ outcome: "claimed", amount: 15 });
      expect(await claimDailyCredits(orgId, at(49))).toMatchObject({ outcome: "claimed", amount: 15 });
      expect((await grantsOf(orgId)).map((row) => row.idempotencyKey).sort()).toEqual([trialGrantKey(orgId, 0), trialGrantKey(orgId, 2)].sort());
      // Once the plan starts it is a paid plan's daily credits.
      await dbs[0].update(subscriptions).set({ status: "active" }).where(eq(subscriptions.organizationId, orgId));
      expect(await readDailyStatus(orgId, at(80))).toMatchObject({ plan: "paid", perDay: 3 });
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
