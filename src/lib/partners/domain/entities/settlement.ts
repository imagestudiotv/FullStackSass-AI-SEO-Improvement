import type { TransitionTable } from "./state-machine";

/**
 * Paying a partner happens in THREE stages, recorded separately:
 *
 *   1. commission owed       - partner_commissions and ledger earnings
 *   2. transfer              - RepGet's platform balance -> the partner's
 *                              connected Stripe balance (a Stripe Transfer)
 *   3. bank payout           - the connected balance -> the partner's bank
 *                              (a Stripe Payout on the connected account)
 *
 * A successful transfer is not a successful bank payout. Only stage 2 settles
 * the commission liability; stage 3 moves money the partner already owns, so
 * a failed bank payout is retried as a bank payout - it can never cause a
 * second transfer.
 */

export type SettlementState =
  /** Commissions allocated; nothing sent to Stripe yet. */
  | "reserved"
  /** A transfer request is being (or was) sent; the outcome is not recorded yet. */
  | "transfer_processing"
  /** A transfer request had no answer. Stays reserved until reconciliation proves what happened. */
  | "transfer_unknown"
  /** Stripe confirmed the transfer; liability settled. */
  | "transferred"
  | "payout_pending"
  | "payout_in_transit"
  /** Stripe confirmed the bank payout arrived. */
  | "paid"
  /** The bank payout failed or was cancelled; funds are in the connected balance, awaiting a retry. */
  | "payout_failed"
  /** Released before any provider submission. */
  | "canceled"
  /** A discrepancy a person must resolve. Nothing automatic happens. */
  | "needs_review";

export const SETTLEMENT_TRANSITIONS: TransitionTable<SettlementState> = {
  reserved: ["transfer_processing", "canceled", "needs_review"],
  transfer_processing: ["transferred", "transfer_unknown", "reserved", "canceled", "needs_review"],
  transfer_unknown: ["transferred", "reserved", "canceled", "needs_review"],
  transferred: ["payout_pending", "payout_failed", "needs_review"],
  payout_pending: ["payout_in_transit", "paid", "payout_failed", "needs_review"],
  payout_in_transit: ["paid", "payout_failed", "needs_review"],
  /* Stripe can report a paid payout as failed later (the bank returned it). */
  paid: ["payout_failed", "needs_review"],
  payout_failed: ["payout_pending", "needs_review"],
  canceled: [],
  needs_review: ["transferred", "transfer_unknown", "reserved", "canceled", "payout_pending", "payout_failed", "paid"],
};

/** States in which the allocated commissions are still RESERVED (transfer not confirmed). */
export const PRE_TRANSFER_STATES: readonly SettlementState[] = ["reserved", "transfer_processing", "transfer_unknown"];

/** States in which nothing more will happen without a person or a new event. */
export const TERMINAL_SETTLEMENT_STATES: readonly SettlementState[] = ["paid", "canceled"];

export type TransferStatus =
  | "not_started"
  | "processing"
  | "confirmed"
  /** Stripe refused it and nothing was created; a new attempt may be made. */
  | "retryable_failure"
  /** Stripe refused it permanently. */
  | "failed"
  /** No answer: the transfer may exist. Never retried blindly. */
  | "unknown"
  | "partially_reversed"
  | "reversed";

export const TRANSFER_TRANSITIONS: TransitionTable<TransferStatus> = {
  not_started: ["processing"],
  processing: ["confirmed", "retryable_failure", "failed", "unknown"],
  unknown: ["confirmed", "retryable_failure", "failed"],
  confirmed: ["partially_reversed", "reversed"],
  partially_reversed: ["reversed"],
  retryable_failure: [],
  failed: [],
  reversed: [],
};

export type BankPayoutStatus =
  | "not_started"
  | "pending"
  | "in_transit"
  | "paid"
  | "failed"
  | "canceled"
  /** No answer from the create request: the payout may exist. */
  | "unknown";

export const BANK_PAYOUT_TRANSITIONS: TransitionTable<BankPayoutStatus> = {
  not_started: ["pending", "in_transit", "paid", "failed", "unknown"],
  unknown: ["pending", "in_transit", "paid", "failed", "canceled"],
  pending: ["in_transit", "paid", "failed", "canceled"],
  in_transit: ["paid", "failed", "canceled"],
  paid: ["failed"],
  failed: [],
  canceled: [],
};

/**
 * The two steps of a payout as a person is shown them (partner portal and
 * admin area alike). The transfer step is derived from the settlement's own
 * state - "Sent" only once Stripe confirmed the transfer - and the bank step
 * from the latest bank payout attempt, "Paid" only once Stripe says so.
 */
export type TransferDisplayState = "pending" | "processing" | "confirmed" | "reversed";
export type BankDisplayState = "not_started" | "pending" | "in_transit" | "paid" | "failed";

const CONFIRMED_STATES: readonly SettlementState[] = ["transferred", "payout_pending", "payout_in_transit", "paid", "payout_failed"];

export function transferDisplayState(state: SettlementState, transferStatus: TransferStatus | null): TransferDisplayState {
  if (transferStatus === "reversed") return "reversed";
  if (CONFIRMED_STATES.includes(state)) return "confirmed";
  if (state === "needs_review") return transferStatus === "confirmed" || transferStatus === "partially_reversed" ? "confirmed" : "processing";
  if (state === "transfer_processing" || state === "transfer_unknown") return "processing";
  return "pending";
}

export function bankDisplayState(status: BankPayoutStatus | null): BankDisplayState {
  switch (status) {
    case null:
    case "not_started":
      return "not_started";
    case "unknown":
    case "pending":
      return "pending";
    case "in_transit":
      return "in_transit";
    case "paid":
      return "paid";
    case "failed":
    case "canceled":
      return "failed";
  }
}

/** Maps a Stripe Payout status to ours. Unknown values are not guessed. */
export function bankPayoutStatusFromStripe(status: string): BankPayoutStatus | null {
  switch (status) {
    case "pending":
      return "pending";
    case "in_transit":
      return "in_transit";
    case "paid":
      return "paid";
    case "failed":
      return "failed";
    case "canceled":
      return "canceled";
    default:
      return null;
  }
}
