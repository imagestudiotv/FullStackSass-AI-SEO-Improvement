import { inngest } from "@/inngest/client";
import { reconcileCommissions } from "@/lib/partners/application/use-cases/reconcile-commissions";
import { partnerDeps } from "@/lib/partners/server";

/**
 * Daily reconciliation of the partner program (03:40 UTC): recovers payments
 * whose webhook was missed, reports financial discrepancies as review cases,
 * rebuilds (and reports) drifted balance projections, and deletes
 * unattributed clicks past their retention. Read-only towards Stripe.
 */
export const partnerReconciliation = inngest.createFunction(
  { id: "partner-reconciliation", retries: 1, concurrency: { limit: 1 }, triggers: [{ cron: "40 3 * * *" }] },
  async ({ step }) => {
    const result = await step.run("reconcile", async () => {
      const report = await reconcileCommissions(partnerDeps());
      return report
        ? { missedPayments: report.missedPayments, recovered: report.recovered, findings: report.findings.length, purgedClicks: report.purgedClicks }
        : { skipped: "stripe_not_configured" };
    });
    return result;
  },
);
