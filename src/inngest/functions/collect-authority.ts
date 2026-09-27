import { inngest } from "@/inngest/client";
import { collectDueAuthority } from "@/lib/authority/collect";

/**
 * Collects the authority metric (DataForSEO Rank) for tracked domains.
 *
 * Daily, and on request by an administrator - never because someone opened
 * a page. One run at a time, so two triggers cannot double a paid request;
 * the spend reservation inside caps requests per day. See lib/authority/collect.ts.
 */
export const collectAuthority = inngest.createFunction(
  {
    id: "collect-authority",
    retries: 1,
    concurrency: { limit: 1 },
    triggers: [{ event: "authority/collect.requested" }, { cron: "30 4 * * *" }],
  },
  async ({ step, logger }) => {
    const outcome = await step.run("collect", () => collectDueAuthority());
    logger.info({ step: "collect", ...outcome }, "Authority collection finished");
    return outcome;
  },
);
