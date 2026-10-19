import { APPLICATION_LIMITS, type ApplicationAnswers } from "../../domain/entities/application";
import type { ApplicantContext } from "../contracts/commands";
import { fail, ok, type Result } from "../contracts/results";
import type { PartnerDeps } from "./deps";

/**
 * A signed-in user with a proven address applies to the partner program.
 *
 * With the account they already have: nothing here creates a login, a
 * workspace, a plan or a website. One open application per user (the
 * database enforces it too), a user who is already a partner cannot apply
 * again, and submissions are rate-limited per user and in total.
 */

export const APPLICATION_RATE = { perUserPerDay: 3, globalPerHour: 60 } as const;

export type ApplicationInput = {
  website: string;
  audience: string;
  promotion: string;
  country: string;
};

export function validateAnswers(input: ApplicationInput, payoutCountries: string[]): Result<ApplicationAnswers> {
  const website = input.website.trim();
  const audience = input.audience.trim();
  const promotion = input.promotion.trim();
  const country = input.country.trim().toUpperCase();
  if (!/^https?:\/\/[^\s]+\.[^\s]+$/i.test(website) || website.length > APPLICATION_LIMITS.website) {
    return fail("invalid", "website");
  }
  if (audience.length < 10 || audience.length > APPLICATION_LIMITS.audience) return fail("invalid", "audience");
  if (promotion.length < 10 || promotion.length > APPLICATION_LIMITS.promotion) return fail("invalid", "promotion");
  if (!payoutCountries.includes(country)) return fail("invalid", "country");
  return ok({ website, audience, promotion, country });
}

export async function submitApplication(
  deps: PartnerDeps,
  applicant: ApplicantContext,
  input: ApplicationInput,
): Promise<Result<{ applicationId: string }>> {
  const repos = deps.uow.repositories;
  if (!(await repos.controls.isEnabled("partner_program"))) return fail("disabled", "partner_program");

  const answers = validateAnswers(input, deps.settings.payoutCountries());
  if (!answers.ok) return answers;

  if (await repos.partners.findByUserId(applicant.userId)) return fail("already_processed", "already_partner");
  if (await repos.applications.findOpenByUser(applicant.userId)) return fail("already_processed", "already_applied");

  const admitted = await deps.quotaLimiter.admit(
    [
      { key: `partner-apply:user:${applicant.userId}`, limit: APPLICATION_RATE.perUserPerDay, windowSeconds: 86_400 },
      { key: "partner-apply:global", limit: APPLICATION_RATE.globalPerHour, windowSeconds: 3_600 },
    ],
    "partner.application",
  );
  if (!admitted) return fail("rate_limited");

  const created = await repos.applications.create({
    userId: applicant.userId,
    answers: answers.value,
    applicantEmail: applicant.email,
    applicantName: applicant.name,
    submittedAt: deps.clock.now(),
  });
  // The unique index lost a race with another submission of the same user.
  if (!created) return fail("already_processed", "already_applied");
  return ok({ applicationId: created.id });
}

/** What the applicant sees about their own application. */
export async function applicationStatus(deps: PartnerDeps, applicant: ApplicantContext) {
  const repos = deps.uow.repositories;
  const [partner, latest, open] = await Promise.all([
    repos.partners.findByUserId(applicant.userId),
    repos.applications.latestByUser(applicant.userId),
    repos.controls.isEnabled("partner_program"),
  ]);
  return { partner, latest, programOpen: open };
}
