import { describe, expect, it } from "vitest";

import { isNoCharge } from "@/lib/billing-shared";

describe("isNoCharge", () => {
  it("is a paid invoice for zero - a free trial's (or a 100% discount's) invoice", () => {
    expect(isNoCharge({ amountCents: 0, status: "paid" })).toBe(true);
  });

  it("is not a real payment, a failed attempt, or a refund", () => {
    expect(isNoCharge({ amountCents: 4900, status: "paid" })).toBe(false);
    expect(isNoCharge({ amountCents: 0, status: "failed" })).toBe(false);
    expect(isNoCharge({ amountCents: 4900, status: "refunded" })).toBe(false);
  });
});
