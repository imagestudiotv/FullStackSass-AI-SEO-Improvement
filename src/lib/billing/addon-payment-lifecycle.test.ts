import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { addonPurchases, addons, blogSponsorships, creditLedger, organization } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * A credit pack is paid for when Stripe says so, not when its checkout completes:
 * a delayed method completes the checkout unpaid and settles days later, or never.
 * Every event goes through processStripeEvent on a disposable database, with no
 * network and no Stripe account.
 */

const state = vi.hoisted(() => ({ db: null as unknown, retrieve: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
const notifyMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/notifications/create", () => ({ notify: notifyMock }));
vi.mock("@/lib/stripe/client", () => ({
  stripe: { subscriptions: { retrieve: state.retrieve } },
  isStripeConfigured: () => true,
}));

import { getBalance } from "@/lib/backlinks/credits";
import { processStripeEvent } from "@/lib/billing/stripe-events";

let test: TestDb;

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
});
beforeEach(() => {
  notifyMock.mockReset();
  state.retrieve.mockReset();
});
afterEach(() => vi.restoreAllMocks());

type EventName = "checkout.session.completed" | "checkout.session.async_payment_succeeded" | "checkout.session.async_payment_failed";

async function seed() {
  const organizationId = `org_${randomUUID()}`;
  await test.db.insert(organization).values({ id: organizationId, name: "W", slug: organizationId, createdAt: new Date() });
  const [addon] = await test.db
    .insert(addons)
    .values({ slug: `credits_${randomUUID()}`, name: "50 credits", priceCents: 900, creditsGranted: 50 })
    .returning({ id: addons.id });
  return { organizationId, addonId: addon.id, sessionId: `cs_test_${randomUUID()}` };
}
type Scene = Awaited<ReturnType<typeof seed>>;

const event = (type: EventName, s: Scene, paymentStatus: "paid" | "unpaid" | "no_payment_required", fields: Partial<Stripe.Checkout.Session> = {}) =>
  ({
    id: `evt_${randomUUID()}`,
    type,
    data: {
      object: {
        id: s.sessionId,
        object: "checkout.session",
        mode: "payment",
        payment_status: paymentStatus,
        amount_total: 900,
        currency: "eur",
        metadata: { organizationId: s.organizationId, addonId: s.addonId },
        ...fields,
      },
    },
  }) as unknown as Stripe.Event;

const purchases = (s: Scene) => test.db.select().from(addonPurchases).where(eq(addonPurchases.stripeSessionId, s.sessionId));
const ledger = (s: Scene) => test.db.select().from(creditLedger).where(eq(creditLedger.organizationId, s.organizationId));

async function expectGrantedOnce(s: Scene) {
  expect(await getBalance(s.organizationId)).toBe(50);
  expect(await purchases(s)).toHaveLength(1);
  expect(await ledger(s)).toHaveLength(1);
}
async function expectNothingGranted(s: Scene) {
  expect(await getBalance(s.organizationId)).toBe(0);
  expect(await purchases(s)).toEqual([]);
  expect(await ledger(s)).toEqual([]);
}

describe("a card or other immediate payment", () => {
  it("grants on checkout completion, once however often the event is delivered", async () => {
    const s = await seed();
    const paid = event("checkout.session.completed", s, "paid");
    await processStripeEvent(paid);
    await expectGrantedOnce(s);
    await processStripeEvent(paid);
    await processStripeEvent(event("checkout.session.completed", s, "paid"));
    await expectGrantedOnce(s);
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock.mock.calls[0][0]).toMatchObject({ type: "addon.purchased", organizationId: s.organizationId });
  });

  it("a 100% discount has no money to wait for, and is granted as before", async () => {
    const s = await seed();
    await processStripeEvent(event("checkout.session.completed", s, "no_payment_required", { amount_total: 0 }));
    await expectGrantedOnce(s);
    expect((await purchases(s))[0].pricePaidCents).toBe(0);
  });
});

describe("a delayed payment", () => {
  it("grants nothing while unpaid, even if the completion is delivered twice", async () => {
    const s = await seed();
    const unpaid = event("checkout.session.completed", s, "unpaid");
    await processStripeEvent(unpaid);
    await processStripeEvent(unpaid);
    await expectNothingGranted(s);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("grants when the money arrives, once, across every replay and a concurrent delivery", async () => {
    const s = await seed();
    const unpaid = event("checkout.session.completed", s, "unpaid");
    const succeeded = event("checkout.session.async_payment_succeeded", s, "paid");
    await processStripeEvent(unpaid);
    await Promise.all([processStripeEvent(succeeded), processStripeEvent(succeeded), processStripeEvent(event("checkout.session.async_payment_succeeded", s, "paid"))]);
    await expectGrantedOnce(s);
    // The recovery job and Stripe's retries replay the stored bodies, unpaid one included.
    await processStripeEvent(unpaid);
    await processStripeEvent(succeeded);
    await expectGrantedOnce(s);
    expect(notifyMock).toHaveBeenCalledTimes(1);
  });

  it("grants once when the events arrive out of order", async () => {
    const s = await seed();
    await processStripeEvent(event("checkout.session.async_payment_succeeded", s, "paid"));
    await processStripeEvent(event("checkout.session.completed", s, "unpaid"));
    await expectGrantedOnce(s);
  });

  it("the success event alone does not grant if the session it carries is not paid", async () => {
    const s = await seed();
    await processStripeEvent(event("checkout.session.async_payment_succeeded", s, "unpaid"));
    await expectNothingGranted(s);
  });

  it("a failed ledger write rolls the purchase back, and the retry delivers", async () => {
    const s = await seed();
    const succeeded = event("checkout.session.async_payment_succeeded", s, "paid");
    await test.client.exec(`
      create or replace function reject_ledger() returns trigger as $$ begin raise exception 'injected'; end; $$ language plpgsql;
      create trigger reject_ledger_insert before insert on credit_ledger for each row execute function reject_ledger();
    `);
    try {
      await expect(processStripeEvent(succeeded)).rejects.toThrow();
    } finally {
      await test.client.exec("drop trigger if exists reject_ledger_insert on credit_ledger;");
    }
    await expectNothingGranted(s);
    await processStripeEvent(succeeded);
    await expectGrantedOnce(s);
  });

  it("failing grants nothing and tells the customer once per event, in words that promise no credits", async () => {
    const s = await seed();
    await processStripeEvent(event("checkout.session.completed", s, "unpaid"));
    await processStripeEvent(event("checkout.session.async_payment_failed", s, "unpaid"));
    await expectNothingGranted(s);
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(notifyMock.mock.calls[0][0]).toMatchObject({ type: "addon.payment_failed", organizationId: s.organizationId, href: "/billing" });
    expect(notifyMock.mock.calls[0][0].body).toContain("No credits were added");
    // A replay of the completion after the failure changes nothing.
    await processStripeEvent(event("checkout.session.completed", s, "unpaid"));
    await expectNothingGranted(s);
  });

  it("a failure for a session an earlier build already fulfilled: ledger history stays, and it is logged for a person", async () => {
    const s = await seed();
    await processStripeEvent(event("checkout.session.completed", s, "paid"));
    notifyMock.mockReset();
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await processStripeEvent(event("checkout.session.async_payment_failed", s, "unpaid"));
    await expectGrantedOnce(s);
    expect(notifyMock).not.toHaveBeenCalled();
    expect(logged.mock.calls.flat().join(" ")).toContain(s.sessionId);
  });
});

describe("what this does not touch", () => {
  it("subscriptions: a delayed payment event does nothing, and a completed checkout still syncs whatever its payment status", async () => {
    const s = await seed();
    const subscription = { mode: "subscription", subscription: "sub_test_1" } as const;
    await processStripeEvent(event("checkout.session.async_payment_succeeded", s, "paid", subscription));
    await processStripeEvent(event("checkout.session.async_payment_failed", s, "unpaid", subscription));
    expect(state.retrieve).not.toHaveBeenCalled();
    await expectNothingGranted(s);

    state.retrieve.mockRejectedValue(Object.assign(new Error("gone"), { code: "resource_missing" }));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await processStripeEvent(event("checkout.session.completed", s, "unpaid", subscription));
    expect(state.retrieve).toHaveBeenCalledTimes(1);
    await expectNothingGranted(s);
  });

  it("sponsorships: delayed payment events neither buy an add-on nor move the request", async () => {
    const s = await seed();
    const [order] = await test.db
      .insert(blogSponsorships)
      .values({ postSlug: "live-article", email: "c@p.test", websiteUrl: "https://p.test", message: "M", checkoutId: s.sessionId })
      .returning({ id: blogSponsorships.id, status: blogSponsorships.status });
    const metadata = { blogSponsorshipId: order.id, organizationId: s.organizationId, addonId: s.addonId };
    await processStripeEvent(event("checkout.session.async_payment_succeeded", s, "paid", { metadata }));
    await processStripeEvent(event("checkout.session.async_payment_failed", s, "unpaid", { metadata }));
    await expectNothingGranted(s);
    expect(notifyMock).not.toHaveBeenCalled();
    const [after] = await test.db.select({ status: blogSponsorships.status }).from(blogSponsorships).where(eq(blogSponsorships.id, order.id));
    expect(after.status).toBe(order.status);
  });
});
