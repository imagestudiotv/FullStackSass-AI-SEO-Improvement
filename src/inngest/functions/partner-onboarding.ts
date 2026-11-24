import { inngest } from "@/inngest/client";
import { sendApplicationNotice } from "@/lib/partners/application/use-cases/application-notices";
import { sendWelcome } from "@/lib/partners/application/use-cases/review-application";
import { partnerDeps } from "@/lib/partners/server";

/**
 * The partner welcome email, recorded in the outbox by the approval
 * (lib/partners/application/use-cases/review-application.ts) under a stable
 * id - so a retried approval is one job, and the email is claimed before it
 * is sent, so a retried job is one email.
 */
export const partnerWelcome = inngest.createFunction(
  { id: "partner-welcome", retries: 5, triggers: [{ event: "partners/welcome.send" }] },
  async ({ event, step }) => {
    const partnerId = String((event.data as { partnerId?: unknown }).partnerId ?? "");
    return step.run("send-welcome", async () => {
      const result = await sendWelcome(partnerDeps(), partnerId);
      return result.ok ? result.value : `skipped:${result.reason}`;
    });
  },
);

/**
 * The emails about an application (application-notices.ts): each
 * administrator hears that one is waiting, and an applicant hears when it was
 * not approved. One step per address, so a retry never repeats an email that
 * went out.
 */
export const partnerApplicationNotice = inngest.createFunction(
  { id: "partner-application-notice", retries: 5, triggers: [{ event: "partners/application.notify" }] },
  async ({ event, step }) => {
    const data = event.data as { applicationId?: unknown; stage?: unknown };
    const applicationId = String(data.applicationId ?? "");
    if (data.stage === "rejected") {
      return { sent: await step.run("tell-applicant", () => sendApplicationNotice(partnerDeps(), { applicationId, stage: "rejected" })) };
    }
    const admins = await step.run("administrators", () => partnerDeps().settings.adminEmails?.() ?? []);
    let sent = 0;
    for (const [index, only] of admins.entries()) {
      sent += await step.run(`tell-administrator-${index}`, () => sendApplicationNotice(partnerDeps(), { applicationId, stage: "submitted", only }));
    }
    return { sent };
  },
);
