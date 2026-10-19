import { InconsistentFinancialDataError } from "../errors";
import { CommissionRate } from "../value-objects/commission-rate";
import { currency } from "../value-objects/currency";
import { floorDivide, Money, roundHalfUpDivide } from "../value-objects/money";

/**
 * What a payment earns.
 *
 * THE BASE IS SUBSCRIPTION REVENUE ACTUALLY COLLECTED, EXCLUDING TAX.
 *
 *  - Discounts are already out of the invoice total, so nothing is
 *    subtracted for them again.
 *  - Customer-balance credit and other non-cash settlement are excluded by
 *    counting only money Stripe collected (verified invoice payments), never
 *    the invoice total or its "paid" status.
 *  - Tax (inclusive or exclusive) is excluded. When an invoice is paid partly
 *    in cash and partly by credit, its tax-free revenue is allocated to the
 *    cash in proportion: cumulatively, collection by collection in payment
 *    order, eligible(c) = floor(revenue * c / total). Each collection's base
 *    is the step between consecutive cumulative values, so several partial
 *    payments add up to exactly what one full payment would have, with no
 *    rounding drift.
 *  - Stripe's processing fees are NOT subtracted.
 *
 * The commission is base x rate, rounded half up once, at the final minor
 * unit: EUR 99.00 x 25% = EUR 24.75, EUR 89.10 x 25% = EUR 22.28.
 *
 * Anything that does not add up - a line that is not subscription revenue,
 * more cash than the invoice total, a negative revenue - throws
 * InconsistentFinancialDataError, which the application turns into a review
 * case instead of a guessed commission.
 */

const ZERO = BigInt(0);

export type InvoiceFacts = {
  currency: string;
  /** invoice.total: after discounts, including exclusive tax. */
  total: bigint;
  /** Sum of invoice.total_taxes[].amount (inclusive and exclusive). */
  tax: bigint;
  /** Whether every line is subscription revenue (prorations included). */
  allLinesSubscription: boolean;
  /** Whether the full line list was read (not a truncated first page). */
  linesComplete: boolean;
};

export type CollectionFacts = {
  /** Stripe invoice payment id: one economic collection. */
  id: string;
  /** Cash Stripe collected for this invoice in this payment, minor units. */
  cash: bigint;
  /** The provider's payment time. */
  paidAt: Date;
};

export type CollectionBase = {
  id: string;
  cash: Money;
  /** Tax-free subscription revenue attributable to this cash. */
  base: Money;
  /** cash - base: the tax share of the cash. */
  taxShare: Money;
};

/** Orders collections deterministically: payment time, then id. */
export function orderCollections<T extends { id: string; paidAt: Date }>(collections: T[]): T[] {
  return [...collections].sort(
    (a, b) => a.paidAt.getTime() - b.paidAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

export function eligibleBases(invoice: InvoiceFacts, collections: CollectionFacts[]): CollectionBase[] {
  const code = currency(invoice.currency).code;
  if (!invoice.linesComplete) throw new InconsistentFinancialDataError("invoice_lines_incomplete");
  if (!invoice.allLinesSubscription) throw new InconsistentFinancialDataError("non_subscription_line");
  if (invoice.tax < ZERO) throw new InconsistentFinancialDataError("negative_tax");

  const ordered = orderCollections(collections);
  for (const collection of ordered) {
    if (collection.cash < ZERO) {
      throw new InconsistentFinancialDataError("negative_collection", { collection: collection.id });
    }
  }
  const totalCash = ordered.reduce((sum, c) => sum + c.cash, ZERO);

  if (invoice.total <= ZERO) {
    if (totalCash > ZERO) throw new InconsistentFinancialDataError("cash_on_zero_invoice");
    return ordered.map((c) => ({
      id: c.id,
      cash: Money.of(c.cash, code),
      base: Money.zero(code),
      taxShare: Money.zero(code),
    }));
  }

  const revenue = invoice.total - invoice.tax;
  if (revenue < ZERO) throw new InconsistentFinancialDataError("tax_exceeds_total");
  if (totalCash > invoice.total) {
    throw new InconsistentFinancialDataError("cash_exceeds_total", {
      cash: totalCash.toString(),
      total: invoice.total.toString(),
    });
  }

  let cumulativeCash = ZERO;
  let cumulativeBase = ZERO;
  return ordered.map((c) => {
    cumulativeCash += c.cash;
    const nextBase = floorDivide(revenue * cumulativeCash, invoice.total);
    const base = nextBase - cumulativeBase;
    cumulativeBase = nextBase;
    return {
      id: c.id,
      cash: Money.of(c.cash, code),
      base: Money.of(base, code),
      taxShare: Money.of(c.cash - base, code),
    };
  });
}

/** The commission on a base. Zero for a zero base. */
export function commissionFor(base: Money, rate: CommissionRate): Money {
  if (base.isNegative()) throw new InconsistentFinancialDataError("negative_base");
  return rate.apply(base);
}

/**
 * REFUNDS AND CHARGEBACKS, CUMULATIVELY.
 *
 * The commission reversed for a collection is recomputed from the TOTAL cash
 * returned so far - refunds plus lost disputes, capped at the cash collected
 * - never from each event's delta. Applying the difference between this
 * target and what is already reversed makes repeated, duplicated or
 * out-of-order events converge on the same answer, never reverses more than
 * the original commission, and reverses exactly all of it on a full refund.
 * A refund and a lost dispute over the same money count once (the cap).
 */
export function reversalTarget(input: {
  commission: Money;
  cash: Money;
  refunded: Money;
  disputeLost: Money;
}): Money {
  const { commission, cash } = input;
  if (cash.isZero()) return Money.zero(commission.code);
  const returned = input.refunded.add(input.disputeLost).min(cash);
  if (returned.compare(cash) >= 0) return commission;
  if (!returned.isPositive()) return Money.zero(commission.code);
  return Money.of(roundHalfUpDivide(commission.amount * returned.amount, cash.amount), commission.code);
}

/** Dispute statuses that hold a commission while unresolved. */
export const OPEN_DISPUTE_STATUSES = new Set([
  "needs_response",
  "under_review",
  "warning_needs_response",
  "warning_under_review",
]);

/** Dispute statuses that ended with the money kept. */
export const KEPT_DISPUTE_STATUSES = new Set(["won", "warning_closed", "prevented"]);

export type DisputeEffect = "hold" | "release" | "reverse" | "unknown";

export function disputeEffect(status: string): DisputeEffect {
  if (status === "lost") return "reverse";
  if (OPEN_DISPUTE_STATUSES.has(status)) return "hold";
  if (KEPT_DISPUTE_STATUSES.has(status)) return "release";
  return "unknown";
}
