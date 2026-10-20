import { describe, expect, it } from "vitest";

import { DEFAULT_PROGRAM_POLICY } from "@/lib/partners/domain/policies/program";
import { tierForCount } from "@/lib/partners/domain/policies/tiers";
import { CommissionRate } from "@/lib/partners/domain/value-objects/commission-rate";
import { Money } from "@/lib/partners/domain/value-objects/money";

import { commissionPerPayment, levelFor } from "./earnings-calculator";

/**
 * The /partners estimate must agree with what the program pays: the same
 * rounding as the real calculation and the same level for a customer count.
 */
describe("the earnings estimate", () => {
  it("rounds each payment's commission exactly like the commission calculation", () => {
    expect(commissionPerPayment(9900, 2500)).toBe(2475);
    // The client's example: EUR 89.10 at 25% is EUR 22.275, paid as EUR 22.28.
    expect(commissionPerPayment(8910, 2500)).toBe(2228);
    for (const price of [100, 999, 1999, 4950, 8910, 9900, 14_900, 29_900, 99_999]) {
      for (const rate of [2500, 3000, 3500, 3333]) {
        expect(commissionPerPayment(price, rate)).toBe(Number(CommissionRate.ofBasisPoints(rate).apply(Money.of(price, "eur")).amount));
      }
    }
  });

  it("uses the level the program would: the highest threshold reached", () => {
    const tiers = DEFAULT_PROGRAM_POLICY.tiers;
    for (const count of [1, 9, 10, 24, 25, 100]) {
      expect(levelFor(tiers, count).rateBasisPoints).toBe(tierForCount(DEFAULT_PROGRAM_POLICY, count).rateBasisPoints);
    }
    expect(levelFor(tiers, 9).rateBasisPoints).toBe(2500);
    expect(levelFor(tiers, 10).rateBasisPoints).toBe(3000);
    expect(levelFor(tiers, 25).rateBasisPoints).toBe(3500);
  });
});
