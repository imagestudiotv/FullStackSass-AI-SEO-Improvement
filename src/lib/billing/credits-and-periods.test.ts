import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addonPurchases,
  addons,
  creditLedger,
  organization,
  plans,
  referrals,
  spendReservations,
  subscriptions,
  websites,
  payments,
} from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Issue 7 (monthly allowances for annual and multi-site customers) and
 * issue 8 (credits committed with the purchase or referral that earns them),
 * against a disposable PGlite with every date fixed by the test.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
const notifyMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/notifications/create", () => ({ notify: notifyMock }));

import { fulfilAddonPurchase } from "@/lib/addons/fulfil";
import { getBalance, grantMonthlyCredits, listLedger, planGrantKey } from "@/lib/backlinks/credits";
import {
  addMonthsClamped,
  allowanceWindowStart,
  billingAnchor,
  entitlementPeriod,
  lessThanAMonthApart,
} from "@/lib/billing/entitlement-period";
import { runReconciliation } from "@/lib/billing/reconciliation";
import { reserve } from "@/lib/billing/spend-quota";
import { convertReferral } from "@/lib/referrals/core";
import { REFERRAL_REWARD_CREDITS } from "@/lib/referrals/shared";
import { articleAllowanceRule, checkLimit } from "@/lib/usage";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(() => {
  notifyMock.mockReset();
  vi.useRealTimers();
});

const d = (iso: string) => new Date(iso);

async function seedOrg() {
  const id = `org_${randomUUID()}`;
  await test.db.insert(organization).values({ id, name: "W", slug: id, createdAt: new Date() });
  return id;
}

async function seedPaidSite(
  orgId: string,
  options: {
    interval: "month" | "year";
    credits?: number;
    articleLimit?: number;
    periodStart: Date | null;
    periodEnd?: Date | null;
    provider?: "stripe" | "paypal";
    status?: string;
    attached?: boolean;
    /** When our row was written; long before the period unless a test says otherwise. */
    createdAt?: Date;
  },
) {
  const [site] = await test.db
    .insert(websites)
    .values({
      organizationId: orgId,
      url: `https://${randomUUID()}.example`,
      domain: `${randomUUID()}.example`,
      status: "ready",
    })
    .returning({ id: websites.id });
  const [plan] = await test.db
    .insert(plans)
    .values({
      name: "Plan",
      tier: `t_${randomUUID()}`,
      interval: options.interval,
      priceCents: 1000,
      articleLimit: options.articleLimit ?? 10,
      keywordLimit: 10,
      siteLimit: 1,
      monthlyCredits: options.credits ?? 5,
    })
    .returning({ id: plans.id });
  const [sub] = await test.db
    .insert(subscriptions)
    .values({
      organizationId: orgId,
      websiteId: options.attached === false ? null : site.id,
      provider: options.provider ?? "stripe",
      planId: plan.id,
      status: options.status ?? "active",
      currentPeriodStart: options.periodStart,
      currentPeriodEnd: options.periodEnd ?? null,
      createdAt: options.createdAt ?? d("2026-01-01T00:00:00Z"),
    })
    .returning({ id: subscriptions.id });
  return { websiteId: site.id, subscriptionId: sub.id };
}

/* ------------------------------------------------------------------------ */
/* Issue 7: periods                                                           */
/* ------------------------------------------------------------------------ */

describe("monthly entitlement periods", () => {
  it("clamps month ends to the anchor day without drifting", () => {
    const anchor = d("2026-01-31T10:00:00Z");
    expect(addMonthsClamped(anchor, 1).toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(addMonthsClamped(anchor, 2).toISOString()).toBe("2026-03-31T10:00:00.000Z");
    expect(entitlementPeriod(anchor, d("2026-03-01T00:00:00Z"))).toEqual({
      start: d("2026-02-28T10:00:00Z"),
      end: d("2026-03-31T10:00:00Z"),
    });
  });

  it("handles leap years", () => {
    const anchor = d("2028-02-29T00:00:00Z");
    expect(addMonthsClamped(anchor, 12).toISOString()).toBe("2029-02-28T00:00:00.000Z");
    expect(entitlementPeriod(d("2028-01-31T00:00:00Z"), d("2028-02-28T23:59:59Z")).start).toEqual(
      d("2028-01-31T00:00:00Z"),
    );
    expect(entitlementPeriod(d("2028-01-31T00:00:00Z"), d("2028-03-01T00:00:00Z")).start).toEqual(
      d("2028-02-29T00:00:00Z"),
    );
  });

  it("splits an annual billing period into months, in UTC", () => {
    const anchor = d("2026-03-15T22:30:00Z"); // 16 March in UTC+2, 15th in UTC
    expect(entitlementPeriod(anchor, d("2026-09-20T00:00:00Z"))).toEqual({
      start: d("2026-09-15T22:30:00Z"),
      end: d("2026-10-15T22:30:00Z"),
    });
    // The instant before the boundary still belongs to the previous month.
    expect(entitlementPeriod(anchor, d("2026-09-15T22:29:59Z")).start).toEqual(
      d("2026-08-15T22:30:00Z"),
    );
  });

  it("treats a future anchor as the start of the first period", () => {
    expect(entitlementPeriod(d("2026-10-01T00:00:00Z"), d("2026-09-30T00:00:00Z")).start).toEqual(
      d("2026-10-01T00:00:00Z"),
    );
  });

  it("derives an annual anchor from the period end when the start is unknown", () => {
    expect(
      billingAnchor({
        currentPeriodStart: null,
        currentPeriodEnd: d("2027-03-15T00:00:00Z"),
        interval: "year",
        createdAt: null,
      }),
    ).toEqual(d("2026-03-15T00:00:00Z"));
  });

  it("treats period starts less than a month apart as one allowance month", () => {
    const trial = d("2026-10-01T18:50:18Z");
    const converted = d("2026-10-04T18:50:18Z");
    expect(lessThanAMonthApart(trial, converted)).toBe(true);
    expect(lessThanAMonthApart(converted, trial)).toBe(true); // order does not matter
    // A renewal is a new month, month ends clamped as everywhere else.
    expect(lessThanAMonthApart(trial, d("2026-11-01T18:50:18Z"))).toBe(false);
    expect(lessThanAMonthApart(d("2026-01-31T10:00:00Z"), d("2026-02-28T10:00:00Z"))).toBe(false);
    // PayPal charges a renewal at its own time of day: hours "early" is still the next month.
    expect(lessThanAMonthApart(d("2026-10-01T18:51:02Z"), d("2026-11-01T10:05:00Z"))).toBe(false);
  });

  describe("allowanceWindowStart", () => {
    const sub = (start: string, end: string | null, createdAt: string, interval = "month") => ({
      currentPeriodStart: d(start),
      currentPeriodEnd: end ? d(end) : null,
      interval,
      createdAt: d(createdAt),
    });

    /*
      A new account's free articles (2026-10-09): the paid month after a
      trial starts fresh at the conversion. It replaced the 2026-10-05 rule
      that opened that month at the subscription's creation, so the trial's
      articles counted against it.
    */
    it("opens the paid period after a trial at the conversion", () => {
      // The imagestudio subscription: row written 22 s into a 3-day trial.
      const created = "2026-10-01T18:50:40Z";
      const trialing = sub("2026-10-01T18:50:18Z", "2026-10-04T18:50:18Z", created);
      expect(allowanceWindowStart(trialing, d("2026-10-02T00:00:00Z"))).toEqual(d("2026-10-01T18:50:18Z"));

      const converted = sub("2026-10-04T18:50:18Z", "2026-11-04T18:50:18Z", created);
      expect(allowanceWindowStart(converted, d("2026-10-05T00:00:00Z"))).toEqual(d("2026-10-04T18:50:18Z"));
      expect(allowanceWindowStart(converted, d("2026-11-04T18:50:17Z"))).toEqual(d("2026-10-04T18:50:18Z"));
      // The second paid period is a fresh month, renewed or not.
      expect(allowanceWindowStart(converted, d("2026-11-04T18:50:18Z"))).toEqual(d("2026-11-04T18:50:18Z"));
      const renewed = sub("2026-11-04T18:50:18Z", "2026-12-04T18:50:18Z", created);
      expect(allowanceWindowStart(renewed, d("2026-11-10T00:00:00Z"))).toEqual(d("2026-11-04T18:50:18Z"));
    });

    it("does the same for an annual plan's first month after its trial", () => {
      const created = "2026-03-01T10:00:30Z";
      const annual = sub("2026-03-04T10:00:00Z", "2027-03-04T10:00:00Z", created, "year");
      expect(allowanceWindowStart(annual, d("2026-03-10T00:00:00Z"))).toEqual(d("2026-03-04T10:00:00Z"));
      expect(allowanceWindowStart(annual, d("2026-04-10T00:00:00Z"))).toEqual(d("2026-04-04T10:00:00Z"));
    });

    it("leaves every subscription without a trial on its period start", () => {
      // Stripe: the webhook writes the row seconds AFTER the period starts.
      const stripe = sub("2026-10-01T18:50:18Z", "2026-11-01T18:50:18Z", "2026-10-01T18:50:40Z");
      expect(allowanceWindowStart(stripe, d("2026-10-05T00:00:00Z"))).toEqual(d("2026-10-01T18:50:18Z"));
      // Second month, before and after the renewal webhook moved the anchor.
      expect(allowanceWindowStart(stripe, d("2026-11-02T00:00:00Z"))).toEqual(d("2026-11-01T18:50:18Z"));
      const renewed = sub("2026-11-01T18:50:18Z", "2026-12-01T18:50:18Z", "2026-10-01T18:50:40Z");
      expect(allowanceWindowStart(renewed, d("2026-11-02T00:00:00Z"))).toEqual(d("2026-11-01T18:50:18Z"));

      // PayPal: the row can be written at approval, before the first payment
      // that we take as the period start...
      const approvedEarly = sub("2026-10-01T20:51:02Z", "2026-11-01T10:00:00Z", "2026-10-01T18:50:40Z");
      expect(allowanceWindowStart(approvedEarly, d("2026-10-05T00:00:00Z"))).toEqual(d("2026-10-01T20:51:02Z"));
      // ...and renewals are charged at PayPal's time of day, hours "early".
      const paypalRenewed = sub("2026-11-01T10:05:00Z", "2026-12-01T10:00:00Z", "2026-10-01T18:50:40Z");
      expect(allowanceWindowStart(paypalRenewed, d("2026-11-05T00:00:00Z"))).toEqual(d("2026-11-01T10:05:00Z"));
    });
  });
});

describe("article allowance windows", () => {
  async function useArticles(websiteId: string, at: Date, n: number) {
    for (let i = 0; i < n; i += 1) {
      await test.db.insert(spendReservations).values({
        key: `articles:${websiteId}`,
        operation: "article.generate",
        state: "consumed",
        limitValue: 10,
        countedAt: at,
      });
    }
  }

  it("gives an annual customer a fresh allowance every month", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(d("2026-09-20T12:00:00Z"));
    const orgId = await seedOrg();
    const { websiteId } = await seedPaidSite(orgId, {
      interval: "year",
      articleLimit: 4,
      periodStart: d("2026-03-15T00:00:00Z"),
      periodEnd: d("2027-03-15T00:00:00Z"),
    });
    await useArticles(websiteId, d("2026-08-20T00:00:00Z"), 4); // last month: all used
    await useArticles(websiteId, d("2026-09-16T00:00:00Z"), 1); // this month: one

    const check = await checkLimit(websiteId, "articles");
    expect(check).toMatchObject({ used: 1, limit: 4, allowed: true });
  });

  it("keeps a monthly customer's window equal to the billing period", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(d("2026-09-20T12:00:00Z"));
    const orgId = await seedOrg();
    const { websiteId } = await seedPaidSite(orgId, {
      interval: "month",
      articleLimit: 2,
      periodStart: d("2026-09-05T00:00:00Z"),
      periodEnd: d("2026-10-05T00:00:00Z"),
      provider: "paypal",
    });
    await useArticles(websiteId, d("2026-09-04T23:59:00Z"), 5); // previous period
    await useArticles(websiteId, d("2026-09-05T00:00:00Z"), 2);
    expect(await checkLimit(websiteId, "articles")).toMatchObject({ used: 2, allowed: false });
  });

  /*
    The paid month after a trial starts fresh (2026-10-09; it was "the trial
    is part of the first month" from 2026-10-05). Display (checkLimit) and
    enforcement (the reservation rule) must agree on it. A 3-day trial from
    before the change keeps its plan's allowance during the trial; the free
    articles' trial is tested in free-articles.test.ts.
  */
  it("does not count a trial's articles again in the paid month", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(d("2026-10-02T12:00:00Z"));
    const orgId = await seedOrg();
    const { websiteId, subscriptionId } = await seedPaidSite(orgId, {
      interval: "month",
      articleLimit: 30,
      status: "trialing",
      periodStart: d("2026-10-01T18:50:18Z"),
      periodEnd: d("2026-10-04T18:50:18Z"),
      createdAt: d("2026-10-01T18:50:40Z"),
    });
    await useArticles(websiteId, d("2026-10-02T09:00:00Z"), 10);
    expect(await checkLimit(websiteId, "articles")).toMatchObject({ used: 10, limit: 30, allowed: true });

    // Converted: the provider moves the period to start at the trial's end.
    await test.db
      .update(subscriptions)
      .set({ status: "active", currentPeriodStart: d("2026-10-04T18:50:18Z"), currentPeriodEnd: d("2026-11-04T18:50:18Z") })
      .where(eq(subscriptions.id, subscriptionId));
    vi.setSystemTime(d("2026-10-05T12:00:00Z"));
    expect(await checkLimit(websiteId, "articles")).toMatchObject({ used: 0, limit: 30, allowed: true });

    const allowance = await articleAllowanceRule(websiteId);
    if (!allowance.ok) throw new Error("expected an allowance");
    expect(allowance.rule.window).toEqual({ since: d("2026-10-04T18:50:18Z") });

    // All 30, by both counts: the 30th is admitted, the 31st is not.
    await useArticles(websiteId, d("2026-10-05T09:00:00Z"), 29);
    expect(await checkLimit(websiteId, "articles")).toMatchObject({ used: 29, allowed: true });
    expect(await reserve(allowance.rule, { operation: "article.generate", websiteId })).not.toBeNull();
    expect(await checkLimit(websiteId, "articles")).toMatchObject({ used: 30, allowed: false });
    expect(await reserve(allowance.rule, { operation: "article.generate", websiteId })).toBeNull();

    // The second paid period starts a fresh allowance.
    vi.setSystemTime(d("2026-11-04T18:50:18Z"));
    expect(await checkLimit(websiteId, "articles")).toMatchObject({ used: 0, limit: 30, allowed: true });
    const next = await articleAllowanceRule(websiteId);
    if (!next.ok) throw new Error("expected an allowance");
    expect(next.rule.window).toEqual({ since: d("2026-11-04T18:50:18Z") });
    expect(await reserve(next.rule, { operation: "article.generate", websiteId })).not.toBeNull();
  });

  it("leaves a subscription without a trial on its period start in its first month", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(d("2026-10-05T12:00:00Z"));
    const orgId = await seedOrg();
    // A PayPal row written at approval, two hours before the first payment.
    const { websiteId } = await seedPaidSite(orgId, {
      interval: "month",
      articleLimit: 30,
      provider: "paypal",
      periodStart: d("2026-10-01T20:51:02Z"),
      periodEnd: d("2026-11-01T10:00:00Z"),
      createdAt: d("2026-10-01T18:50:40Z"),
    });
    await useArticles(websiteId, d("2026-10-01T19:00:00Z"), 3); // before the period: not counted, as before
    await useArticles(websiteId, d("2026-10-02T00:00:00Z"), 2);
    expect(await checkLimit(websiteId, "articles")).toMatchObject({ used: 2, limit: 30 });
    const allowance = await articleAllowanceRule(websiteId);
    expect(allowance.ok && allowance.rule.window).toEqual({ since: d("2026-10-01T20:51:02Z") });
  });
});

/* ------------------------------------------------------------------------ */
/* Issue 7: monthly credit grants                                             */
/* ------------------------------------------------------------------------ */

describe("grantMonthlyCredits", () => {
  it("grants every paid website its own allowance, monthly and annual, Stripe and PayPal", async () => {
    const orgId = await seedOrg();
    await seedPaidSite(orgId, { interval: "month", credits: 5, periodStart: d("2026-09-05T00:00:00Z") });
    await seedPaidSite(orgId, {
      interval: "year",
      credits: 20,
      provider: "paypal",
      periodStart: d("2026-03-15T00:00:00Z"),
    });
    // Neither of these may contribute.
    await seedPaidSite(orgId, { interval: "month", credits: 7, periodStart: d("2026-09-05T00:00:00Z"), status: "canceled" });
    await seedPaidSite(orgId, { interval: "month", credits: 9, periodStart: d("2026-09-05T00:00:00Z"), attached: false });

    const now = d("2026-09-20T00:00:00Z");
    expect(await grantMonthlyCredits(orgId, now)).toBe(25);
    expect(await getBalance(orgId)).toBe(25);
  });

  async function setSubscription(
    subscriptionId: string,
    values: { status?: string; currentPeriodStart?: Date; currentPeriodEnd?: Date; planId?: string },
  ) {
    await test.db.update(subscriptions).set(values).where(eq(subscriptions.id, subscriptionId));
  }

  /** Another plan to switch a subscription to. */
  async function seedPlan(interval: "month" | "year", credits: number) {
    const [plan] = await test.db
      .insert(plans)
      .values({ name: "Plan", tier: `t_${randomUUID()}`, interval, priceCents: 1000, articleLimit: 10, keywordLimit: 10, siteLimit: 1, monthlyCredits: credits })
      .returning({ id: plans.id });
    return plan.id;
  }

  /*
    Where the article window opens now, read as usage.ts reads it: the other
    half of "which month is the customer in", which credits must agree with.
  */
  async function articleWindow(subscriptionId: string, now: Date) {
    const [row] = await test.db
      .select({
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        interval: plans.interval,
        createdAt: subscriptions.createdAt,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.id, subscriptionId));
    return allowanceWindowStart(row, now);
  }

  async function grantRow(orgId: string, key: string) {
    const [row] = await test.db.select().from(creditLedger).where(eq(creditLedger.idempotencyKey, key));
    expect(row?.organizationId).toBe(orgId);
    return row;
  }

  /*
    A trial earns no credits (2026-10-09: the trial is now a new account's
    free articles, and backlinks wait for the plan). The paid month is
    granted in full at the conversion, the next a month after it.
  */
  it("a trial earns no credits; the paid month is granted in full at conversion", async () => {
    const orgId = await seedOrg();
    const { subscriptionId } = await seedPaidSite(orgId, {
      interval: "month",
      credits: 25,
      status: "trialing",
      periodStart: d("2026-10-01T18:50:18Z"),
      periodEnd: d("2026-10-04T18:50:18Z"),
      createdAt: d("2026-10-01T18:50:40Z"),
    });

    expect(await grantMonthlyCredits(orgId, d("2026-10-01T18:51:00Z"))).toBe(0);
    expect(await grantMonthlyCredits(orgId, d("2026-10-02T09:00:00Z"))).toBe(0);
    expect(await getBalance(orgId)).toBe(0);

    await setSubscription(subscriptionId, {
      status: "active",
      currentPeriodStart: d("2026-10-04T18:50:18Z"),
      currentPeriodEnd: d("2026-11-04T18:50:18Z"),
    });
    expect(await grantMonthlyCredits(orgId, d("2026-10-04T22:01:31Z"))).toBe(25);
    expect(await grantMonthlyCredits(orgId, d("2026-10-20T00:00:00Z"))).toBe(0);
    expect(await grantMonthlyCredits(orgId, d("2026-11-04T18:50:17Z"))).toBe(0);
    // The second paid period, renewal webhook or not.
    expect(await grantMonthlyCredits(orgId, d("2026-11-04T18:50:18Z"))).toBe(25);
    expect(await getBalance(orgId)).toBe(50);
  });

  /*
    A 3-day trial granted credits under the 2026-10-05 rule and converting
    after 2026-10-09: its paid period is the same first month, so it is only
    topped up to the plan - nothing on the same plan - and settled at zero,
    saying why, so it stays idempotent.
  */
  it("a trial granted credits under the old rule is not granted them again at conversion", async () => {
    const orgId = await seedOrg();
    const { subscriptionId } = await seedPaidSite(orgId, {
      interval: "month",
      credits: 25,
      status: "trialing",
      periodStart: d("2026-10-01T18:50:18Z"),
      periodEnd: d("2026-10-04T18:50:18Z"),
      createdAt: d("2026-10-01T18:50:40Z"),
    });
    await test.db.insert(creditLedger).values({
      organizationId: orgId,
      type: "plan_grant",
      amount: 25,
      idempotencyKey: planGrantKey(subscriptionId, d("2026-10-01T18:50:18Z")),
      createdAt: d("2026-10-01T18:51:00Z"),
    });

    await setSubscription(subscriptionId, {
      status: "active",
      currentPeriodStart: d("2026-10-04T18:50:18Z"),
      currentPeriodEnd: d("2026-11-04T18:50:18Z"),
    });
    expect(await grantMonthlyCredits(orgId, d("2026-10-04T22:01:31Z"))).toBe(0);
    const settled = await grantRow(orgId, planGrantKey(subscriptionId, d("2026-10-04T18:50:18Z")));
    expect(settled.amount).toBe(0);
    expect(settled.note).toMatch(/^Covered by the allowance granted for the period from 2026-10-01T18:50:18\.000Z/);
    expect(await grantMonthlyCredits(orgId, d("2026-11-04T18:50:18Z"))).toBe(25);
    expect(await getBalance(orgId)).toBe(50);
  });

  it("does the same for an annual plan with a trial, then grants monthly", async () => {
    const orgId = await seedOrg();
    const { subscriptionId } = await seedPaidSite(orgId, {
      interval: "year",
      credits: 20,
      status: "trialing",
      periodStart: d("2026-03-01T10:00:00Z"),
      periodEnd: d("2026-03-04T10:00:00Z"),
      createdAt: d("2026-03-01T10:00:30Z"),
    });
    expect(await grantMonthlyCredits(orgId, d("2026-03-02T00:00:00Z"))).toBe(0);

    await setSubscription(subscriptionId, {
      status: "active",
      currentPeriodStart: d("2026-03-04T10:00:00Z"),
      currentPeriodEnd: d("2027-03-04T10:00:00Z"),
    });
    expect(await grantMonthlyCredits(orgId, d("2026-03-05T00:00:00Z"))).toBe(20);
    expect(await grantMonthlyCredits(orgId, d("2026-04-04T09:59:59Z"))).toBe(0);
    expect(await grantMonthlyCredits(orgId, d("2026-04-04T10:00:00Z"))).toBe(20);
    expect(await grantMonthlyCredits(orgId, d("2026-05-04T10:00:00Z"))).toBe(20);
    expect(await getBalance(orgId)).toBe(60);
  });

  it("a trial granted nothing during it is granted once, at conversion", async () => {
    const orgId = await seedOrg();
    const { subscriptionId } = await seedPaidSite(orgId, {
      interval: "month",
      credits: 25,
      status: "trialing",
      periodStart: d("2026-10-01T18:50:18Z"),
      periodEnd: d("2026-10-04T18:50:18Z"),
      createdAt: d("2026-10-01T18:50:40Z"),
    });
    // No page load during the trial, so nothing was granted then.
    await setSubscription(subscriptionId, { status: "active", currentPeriodStart: d("2026-10-04T18:50:18Z") });
    expect(await grantMonthlyCredits(orgId, d("2026-10-05T00:00:00Z"))).toBe(25);
    expect(await grantMonthlyCredits(orgId, d("2026-11-04T18:50:18Z"))).toBe(25);
    expect(await getBalance(orgId)).toBe(50);
  });

  it("a trial that is never converted is granted nothing", async () => {
    const orgId = await seedOrg();
    const { subscriptionId } = await seedPaidSite(orgId, {
      interval: "month",
      credits: 25,
      status: "trialing",
      periodStart: d("2026-10-01T18:50:18Z"),
      periodEnd: d("2026-10-04T18:50:18Z"),
      createdAt: d("2026-10-01T18:50:40Z"),
    });
    expect(await grantMonthlyCredits(orgId, d("2026-10-02T00:00:00Z"))).toBe(0);
    await setSubscription(subscriptionId, { status: "canceled" });
    expect(await grantMonthlyCredits(orgId, d("2026-10-05T00:00:00Z"))).toBe(0);
    expect(await grantMonthlyCredits(orgId, d("2026-11-05T00:00:00Z"))).toBe(0);
    expect(await getBalance(orgId)).toBe(0);
  });

  it("a monthly plan without a trial is granted on every anchor, as before", async () => {
    const orgId = await seedOrg();
    // Stripe: the row is written seconds after the period starts.
    const { subscriptionId } = await seedPaidSite(orgId, {
      interval: "month",
      credits: 5,
      periodStart: d("2026-10-01T18:50:18Z"),
      periodEnd: d("2026-11-01T18:50:18Z"),
      createdAt: d("2026-10-01T18:50:40Z"),
    });
    expect(await grantMonthlyCredits(orgId, d("2026-10-01T18:51:00Z"))).toBe(5);
    expect(await grantMonthlyCredits(orgId, d("2026-10-31T00:00:00Z"))).toBe(0);
    expect(await grantMonthlyCredits(orgId, d("2026-11-01T18:50:18Z"))).toBe(5); // before the webhook
    await setSubscription(subscriptionId, { currentPeriodStart: d("2026-11-01T18:50:18Z") });
    expect(await grantMonthlyCredits(orgId, d("2026-11-02T00:00:00Z"))).toBe(0); // after it: same period
    expect(await grantMonthlyCredits(orgId, d("2026-12-01T18:50:18Z"))).toBe(5);
    expect(await getBalance(orgId)).toBe(15);

    // PayPal: renewals are charged at PayPal's time of day, hours "early".
    const paypalOrg = await seedOrg();
    const paypal = await seedPaidSite(paypalOrg, {
      interval: "month",
      credits: 5,
      provider: "paypal",
      periodStart: d("2026-10-01T18:51:02Z"),
      createdAt: d("2026-10-01T18:50:40Z"),
    });
    expect(await grantMonthlyCredits(paypalOrg, d("2026-10-02T00:00:00Z"))).toBe(5);
    await setSubscription(paypal.subscriptionId, { currentPeriodStart: d("2026-11-01T10:05:00Z") });
    expect(await grantMonthlyCredits(paypalOrg, d("2026-11-01T11:00:00Z"))).toBe(5);
    expect(await getBalance(paypalOrg)).toBe(10);
  });

  /*
    PayPal retries a failed renewal every 5 days and keeps its billing
    schedule, while our period starts at the payment (paypal-events.ts). The
    late payment starts a month of its own, and so does the on-schedule
    renewal 25 days later: "less than a month apart" is not "the same month"
    after the first one. Here no page load ran between the due date and the
    late payment - the case a rule of "no two grants less than a month
    apart" turned into a paid month with no credits.
  */
  it("a PayPal renewal paid days late, and the on-schedule renewal after it, are each granted", async () => {
    const orgId = await seedOrg();
    const { subscriptionId } = await seedPaidSite(orgId, {
      interval: "month",
      credits: 25,
      provider: "paypal",
      periodStart: d("2026-10-01T18:51:02Z"),
      periodEnd: d("2026-11-01T10:00:00Z"),
      createdAt: d("2026-10-01T18:50:40Z"),
    });
    expect(await grantMonthlyCredits(orgId, d("2026-10-02T00:00:00Z"))).toBe(25);

    // The 1 November charge fails; PayPal's retry succeeds on the 6th.
    await setSubscription(subscriptionId, {
      currentPeriodStart: d("2026-11-06T18:55:00Z"),
      currentPeriodEnd: d("2026-12-01T10:00:00Z"),
    });
    expect(await grantMonthlyCredits(orgId, d("2026-11-07T00:00:00Z"))).toBe(25);

    // Back on PayPal's schedule.
    await setSubscription(subscriptionId, {
      currentPeriodStart: d("2026-12-01T18:52:00Z"),
      currentPeriodEnd: d("2027-01-01T10:00:00Z"),
    });
    expect(await grantMonthlyCredits(orgId, d("2026-12-02T00:00:00Z"))).toBe(25);
    expect(await articleWindow(subscriptionId, d("2026-12-02T00:00:00Z"))).toEqual(d("2026-12-01T18:52:00Z"));
    await setSubscription(subscriptionId, {
      currentPeriodStart: d("2027-01-01T18:50:00Z"),
      currentPeriodEnd: d("2027-02-01T10:00:00Z"),
    });
    expect(await grantMonthlyCredits(orgId, d("2027-01-02T00:00:00Z"))).toBe(25);
    expect(await getBalance(orgId)).toBe(100); // four paid months, four grants
  });

  /*
    Stripe re-anchors on an interval change. After the first month that is a
    new period for articles (allowanceWindowStart), so it is one for credits
    too: Stripe has already refunded the unused days of the old plan.
  */
  it("an interval change after the first month starts a new period: the new plan's credits and a fresh article window", async () => {
    const orgId = await seedOrg();
    const { subscriptionId } = await seedPaidSite(orgId, {
      interval: "month",
      credits: 25,
      periodStart: d("2026-10-01T18:50:18Z"),
      periodEnd: d("2026-11-01T18:50:18Z"),
      createdAt: d("2026-10-01T18:50:40Z"),
    });
    expect(await grantMonthlyCredits(orgId, d("2026-10-02T00:00:00Z"))).toBe(25);
    await setSubscription(subscriptionId, {
      currentPeriodStart: d("2026-11-01T18:50:18Z"),
      currentPeriodEnd: d("2026-12-01T18:50:18Z"),
    });
    expect(await grantMonthlyCredits(orgId, d("2026-11-02T00:00:00Z"))).toBe(25);

    // 20 November: switched to an annual 60-credit plan.
    await setSubscription(subscriptionId, {
      planId: await seedPlan("year", 60),
      currentPeriodStart: d("2026-11-20T09:00:00Z"),
      currentPeriodEnd: d("2027-11-20T09:00:00Z"),
    });
    expect(await grantMonthlyCredits(orgId, d("2026-11-21T00:00:00Z"))).toBe(60);
    expect(await articleWindow(subscriptionId, d("2026-11-21T00:00:00Z"))).toEqual(d("2026-11-20T09:00:00Z"));
    expect(await grantMonthlyCredits(orgId, d("2026-12-19T00:00:00Z"))).toBe(0);
    expect(await grantMonthlyCredits(orgId, d("2026-12-20T09:00:00Z"))).toBe(60);
    expect(await getBalance(orgId)).toBe(170);
  });

  /*
    Credits are topped up, so the first month never holds two grants; the
    article window opens at the change, like every re-anchor since the paid
    month after a trial started fresh (2026-10-09).
  */
  it("an interval change inside the first month tops the credits up to the new plan, and opens a fresh article window", async () => {
    const orgId = await seedOrg();
    const { subscriptionId } = await seedPaidSite(orgId, {
      interval: "month",
      credits: 25,
      periodStart: d("2026-10-01T18:50:18Z"),
      periodEnd: d("2026-11-01T18:50:18Z"),
      createdAt: d("2026-10-01T18:50:40Z"),
    });
    expect(await grantMonthlyCredits(orgId, d("2026-10-02T00:00:00Z"))).toBe(25);

    await setSubscription(subscriptionId, {
      planId: await seedPlan("year", 60),
      currentPeriodStart: d("2026-10-10T09:00:00Z"),
      currentPeriodEnd: d("2027-10-10T09:00:00Z"),
    });
    expect(await grantMonthlyCredits(orgId, d("2026-10-11T00:00:00Z"))).toBe(35);
    expect(await articleWindow(subscriptionId, d("2026-10-11T00:00:00Z"))).toEqual(d("2026-10-10T09:00:00Z"));
    expect(await grantMonthlyCredits(orgId, d("2026-11-10T09:00:00Z"))).toBe(60);
    expect(await articleWindow(subscriptionId, d("2026-11-10T09:00:00Z"))).toEqual(d("2026-11-10T09:00:00Z"));
    expect(await getBalance(orgId)).toBe(120);
  });

  /*
    The customer pays the new plan's price from the conversion, so the paid
    month holds the new plan's credits - and nothing was granted during the
    trial to top up from.
  */
  it("an upgrade during the trial is granted the new plan in full at conversion", async () => {
    const orgId = await seedOrg();
    const { subscriptionId } = await seedPaidSite(orgId, {
      interval: "month",
      credits: 5,
      status: "trialing",
      periodStart: d("2026-10-01T18:50:18Z"),
      periodEnd: d("2026-10-04T18:50:18Z"),
      createdAt: d("2026-10-01T18:50:40Z"),
    });
    expect(await grantMonthlyCredits(orgId, d("2026-10-02T00:00:00Z"))).toBe(0);

    // Upgraded in the portal: same interval, so the trial's anchor is kept.
    await setSubscription(subscriptionId, { planId: await seedPlan("month", 60) });
    expect(await grantMonthlyCredits(orgId, d("2026-10-03T00:00:00Z"))).toBe(0);

    await setSubscription(subscriptionId, {
      status: "active",
      currentPeriodStart: d("2026-10-04T18:50:18Z"),
      currentPeriodEnd: d("2026-11-04T18:50:18Z"),
    });
    expect(await grantMonthlyCredits(orgId, d("2026-10-05T00:00:00Z"))).toBe(60);
    expect(await grantMonthlyCredits(orgId, d("2026-10-20T00:00:00Z"))).toBe(0);
    expect(await grantMonthlyCredits(orgId, d("2026-11-04T18:50:18Z"))).toBe(60);
    expect(await getBalance(orgId)).toBe(120);
  });

  /*
    The other order of the conversion race (plan-grants.concurrency.test.ts
    runs it on real Postgres): the paid period was granted first, and a page
    load that still read the trial's period grants nothing - a trial earns
    nothing - and writes nothing.
  */
  it("a stale read of the trial's period after the paid period was granted grants nothing", async () => {
    const orgId = await seedOrg();
    const { subscriptionId } = await seedPaidSite(orgId, {
      interval: "month",
      credits: 25,
      status: "active",
      periodStart: d("2026-10-04T18:50:18Z"),
      periodEnd: d("2026-11-04T18:50:18Z"),
      createdAt: d("2026-10-01T18:50:40Z"),
    });
    expect(await grantMonthlyCredits(orgId, d("2026-10-04T18:51:00Z"))).toBe(25);
    await setSubscription(subscriptionId, {
      status: "trialing",
      currentPeriodStart: d("2026-10-01T18:50:18Z"),
      currentPeriodEnd: d("2026-10-04T18:50:18Z"),
    });
    expect(await grantMonthlyCredits(orgId, d("2026-10-04T18:50:10Z"))).toBe(0);
    const [trialRow] = await test.db
      .select()
      .from(creditLedger)
      .where(eq(creditLedger.idempotencyKey, planGrantKey(subscriptionId, d("2026-10-01T18:50:18Z"))));
    expect(trialRow).toBeUndefined();
    expect(await getBalance(orgId)).toBe(25);
  });

  /*
    However early a trial ends, the paid month is granted at the conversion
    and its article window opens there: credits and articles agree on when
    the month starts.
  */
  it("a trial ended early is granted at its conversion, where its article window opens", async () => {
    const trial = { interval: "month" as const, credits: 25, status: "trialing", periodStart: d("2026-10-01T18:50:18Z"), periodEnd: d("2026-10-04T18:50:18Z"), createdAt: d("2026-10-01T18:50:40Z") };

    const dayIn = await seedOrg();
    const ended = await seedPaidSite(dayIn, trial);
    expect(await grantMonthlyCredits(dayIn, d("2026-10-01T19:00:00Z"))).toBe(0);
    await setSubscription(ended.subscriptionId, { status: "active", currentPeriodStart: d("2026-10-02T18:50:18Z"), currentPeriodEnd: d("2026-11-02T18:50:18Z") });
    expect(await grantMonthlyCredits(dayIn, d("2026-10-03T00:00:00Z"))).toBe(25);
    expect(await articleWindow(ended.subscriptionId, d("2026-10-03T00:00:00Z"))).toEqual(d("2026-10-02T18:50:18Z"));

    const hoursIn = await seedOrg();
    const early = await seedPaidSite(hoursIn, trial);
    expect(await grantMonthlyCredits(hoursIn, d("2026-10-01T19:00:00Z"))).toBe(0);
    await setSubscription(early.subscriptionId, { status: "active", currentPeriodStart: d("2026-10-01T20:50:18Z"), currentPeriodEnd: d("2026-11-01T20:50:18Z") });
    expect(await grantMonthlyCredits(hoursIn, d("2026-10-01T21:00:00Z"))).toBe(25);
    expect(await articleWindow(early.subscriptionId, d("2026-10-01T21:00:00Z"))).toEqual(d("2026-10-01T20:50:18Z"));
  });

  it("past due earns no new grant and keeps the balance; paid again in the period, it is granted once", async () => {
    const orgId = await seedOrg();
    const { subscriptionId } = await seedPaidSite(orgId, {
      interval: "month",
      credits: 25,
      periodStart: d("2026-09-04T18:50:18Z"),
      createdAt: d("2026-09-04T18:50:40Z"),
    });
    expect(await grantMonthlyCredits(orgId, d("2026-09-10T00:00:00Z"))).toBe(25);

    // The renewal's payment fails: the period moves on, the status is past_due.
    await setSubscription(subscriptionId, { status: "past_due", currentPeriodStart: d("2026-10-04T18:50:18Z") });
    expect(await grantMonthlyCredits(orgId, d("2026-10-05T00:00:00Z"))).toBe(0);
    expect(await getBalance(orgId)).toBe(25);

    // The retry succeeds within the same period.
    await setSubscription(subscriptionId, { status: "active" });
    expect(await grantMonthlyCredits(orgId, d("2026-10-08T00:00:00Z"))).toBe(25);
    expect(await grantMonthlyCredits(orgId, d("2026-10-09T00:00:00Z"))).toBe(0);
    expect(await getBalance(orgId)).toBe(50);
  });

  it("a first charge after the trial that fails, then succeeds, is granted once it is paid", async () => {
    const orgId = await seedOrg();
    const { subscriptionId } = await seedPaidSite(orgId, {
      interval: "month",
      credits: 25,
      status: "trialing",
      periodStart: d("2026-10-01T18:50:18Z"),
      createdAt: d("2026-10-01T18:50:40Z"),
    });
    expect(await grantMonthlyCredits(orgId, d("2026-10-02T00:00:00Z"))).toBe(0);
    await setSubscription(subscriptionId, { status: "past_due", currentPeriodStart: d("2026-10-04T18:50:18Z") });
    expect(await grantMonthlyCredits(orgId, d("2026-10-05T00:00:00Z"))).toBe(0);
    await setSubscription(subscriptionId, { status: "active" });
    expect(await grantMonthlyCredits(orgId, d("2026-10-06T00:00:00Z"))).toBe(25);
    expect(await grantMonthlyCredits(orgId, d("2026-10-20T00:00:00Z"))).toBe(0);
    expect(await grantMonthlyCredits(orgId, d("2026-11-04T18:50:18Z"))).toBe(25);
    expect(await getBalance(orgId)).toBe(50);
  });

  it("is idempotent per subscription and period, including under concurrency", async () => {
    const orgId = await seedOrg();
    await seedPaidSite(orgId, { interval: "month", credits: 5, periodStart: d("2026-09-05T00:00:00Z") });
    await seedPaidSite(orgId, { interval: "year", credits: 20, periodStart: d("2026-03-15T00:00:00Z") });
    const now = d("2026-09-20T00:00:00Z");

    await Promise.all(Array.from({ length: 8 }, () => grantMonthlyCredits(orgId, now)));
    expect(await grantMonthlyCredits(orgId, now)).toBe(0);
    expect(await getBalance(orgId)).toBe(25);
  });

  it("grants again in the next monthly period - an annual plan monthly, not once a year", async () => {
    const orgId = await seedOrg();
    await seedPaidSite(orgId, { interval: "year", credits: 20, periodStart: d("2026-03-15T00:00:00Z") });

    expect(await grantMonthlyCredits(orgId, d("2026-09-20T00:00:00Z"))).toBe(20);
    expect(await grantMonthlyCredits(orgId, d("2026-10-14T23:00:00Z"))).toBe(0);
    expect(await grantMonthlyCredits(orgId, d("2026-10-15T00:00:00Z"))).toBe(20);
    expect(await getBalance(orgId)).toBe(40);
  });

  it("does not grant the rollout month twice on top of an old workspace-wide grant", async () => {
    const orgId = await seedOrg();
    await seedPaidSite(orgId, { interval: "month", credits: 5, periodStart: d("2026-09-05T00:00:00Z") });
    await seedPaidSite(orgId, { interval: "month", credits: 8, periodStart: d("2026-09-05T00:00:00Z") });
    // The old code granted one site's credits for "2026-09".
    await test.db.insert(creditLedger).values({
      organizationId: orgId,
      type: "plan_grant",
      amount: 5,
      referenceId: "plan_grant:2026-09",
      createdAt: d("2026-09-06T00:00:00Z"),
    });

    await grantMonthlyCredits(orgId, d("2026-09-20T00:00:00Z"));
    expect(await getBalance(orgId)).toBe(13); // 5 (old) + 0 + 8, not 18
    // The settled-but-empty period marker is not shown to the customer.
    expect((await listLedger(orgId)).every((row) => row.amount !== 0)).toBe(true);
  });
});

/* ------------------------------------------------------------------------ */
/* Issue 8: purchases and referrals                                           */
/* ------------------------------------------------------------------------ */

async function failLedgerInserts() {
  await test.client.exec(`
    create or replace function inject_ledger_failure() returns trigger as $$
    begin raise exception 'injected ledger failure'; end $$ language plpgsql;
    drop trigger if exists inject_ledger_failure on credit_ledger;
    create trigger inject_ledger_failure before insert on credit_ledger
      for each row execute function inject_ledger_failure();`);
}
async function healLedger() {
  await test.client.exec("drop trigger if exists inject_ledger_failure on credit_ledger;");
}

describe("add-on purchases", () => {
  async function seedAddon() {
    const [addon] = await test.db
      .insert(addons)
      .values({ slug: `credits_${randomUUID()}`, name: "50 credits", priceCents: 900, creditsGranted: 50 })
      .returning({ id: addons.id });
    return addon.id;
  }
  const input = (organizationId: string, addonId: string, session = `cs_${randomUUID()}`) => ({
    organizationId,
    addonId,
    stripeSessionId: session,
    amountTotal: 900,
    currency: "eur",
  });

  it("rolls the purchase back when the credit write fails, so the retry delivers", async () => {
    const orgId = await seedOrg();
    const payload = input(orgId, await seedAddon());

    await failLedgerInserts();
    try {
      await expect(fulfilAddonPurchase(payload)).rejects.toThrow();
    } finally {
      await healLedger();
    }
    // Nothing half-done: no purchase that would make the retry skip.
    expect(
      await test.db.select().from(addonPurchases).where(eq(addonPurchases.stripeSessionId, payload.stripeSessionId)),
    ).toHaveLength(0);

    expect(await fulfilAddonPurchase(payload)).toBe(true);
    expect(await getBalance(orgId)).toBe(50);
  });

  it("delivers exactly once to duplicate and concurrent deliveries", async () => {
    const orgId = await seedOrg();
    const payload = input(orgId, await seedAddon());
    const results = await Promise.all(Array.from({ length: 6 }, () => fulfilAddonPurchase(payload)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await fulfilAddonPurchase(payload)).toBe(false);
    expect(await getBalance(orgId)).toBe(50);
  });

  it("keeps the credits when the notification fails", async () => {
    const orgId = await seedOrg();
    notifyMock.mockRejectedValueOnce(new Error("mail down"));
    expect(await fulfilAddonPurchase(input(orgId, await seedAddon()))).toBe(true);
    expect(await getBalance(orgId)).toBe(50);
  });

  it("reports a legacy purchase that never got its credits, and a replay heals only that", async () => {
    const orgId = await seedOrg();
    const addonId = await seedAddon();
    const payload = input(orgId, addonId);
    // The old failure: purchase committed, credit write lost.
    const [purchase] = await test.db
      .insert(addonPurchases)
      .values({ organizationId: orgId, addonId, stripeSessionId: payload.stripeSessionId, pricePaidCents: 900, currency: "eur" })
      .returning({ id: addonPurchases.id });

    const report = await runReconciliation(test.db, "purchasesWithoutCredits");
    expect(report.map((row) => row.purchase_id)).toContain(purchase.id);

    await fulfilAddonPurchase(payload); // the provider redelivers
    await fulfilAddonPurchase(payload);
    expect(await getBalance(orgId)).toBe(50);
    expect(
      (await runReconciliation(test.db, "purchasesWithoutCredits")).map((row) => row.purchase_id),
    ).not.toContain(purchase.id);
  });

  it("does not grant again for a legacy purchase credited without a key", async () => {
    const orgId = await seedOrg();
    const addonId = await seedAddon();
    const payload = input(orgId, addonId);
    const [purchase] = await test.db
      .insert(addonPurchases)
      .values({ organizationId: orgId, addonId, stripeSessionId: payload.stripeSessionId, pricePaidCents: 900, currency: "eur" })
      .returning({ id: addonPurchases.id });
    await test.db.insert(creditLedger).values({ organizationId: orgId, type: "purchase", amount: 50, referenceId: purchase.id });

    expect(await fulfilAddonPurchase(payload)).toBe(false);
    expect(await getBalance(orgId)).toBe(50);
  });
});

describe("referral rewards", () => {
  async function seedReferral() {
    const referrer = await seedOrg();
    const referred = await seedOrg();
    const [row] = await test.db
      .insert(referrals)
      .values({ referrerOrgId: referrer, referredOrgId: referred, status: "pending" })
      .returning({ id: referrals.id });
    // The payment the webhook records before converting: a referral converts only on one that stands.
    await test.db.insert(payments).values({ organizationId: referred, provider: "stripe", externalId: `in_${randomUUID()}`, amountCents: 2900, currency: "eur", status: "paid" });
    return { referrer, referred, id: row.id };
  }
  async function statusOf(id: string) {
    const [row] = await test.db.select({ status: referrals.status }).from(referrals).where(eq(referrals.id, id));
    return row.status;
  }

  it("stays pending when the credit write fails, and converts on the retry", async () => {
    const { referrer, referred, id } = await seedReferral();
    await failLedgerInserts();
    try {
      await expect(convertReferral(referred, 2900)).rejects.toThrow();
    } finally {
      await healLedger();
    }
    expect(await statusOf(id)).toBe("pending");

    expect(await convertReferral(referred, 2900)).toBe(true);
    expect(await statusOf(id)).toBe("rewarded");
    expect(await getBalance(referrer)).toBe(REFERRAL_REWARD_CREDITS);
  });

  it("rewards once under concurrent and repeated conversion, whatever the notifier does", async () => {
    const { referrer, referred } = await seedReferral();
    notifyMock.mockRejectedValue(new Error("mail down"));
    const results = await Promise.all(Array.from({ length: 5 }, () => convertReferral(referred, 2900)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await convertReferral(referred, 2900)).toBe(false);
    expect(await getBalance(referrer)).toBe(REFERRAL_REWARD_CREDITS);
  });

  it("reports a legacy rewarded referral whose credit was lost", async () => {
    const { id } = await seedReferral();
    await test.db.update(referrals).set({ status: "rewarded", rewardedAt: new Date() }).where(eq(referrals.id, id));
    const report = await runReconciliation(test.db, "rewardedReferralsWithoutCredits");
    expect(report.map((row) => row.referral_id)).toContain(id);
  });
});
