import { CommissionRate } from "../value-objects/commission-rate";
import { currency } from "../value-objects/currency";
import { Money, toBigInt } from "../value-objects/money";

/**
 * One version of the partner program's rules.
 *
 * Every commission records the version it was calculated under, so a rule
 * change applies to future payments and never rewrites history. Versions are
 * stored in partner_program_versions; version 1 (below) is seeded by the
 * migration that creates the tables.
 */

export type TierKey = "base" | "growth" | "premier";

export type TierDefinition = {
  key: TierKey;
  name: string;
  /** Integer basis points: 2500 = 25%. */
  rateBasisPoints: number;
  /** Distinct qualifying paying customer organizations needed. */
  minCustomers: number;
};

export type ProgramPolicy = {
  version: number;
  tiers: TierDefinition[];
  /** How long a click can lead to an attributed signup. */
  attributionWindowDays: number;
  /** Coupon-only attribution: first checkout within this many days of signup. */
  couponAttributionDays: number;
  /** Commission eligibility from the first qualifying payment, in calendar months. */
  eligibilityMonths: number;
  /** Days a commission waits before it may be paid (Net 30). */
  maturityDays: number;
  /**
   * Automatic payout threshold per currency, minor units as decimal strings.
   * A currency without a threshold is never paid automatically.
   */
  payoutThresholds: Record<string, string>;
};

/** The defaults this release ships with. */
export const DEFAULT_PROGRAM_POLICY: ProgramPolicy = {
  version: 1,
  tiers: [
    { key: "base", name: "Base Partner", rateBasisPoints: 2500, minCustomers: 0 },
    { key: "growth", name: "Growth Partner", rateBasisPoints: 3000, minCustomers: 10 },
    { key: "premier", name: "Premier Partner", rateBasisPoints: 3500, minCustomers: 25 },
  ],
  attributionWindowDays: 90,
  couponAttributionDays: 90,
  eligibilityMonths: 12,
  maturityDays: 30,
  payoutThresholds: { eur: "2500" },
};

/** Validates a stored policy. Throws on anything inconsistent. */
export function parseProgramPolicy(raw: unknown): ProgramPolicy {
  const value = raw as Partial<ProgramPolicy> | null;
  if (!value || typeof value !== "object") throw new Error("Program policy is missing");
  const tiers = Array.isArray(value.tiers) ? value.tiers : [];
  if (tiers.length === 0) throw new Error("Program policy has no tiers");
  const sorted = [...tiers].sort((a, b) => a.minCustomers - b.minCustomers);
  if (sorted[0].minCustomers !== 0) throw new Error("The first tier must start at 0 customers");
  for (const tier of sorted) {
    CommissionRate.ofBasisPoints(tier.rateBasisPoints);
    if (!Number.isInteger(tier.minCustomers) || tier.minCustomers < 0) {
      throw new Error(`Tier ${tier.key} has an invalid customer threshold`);
    }
  }
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].minCustomers === sorted[i - 1].minCustomers) {
      throw new Error("Two tiers share a customer threshold");
    }
  }
  const positive = (n: unknown, name: string) => {
    if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) throw new Error(`${name} must be a positive integer`);
    return n;
  };
  const thresholds: Record<string, string> = {};
  for (const [code, amount] of Object.entries(value.payoutThresholds ?? {})) {
    currency(code);
    const minor = toBigInt(amount);
    if (minor <= BigInt(0)) throw new Error(`Payout threshold for ${code} must be positive`);
    thresholds[code.toLowerCase()] = minor.toString();
  }
  return {
    version: positive(value.version, "version"),
    tiers: sorted,
    attributionWindowDays: positive(value.attributionWindowDays, "attributionWindowDays"),
    couponAttributionDays: positive(value.couponAttributionDays, "couponAttributionDays"),
    eligibilityMonths: positive(value.eligibilityMonths, "eligibilityMonths"),
    maturityDays: positive(value.maturityDays, "maturityDays"),
    payoutThresholds: thresholds,
  };
}

/** The automatic payout threshold for a currency, or null when none is configured. */
export function payoutThreshold(policy: ProgramPolicy, currencyCode: string): Money | null {
  const amount = policy.payoutThresholds[currencyCode.toLowerCase()];
  return amount === undefined ? null : Money.of(amount, currencyCode);
}
