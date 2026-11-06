import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { billingCheckouts, plans, subscriptions } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";
import { seedWebsite } from "@/test/fixtures";

/**
 * A REPGET coupon that goes on before the first paid invoice, and what happens when
 * Stripe refuses it (lib/billing/paid-start-sweep.ts, paid-start-coupon.ts). Stripe
 * and email are replaced at their boundary. Stripe's own answers are checked in its
 * test mode, not here.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
const stripeMock = vi.hoisted(() => ({ retrieve: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/stripe/client", () => ({
  stripe: { subscriptions: { retrieve: stripeMock.retrieve, update: stripeMock.update } },
}));
const mail = vi.hoisted(() => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/email/send", () => mail);
const sync = vi.hoisted(() => ({ syncStripeSubscription: vi.fn() }));
vi.mock("@/lib/billing/stripe-events", () => sync);

import { settlePaidStartOffers } from "@/lib/billing/paid-start-sweep";

let test: TestDb;
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2027-03-10T12:00:00.000Z");
const PRICE = "price_sweep_grow";
const refused = () => Object.assign(new Error("No such coupon: 'GROW40'"), { type: "StripeInvalidRequestError" });
const log = vi.spyOn(console, "error").mockImplementation(() => {});

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  await test.db.insert(plans).values({ name: "T Sweep Grow", tier: "grow", interval: "month", currency: "eur", priceCents: 14900, stripePriceId: PRICE, articleLimit: 1, keywordLimit: 1, siteLimit: 1, monthlyCredits: 1, catalogVersion: 77 });
});

beforeEach(() => {
  stripeMock.retrieve.mockReset();
  stripeMock.update.mockReset();
  stripeMock.update.mockResolvedValue({});
  mail.sendEmail.mockReset();
  mail.sendEmail.mockResolvedValue(undefined);
  sync.syncStripeSubscription.mockReset();
  log.mockClear();
  process.env.ADMIN_EMAILS = "staff@fixture.test";
});

/** A website on a free period that ends in `days`, whose checkout took the offer. */
async function offer(days: number, requestParams: Record<string, unknown> = {}) {
  const site = await seedWebsite(test, { status: "trialing" });
  const subscriptionId = `sub_${site.websiteId.slice(0, 8)}`;
  const end = new Date(NOW.getTime() + days * DAY);
  await test.db
    .update(subscriptions)
    .set({ provider: "stripe", stripeSubscriptionId: subscriptionId, currentPeriodStart: new Date(end.getTime() - 30 * DAY), currentPeriodEnd: end })
    .where(eqWebsite(site.websiteId));
  await test.db.insert(billingCheckouts).values({ organizationId: site.orgId, websiteId: site.websiteId, provider: "stripe", status: "completed", trialDays: 30, requestParams: { offer: "REPGET", ...requestParams }, createdAt: NOW });
  stripeMock.retrieve.mockResolvedValue({
    id: subscriptionId,
    status: "trialing",
    trial_end: Math.floor(end.getTime() / 1000),
    metadata: { paid_start_offer: "REPGET" },
    items: { data: [{ price: { id: PRICE } }] },
  });
  return { ...site, subscriptionId };
}
const eqWebsite = (id: string) => eq(subscriptions.websiteId, id);
const params = async (websiteId: string) =>
  (await test.db.select({ p: billingCheckouts.requestParams }).from(billingCheckouts).where(eq(billingCheckouts.websiteId, websiteId)))[0].p as Record<string, string>;
/** Earlier fixtures are settled, so each test sees only its own website. */
const clearEarlier = async () => {
  await test.client.exec(`delete from billing_checkouts;`);
};

describe("putting the coupon on", () => {
  beforeEach(clearEarlier);

  it("inside the last three days of a free period: the plan's coupon, recorded as done", async () => {
    const { websiteId, subscriptionId } = await offer(2);
    await expect(settlePaidStartOffers(NOW)).resolves.toEqual({ applied: 1, held: 0 });
    expect(stripeMock.update.mock.calls[0].slice(0, 2)).toEqual([subscriptionId, { discounts: [{ coupon: "GROW40" }], metadata: { paid_start_offer: "" } }]);
    expect((await params(websiteId)).offerSettledAt).toBeTruthy();
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });

  it("not before then: the free period cannot use it up", async () => {
    await offer(10);
    await expect(settlePaidStartOffers(NOW)).resolves.toEqual({ applied: 0, held: 0 });
    expect(stripeMock.retrieve).not.toHaveBeenCalled();
  });

  it("once: a settled offer is not looked at again", async () => {
    await offer(2, { offerSettledAt: NOW.toISOString() });
    await expect(settlePaidStartOffers(NOW)).resolves.toEqual({ applied: 0, held: 0 });
    expect(stripeMock.retrieve).not.toHaveBeenCalled();
  });

  it("a checkout without the offer is none of its business", async () => {
    const { websiteId } = await offer(2);
    await test.db.update(billingCheckouts).set({ requestParams: {} }).where(eq(billingCheckouts.websiteId, websiteId));
    await expect(settlePaidStartOffers(NOW)).resolves.toEqual({ applied: 0, held: 0 });
    expect(stripeMock.update).not.toHaveBeenCalled();
  });
});

describe("when Stripe refuses the coupon", () => {
  beforeEach(clearEarlier);

  it("the offer stays waiting, staff are told, and no discountless update is sent", async () => {
    const { websiteId, subscriptionId } = await offer(2);
    stripeMock.update.mockRejectedValueOnce(refused());
    await expect(settlePaidStartOffers(NOW)).resolves.toEqual({ applied: 0, held: 1 });
    expect(stripeMock.update).toHaveBeenCalledTimes(1);
    const saved = await params(websiteId);
    expect(saved.offerSettledAt).toBeUndefined();
    expect(saved.offerHeldAt).toBeTruthy();
    expect(mail.sendEmail).toHaveBeenCalledTimes(1);
    expect(mail.sendEmail.mock.calls[0][0]).toMatchObject({ to: "staff@fixture.test" });
    expect(mail.sendEmail.mock.calls[0][0].text).toContain(subscriptionId);
    expect(mail.sendEmail.mock.calls[0][0].text).toContain("No such coupon");
  });

  it("about to run out: the free period moves on, so Stripe cannot charge full price", async () => {
    const { subscriptionId } = await offer(0.5);
    stripeMock.update.mockRejectedValueOnce(refused());
    await settlePaidStartOffers(NOW);
    expect(stripeMock.update).toHaveBeenCalledTimes(2);
    expect(stripeMock.update.mock.calls[1].slice(0, 2)).toEqual([
      subscriptionId,
      { trial_end: Math.floor((NOW.getTime() + 3 * DAY) / 1000), proration_behavior: "none" },
    ]);
  });

  it("with days to go it is not moved: nothing changes for the customer yet", async () => {
    await offer(2);
    stripeMock.update.mockRejectedValueOnce(refused());
    await settlePaidStartOffers(NOW);
    expect(stripeMock.update).toHaveBeenCalledTimes(1);
  });

  it("tells staff once a day, not every run", async () => {
    await offer(2);
    stripeMock.update.mockRejectedValue(refused());
    await settlePaidStartOffers(NOW);
    await settlePaidStartOffers(new Date(NOW.getTime() + 5 * 60 * 1000));
    expect(mail.sendEmail).toHaveBeenCalledTimes(1);
    await settlePaidStartOffers(new Date(NOW.getTime() + DAY + 60 * 1000));
    expect(mail.sendEmail).toHaveBeenCalledTimes(2);
  });

  it("an email that fails is tried again next run, and does not stop the hold", async () => {
    const { websiteId } = await offer(2);
    stripeMock.update.mockRejectedValue(refused());
    mail.sendEmail.mockRejectedValueOnce(new Error("mail down"));
    await expect(settlePaidStartOffers(NOW)).resolves.toEqual({ applied: 0, held: 1 });
    expect((await params(websiteId)).offerAlertedAt).toBeUndefined();
    await settlePaidStartOffers(new Date(NOW.getTime() + 5 * 60 * 1000));
    expect(mail.sendEmail).toHaveBeenCalledTimes(2);
  });

  it("once the coupon is put right, the next run applies it and it is finished", async () => {
    const { websiteId } = await offer(2);
    stripeMock.update.mockRejectedValueOnce(refused());
    await settlePaidStartOffers(NOW);
    await expect(settlePaidStartOffers(new Date(NOW.getTime() + 60 * 60 * 1000))).resolves.toEqual({ applied: 1, held: 0 });
    expect((await params(websiteId)).offerSettledAt).toBeTruthy();
  });

  it("a Stripe outage is not a refusal: no alert, no hold, and the next run tries again", async () => {
    const { websiteId } = await offer(2);
    stripeMock.update.mockRejectedValueOnce(Object.assign(new Error("down"), { type: "StripeConnectionError" }));
    await expect(settlePaidStartOffers(NOW)).resolves.toEqual({ applied: 0, held: 0 });
    expect(mail.sendEmail).not.toHaveBeenCalled();
    expect((await params(websiteId)).offerHeldAt).toBeUndefined();
  });

  it("each try uses a key that changes each hour, so a stored refusal is not replayed for a day", async () => {
    await offer(2);
    stripeMock.update.mockRejectedValue(refused());
    await settlePaidStartOffers(NOW);
    await settlePaidStartOffers(new Date(NOW.getTime() + 60 * 60 * 1000));
    expect(stripeMock.update.mock.calls[0][2].idempotencyKey).not.toEqual(stripeMock.update.mock.calls[1][2].idempotencyKey);
  });
});

describe("what it finds at Stripe", () => {
  beforeEach(clearEarlier);

  it("paid service already started with the offer still waiting: staff are told, nothing is sent", async () => {
    const { websiteId, subscriptionId } = await offer(2);
    stripeMock.retrieve.mockResolvedValue({ id: subscriptionId, status: "active", metadata: { paid_start_offer: "REPGET" }, items: { data: [] } });
    await settlePaidStartOffers(NOW);
    expect(stripeMock.update).not.toHaveBeenCalled();
    expect(mail.sendEmail.mock.calls[0][0].text).toContain("may be owed");
    expect((await params(websiteId)).offerSettledAt).toBeTruthy();
  });

  it("nothing waiting there any more: recorded as done, quietly", async () => {
    const { websiteId, subscriptionId } = await offer(2);
    stripeMock.retrieve.mockResolvedValue({ id: subscriptionId, status: "trialing", metadata: {}, items: { data: [] } });
    await settlePaidStartOffers(NOW);
    expect(mail.sendEmail).not.toHaveBeenCalled();
    expect((await params(websiteId)).offerSettledAt).toBeTruthy();
  });

  it("one website's failure does not stop the next", async () => {
    await offer(2);
    await offer(2);
    stripeMock.retrieve.mockRejectedValueOnce(new Error("down"));
    await expect(settlePaidStartOffers(NOW)).resolves.toMatchObject({ applied: 1 });
  });
});
