import { describe, expect, it } from "vitest";

import { checkoutPlans, checkoutTerms, pickCheckoutPlan, type CheckoutPlan } from "./checkout-terms";

/**
 * The billing step's order and terms (checkout-terms.ts): the onboarding plan
 * step's rules, so the flow never says what checkout will not do - above all
 * never "€0 today" for a PayPal that charges on day one.
 */

const row = (over: Record<string, unknown> = {}) => ({
  id: "grow-m",
  tier: "grow",
  name: "Grow",
  priceCents: 14900,
  currency: "eur",
  interval: "month",
  articleLimit: 30,
  keywordLimit: 100,
  siteLimit: 1,
  monthlyCredits: 0,
  paypalPlanId: null as string | null,
  paypalTrialPlanId: null as string | null,
  ...over,
});

const plan = (over: Partial<CheckoutPlan> = {}): CheckoutPlan => ({
  id: "grow-m",
  tier: "grow",
  interval: "month",
  name: "Grow",
  currency: "eur",
  priceCents: 14900,
  chargedCents: 14900,
  strikeCents: null,
  repget: false,
  paypal: false,
  paypalTrial: false,
  ...over,
});

describe("checkoutPlans", () => {
  const rows = [
    row(),
    row({ id: "grow-y", interval: "year", name: "Grow (Annual)", priceCents: 149000, paypalPlanId: "P-1" }),
    row({ id: "scale-m", tier: "scale", name: "Scale", priceCents: 34900, paypalPlanId: "P-2", paypalTrialPlanId: "P-2T" }),
    row({ id: "free-m", tier: "free", priceCents: 0 }),
  ];

  it("one tier's monthly and yearly rows, named without (Annual)", () => {
    const grow = checkoutPlans(rows, "grow", false, true);
    expect(grow.map((p) => [p.id, p.interval, p.name])).toEqual([
      ["grow-m", "month", "Grow"],
      ["grow-y", "year", "Grow"],
    ]);
    expect(checkoutPlans(rows, "free", false, true)).toEqual([]);
    expect(checkoutPlans(rows, "nope", false, true)).toEqual([]);
  });

  it("PayPal only when it is on and the plan is in PayPal; its trial only with the trial plan", () => {
    expect(checkoutPlans(rows, "grow", false, true).map((p) => [p.paypal, p.paypalTrial])).toEqual([
      [false, false],
      [true, false],
    ]);
    expect(checkoutPlans(rows, "scale", false, true)[0]).toMatchObject({ paypal: true, paypalTrial: true });
    expect(checkoutPlans(rows, "scale", false, false)[0]).toMatchObject({ paypal: false, paypalTrial: false });
  });

  it("the launch price only while it is the offer on screen", () => {
    const on = checkoutPlans(rows, "grow", true, false)[0];
    const off = checkoutPlans(rows, "grow", false, false)[0];
    expect(off).toMatchObject({ chargedCents: 14900, strikeCents: null, repget: false });
    expect(on.repget).toBe(true);
    expect(on.strikeCents).toBe(14900);
    expect(on.chargedCents).toBeLessThan(14900);
  });

  it("picks the period asked, else the monthly plan", () => {
    const grow = checkoutPlans(rows, "grow", false, false);
    expect(pickCheckoutPlan(grow, "year")?.id).toBe("grow-y");
    expect(pickCheckoutPlan(checkoutPlans(rows, "scale", false, false), "year")?.id).toBe("scale-m");
    expect(pickCheckoutPlan([], "month")).toBeNull();
  });
});

describe("checkoutTerms", () => {
  const fresh = { trialEligible: true, emailVerified: true };

  it("a new workspace: nothing today by card, then the price", () => {
    const terms = checkoutTerms(plan(), fresh);
    expect(terms).toMatchObject({ trial: true, needsEmail: false, todayCents: 0, perMonthCents: 14900, line: { kind: "trialMonth", cents: 14900 } });
  });

  it("asks for the email code before a trial, and before PayPal's trial", () => {
    const terms = checkoutTerms(plan({ paypal: true, paypalTrial: true }), { trialEligible: true, emailVerified: false });
    expect(terms.needsEmail).toBe(true);
    expect(terms.paypalNeedsEmail).toBe(true);
    expect(checkoutTerms(plan({ paypal: true }), { trialEligible: true, emailVerified: false }).paypalNeedsEmail).toBe(false);
  });

  it("PayPal without its trial plan charges at once: said so, and the card's €0 is the card's", () => {
    expect(checkoutTerms(plan({ paypal: true, paypalTrial: false }), fresh).paypal).toBe("now");
    expect(checkoutTerms(plan({ paypal: true, paypalTrial: true }), fresh).paypal).toBe("trial");
    expect(checkoutTerms(plan({ paypal: false }), fresh).paypal).toBeNull();
  });

  it("a workspace that had its trial: charged today, card and PayPal alike", () => {
    const terms = checkoutTerms(plan({ paypal: true, paypalTrial: true }), { trialEligible: false, emailVerified: false });
    expect(terms).toMatchObject({ trial: false, needsEmail: false, todayCents: 14900, paypal: null, paypalNeedsEmail: false, line: { kind: "chargedMonth" } });
  });

  it("yearly: quoted per month, the REPGET wording when the launch price applies", () => {
    const yearly = checkoutTerms(plan({ interval: "year", chargedCents: 120000 }), fresh);
    expect(yearly.perMonthCents).toBe(10000);
    expect(yearly.line).toEqual({ kind: "trialYear", cents: 120000 });
    expect(checkoutTerms(plan({ interval: "year", chargedCents: 89000, strikeCents: 149000, repget: true }), fresh).line.kind).toBe("trialYearRepget");
    expect(checkoutTerms(plan({ chargedCents: 8900, strikeCents: 14900, repget: true }), fresh)).toMatchObject({
      strikePerMonthCents: 14900,
      line: { kind: "trialMonthRepget", cents: 8900 },
    });
    expect(checkoutTerms(plan({ interval: "year", chargedCents: 120000 }), { trialEligible: false, emailVerified: true }).line.kind).toBe("chargedYear");
  });
});
