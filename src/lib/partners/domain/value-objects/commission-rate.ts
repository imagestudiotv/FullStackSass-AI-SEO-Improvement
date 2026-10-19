import { InvalidAmountError } from "../errors";
import { Money } from "./money";

/**
 * A commission rate in integer basis points: 2500 is 25%.
 *
 * Basis points keep the rate exact. 25% of EUR 89.10 is 891000 * 2500 /
 * 10000 = 2227.5 minor units, rounded half up once to EUR 22.28 - there is no
 * 0.25 anywhere to drift.
 */
const BASIS_POINTS = BigInt(10_000);

export class CommissionRate {
  private constructor(readonly basisPoints: number) {}

  static ofBasisPoints(basisPoints: number): CommissionRate {
    if (!Number.isInteger(basisPoints) || basisPoints < 0 || basisPoints > 10_000) {
      throw new InvalidAmountError(`Rate ${basisPoints} must be an integer between 0 and 10000 basis points`);
    }
    return new CommissionRate(basisPoints);
  }

  /** The commission on `base`, rounded half up at the final minor unit. */
  apply(base: Money): Money {
    return base.multiplyFraction(BigInt(this.basisPoints), BASIS_POINTS);
  }

  /** "25%", "30%", "27.5%". */
  toPercentLabel(): string {
    const whole = Math.trunc(this.basisPoints / 100);
    const rest = this.basisPoints % 100;
    if (rest === 0) return `${whole}%`;
    return `${whole}.${String(rest).padStart(2, "0").replace(/0+$/, "")}%`;
  }
}
