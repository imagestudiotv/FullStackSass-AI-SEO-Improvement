import { Money } from "../../domain/value-objects/money";
import { MIN_REASON_LENGTH, type AdminContext } from "../contracts/commands";
import { fail, ok, type Result } from "../contracts/results";
import type { TransferEvidence } from "../ports/payout-gateway";
import type { ReconciliationFinding, TransferAttemptRecord } from "../ports/repositories";
import type { PartnerDeps } from "./deps";
import { rebuildProjection } from "./mature-commissions";

/**
 * Transfer reversals and settlement reconciliation.
 *
 * RECOVERING MONEY ALREADY TRANSFERRED. A refund or chargeback after payout
 * leaves the partner owing RepGet; by default that is offset against later
 * earnings. An administrator may instead recover it with a Stripe transfer
 * reversal - only up to what the partner owes, and only up to what is left
 * of the transfer. The ledger records a `transfer_reversal` ONLY when Stripe
 * confirms it, keyed by the Stripe reversal id, so the same money is never
 * both recovered and offset, and a reversal made outside RepGet (in the
 * Dashboard) is recorded exactly once too when its transfer.reversed event
 * or the reconciliation reads it.
 */

export async function syncTransferReversals(deps: PartnerDeps, transferId: string) {
  const gateway = deps.payouts;
  if (!gateway) return { outcome: "disabled", partnerIds: [] as string[] };
  const repos = deps.uow.repositories;
  const attempt = await repos.settlements.findTransferAttemptByStripeId(transferId);
  if (!attempt) return { outcome: "no_partner_transfer", partnerIds: [] as string[] };
  const transfer = await gateway.retrieveTransfer(transferId);
  return { outcome: await applyReversals(deps, attempt, transfer), partnerIds: [] as string[] };
}

async function applyReversals(deps: PartnerDeps, attempt: TransferAttemptRecord, transfer: TransferEvidence): Promise<string> {
  const settlement = await deps.uow.repositories.settlements.findById(attempt.settlementId);
  if (!settlement) return "not_found";
  let recorded = 0;
  await deps.uow.transaction(async (tx) => {
    const ours = await tx.settlements.reversals(attempt.id);
    for (const reversal of transfer.reversals) {
      const wrote = await tx.commissions.appendLedger({
        environment: attempt.environment,
        partnerId: settlement.partnerId,
        currency: attempt.currency,
        kind: "transfer_reversal",
        amount: reversal.amount,
        operationKey: `transfer-reversal:${reversal.id}`,
        settlementId: settlement.id,
        reason: `Stripe reversed ${Money.of(reversal.amount, attempt.currency).toDecimalString()} ${attempt.currency.toUpperCase()} of transfer ${transfer.id} (${reversal.id})`,
        actor: "system",
      });
      if (!wrote) continue;
      recorded += 1;
      const mine = ours.find((r) => r.stripeReversalId === reversal.id || (r.status !== "confirmed" && r.amount === reversal.amount));
      if (mine) {
        await tx.settlements.updateReversal(mine.id, { status: "confirmed", stripeReversalId: reversal.id, confirmedAt: deps.clock.now() });
      } else {
        await tx.reviews.open({
          kind: "payout_discrepancy",
          dedupeKey: `external_reversal:${reversal.id}`,
          environment: attempt.environment,
          partnerId: settlement.partnerId,
          attributionId: null,
          commissionId: null,
          settlementId: settlement.id,
          paymentFactId: null,
          organizationId: null,
          summary: "A partner transfer was reversed outside RepGet; the reversal is recorded in the ledger",
          evidence: { transfer: transfer.id, reversal: reversal.id, amount: reversal.amount.toString() },
        });
      }
    }
    await tx.settlements.updateTransferAttempt(attempt.id, ["confirmed", "partially_reversed", "reversed"], {
      status: transfer.amountReversed >= attempt.amount ? "reversed" : transfer.amountReversed > BigInt(0) ? "partially_reversed" : "confirmed",
      amountReversed: transfer.amountReversed,
      checkedAt: deps.clock.now(),
    });
  });
  await rebuildProjection(deps, settlement.partnerId, settlement.environment, settlement.currency);
  return recorded > 0 ? "reversal_recorded" : "unchanged";
}

export async function requestTransferReversal(
  deps: PartnerDeps,
  admin: AdminContext,
  input: { settlementId: string; amount: bigint; reason: string },
): Promise<Result<{ status: string }>> {
  const gateway = deps.payouts;
  if (!gateway) return fail("disabled", "stripe_not_configured");
  if (input.reason.trim().length < MIN_REASON_LENGTH) return fail("invalid", "reason");
  if (input.amount <= BigInt(0)) return fail("invalid", "amount");
  const repos = deps.uow.repositories;
  const settlement = await repos.settlements.findById(input.settlementId);
  if (!settlement) return fail("not_found");
  const attempt = (await repos.settlements.transferAttempts(settlement.id)).find((a) => ["confirmed", "partially_reversed"].includes(a.status));
  if (!attempt?.stripeTransferId) return fail("invalid", "no_confirmed_transfer");
  const ledger = await repos.commissions.ledgerSum(settlement.partnerId, settlement.environment, settlement.currency);
  const owed = ledger.liability < BigInt(0) ? -ledger.liability : BigInt(0);
  const remaining = attempt.amount - attempt.amountReversed;
  if (input.amount > owed) return fail("invalid", "more_than_owed");
  if (input.amount > remaining) return fail("invalid", "more_than_transfer");

  const reversal = await deps.uow.transaction(async (tx) => {
    const sequence = (await tx.settlements.reversals(attempt.id)).length + 1;
    const created = await tx.settlements.createReversal({
      transferAttemptId: attempt.id,
      operationId: `partner-reversal:${attempt.id}:${sequence}`,
      amount: input.amount,
      currency: attempt.currency,
      reason: input.reason.trim(),
      requestedBy: admin.email,
    });
    if (!created) return null;
    await tx.audit.record({
      actorEmail: admin.email,
      action: "partner.transfer_reversal_requested",
      targetType: "partner_settlement",
      targetId: settlement.id,
      summary: `Requested a transfer reversal of ${Money.of(input.amount, attempt.currency).toDecimalString()} ${attempt.currency.toUpperCase()}`,
      detail: { transfer: attempt.stripeTransferId, operationId: created.operationId, reason: input.reason.trim() },
    });
    return created;
  });
  if (!reversal) return fail("conflict");
  const outcome = await gateway.createTransferReversal({
    transferId: attempt.stripeTransferId,
    amount: input.amount,
    idempotencyKey: reversal.operationId,
    metadata: { repget_settlement_id: settlement.id, repget_operation_id: reversal.operationId },
  });
  if (outcome.kind === "refused") {
    await repos.settlements.updateReversal(reversal.id, { status: "failed", failureMessage: outcome.message });
    // The negative position stays and is offset against later earnings.
    return fail("invalid", outcome.code ?? "reversal_refused");
  }
  if (outcome.kind === "unknown") {
    await repos.settlements.updateReversal(reversal.id, { status: "unknown", failureMessage: outcome.message });
    return ok({ status: "unknown" });
  }
  await repos.settlements.updateReversal(reversal.id, { status: "processing", stripeReversalId: outcome.value.reversalId });
  // Recorded from Stripe's own view of the transfer, keyed by the reversal id.
  await applyReversals(deps, attempt, await gateway.retrieveTransfer(attempt.stripeTransferId));
  return ok({ status: "confirmed" });
}

/**
 * Settlement checks for the daily reconciliation: work stuck past its
 * lease, outcomes still unknown, bank payouts failing, and every confirmed
 * transfer compared with Stripe (missing, mismatched, reversed outside).
 */
export async function reconcileSettlements(deps: PartnerDeps): Promise<ReconciliationFinding[]> {
  const gateway = deps.payouts;
  const environment = deps.settings.environment();
  if (!gateway || !environment) return [];
  const repos = deps.uow.repositories;
  const now = deps.clock.now();
  const findings: ReconciliationFinding[] = [];
  const { rows } = await repos.settlements.list({ environment, offset: 0, limit: 500 });
  for (const settlement of rows) {
    const age = now.getTime() - settlement.createdAt.getTime();
    if (settlement.state === "reserved" && age > 7 * 24 * 60 * 60 * 1000) {
      findings.push({ kind: "abandoned_reservation", subject: settlement.id, detail: { createdAt: settlement.createdAt.toISOString(), lastError: settlement.lastError } });
    }
    if (settlement.state === "transfer_unknown" || settlement.state === "needs_review") {
      findings.push({ kind: settlement.state, subject: settlement.id, detail: { lastError: settlement.lastError } });
    }
    if (settlement.state === "payout_failed") {
      findings.push({ kind: "bank_payout_failed", subject: settlement.id, detail: { lastError: settlement.lastError } });
    }
    for (const attempt of await repos.settlements.transferAttempts(settlement.id)) {
      if (!attempt.stripeTransferId || !["confirmed", "partially_reversed", "reversed"].includes(attempt.status)) continue;
      let transfer: TransferEvidence | null = null;
      try {
        transfer = await gateway.retrieveTransfer(attempt.stripeTransferId);
      } catch {
        transfer = null;
      }
      if (!transfer) {
        findings.push({ kind: "confirmed_transfer_missing_at_stripe", subject: attempt.id, detail: { transfer: attempt.stripeTransferId } });
        continue;
      }
      if (transfer.amount !== attempt.amount || transfer.destination !== attempt.stripeAccountId) {
        findings.push({ kind: "transfer_mismatch", subject: attempt.id, detail: { transfer: transfer.id, amount: transfer.amount.toString() } });
      }
      if (transfer.amountReversed !== attempt.amountReversed) await applyReversals(deps, attempt, transfer);
    }
  }
  return findings;
}
