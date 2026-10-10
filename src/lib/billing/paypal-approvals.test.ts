import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
 * What happens after the customer leaves for PayPal: the return and cancel
 * redirects (lib/paypal/actions.ts confirmPayPalReturn), the reconciler, and
 * a walked-away approval that activates anyway. The real actions, ledger and
 * sync run against a disposable PGlite; PayPal and Stripe are replaced at
 * their SDK boundary, so nothing leaves the test.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  orgId: "org_a",
  context: null as unknown,
  /** The subscription as PayPal reports it now. */
  paypal: null as Record<string, unknown> | null,
}));

const paypalMock = vi.hoisted(() => ({
  createSubscription: vi.fn(),
  getSubscription: vi.fn(),
  cancelSubscription: vi.fn(),
}));
const stripeMock = vi.hoisted(() => ({
  sessionsCreate: vi.fn(),
  sessionsExpire: vi.fn(),
  sessionsRetrieve: vi.fn(),
  sessionsList: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/inngest/send", () => ({ queueJob: vi.fn() }));
vi.mock("@/lib/admin/guard", () => ({ requireAdmin: vi.fn(async () => ({ email: "ops@example.test" })) }));
vi.mock("@/lib/backlinks/credits", () => ({ recordCredit: vi.fn(), getBalance: vi.fn() }));
vi.mock("@/lib/usage", () => ({ checkLimit: vi.fn() }));
vi.mock("@/lib/referrals/core", () => ({ convertReferral: vi.fn(), reverseReferralReward: vi.fn() }));
vi.mock("@/lib/stripe/customer", () => ({ getOrCreateCustomer: vi.fn(async () => "cus_test") }));
vi.mock("@/lib/stripe/client", () => ({
  isStripeConfigured: () => true,
  stripe: {
    checkout: {
      sessions: {
        create: stripeMock.sessionsCreate,
        expire: stripeMock.sessionsExpire,
        retrieve: stripeMock.sessionsRetrieve,
        list: stripeMock.sessionsList,
      },
    },
    subscriptions: { retrieve: vi.fn() },
  },
}));
vi.mock("@/lib/paypal/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paypal/client")>()),
  isPayPalConfigured: () => true,
}));
vi.mock("@/lib/paypal/subscriptions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paypal/subscriptions")>()),
  createSubscription: paypalMock.createSubscription,
  getSubscription: paypalMock.getSubscription,
  cancelSubscription: paypalMock.cancelSubscription,
}));
vi.mock("@/lib/auth-guard", () => ({
  requireSession: vi.fn(async () => ({
    user: { id: "user_1", email: "owner@example.test", emailVerified: true },
  })),
}));
vi.mock("@/lib/tenant", () => {
  class WebsiteNotFoundError extends Error {}
  return {
    WebsiteNotFoundError,
    requireOrg: vi.fn(async () => ({ orgId: state.orgId, userId: "user_1", role: "owner" })),
    requireWebsite: vi.fn(async () => {
      if (!state.context) throw new WebsiteNotFoundError();
      return state.context;
    }),
  };
});

import { checkoutProviderOps } from "@/lib/billing/checkout-providers";
import { reconcileCheckouts } from "@/lib/billing/checkouts";
import { processPayPalEvent } from "@/lib/billing/paypal-events";
import { runReconciliation } from "@/lib/billing/reconciliation";
import { confirmPayPalReturn, createPayPalCheckout } from "@/lib/paypal/actions";
import { createCheckoutSession } from "@/lib/stripe/actions";
import { deleteWebsite } from "@/lib/websites/actions";

let test: TestDb;
let planId: string;

beforeAll(async () => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.test");
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  state.orgId = "org_a";
  state.context = null;
  state.paypal = null;
  await test.client.exec(`
    delete from provider_cancellations;
    delete from payments;
    delete from billing_checkouts;
    delete from subscriptions;
    delete from websites;
    delete from organization;
    delete from plans;
  `);
  await test.db.insert(organization).values([
    { id: "org_a", name: "Acme", slug: "acme", createdAt: new Date() },
    { id: "org_b", name: "Other", slug: "other", createdAt: new Date() },
  ]);
  const [plan] = await test.db
    .insert(plans)
    .values({
      name: "Grow",
      tier: "grow",
      stripePriceId: "price_grow",
      paypalPlanId: "P-GROW",
      priceCents: 9900,
      articleLimit: 30,
      keywordLimit: 100,
      siteLimit: 1,
      monthlyCredits: 0,
    })
    .returning();
  planId = plan.id;

  paypalMock.createSubscription.mockImplementation(async () => ({
    subscriptionId: "I-APPROVAL",
    approveUrl: "https://paypal.test/approve",
  }));
  paypalMock.getSubscription.mockImplementation(async () => state.paypal);
  paypalMock.cancelSubscription.mockImplementation(async () => {
    if (state.paypal) state.paypal = { ...state.paypal, status: "CANCELLED" };
  });
  stripeMock.sessionsCreate.mockImplementation(async () => ({
    id: "cs_card",
    url: "https://checkout.stripe.test/cs_card",
    expires_at: Math.floor(Date.now() / 1000) + 24 * 3600,
  }));
});

async function addSite(organizationId = "org_a", domain = "acme.test") {
  const [site] = await test.db
    .insert(websites)
    .values({ organizationId, url: `https://${domain}`, domain })
    .returning();
  return site;
}

/** Starts a PayPal checkout for the site, as the PayPal button does. */
async function startPayPal(site: typeof websites.$inferSelect) {
  expect(await createPayPalCheckout(planId, site.id)).toEqual({ url: "https://paypal.test/approve" });
  const [checkout] = await test.db.select().from(billingCheckouts);
  return checkout;
}

/** PayPal's answer for our approval, in the shape it reports a subscription. */
function payPalReports(
  status: string,
  site: typeof websites.$inferSelect,
  checkout: typeof billingCheckouts.$inferSelect,
) {
  state.paypal = {
    id: "I-APPROVAL",
    status,
    plan_id: "P-GROW",
    custom_id: `${site.organizationId}:${site.id}:${checkout.id}`,
    start_time: "2026-10-10T08:00:00Z",
    billing_info: { next_billing_time: "2026-11-10T08:00:00Z" },
  };
}

async function checkoutRow() {
  const [row] = await test.db.select().from(billingCheckouts).where(eq(billingCheckouts.provider, "paypal"));
  return row;
}

async function paypalRow() {
  const [row] = await test.db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.paypalSubscriptionId, "I-APPROVAL"));
  return row;
}

describe("coming back through PayPal's Cancel and return (H1)", () => {
  it("releases an approval PayPal still reports pending, so card checkout and deletion work", async () => {
    const site = await addSite();
    const checkout = await startPayPal(site);
    payPalReports("APPROVAL_PENDING", site, checkout);

    // Before: the pending approval blocks paying by card.
    expect(await createCheckoutSession(planId, site.id)).toEqual({
      error: expect.stringMatching(/PayPal approval/),
    });

    expect(await confirmPayPalReturn(site.id, "cancelled")).toEqual({ changed: true, waiting: false });
    expect(await checkoutRow()).toMatchObject({ status: "released", providerState: "approval_pending" });
    // Nothing recorded, nothing cancelled: PayPal has nothing to cancel yet.
    expect(await test.db.select().from(subscriptions)).toHaveLength(0);
    expect(paypalMock.cancelSubscription).not.toHaveBeenCalled();

    expect(await createCheckoutSession(planId, site.id)).toEqual({ url: "https://checkout.stripe.test/cs_card" });
  });

  it("lets the website be deleted once the approval is released", async () => {
    const site = await addSite();
    const checkout = await startPayPal(site);
    payPalReports("APPROVAL_PENDING", site, checkout);
    state.context = { site, access: "owner", orgId: site.organizationId, userId: "user_1", role: "owner" };

    expect((await deleteWebsite(site.id)).ok).toBe(false);
    await confirmPayPalReturn(site.id, "cancelled");
    expect((await deleteWebsite(site.id)).ok).toBe(true);
  });

  it("does not release what PayPal reports approved - it records it instead", async () => {
    const site = await addSite();
    const checkout = await startPayPal(site);
    payPalReports("ACTIVE", site, checkout);

    expect(await confirmPayPalReturn(site.id, "cancelled")).toMatchObject({ changed: true });
    expect(await checkoutRow()).toMatchObject({ status: "completed" });
    expect(await paypalRow()).toMatchObject({ websiteId: site.id, status: "active", planId });
  });

  it("marks an approval PayPal reports ended as expired", async () => {
    const site = await addSite();
    const checkout = await startPayPal(site);
    payPalReports("EXPIRED", site, checkout);

    await confirmPayPalReturn(site.id, "cancelled");
    expect(await checkoutRow()).toMatchObject({ status: "expired", providerState: "ended" });
  });

  it("acts only for a website of the signed-in workspace", async () => {
    const site = await addSite();
    const checkout = await startPayPal(site);
    payPalReports("APPROVAL_PENDING", site, checkout);

    state.orgId = "org_b";
    expect(await confirmPayPalReturn(site.id, "cancelled")).toEqual({ changed: false, waiting: false });
    expect(paypalMock.getSubscription).not.toHaveBeenCalled();
    expect(await checkoutRow()).toMatchObject({ status: "open" });
  });

  it("leaves the checkout as it was when PayPal cannot be asked", async () => {
    const site = await addSite();
    await startPayPal(site);
    paypalMock.getSubscription.mockRejectedValueOnce(new Error("ECONNRESET"));

    expect(await confirmPayPalReturn(site.id, "cancelled")).toEqual({ changed: false, waiting: false });
    expect(await checkoutRow()).toMatchObject({ status: "open" });
  });
});

describe("coming back from PayPal approved (M4)", () => {
  it("records the subscription from PayPal without waiting for the webhook", async () => {
    const site = await addSite();
    const checkout = await startPayPal(site);
    payPalReports("ACTIVE", site, checkout);

    expect(await confirmPayPalReturn(site.id, "success")).toEqual({ changed: true, waiting: false });
    expect(await paypalRow()).toMatchObject({ websiteId: site.id, status: "active", planId, provider: "paypal" });
    expect(await checkoutRow()).toMatchObject({ status: "completed", providerSubscriptionId: "I-APPROVAL" });

    // The webhook arriving afterwards changes nothing.
    await processPayPalEvent({ id: "WH-1", event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "I-APPROVAL" } });
    expect(await test.db.select().from(subscriptions)).toHaveLength(1);
  });

  it("keeps asking while PayPal is still activating, and records it once active", async () => {
    const site = await addSite();
    const checkout = await startPayPal(site);
    payPalReports("APPROVED", site, checkout);

    expect(await confirmPayPalReturn(site.id, "success")).toEqual({ changed: true, waiting: true });
    expect(await paypalRow()).toMatchObject({ status: "incomplete" });

    payPalReports("ACTIVE", site, checkout);
    expect(await confirmPayPalReturn(site.id, "success")).toEqual({ changed: true, waiting: false });
    expect(await paypalRow()).toMatchObject({ status: "active" });

    // Recorded and active: a later return has nothing left to read.
    paypalMock.getSubscription.mockClear();
    expect(await confirmPayPalReturn(site.id, "success")).toEqual({ changed: false, waiting: false });
    expect(paypalMock.getSubscription).not.toHaveBeenCalled();
  });

  it("writes nothing while PayPal still awaits the approval, and never releases it", async () => {
    const site = await addSite();
    const checkout = await startPayPal(site);
    payPalReports("APPROVAL_PENDING", site, checkout);

    expect(await confirmPayPalReturn(site.id, "success")).toEqual({ changed: false, waiting: true });
    expect(await test.db.select().from(subscriptions)).toHaveLength(0);
    expect(await checkoutRow()).toMatchObject({ status: "open", providerState: "approval_pending" });
  });

  it("does not record another workspace's checkout", async () => {
    const theirs = await addSite("org_b", "theirs.test");
    state.orgId = "org_b";
    const checkout = await startPayPal(theirs);
    payPalReports("ACTIVE", theirs, checkout);

    state.orgId = "org_a";
    expect(await confirmPayPalReturn(theirs.id, "success")).toEqual({ changed: false, waiting: false });
    expect(await test.db.select().from(subscriptions)).toHaveLength(0);
  });
});

describe("the reconciler records an approval whose webhook never came (M4)", () => {
  // Past the in-flight window, and past the quarter hour before a checked row is asked again.
  const later = () => new Date(Date.now() + 20 * 60 * 1000);

  it("syncs a live approval and marks its checkout completed", async () => {
    const site = await addSite();
    const checkout = await startPayPal(site);
    payPalReports("ACTIVE", site, checkout);

    expect(await reconcileCheckouts(test.db, checkoutProviderOps, later())).toBe(1);
    expect(await paypalRow()).toMatchObject({ websiteId: site.id, status: "active" });
    expect(await checkoutRow()).toMatchObject({ status: "completed" });
  });

  it("leaves the checkout open to be asked again when recording fails", async () => {
    const site = await addSite();
    const checkout = await startPayPal(site);
    payPalReports("ACTIVE", site, checkout);
    const ops = { ...checkoutProviderOps, syncPayPalSubscription: vi.fn(async () => { throw new Error("database busy"); }) };

    expect(await reconcileCheckouts(test.db, ops, later())).toBe(0);
    expect(await checkoutRow()).toMatchObject({ status: "open" });
  });
});

describe("a released approval approved after all (H1 safety net)", () => {
  /** The site moved on to a card subscription after the PayPal approval was released. */
  async function releasedThenPaidByCard() {
    const site = await addSite();
    const checkout = await startPayPal(site);
    payPalReports("APPROVAL_PENDING", site, checkout);
    await confirmPayPalReturn(site.id, "cancelled");
    await test.db.insert(subscriptions).values({
      organizationId: "org_a",
      websiteId: site.id,
      status: "active",
      stripeSubscriptionId: "sub_card",
      planId,
    });
    return { site, checkout };
  }

  it("cancels it, keeps the card plan, and lists its payment for a refund", async () => {
    const { site, checkout } = await releasedThenPaidByCard();
    payPalReports("ACTIVE", site, checkout);

    await processPayPalEvent({ id: "WH-1", event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "I-APPROVAL" } });

    expect(paypalMock.cancelSubscription).toHaveBeenCalledWith("I-APPROVAL", "detached_released_approval");
    const [owed] = await test.db.select().from(providerCancellations);
    expect(owed).toMatchObject({ providerSubscriptionId: "I-APPROVAL", reason: "detached_released_approval", status: "completed" });
    expect(await paypalRow()).toMatchObject({ websiteId: null, claimedWebsiteId: site.id });
    const [card] = await test.db.select().from(subscriptions).where(eq(subscriptions.websiteId, site.id));
    expect(card).toMatchObject({ stripeSubscriptionId: "sub_card", status: "active" });
    expect(vi.mocked(console.error)).toHaveBeenCalledWith(expect.stringMatching(/REFUND its first payment in PayPal/));

    // PayPal took the first payment on activation: it shows up to be refunded.
    await processPayPalEvent({
      id: "WH-2",
      event_type: "PAYMENT.SALE.COMPLETED",
      resource: { id: "SALE-1", billing_agreement_id: "I-APPROVAL", amount: { total: "99.00", currency: "EUR" } },
    });
    expect(await runReconciliation(test.db, "releasedApprovalsToRefund")).toEqual([
      expect.objectContaining({ provider_subscription_id: "I-APPROVAL", sale_id: "SALE-1", amount_cents: 9900 }),
    ]);

    // Refunded in PayPal: off the list.
    await processPayPalEvent({
      id: "WH-3",
      event_type: "PAYMENT.SALE.REFUNDED",
      resource: { id: "REFUND-1", sale_id: "SALE-1", amount: { total: "99.00", currency: "EUR" } },
    });
    expect(await runReconciliation(test.db, "releasedApprovalsToRefund")).toEqual([]);
    expect(await test.db.select().from(payments)).toEqual([expect.objectContaining({ status: "refunded" })]);
  });

  it("is caught by the reconciler even when its webhook never comes", async () => {
    const { site, checkout } = await releasedThenPaidByCard();
    payPalReports("ACTIVE", site, checkout);

    // A released approval is asked about every few hours, not every run.
    await reconcileCheckouts(test.db, checkoutProviderOps, new Date(Date.now() + 7 * 60 * 60 * 1000));

    expect(paypalMock.cancelSubscription).toHaveBeenCalledWith("I-APPROVAL", "detached_released_approval");
    expect(await paypalRow()).toMatchObject({ websiteId: null });
  });

  it("is simply attached when the website has no other plan: the customer changed their mind", async () => {
    const site = await addSite();
    const checkout = await startPayPal(site);
    payPalReports("APPROVAL_PENDING", site, checkout);
    await confirmPayPalReturn(site.id, "cancelled");

    payPalReports("ACTIVE", site, checkout);
    await processPayPalEvent({ id: "WH-1", event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "I-APPROVAL" } });

    expect(paypalMock.cancelSubscription).not.toHaveBeenCalled();
    expect(await paypalRow()).toMatchObject({ websiteId: site.id, status: "active" });
    expect(await checkoutRow()).toMatchObject({ status: "completed" });
  });

  it("still leaves a duplicate that was never released for the customer to choose", async () => {
    const site = await addSite();
    const checkout = await startPayPal(site);
    await test.db.insert(subscriptions).values({
      organizationId: "org_a",
      websiteId: site.id,
      status: "active",
      stripeSubscriptionId: "sub_card",
    });
    payPalReports("ACTIVE", site, checkout);

    await processPayPalEvent({ id: "WH-1", event_type: "BILLING.SUBSCRIPTION.ACTIVATED", resource: { id: "I-APPROVAL" } });

    expect(paypalMock.cancelSubscription).not.toHaveBeenCalled();
    expect(await test.db.select().from(providerCancellations)).toHaveLength(0);
    expect(await paypalRow()).toMatchObject({ websiteId: null, claimedWebsiteId: site.id });
  });
});
