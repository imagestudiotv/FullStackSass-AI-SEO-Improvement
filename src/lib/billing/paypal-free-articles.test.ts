import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { organization, plans, subscriptions, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * The free articles with PayPal (client, 2026-10-22: "as same as the case of
 * Stripe"). A first-time workspace paying with PayPal subscribes to the
 * plan's free-articles PayPal plan; its free days are recorded "trialing",
 * as a card trial is, so the free articles and everything that waits for the
 * plan follow the same rules. PayPal itself is stubbed.
 */

const state = vi.hoisted(() => ({ db: null as unknown, paypal: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/referrals/core", () => ({ convertReferral: vi.fn(), reverseReferralReward: vi.fn() }));
vi.mock("@/lib/paypal/subscriptions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paypal/subscriptions")>()),
  getSubscription: async () => state.paypal,
  cancelSubscription: vi.fn(),
}));

import { beginCheckout, type CheckoutProviderOps } from "@/lib/billing/checkouts";
import { isFreeArticlesTrial } from "@/lib/billing/entitlement-period";
import { syncPayPalSubscription } from "@/lib/billing/paypal-events";
import { FREE_ARTICLES_DAYS } from "@/lib/plans/features";

let test: TestDb;
const REGULAR = "P-GROW";
const FREE = "P-GROW-FREE";
let siteId = "";
let planId = "";

/** No open checkout is ever settled with a provider here. */
const ops = new Proxy({}, { get: () => () => Promise.reject(new Error("no provider call expected")) }) as unknown as CheckoutProviderOps;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
  await test.client.exec("delete from payments; delete from subscriptions; delete from billing_checkouts; delete from websites; delete from organization; delete from plans;");
  await test.db.insert(organization).values({ id: "org_a", name: "Acme", slug: "acme", createdAt: new Date() });
  const [plan] = await test.db
    .insert(plans)
    .values({ name: "Grow", tier: "grow", interval: "month", paypalPlanId: REGULAR, paypalTrialPlanId: FREE, priceCents: 9900, articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0 })
    .returning();
  planId = plan.id;
  const [site] = await test.db.insert(websites).values({ organizationId: "org_a", url: "https://acme.test", domain: "acme.test" }).returning();
  siteId = site.id;
});

afterEach(() => {
  vi.useRealTimers();
});

/** A PayPal subscription to the free-articles plan, as PayPal reads it on its first day. */
const onFreeDays = (overrides: Record<string, unknown> = {}, billing: Record<string, unknown> = {}) => ({
  id: "I-FREE",
  status: "ACTIVE",
  plan_id: FREE,
  custom_id: `org_a:${siteId}`,
  start_time: "2026-10-22T11:00:00Z",
  billing_info: {
    next_billing_time: "2026-11-21T10:00:00Z",
    failed_payments_count: 0,
    cycle_executions: [
      // PayPal counts the free cycle as run from its first day.
      { tenure_type: "TRIAL", sequence: 1, cycles_completed: 1, cycles_remaining: 0, total_cycles: 1 },
      { tenure_type: "REGULAR", sequence: 2, cycles_completed: 0, cycles_remaining: 0, total_cycles: 0 },
    ],
    ...billing,
  },
  ...overrides,
});

const row = async () => (await test.db.select().from(subscriptions).where(eq(subscriptions.paypalSubscriptionId, "I-FREE")))[0];

describe("a PayPal subscription with the free articles", () => {
  it("is on its free articles while its free days run: trialing, over the free days, as a card trial", async () => {
    state.paypal = onFreeDays();
    await syncPayPalSubscription("I-FREE");
    const recorded = await row();
    expect(recorded).toMatchObject({
      websiteId: siteId,
      planId,
      status: "trialing",
      currentPeriodStart: new Date("2026-10-22T11:00:00Z"),
      currentPeriodEnd: new Date("2026-11-21T10:00:00Z"),
    });
    expect(isFreeArticlesTrial(recorded)).toBe(true);
  });

  it("also without a cycle report, while nothing has been paid (a free cycle reports 0)", async () => {
    state.paypal = onFreeDays({}, { cycle_executions: undefined, last_payment: { time: "2026-10-22T11:00:00Z", amount: { value: "0.00", currency_code: "EUR" } } });
    await syncPayPalSubscription("I-FREE");
    expect(await row()).toMatchObject({ status: "trialing", currentPeriodStart: new Date("2026-10-22T11:00:00Z") });
  });

  it("starts the plan with its first payment: active, the paid month as its period", async () => {
    state.paypal = onFreeDays({}, {
      next_billing_time: "2026-12-21T10:00:00Z",
      last_payment: { time: "2026-11-21T10:00:00Z", amount: { value: "99.00", currency_code: "EUR" } },
      cycle_executions: [
        { tenure_type: "TRIAL", sequence: 1, cycles_completed: 1, cycles_remaining: 0, total_cycles: 1 },
        { tenure_type: "REGULAR", sequence: 2, cycles_completed: 1, cycles_remaining: 0, total_cycles: 0 },
      ],
    });
    vi.setSystemTime(new Date("2026-11-21T10:05:00Z"));
    await syncPayPalSubscription("I-FREE");
    expect(await row()).toMatchObject({
      status: "active",
      currentPeriodStart: new Date("2026-11-21T10:00:00Z"),
      currentPeriodEnd: new Date("2026-12-21T10:00:00Z"),
    });
  });

  it("is overdue, not free, when that first payment fails", async () => {
    state.paypal = onFreeDays({}, { failed_payments_count: 1, next_billing_time: "2026-11-24T10:00:00Z" });
    vi.setSystemTime(new Date("2026-11-21T12:00:00Z"));
    await syncPayPalSubscription("I-FREE");
    expect((await row()).status).toBe("past_due");
  });

  it("is no longer free once its free days are over, even before PayPal has billed", async () => {
    state.paypal = onFreeDays();
    vi.setSystemTime(new Date("2026-11-21T10:30:00Z"));
    await syncPayPalSubscription("I-FREE");
    expect((await row()).status).toBe("active");
  });

  it("ends at once when cancelled in its free days: nothing was paid, so no time is kept", async () => {
    state.paypal = onFreeDays({ status: "CANCELLED" }, { last_payment: { time: "2026-10-22T11:00:00Z", amount: { value: "0.00", currency_code: "EUR" } } });
    await syncPayPalSubscription("I-FREE");
    expect(await row()).toMatchObject({ status: "canceled", cancelAtPeriodEnd: false });
  });

  it("a subscription to the plan without the free articles is active from the start, as before", async () => {
    state.paypal = onFreeDays({ plan_id: REGULAR }, {
      last_payment: { time: "2026-10-22T11:00:00Z", amount: { value: "99.00", currency_code: "EUR" } },
      cycle_executions: [{ tenure_type: "REGULAR", sequence: 1, cycles_completed: 1, cycles_remaining: 0, total_cycles: 0 }],
    });
    await syncPayPalSubscription("I-FREE");
    expect(await row()).toMatchObject({ status: "active", planId });
  });
});

describe("a PayPal checkout", () => {
  const begin = (provider: "stripe" | "paypal" = "paypal") => beginCheckout(test.db as never, { organizationId: "org_a", websiteId: siteId, provider, planId }, ops);

  it("gives a first-time workspace the free articles when the plan has its free-articles PayPal plan", async () => {
    expect(await begin()).toMatchObject({ kind: "create", trialDays: FREE_ARTICLES_DAYS });
  });

  it("gives none for a plan without one: PayPal charges at once", async () => {
    await test.db.update(plans).set({ paypalTrialPlanId: null }).where(eq(plans.id, planId));
    expect(await begin()).toMatchObject({ kind: "create", trialDays: 0 });
  });

  it("gives none to a workspace that has had a subscription - one offer, by card or PayPal", async () => {
    await test.db.insert(subscriptions).values({ organizationId: "org_a", websiteId: null, provider: "stripe", stripeSubscriptionId: "sub_old", status: "canceled", planId });
    expect(await begin()).toMatchObject({ kind: "create", trialDays: 0 });
  });

  it("refuses a plan change while the website is on its free articles through PayPal", async () => {
    await test.db.insert(subscriptions).values({ organizationId: "org_a", websiteId: siteId, provider: "paypal", paypalSubscriptionId: "I-FREE", status: "trialing", planId });
    expect(await begin()).toEqual({ kind: "refuse", error: "This website is on its free articles through PayPal. Its plan can be changed once it has started." });
  });
});
