import { netPayable, projectedStatus } from "../../domain/entities/commission";
import { disputeEffect, reversalTarget } from "../../domain/policies/commission";
import { Money } from "../../domain/value-objects/money";
import type { NormalizedCharge } from "../ports/billing-source";
import type { CommissionRecord, Environment, PaymentFactRecord } from "../ports/repositories";
import type { PartnerRepositories } from "../ports/unit-of-work";
import type { PartnerDeps } from "./deps";

/**
 * Refunds and chargebacks, applied CUMULATIVELY.
 *
 * Every refund or dispute event (and every re-read of an invoice) brings
 * the charge's CURRENT state: total refunded, and each dispute's status and
 * amount. The commission reversed is recomputed from that total
 * (domain/policies/commission.ts reversalTarget) and only the difference
 * from what is already reversed is written - as a NEW ledger entry, never an
 * edit. Duplicated, delayed or out-of-order events therefore converge on
 * the same numbers, a refund and a lost dispute over the same money count
 * once, and more than the original commission is never reversed.
 *
 * Open disputes hold the commission; a won dispute releases that hold
 * (once - it is a state, not a toggle); a lost one reverses.
 *
 * After payout: the negative entry leaves the partner owing RepGet, which
 * the next settlement offsets (domain/policies/maturity.ts). A review case
 * records it so an administrator can recover it by transfer reversal
 * instead (Part 4) - never both.
 */

const ZERO = BigInt(0);
export const DISPUTE_HOLD = "dispute_open";

export type AdjustmentOutcome = "unchanged" | "adjusted" | "no_commission" | "ambiguous";

export async function applyChargeState(
  deps: PartnerDeps,
  repos: PartnerRepositories,
  input: { factId: string; charge: NormalizedCharge; chargeFacts: PaymentFactRecord[] },
): Promise<AdjustmentOutcome> {
  const fact = await repos.commissions.lockFact(input.factId);
  if (!fact) return "no_commission";

  /*
    One charge paying exactly the facts it belongs to. A charge for more
    than its invoice payments (one payment intent paying several invoices,
    or something we did not record) cannot be split without guessing.
  */
  const cashOnCharge = input.chargeFacts.reduce((sum, f) => sum + f.cashCollected, ZERO);
  if (input.charge.amount !== cashOnCharge || input.chargeFacts.length !== 1) {
    await repos.reviews.open({
      kind: "financial_inconsistency",
      dedupeKey: `shared_charge:${fact.environment}:${input.charge.chargeId}`,
      environment: fact.environment,
      partnerId: null,
      attributionId: fact.attributionId,
      commissionId: null,
      settlementId: null,
      paymentFactId: fact.id,
      organizationId: fact.organizationId,
      summary: "A refund or dispute is on a charge that also paid something else; its share cannot be split without guessing",
      evidence: { charge: input.charge.chargeId, chargeAmount: input.charge.amount.toString(), cashRecorded: cashOnCharge.toString() },
    });
    return "ambiguous";
  }

  const refunded = input.charge.refunded > fact.cashCollected ? fact.cashCollected : input.charge.refunded;
  const lost = input.charge.disputes
    .filter((dispute) => disputeEffect(dispute.status) === "reverse")
    .reduce((sum, dispute) => sum + dispute.amount, ZERO);
  const open = input.charge.disputes.find((dispute) => disputeEffect(dispute.status) === "hold") ?? null;
  const unknown = input.charge.disputes.find((dispute) => disputeEffect(dispute.status) === "unknown") ?? null;
  const latest = open ?? input.charge.disputes[input.charge.disputes.length - 1] ?? null;
  await repos.commissions.updateFactAdjustments(fact.id, {
    refundedAmount: refunded,
    disputeLostAmount: lost > fact.cashCollected ? fact.cashCollected : lost,
    disputeId: latest?.id ?? null,
    disputeStatus: latest?.status ?? null,
    syncedAt: deps.clock.now(),
  });

  const found = await repos.commissions.findCommissionByFact(fact.id);
  if (!found) return "no_commission";
  const commission = (await repos.commissions.lockCommission(found.id))!;
  /*
    Rejected or disqualified: what was left of it was already reversed in the
    ledger (rejected:/disqualified:<id>). A later refund or chargeback must not
    reverse it again, and an undone refund must not restore it.
  */
  if (commission.reviewState === "rejected") return "unchanged";
  const code = commission.currency;
  const target = reversalTarget({
    commission: Money.of(commission.amount, code),
    cash: Money.of(fact.cashCollected, code),
    refunded: Money.of(refunded, code),
    disputeLost: Money.of(lost, code),
  });
  const delta = target.amount - commission.reversedAmount;

  let holdReason = commission.holdReason;
  if (open || unknown) holdReason = holdReason ?? DISPUTE_HOLD;
  else if (holdReason === DISPUTE_HOLD) holdReason = null;

  if (delta === ZERO && holdReason === commission.holdReason) return "unchanged";

  if (delta !== ZERO) {
    const sequence = (await repos.commissions.countLedger(commission.id, "commission_adjustment")) + 1;
    await repos.commissions.appendLedger({
      environment: commission.environment,
      partnerId: commission.partnerId,
      currency: code,
      kind: "commission_adjustment",
      amount: -delta,
      operationKey: `reversal:${commission.id}:${sequence}`,
      commissionId: commission.id,
      paymentFactId: fact.id,
      reason:
        delta > ZERO
          ? `Refund or chargeback: ${Money.of(delta, code).toDecimalString()} ${code.toUpperCase()} of commission reversed`
          : `Refund or dispute undone: ${Money.of(-delta, code).toDecimalString()} ${code.toUpperCase()} of commission restored`,
      actor: "system",
    });
    if (commission.status === "paid" && delta > ZERO) {
      await openClawbackCase(repos, commission, fact, target.amount, delta);
    }
    if (commission.status === "paid" && delta < ZERO) {
      // Owed again, but payouts pay unpaid commissions only: a person decides how it reaches the partner.
      await repos.reviews.open({
        kind: "financial_inconsistency",
        dedupeKey: `restored_after_payout:${commission.id}:${target.amount.toString()}`,
        environment: commission.environment,
        partnerId: commission.partnerId,
        attributionId: commission.attributionId,
        commissionId: commission.id,
        settlementId: commission.paidSettlementId,
        paymentFactId: fact.id,
        organizationId: fact.organizationId,
        summary: `A refund or dispute on a paid commission was undone: ${Money.of(-delta, code).toDecimalString()} ${code.toUpperCase()} is owed to the partner again and is not paid automatically`,
        evidence: { restored: (-delta).toString(), totalReversed: target.amount.toString(), settlementId: commission.paidSettlementId },
      });
    }
  }

  const updated: CommissionRecord = { ...commission, reversedAmount: target.amount, holdReason };
  const status =
    commission.status === "reserved" || commission.status === "paid"
      ? commission.status
      : projectedStatus(
          {
            id: updated.id,
            status: updated.status,
            reviewState: updated.reviewState,
            holdReason: updated.holdReason,
            amount: Money.of(updated.amount, code),
            reversedAmount: Money.of(updated.reversedAmount, code),
            maturesAt: updated.maturesAt,
          },
          deps.clock.now(),
        );
  await repos.commissions.updateCommission(commission.id, { reversedAmount: target.amount, holdReason, status });
  return "adjusted";
}

async function openClawbackCase(
  repos: PartnerRepositories,
  commission: CommissionRecord,
  fact: PaymentFactRecord,
  target: bigint,
  delta: bigint,
) {
  const amount = Money.of(delta, commission.currency);
  await repos.reviews.open({
    kind: "reconciliation",
    dedupeKey: `clawback:${commission.id}:${target.toString()}`,
    environment: commission.environment,
    partnerId: commission.partnerId,
    attributionId: commission.attributionId,
    commissionId: commission.id,
    settlementId: commission.paidSettlementId,
    paymentFactId: fact.id,
    organizationId: fact.organizationId,
    summary: `Refund or chargeback after payout: ${amount.toDecimalString()} ${commission.currency.toUpperCase()} is offset against future earnings unless recovered by a transfer reversal`,
    evidence: { reversed: delta.toString(), totalReversed: target.toString(), settlementId: commission.paidSettlementId },
  });
}

/**
 * A refund or dispute event: re-read the charge and apply its state to the
 * payment facts recorded for it. A charge with no recorded fact is not a
 * referred customer's (or its payment has not been processed yet - the
 * invoice processing then reads the refunds itself).
 */
export async function processChargeAdjustments(
  deps: PartnerDeps,
  chargeId: string,
  environment: Environment,
): Promise<{ outcome: string; partnerIds: string[] }> {
  if (!deps.billing) return { outcome: "disabled", partnerIds: [] };
  const facts = await deps.uow.repositories.commissions.factsByCharge(environment, chargeId);
  if (facts.length === 0) return { outcome: "no_fact", partnerIds: [] };
  const charge = await deps.billing.loadCharge(chargeId);
  const outcomes = await deps.uow.transaction(async (repos) => {
    const results: AdjustmentOutcome[] = [];
    for (const fact of facts) results.push(await applyChargeState(deps, repos, { factId: fact.id, charge, chargeFacts: facts }));
    return results;
  });
  const partnerIds = new Set<string>();
  for (const fact of facts) {
    const commission = await deps.uow.repositories.commissions.findCommissionByFact(fact.id);
    if (commission) partnerIds.add(commission.partnerId);
  }
  return { outcome: outcomes.includes("adjusted") ? "adjusted" : outcomes.includes("ambiguous") ? "review" : "unchanged", partnerIds: [...partnerIds] };
}

/** What a commission still pays, as a plain bigint (for projections). */
export function netOf(commission: CommissionRecord): bigint {
  return netPayable({
    amount: Money.of(commission.amount, commission.currency),
    reversedAmount: Money.of(commission.reversedAmount, commission.currency),
  }).amount;
}
