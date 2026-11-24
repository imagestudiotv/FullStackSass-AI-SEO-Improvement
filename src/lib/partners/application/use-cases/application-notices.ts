import type { PartnerDeps } from "./deps";

/**
 * The emails about an application: the administrators hear that one is
 * waiting, and the applicant hears when it was not approved (an approval has
 * its own welcome email, review-application.ts). Queued through the outbox by
 * the use case that made the change, so each is one job.
 *
 * Nothing is said about a state the application is not in: an application
 * decided before its "waiting" email goes out sends none. Returns how many
 * emails were sent; throws when the mailer refused, so the job is retried.
 */

export type ApplicationNotice = "submitted" | "rejected";

export function applicationNoticeId(applicationId: string, stage: ApplicationNotice): string {
  return `partners/application-${stage}:${applicationId}`;
}

export async function sendApplicationNotice(deps: PartnerDeps, input: { applicationId: string; stage: ApplicationNotice; only?: string }): Promise<number> {
  const application = await deps.uow.repositories.applications.findById(input.applicationId);
  if (!application || application.status !== input.stage) return 0;
  const appUrl = deps.settings.appUrl();
  const messages =
    input.stage === "submitted"
      ? (deps.settings.adminEmails?.() ?? [])
          .filter((to) => !input.only || to === input.only)
          .map((to) => ({
            to,
            name: "RepGet team",
            subject: "New partner application",
            lines: [
              `${application.applicantName} (${application.applicantEmail}) applied to the Affiliate Program.`,
              `Website: ${application.answers.website ?? "-"}. Country: ${application.answers.country ?? "-"}.`,
              "They cannot share a link until it is approved.",
            ],
            portalUrl: `${appUrl}/admin/partners/applications`,
            button: "Review the application",
          }))
      : [
          {
            to: application.applicantEmail,
            name: application.applicantName,
            subject: "Your RepGet partner application",
            lines: ["We reviewed your application to the RepGet Affiliate Program and could not approve it this time.", "You can apply again with more detail about your audience and how you would introduce RepGet."],
            portalUrl: `${appUrl}/partner/apply`,
            button: "Apply again",
          },
        ];
  let sent = 0;
  for (const message of messages) {
    const result = await deps.mailer.sendPartnerNotice(message);
    if (!result.ok) throw new Error(`Application notice not sent: ${result.error ?? "unknown"}`);
    sent += 1;
  }
  return sent;
}
