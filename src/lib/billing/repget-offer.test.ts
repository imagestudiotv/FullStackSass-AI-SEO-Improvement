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
const refused = () => Object.assign(new Error("No such coupon: 'SCALE40'"), { type: "StripeInvalidRequestError" });

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
    expect(repgetCouponFor(month("launch", 9900))).toBe("LAUNCH40");
    expect(repgetCouponFor(month("grow", 14900))).toBe("GROW40");
    expect(repgetCouponFor(month("scale", 34900))).toBe("SCALE40");
  });

  it("each yearly plan its own YEARLY coupon (2026-11-11: 40% off the first year), never the monthly one", () => {
    expect(repgetCouponFor(year("launch", 99000))).toBe("LAUNCH40Y");
    expect(repgetCouponFor(year("grow", 149000))).toBe("GROW40Y");
    expect(repgetCouponFor(year("scale", 349000))).toBe("SCALE40Y");
  });

  it("monthly keeps the live fixed amounts; yearly takes 40% off the whole first year, as the page bills it", () => {
    expect([9900, 14900, 34900].map((cents, i) => repgetDiscountCents(month(["launch", "grow", "scale"][i], cents)))).toEqual([3960, 5960, 13960]);
    expect([99000, 149000, 349000].map((cents, i) => repgetDiscountCents(year(["launch", "grow", "scale"][i], cents)))).toEqual([40000, 60000, 140000]);
    expect(repgetFirstPaymentCents(year("launch", 99000))).toBe(59000);
    expect(repgetFirstPaymentCents(year("grow", 149000))).toBe(89000);
    expect(repgetFirstPaymentCents(year("scale", 349000))).toBe(209000);
    // The monthly charge is 40 cents over the page's rounded EUR 59 (owner's decision: keep the live coupons).
    expect(repgetFirstPaymentCents(month("launch", 9900))).toBe(5940);
  });

  it("the yearly first payment is exactly the yearly price the page shows", () => {
    for (const [tier, cents] of [["launch", 99000], ["grow", 149000], ["scale", 349000]] as const) {
      expect(repgetFirstPaymentCents(year(tier, cents))).toBe(offerDisplayCents(cents, "year"));
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
  it("40% off, rounded down as the design shows it: to the euro a month, to ten euros a year", () => {
    expect([9900, 14900, 34900].map((cents) => offerDisplayCents(cents, "month"))).toEqual([5900, 8900, 20900]);
    expect([99000, 149000, 349000].map((cents) => offerDisplayCents(cents, "year"))).toEqual([59000, 89000, 209000]);
  });
});

describe("a plan changed during the free period", () => {
  it("to another plan: that plan's coupon replaces the old one", async () => {
    live("price_scale", [discount("di_1", "GROW40")]);
    await matchOfferToPlan(event);
    expect(stripeMock.update.mock.calls[0]).toEqual([SUB, { discounts: [{ coupon: "SCALE40" }] }]);
  });

  it("to annual: the monthly coupon is swapped for the yearly one (40% off the first year)", async () => {
    live("price_grow_year", [discount("di_1", "GROW40")]);
    await matchOfferToPlan(event);
    expect(stripeMock.update.mock.calls[0]).toEqual([SUB, { discounts: [{ coupon: "GROW40Y" }] }]);
  });

  it("to another tier's annual price: that tier's yearly coupon replaces the old one", async () => {
    live("price_scale_year", [discount("di_1", "GROW40")]);
    await matchOfferToPlan(event);
    expect(stripeMock.update.mock.calls[0]).toEqual([SUB, { discounts: [{ coupon: "SCALE40Y" }] }]);
  });

  it("back from annual to monthly: the yearly coupon is swapped for the monthly one", async () => {
    live("price_grow", [discount("di_1", "GROW40Y")]);
    await matchOfferToPlan(event);
    expect(stripeMock.update.mock.calls[0]).toEqual([SUB, { discounts: [{ coupon: "GROW40" }] }]);
  });

  it("already right, or an event with nothing else changed: nothing is sent", async () => {
    live("price_grow", [discount("di_1", "GROW40")]);
    await matchOfferToPlan(event);
    live("price_grow_year", [discount("di_1", "GROW40Y")]);
    await matchOfferToPlan(event);
    expect(stripeMock.update).not.toHaveBeenCalled();
  });

  it("a subscription without the offer costs no Stripe request, and is not touched", async () => {
    await matchOfferToPlan({ id: SUB, metadata: {} });
    expect(stripeMock.retrieve).not.toHaveBeenCalled();
  });

  it("a late or repeated event finds the offer already finished, and does nothing", async () => {
    live("price_scale", [discount("di_1", "GROW40")], "active", paid(0), {});
    await matchOfferToPlan(event);
    expect(stripeMock.update).not.toHaveBeenCalled();
    expect(mail.sendEmail).not.toHaveBeenCalled();
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

describe("after the free period, on the first paid invoice", () => {
  it("discounted: the offer is finished, and nobody is told", async () => {
    live("price_grow", [], "active", paid(5960));
    await matchOfferToPlan(event);
    expect(stripeMock.update.mock.calls[0]).toEqual([SUB, { metadata: { repget_offer: "" } }]);
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });

  it("charged in full when the discount was owed: staff are told, once", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    live("price_scale", [], "active", paid(0, 34900));
    await matchOfferToPlan(event);
    expect(mail.sendEmail).toHaveBeenCalledTimes(1);
    expect(mail.sendEmail.mock.calls[0][0].text).toContain("in_1");
    expect(stripeMock.update.mock.calls[0]).toEqual([SUB, { metadata: { repget_offer: "" } }]);
    log.mockRestore();
  });

  it("on annual, the first annual invoice without the discount: staff are told, as for monthly", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    live("price_grow_year", [], "active", paid(0, 149000));
    await matchOfferToPlan(event);
    expect(mail.sendEmail).toHaveBeenCalledTimes(1);
    expect(stripeMock.update).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  it("on a price the offer does not cover, where none is owed: finished, and nobody is told", async () => {
    live("price_grow_old", [], "active", paid(0, 9900));
    await matchOfferToPlan(event);
    expect(mail.sendEmail).not.toHaveBeenCalled();
    expect(stripeMock.update).toHaveBeenCalledTimes(1);
  });

  it("no paid invoice yet: it waits for one", async () => {
    live("price_grow", [], "active", paid(0, 0));
    await matchOfferToPlan(event);
    expect(stripeMock.update).not.toHaveBeenCalled();
    expect(mail.sendEmail).not.toHaveBeenCalled();
  });
});

describe("what a plan change owes", () => {
  const scale = month("scale", 34900);
  const growAnnual = { ...month("grow", 149000), interval: "year" };
  const on = (coupon: string, status = "trialing") => ({ status, metadata: { repget_offer: "REPGET" }, discounts: [discount("di_1", coupon)] }) as never;

  it("Grow to Scale, and Scale to Grow: the new plan's coupon", () => {
    expect(offerForPlanChange(on("GROW40"), scale)).toEqual({ coupon: "SCALE40" });
    expect(offerForPlanChange(on("SCALE40"), month("grow", 14900))).toEqual({ coupon: "GROW40" });
  });

  it("to annual, with the discount unused: the annual price's yearly coupon", () => {
    expect(offerForPlanChange(on("GROW40"), growAnnual)).toEqual({ coupon: "GROW40Y" });
    expect(offerForPlanChange(on("SCALE40"), { ...month("scale", 349000), interval: "year" })).toEqual({ coupon: "SCALE40Y" });
  });

  it("a yearly coupon counts as the offer's too: back to monthly takes the monthly coupon", () => {
    expect(offerForPlanChange(on("GROW40Y", "active"), month("grow", 14900))).toEqual({ coupon: "GROW40" });
  });

  it("to a plan the offer does not cover (an older price): refused while the discount is unused", () => {
    expect(offerForPlanChange(on("GROW40"), month("grow", 9900)).refuse).toContain("does not cover");
  });

  it("on the free period with the coupon off, as after a move to annual and back: it returns", () => {
    expect(offerForPlanChange({ status: "trialing", metadata: { repget_offer: "REPGET" }, discounts: [] } as never, scale)).toEqual({ coupon: "SCALE40" });
  });

  it("the discount used: nothing, and annual is open", () => {
    expect(offerForPlanChange({ status: "active", metadata: { repget_offer: "REPGET" }, discounts: [] } as never, growAnnual)).toEqual({});
  });

  it("the same coupon reached by a Stripe promotion code, not RepGet's field: left as it is, annual included", () => {
    expect(offerForPlanChange({ status: "trialing", metadata: {}, discounts: [discount("di_1", "GROW40")] } as never, growAnnual)).toEqual({});
    expect(offerForPlanChange({ status: "trialing", metadata: {}, discounts: [discount("di_1", "GROW40")] } as never, scale)).toEqual({});
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
