import { assertTransition } from "../../domain/entities/state-machine";
import { APPLICATION_TRANSITIONS } from "../../domain/entities/application";
import { PARTNER_TRANSITIONS, REFERRAL_CODE_ALPHABET, REFERRAL_CODE_LENGTH, referralCodeFrom } from "../../domain/entities/partner";
import { tierForCount } from "../../domain/policies/tiers";
import { MIN_REASON_LENGTH, type AdminContext } from "../contracts/commands";
import { fail, ok, type Result } from "../contracts/results";
import type { PartnerRecord } from "../ports/repositories";
import type { PartnerDeps } from "./deps";

/**
 * Administrator review of applications, and the partner lifecycle.
 *
 * APPROVAL IS IDEMPOTENT. In one transaction holding the application's row
 * lock: the user's single profile is created (or the existing one returned -
 * ON CONFLICT on user_id), it opens on the base tier, and ONE welcome email
 * is recorded in the outbox under a stable id. A retried, double-clicked or
 * raced approval finds the application already approved and returns the
 * same profile; no second profile, email or Stripe account can result (the
 * Stripe account is only created later, by the partner, in payout setup).
 */

const MAX_CODE_ATTEMPTS = 6;

export function welcomeJobId(partnerId: string): string {
  return `partners/welcome:${partnerId}`;
}

export async function approveApplication(
  deps: PartnerDeps,
  admin: AdminContext,
  applicationId: string,
  note: string | null = null,
): Promise<Result<{ partner: PartnerRecord; created: boolean }>> {
  return deps.uow.transaction(async (repos) => {
    const application = await repos.applications.lock(applicationId);
    if (!application) return fail("not_found");
    if (!application.userId) return fail("invalid", "applicant_deleted");

    if (application.status === "approved") {
      const existing = await repos.partners.findByUserId(application.userId);
      return existing ? ok({ partner: existing, created: false }) : fail("conflict", "approved_without_profile");
    }
    if (application.status !== "submitted") return fail("invalid", `application_${application.status}`);
    assertTransition("application", APPLICATION_TRANSITIONS, application.status, "approved");

    const now = deps.clock.now();
    const version = await repos.programs.versionAt(now);
    let result: { partner: PartnerRecord; created: boolean } | null = null;
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS && !result; attempt += 1) {
      result = await repos.partners.createOrGet({
        userId: application.userId,
        referralCode: referralCodeFrom(deps.random.indexes(REFERRAL_CODE_LENGTH, REFERRAL_CODE_ALPHABET.length)),
        displayName: application.applicantName,
        contactEmail: application.applicantEmail,
        country: application.answers.country ?? null,
        applicationId: application.id,
        approvedAt: now,
        approvedByEmail: admin.email,
      });
    }
    if (!result) throw new Error("Could not allocate a unique referral code");

    if (result.created) {
      const base = tierForCount(version.policy, 0);
      await repos.tiers.open({
        partnerId: result.partner.id,
        tierKey: base.key,
        rateBasisPoints: base.rateBasisPoints,
        programVersion: version.policy.version,
        qualifyingCustomers: 0,
        effectiveFrom: now,
        evidence: { reason: "approval" },
      });
      await repos.outbox.enqueue({
        name: "partners/welcome.send",
        id: welcomeJobId(result.partner.id),
        data: { partnerId: result.partner.id },
      });
    }
    await repos.applications.decide(application.id, {
      status: "approved",
      reviewedAt: now,
      reviewedByEmail: admin.email,
      reason: note,
    });
    await repos.audit.record({
      actorEmail: admin.email,
      action: "partner.application_approved",
      targetType: "partner",
      targetId: result.partner.id,
      summary: `Approved ${application.applicantEmail} as a partner`,
      detail: { applicationId: application.id, referralCode: result.partner.referralCode, created: result.created },
    });
    return ok(result);
  });
}

export async function rejectApplication(
  deps: PartnerDeps,
  admin: AdminContext,
  applicationId: string,
  reason: string,
): Promise<Result<null>> {
  if (reason.trim().length < MIN_REASON_LENGTH) return fail("invalid", "reason");
  return deps.uow.transaction(async (repos) => {
    const application = await repos.applications.lock(applicationId);
    if (!application) return fail("not_found");
    if (application.status === "rejected") return ok(null);
    if (application.status !== "submitted") return fail("invalid", `application_${application.status}`);
    const now = deps.clock.now();
    await repos.applications.decide(application.id, {
      status: "rejected",
      reviewedAt: now,
      reviewedByEmail: admin.email,
      reason: reason.trim(),
    });
    await repos.audit.record({
      actorEmail: admin.email,
      action: "partner.application_rejected",
      targetType: "partner_application",
      targetId: application.id,
      summary: `Rejected the partner application of ${application.applicantEmail}`,
      detail: { reason: reason.trim() },
    });
    return ok(null);
  });
}

/** Suspend or reactivate. A suspended partner keeps their history and can see it; nothing pays them. */
export async function setPartnerStatus(
  deps: PartnerDeps,
  admin: AdminContext,
  partnerId: string,
  status: "active" | "suspended",
  reason: string,
): Promise<Result<null>> {
  if (reason.trim().length < MIN_REASON_LENGTH) return fail("invalid", "reason");
  return deps.uow.transaction(async (repos) => {
    const partner = await repos.partners.lock(partnerId);
    if (!partner) return fail("not_found");
    if (partner.status === status) return ok(null);
    assertTransition("partner", PARTNER_TRANSITIONS, partner.status, status);
    const now = deps.clock.now();
    await repos.partners.setStatus(partnerId, status, { at: now, reason: reason.trim() });
    await repos.audit.record({
      actorEmail: admin.email,
      action: status === "suspended" ? "partner.suspended" : "partner.reactivated",
      targetType: "partner",
      targetId: partnerId,
      summary: `${status === "suspended" ? "Suspended" : "Reactivated"} partner ${partner.contactEmail}`,
      detail: { reason: reason.trim() },
    });
    return ok(null);
  });
}

/** Hold or release automatic payouts. Partners can never clear their own hold. */
export async function setPayoutHold(
  deps: PartnerDeps,
  admin: AdminContext,
  partnerId: string,
  hold: boolean,
  reason: string,
): Promise<Result<null>> {
  if (reason.trim().length < MIN_REASON_LENGTH) return fail("invalid", "reason");
  return deps.uow.transaction(async (repos) => {
    const partner = await repos.partners.lock(partnerId);
    if (!partner) return fail("not_found");
    const now = deps.clock.now();
    await repos.partners.setPayoutHold(partnerId, hold ? { reason: reason.trim(), at: now, by: admin.email } : null);
    await repos.audit.record({
      actorEmail: admin.email,
      action: hold ? "partner.payout_hold_set" : "partner.payout_hold_released",
      targetType: "partner",
      targetId: partnerId,
      summary: `${hold ? "Held" : "Released"} automatic payouts for ${partner.contactEmail}`,
      detail: { reason: reason.trim() },
    });
    return ok(null);
  });
}

/**
 * The one welcome email (run by the partners/welcome.send job). Claimed
 * before sending, so two runs cannot both send; released if the mailer
 * refused, so the job's retry sends it.
 */
export async function sendWelcome(deps: PartnerDeps, partnerId: string): Promise<Result<"sent" | "already_sent">> {
  const repos = deps.uow.repositories;
  const partner = await repos.partners.findById(partnerId);
  if (!partner) return fail("not_found");
  if (!(await repos.partners.claimWelcomeEmail(partnerId, deps.clock.now()))) return ok("already_sent");
  const appUrl = deps.settings.appUrl();
  const sent = await deps.mailer.sendPartnerWelcome({
    to: partner.contactEmail,
    name: partner.displayName,
    referralUrl: `${appUrl}/go/${partner.referralCode}`,
    portalUrl: `${appUrl}/partner`,
  });
  if (!sent.ok) {
    await repos.partners.releaseWelcomeEmail(partnerId);
    throw new Error(`Welcome email not sent: ${sent.error ?? "unknown"}`);
  }
  return ok("sent");
}
