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
import { getBalance, grantMonthlyCredits, listLedger } from "@/lib/backlinks/credits";
import {
  addMonthsClamped,
  billingAnchor,
  entitlementPeriod,
} from "@/lib/billing/entitlement-period";
import { runReconciliation } from "@/lib/billing/reconciliation";
import { convertReferral } from "@/lib/referrals/core";
import { REFERRAL_REWARD_CREDITS } from "@/lib/referrals/shared";
import { checkLimit } from "@/lib/usage";

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
      createdAt: d("2026-01-01T00:00:00Z"),
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
