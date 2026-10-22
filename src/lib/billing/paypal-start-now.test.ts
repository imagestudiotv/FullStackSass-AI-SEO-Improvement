import { desc, eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  billingCheckouts,
  organization,
  payments,
  plans,
  providerCancellations,
  subscriptions,
  websites,
} from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * "Start my plan now" for a website on its free articles through PayPal
 * (client, 2026-10-22: PayPal "as same as the case of Stripe"). PayPal
 * cannot cut a subscription's free days short, so the plan starts with a
 * second PayPal subscription, to the plan itself and charged on approval,
 * which takes over from the free one once PayPal has activated it; the free
 * one is then cancelled. The real actions, ledger and sync run against a
 * disposable PGlite; PayPal is replaced at its API boundary.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  /** Each subscription as PayPal reports it now, by id. */
  paypal: {} as Record<string, Record<string, unknown>>,
  /** The id PayPal gives the next subscription created. */
  nextId: "I-FREE",
}));

const paypalMock = vi.hoisted(() => ({
  createSubscription: vi.fn(),
  getSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/referrals/core", () => ({ convertReferral: vi.fn(), reverseReferralReward: vi.fn() }));
vi.mock("@/lib/conversions/conversions", () => ({ rememberPayer: vi.fn(), reportFirstPayment: vi.fn() }));
vi.mock("@/lib/paypal/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paypal/client")>()),
  isPayPalConfigured: () => true,
  payPalCheckoutPaused: () => false,
}));
vi.mock("@/lib/paypal/subscriptions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paypal/subscriptions")>()),
  createSubscription: paypalMock.createSubscription,
  getSubscription: paypalMock.getSubscription,
  cancelSubscription: paypalMock.cancelSubscription,
}));
vi.mock("@/lib/auth-guard", () => ({
  requireSession: vi.fn(async () => ({ user: { id: "user_1", email: "owner@acme.test", emailVerified: true } })),
}));
vi.mock("@/lib/tenant", () => ({
  requireOrg: vi.fn(async () => ({ orgId: "org_a", userId: "user_1", role: "owner" })),
}));

import { checkoutProviderOps } from "@/lib/billing/checkout-providers";
import { beginCheckout, reconcileCheckouts } from "@/lib/billing/checkouts";
import { isFreeArticlesTrial } from "@/lib/billing/entitlement-period";
import { processPayPalEvent } from "@/lib/billing/paypal-events";
import { runReconciliation } from "@/lib/billing/reconciliation";
import { PayPalError } from "@/lib/paypal/client";
import { confirmPayPalReturn, createPayPalCheckout } from "@/lib/paypal/actions";
import { checkLimit } from "@/lib/usage";

let test: TestDb;
let growId = "";
let scaleId = "";
let siteId = "";

const NOW = new Date("2026-10-25T09:00:30Z");
const MINUTE = 60_000;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-22T11:00:00Z"));
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.repget.com");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  state.paypal = {};
  state.nextId = "I-FREE";
  await test.client.exec(`
    delete from provider_cancellations;
    delete from payments;
    delete from billing_checkouts;
    delete from subscriptions;
    delete from websites;
    delete from organization;
    delete from plans;
  `);
  await test.db.insert(organization).values({ id: "org_a", name: "Acme", slug: "acme", createdAt: new Date() });
  const [grow, scale] = await test.db
    .insert(plans)
    .values([
      { name: "Grow", tier: "grow", interval: "month", paypalPlanId: "P-GROW", paypalTrialPlanId: "P-GROW-FREE", priceCents: 9900, articleLimit: 30, keywordLimit: 100, siteLimit: 1, monthlyCredits: 0 },
      { name: "Scale", tier: "scale", interval: "month", paypalPlanId: "P-SCALE", paypalTrialPlanId: "P-SCALE-FREE", priceCents: 19900, articleLimit: 60, keywordLimit: 300, siteLimit: 1, monthlyCredits: 0 },
    ])
    .returning();
  growId = grow.id;
  scaleId = scale.id;
  const [site] = await test.db.insert(websites).values({ organizationId: "org_a", url: "https://acme.test", domain: "acme.test" }).returning();
  siteId = site.id;

  paypalMock.createSubscription.mockImplementation(async () => ({
    subscriptionId: state.nextId,
    approveUrl: `https://paypal.test/approve/${state.nextId}`,
  }));
  paypalMock.getSubscription.mockImplementation(async (id: string) => {
    const found = state.paypal[id];
    if (!found) throw new PayPalError("no such subscription", "not_found", 404);
    return found;
  });
  paypalMock.cancelSubscription.mockImplementation(async (id: string) => {
    if (state.paypal[id]) state.paypal[id] = { ...state.paypal[id], status: "CANCELLED" };
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

/** The checkout behind a PayPal subscription id. */
async function checkoutOf(subscriptionId: string) {
  const [row] = await test.db.select().from(billingCheckouts).where(eq(billingCheckouts.providerSubscriptionId, subscriptionId));
  return row;
}

async function rowOf(subscriptionId: string) {
  const [row] = await test.db.select().from(subscriptions).where(eq(subscriptions.paypalSubscriptionId, subscriptionId));
  return row;
}

async function siteRow() {
  const [row] = await test.db.select().from(subscriptions).where(eq(subscriptions.websiteId, siteId));
  return row;
}

/** The website on its free articles through PayPal: checked out, approved and activated, as on its first day. */
async function onFreeArticles() {
  expect(await createPayPalCheckout(growId, siteId)).toEqual({ url: "https://paypal.test/approve/I-FREE" });
  const checkout = await checkoutOf("I-FREE");
  state.paypal["I-FREE"] = {
    id: "I-FREE",
    status: "ACTIVE",
    plan_id: "P-GROW-FREE",
    custom_id: `org_a:${siteId}:${checkout.id}`,
    start_time: "2026-10-22T11:00:00Z",
    billing_info: {
      next_billing_time: "2026-11-21T10:00:00Z",
      failed_payments_count: 0,
      cycle_executions: [
        { tenure_type: "TRIAL", sequence: 1, cycles_completed: 1, cycles_remaining: 0, total_cycles: 1 },
        { tenure_type: "REGULAR", sequence: 2, cycles_completed: 0, cycles_remaining: 0, total_cycles: 0 },
      ],
    },
  };
  await processPayPalEvent({ id: "WH-FREE", event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "I-FREE" } });
  expect(await siteRow()).toMatchObject({ paypalSubscriptionId: "I-FREE", status: "trialing" });
  vi.setSystemTime(NOW);
}

/** "Start my plan now" (or another plan chosen in the free days): the approval PayPal is sent to. */
async function startNow(planId = growId, id = "I-PAID") {
  state.nextId = id;
  expect(await createPayPalCheckout(planId, siteId)).toEqual({ url: `https://paypal.test/approve/${id}` });
  return checkoutOf(id);
}

/** PayPal's report of the plan started now. */
function payPalReports(status: string, checkoutId: string, { id = "I-PAID", plan = "P-GROW" } = {}) {
  const paid = status === "ACTIVE";
  state.paypal[id] = {
    id,
    status,
    plan_id: plan,
    custom_id: `org_a:${siteId}:${checkoutId}`,
    start_time: "2026-10-25T09:00:00Z",
    billing_info: {
      next_billing_time: "2026-11-25T09:00:00Z",
      failed_payments_count: 0,
      ...(paid
        ? {
            last_payment: { time: "2026-10-25T09:00:05Z", amount: { value: "99.00", currency_code: "EUR" } },
            cycle_executions: [{ tenure_type: "REGULAR", sequence: 1, cycles_completed: 1, cycles_remaining: 0, total_cycles: 0 }],
          }
        : {}),
    },
  };
}

const activated = (id = "I-PAID") =>
  processPayPalEvent({ id: `WH-${id}`, event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id } });

describe("starting the plan during the free articles through PayPal", () => {
  it("opens a PayPal subscription to the plan itself, charged on approval, to take over from the free one", async () => {
    await onFreeArticles();
    const checkout = await startNow();
    expect(paypalMock.createSubscription).toHaveBeenLastCalledWith(expect.objectContaining({ planId: "P-GROW" }));
    expect(checkout).toMatchObject({ status: "open", trialDays: 0, replacesSubscriptionId: "I-FREE", planId: growId });
    // Nothing changes until PayPal has it: the free articles carry on.
    expect(await siteRow()).toMatchObject({ paypalSubscriptionId: "I-FREE", status: "trialing" });
  });

  it("once PayPal activates it, it takes the website and the free subscription is cancelled - nothing charged on it", async () => {
    await onFreeArticles();
    const checkout = await startNow();
    payPalReports("ACTIVE", checkout.id);
    await activated();

    expect(await siteRow()).toMatchObject({ paypalSubscriptionId: "I-PAID", status: "active", planId: growId });
    expect(await rowOf("I-FREE")).toMatchObject({ websiteId: null, claimedWebsiteId: siteId });
    expect(paypalMock.cancelSubscription).toHaveBeenCalledTimes(1);
    expect(paypalMock.cancelSubscription).toHaveBeenCalledWith("I-FREE", "replaced_free_articles");
    expect(await test.db.select().from(providerCancellations)).toEqual([
      expect.objectContaining({ providerSubscriptionId: "I-FREE", reason: "replaced_free_articles", status: "completed" }),
    ]);
    expect(await checkoutOf("I-PAID")).toMatchObject({ status: "completed" });

    // The free articles are over: the paid month with the plan's own allowance.
    expect(isFreeArticlesTrial(await siteRow())).toBe(false);
    expect(await checkLimit(siteId, "articles")).toMatchObject({ allowed: true, limit: 30 });

    // PayPal reports the free one cancelled: recorded, still detached; the plan is untouched.
    await processPayPalEvent({ id: "WH-CANCEL", event_type: "BILLING.SUBSCRIPTION.CANCELLED", resource: { id: "I-FREE" } });
    expect(await rowOf("I-FREE")).toMatchObject({ websiteId: null, status: "canceled" });
    expect(await siteRow()).toMatchObject({ paypalSubscriptionId: "I-PAID", status: "active" });
  });

  it("starts another plan the same way when one is chosen during the free days", async () => {
    await onFreeArticles();
    const checkout = await startNow(scaleId);
    expect(paypalMock.createSubscription).toHaveBeenLastCalledWith(expect.objectContaining({ planId: "P-SCALE" }));
    payPalReports("ACTIVE", checkout.id, { plan: "P-SCALE" });
    await activated();
    expect(await siteRow()).toMatchObject({ paypalSubscriptionId: "I-PAID", status: "active", planId: scaleId });
    expect(paypalMock.cancelSubscription).toHaveBeenCalledWith("I-FREE", "replaced_free_articles");
  });

  it("sends a second press back to the same PayPal approval", async () => {
    await onFreeArticles();
    const checkout = await startNow();
    payPalReports("APPROVAL_PENDING", checkout.id);
    expect(await createPayPalCheckout(growId, siteId)).toEqual({ url: "https://paypal.test/approve/I-PAID" });
    expect(paypalMock.createSubscription).toHaveBeenCalledTimes(2); // the free articles' own, and this one
  });

  it("is refused by card: the website is billed through PayPal", async () => {
    await onFreeArticles();
    expect(
      await beginCheckout(test.db as never, { organizationId: "org_a", websiteId: siteId, provider: "stripe", planId: growId }, checkoutProviderOps),
    ).toEqual({ kind: "refuse", error: expect.stringMatching(/already billed by PayPal/) });
  });
});

describe("while PayPal has it approved but not yet active", () => {
  it("records nothing, and the PayPal return keeps asking until PayPal activates it", async () => {
    await onFreeArticles();
    const checkout = await startNow();
    payPalReports("APPROVED", checkout.id);

    expect(await confirmPayPalReturn(siteId, "success")).toEqual({ changed: false, paid: false, waiting: true });
    expect(await rowOf("I-PAID")).toBeUndefined();
    expect(await siteRow()).toMatchObject({ paypalSubscriptionId: "I-FREE", status: "trialing" });
    expect(await checkoutOf("I-PAID")).toMatchObject({ status: "open" });
    expect(paypalMock.cancelSubscription).not.toHaveBeenCalled();

    payPalReports("ACTIVE", checkout.id);
    expect(await confirmPayPalReturn(siteId, "success")).toEqual({ changed: true, paid: true, waiting: false });
    expect(await siteRow()).toMatchObject({ paypalSubscriptionId: "I-PAID", status: "active" });
    expect(paypalMock.cancelSubscription).toHaveBeenCalledWith("I-FREE", "replaced_free_articles");
  });

  it("the reconciler leaves its checkout open, and records it once PayPal has activated it", async () => {
    await onFreeArticles();
    const checkout = await startNow();
    payPalReports("APPROVED", checkout.id);

    // Asked about once it has gone unchecked for a quarter of an hour.
    await reconcileCheckouts(test.db, checkoutProviderOps, new Date(NOW.getTime() + 16 * MINUTE));
    expect(await checkoutOf("I-PAID")).toMatchObject({ status: "open", providerState: "approved" });
    expect(await rowOf("I-PAID")).toBeUndefined();

    payPalReports("ACTIVE", checkout.id);
    await reconcileCheckouts(test.db, checkoutProviderOps, new Date(NOW.getTime() + 32 * MINUTE));
    expect(await checkoutOf("I-PAID")).toMatchObject({ status: "completed" });
    expect(await siteRow()).toMatchObject({ paypalSubscriptionId: "I-PAID", status: "active" });
    expect(await rowOf("I-FREE")).toMatchObject({ websiteId: null });
  });
});

describe("the unusual orders of events", () => {
  it("an approval the customer walked away from, approved after all, still starts the plan - and is not cancelled", async () => {
    await onFreeArticles();
    const checkout = await startNow();
    payPalReports("APPROVAL_PENDING", checkout.id);
    expect(await confirmPayPalReturn(siteId, "cancelled")).toMatchObject({ changed: true });
    expect(await checkoutOf("I-PAID")).toMatchObject({ status: "released" });

    payPalReports("ACTIVE", checkout.id);
    await activated();
    expect(await siteRow()).toMatchObject({ paypalSubscriptionId: "I-PAID", status: "active" });
    expect(paypalMock.cancelSubscription).toHaveBeenCalledTimes(1);
    expect(paypalMock.cancelSubscription).toHaveBeenCalledWith("I-FREE", "replaced_free_articles");
  });

  it("free articles cancelled before the plan starts: the plan simply attaches, with nothing left to cancel", async () => {
    await onFreeArticles();
    const checkout = await startNow();
    await cancelFree();
    expect(await siteRow()).toMatchObject({ paypalSubscriptionId: "I-FREE", status: "canceled" });

    payPalReports("ACTIVE", checkout.id);
    await activated();
    expect(await siteRow()).toMatchObject({ paypalSubscriptionId: "I-PAID", status: "active" });
    expect(await rowOf("I-FREE")).toMatchObject({ websiteId: null, status: "canceled" });
    expect(paypalMock.cancelSubscription).toHaveBeenCalledTimes(1); // the customer's own, below
    expect(await test.db.select().from(providerCancellations)).toEqual([]);

    async function cancelFree() {
      await paypalMock.cancelSubscription("I-FREE");
      await processPayPalEvent({ id: "WH-CANCEL", event_type: "BILLING.SUBSCRIPTION.CANCELLED", resource: { id: "I-FREE" } });
    }
  });

  it("a payment PayPal took on the free subscription anyway is listed for a refund, until it is refunded", async () => {
    await onFreeArticles();
    const checkout = await startNow();
    payPalReports("ACTIVE", checkout.id);
    await activated();

    // A zero sale for the free cycle moved no money: nothing to refund.
    await sale("SALE-ZERO", "I-FREE", "0.00");
    expect(await runReconciliation(test.db, "replacedFreeArticlesToRefund")).toEqual([]);
    // The plan's own first payment is not the free one's.
    await sale("SALE-PAID", "I-PAID", "99.00");
    expect(await runReconciliation(test.db, "replacedFreeArticlesToRefund")).toEqual([]);

    // The free days had run out first, and PayPal billed them.
    await sale("SALE-RACE", "I-FREE", "99.00");
    expect(await runReconciliation(test.db, "replacedFreeArticlesToRefund")).toEqual([
      expect.objectContaining({ provider_subscription_id: "I-FREE", sale_id: "SALE-RACE", amount_cents: 9900 }),
    ]);
    const [recorded] = await test.db.select().from(payments).where(eq(payments.externalId, "SALE-PAID"));
    expect(recorded).toMatchObject({ subscriptionId: (await siteRow()).id });

    await processPayPalEvent({
      id: "WH-REFUND",
      event_type: "PAYMENT.SALE.REFUNDED",
      resource: { id: "REFUND-1", sale_id: "SALE-RACE", amount: { total: "99.00", currency: "EUR" } },
    });
    expect(await runReconciliation(test.db, "replacedFreeArticlesToRefund")).toEqual([]);
  });

  it("a subscription that is not the one the checkout replaces is never taken over from", async () => {
    await onFreeArticles();
    const checkout = await startNow();
    // Pointed at some other subscription (a hand edit): the site's free articles are not it.
    await test.db.update(billingCheckouts).set({ replacesSubscriptionId: "I-SOMETHING-ELSE" }).where(eq(billingCheckouts.id, checkout.id));
    payPalReports("ACTIVE", checkout.id);
    await activated();
    expect(await siteRow()).toMatchObject({ paypalSubscriptionId: "I-FREE", status: "trialing" });
    expect(await rowOf("I-PAID")).toMatchObject({ websiteId: null, claimedWebsiteId: siteId });
    expect(paypalMock.cancelSubscription).not.toHaveBeenCalled();
    const [latest] = await test.db.select().from(billingCheckouts).orderBy(desc(billingCheckouts.createdAt)).limit(1);
    expect(latest).toMatchObject({ status: "completed" });
  });
});

/** A PayPal sale on a subscription, as its webhook reports it. */
async function sale(id: string, subscriptionId: string, total: string) {
  await processPayPalEvent({
    id: `WH-${id}`,
    event_type: "PAYMENT.SALE.COMPLETED",
    resource: { id, billing_agreement_id: subscriptionId, amount: { total, currency: "EUR" } },
  });
}
