import { formatDate } from "@/lib/i18n/format";
import type { ReviewCaseKind } from "@/lib/partners/application/ports/repositories";
import type { CommissionDisplayStatus } from "@/lib/partners/domain/entities/commission";
import type { BankDisplayState, SettlementState, TransferDisplayState } from "@/lib/partners/domain/entities/settlement";
import { moneyView } from "@/lib/partners/presentation/serializers";

import type { StatusTone } from "../../_ui/status";

/** Words and tones for the admin partner pages - one place, so every page names a state the same way. */

export const when = (date: Date | null | undefined, withTime = true) =>
  date
    ? formatDate(date, "en", {
        day: "numeric",
        month: "short",
        year: "numeric",
        ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
        timeZone: "UTC",
      }) + (withTime ? " UTC" : "")
    : "-";

export const money = (amount: bigint | null | undefined, currency: string | null | undefined) =>
  amount === null || amount === undefined || !currency ? "-" : moneyView(amount, currency, "en").display;

export const COMMISSION_LABEL: Record<CommissionDisplayStatus, [StatusTone, string]> = {
  pending: ["pending", "Pending (maturing)"],
  available: ["success", "Available"],
  reserved: ["info", "In a payout"],
  paid: ["success", "Paid"],
  reversed: ["neutral", "Reversed"],
  held: ["warning", "Held"],
  review: ["warning", "Needs review"],
};

export const SETTLEMENT_LABEL: Record<SettlementState, [StatusTone, string]> = {
  reserved: ["pending", "Reserved"],
  transfer_processing: ["info", "Transfer sending"],
  transfer_unknown: ["warning", "Transfer outcome unknown"],
  transferred: ["info", "Transferred"],
  payout_pending: ["info", "Bank payout pending"],
  payout_in_transit: ["info", "Bank payout in transit"],
  paid: ["success", "Paid to bank"],
  payout_failed: ["warning", "Bank payout failed"],
  canceled: ["neutral", "Cancelled"],
  needs_review: ["danger", "Needs review"],
};

export const TRANSFER_LABEL: Record<TransferDisplayState, [StatusTone, string]> = {
  pending: ["pending", "Not sent"],
  processing: ["info", "Sending"],
  confirmed: ["success", "Confirmed by Stripe"],
  reversed: ["neutral", "Reversed"],
};

export const BANK_LABEL: Record<BankDisplayState, [StatusTone, string]> = {
  not_started: ["neutral", "Not started"],
  pending: ["info", "Pending"],
  in_transit: ["info", "In transit"],
  paid: ["success", "Paid (Stripe)"],
  failed: ["warning", "Failed"],
};

export const REVIEW_KIND_LABEL: Record<ReviewCaseKind, string> = {
  fraud_signal: "Fraud signal",
  attribution_conflict: "Attribution conflict",
  coupon_conflict: "Coupon conflict",
  credit_cash_conflict: "Credit and cash referral",
  dispute: "Dispute",
  financial_inconsistency: "Financial inconsistency",
  payout_discrepancy: "Payout discrepancy",
  transfer_unknown: "Transfer outcome unknown",
  payout_funding: "Platform balance too low",
  unexpected_payout: "Unexpected payout",
  reconciliation: "Reconciliation",
};

/** Why a preview would not pay, in words. */
export const CARRY_REASON: Record<string, string> = {
  nothing_payable: "no mature commission yet",
  negative_position: "corrections to deduct exceed what is payable",
  no_threshold: "no payout threshold for this currency",
  below_threshold: "below the payout threshold",
};

export const BLOCKER_LABEL: Record<string, string> = {
  partner_missing: "Partner not found",
  payout_hold: "Payouts held",
  partner_suspended: "Partner suspended",
  onboarding_incomplete: "Stripe account not ready",
};
