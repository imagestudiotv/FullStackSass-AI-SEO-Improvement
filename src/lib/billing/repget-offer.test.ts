import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { plans } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * The REPGET offer: which coupon, and keeping it on the right plan
 * (lib/billing/repget-offer.ts, repget-subscription.ts). Stripe and email are replaced
 * at their boundary. What Stripe does with these requests is checked in its test mode.
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

import { readOfferCode, repgetCouponFor } from "@/lib/billing/repget-offer";
import { isCouponRefusal, matchOfferToPlan } from "@/lib/billing/repget-subscription";

let test: TestDb;
const SUB = "sub_1";
const month = (tier: string, priceCents: number) => ({ tier, interval: "month", currency: "eur", priceCents });
const discount = (id: string, coupon: string) => ({ id, source: { coupon } });
const event = { id: SUB, metadata: { repget_offer: "REPGET" } };
const live = (price: string, discounts: unknown[], status = "trialing") =>
  stripeMock.retrieve.mockResolvedValue({ id: SUB, status, discounts, items: { data: [{ price: { id: price } }] } });
const refused = () => Object.assign(new Error("No such coupon: 'SCALE40'"), { type: "StripeInvalidRequestError" });

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  const row = { articleLimit: 1, keywordLimit: 1, siteLimit: 1, monthlyCredits: 1, currency: "eur" };
  await test.db.insert(plans).values([
    { ...row, name: "T Grow", tier: "grow", interval: "month", priceCents: 14900, stripePriceId: "price_grow", catalogVersion: 2 },
    { ...row, name: "T Scale", tier: "scale", interval: "month", priceCents: 34900, stripePriceId: "price_scale", catalogVersion: 2 },
    { ...row, name: "T Grow (Annual)", tier: "grow", interval: "year", priceCents: 149000, stripePriceId: "price_grow_year", catalogVersion: 2 },
  ]);
});

beforeEach(() => {
  stripeMock.retrieve.mockReset();
  stripeMock.update.mockReset();
  stripeMock.update.mockResolvedValue({});
  mail.sendEmail.mockReset();
  mail.sendEmail.mockResolvedValue(undefined);
  process.env.REPGET_OFFER_ENABLED = "1";
  process.env.ADMIN_EMAILS = "staff@fixture.test";
});

describe("which coupon a plan gets", () => {
  it("each monthly plan its own, at the price the coupon was made for", () => {
    expect(repgetCouponFor(month("launch", 9900))).toBe("LAUNCH40");
    expect(repgetCouponFor(month("grow", 14900))).toBe("GROW40");
    expect(repgetCouponFor(month("scale", 34900))).toBe("SCALE40");
  });

  it("not annual, not an older price on the same tier, not another currency or tier", () => {
    expect(repgetCouponFor({ ...month("grow", 14900), interval: "year" })).toBeNull();
    expect(repgetCouponFor({ ...month("grow", 149000), interval: "year" })).toBeNull();
    expect(repgetCouponFor(month("grow", 9900))).toBeNull();
    expect(repgetCouponFor({ ...month("grow", 14900), currency: "usd" })).toBeNull();
    expect(repgetCouponFor(month("legacy", 14900))).toBeNull();
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

describe("a plan changed during the free period", () => {
  it("to another plan: that plan's coupon replaces the old one", async () => {
    live("price_scale", [discount("di_1", "GROW40")]);
    await matchOfferToPlan(event);
    expect(stripeMock.update.mock.calls[0]).toEqual([SUB, { discounts: [{ coupon: "SCALE40" }] }]);
  });

  it("to annual: the coupon comes off, so nothing reaches a full annual payment", async () => {
    live("price_grow_year", [discount("di_1", "GROW40")]);
    await matchOfferToPlan(event);
    expect(stripeMock.update.mock.calls[0]).toEqual([SUB, { discounts: "" }]);
  });

  it("back from annual to monthly: the coupon returns", async () => {
    live("price_grow", []);
    await matchOfferToPlan(event);
    expect(stripeMock.update.mock.calls[0]).toEqual([SUB, { discounts: [{ coupon: "GROW40" }] }]);
  });

  it("already right, or an event with nothing else changed: nothing is sent", async () => {
    live("price_grow", [discount("di_1", "GROW40")]);
    await matchOfferToPlan(event);
    live("price_grow_year", []);
    await matchOfferToPlan(event);
    expect(stripeMock.update).not.toHaveBeenCalled();
  });

  it("a subscription without the offer costs no Stripe request, and is not touched", async () => {
    await matchOfferToPlan({ id: SUB, metadata: {} });
    expect(stripeMock.retrieve).not.toHaveBeenCalled();
  });

  it("after the free period it leaves everything alone: the coupon has done its work", async () => {
    live("price_scale", [discount("di_1", "GROW40")], "active");
    await matchOfferToPlan(event);
    expect(stripeMock.update).not.toHaveBeenCalled();
  });

  it("a coupon Stripe refuses tells staff, and does not fail the webhook for ever", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    live("price_scale", [discount("di_1", "GROW40")]);
    stripeMock.update.mockRejectedValueOnce(refused());
    await expect(matchOfferToPlan(event)).resolves.toBeUndefined();
    expect(mail.sendEmail).toHaveBeenCalledTimes(1);
    expect(mail.sendEmail.mock.calls[0][0].text).toContain(SUB);
    log.mockRestore();
  });

  it("a Stripe outage fails the webhook, so it is delivered again", async () => {
    live("price_scale", [discount("di_1", "GROW40")]);
    stripeMock.update.mockRejectedValueOnce(Object.assign(new Error("down"), { type: "StripeConnectionError" }));
    await expect(matchOfferToPlan(event)).rejects.toThrow("down");
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });
});

describe("what counts as a refusal", () => {
  it("only Stripe saying no", () => {
    expect(isCouponRefusal(refused())).toBe(true);
    expect(isCouponRefusal(Object.assign(new Error("x"), { type: "StripeConnectionError" }))).toBe(false);
    expect(isCouponRefusal(new Error("x"))).toBe(false);
    expect(isCouponRefusal(null)).toBe(false);
  });
});
