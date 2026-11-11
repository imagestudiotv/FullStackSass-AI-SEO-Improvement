import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { automaticRepgetCoupon } from "@/lib/billing/checkouts";

/**
 * Whether the REPGET launch price goes on a checkout by itself (2026-11-11): on
 * every checkout for a plan and interval it covers, while the offer is on. No
 * "one use per account" any more, so nothing about the account decides it; a
 * returning customer's checkout is in checkouts.test.ts.
 */

const grow = { tier: "grow", interval: "month", currency: "eur", priceCents: 14900 };

beforeEach(() => {
  process.env.REPGET_OFFER_ENABLED = "1";
});

afterEach(() => {
  delete process.env.REPGET_OFFER_ENABLED;
});

describe("the REPGET coupon a checkout carries by itself", () => {
  it("the plan's coupon, monthly or yearly", () => {
    expect(automaticRepgetCoupon(grow)).toBe("LP40_GROW_M");
    expect(automaticRepgetCoupon({ ...grow, interval: "year", priceCents: 149000 })).toBe("LP40_GROW_Y");
  });

  it("not on a plan it does not cover (the Grow + Visibility bundle, an older price), nor while switched off", () => {
    expect(automaticRepgetCoupon({ ...grow, tier: "grow_visibility", priceCents: 9900 })).toBeNull();
    expect(automaticRepgetCoupon({ ...grow, priceCents: 9900 })).toBeNull();
    delete process.env.REPGET_OFFER_ENABLED;
    expect(automaticRepgetCoupon(grow)).toBeNull();
  });
});
