import { monthlyRunKey } from "../../domain/policies/maturity";
import { MIN_REASON_LENGTH, type AdminContext } from "../contracts/commands";
import { fail, ok, type Result } from "../contracts/results";
import type { PartnerDeps } from "./deps";
import { executeSettlement, type ExecutionResult } from "./execute-transfer";
import { prepareSettlement, runMonthlySettlements, type SettlementOutcome } from "./prepare-settlement";
import { reconcileCommissions } from "./reconcile-commissions";

/**
 * Administrator controls over payouts. None of them is a shortcut: each one
 * runs the same use case the schedule runs, with every check it makes, so
 * nothing here can mark money transferred or bank-paid without Stripe's
 * evidence.
 *
 *   prepareNow      this month's settlement for one partner and currency,
 *                   ahead of the 1st (still one per month: same run key)
 *   runMonthlyNow   the monthly run for everyone, now
 *   retry           executes a settlement now instead of at its next attempt
 *                   (the lease and the one-live-transfer index still apply)
 *   reconcileNow    the daily reconciliation, now
 */

export async function prepareSettlementNow(
  deps: PartnerDeps,
  admin: AdminContext,
  input: { partnerId: string; currency: string; reason: string },
): Promise<Result<SettlementOutcome>> {
  if (input.reason.trim().length < MIN_REASON_LENGTH) return fail("invalid", "reason");
  const outcome = await prepareSettlement(deps, admin, { partnerId: input.partnerId, currency: input.currency.toLowerCase(), runKey: monthlyRunKey(deps.clock.now()) });
  return ok(outcome);
}

export async function runMonthlySettlementsNow(deps: PartnerDeps, admin: AdminContext, reason: string) {
  if (reason.trim().length < MIN_REASON_LENGTH) return fail("invalid", "reason");
  const run = await runMonthlySettlements(deps, admin);
  return ok({
    runKey: run.runKey,
    created: run.results.filter((result) => result.outcome.kind === "created").length,
    carriedForward: run.results.filter((result) => result.outcome.kind === "carried_forward").length,
    skipped: run.results.filter((result) => result.outcome.kind === "skipped").length,
  });
}

const NOT_RETRYABLE = new Set(["paid", "canceled", "needs_review"]);

export async function retrySettlement(deps: PartnerDeps, admin: AdminContext, settlementId: string, reason: string): Promise<Result<ExecutionResult>> {
  if (reason.trim().length < MIN_REASON_LENGTH) return fail("invalid", "reason");
  const recorded = await deps.uow.transaction(async (tx): Promise<Result<null>> => {
    const settlement = await tx.settlements.findById(settlementId);
    if (!settlement) return fail("not_found");
    // needs_review is decided by a person through its review case, not retried.
    if (NOT_RETRYABLE.has(settlement.state)) return fail("invalid", `state_${settlement.state}`);
    await tx.audit.record({
      actorEmail: admin.email,
      action: "partner.settlement_retried",
      targetType: "partner_settlement",
      targetId: settlement.id,
      summary: `Retried a partner payout (${settlement.state.replace(/_/g, " ")})`,
      detail: { reason: reason.trim(), attempts: settlement.attempts },
    });
    return ok(null);
  });
  if (!recorded.ok) return recorded;
  return ok(await executeSettlement(deps, settlementId));
}

export async function reconcileNow(deps: PartnerDeps, admin: AdminContext, reason: string) {
  if (reason.trim().length < MIN_REASON_LENGTH) return fail("invalid", "reason");
  const result = await reconcileCommissions(deps);
  if (!result) return fail("disabled", "stripe_not_configured");
  await deps.uow.repositories.audit.record({
    actorEmail: admin.email,
    action: "partner.reconciliation_run",
    targetType: "partner_program",
    targetId: "reconciliation",
    summary: `Ran the partner reconciliation: ${result.findings.length} finding${result.findings.length === 1 ? "" : "s"}`,
    detail: { reason: reason.trim(), missedPayments: result.missedPayments, recovered: result.recovered, findings: result.findings.length },
  });
  return ok({ findings: result.findings.length, recovered: result.recovered, missedPayments: result.missedPayments });
}
