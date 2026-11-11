import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { plans } from "@/lib/db/schema";
import { createTestDb, type TestDb } from "@/test/db";

/**
 * The REPGET launch price: which coupon, and keeping it on the right plan
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

import { offerDisplayCents, repgetCouponFor, repgetDiscountCents, repgetFirstPaymentCents } from "@/lib/billing/repget-offer";
import { REPGET_STRIPE_COUPONS } from "../../../scripts/plan-catalog.mjs";
import { isCouponRefusal, matchOfferToPlan, offerForPlanChange } from "@/lib/billing/repget-subscription";

let test: TestDb;
const SUB = "sub_1";
const month = (tier: string, priceCents: number) => ({ tier, interval: "month", currency: "eur", priceCents });
const discount = (id: string, coupon: string) => ({ id, source: { coupon } });
const event = { id: SUB, metadata: { repget_offer: "REPGET" } };
const live = (price: string, discounts: unknown[], status = "trialing", latest_invoice: unknown = null, metadata: Record<string, string> = { repget_offer: "REPGET" }) =>
  stripeMock.retrieve.mockResolvedValue({ id: SUB, status, discounts, metadata, latest_invoice, items: { data: [{ price: { id: price } }] } });
const paid = (discount: number, subtotal = 14900) => ({ id: "in_1", subtotal, total_discount_amounts: discount ? [{ amount: discount }] : [] });
const refused = () => Object.assign(new Error("No such coupon: 'LP40_SCALE_M'"), { type: "StripeInvalidRequestError" });

beforeAll(async () => {
  test = await createTestDb();
  state.db = test.db;
  const row = { articleLimit: 1, keywordLimit: 1, siteLimit: 1, monthlyCredits: 1, currency: "eur" };
  await test.db.insert(plans).values([
    { ...row, name: "T Grow", tier: "grow", interval: "month", priceCents: 14900, stripePriceId: "price_grow", catalogVersion: 2 },
    { ...row, name: "T Scale", tier: "scale", interval: "month", priceCents: 34900, stripePriceId: "price_scale", catalogVersion: 2 },
    { ...row, name: "T Grow (Annual)", tier: "grow", interval: "year", priceCents: 149000, stripePriceId: "price_grow_year", catalogVersion: 2 },
    { ...row, name: "T Scale (Annual)", tier: "scale", interval: "year", priceCents: 349000, stripePriceId: "price_scale_year", catalogVersion: 2 },
    // An older catalogue's price on the same tier: the offer does not cover it.
    { ...row, name: "T Old Grow", tier: "grow", interval: "month", priceCents: 9900, stripePriceId: "price_grow_old", catalogVersion: 1 },
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
  const year = (tier: string, priceCents: number) => ({ ...month(tier, priceCents), interval: "year" });

  it("each monthly plan its own monthly coupon, at the price the coupon was made for", () => {
    expect(repgetCouponFor(month("launch", 9900))).toBe("LP40_LAUNCH_M");
    expect(repgetCouponFor(month("grow", 14900))).toBe("LP40_GROW_M");
    expect(repgetCouponFor(month("scale", 34900))).toBe("LP40_SCALE_M");
  });

  it("each yearly plan its own YEARLY coupon, never the monthly one", () => {
    expect(repgetCouponFor(year("launch", 99000))).toBe("LP40_LAUNCH_Y");
    expect(repgetCouponFor(year("grow", 149000))).toBe("LP40_GROW_Y");
    expect(repgetCouponFor(year("scale", 349000))).toBe("LP40_SCALE_Y");
  });

  it("the launch price on every payment: EUR 59 / 89 / 209 a month, 590 / 890 / 2,090 a year", () => {
    expect([9900, 14900, 34900].map((cents, i) => repgetDiscountCents(month(["launch", "grow", "scale"][i], cents)))).toEqual([4000, 6000, 14000]);
    expect([99000, 149000, 349000].map((cents, i) => repgetDiscountCents(year(["launch", "grow", "scale"][i], cents)))).toEqual([40000, 60000, 140000]);
    expect([9900, 14900, 34900].map((cents, i) => repgetFirstPaymentCents(month(["launch", "grow", "scale"][i], cents)))).toEqual([5900, 8900, 20900]);
    expect([99000, 149000, 349000].map((cents, i) => repgetFirstPaymentCents(year(["launch", "grow", "scale"][i], cents)))).toEqual([59000, 89000, 209000]);
  });

  it("what is charged is exactly the price the page shows, monthly and yearly", () => {
    for (const [tier, cents] of [["launch", 9900], ["grow", 14900], ["scale", 34900]] as const) {
      expect(repgetFirstPaymentCents(month(tier, cents))).toBe(offerDisplayCents(cents, "month"));
      expect(repgetFirstPaymentCents(year(tier, cents * 10))).toBe(offerDisplayCents(cents * 10, "year"));
    }
  });

  it("the Stripe coupons the setup script creates say the same amounts", () => {
    for (const coupon of REPGET_STRIPE_COUPONS) {
      const price = { launch: 9900, grow: 14900, scale: 34900 }[coupon.tier as "launch" | "grow" | "scale"] * (coupon.interval === "year" ? 10 : 1);
      const plan = { tier: coupon.tier, interval: coupon.interval, currency: "eur", priceCents: price };
      expect(repgetCouponFor(plan)).toBe(coupon.id);
      expect(repgetDiscountCents(plan)).toBe(coupon.amountOffCents);
    }
    expect(REPGET_STRIPE_COUPONS).toHaveLength(6);
  });

  it("not an older price on the same tier (monthly or annual), not another currency or tier, not the bundle", () => {
    expect(repgetCouponFor(year("grow", 14900))).toBeNull();
    expect(repgetCouponFor(year("grow", 99000))).toBeNull();
    expect(repgetCouponFor(month("grow", 149000))).toBeNull();
    expect(repgetCouponFor(month("grow", 9900))).toBeNull();
    expect(repgetCouponFor({ ...month("grow", 14900), currency: "usd" })).toBeNull();
    expect(repgetCouponFor(month("legacy", 14900))).toBeNull();
    expect(repgetCouponFor(month("grow_visibility", 9900))).toBeNull();
    expect(repgetDiscountCents(month("grow_visibility", 9900))).toBeNull();
  });
});

describe("the offer price the pricing page shows", () => {
  it("40% off as the design shows it: to the euro a month, to ten euros a year", () => {
    expect([9900, 14900, 34900].map((cents) => offerDisplayCents(cents, "month"))).toEqual([5900, 8900, 20900]);
    expect([99000, 149000, 349000].map((cents) => offerDisplayCents(cents, "year"))).toEqual([59000, 89000, 209000]);
  });
});

describe("a plan changed outside Billing", () => {
  it("to another plan: that plan's coupon replaces the old one", async () => {
    live("price_scale", [discount("di_1", "LP40_GROW_M")]);
    await matchOfferToPlan(event);
    expect(stripeMock.update.mock.calls[0]).toEqual([SUB, { discounts: [{ coupon: "LP40_SCALE_M" }] }]);
  });

  it("to annual: the monthly coupon is swapped for the yearly one", async () => {
    live("price_grow_year", [discount("di_1", "LP40_GROW_M")]);
    await matchOfferToPlan(event);
    expect(stripeMock.update.mock.calls[0]).toEqual([SUB, { discounts: [{ coupon: "LP40_GROW_Y" }] }]);
  });

  it("to another tier's annual price: that tier's yearly coupon replaces the old one", async () => {
    live("price_scale_year", [discount("di_1", "LP40_GROW_M")]);
    await matchOfferToPlan(event);
    expect(stripeMock.update.mock.calls[0]).toEqual([SUB, { discounts: [{ coupon: "LP40_SCALE_Y" }] }]);
  });

  it("back from annual to monthly: the yearly coupon is swapped for the monthly one", async () => {
    live("price_grow", [discount("di_1", "LP40_GROW_Y")]);
    await matchOfferToPlan(event);
    expect(stripeMock.update.mock.calls[0]).toEqual([SUB, { discounts: [{ coupon: "LP40_GROW_M" }] }]);
  });

  it("already right, or an event with nothing else changed: nothing is sent", async () => {
    live("price_grow", [discount("di_1", "LP40_GROW_M")]);
    await matchOfferToPlan(event);
    live("price_grow_year", [discount("di_1", "LP40_GROW_Y")], "active", paid(60000, 149000));
    await matchOfferToPlan(event);
    expect(stripeMock.update).not.toHaveBeenCalled();
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });

  it("a subscription without the offer costs no Stripe request, and is not touched", async () => {
    await matchOfferToPlan({ id: SUB, metadata: {} });
    expect(stripeMock.retrieve).not.toHaveBeenCalled();
  });

  it("an offer ended by hand (its metadata cleared in Stripe), or a subscription that ended: nothing is done", async () => {
    live("price_scale", [discount("di_1", "LP40_GROW_M")], "active", paid(0), {});
    await matchOfferToPlan(event);
    live("price_scale", [discount("di_1", "LP40_GROW_M")], "canceled");
    await matchOfferToPlan(event);
    expect(stripeMock.update).not.toHaveBeenCalled();
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });

  it("a coupon Stripe refuses tells staff, and does not fail the webhook for ever", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    live("price_scale", [discount("di_1", "LP40_GROW_M")]);
    stripeMock.update.mockRejectedValueOnce(refused());
    await expect(matchOfferToPlan(event)).resolves.toBeUndefined();
    expect(mail.sendEmail).toHaveBeenCalledTimes(1);
    expect(mail.sendEmail.mock.calls[0][0].text).toContain(SUB);
    log.mockRestore();
  });

  it("a Stripe outage fails the webhook, so it is delivered again", async () => {
    live("price_scale", [discount("di_1", "LP40_GROW_M")]);
    stripeMock.update.mockRejectedValueOnce(Object.assign(new Error("down"), { type: "StripeConnectionError" }));
    await expect(matchOfferToPlan(event)).rejects.toThrow("down");
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });
});

describe("after the free period: the coupon is forever, never used up", () => {
  it("each paid invoice discounted: nothing to do, and the offer is not ended", async () => {
    live("price_grow", [discount("di_1", "LP40_GROW_M")], "active", paid(6000));
    await matchOfferToPlan(event);
    expect(stripeMock.update).not.toHaveBeenCalled();
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });

  it("changed outside Billing and charged in full: corrected for the payments to come, and staff are told of that invoice", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    live("price_scale", [discount("di_1", "LP40_GROW_M")], "active", paid(0, 34900));
    await matchOfferToPlan(event);
    expect(stripeMock.update.mock.calls[0]).toEqual([SUB, { discounts: [{ coupon: "LP40_SCALE_M" }] }]);
    expect(mail.sendEmail).toHaveBeenCalledTimes(1);
    expect(mail.sendEmail.mock.calls[0][0].text).toContain("in_1");
    log.mockRestore();
  });

  it("corrected when its latest invoice had the discount: nobody is told", async () => {
    live("price_grow_year", [discount("di_1", "LP40_GROW_M")], "active", paid(6000));
    await matchOfferToPlan(event);
    expect(stripeMock.update.mock.calls[0]).toEqual([SUB, { discounts: [{ coupon: "LP40_GROW_Y" }] }]);
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });

  it("an invoice paid without the discount (invoice.paid), the coupon already right: staff are told of it", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    live("price_grow", [discount("di_1", "LP40_GROW_M")], "active", paid(6000));
    await matchOfferToPlan(event, "in_9");
    expect(stripeMock.update).not.toHaveBeenCalled();
    expect(mail.sendEmail).toHaveBeenCalledTimes(1);
    expect(mail.sendEmail.mock.calls[0][0].text).toContain("in_9");
    log.mockRestore();
  });

  it("moved to a price the offer does not cover: its coupon comes off, and nobody is told", async () => {
    live("price_grow_old", [discount("di_1", "LP40_GROW_M")], "active", paid(0, 9900));
    await matchOfferToPlan(event, "in_1");
    expect(stripeMock.update.mock.calls[0]).toEqual([SUB, { discounts: "" }]);
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });
});

describe("what a plan change owes", () => {
  const scale = month("scale", 34900);
  const growAnnual = { ...month("grow", 149000), interval: "year" };
  const on = (coupon: string, status = "trialing") => ({ status, metadata: { repget_offer: "REPGET" }, discounts: [discount("di_1", coupon)] }) as never;

  it("Grow to Scale, and Scale to Grow: the new plan's coupon", () => {
    expect(offerForPlanChange(on("LP40_GROW_M"), scale)).toEqual({ coupon: "LP40_SCALE_M" });
    expect(offerForPlanChange(on("LP40_SCALE_M"), month("grow", 14900))).toEqual({ coupon: "LP40_GROW_M" });
  });

  it("to annual: the annual price's yearly coupon", () => {
    expect(offerForPlanChange(on("LP40_GROW_M"), growAnnual)).toEqual({ coupon: "LP40_GROW_Y" });
    expect(offerForPlanChange(on("LP40_SCALE_M"), { ...month("scale", 349000), interval: "year" })).toEqual({ coupon: "LP40_SCALE_Y" });
  });

  it("at any time, not only during the free period: back to monthly takes the monthly coupon", () => {
    expect(offerForPlanChange(on("LP40_GROW_Y", "active"), month("grow", 14900))).toEqual({ coupon: "LP40_GROW_M" });
    expect(offerForPlanChange(on("LP40_GROW_M", "active"), scale)).toEqual({ coupon: "LP40_SCALE_M" });
  });

  it("to a plan the offer does not cover (an older price): refused, as it would end the launch price", () => {
    expect(offerForPlanChange(on("LP40_GROW_M"), month("grow", 9900)).refuse).toContain("does not cover");
    expect(offerForPlanChange(on("LP40_GROW_M", "active"), month("grow", 9900)).refuse).toContain("does not cover");
  });

  it("with the coupon off, as after a move to annual and back: it returns, free period or not", () => {
    expect(offerForPlanChange({ status: "trialing", metadata: { repget_offer: "REPGET" }, discounts: [] } as never, scale)).toEqual({ coupon: "LP40_SCALE_M" });
    expect(offerForPlanChange({ status: "active", metadata: { repget_offer: "REPGET" }, discounts: [] } as never, growAnnual)).toEqual({ coupon: "LP40_GROW_Y" });
  });

  it("the same coupon reached by a Stripe promotion code, not RepGet's field: left as it is, annual included", () => {
    expect(offerForPlanChange({ status: "trialing", metadata: {}, discounts: [discount("di_1", "LP40_GROW_M")] } as never, growAnnual)).toEqual({});
    expect(offerForPlanChange({ status: "trialing", metadata: {}, discounts: [discount("di_1", "LP40_GROW_M")] } as never, scale)).toEqual({});
  });

  it("a partner coupon, and no offer: nothing, annual included", () => {
    expect(offerForPlanChange({ status: "trialing", metadata: {}, discounts: [discount("di_2", "PARTNER10")] } as never, growAnnual)).toEqual({});
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
