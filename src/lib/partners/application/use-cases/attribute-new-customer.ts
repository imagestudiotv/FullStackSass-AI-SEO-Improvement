import { decideCouponAttribution, decideSignup, type CouponDecision } from "../../domain/policies/attribution";
import type { FraudDecision } from "../../domain/policies/fraud";
import { fail, ok, type Result } from "../contracts/results";
import type { AttributionRecord, CouponRecord, EligibilityRecord, PartnerRecord } from "../ports/repositories";
import type { PartnerRepositories } from "../ports/unit-of-work";
import type { PartnerDeps } from "./deps";

/**
 * Who referred a NEW customer.
 *
 * captureSignupEligibility runs once, on the server, when Better Auth
 * creates an account (lib/auth.ts, the user-create hook) - for an email
 * sign-up, a one-time-code sign-up and a Google sign-up alike. It records
 * whether the account may be attributed at all (an invited team member may
 * not), and, when the browser carried a valid partner click, locks the
 * account's founding workspace to that partner. Nothing ever creates
 * eligibility for an account that already existed, so an existing customer
 * who opens a partner link later is never attributed.
 */

export type SignupCapture = {
  userId: string;
  email: string;
  createdAt: Date;
  method: "email" | "google" | "otp" | "unknown";
  /** The partner cookie's token, if any. */
  trackingToken: string | null;
  ipAddress: string | null;
  userAgent: string | null;
};

export type SignupResult = {
  eligible: boolean;
  exclusions: string[];
  attribution: AttributionRecord | null;
  linkOutcome: string;
};

export async function captureSignupEligibility(
  deps: PartnerDeps,
  input: SignupCapture,
): Promise<Result<SignupResult>> {
  const repos = deps.uow.repositories;
  if (await repos.tracking.findEligibility(input.userId)) return fail("already_processed");

  const click = input.trackingToken
    ? await repos.tracking.findClickByTokenHash(deps.hasher.sha256(input.trackingToken))
    : null;
  const clickPartner = click ? await repos.partners.findById(click.partnerId) : null;
  const invited = await deps.directory.isInvited(input.email);
  const signals =
    clickPartner?.userId && input.ipAddress
      ? await deps.directory.sessionSignals(clickPartner.userId, { ipAddress: input.ipAddress, userAgent: input.userAgent })
      : { sharedNetwork: false, sharedDevice: false };
  const version = await repos.programs.versionAt(input.createdAt);
  const decision = decideSignup(version.policy, {
    userId: input.userId,
    email: input.email,
    signedUpAt: input.createdAt,
    invited,
    existingAccount: false,
    click: click
      ? { clickId: click.id, partnerId: click.partnerId, clickedAt: click.clickedAt, expiresAt: click.expiresAt }
      : null,
    clickPartner: clickPartner ? snapshot(clickPartner) : null,
    fraud: signals,
  });
  const foundingOrganizationId = await deps.directory.foundingOrganization(input.userId, input.createdAt);

  return deps.uow.transaction(async (tx) => {
    const eligibility = await tx.tracking.createEligibility({
      userId: input.userId,
      signedUpAt: input.createdAt,
      signupMethod: input.method,
      eligible: decision.eligible,
      exclusions: decision.exclusions,
      foundingOrganizationId,
      clickId: click?.id ?? null,
      candidatePartnerId: decision.link.outcome === "attribute" ? decision.link.partnerId : null,
      linkOutcome: decision.link.outcome === "attribute" ? "attribute" : decision.link.reason,
      couponDeadline: decision.couponDeadline,
      fraudSignals: signals,
    });
    if (!eligibility) return fail("already_processed");

    let attribution: AttributionRecord | null = null;
    if (decision.link.outcome === "attribute" && foundingOrganizationId) {
      attribution = await lockAttribution(tx, deps, {
        organizationId: foundingOrganizationId,
        foundingUserId: input.userId,
        partnerId: decision.link.partnerId,
        source: "link",
        clickId: decision.link.clickId,
        couponId: null,
        fraud: decision.link.fraud,
        ruleVersion: version.policy.version,
      });
    }
    return ok({
      eligible: decision.eligible,
      exclusions: decision.exclusions,
      attribution,
      linkOutcome: eligibility.linkOutcome,
    });
  });
}

/**
 * The organization's eligibility, filling in a founding workspace the
 * signup hook could not create (the app makes it on the first request
 * instead), and completing a link attribution that was waiting for it.
 * Called by payment processing; safe to call repeatedly.
 */
export async function eligibilityForOrganization(
  deps: PartnerDeps,
  repos: PartnerRepositories,
  organizationId: string,
): Promise<EligibilityRecord | null> {
  const known = await repos.tracking.findEligibilityByOrganization(organizationId);
  if (known) return known;
  for (const userId of await repos.directory.ownersOf(organizationId)) {
    const record = await repos.tracking.findEligibility(userId);
    if (!record || record.foundingOrganizationId) continue;
    const user = await repos.directory.findUser(userId);
    if (!user) continue;
    if ((await repos.directory.foundingOrganization(userId, user.createdAt)) !== organizationId) continue;
    await repos.tracking.setFoundingOrganization(record.id, organizationId);
    const filled = { ...record, foundingOrganizationId: organizationId };
    if (record.eligible && record.linkOutcome === "attribute" && record.candidatePartnerId) {
      const partner = await repos.partners.findById(record.candidatePartnerId);
      if (partner?.status === "active") {
        const version = await repos.programs.versionAt(record.signedUpAt);
        await lockAttribution(repos, deps, {
          organizationId,
          foundingUserId: userId,
          partnerId: partner.id,
          source: "link",
          clickId: record.clickId,
          couponId: null,
          fraud: { decision: "allow", reasons: [] },
          ruleVersion: version.policy.version,
        });
      }
    }
    return filled;
  }
  return null;
}

/**
 * A payment that redeemed a partner's coupon. Attributes an eligible,
 * unattributed new customer to the coupon's partner; a coupon of ANOTHER
 * partner than the locked one opens a review case and changes nothing. The
 * discount applied either way - the coupon is a price, this is attribution.
 * Runs inside the payment's transaction.
 */
export async function attributeByCoupon(
  deps: PartnerDeps,
  repos: PartnerRepositories,
  input: {
    organizationId: string;
    coupon: CouponRecord;
    paidAt: Date;
    priorPayment: boolean;
    paymentReference: string;
  },
): Promise<{ decision: CouponDecision; attribution: AttributionRecord | null }> {
  // Eligibility first: it may complete a link attribution that was waiting for the workspace.
  const eligibility = await eligibilityForOrganization(deps, repos, input.organizationId);
  const current = await repos.attributions.lockByOrganization(input.organizationId);
  const couponPartner = await repos.partners.findById(input.coupon.partnerId);
  if (!couponPartner) return { decision: { outcome: "none", reason: "partner_inactive" }, attribution: current };
  const user = eligibility ? await repos.directory.findUser(eligibility.userId) : null;

  const decision = decideCouponAttribution({
    organizationId: input.organizationId,
    eligibility:
      eligibility && user
        ? {
            eligible: eligibility.eligible,
            userId: eligibility.userId,
            email: user.email,
            foundingOrganizationId: eligibility.foundingOrganizationId,
            couponDeadline: eligibility.couponDeadline,
          }
        : null,
    existingAttribution: current ? { partnerId: current.partnerId } : null,
    couponPartner: snapshot(couponPartner),
    priorPayment: input.priorPayment,
    paidAt: input.paidAt,
    partnerIsMember: await repos.attributions.isPartnerMember(input.organizationId, couponPartner.userId),
    fraud: { sharedNetwork: false, sharedDevice: false },
  });

  if (decision.outcome === "conflict" && current) {
    await repos.reviews.open({
      kind: "coupon_conflict",
      dedupeKey: `coupon_conflict:${input.organizationId}:${input.coupon.id}`,
      environment: input.coupon.environment,
      partnerId: current.partnerId,
      attributionId: current.id,
      commissionId: null,
      settlementId: null,
      paymentFactId: null,
      organizationId: input.organizationId,
      summary: `A customer attributed to one partner redeemed another partner's coupon ${input.coupon.code}`,
      evidence: {
        attributedPartnerId: current.partnerId,
        couponPartnerId: input.coupon.partnerId,
        couponId: input.coupon.id,
        payment: input.paymentReference,
      },
    });
    return { decision, attribution: current };
  }
  if (decision.outcome !== "attribute" || !eligibility) return { decision, attribution: current };

  const version = await repos.programs.versionAt(input.paidAt);
  const attribution = await lockAttribution(repos, deps, {
    organizationId: input.organizationId,
    foundingUserId: eligibility.userId,
    partnerId: decision.partnerId,
    source: "coupon",
    clickId: null,
    couponId: input.coupon.id,
    fraud: decision.fraud,
    ruleVersion: version.policy.version,
  });
  return { decision, attribution };
}

/** Writes (or finds) the organization's one locked attribution, with a review case for fraud signals. */
async function lockAttribution(
  repos: PartnerRepositories,
  deps: PartnerDeps,
  input: {
    organizationId: string;
    foundingUserId: string;
    partnerId: string;
    source: "link" | "coupon";
    clickId: string | null;
    couponId: string | null;
    fraud: FraudDecision;
    ruleVersion: number;
  },
): Promise<AttributionRecord> {
  const review = input.fraud.decision === "review";
  const { attribution, created } = await repos.attributions.createOrGet({
    organizationId: input.organizationId,
    foundingUserId: input.foundingUserId,
    partnerId: input.partnerId,
    source: input.source,
    clickId: input.clickId,
    couponId: input.couponId,
    status: review ? "review" : "active",
    lockedAt: deps.clock.now(),
    ruleVersion: input.ruleVersion,
    reviewReason: review ? input.fraud.reasons.join(", ") : null,
    fraudSignals: { decision: input.fraud.decision, reasons: input.fraud.reasons },
  });
  if (created && review) {
    await repos.reviews.open({
      kind: "fraud_signal",
      dedupeKey: `fraud_signal:${attribution.id}`,
      environment: null,
      partnerId: attribution.partnerId,
      attributionId: attribution.id,
      commissionId: null,
      settlementId: null,
      paymentFactId: null,
      organizationId: attribution.organizationId,
      summary: `Referral held for review: ${input.fraud.reasons.join(", ")}`,
      evidence: { reasons: input.fraud.reasons, source: input.source },
    });
  }
  return attribution;
}

function snapshot(partner: PartnerRecord) {
  return { id: partner.id, userId: partner.userId, email: partner.contactEmail, status: partner.status };
}
