import { CommissionRate } from "../value-objects/commission-rate";
import type { ProgramPolicy, TierDefinition } from "./program";

/**
 * Commission tiers.
 *
 * WHAT IS COUNTED: distinct referred customer ORGANIZATIONS that currently
 * qualify - not users, seats, websites, invoices or subscriptions. An
 * organization qualifies while its attribution stands (not disqualified,
 * fraudulent or fully refunded) and it has a current paid subscription
 * period. A cancellation scheduled for period end keeps counting until the
 * paid period ends. The count itself is a query (application layer); this
 * module only maps a count to a tier.
 *
 * WHEN A CHANGE APPLIES: a tier change is recorded with the time it was
 * evaluated and applies to payments made from then on. A payment uses the
 * tier in force at its own provider timestamp, so a payment that arrives late
 * or concurrently gets the same rate whichever order it is processed in. The
 * payment that brings a partner to a threshold is itself paid at the previous
 * rate. History is never rewritten.
 */

export type TierProgress = {
  current: TierDefinition;
  rate: CommissionRate;
  next: TierDefinition | null;
  /** Qualifying customers counted. */
  customers: number;
  /** Customers still needed for the next tier; 0 at the top. */
  remaining: number;
};

export function tierForCount(policy: ProgramPolicy, qualifyingCustomers: number): TierDefinition {
  if (!Number.isInteger(qualifyingCustomers) || qualifyingCustomers < 0) {
    throw new Error(`Invalid customer count ${qualifyingCustomers}`);
  }
  const sorted = [...policy.tiers].sort((a, b) => a.minCustomers - b.minCustomers);
  let current = sorted[0];
  for (const tier of sorted) {
    if (qualifyingCustomers >= tier.minCustomers) current = tier;
  }
  return current;
}

export function tierProgress(policy: ProgramPolicy, qualifyingCustomers: number): TierProgress {
  const sorted = [...policy.tiers].sort((a, b) => a.minCustomers - b.minCustomers);
  const current = tierForCount(policy, qualifyingCustomers);
  const next = sorted.find((tier) => tier.minCustomers > qualifyingCustomers) ?? null;
  return {
    current,
    rate: CommissionRate.ofBasisPoints(current.rateBasisPoints),
    next,
    customers: qualifyingCustomers,
    remaining: next ? next.minCustomers - qualifyingCustomers : 0,
  };
}

export function tierByKey(policy: ProgramPolicy, key: string): TierDefinition | null {
  return policy.tiers.find((tier) => tier.key === key) ?? null;
}

export type TierPeriod = { tierKey: string; rateBasisPoints: number; effectiveFrom: Date; effectiveTo: Date | null };

/**
 * The tier in force at `at`: the period with effectiveFrom <= at < effectiveTo
 * (open-ended when effectiveTo is null). Before the first recorded period the
 * earliest period applies - a partner starts on the base tier.
 */
export function tierAt(periods: TierPeriod[], at: Date): TierPeriod | null {
  if (periods.length === 0) return null;
  const sorted = [...periods].sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());
  const t = at.getTime();
  for (const period of sorted) {
    if (period.effectiveFrom.getTime() <= t && (period.effectiveTo === null || t < period.effectiveTo.getTime())) {
      return period;
    }
  }
  return t < sorted[0].effectiveFrom.getTime() ? sorted[0] : sorted[sorted.length - 1];
}
