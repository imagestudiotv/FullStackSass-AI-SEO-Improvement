import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { organization, payments, plans, subscriptions, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * A PayPal subscription cancelled in PayPal keeps the time it paid for
 * (review M1, 2026-10-20), as a card subscription does: active and set to
 * end until its last payment's period is over, then canceled by the
 * maintenance job. And PAYPAL_CHECKOUT=off pauses new PayPal checkouts only
 * (review L9). PayPal itself is stubbed; nothing leaves the test.
 */

const state = vi.hoisted(() => ({ db: null as unknown, paypal: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/referrals/core", () => ({ convertReferral: vi.fn(), reverseReferralReward: vi.fn() }));
vi.mock("@/lib/paypal/subscriptions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paypal/subscriptions")>()),
  getSubscription: async () => state.paypal,
  cancelSubscription: vi.fn(),
}));

import { paymentOptions } from "@/app/(app)/billing/billing-view";
import { beginCheckout, type CheckoutProviderOps } from "@/lib/billing/checkouts";
import { endPayPalCancellations, syncPayPalSubscription } from "@/lib/billing/paypal-events";
import { payPalCheckoutPaused } from "@/lib/paypal/client";

let test: TestDb;
const OUR_PLAN = "P-OURS";
let siteId = "";
let planId = "";

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
  await test.client.exec("delete from payments; delete from subscriptions; delete from billing_checkouts; delete from websites; delete from organization; delete from plans;");
  await test.db.insert(organization).values({ id: "org_a", name: "Acme", slug: "acme", createdAt: new Date() });
  const [plan] = await test.db
    .insert(plans)
    .values({ name: "Grow", tier: "grow", interval: "month", paypalPlanId: OUR_PLAN, priceCents: 9900, articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0 })
    .returning();
  planId = plan.id;
  const [site] = await test.db.insert(websites).values({ organizationId: "org_a", url: "https://acme.test", domain: "acme.test" }).returning();
  siteId = site.id;
  await test.db.insert(subscriptions).values({
    organizationId: "org_a",
    websiteId: siteId,
    provider: "paypal",
    paypalSubscriptionId: "I-1",
    status: "active",
    planId,
    currentPeriodEnd: new Date("2026-11-01T10:00:00Z"),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

/** PayPal's subscription as it reads after the customer cancelled it there. */
const cancelled = (overrides: Record<string, unknown> = {}) => ({
  id: "I-1",
  status: "CANCELLED",
  plan_id: OUR_PLAN,
  custom_id: `org_a:${siteId}`,
  start_time: "2026-10-01T10:00:00Z",
  billing_info: { last_payment: { time: "2026-10-01T10:00:00Z", amount: { value: "99.00", currency_code: "EUR" } } },
  ...overrides,
});

const row = async () => (await test.db.select().from(subscriptions).where(eq(subscriptions.paypalSubscriptionId, "I-1")))[0];

describe("a PayPal subscription cancelled in PayPal", () => {
  it("stays active, set to end, until the month paid for is over - then the maintenance job ends it", async () => {
    state.paypal = cancelled();
    await syncPayPalSubscription("I-1");
    expect(await row()).toMatchObject({ status: "active", cancelAtPeriodEnd: true, currentPeriodEnd: new Date("2026-11-01T10:00:00Z") });

    // Before the day, nothing to end.
    expect(await endPayPalCancellations()).toBe(0);
    vi.setSystemTime(new Date("2026-11-01T10:05:00Z"));
    expect(await endPayPalCancellations()).toBe(1);
    expect(await row()).toMatchObject({ status: "canceled", cancelAtPeriodEnd: false });
    // Ended rows are not read again.
    expect(await endPayPalCancellations()).toBe(0);
  });

  it("keeps a year for a yearly plan", async () => {
    await test.db.update(plans).set({ interval: "year" }).where(eq(plans.id, planId));
    state.paypal = cancelled();
    await syncPayPalSubscription("I-1");
    expect(await row()).toMatchObject({ status: "active", cancelAtPeriodEnd: true, currentPeriodEnd: new Date("2027-10-01T10:00:00Z") });
  });

  it("ends at once when nothing was paid, or the last payment was refunded in full", async () => {
    state.paypal = cancelled({ billing_info: {} });
    await syncPayPalSubscription("I-1");
    expect(await row()).toMatchObject({ status: "canceled", cancelAtPeriodEnd: false });

    await test.db.update(subscriptions).set({ status: "active" }).where(eq(subscriptions.paypalSubscriptionId, "I-1"));
    await test.db.insert(payments).values({ organizationId: "org_a", provider: "paypal", externalId: "SALE-1", amountCents: 9900, currency: "eur", status: "refunded", providerSubscriptionId: "I-1" });
    state.paypal = cancelled();
    await syncPayPalSubscription("I-1");
    expect(await row()).toMatchObject({ status: "canceled", cancelAtPeriodEnd: false });
  });

  it("ends at once when the time paid for is already over", async () => {
    vi.setSystemTime(new Date("2026-11-03T00:00:00Z"));
    state.paypal = cancelled();
    await syncPayPalSubscription("I-1");
    expect(await row()).toMatchObject({ status: "canceled", cancelAtPeriodEnd: false, currentPeriodEnd: new Date("2026-11-01T10:00:00Z") });
  });

  it("keeps the period last recorded when its PayPal plan is not one of ours", async () => {
    state.paypal = cancelled({ plan_id: "P-SOMEONE-ELSE" });
    await syncPayPalSubscription("I-1");
    expect(await row()).toMatchObject({ status: "active", cancelAtPeriodEnd: true, currentPeriodEnd: new Date("2026-11-01T10:00:00Z") });
  });

  it("is never marked to end while it is active in PayPal", async () => {
    state.paypal = { ...cancelled(), status: "ACTIVE", billing_info: { last_payment: { time: "2026-10-01T10:00:00Z" }, next_billing_time: "2026-11-01T10:00:00Z" } };
    await syncPayPalSubscription("I-1");
    expect(await row()).toMatchObject({ status: "active", cancelAtPeriodEnd: false, currentPeriodEnd: new Date("2026-11-01T10:00:00Z") });
  });

  it("cannot be changed or replaced until it ends, and says until when", async () => {
    state.paypal = cancelled();
    await syncPayPalSubscription("I-1");
    const ops = new Proxy({}, { get: () => () => Promise.reject(new Error("no provider call expected")) }) as unknown as CheckoutProviderOps;
    for (const provider of ["paypal", "stripe"] as const) {
      expect(await beginCheckout(test.db as never, { organizationId: "org_a", websiteId: siteId, provider, planId }, ops)).toEqual({
        kind: "refuse",
        error: "This website's PayPal subscription is cancelled and its plan runs until 2026-11-01. You can choose a plan again, by card or PayPal, once it has ended.",
      });
    }
    // The billing page offers no PayPal plan change for it, and no card either.
    const current = { status: "active", planId, planName: "Grow", tier: "grow", interval: "month", currentPeriodEnd: new Date("2026-11-01T10:00:00Z"), cancelAtPeriodEnd: true, hasCustomer: false, provider: "paypal" };
    expect(paymentOptions(current, true)).toMatchObject({ billedBy: "paypal", paypal: false, card: false, manageInPayPal: true });
    expect(paymentOptions({ ...current, cancelAtPeriodEnd: false }, true).paypal).toBe(true);
  });
});

describe("pausing PayPal checkouts (PAYPAL_CHECKOUT)", () => {
  it("is off unless set to off", () => {
    expect(payPalCheckoutPaused()).toBe(false);
    vi.stubEnv("PAYPAL_CHECKOUT", " OFF ");
    expect(payPalCheckoutPaused()).toBe(true);
    vi.stubEnv("PAYPAL_CHECKOUT", "on");
    expect(payPalCheckoutPaused()).toBe(false);
  });
});
