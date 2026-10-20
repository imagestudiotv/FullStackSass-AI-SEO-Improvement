import { canReceiveAutomaticPayout } from "../../domain/entities/partner";
import { Money } from "../../domain/value-objects/money";
import type { TransferEvidence } from "../ports/payout-gateway";
import type { SettlementRecord, TransferAttemptRecord } from "../ports/repositories";
import type { PartnerDeps } from "./deps";
import { payoutStage } from "./execute-bank-payout";
import { accountReadiness } from "./manage-payout-account";
import { rebuildProjection } from "./mature-commissions";
import { cancelSettlement } from "./prepare-settlement";

/**
 * Executing a settlement - stage 2, the TRANSFER (platform balance to the
 * partner's connected balance), then hand-over to stage 3, the bank payout.
 *
 * executeSettlement takes the settlement's work lease (a lease running out
 * does NOT prove a Stripe call failed: anything that may have reached Stripe
 * is recorded first and reconciled after). Then, by state:
 *
 *   reserved          pre-flight (switches, live-money key, partner, the
 *                     account read from Stripe, the allocations unchanged,
 *                     the platform's available balance), then ONE transfer
 *                     attempt recorded "processing" BEFORE the request, with a
 *                     stable operation id that is the idempotency key and is
 *                     in the metadata, under the settlement's transfer_group
 *   transfer_unknown  (or processing, its worker gone) reconciled: found by
 *                     transfer_group -> confirmed; within 23h the SAME request
 *                     is repeated with the SAME idempotency key (Stripe returns
 *                     the original); after that, absent from the group, it
 *                     never existed and a new attempt may be made
 *   transferred ...   the bank payout stage (execute-bank-payout.ts)
 *
 * A confirmed transfer writes `transfer_confirmed` to the ledger once (keyed
 * by the Stripe transfer id) and marks the allocated commissions paid. The
 * database allows ONE transfer per settlement that may have moved money, so
 * nothing here - and no bank payout failure - can pay the same earnings
 * twice.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const LEASE_MS = 5 * MINUTE;
const FUNDS_RETRIES = 8;
const RETRYABLE_REFUSALS = new Set(["balance_insufficient", "rate_limited", "lock_timeout"]);

export type ExecutionResult = { settlementId: string; state: string; detail?: string };

export function transferOperationId(settlementId: string, attempt: number): string {
  return `partner-transfer:${settlementId}:${attempt}`;
}

export async function executeSettlement(deps: PartnerDeps, settlementId: string): Promise<ExecutionResult> {
  const repos = deps.uow.repositories;
  const token = deps.random.uuid();
  const now = deps.clock.now();
  const settlement = await repos.settlements.claim(settlementId, token, new Date(now.getTime() + LEASE_MS), now);
  if (!settlement) return { settlementId, state: "busy" };
  let next = new Date(now.getTime() + HOUR);
  let lastError: string | null = null;
  try {
    let current = settlement;
    if (["reserved", "transfer_processing", "transfer_unknown"].includes(current.state)) {
      const step = await transferStage(deps, current);
      next = step.next;
      lastError = step.error ?? null;
      current = (await repos.settlements.findById(settlementId))!;
    }
    if (["transferred", "payout_pending", "payout_in_transit", "payout_failed", "paid"].includes(current.state)) {
      const step = await payoutStage(deps, current);
      next = step.next;
      lastError = step.error ?? lastError;
      current = (await repos.settlements.findById(settlementId))!;
    }
    return { settlementId, state: current.state, detail: lastError ?? undefined };
  } catch (error) {
    lastError = error instanceof Error ? error.message.slice(0, 300) : "execution failed";
    next = new Date(deps.clock.now().getTime() + 15 * MINUTE);
    console.error(`[partners] settlement ${settlementId} execution failed`, error);
    return { settlementId, state: "error", detail: lastError };
  } finally {
    await repos.settlements.releaseClaim(settlementId, token, { nextAttemptAt: next, lastError });
    if (deps.settings.environment()) {
      await rebuildProjection(deps, settlement.partnerId, settlement.environment, settlement.currency).catch(() => {});
    }
  }
}

type Step = { next: Date; error?: string };

async function transferStage(deps: PartnerDeps, settlement: SettlementRecord): Promise<Step> {
  const gateway = deps.payouts;
  const now = deps.clock.now();
  if (!gateway) return { next: new Date(now.getTime() + 6 * HOUR), error: "stripe_not_configured" };
  const repos = deps.uow.repositories;
  const attempts = await repos.settlements.transferAttempts(settlement.id);
  const confirmed = attempts.find((a) => ["confirmed", "partially_reversed", "reversed"].includes(a.status));
  if (confirmed) {
    // The transfer is settled; make sure the settlement says so.
    await repos.settlements.setState(settlement.id, ["transfer_processing", "transfer_unknown", "reserved"], "transferred", { transferredAt: now });
    return { next: now };
  }
  const live = attempts.find((a) => a.status === "processing" || a.status === "unknown");
  if (live) {
    /*
      Repeating the request may be its FIRST real submission (the original may
      never have reached Stripe), so it is allowed only while a new transfer
      would be: both switches, the environment and the partner are re-checked.
      Otherwise the attempt is only looked up at Stripe, never sent.
    */
    const partner = await repos.partners.findById(settlement.partnerId);
    const mayResubmit =
      (await repos.controls.isEnabled("partner_payouts")) &&
      deps.settings.moneyMovementAllowed(settlement.environment) &&
      gateway.environment() === settlement.environment &&
      partner !== null &&
      canReceiveAutomaticPayout(partner);
    return resolveUnknownTransfer(deps, settlement, live, mayResubmit);
  }

  // ---- a new submission: only from "reserved", and only after the pre-flight passes ----
  const cancel = async (reason: string): Promise<Step> => {
    await cancelSettlement(deps, { kind: "system", origin: "settlement-preflight" }, settlement.id, reason);
    return { next: new Date(now.getTime() + 24 * HOUR), error: reason };
  };
  if (!(await repos.controls.isEnabled("partner_payouts"))) return cancel("payouts_disabled");
  if (!deps.settings.moneyMovementAllowed(settlement.environment)) return cancel("money_movement_blocked");
  if (gateway.environment() !== settlement.environment) return cancel("wrong_environment");
  const partner = await repos.partners.findById(settlement.partnerId);
  if (!partner || !canReceiveAutomaticPayout(partner)) return cancel(partner?.status === "suspended" ? "partner_suspended" : "payout_hold");
  const readiness = await accountReadiness(gateway, settlement.stripeAccountId);
  if (readiness.status !== "ready" || (readiness.metadataPartnerId !== null && readiness.metadataPartnerId !== settlement.partnerId)) {
    return cancel(`account_${readiness.status}`);
  }

  const available = await gateway.platformAvailableBalance(settlement.currency);
  if (available < settlement.transferAmount) {
    if (settlement.attempts >= FUNDS_RETRIES) {
      await repos.reviews.open({
        kind: "payout_funding",
        dedupeKey: `payout_funding:${settlement.id}`,
        environment: settlement.environment,
        partnerId: settlement.partnerId,
        attributionId: null,
        commissionId: null,
        settlementId: settlement.id,
        paymentFactId: null,
        organizationId: null,
        summary: `The platform's available ${settlement.currency.toUpperCase()} balance could not cover a partner payout; it was released for the next run`,
        evidence: { available: available.toString(), needed: settlement.transferAmount.toString() },
      });
      return cancel("funds_unavailable");
    }
    return { next: new Date(now.getTime() + 6 * HOUR), error: "funds_unavailable" };
  }

  const number = attempts.length + 1;
  const operationId = transferOperationId(settlement.id, number);
  /*
    The allocations are re-checked IN the transaction that records the
    attempt: a refund, hold or rejection since the reservation means the plan
    no longer holds, and the settlement is released instead of sent.
  */
  const attempt = await deps.uow.transaction(async (tx) => {
    const items = await tx.settlements.items(settlement.id, true);
    const gross = items.reduce((sum, item) => sum + item.amount, BigInt(0));
    for (const item of [...items].sort((a, b) => (a.commissionId < b.commissionId ? -1 : 1))) {
      const commission = await tx.commissions.lockCommission(item.commissionId);
      const unchanged =
        commission !== null &&
        commission.status === "reserved" &&
        commission.amount - commission.reversedAmount === item.amount &&
        commission.holdReason === null &&
        commission.reviewState === "approved";
      if (!unchanged) return "changed" as const;
    }
    if (gross !== settlement.grossAmount) return "changed" as const;
    const created = await tx.settlements.createTransferAttempt({
      settlementId: settlement.id,
      attemptNumber: number,
      operationId,
      environment: settlement.environment,
      stripeAccountId: settlement.stripeAccountId,
      currency: settlement.currency,
      amount: settlement.transferAmount,
      submittedAt: deps.clock.now(),
    });
    if (!created) return null;
    if (!(await tx.settlements.setState(settlement.id, ["reserved"], "transfer_processing"))) throw new Error("Settlement changed state during submission");
    return created;
  });
  if (attempt === "changed") return cancel("allocations_changed");
  if (!attempt) return { next: new Date(now.getTime() + 5 * MINUTE), error: "attempt_exists" };

  const outcome = await gateway.createTransfer({
    destination: settlement.stripeAccountId,
    amount: settlement.transferAmount,
    currency: settlement.currency,
    transferGroup: settlement.transferGroup,
    idempotencyKey: operationId,
    metadata: { repget_settlement_id: settlement.id, repget_operation_id: operationId, repget_partner_id: settlement.partnerId },
  });
  return applyTransferOutcome(deps, settlement, attempt, outcome);
}

async function applyTransferOutcome(
  deps: PartnerDeps,
  settlement: SettlementRecord,
  attempt: TransferAttemptRecord,
  outcome: Awaited<ReturnType<NonNullable<PartnerDeps["payouts"]>["createTransfer"]>>,
): Promise<Step> {
  const now = deps.clock.now();
  const repos = deps.uow.repositories;
  if (outcome.kind === "succeeded") return confirmTransfer(deps, settlement, attempt, outcome.value);
  if (outcome.kind === "unknown") {
    await deps.uow.transaction(async (tx) => {
      await tx.settlements.updateTransferAttempt(attempt.id, ["processing", "unknown"], { status: "unknown", failureMessage: outcome.message, checkedAt: now });
      await tx.settlements.setState(settlement.id, ["transfer_processing", "transfer_unknown"], "transfer_unknown", { lastError: "transfer_outcome_unknown" });
    });
    return { next: new Date(now.getTime() + 10 * MINUTE), error: "transfer_outcome_unknown" };
  }
  // Refused: Stripe processed the request and created nothing.
  const retryable = outcome.code !== null && RETRYABLE_REFUSALS.has(outcome.code);
  await deps.uow.transaction(async (tx) => {
    await tx.settlements.updateTransferAttempt(attempt.id, ["processing", "unknown"], {
      status: retryable ? "retryable_failure" : "failed",
      failureCode: outcome.code,
      failureMessage: outcome.message,
      checkedAt: now,
    });
    await tx.settlements.setState(settlement.id, ["transfer_processing", "transfer_unknown"], "reserved", { lastError: outcome.code ?? "refused" });
  });
  if (retryable) return { next: new Date(now.getTime() + 6 * HOUR), error: outcome.code ?? "refused" };
  await repos.reviews.open({
    kind: "payout_discrepancy",
    dedupeKey: `transfer_refused:${attempt.operationId}`,
    environment: settlement.environment,
    partnerId: settlement.partnerId,
    attributionId: null,
    commissionId: null,
    settlementId: settlement.id,
    paymentFactId: null,
    organizationId: null,
    summary: `Stripe refused a partner transfer (${outcome.code ?? "no code"}); the payout was released`,
    evidence: { operationId: attempt.operationId, code: outcome.code, message: outcome.message },
  });
  await cancelSettlement(deps, { kind: "system", origin: "transfer-refused" }, settlement.id, `transfer_refused:${outcome.code ?? "unknown"}`);
  return { next: new Date(now.getTime() + 24 * HOUR), error: outcome.code ?? "refused" };
}

/** A transfer whose answer was lost (or whose worker died): never retried blindly. */
async function resolveUnknownTransfer(deps: PartnerDeps, settlement: SettlementRecord, attempt: TransferAttemptRecord, mayResubmit: boolean): Promise<Step> {
  const gateway = deps.payouts!;
  const now = deps.clock.now();
  const group = await gateway.findTransfersByGroup(settlement.transferGroup);
  const found =
    group.find((t) => t.metadata.repget_operation_id === attempt.operationId) ??
    (group.length === 1 && group[0].destination === settlement.stripeAccountId && group[0].amount === settlement.transferAmount ? group[0] : null);
  if (found) return confirmTransfer(deps, settlement, attempt, found);
  if (group.length > 0) {
    await raiseDiscrepancy(deps, settlement, "unexpected transfers in the settlement's transfer group", { group: group.map((t) => t.id).join(",") });
    return { next: new Date(now.getTime() + 24 * HOUR), error: "transfer_group_discrepancy" };
  }
  const submitted = attempt.submittedAt ?? attempt.updatedAt;
  if (now.getTime() - submitted.getTime() < 23 * HOUR) {
    // Switched off, held or suspended since: look only (above), never send. Past the window it is settled below.
    if (!mayResubmit) return { next: new Date(now.getTime() + HOUR), error: "transfer_unknown_held" };
    // Within Stripe's idempotency window: the SAME request, the SAME key - Stripe returns the original result if there was one.
    const outcome = await gateway.createTransfer({
      destination: settlement.stripeAccountId,
      amount: settlement.transferAmount,
      currency: settlement.currency,
      transferGroup: settlement.transferGroup,
      idempotencyKey: attempt.operationId,
      metadata: { repget_settlement_id: settlement.id, repget_operation_id: attempt.operationId, repget_partner_id: settlement.partnerId },
    });
    return applyTransferOutcome(deps, settlement, attempt, outcome);
  }
  // Past the idempotency window and absent from its transfer group: it was never created.
  await deps.uow.transaction(async (tx) => {
    await tx.settlements.updateTransferAttempt(attempt.id, ["processing", "unknown"], { status: "failed", failureMessage: "Not found at Stripe after the idempotency window", checkedAt: now });
    await tx.settlements.setState(settlement.id, ["transfer_processing", "transfer_unknown"], "reserved", { lastError: "transfer_never_created" });
  });
  return { next: now, error: "transfer_never_created" };
}

/** Stripe confirmed the transfer: settle the liability once, and mark the allocations paid. */
async function confirmTransfer(deps: PartnerDeps, settlement: SettlementRecord, attempt: TransferAttemptRecord, transfer: TransferEvidence): Promise<Step> {
  const now = deps.clock.now();
  const matches =
    transfer.destination === settlement.stripeAccountId &&
    transfer.amount === settlement.transferAmount &&
    transfer.currency === settlement.currency &&
    (transfer.livemode ? "live" : "test") === settlement.environment &&
    (!transfer.metadata.repget_settlement_id || transfer.metadata.repget_settlement_id === settlement.id);
  if (!matches) {
    await raiseDiscrepancy(deps, settlement, "a transfer that does not match its settlement", { transfer: transfer.id, amount: transfer.amount.toString(), destination: transfer.destination ?? "" });
    return { next: new Date(now.getTime() + 24 * HOUR), error: "transfer_mismatch" };
  }
  await deps.uow.transaction(async (tx) => {
    // Lock order: commissions before the settlement, as everywhere else.
    const items = await tx.settlements.items(settlement.id, true);
    const locked = [];
    for (const item of [...items].sort((a, b) => (a.commissionId < b.commissionId ? -1 : 1))) locked.push(await tx.commissions.lockCommission(item.commissionId));
    await tx.settlements.updateTransferAttempt(attempt.id, ["processing", "unknown", "retryable_failure", "failed"], {
      status: "confirmed",
      stripeTransferId: transfer.id,
      stripeBalanceTransactionId: transfer.balanceTransactionId,
      confirmedAt: now,
      checkedAt: now,
    });
    await tx.commissions.appendLedger({
      environment: settlement.environment,
      partnerId: settlement.partnerId,
      currency: settlement.currency,
      kind: "transfer_confirmed",
      amount: -settlement.transferAmount,
      operationKey: `transfer:${transfer.id}`,
      settlementId: settlement.id,
      reason: `Transferred ${Money.of(settlement.transferAmount, settlement.currency).toDecimalString()} ${settlement.currency.toUpperCase()} to the partner's Stripe balance (${transfer.id})`,
      actor: "system",
    });
    await tx.settlements.setState(settlement.id, ["transfer_processing", "transfer_unknown", "reserved", "needs_review"], "transferred", { transferredAt: now, lastError: null });
    for (const commission of locked) {
      if (commission && commission.status === "reserved") {
        await tx.commissions.updateCommission(commission.id, { status: "paid", paidSettlementId: settlement.id });
      }
    }
  });
  await notify(deps, settlement, "transfer");
  return { next: now };
}

export async function raiseDiscrepancy(deps: PartnerDeps, settlement: SettlementRecord, what: string, evidence: Record<string, string>) {
  await deps.uow.transaction(async (tx) => {
    await tx.settlements.setState(settlement.id, ["reserved", "transfer_processing", "transfer_unknown", "transferred", "payout_pending", "payout_in_transit", "payout_failed", "paid"], "needs_review", {
      reviewReason: what,
    });
    await tx.reviews.open({
      kind: "payout_discrepancy",
      dedupeKey: `settlement_discrepancy:${settlement.id}:${what}`,
      environment: settlement.environment,
      partnerId: settlement.partnerId,
      attributionId: null,
      commissionId: null,
      settlementId: settlement.id,
      paymentFactId: null,
      organizationId: null,
      summary: `A partner payout needs a person: ${what}`,
      evidence,
    });
  });
}

/** A short email to the partner. Best effort: it never affects the money. */
export async function notify(deps: PartnerDeps, settlement: SettlementRecord, stage: "transfer" | "paid" | "failed") {
  try {
    const partner = await deps.uow.repositories.partners.findById(settlement.partnerId);
    if (!partner) return;
    const amount = `${Money.of(settlement.transferAmount, settlement.currency).toDecimalString()} ${settlement.currency.toUpperCase()}`;
    const lines = {
      transfer: [`We sent ${amount} to your Stripe balance. Stripe will now pay it to your bank.`],
      paid: [`Stripe paid ${amount} to your bank account.`],
      failed: [`Stripe could not pay ${amount} to your bank. The money is still in your Stripe balance; please check your bank details in Stripe. We will try again.`],
    }[stage];
    await deps.mailer.sendPartnerNotice({
      to: partner.contactEmail,
      name: partner.displayName,
      subject: stage === "failed" ? "Your RepGet payout could not reach your bank" : "Your RepGet partner payout",
      lines,
      portalUrl: `${deps.settings.appUrl()}/partner/payouts`,
    });
  } catch (error) {
    console.error("[partners] payout notice not sent", error);
  }
}
