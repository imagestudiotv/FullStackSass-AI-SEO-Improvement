import { describe, expect, it } from "vitest";

import { FREE_ARTICLES_DAYS } from "@/lib/plans/features";

// What scripts/paypal-setup.mjs sends to PayPal for each of RepGet's plans.
import { FREE_ARTICLES_DAYS as SCRIPT_FREE_DAYS, planBody } from "../../../scripts/paypal-plans.mjs";

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

  it("with the free articles first: the card trial's days free, then the same price (2026-10-22)", () => {
    expect(SCRIPT_FREE_DAYS).toBe(FREE_ARTICLES_DAYS);
    const body = planBody(GROW, "PROD-1", { freeArticles: true });
    expect(body.name).toBe("Grow - free articles first");
    expect(body.billing_cycles).toEqual([
      {
        frequency: { interval_unit: "DAY", interval_count: FREE_ARTICLES_DAYS },
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
    // Failed payments are handled as on the plan without the free articles.
    expect(body.payment_preferences).toEqual(planBody(GROW, "PROD-1").payment_preferences);
  });
});
