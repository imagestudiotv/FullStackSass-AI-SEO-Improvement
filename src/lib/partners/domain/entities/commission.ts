import { Money } from "../value-objects/money";
import type { TransitionTable } from "./state-machine";

/**
 * A commission earned on one economic payment (one Stripe invoice payment).
 *
 * The amount is fixed when it is created, with the rate, tier and policy
 * version it was calculated under. Refunds and chargebacks never edit it:
 * they add ledger adjustments and raise `reversedAmount`, so the original
 * calculation stays reproducible.
 *
 * PROJECTION STATUS
 *   pending   earned, not yet mature (Net 30), or not yet re-evaluated
 *   available mature, approved, unheld - payable at the next monthly run
 *   reserved  allocated to a settlement that has not finished
 *   paid      its settlement's transfer was confirmed by Stripe
 *   reversed  fully reversed before it was ever paid
 *
 * A HOLD (open dispute, fraud review, administrator) and a REVIEW STATE are
 * separate flags. Neither changes the status; both stop the commission being
 * payable.
 */

export type CommissionStatus = "pending" | "available" | "reserved" | "paid" | "reversed";

export const COMMISSION_TRANSITIONS: TransitionTable<CommissionStatus> = {
  pending: ["available", "reserved", "reversed"],
  available: ["pending", "reserved", "reversed"],
  /*
    Back to available only when a settlement is cancelled before anything was
    submitted to Stripe. A transfer whose outcome is unknown keeps it reserved.
  */
  reserved: ["available", "pending", "paid"],
  paid: [],
  reversed: ["pending", "available"],
};

export type ReviewState = "approved" | "needs_review" | "rejected";

export type CommissionSnapshot = {
  id: string;
  status: CommissionStatus;
  reviewState: ReviewState;
  holdReason: string | null;
  amount: Money;
  reversedAmount: Money;
  maturesAt: Date;
};

/** What is still owed for this commission. Never negative. */
export function netPayable(commission: Pick<CommissionSnapshot, "amount" | "reversedAmount">): Money {
  const net = commission.amount.subtract(commission.reversedAmount);
  return net.isNegative() ? Money.zero(net.code) : net;
}

/** Whether a settlement may allocate this commission at `now`. */
export function isPayable(commission: CommissionSnapshot, now: Date): boolean {
  return (
    (commission.status === "pending" || commission.status === "available") &&
    commission.reviewState === "approved" &&
    commission.holdReason === null &&
    commission.maturesAt.getTime() <= now.getTime() &&
    netPayable(commission).isPositive()
  );
}

/**
 * What a person is shown for a commission - the same in the partner portal
 * and the admin area. "held" and "review" are views of pending/available
 * money that no settlement may take yet, not separate stored statuses.
 */
export type CommissionDisplayStatus = CommissionStatus | "held" | "review";

export function commissionDisplayStatus(
  commission: Pick<CommissionSnapshot, "status" | "reviewState" | "holdReason" | "maturesAt">,
  now: Date,
): CommissionDisplayStatus {
  if (commission.status !== "pending" && commission.status !== "available") return commission.status;
  if (commission.holdReason) return "held";
  if (commission.reviewState === "needs_review") return "review";
  // Matured since the last sweep: payable now, as the balances already count it.
  if (commission.reviewState === "approved" && commission.maturesAt.getTime() <= now.getTime()) return "available";
  return "pending";
}

/** The status a commission should show at `now`, when nothing is in flight. */
export function projectedStatus(commission: CommissionSnapshot, now: Date): CommissionStatus {
  if (commission.status === "reserved" || commission.status === "paid") return commission.status;
  if (!netPayable(commission).isPositive()) return "reversed";
  return isPayable(commission, now) ? "available" : "pending";
}
