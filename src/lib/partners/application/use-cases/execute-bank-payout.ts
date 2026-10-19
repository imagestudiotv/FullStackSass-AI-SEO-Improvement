import { bankPayoutStatusFromStripe, type BankPayoutStatus } from "../../domain/entities/settlement";
import type { PayoutEvidence } from "../ports/payout-gateway";
import type { BankPayoutAttemptRecord, SettlementRecord } from "../ports/repositories";
import type { PartnerDeps } from "./deps";
import { notify, raiseDiscrepancy } from "./execute-transfer";
import { rebuildProjection } from "./mature-commissions";

/**
 * Stage 3, the BANK PAYOUT: the partner's connected Stripe balance to their
 * bank, as a Stripe Payout created ON the connected account (its schedule is
 * manual, so nothing else pays it out).
 *
 * The transfer that funded it is already confirmed and the commission
 * liability settled; this stage never touches the ledger, and nothing here
 * can cause a second transfer. A failed or cancelled bank payout leaves the
 * money in (or returns it to) the partner's connected balance: the stage is
 * retried as a NEW bank payout attempt (a new operation id), never as a new
 * transfer. An answer that was lost is reconciled by listing the account's
 * payouts for the operation id before anything is retried. Status changes
 * arrive from verified Connect payout.* events and from polling; only Stripe
 * saying "paid" marks the bank stage paid.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const LIVE: BankPayoutStatus[] = ["unknown", "pending", "in_transit", "paid"];

export function payoutOperationId(settlementId: string, attempt: number): string {
  return `partner-payout:${settlementId}:${attempt}`;
}

type Step = { next: Date; error?: string };

export async function payoutStage(deps: PartnerDeps, settlement: SettlementRecord): Promise<Step> {
  const gateway = deps.payouts;
  const now = deps.clock.now();
  if (!gateway) return { next: new Date(now.getTime() + 6 * HOUR), error: "stripe_not_configured" };
  const repos = deps.uow.repositories;
  const attempts = await repos.settlements.payoutAttempts(settlement.id);
  const live = attempts.find((a) => LIVE.includes(a.status));

  if (live) {
    if (live.stripePayoutId) {
      const evidence = await gateway.retrievePayout(live.stripeAccountId, live.stripePayoutId);
      return applyPayoutEvidence(deps, settlement, live, evidence);
    }
    // The create call's answer was lost: find it on the account before anything else.
    const since = new Date((live.submittedAt ?? live.updatedAt).getTime() - 5 * MINUTE);
    const found = (await gateway.listPayouts(live.stripeAccountId, since)).find((p) => p.metadata.repget_operation_id === live.operationId);
    if (found) return applyPayoutEvidence(deps, settlement, live, found);
    if (now.getTime() - (live.submittedAt ?? live.updatedAt).getTime() < 23 * HOUR) {
      const outcome = await gateway.createBankPayout({
        accountId: live.stripeAccountId,
        amount: live.amount,
        currency: live.currency,
        idempotencyKey: live.operationId,
        metadata: { repget_settlement_id: settlement.id, repget_operation_id: live.operationId },
      });
      return applyCreateOutcome(deps, settlement, live, outcome);
    }
    await repos.settlements.updatePayoutAttempt(live.id, ["unknown"], { status: "failed", failureMessage: "Not found at Stripe after the idempotency window", failedAt: now, checkedAt: now });
    await repos.settlements.setState(settlement.id, ["payout_pending"], "payout_failed", { lastError: "payout_never_created" });
    return { next: now, error: "payout_never_created" };
  }

  if (settlement.state === "paid") return { next: new Date(now.getTime() + 24 * HOUR) };

  // ---- a new bank payout: the transfer is confirmed; the money is the partner's ----
  if (!(await repos.controls.isEnabled("partner_payouts")) || !deps.settings.moneyMovementAllowed(settlement.environment)) {
    return { next: new Date(now.getTime() + 6 * HOUR), error: "payouts_paused" };
  }
  const failures = attempts.filter((a) => a.status === "failed" || a.status === "canceled").length;
  if (failures >= 3) {
    await raiseDiscrepancy(deps, settlement, "bank payout failed three times", { attempts: String(attempts.length) });
    return { next: new Date(now.getTime() + 24 * HOUR), error: "payout_failed_repeatedly" };
  }
  const balance = await gateway.connectedAvailableBalance(settlement.stripeAccountId, settlement.currency);
  if (balance < settlement.transferAmount) {
    // Transfers to some accounts become available later (recipient accounts: +24h).
    return { next: new Date(now.getTime() + 6 * HOUR), error: "connected_balance_pending" };
  }

  const number = attempts.length + 1;
  const operationId = payoutOperationId(settlement.id, number);
  const attempt = await deps.uow.transaction(async (tx) => {
    const created = await tx.settlements.createPayoutAttempt({
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
    await tx.settlements.setState(settlement.id, ["transferred", "payout_failed"], "payout_pending", { lastError: null });
    return created;
  });
  if (!attempt) return { next: new Date(now.getTime() + 5 * MINUTE), error: "payout_attempt_exists" };
  const outcome = await gateway.createBankPayout({
    accountId: settlement.stripeAccountId,
    amount: settlement.transferAmount,
    currency: settlement.currency,
    idempotencyKey: operationId,
    metadata: { repget_settlement_id: settlement.id, repget_operation_id: operationId },
  });
  return applyCreateOutcome(deps, settlement, attempt, outcome);
}

async function applyCreateOutcome(
  deps: PartnerDeps,
  settlement: SettlementRecord,
  attempt: BankPayoutAttemptRecord,
  outcome: Awaited<ReturnType<NonNullable<PartnerDeps["payouts"]>["createBankPayout"]>>,
): Promise<Step> {
  const now = deps.clock.now();
  if (outcome.kind === "succeeded") return applyPayoutEvidence(deps, settlement, attempt, outcome.value);
  if (outcome.kind === "unknown") return { next: new Date(now.getTime() + 10 * MINUTE), error: "payout_outcome_unknown" };
  await deps.uow.transaction(async (tx) => {
    await tx.settlements.updatePayoutAttempt(attempt.id, ["unknown"], { status: "failed", failureCode: outcome.code, failureMessage: outcome.message, failedAt: now, checkedAt: now });
    await tx.settlements.setState(settlement.id, ["payout_pending"], "payout_failed", { lastError: outcome.code ?? "payout_refused" });
  });
  return { next: new Date(now.getTime() + 24 * HOUR), error: outcome.code ?? "payout_refused" };
}

/** What Stripe says about one of OUR bank payouts, applied to its attempt and its settlement. */
export async function applyPayoutEvidence(
  deps: PartnerDeps,
  settlement: SettlementRecord,
  attempt: BankPayoutAttemptRecord,
  payout: PayoutEvidence,
): Promise<Step> {
  const now = deps.clock.now();
  const ours =
    payout.accountId === attempt.stripeAccountId &&
    payout.amount === attempt.amount &&
    payout.currency === attempt.currency &&
    (payout.livemode ? "live" : "test") === attempt.environment &&
    (!payout.metadata.repget_operation_id || payout.metadata.repget_operation_id === attempt.operationId);
  if (!ours) {
    await raiseDiscrepancy(deps, settlement, "a bank payout that does not match its settlement", { payout: payout.id, amount: payout.amount.toString() });
    return { next: new Date(now.getTime() + 24 * HOUR), error: "payout_mismatch" };
  }
  const status = bankPayoutStatusFromStripe(payout.status);
  if (!status) return { next: new Date(now.getTime() + HOUR), error: `payout_status_${payout.status}` };

  let next = new Date(now.getTime() + 6 * HOUR);
  let notice: "paid" | "failed" | null = null;
  await deps.uow.transaction(async (tx) => {
    const changed = await tx.settlements.updatePayoutAttempt(attempt.id, attempt.status === status ? [status] : ["unknown", "pending", "in_transit", "paid"], {
      status,
      stripePayoutId: payout.id,
      arrivalDate: payout.arrivalDate,
      failureCode: payout.failureCode,
      failureMessage: payout.failureMessage,
      ...(status === "paid" ? { paidAt: now } : {}),
      ...(status === "failed" || status === "canceled" ? { failedAt: now } : {}),
      checkedAt: now,
    });
    if (!changed && attempt.status !== status) return;
    if (status === "paid") {
      if (await tx.settlements.setState(settlement.id, ["payout_pending", "payout_in_transit", "transferred"], "paid", { paidAt: now, lastError: null })) notice = "paid";
      next = new Date(now.getTime() + 24 * HOUR);
    } else if (status === "in_transit") {
      await tx.settlements.setState(settlement.id, ["payout_pending", "transferred"], "payout_in_transit");
    } else if (status === "pending") {
      await tx.settlements.setState(settlement.id, ["transferred"], "payout_pending");
      next = new Date(now.getTime() + HOUR);
    } else {
      // failed or canceled - including a "paid" payout the bank returned later.
      if (await tx.settlements.setState(settlement.id, ["payout_pending", "payout_in_transit", "paid", "transferred"], "payout_failed", { lastError: payout.failureCode ?? status })) notice = "failed";
      next = new Date(now.getTime() + 24 * HOUR);
    }
  });
  if (notice) await notify(deps, settlement, notice);
  return { next };
}

/**
 * A verified Connect payout.* event. Only the account and payout ids are
 * taken: the payout is read from Stripe. A payout RepGet did not create
 * changes nothing (an unrelated payout can never mark commissions paid); an
 * automatic one - which the manual schedule should prevent - is a review case.
 */
export async function applyPayoutEvent(deps: PartnerDeps, input: { accountId: string; payoutId: string; livemode: boolean }) {
  const gateway = deps.payouts;
  if (!gateway) return "disabled";
  const environment = deps.settings.environment();
  if ((input.livemode ? "live" : "test") !== environment) return "wrong_environment";
  const repos = deps.uow.repositories;
  const account = await repos.stripeAccounts.findByStripeId(input.accountId);
  if (!account || account.environment !== environment) return "not_a_partner_account";
  const attempt = await repos.settlements.findPayoutAttemptByStripeId(input.accountId, input.payoutId);
  const payout = await gateway.retrievePayout(input.accountId, input.payoutId);
  if (!attempt) {
    const matched = payout.metadata.repget_operation_id
      ? (await repos.settlements.list({ environment, partnerId: account.partnerId, offset: 0, limit: 50 })).rows
      : [];
    for (const settlement of matched) {
      const candidate = (await repos.settlements.payoutAttempts(settlement.id)).find((a) => a.operationId === payout.metadata.repget_operation_id);
      if (candidate) {
        await applyPayoutEvidence(deps, settlement, candidate, payout);
        return "applied";
      }
    }
    await repos.reviews.open({
      kind: "unexpected_payout",
      dedupeKey: `unexpected_payout:${input.payoutId}`,
      environment,
      partnerId: account.partnerId,
      attributionId: null,
      commissionId: null,
      settlementId: null,
      paymentFactId: null,
      organizationId: null,
      summary: `A ${payout.automatic ? "automatic" : "manual"} payout RepGet did not create was made from a partner's Stripe balance`,
      evidence: { payout: payout.id, amount: payout.amount.toString(), currency: payout.currency, status: payout.status },
    });
    return "not_ours";
  }
  const settlement = await repos.settlements.findById(attempt.settlementId);
  if (!settlement) return "not_found";
  await applyPayoutEvidence(deps, settlement, attempt, payout);
  await rebuildProjection(deps, settlement.partnerId, settlement.environment, settlement.currency);
  return "applied";
}
