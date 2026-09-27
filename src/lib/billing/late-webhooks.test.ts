import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  billingCheckouts,
  organization,
  payments,
  providerCancellations,
  subscriptions,
  webhookEvents,
  websites,
} from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * Late Stripe and PayPal events after a website or workspace was deleted,
 * driven through the real webhook routes against a disposable PGlite.
 * Signature checks and provider calls are stubbed; nothing leaves the test.
 *
 * The rules under test (lib/billing/subscription-sync.ts): a subscription is
 * matched by its provider id first; a known row is never re-pointed; a
 * deleted website is never recreated and its subscription never attached to
 * another site; a subscription for a deleted website or workspace is
 * cancelled; and every one of these answers 200, so the provider does not
 * retry for days.
 */

const state = vi.hoisted(() => ({
  db: null as unknown,
  event: null as unknown,
  subscription: null as unknown,
  paypal: null as unknown,
}));

const stripeMock = vi.hoisted(() => ({
  cancel: vi.fn(),
}));
const paypalMock = vi.hoisted(() => ({
  cancel: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "stripe-signature": "t=1,v1=test" }),
}));
vi.mock("@/lib/addons/fulfil", () => ({ fulfilAddonPurchase: vi.fn() }));
vi.mock("@/lib/referrals/core", () => ({ convertReferral: vi.fn() }));
vi.mock("@/lib/stripe/client", () => ({
  isStripeConfigured: () => true,
  stripe: {
    webhooks: { constructEventAsync: async () => state.event },
    subscriptions: {
      retrieve: async () => state.subscription,
      cancel: stripeMock.cancel,
    },
    checkout: { sessions: {} },
  },
}));
vi.mock("@/lib/paypal/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paypal/client")>()),
  isPayPalConfigured: () => true,
  payPalRequest: async () => ({ verification_status: "SUCCESS" }),
}));
vi.mock("@/lib/paypal/subscriptions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/paypal/subscriptions")>()),
  getSubscription: async () => state.paypal,
  cancelSubscription: paypalMock.cancel,
}));

import { POST as paypalWebhook } from "@/app/api/paypal/webhook/route";
import { processCancellations } from "@/lib/billing/cancellations";
import { claimWebhookEvent, completeWebhookEvent } from "@/lib/billing/webhook-events";
import { recoverWebhookEvents } from "@/lib/billing/webhook-recovery";
import { cancellationOps } from "@/lib/billing/checkout-providers";
import { POST as stripeWebhook } from "@/app/api/stripe/webhook/route";

let test: TestDb;
let eventCounter = 0;

beforeAll(async () => {
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  vi.stubEnv("PAYPAL_WEBHOOK_ID", "WH-TEST");
  test = await createTestDb();
  state.db = test.db;
});

beforeEach(async () => {
  vi.clearAllMocks();
  stripeMock.cancel.mockResolvedValue({ status: "canceled" });
  paypalMock.cancel.mockResolvedValue(undefined);
  await test.client.exec(`
    delete from provider_cancellations;
    delete from webhook_events;
    delete from billing_checkouts;
    delete from payments;
    delete from subscriptions;
    delete from websites;
    delete from organization;
  `);
  await test.db.insert(organization).values([
    { id: "org_a", name: "Acme", slug: "acme", createdAt: new Date() },
    { id: "org_b", name: "Other", slug: "other", createdAt: new Date() },
  ]);
});

async function addSite(organizationId = "org_a", domain = "acme.test") {
  const [site] = await test.db
    .insert(websites)
    .values({ organizationId, url: `https://${domain}`, domain })
    .returning();
  return site;
}

/** A website that existed, and no longer does. */
async function deletedSiteId(organizationId = "org_a") {
  const site = await addSite(organizationId, `gone-${eventCounter}.test`);
  await test.db.delete(websites).where(eq(websites.id, site.id));
  return site.id;
}

function stripeSubscription(
  id: string,
  status: string,
  metadata: Record<string, string>,
) {
  return {
    id,
    status,
    customer: "cus_test",
    metadata,
    cancel_at_period_end: false,
    items: {
      data: [
        {
          price: { id: "price_unknown" },
          current_period_start: 1_790_000_000,
          current_period_end: 1_792_600_000,
        },
      ],
    },
  };
}

/**
 * Delivers a Stripe event whose body is `subscription`. The provider's
 * CURRENT state (what retrieve returns) is the same unless the test set it
 * separately and passes keepProviderState.
 */
async function sendStripe(
  type: string,
  subscription: unknown,
  options: { keepProviderState?: boolean } = {},
) {
  eventCounter += 1;
  if (!options.keepProviderState) state.subscription = subscription;
  state.event = {
    id: `evt_${eventCounter}`,
    type,
    data: { object: subscription },
  };
  const response = await stripeWebhook(
    new Request("https://app.example.test/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    }),
  );
  return response.status;
}

async function sendPayPal(
  type: string,
  resource: Record<string, unknown>,
  live: { id: string; status: string; custom_id: string },
) {
  eventCounter += 1;
  state.paypal = live;
  const body = JSON.stringify({ id: `WH-${eventCounter}`, event_type: type, resource });
  const response = await paypalWebhook(
    new Request("https://app.example.test/api/paypal/webhook", {
      method: "POST",
      body,
      headers: {
        "paypal-auth-algo": "x",
        "paypal-cert-url": "x",
        "paypal-transmission-id": "x",
        "paypal-transmission-sig": "x",
        "paypal-transmission-time": "x",
      },
    }),
  );
  return response.status;
}

async function subscriptionRows() {
  return test.db.select().from(subscriptions);
}

describe("Stripe: checkout opened before deletion, completed after", () => {
  it("records the subscription unattached, cancels it, and answers 200", async () => {
    const goneId = await deletedSiteId();
    const other = await addSite("org_a", "still-here.test");
    const [checkout] = await test.db
      .insert(billingCheckouts)
      .values({
        organizationId: "org_a",
        websiteId: null,
        provider: "stripe",
        status: "abandoned",
        stripeSessionId: "cs_late",
      })
      .returning();

    const status = await sendStripe(
      "customer.subscription.created",
      stripeSubscription("sub_late", "trialing", {
        organizationId: "org_a",
        websiteId: goneId,
        checkoutId: checkout.id,
      }),
    );

    expect(status).toBe(200);
    // Asked first, then cancelled once, idempotently.
    expect(stripeMock.cancel).toHaveBeenCalledWith("sub_late", {}, {
      idempotencyKey: "owed-cancel:sub_late",
    });
    const [row] = await subscriptionRows();
    expect(row).toMatchObject({
      organizationId: "org_a",
      websiteId: null,
      stripeSubscriptionId: "sub_late",
      stripeCustomerId: "cus_test",
    });
    // Not recreated, not moved to the site that still exists.
    expect(await test.db.select().from(websites)).toEqual([
      expect.objectContaining({ id: other.id }),
    ]);
    const [updatedCheckout] = await test.db.select().from(billingCheckouts);
    expect(updatedCheckout).toMatchObject({
      status: "completed",
      providerSubscriptionId: "sub_late",
    });
  });

  /*
    Review correction: the retry used to depend on "the next event". The
    obligation is now a row, retried on its own schedule - here with NO
    further event from Stripe.
  */
  it("still answers 200 when the cancellation fails, and retries it without another event", async () => {
    const goneId = await deletedSiteId();
    stripeMock.cancel.mockRejectedValueOnce(new Error("Stripe is down"));
    const subscription = stripeSubscription("sub_late", "trialing", {
      organizationId: "org_a",
      websiteId: goneId,
    });

    expect(await sendStripe("customer.subscription.created", subscription)).toBe(200);
    expect(stripeMock.cancel).toHaveBeenCalledTimes(1);
    const [owed] = await test.db.select().from(providerCancellations);
    expect(owed).toMatchObject({ status: "pending", attempts: 1, providerSubscriptionId: "sub_late" });

    // The billing-maintenance job, a few minutes later.
    const later = new Date(Date.now() + 5 * 60 * 1000);
    const result = await processCancellations(test.db, cancellationOps, { now: later });
    expect(result.completed).toEqual(["sub_late"]);
    expect(stripeMock.cancel).toHaveBeenCalledTimes(2);
    const [done] = await test.db.select().from(providerCancellations);
    expect(done.status).toBe("completed");
    expect(await subscriptionRows()).toHaveLength(1);
  });

  it("does not cancel twice when a later event re-derives the same obligation", async () => {
    const goneId = await deletedSiteId();
    const subscription = stripeSubscription("sub_late", "trialing", {
      organizationId: "org_a",
      websiteId: goneId,
    });
    await sendStripe("customer.subscription.created", subscription);
    // Stripe now reports it cancelled; a duplicate "updated" arrives late.
    state.subscription = { ...subscription, status: "canceled" };
    await sendStripe("customer.subscription.updated", subscription, { keepProviderState: true });

    expect(stripeMock.cancel).toHaveBeenCalledTimes(1);
  });
});

describe("Stripe: late events for a retained subscription", () => {
  it("updates a deleted site's ended subscription in place, without cancelling", async () => {
    const goneId = await deletedSiteId();
    await test.db.insert(subscriptions).values({
      organizationId: "org_a",
      websiteId: null,
      status: "canceled",
      stripeSubscriptionId: "sub_old",
    });

    const status = await sendStripe(
      "customer.subscription.deleted",
      stripeSubscription("sub_old", "canceled", {
        organizationId: "org_a",
        websiteId: goneId,
      }),
    );

    expect(status).toBe(200);
    expect(stripeMock.cancel).not.toHaveBeenCalled();
    const rows = await subscriptionRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ websiteId: null, status: "canceled" });
    expect(rows[0].currentPeriodEnd).toBeInstanceOf(Date);
  });

  it("never re-attaches a retained subscription, even when metadata names a live site", async () => {
    const site = await addSite();
    await test.db.insert(subscriptions).values({
      organizationId: "org_a",
      websiteId: null,
      status: "canceled",
      stripeSubscriptionId: "sub_old",
    });

    await sendStripe(
      "customer.subscription.updated",
      stripeSubscription("sub_old", "canceled", {
        organizationId: "org_a",
        websiteId: site.id,
      }),
    );

    const [row] = await subscriptionRows();
    expect(row.websiteId).toBeNull();
  });

  it("does not let an old subscription's event overwrite the site's current plan", async () => {
    const site = await addSite();
    await test.db.insert(subscriptions).values({
      organizationId: "org_a",
      websiteId: site.id,
      status: "active",
      stripeSubscriptionId: "sub_new",
    });

    const status = await sendStripe(
      "customer.subscription.deleted",
      stripeSubscription("sub_forgotten", "canceled", {
        organizationId: "org_a",
        websiteId: site.id,
      }),
    );

    expect(status).toBe(200);
    const current = await test.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.websiteId, site.id));
    expect(current).toEqual([
      expect.objectContaining({ stripeSubscriptionId: "sub_new", status: "active" }),
    ]);
    expect(await subscriptionRows()).toHaveLength(2);
  });

  it("replaces an ended plan with a new one, keeping the old row's identity", async () => {
    const site = await addSite();
    await test.db.insert(subscriptions).values({
      organizationId: "org_a",
      websiteId: site.id,
      status: "canceled",
      stripeSubscriptionId: "sub_old",
    });

    await sendStripe(
      "customer.subscription.created",
      stripeSubscription("sub_new", "trialing", {
        organizationId: "org_a",
        websiteId: site.id,
      }),
    );

    const rows = await subscriptionRows();
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.stripeSubscriptionId === "sub_new")?.websiteId).toBe(site.id);
    expect(rows.find((r) => r.stripeSubscriptionId === "sub_old")?.websiteId).toBeNull();
    expect(stripeMock.cancel).not.toHaveBeenCalled();
  });

  it("records a second live subscription for a site without cancelling either", async () => {
    const site = await addSite();
    await test.db.insert(subscriptions).values({
      organizationId: "org_a",
      websiteId: site.id,
      status: "active",
      stripeSubscriptionId: "sub_first",
    });

    expect(
      await sendStripe(
        "customer.subscription.created",
        stripeSubscription("sub_second", "active", {
          organizationId: "org_a",
          websiteId: site.id,
        }),
      ),
    ).toBe(200);

    const rows = await subscriptionRows();
    expect(rows.find((r) => r.stripeSubscriptionId === "sub_first")?.websiteId).toBe(site.id);
    expect(rows.find((r) => r.stripeSubscriptionId === "sub_second")?.websiteId).toBeNull();
    expect(stripeMock.cancel).not.toHaveBeenCalled();
  });

  it("never attaches to a website in another workspace", async () => {
    const foreign = await addSite("org_b", "theirs.test");

    await sendStripe(
      "customer.subscription.created",
      stripeSubscription("sub_tampered", "active", {
        organizationId: "org_a",
        websiteId: foreign.id,
      }),
    );

    const [row] = await subscriptionRows();
    expect(row).toMatchObject({ organizationId: "org_a", websiteId: null });
    expect(stripeMock.cancel).not.toHaveBeenCalled();
  });

  it("answers 200 for malformed website metadata instead of failing a uuid cast", async () => {
    expect(
      await sendStripe(
        "customer.subscription.created",
        stripeSubscription("sub_odd", "active", {
          organizationId: "org_a",
          websiteId: "not-a-uuid",
        }),
      ),
    ).toBe(200);
    const [row] = await subscriptionRows();
    expect(row.websiteId).toBeNull();
  });

  it("attaches a normal checkout and marks it completed", async () => {
    const site = await addSite();
    const [checkout] = await test.db
      .insert(billingCheckouts)
      .values({
        organizationId: "org_a",
        websiteId: site.id,
        provider: "stripe",
        status: "open",
        stripeSessionId: "cs_ok",
      })
      .returning();

    await sendStripe(
      "customer.subscription.created",
      stripeSubscription("sub_ok", "trialing", {
        organizationId: "org_a",
        websiteId: site.id,
        checkoutId: checkout.id,
      }),
    );

    const [row] = await subscriptionRows();
    expect(row).toMatchObject({ websiteId: site.id, status: "trialing" });
    const [done] = await test.db.select().from(billingCheckouts);
    expect(done.status).toBe("completed");
  });
});

describe("Stripe: deleted workspace", () => {
  it("cancels a subscription whose workspace is gone and answers 200", async () => {
    const status = await sendStripe(
      "customer.subscription.created",
      stripeSubscription("sub_orphan", "trialing", {
        organizationId: "org_deleted",
        websiteId: "00000000-0000-4000-8000-000000000000",
      }),
    );

    expect(status).toBe(200);
    expect(stripeMock.cancel).toHaveBeenCalledWith("sub_orphan", {}, {
      idempotencyKey: "owed-cancel:sub_orphan",
    });
    expect(await subscriptionRows()).toHaveLength(0);
    // Acknowledged, so the event is not left to be retried.
    expect(await test.db.select().from(webhookEvents)).toHaveLength(1);
  });

  it("leaves alone a subscription that never named a workspace", async () => {
    await sendStripe(
      "customer.subscription.created",
      stripeSubscription("sub_manual", "active", {}),
    );
    expect(stripeMock.cancel).not.toHaveBeenCalled();
  });
});

describe("PayPal: late events", () => {
  it("records and cancels an approval given after the website was deleted", async () => {
    const goneId = await deletedSiteId();

    const status = await sendPayPal(
      "BILLING.SUBSCRIPTION.ACTIVATED",
      { id: "I-LATE" },
      { id: "I-LATE", status: "ACTIVE", custom_id: `org_a:${goneId}` },
    );

    expect(status).toBe(200);
    expect(paypalMock.cancel).toHaveBeenCalledWith("I-LATE", expect.any(String));
    const [row] = await subscriptionRows();
    expect(row).toMatchObject({
      organizationId: "org_a",
      websiteId: null,
      paypalSubscriptionId: "I-LATE",
      provider: "paypal",
    });
  });

  it("records a payment against the workspace when only the website is gone", async () => {
    const goneId = await deletedSiteId();

    const status = await sendPayPal(
      "PAYMENT.SALE.COMPLETED",
      {
        id: "SALE-1",
        billing_agreement_id: "I-LATE",
        amount: { total: "49.00", currency: "EUR" },
      },
      { id: "I-LATE", status: "ACTIVE", custom_id: `org_a:${goneId}` },
    );

    expect(status).toBe(200);
    const [payment] = await test.db.select().from(payments);
    expect(payment).toMatchObject({
      organizationId: "org_a",
      externalId: "SALE-1",
      amountCents: 4900,
    });
  });

  it("answers 200 for a payment whose workspace was deleted, and cancels", async () => {
    const status = await sendPayPal(
      "PAYMENT.SALE.COMPLETED",
      {
        id: "SALE-2",
        billing_agreement_id: "I-ORPHAN",
        amount: { total: "49.00", currency: "EUR" },
      },
      {
        id: "I-ORPHAN",
        status: "ACTIVE",
        custom_id: "org_deleted:00000000-0000-4000-8000-000000000000",
      },
    );

    expect(status).toBe(200);
    expect(paypalMock.cancel).toHaveBeenCalledWith("I-ORPHAN", expect.any(String));
    expect(await test.db.select().from(payments)).toHaveLength(0);
    expect(await subscriptionRows()).toHaveLength(0);
  });

  it("updates a retained PayPal subscription by id and leaves it detached", async () => {
    const site = await addSite();
    await test.db.insert(subscriptions).values({
      organizationId: "org_a",
      websiteId: null,
      provider: "paypal",
      status: "canceled",
      paypalSubscriptionId: "I-OLD",
    });

    expect(
      await sendPayPal(
        "BILLING.SUBSCRIPTION.EXPIRED",
        { id: "I-OLD" },
        { id: "I-OLD", status: "EXPIRED", custom_id: `org_a:${site.id}` },
      ),
    ).toBe(200);

    const [row] = await subscriptionRows();
    expect(row).toMatchObject({ websiteId: null, status: "canceled" });
    expect(paypalMock.cancel).not.toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------------ */
/* Issue 9: stale events for the SAME subscription                           */
/* ------------------------------------------------------------------------ */

describe("stale snapshots of the same subscription", () => {
  it("Stripe: a cancellation followed by an older active snapshot stays cancelled", async () => {
    const site = await addSite();
    const active = stripeSubscription("sub_same", "active", {
      organizationId: "org_a",
      websiteId: site.id,
    });
    await sendStripe("customer.subscription.created", active);
    const canceled = { ...active, status: "canceled" };
    await sendStripe("customer.subscription.deleted", canceled);

    // A delayed "updated" whose body is the OLD active snapshot. Stripe
    // itself says the subscription is cancelled.
    expect(
      await sendStripe("customer.subscription.updated", active, { keepProviderState: true }),
    ).toBe(200);

    const [row] = await subscriptionRows();
    expect(row).toMatchObject({ stripeSubscriptionId: "sub_same", status: "canceled" });
  });

  it("PayPal: a late ACTIVATED after CANCELLED does not resurrect it", async () => {
    const site = await addSite();
    await sendPayPal(
      "BILLING.SUBSCRIPTION.ACTIVATED",
      { id: "I-SAME" },
      { id: "I-SAME", status: "ACTIVE", custom_id: `org_a:${site.id}` },
    );
    await sendPayPal(
      "BILLING.SUBSCRIPTION.CANCELLED",
      { id: "I-SAME" },
      { id: "I-SAME", status: "CANCELLED", custom_id: `org_a:${site.id}` },
    );
    // The late ACTIVATED; PayPal reports the subscription as it is now.
    await sendPayPal(
      "BILLING.SUBSCRIPTION.ACTIVATED",
      { id: "I-SAME", status: "ACTIVE" },
      { id: "I-SAME", status: "CANCELLED", custom_id: `org_a:${site.id}` },
    );

    const [row] = await subscriptionRows();
    expect(row).toMatchObject({ paypalSubscriptionId: "I-SAME", status: "canceled" });
  });

  it("records the payment's subscription for later refunds and cancellations", async () => {
    const site = await addSite();
    const active = stripeSubscription("sub_paid", "active", {
      organizationId: "org_a",
      websiteId: site.id,
    });
    state.subscription = active;
    eventCounter += 1;
    state.event = {
      id: `evt_${eventCounter}`,
      type: "invoice.paid",
      data: {
        object: {
          id: "in_1",
          amount_paid: 4900,
          currency: "eur",
          parent: { subscription_details: { subscription: "sub_paid" } },
          lines: { data: [] },
        },
      },
    };
    await stripeWebhook(
      new Request("https://app.example.test/api/stripe/webhook", { method: "POST", body: "{}" }),
    );

    const [subscription] = await subscriptionRows();
    const [payment] = await test.db.select().from(payments);
    expect(payment).toMatchObject({
      externalId: "in_1",
      providerSubscriptionId: "sub_paid",
      subscriptionId: subscription.id,
    });
  });
});

describe("crash recovery without another business event", () => {
  it("finishes an event whose worker died after a duplicate was acknowledged", async () => {
    const site = await addSite();
    const subscription = stripeSubscription("sub_crash", "active", {
      organizationId: "org_a",
      websiteId: site.id,
    });
    state.subscription = subscription;
    const event = {
      id: "evt_crash",
      type: "customer.subscription.created",
      data: { object: subscription },
    };

    // Delivery 1 claims the verified event, then its process is killed.
    const first = await claimWebhookEvent({
      id: event.id,
      provider: "stripe",
      type: event.type,
      payload: event,
    });
    expect(first.claimed).toBe(true);

    // Stripe redelivers while the claim is live: acknowledged with 200, so
    // Stripe will not send it again.
    state.event = event;
    const duplicate = await stripeWebhook(
      new Request("https://app.example.test/api/stripe/webhook", { method: "POST", body: "{}" }),
    );
    expect(duplicate.status).toBe(200);
    expect(await subscriptionRows()).toHaveLength(0);

    // The maintenance job, after the lease: recovered from the stored payload.
    const later = new Date(Date.now() + 6 * 60 * 1000);
    expect(await recoverWebhookEvents({ now: later })).toEqual({
      recovered: ["evt_crash"],
      failed: [],
    });
    const [row] = await subscriptionRows();
    expect(row).toMatchObject({ stripeSubscriptionId: "sub_crash", websiteId: site.id });
    const [stored] = await test.db.select().from(webhookEvents).where(eq(webhookEvents.id, "evt_crash"));
    expect(stored.status).toBe("completed");

    // The original worker waking up late cannot complete or release it.
    if (first.claimed) {
      expect(await completeWebhookEvent("evt_crash", first.token)).toBe(false);
    }
  });
});
