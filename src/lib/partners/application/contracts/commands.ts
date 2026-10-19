/**
 * Who is asking. Use cases never accept a partner, user, organization or
 * Stripe account id from a browser as proof of ownership: presentation
 * derives these contexts from the session (or an administrator's verified
 * identity), and background jobs build a SystemContext.
 */

/** A signed-in user with a PROVEN address (read from the user row). */
export type ApplicantContext = { kind: "applicant"; userId: string; email: string; name: string };

/** The owner of a partner profile, resolved from the session's user. */
export type PartnerContext = { kind: "partner"; userId: string; partnerId: string };

/** A verified, allowlisted administrator. */
export type AdminContext = { kind: "admin"; userId: string; email: string };

/** A background job or webhook: no person, a stated origin. */
export type SystemContext = { kind: "system"; origin: string };

/** Every administrator action on the partner program, as written to admin_audit_log. */
export type PartnerAuditAction =
  | "partner.application_approved"
  | "partner.application_rejected"
  | "partner.suspended"
  | "partner.reactivated"
  | "partner.payout_hold_set"
  | "partner.payout_hold_released"
  | "partner.control_changed"
  | "partner.attribution_disqualified"
  | "partner.attribution_confirmed"
  | "partner.commission_adjusted"
  | "partner.commission_held"
  | "partner.commission_released"
  | "partner.commission_approved"
  | "partner.commission_rejected"
  | "partner.coupon_created"
  | "partner.coupon_deactivated"
  | "partner.review_resolved"
  | "partner.settlement_created"
  | "partner.settlement_retried"
  | "partner.settlement_canceled"
  | "partner.transfer_reversal_requested"
  | "partner.reconciliation_run";

export const PARTNER_AUDIT_ACTIONS: readonly PartnerAuditAction[] = [
  "partner.application_approved",
  "partner.application_rejected",
  "partner.suspended",
  "partner.reactivated",
  "partner.payout_hold_set",
  "partner.payout_hold_released",
  "partner.control_changed",
  "partner.attribution_disqualified",
  "partner.attribution_confirmed",
  "partner.commission_adjusted",
  "partner.commission_held",
  "partner.commission_released",
  "partner.commission_approved",
  "partner.commission_rejected",
  "partner.coupon_created",
  "partner.coupon_deactivated",
  "partner.review_resolved",
  "partner.settlement_created",
  "partner.settlement_retried",
  "partner.settlement_canceled",
  "partner.transfer_reversal_requested",
  "partner.reconciliation_run",
];

/** Reasons are required for every override; this is the shortest accepted. */
export const MIN_REASON_LENGTH = 5;
