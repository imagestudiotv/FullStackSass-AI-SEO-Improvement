import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { backlinkRequests, creditLedger, creditSettings, creditSpends, subscriptions } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * Credits (client, 2026-10-26): spending them on an action - nothing when it
 * is not enough, back again when the action could not be done - and the
 * daily credits a paying workspace is given on each day it uses RepGet, which
 * never expire.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));

import { recordCredit } from "@/lib/backlinks/credits";
import { ensureDailyCredits } from "@/lib/credits/daily";
import { creditHistory, creditOverview } from "@/lib/credits/overview";
import { readCreditSettings } from "@/lib/credits/prices";
import { chargeCredits, refundSpend, spendCredits, type SpendInput } from "@/lib/credits/spend";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

const NOON = new Date("2026-10-26T12:00:00Z");
const EVENING = new Date("2026-10-26T23:30:00Z");
const NEXT_DAY = new Date("2026-10-27T09:00:00Z");
const A_WEEK_LATER = new Date("2026-11-02T09:00:00Z");

async function settings(values: { dailyFree?: number; trialDailyFree?: number; audit?: number }) {
  await test.db.delete(creditSettings);
  const rows = [
    ...(values.dailyFree !== undefined ? [{ key: "daily_free", value: values.dailyFree }] : []),
    ...(values.trialDailyFree !== undefined ? [{ key: "trial_daily_free", value: values.trialDailyFree }] : []),
    ...(values.audit !== undefined ? [{ key: "price:audit_rerun", value: values.audit }] : []),
  ];
  if (rows.length) await test.db.insert(creditSettings).values(rows);
}

async function give(orgId: string, amount: number) {
  await recordCredit(orgId, { type: "adjustment", amount, note: "test" });
}

function spend(input: Partial<SpendInput> & { organizationId: string }, now = NOON) {
  return test.db.transaction((tx) =>
    spendCredits(tx, { action: "audit_rerun", key: `test:${randomUUID()}`, ...input }, now),
  );
}

async function ledgerOf(orgId: string) {
  return test.db.select().from(creditLedger).where(eq(creditLedger.organizationId, orgId));
}

describe("prices", () => {
  it("are free until an administrator sets them", async () => {
    await test.db.delete(creditSettings);
    const read = await readCreditSettings();
    expect(read.dailyFree).toBe(0);
    expect(read.prices.audit_rerun).toBe(0);
  });

  it("a free action spends and records nothing", async () => {
    await settings({});
    const { orgId } = await seedWebsite(test);
    expect(await spend({ organizationId: orgId })).toEqual({ ok: true, spendId: null, credits: 0 });
    expect(await test.db.select().from(creditSpends).where(eq(creditSpends.organizationId, orgId))).toHaveLength(0);
    expect(await ledgerOf(orgId)).toHaveLength(0);
  });
});

describe("spending", () => {
  it("takes the price from the balance", async () => {
    await settings({ audit: 5 });
    const { orgId, websiteId } = await seedWebsite(test);
    await give(orgId, 12);
    const result = await spend({ organizationId: orgId, websiteId });
    expect(result).toMatchObject({ ok: true, credits: 5 });
    expect((await creditOverview(orgId, NOON)).available).toBe(7);
    const spendRow = (await ledgerOf(orgId)).find((row) => row.type === "spend");
    expect(spendRow).toMatchObject({ amount: -5, note: "Website check run again" });
  });

  it("refuses, and writes nothing, when the balance cannot cover it", async () => {
    await settings({ audit: 5 });
    const { orgId } = await seedWebsite(test);
    await give(orgId, 4);
    expect(await spend({ organizationId: orgId })).toEqual({ ok: false, price: 5, available: 4 });
    expect(await test.db.select().from(creditSpends).where(eq(creditSpends.organizationId, orgId))).toHaveLength(0);
    expect((await ledgerOf(orgId)).filter((row) => row.type === "spend")).toHaveLength(0);
  });

  it("charges a repeated key once", async () => {
    await settings({ audit: 3 });
    const { orgId } = await seedWebsite(test);
    await give(orgId, 10);
    const key = `audit:${randomUUID()}`;
    const first = await spend({ organizationId: orgId, key });
    const again = await spend({ organizationId: orgId, key });
    expect(again).toEqual(first);
    expect((await creditOverview(orgId, NOON)).available).toBe(7);
  });

  it("never spends what backlinks hold", async () => {
    await settings({ audit: 5 });
    const { orgId, websiteId } = await seedWebsite(test);
    await give(orgId, 8);
    await test.db.insert(backlinkRequests).values({ websiteId, targetUrl: "https://x.example/", status: "matched", creditsReserved: 4 });
    expect(await spend({ organizationId: orgId })).toEqual({ ok: false, price: 5, available: 4 });
  });

  it("lets only one of two simultaneous spends through on the same credits", async () => {
    await settings({ audit: 5 });
    const { orgId } = await seedWebsite(test);
    await give(orgId, 6);
    const results = await Promise.all([spend({ organizationId: orgId }), spend({ organizationId: orgId })]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect((await creditOverview(orgId, NOON)).balance).toBe(1);
  });

  it("charges a service at its own price, under the action it names", async () => {
    const { orgId } = await seedWebsite(test);
    await give(orgId, 300);
    const result = await test.db.transaction((tx) =>
      chargeCredits(tx, {
        organizationId: orgId,
        action: "addon:usa_local_citations",
        credits: 250,
        key: `addon:${randomUUID()}`,
        note: "Bought Top 250 live USA Local Citations",
      }),
    );
    expect(result).toMatchObject({ ok: true, credits: 250 });
    expect((await ledgerOf(orgId)).find((row) => row.type === "spend")).toMatchObject({
      amount: -250,
      note: "Bought Top 250 live USA Local Citations",
    });
  });

  it("refuses a charge that is not a whole number above 0", async () => {
    const { orgId } = await seedWebsite(test);
    for (const credits of [0, -5, 2.5]) {
      await expect(
        test.db.transaction((tx) =>
          chargeCredits(tx, { organizationId: orgId, action: "x", credits, key: `x:${randomUUID()}`, note: "x" }),
        ),
      ).rejects.toThrow("whole number of credits above 0");
    }
  });
});

describe("daily credits", () => {
  it("are given once on each day the workspace uses RepGet, and never expire", async () => {
    await settings({ dailyFree: 3 });
    const { orgId } = await seedWebsite(test);
    expect((await creditOverview(orgId, NOON)).daily).toEqual({ eligible: true, perDay: 3, today: 3, trialEndsAt: null });
    // The same day, however many pages: once.
    await creditOverview(orgId, EVENING);
    await Promise.all([ensureDailyCredits(orgId, EVENING), ensureDailyCredits(orgId, EVENING)]);
    expect((await creditOverview(orgId, EVENING)).balance).toBe(3);
    // The next day adds to them; nothing lapsed overnight.
    expect((await creditOverview(orgId, NEXT_DAY)).balance).toBe(6);
    // A week without a visit gives nothing for the days missed - only the day of the visit.
    expect((await creditOverview(orgId, A_WEEK_LATER)).balance).toBe(9);
    const grants = (await ledgerOf(orgId)).filter((row) => row.type === "daily_grant");
    expect(grants.map((row) => row.idempotencyKey).sort()).toEqual([
      `daily:${orgId}:2026-10-26`,
      `daily:${orgId}:2026-10-27`,
      `daily:${orgId}:2026-11-02`,
    ]);
  });

  it("are spent like any other credit", async () => {
    await settings({ dailyFree: 3, audit: 5 });
    const { orgId } = await seedWebsite(test);
    await creditOverview(orgId, NOON);
    await creditOverview(orgId, NEXT_DAY);
    expect(await spend({ organizationId: orgId }, NEXT_DAY)).toMatchObject({ ok: true, credits: 5 });
    expect((await creditOverview(orgId, NEXT_DAY)).available).toBe(1);
  });

  it("are only for a paid plan", async () => {
    await settings({ dailyFree: 3 });
    for (const status of ["trialing", "past_due", null]) {
      const { orgId } = await seedWebsite(test, { status });
      expect((await creditOverview(orgId, NOON)).daily).toEqual({ eligible: false, perDay: 3, today: 0, trialEndsAt: null });
      expect((await ledgerOf(orgId)).filter((row) => row.type === "daily_grant")).toHaveLength(0);
    }
  });

  it("are off at 0", async () => {
    await settings({ dailyFree: 0 });
    const { orgId } = await seedWebsite(test);
    expect((await creditOverview(orgId, NOON)).daily).toEqual({ eligible: true, perDay: 0, today: 0, trialEndsAt: null });
    expect(await ledgerOf(orgId)).toHaveLength(0);
  });

  /*
    A trial (client, 2026-10-27): 15 a day, on its first 3 days only - "the
    4th day the free credit is not given". Its 30-day free articles go on.
  */
  describe("on a trial", () => {
    const HOUR = 60 * 60 * 1000;
    // A trial started late in a UTC day: its days are 24 hours from here, not calendar days.
    const START = new Date("2026-10-26T23:00:00Z");
    const at = (hours: number) => new Date(START.getTime() + hours * HOUR);

    async function seedTrial() {
      const seeded = await seedWebsite(test, { status: "trialing" });
      await test.db
        .update(subscriptions)
        .set({ currentPeriodStart: START, currentPeriodEnd: new Date(START.getTime() + 30 * 24 * HOUR) })
        .where(eq(subscriptions.organizationId, seeded.orgId));
      return seeded;
    }

    it("are the trial's amount on each of its first 3 days, then stop", async () => {
      await settings({ dailyFree: 3, trialDailyFree: 15 });
      const { orgId } = await seedTrial();
      const endsAt = at(72);

      expect((await creditOverview(orgId, at(1))).daily).toEqual({ eligible: true, perDay: 15, today: 15, trialEndsAt: endsAt });
      // A new UTC day, but the same first 24 hours: nothing more.
      expect((await creditOverview(orgId, at(20))).balance).toBe(15);
      expect((await creditOverview(orgId, at(25))).balance).toBe(30);
      expect((await creditOverview(orgId, at(71))).balance).toBe(45);
      // Day 4: none, and the page is told they have ended.
      const dayFour = await creditOverview(orgId, at(73));
      expect(dayFour.balance).toBe(45);
      expect(dayFour.daily).toEqual({ eligible: false, perDay: 3, today: 0, trialEndsAt: endsAt });
      expect((await creditOverview(orgId, at(24 * 10))).balance).toBe(45);

      const grants = (await ledgerOf(orgId)).filter((row) => row.type === "daily_grant");
      expect(grants.map((row) => row.idempotencyKey).sort()).toEqual([
        `daily:${orgId}:trial-1`,
        `daily:${orgId}:trial-2`,
        `daily:${orgId}:trial-3`,
      ]);
    });

    it("grant once however many pages open at once", async () => {
      await settings({ trialDailyFree: 15 });
      const { orgId } = await seedTrial();
      await Promise.all([ensureDailyCredits(orgId, at(2)), ensureDailyCredits(orgId, at(2)), ensureDailyCredits(orgId, at(3))]);
      expect((await creditOverview(orgId, at(4))).balance).toBe(15);
    });

    it("give the paid plan's amount once the plan starts", async () => {
      await settings({ dailyFree: 3, trialDailyFree: 15 });
      const { orgId } = await seedTrial();
      await creditOverview(orgId, at(1));
      await test.db.update(subscriptions).set({ status: "active" }).where(eq(subscriptions.organizationId, orgId));
      expect((await creditOverview(orgId, at(30))).daily).toEqual({ eligible: true, perDay: 3, today: 3, trialEndsAt: null });
      expect((await creditOverview(orgId, at(30))).balance).toBe(18);
    });

    it("are off at 0, and say nothing about the trial", async () => {
      await settings({ dailyFree: 3, trialDailyFree: 0 });
      const { orgId } = await seedTrial();
      expect((await creditOverview(orgId, at(1))).daily).toEqual({ eligible: false, perDay: 3, today: 0, trialEndsAt: null });
      expect(await ledgerOf(orgId)).toHaveLength(0);
    });
  });

  it("show in the history", async () => {
    await settings({ dailyFree: 3 });
    const { orgId } = await seedWebsite(test);
    await creditOverview(orgId, NOON);
    const history = await creditHistory(orgId, { page: 1, pageSize: 25 });
    expect(history.rows).toEqual([expect.objectContaining({ type: "daily_grant", amount: 3, action: null })]);
  });
});

describe("refunds", () => {
  it("give back what the spend took", async () => {
    await settings({ audit: 5 });
    const { orgId } = await seedWebsite(test);
    await give(orgId, 10);
    const key = `audit:${randomUUID()}`;
    await spend({ organizationId: orgId, key });
    expect(await refundSpend(key, undefined, NOON)).toEqual({ refunded: true, credits: 5 });
    expect((await creditOverview(orgId, NOON)).available).toBe(10);
    expect((await ledgerOf(orgId)).find((row) => row.type === "spend_refund")).toMatchObject({
      amount: 5,
      note: "Website check run again: returned, it could not be completed",
    });
  });

  it("happen once", async () => {
    await settings({ audit: 5 });
    const { orgId } = await seedWebsite(test);
    await give(orgId, 5);
    const key = `audit:${randomUUID()}`;
    await spend({ organizationId: orgId, key });
    await refundSpend(key);
    expect(await refundSpend(key)).toEqual({ refunded: false, credits: 0 });
    expect((await creditOverview(orgId, NOON)).balance).toBe(5);
  });

  it("of an unknown or free action do nothing", async () => {
    expect(await refundSpend(`audit:${randomUUID()}`)).toEqual({ refunded: false, credits: 0 });
  });

  it("of a service name the service", async () => {
    const { orgId, websiteId } = await seedWebsite(test);
    await give(orgId, 300);
    const key = `addon:${randomUUID()}`;
    await test.db.transaction((tx) =>
      chargeCredits(tx, { organizationId: orgId, action: "addon:x", credits: 250, key, websiteId, note: "Bought Citations" }),
    );
    await refundSpend(key);
    expect((await ledgerOf(orgId)).find((row) => row.type === "spend_refund")?.note).toBe(
      "Bought Citations: returned, it could not be completed",
    );
    const history = await creditHistory(orgId, { page: 1, pageSize: 25 });
    expect(history.rows.map((row) => [row.type, row.amount, row.action])).toEqual([
      ["spend_refund", 250, "addon:x"],
      ["spend", -250, "addon:x"],
      ["adjustment", 300, null],
    ]);
  });
});
