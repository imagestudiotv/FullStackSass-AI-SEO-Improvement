import type { ReconciliationFinding } from "../ports/repositories";
import type { PartnerDeps } from "./deps";
import { computeBalances } from "./mature-commissions";
import { recordRecoveredWork } from "./process-provider-events";
import { reconcileSettlements } from "./reconcile-settlement";

/**
 * Daily billing reconciliation for the partner program.
 *
 *  - A Stripe payment of real money for an attributed customer with no
 *    payment fact (a webhook missed or never processed): recorded again as
 *    affiliate work, which the worker processes like any event - missed
 *    events are RECOVERED, not just reported.
 *  - A fact that says "commissioned" without a commission, a commission
 *    whose earned entry is missing or doubled, or whose reversal differs
 *    from its ledger: a review case. Financial rows are never edited to
 *    make a report come out clean.
 *  - A balance projection that differs from a fresh computation: rebuilt
 *    (it is a projection, not a record) AND reported, so a drift is never
 *    silently absorbed.
 *  - Unattributed clicks past their window and a grace period: deleted
 *    (retention).
 */

const CLICK_GRACE_DAYS = 30;

export async function reconcileCommissions(deps: PartnerDeps) {
  const environment = deps.settings.environment();
  if (!environment) return null;
  const repos = deps.uow.repositories;
  const now = deps.clock.now();

  const missed = await repos.reconciliation.paymentsWithoutFacts(environment, 200);
  let recovered = 0;
  for (const payment of missed) {
    if (await recordRecoveredWork(deps, { kind: "invoice", objectId: payment.invoiceId, environment, reason: "reconcile.missed_payment" })) recovered += 1;
  }

  const findings: ReconciliationFinding[] = [
    ...(await repos.reconciliation.factsWithoutCommission(environment, 200)),
    ...(await repos.reconciliation.earnedMismatches(environment, 200)),
    ...(await repos.reconciliation.reversalMismatches(environment, 200)),
    ...(await reconcileSettlements(deps)),
  ];

  for (const stored of await repos.reconciliation.projections(environment)) {
    const fresh = await computeBalances(deps, stored.partnerId, environment, stored.currency);
    const differs = (Object.keys(stored.values) as (keyof typeof fresh)[]).filter((key) => stored.values[key] !== fresh[key]);
    if (differs.length > 0) {
      findings.push({
        kind: "projection_mismatch",
        subject: `${stored.partnerId}:${stored.currency}`,
        detail: Object.fromEntries(differs.map((key) => [key, `${stored.values[key]} -> ${fresh[key]}`])),
      });
      await repos.settlements.writeProjection(stored.partnerId, environment, stored.currency, { ...fresh, rebuiltAt: now });
    }
  }

  for (const finding of findings) {
    await repos.reviews.open({
      kind: "reconciliation",
      dedupeKey: `reconcile:${finding.kind}:${finding.subject}`,
      environment,
      partnerId: null,
      attributionId: null,
      commissionId: finding.kind === "earned_mismatch" || finding.kind === "reversal_mismatch" ? finding.subject : null,
      settlementId: ["abandoned_reservation", "transfer_unknown", "needs_review", "bank_payout_failed"].includes(finding.kind) ? finding.subject : null,
      paymentFactId: finding.kind === "fact_without_commission" ? finding.subject : null,
      organizationId: null,
      summary: `Reconciliation: ${finding.kind.replace(/_/g, " ")}`,
      evidence: finding.detail,
    });
  }

  const purged = await repos.tracking.purgeClicks(
    new Date(now.getTime() - CLICK_GRACE_DAYS * 24 * 60 * 60 * 1000),
  );
  return { missedPayments: missed.length, recovered, findings, purgedClicks: purged };
}
