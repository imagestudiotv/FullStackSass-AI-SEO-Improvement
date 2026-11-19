import { inngest } from "@/inngest/client";
import { sendCrispDigest } from "@/lib/support/crisp-digest";

/**
 * The daily Crisp digest to the admins (ticket 2026-11-19: "start monitor
 * crisp.chat daily if there are any help or info requests";
 * lib/support/crisp-digest.ts). 07:30 UTC, morning in Europe. Inert until the
 * Crisp API token is configured; no email on a day with nothing in Crisp.
 * One step, so a retry after a sent email does not send it again (and Resend's
 * idempotency key covers a lost answer).
 */
export const crispDigestDaily = inngest.createFunction(
  { id: "support-crisp-digest-daily", retries: 1, triggers: [{ cron: "30 7 * * *" }] },
  async ({ step, logger }) => {
    const result = await step.run("send-digest", () => sendCrispDigest());
    logger.info(result, "Crisp digest");
    return result;
  },
);
