import type { TransitionTable } from "./state-machine";

/**
 * Which partner a referred customer organization belongs to.
 *
 * At most ONE attribution per customer organization, ever (a unique index).
 * Once written it is locked: a later link or another partner's coupon cannot
 * replace it. An administrator can disqualify it (fraud, self-referral found
 * later) or put it under review, always with a reason; reassignment to a
 * different partner is a disqualification plus a new, audited decision -
 * never an update of the partner column.
 */

export type AttributionSource = "link" | "coupon";

export type AttributionStatus = "active" | "review" | "disqualified";

export const ATTRIBUTION_TRANSITIONS: TransitionTable<AttributionStatus> = {
  active: ["review", "disqualified"],
  review: ["active", "disqualified"],
  disqualified: [],
};

/** Commissions are created for these; "review" ones are held until resolved. */
export function attributionEarns(status: AttributionStatus): boolean {
  return status !== "disqualified";
}
