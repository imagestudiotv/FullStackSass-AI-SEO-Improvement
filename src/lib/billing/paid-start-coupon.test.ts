import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { plans } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * The REPGET offer: which coupon, and when it goes on (lib/billing/repget-offer.ts,
 * lib/billing/paid-start-coupon.ts). Stripe is replaced at its boundary. What Stripe
 * does with these requests is checked in its test mode, not here.
 */

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_t, p) => Reflect.get(state.db as object, p) }),
}));
const stripeMock = vi.hoisted(() => ({ retrieve: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/stripe/client", () => ({
  stripe: { subscriptions: { retrieve: stripeMock.retrieve, update: stripeMock.update } },
}));

import { applyPaidStartCoupon, paidStartUpdate } from "@/lib/billing/paid-start-coupon";
import { readOfferCode, repgetCouponFor } from "@/lib/billing/repget-offer";

let test: TestDb;
const SUB = "sub_1";
const month = (tier: string, priceCents: number) => ({ tier, interval: "month", currency: "eur", priceCents });
const items = (price: string) => ({ data: [{ price: { id: price } }] });
const waiting = { paid_start_offer: "REPGET" };
const live = (fields: Record<string, unknown>) =>
  stripeMock.retrieve.mockResolvedValue({ id: SUB, status: "trialing", metadata: {}, items: items("price_grow"), ...fields });

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  const row = { articleLimit: 1, keywordLimit: 1, siteLimit: 1, monthlyCredits: 1, currency: "eur" };
  await test.db.insert(plans).values([
    { ...row, name: "T Grow", tier: "grow", interval: "month", priceCents: 14900, stripePriceId: "price_grow", catalogVersion: 2 },
    { ...row, name: "T Scale", tier: "scale", interval: "month", priceCents: 34900, stripePriceId: "price_scale", catalogVersion: 2 },
    { ...row, name: "T Grow (Annual)", tier: "grow", interval: "year", priceCents: 149000, stripePriceId: "price_grow_year", catalogVersion: 2 },
    { ...row, name: "T Old Grow", tier: "grow", interval: "month", priceCents: 9900, stripePriceId: "price_old_grow", catalogVersion: 1 },
  ]);
});

beforeEach(() => {
  stripeMock.retrieve.mockReset();
  stripeMock.update.mockReset();
  stripeMock.update.mockResolvedValue({});
  process.env.REPGET_OFFER_ENABLED = "1";
});

describe("which coupon a plan gets", () => {
  it("each monthly plan its own, at the price the coupon was made for", () => {
    expect(repgetCouponFor(month("launch", 9900))).toBe("LAUNCH40");
    expect(repgetCouponFor(month("grow", 14900))).toBe("GROW40");
    expect(repgetCouponFor(month("scale", 34900))).toBe("SCALE40");
  });

  it("each coupon is exactly 40% of its plan's price", () => {
    expect([9900 * 0.4, 14900 * 0.4, 34900 * 0.4].map(Math.round)).toEqual([3960, 5960, 13960]);
  });

  it("not annual, not an older price on the same tier, not another currency or tier", () => {
    expect(repgetCouponFor({ ...month("grow", 149000), interval: "year" })).toBeNull();
    expect(repgetCouponFor(month("grow", 9900))).toBeNull();
    expect(repgetCouponFor({ ...month("grow", 14900), currency: "usd" })).toBeNull();
    expect(repgetCouponFor(month("legacy", 14900))).toBeNull();
    expect(repgetCouponFor({ ...month("grow", 14900), interval: "year" })).toBeNull();
  });
});

describe("a code given to RepGet", () => {
  const grow = month("grow", 14900);

  it("nothing given is no offer and no error", () => {
    expect(readOfferCode(undefined, grow)).toEqual({ coupon: null });
    expect(readOfferCode("  ", grow)).toEqual({ coupon: null });
  });

  it("REPGET in any case, with spaces, gives the plan's coupon", () => {
    expect(readOfferCode(" repget ", grow)).toEqual({ coupon: "GROW40" });
  });

  it("another code is sent to Stripe's own box, not swallowed", () => {
    expect(readOfferCode("PARTNER10", grow).error).toContain("card payment page");
  });

  it("switched off, REPGET is just an unknown code", () => {
    delete process.env.REPGET_OFFER_ENABLED;
    expect(readOfferCode("REPGET", grow).error).toContain("not recognised");
  });

  it("on an annual plan it says why", () => {
    expect(readOfferCode("REPGET", { ...grow, interval: "year", priceCents: 149000 }).error).toContain("monthly");
  });
});

describe("when the paid service starts", () => {
  it("the current plan's coupon goes on, and the memory is cleared", async () => {
    await expect(paidStartUpdate({ metadata: waiting, items: items("price_grow") } as never)).resolves.toEqual({
      discounts: [{ coupon: "GROW40" }],
      metadata: { paid_start_offer: "" },
    });
  });

  it("a plan changed during the free period gets the new plan's coupon", async () => {
    await expect(paidStartUpdate({ metadata: waiting, items: items("price_scale") } as never)).resolves.toMatchObject({ discounts: [{ coupon: "SCALE40" }] });
  });

  it("a plan moved to annual gets no discount", async () => {
    await expect(paidStartUpdate({ metadata: waiting, items: items("price_grow_year") } as never)).resolves.toEqual({ metadata: { paid_start_offer: "" } });
  });

  it("an older price or an unknown one gets none", async () => {
    await expect(paidStartUpdate({ metadata: waiting, items: items("price_old_grow") } as never)).resolves.toEqual({ metadata: { paid_start_offer: "" } });
    await expect(paidStartUpdate({ metadata: waiting, items: items("price_nobody") } as never)).resolves.toEqual({ metadata: { paid_start_offer: "" } });
  });

  it("nothing waiting, nothing added: other coupons are never touched", async () => {
    await expect(paidStartUpdate({ metadata: {}, items: items("price_grow") } as never)).resolves.toBeNull();
  });

  it("before a free period runs out", async () => {
    live({ metadata: waiting });
    await applyPaidStartCoupon(SUB);
    expect(stripeMock.update.mock.calls[0].slice(0, 2)).toEqual([SUB, { discounts: [{ coupon: "GROW40" }], metadata: { paid_start_offer: "" } }]);
  });

  it("still if the offer was switched off meanwhile: a customer who was told keeps it", async () => {
    delete process.env.REPGET_OFFER_ENABLED;
    live({ metadata: waiting });
    await applyPaidStartCoupon(SUB);
    expect(stripeMock.update).toHaveBeenCalledTimes(1);
  });

  it("not once the free period is over, and not a second time", async () => {
    live({ status: "active", metadata: waiting });
    await applyPaidStartCoupon(SUB);
    live({ metadata: {} });
    await applyPaidStartCoupon(SUB);
    expect(stripeMock.update).not.toHaveBeenCalled();
  });
});
