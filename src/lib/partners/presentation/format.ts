import type { ProgramPolicy, TierDefinition } from "../domain/policies/program";
import { CommissionRate } from "../domain/value-objects/commission-rate";
import { moneyView } from "./serializers";

/**
 * Display strings derived from the program policy - formatting only, no
 * money arithmetic. Safe for server components to compute and pass down.
 */

export function rateLabel(basisPoints: number): string {
  return CommissionRate.ofBasisPoints(basisPoints).toPercentLabel();
}

export function baseRate(policy: ProgramPolicy): string {
  const sorted = [...policy.tiers].sort((a, b) => a.minCustomers - b.minCustomers);
  return rateLabel(sorted[0].rateBasisPoints);
}

export function sortedTiers(policy: ProgramPolicy): TierDefinition[] {
  return [...policy.tiers].sort((a, b) => a.minCustomers - b.minCustomers);
}

/** "€25.00" for the EUR threshold; null when the currency has none. */
export function thresholdLabel(policy: ProgramPolicy, currency: string, locale: string): string | null {
  const amount = policy.payoutThresholds[currency.toLowerCase()];
  return amount === undefined ? null : moneyView(BigInt(amount), currency, locale).display;
}

/** The values every partner sentence may reference. */
export function policyValues(policy: ProgramPolicy, locale: string) {
  return {
    rate: baseRate(policy),
    months: policy.eligibilityMonths,
    days: policy.attributionWindowDays,
    maturity: policy.maturityDays,
    amount: thresholdLabel(policy, "eur", locale) ?? "",
  };
}
