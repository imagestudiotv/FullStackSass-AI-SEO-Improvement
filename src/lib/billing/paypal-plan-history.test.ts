import { eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { organization, paypalPlanVersions, plans, subscriptions, websites } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Old PayPal plan ids (review P3). A plan row names only its CURRENT PayPal
 * plans; a subscriber on a plan recreated since keeps sending events for the
 * old id. Without paypal_plan_versions such a subscription in its free days
 * was stored "active" - paid access during the free articles - because the
 * sync no longer knew the old id was a free-articles plan. PayPal is stubbed.
 */

const state = vi.hoisted(() => ({ db: null as unknown, paypal: null as unknown }));
vi.mock("@/lib/db", () => ({ db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }) }));
vi.mock("@/lib/referrals/core", () => ({ convertReferral: vi.fn(), reverseReferralReward: vi.fn() }));
vi.mock("@/lib/paypal/subscriptions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paypal/subscriptions")>()),
  getSubscription: async () => state.paypal,
  cancelSubscription: vi.fn(),
}));

import { syncPayPalSubscription } from "@/lib/billing/paypal-events";

let test: TestDb;
let siteId = "";
let planId = "";
const OLD_FREE = "P-GROW-FREE-OLD";

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-22T12:00:00Z"));
  await test.client.exec(
    "delete from paypal_plan_versions; delete from payments; delete from subscriptions; delete from billing_checkouts; delete from websites; delete from organization; delete from plans;",
  );
  await test.db.insert(organization).values({ id: "org_a", name: "Acme", slug: "acme", createdAt: new Date() });
  // The row now names NEW PayPal plans: the old free-articles plan was recreated.
  const [plan] = await test.db
    .insert(plans)
    .values({ name: "Grow", tier: "grow", interval: "month", paypalPlanId: "P-GROW-NEW", paypalTrialPlanId: "P-GROW-FREE-NEW", priceCents: 14900, articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0 })
    .returning();
  planId = plan.id;
  const [site] = await test.db.insert(websites).values({ organizationId: "org_a", url: "https://acme.test", domain: "acme.test" }).returning();
  siteId = site.id;
  // The subscriber bought this plan before the recreation: the row is recorded.
  await test.db.insert(subscriptions).values({ organizationId: "org_a", websiteId: siteId, provider: "paypal", paypalSubscriptionId: "I-OLD", planId, status: "trialing" });
});

afterEach(() => {
  vi.useRealTimers();
});

/** In its free days, on the OLD free-articles plan. */
const onOldFreeDays = () => ({
  id: "I-OLD",
  status: "ACTIVE",
  plan_id: OLD_FREE,
  custom_id: `org_a:${siteId}`,
  start_time: "2026-10-20T11:00:00Z",
  billing_info: {
    next_billing_time: "2026-11-19T10:00:00Z",
    failed_payments_count: 0,
    cycle_executions: [
      { tenure_type: "TRIAL", sequence: 1, cycles_completed: 1, cycles_remaining: 0, total_cycles: 1 },
      { tenure_type: "REGULAR", sequence: 2, cycles_completed: 0, cycles_remaining: 0, total_cycles: 0 },
    ],
  },
});

const row = async () => (await test.db.select().from(subscriptions).where(eq(subscriptions.paypalSubscriptionId, "I-OLD")))[0];

describe("a subscription on a PayPal plan recreated since", () => {
  it("REPRODUCTION: without the history its free days were taken for paid access", async () => {
    state.paypal = onOldFreeDays();
    await syncPayPalSubscription("I-OLD");
    // The plan is kept (the recorded one), but the status is the paid one.
    expect(await row()).toMatchObject({ planId, status: "active" });
  });

  it("keeps its free days, and its plan, through the history", async () => {
    await test.db.insert(paypalPlanVersions).values({ planId, environment: "sandbox", kind: "trial", paypalPlanId: OLD_FREE, priceCents: 14900, currency: "eur", retiredAt: new Date() });
    state.paypal = onOldFreeDays();
    await syncPayPalSubscription("I-OLD");
    expect(await row()).toMatchObject({ planId, status: "trialing" });
  });

  it("maps an id backfilled before modes were recorded, in either mode", async () => {
    await test.db.insert(paypalPlanVersions).values({ planId, environment: null, kind: "trial", paypalPlanId: OLD_FREE, priceCents: 14900, currency: "eur" });
    state.paypal = onOldFreeDays();
    await syncPayPalSubscription("I-OLD");
    expect((await row()).status).toBe("trialing");
  });

  it("does not map an id recorded under the other PayPal mode", async () => {
    // Tests run as sandbox (PAYPAL_ENV unset): a LIVE id is not ours here.
    await test.db.insert(paypalPlanVersions).values({ planId, environment: "live", kind: "trial", paypalPlanId: OLD_FREE, priceCents: 14900, currency: "eur" });
    state.paypal = onOldFreeDays();
    await syncPayPalSubscription("I-OLD");
    expect((await row()).status).toBe("active");
  });
});

describe("a subscription on a REPGET offer plan (review P5)", () => {
  beforeEach(async () => {
    await test.db.update(plans).set({ paypalOfferPlanId: "P-GROW-OFFER", paypalTrialOfferPlanId: "P-GROW-FREE-OFFER" }).where(eq(plans.id, planId));
  });

  it("in its free days before the discounted payment: the plan, and trialing", async () => {
    state.paypal = {
      ...onOldFreeDays(),
      plan_id: "P-GROW-FREE-OFFER",
      billing_info: {
        ...onOldFreeDays().billing_info,
        cycle_executions: [
          { tenure_type: "TRIAL", sequence: 1, cycles_completed: 1, total_cycles: 1 },
          { tenure_type: "TRIAL", sequence: 2, cycles_completed: 0, total_cycles: 1 },
          { tenure_type: "REGULAR", sequence: 3, cycles_completed: 0, total_cycles: 0 },
        ],
      },
    };
    await syncPayPalSubscription("I-OLD");
    expect(await row()).toMatchObject({ planId, status: "trialing" });
  });

  it("after the discounted payment: the plan, paid access", async () => {
    state.paypal = {
      ...onOldFreeDays(),
      plan_id: "P-GROW-OFFER",
      billing_info: {
        next_billing_time: "2026-11-19T10:00:00Z",
        failed_payments_count: 0,
        last_payment: { time: "2026-10-20T11:00:00Z", amount: { value: "89.40", currency_code: "EUR" } },
        cycle_executions: [
          { tenure_type: "TRIAL", sequence: 1, cycles_completed: 1, total_cycles: 1 },
          { tenure_type: "REGULAR", sequence: 2, cycles_completed: 0, total_cycles: 0 },
        ],
      },
    };
    await syncPayPalSubscription("I-OLD");
    expect(await row()).toMatchObject({ planId, status: "active" });
  });
});
