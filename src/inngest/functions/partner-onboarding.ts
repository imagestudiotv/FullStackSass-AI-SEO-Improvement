import { inngest } from "@/inngest/client";
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
