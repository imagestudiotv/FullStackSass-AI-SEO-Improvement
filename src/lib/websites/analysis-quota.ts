import type { QuotaRule, Reservation } from "@/lib/billing/spend-quota";
import type { Executor } from "@/lib/db/types";
import { reserveAndQueue } from "@/lib/jobs/outbox";

/**
 * How often a website may be analysed: a homepage crawl plus a model call.
 *
 * Analysis is the one paid job that runs BEFORE anybody pays — adding a
 * website analyses it so onboarding can describe the business — so it cannot
 * simply require a subscription. It was unbounded instead: adding and deleting
 * a site, or pressing "retry analysis", queued another crawl and model call
 * every time, and sign-up is free.
 *
 * Every workspace gets an hourly ceiling. A site without a plan additionally
 * draws on a small daily free allowance per workspace and a global hourly
 * ceiling shared by every free analysis, which is what bounds many throwaway
 * accounts. Paying customers never touch the free pools.
 */
export const ANALYSES_PER_WORKSPACE_PER_HOUR = 10;
export const FREE_ANALYSES_PER_WORKSPACE_PER_DAY = 5;
export const FREE_ANALYSES_PER_HOUR = 200;

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

function analysisRules(organizationId: string, entitled: boolean): QuotaRule[] {
  const rules: QuotaRule[] = [
    {
      key: `analysis:org:${organizationId}`,
      limit: ANALYSES_PER_WORKSPACE_PER_HOUR,
      window: { seconds: HOUR },
    },
  ];
  if (!entitled) {
    rules.push(
      {
        key: `analysis-free:org:${organizationId}`,
        limit: FREE_ANALYSES_PER_WORKSPACE_PER_DAY,
        window: { seconds: DAY },
      },
      {
        key: "analysis-free:global",
        limit: FREE_ANALYSES_PER_HOUR,
        window: { seconds: HOUR },
      },
    );
  }
  return rules;
}

/**
 * Reserves an analysis, makes the website change that needs it (`write`,
 * which returns the website id, or false to back out) and records the
 * analysis job - all in ONE transaction - then delivers the job
 * (lib/jobs/outbox.ts).
 *
 * So there is no website sitting "pending" with no job behind it, and no
 * reservation held for a job that was never recorded. A queue outage delays
 * the analysis; if it can never be delivered, the reservation is returned and
 * the website marked failed.
 */
export async function queueAnalysis(
  /** The website's OWNER - the organization that pays. */
  organizationId: string,
  options: { entitled: boolean; websiteId?: string },
  write: (tx: Executor, reservations: Reservation[]) => Promise<string | false>,
): Promise<
  | { ok: true; websiteId: string; delivered: boolean }
  | { ok: false; error: string; declined?: true }
> {
  let websiteId: string | null = null;
  const outcome = await reserveAndQueue<string>(
    analysisRules(organizationId, options.entitled),
    {
      operation: "website.analyze",
      organizationId,
      websiteId: options.websiteId ?? null,
    },
    (reservations) => ({
      id: `website-analyze:${reservations[0].id}`,
      name: "website/analyze.requested",
      data: { websiteId, organizationId, reservations },
    }),
    async (tx, reservations) => {
      const id = await write(tx, reservations);
      if (id !== false) websiteId = id;
      return id;
    },
  );

  if (outcome.ok) {
    return { ok: true, websiteId: outcome.written as string, delivered: outcome.delivered };
  }
  if (outcome.refused) return { ok: false, error: "declined", declined: true };
  return {
    ok: false,
    error: outcome.rule?.key.startsWith("analysis-free:org:")
      ? "You have analysed several websites today. Choose a plan, or try again tomorrow."
      : "Too many websites are being analysed right now. Please try again shortly.",
  };
}
