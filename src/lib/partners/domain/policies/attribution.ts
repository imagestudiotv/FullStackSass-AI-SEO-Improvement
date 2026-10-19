import { addDays } from "./eligibility";
import { emailSignals, evaluateFraud, type FraudDecision, type FraudSignals } from "./fraud";
import type { ProgramPolicy } from "./program";

/**
 * Who referred a new customer.
 *
 * ONLY GENUINE NEW ACCOUNTS. Eligibility is captured once, on the server,
 * when a RepGet account is created. An existing account never gets it, so
 * clicking a partner's link later changes nothing; an invited team member is
 * excluded even though signup also gives them an (empty) workspace of their
 * own; and only the organization founded at that signup can be attributed -
 * not a second organization the same person opens later.
 *
 * FIRST VALID LINK WINS, and an attribution, once locked to a partner, is
 * never replaced: not by a later link, and not by another partner's coupon
 * (that is a review case, never a silent reassignment).
 */

export type SignupExclusion = "invited" | "existing_account";

export type ClickCandidate = {
  clickId: string;
  partnerId: string;
  clickedAt: Date;
  expiresAt: Date;
};

export type PartnerSnapshot = {
  id: string;
  userId: string | null;
  email: string | null;
  status: "active" | "suspended";
};

export type SignupInput = {
  userId: string;
  email: string;
  signedUpAt: Date;
  /** A pending organization or website invitation names this address, or the signup came through an invitation. */
  invited: boolean;
  /** The account existed before this signup event (never true from the creation hook; defensive). */
  existingAccount: boolean;
  click: ClickCandidate | null;
  clickPartner: PartnerSnapshot | null;
  fraud: Pick<FraudSignals, "sharedNetwork" | "sharedDevice">;
};

export type SignupDecision = {
  /** May this account be attributed at all (by link now, or by coupon later)? */
  eligible: boolean;
  exclusions: SignupExclusion[];
  /** Coupon-only attribution is possible until then. */
  couponDeadline: Date;
  link:
    | { outcome: "attribute"; partnerId: string; clickId: string; fraud: FraudDecision }
    | { outcome: "none"; reason: "no_click" | "click_expired" | "partner_inactive" | "self_referral" | "not_eligible" };
};

export function decideSignup(policy: ProgramPolicy, input: SignupInput): SignupDecision {
  const exclusions: SignupExclusion[] = [];
  if (input.invited) exclusions.push("invited");
  if (input.existingAccount) exclusions.push("existing_account");
  const eligible = exclusions.length === 0;
  const couponDeadline = addDays(input.signedUpAt, policy.couponAttributionDays);

  if (!eligible) return { eligible, exclusions, couponDeadline, link: { outcome: "none", reason: "not_eligible" } };
  if (!input.click || !input.clickPartner) {
    return { eligible, exclusions, couponDeadline, link: { outcome: "none", reason: "no_click" } };
  }
  const t = input.signedUpAt.getTime();
  if (t < input.click.clickedAt.getTime() - CLICK_SKEW_MS || t >= input.click.expiresAt.getTime()) {
    return { eligible, exclusions, couponDeadline, link: { outcome: "none", reason: "click_expired" } };
  }
  if (input.clickPartner.status !== "active" || input.clickPartner.id !== input.click.partnerId) {
    return { eligible, exclusions, couponDeadline, link: { outcome: "none", reason: "partner_inactive" } };
  }
  const fraud = evaluateFraud({
    ...emailSignals(input.email, input.clickPartner.email ?? ""),
    partnerIsMember: input.clickPartner.userId === input.userId,
    ...input.fraud,
  });
  if (fraud.decision === "reject") {
    return { eligible, exclusions, couponDeadline, link: { outcome: "none", reason: "self_referral" } };
  }
  return {
    eligible,
    exclusions,
    couponDeadline,
    link: { outcome: "attribute", partnerId: input.clickPartner.id, clickId: input.click.clickId, fraud },
  };
}

/** Clock skew tolerated between the click's server and the signup's. */
const CLICK_SKEW_MS = 10 * 60 * 1000;

/** A click's expiry: the attribution window after it was opened. */
export function clickExpiry(policy: ProgramPolicy, clickedAt: Date): Date {
  return addDays(clickedAt, policy.attributionWindowDays);
}

export type CouponAttributionInput = {
  organizationId: string;
  eligibility: {
    eligible: boolean;
    userId: string;
    email: string;
    foundingOrganizationId: string | null;
    couponDeadline: Date;
  } | null;
  existingAttribution: { partnerId: string } | null;
  couponPartner: PartnerSnapshot;
  /** A payment of real money (cash > 0) was collected for this organization before this one. */
  priorPayment: boolean;
  /** When this, the first checkout's payment, was made (provider time). */
  paidAt: Date;
  /** The partner's user is a member of the organization. */
  partnerIsMember: boolean;
  fraud: Pick<FraudSignals, "sharedNetwork" | "sharedDevice">;
};

export type CouponDecision =
  | { outcome: "attribute"; partnerId: string; fraud: FraudDecision }
  | { outcome: "same_partner" }
  | { outcome: "conflict"; existingPartnerId: string; couponPartnerId: string }
  | {
      outcome: "none";
      reason:
        | "not_eligible"
        | "not_founding_organization"
        | "existing_customer"
        | "coupon_window_expired"
        | "partner_inactive"
        | "self_referral";
    };

/**
 * Whether a payment that redeemed a partner's coupon attributes its
 * organization to that partner. A discount can still apply when this says
 * "none": the coupon is a price, the attribution is a separate decision.
 */
export function decideCouponAttribution(input: CouponAttributionInput): CouponDecision {
  if (input.existingAttribution) {
    return input.existingAttribution.partnerId === input.couponPartner.id
      ? { outcome: "same_partner" }
      : {
          outcome: "conflict",
          existingPartnerId: input.existingAttribution.partnerId,
          couponPartnerId: input.couponPartner.id,
        };
  }
  const eligibility = input.eligibility;
  if (!eligibility || !eligibility.eligible) return { outcome: "none", reason: "not_eligible" };
  if (eligibility.foundingOrganizationId !== input.organizationId) {
    return { outcome: "none", reason: "not_founding_organization" };
  }
  if (input.priorPayment) return { outcome: "none", reason: "existing_customer" };
  if (input.paidAt.getTime() >= eligibility.couponDeadline.getTime()) {
    return { outcome: "none", reason: "coupon_window_expired" };
  }
  if (input.couponPartner.status !== "active") return { outcome: "none", reason: "partner_inactive" };
  const fraud = evaluateFraud({
    ...emailSignals(eligibility.email, input.couponPartner.email ?? ""),
    partnerIsMember: input.partnerIsMember || input.couponPartner.userId === eligibility.userId,
    ...input.fraud,
  });
  if (fraud.decision === "reject") return { outcome: "none", reason: "self_referral" };
  return { outcome: "attribute", partnerId: input.couponPartner.id, fraud };
}
