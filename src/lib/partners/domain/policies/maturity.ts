import { isPayable, netPayable, type CommissionSnapshot } from "../entities/commission";
import { Money } from "../value-objects/money";
import { addDays } from "./eligibility";

/**
 * Net 30 and the monthly payout run.
 *
 * A commission matures 30 days after the payment it was earned on. Payouts run
 * once a month, on the first day at 00:00 UTC, and pay what is mature then -
 * so money can be paid later than its exact maturity date, never earlier.
 */

export function maturesAt(paidAt: Date, maturityDays: number): Date {
  return addDays(paidAt, maturityDays);
}

/** The first day of the month after `now`, 00:00 UTC. */
export function nextMonthlyRun(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

/** "2026-11" for any time in November 2026 UTC: one settlement per partner, currency and month. */
export function monthlyRunKey(runAt: Date): string {
  return `${runAt.getUTCFullYear()}-${String(runAt.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * WHAT A SETTLEMENT PAYS.
 *
 *   L = the partner's outstanding liability in this currency: the sum of the
 *       immutable ledger (earnings and adjustments minus confirmed transfers
 *       plus confirmed transfer reversals).
 *   P = what L still contains for unpaid commissions that are NOT payable yet
 *       (immature, held, under review).
 *   R = what L still contains for commissions reserved by a settlement whose
 *       transfer is not confirmed.
 *   E = the payable commissions' net amounts.
 *
 * payable = min(E, L - P - R). It is below E exactly when a refund or
 * chargeback on money ALREADY paid left the partner owing RepGet: that
 * negative position is offset against this payout, once, and the ledger shows
 * it. Recovering the same money by a transfer reversal instead raises L back,
 * so an amount is never both recovered and offset.
 *
 * Below the currency's threshold, or with no threshold configured for the
 * currency, nothing is paid and the balance carries forward.
 */

export type SettlementInput = {
  currency: string;
  candidates: CommissionSnapshot[];
  liability: Money;
  notYetPayable: Money;
  reservedInFlight: Money;
  threshold: Money | null;
  now: Date;
};

export type Allocation = { commissionId: string; amount: Money };

export type SettlementPlan =
  | {
      kind: "settle";
      allocations: Allocation[];
      gross: Money;
      offset: Money;
      transferAmount: Money;
    }
  | {
      kind: "carry_forward";
      reason: "nothing_payable" | "negative_position" | "no_threshold" | "below_threshold";
      payable: Money;
    };

export function planSettlement(input: SettlementInput): SettlementPlan {
  const code = input.currency;
  const payableCommissions = input.candidates
    .filter((commission) => commission.amount.code === code && isPayable(commission, input.now))
    .sort((a, b) => a.maturesAt.getTime() - b.maturesAt.getTime() || (a.id < b.id ? -1 : 1));
  const allocations = payableCommissions.map((commission) => ({
    commissionId: commission.id,
    amount: netPayable(commission),
  }));
  const gross = Money.sum(
    allocations.map((allocation) => allocation.amount),
    code,
  );
  if (!gross.isPositive()) return { kind: "carry_forward", reason: "nothing_payable", payable: Money.zero(code) };

  const headroom = input.liability.subtract(input.notYetPayable).subtract(input.reservedInFlight);
  const payable = gross.min(headroom);
  if (!payable.isPositive()) return { kind: "carry_forward", reason: "negative_position", payable };
  if (!input.threshold) return { kind: "carry_forward", reason: "no_threshold", payable };
  if (payable.compare(input.threshold) < 0) return { kind: "carry_forward", reason: "below_threshold", payable };

  return { kind: "settle", allocations, gross, offset: gross.subtract(payable), transferAmount: payable };
}
