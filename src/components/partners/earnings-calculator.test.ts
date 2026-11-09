import { describe, expect, it } from "vitest";

import { DEFAULT_PROGRAM_POLICY } from "@/lib/partners/domain/policies/program";
import { tierForCount } from "@/lib/partners/domain/policies/tiers";
import { CommissionRate } from "@/lib/partners/domain/value-objects/commission-rate";
import { Money } from "@/lib/partners/domain/value-objects/money";

import { commissionPerPayment, growthTarget, levelFor, networkPoints, shortTierName } from "./earnings-calculator";

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

  it("changes level exactly at the thresholds: 9 and 10, 24 and 25", () => {
    const tiers = DEFAULT_PROGRAM_POLICY.tiers;
    expect([9, 10, 24, 25].map((count) => levelFor(tiers, count).name)).toEqual(["Base Partner", "Growth Partner", "Growth Partner", "Premier Partner"]);
    // On EUR 149: 9 x 25% = EUR 335.25, 10 x 30% = EUR 447, 24 x 30% = EUR 1,072.80, 25 x 35% = EUR 1,303.75 a month.
    expect([9, 10, 24, 25].map((count) => count * commissionPerPayment(14_900, levelFor(tiers, count).rateBasisPoints))).toEqual([33_525, 44_700, 107_280, 130_375]);
  });

  it("grows the illustration to the next level, then twice the top one, then starts again", () => {
    const tiers = DEFAULT_PROGRAM_POLICY.tiers;
    expect([1, 9, 10, 24, 25, 49, 50, 75].map((count) => growthTarget(tiers, count))).toEqual([10, 10, 25, 25, 50, 50, 5, 5]);
    expect(shortTierName("Growth Partner")).toBe("Growth");
    expect(shortTierName("Partner")).toBe("Partner");
  });

  it("draws one dot per referral up to 48, at the same rounded places on the server and in the browser", () => {
    expect(networkPoints(10)).toHaveLength(10);
    expect(networkPoints(75)).toHaveLength(48);
    for (const point of networkPoints(30)) expect(Math.round(point.x * 100) / 100).toBe(point.x);
    // The first dot of a small network is straight above the centre.
    expect(networkPoints(5)[0]).toEqual({ x: 275, y: 56 });
  });
});
