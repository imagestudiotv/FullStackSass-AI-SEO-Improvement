import { describe, expect, it } from "vitest";

import { TRIAL_DAYS } from "@/lib/plans/features";

// What scripts/paypal-setup.mjs sends to PayPal for each of RepGet's plans.
import { freeTrialDays, planBody, TRIAL_DAYS as SCRIPT_TRIAL_DAYS } from "../../../scripts/paypal-plans.mjs";

const GROW = { name: "Grow", interval: "month", currency: "eur", price_cents: 9900 };
const GROW_ANNUAL = { name: "Grow (Annual)", interval: "year", currency: "eur", price_cents: 99000 };

describe("the PayPal plans RepGet creates", () => {
  it("bill the plan's price every month or year until cancelled", () => {
    const body = planBody(GROW, "PROD-1");
    expect(body).toMatchObject({ product_id: "PROD-1", name: "Grow", status: "ACTIVE" });
    expect(body.billing_cycles).toEqual([
      {
        frequency: { interval_unit: "MONTH", interval_count: 1 },
        tenure_type: "REGULAR",
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: { fixed_price: { value: "99.00", currency_code: "EUR" } },
      },
    ]);
    expect(planBody(GROW_ANNUAL, "PROD-1").billing_cycles[0]).toMatchObject({
      frequency: { interval_unit: "YEAR", interval_count: 1 },
      pricing_scheme: { fixed_price: { value: "990.00", currency_code: "EUR" } },
    });
  });

  it("with the free trial first: the card trial's TRIAL_DAYS free, then the same price (2026-11-13)", () => {
    expect(SCRIPT_TRIAL_DAYS).toBe(TRIAL_DAYS);
    expect(TRIAL_DAYS).toBe(3);
    const body = planBody(GROW, "PROD-1", { trial: true });
    expect(body.name).toBe("Grow - 3-day free trial");
    expect(body.billing_cycles).toEqual([
      {
        frequency: { interval_unit: "DAY", interval_count: TRIAL_DAYS },
        tenure_type: "TRIAL",
        sequence: 1,
        total_cycles: 1,
        pricing_scheme: { fixed_price: { value: "0", currency_code: "EUR" } },
      },
      {
        frequency: { interval_unit: "MONTH", interval_count: 1 },
        tenure_type: "REGULAR",
        sequence: 2,
        total_cycles: 0,
        pricing_scheme: { fixed_price: { value: "99.00", currency_code: "EUR" } },
      },
    ]);
    // Failed payments are handled as on the plan without the trial.
    expect(body.payment_preferences).toEqual(planBody(GROW, "PROD-1").payment_preferences);
  });
});

describe("the REPGET offer plans (review P5)", () => {
  it("one intro cycle priced like the regular one, then the regular price", () => {
    const body = planBody(GROW, "PROD-1", { offer: true });
    expect(body.name).toBe("Grow - REPGET offer");
    expect(body.billing_cycles.map((cycle) => [cycle.tenure_type, cycle.sequence, cycle.total_cycles, cycle.pricing_scheme.fixed_price.value])).toEqual([
      ["TRIAL", 1, 1, "99.00"],
      ["REGULAR", 2, 0, "99.00"],
    ]);
  });

  it("with the free trial: the free days, then the intro cycle, then the regular price", () => {
    const body = planBody(GROW_ANNUAL, "PROD-1", { trial: true, offer: true });
    expect(body.name).toBe("Grow (Annual) - 3-day free trial, REPGET offer");
    expect(body.billing_cycles[0].frequency).toEqual({ interval_unit: "DAY", interval_count: TRIAL_DAYS });
    expect(body.billing_cycles.map((cycle) => [cycle.tenure_type, cycle.sequence, cycle.frequency.interval_unit, cycle.pricing_scheme.fixed_price.value])).toEqual([
      ["TRIAL", 1, "DAY", "0"],
      ["TRIAL", 2, "YEAR", "990.00"],
      ["REGULAR", 3, "YEAR", "990.00"],
    ]);
  });
});

describe("telling a 30-day free-articles plan from a TRIAL_DAYS one (scripts/paypal-trial-3day.mjs)", () => {
  it("reads the free days of the first cycle, as PayPal returns a plan", () => {
    expect(freeTrialDays(planBody(GROW, "PROD-1", { trial: true }))).toBe(TRIAL_DAYS);
    expect(freeTrialDays(planBody(GROW_ANNUAL, "PROD-1", { trial: true, offer: true }))).toBe(TRIAL_DAYS);
    const legacy = planBody(GROW, "PROD-1", { trial: true });
    legacy.billing_cycles[0].frequency.interval_count = 30;
    expect(freeTrialDays(legacy)).toBe(30);
  });

  it("is null for a plan without free days: the plan itself, or an offer plan's paid intro cycle", () => {
    expect(freeTrialDays(planBody(GROW, "PROD-1"))).toBeNull();
    expect(freeTrialDays(planBody(GROW, "PROD-1", { offer: true }))).toBeNull();
    expect(freeTrialDays({})).toBeNull();
  });
});
