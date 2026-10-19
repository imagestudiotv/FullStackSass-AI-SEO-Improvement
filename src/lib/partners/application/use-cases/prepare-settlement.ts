import { canReceiveAutomaticPayout } from "../../domain/entities/partner";
import { isPayable, netPayable } from "../../domain/entities/commission";
import { monthlyRunKey, planSettlement, type SettlementPlan } from "../../domain/policies/maturity";
import { payoutThreshold } from "../../domain/policies/program";
import { Money } from "../../domain/value-objects/money";
import type { AdminContext, SystemContext } from "../contracts/commands";
import { fail, ok, type Result } from "../contracts/results";
import type { Environment } from "../ports/repositories";
import type { PartnerRepositories } from "../ports/unit-of-work";
import type { PartnerDeps } from "./deps";
import { rebuildProjection, snapshotOf } from "./mature-commissions";

/**
 * The monthly payout run: which mature money each partner is paid.
 *
 * In ONE short transaction, holding the partner's row lock and then the
 * partner/currency balance row (the serialisation point every settlement
 * for that balance passes through): re-check the partner (active, no payout
 * hold), lock the unpaid commissions, compute the plan from the immutable
 * ledger (domain/policies/maturity.ts), reserve the exact allocations, and
 * record the job that executes it. A unique index allows one settlement per
 * partner, currency and run, and one whose transfer is not yet settled.
 *
 * Nothing here calls Stripe: execution (execute-transfer.ts) happens after
 * commit, and re-checks everything again before any money moves.
 */

export type SettlementOutcome =
  | { kind: "created"; settlementId: string; transferAmount: bigint; offset: bigint }
  | { kind: "carried_forward"; reason: string; payable: bigint }
  | { kind: "skipped"; reason: string };

export function settlementJobId(settlementId: string): string {
  return `partners/settlement:${settlementId}`;
}

async function plan(repos: PartnerRepositories, deps: PartnerDeps, partnerId: string, environment: Environment, currency: string) {
  const now = deps.clock.now();
  const version = await repos.programs.versionAt(now);
  const candidates = await repos.commissions.lockPayableCandidates(partnerId, environment, currency);
  const ledger = await repos.commissions.ledgerSum(partnerId, environment, currency);
  const reserved = await repos.settlements.reservedInFlight(partnerId, environment, currency);
  const snapshots = candidates.map(snapshotOf);
  const notYetPayable = snapshots
    .filter((commission) => !isPayable(commission, now))
    .reduce((sum, commission) => sum.add(netPayable(commission)), Money.zero(currency));
  return {
    plan: planSettlement({
      currency,
      candidates: snapshots,
      liability: Money.of(ledger.liability, currency),
      notYetPayable,
      reservedInFlight: Money.of(reserved, currency),
      threshold: payoutThreshold(version.policy, currency),
      now,
    }),
    ledger,
  };
}

/** Read-only: what a run would pay right now. For the admin preview. */
export async function previewSettlement(deps: PartnerDeps, partnerId: string, currency: string): Promise<SettlementPlan | null> {
  const environment = deps.settings.environment();
  if (!environment) return null;
  return deps.uow.transaction(async (repos) => (await plan(repos, deps, partnerId, environment, currency)).plan);
}

export async function prepareSettlement(
  deps: PartnerDeps,
  actor: SystemContext | AdminContext,
  input: { partnerId: string; currency: string; runKey: string },
): Promise<SettlementOutcome> {
  const environment = deps.settings.environment();
  if (!environment) return { kind: "skipped", reason: "stripe_not_configured" };
  const repos = deps.uow.repositories;
  if (!(await repos.controls.isEnabled("partner_payouts"))) return { kind: "skipped", reason: "payouts_disabled" };
  if (!deps.settings.moneyMovementAllowed(environment)) return { kind: "skipped", reason: "money_movement_blocked" };
  const account = await repos.stripeAccounts.find(input.partnerId, environment);
  if (!account?.stripeAccountId || account.status !== "ready") return { kind: "skipped", reason: "onboarding_incomplete" };

  const outcome = await deps.uow.transaction(async (tx): Promise<SettlementOutcome> => {
    const partner = await tx.partners.lock(input.partnerId);
    if (!partner) return { kind: "skipped", reason: "not_found" };
    if (!canReceiveAutomaticPayout(partner)) return { kind: "skipped", reason: partner.status === "active" ? "payout_hold" : "partner_suspended" };
    const now = deps.clock.now();
    await tx.settlements.lockBalance(input.partnerId, environment, input.currency, now);
    const { plan: decided } = await plan(tx, deps, input.partnerId, environment, input.currency);
    if (decided.kind === "carry_forward") return { kind: "carried_forward", reason: decided.reason, payable: decided.payable.amount };

    const settlement = await tx.settlements.create({
      environment,
      partnerId: input.partnerId,
      currency: input.currency,
      runKey: input.runKey,
      grossAmount: decided.gross.amount,
      offsetAmount: decided.offset.amount,
      transferAmount: decided.transferAmount.amount,
      stripeAccountId: account.stripeAccountId!,
      transferGroup: `repget-partner-settlement-${deps.random.uuid()}`,
      createdBy: actor.kind === "admin" ? actor.email : `system:${actor.origin}`,
      items: decided.allocations.map((allocation) => ({ commissionId: allocation.commissionId, amount: allocation.amount.amount })),
      now,
    });
    if (!settlement) return { kind: "skipped", reason: "already_settled" };
    for (const allocation of decided.allocations) {
      await tx.commissions.updateCommission(allocation.commissionId, { status: "reserved" });
    }
    await tx.outbox.enqueue({ name: "partners/settlement.execute", id: settlementJobId(settlement.id), data: { settlementId: settlement.id } });
    if (actor.kind === "admin") {
      await tx.audit.record({
        actorEmail: actor.email,
        action: "partner.settlement_created",
        targetType: "partner_settlement",
        targetId: settlement.id,
        summary: `Prepared a payout of ${decided.transferAmount.toDecimalString()} ${input.currency.toUpperCase()} for ${partner.contactEmail}`,
        detail: { runKey: input.runKey, gross: decided.gross.amount.toString(), offset: decided.offset.amount.toString() },
      });
    }
    return { kind: "created", settlementId: settlement.id, transferAmount: decided.transferAmount.amount, offset: decided.offset.amount };
  });
  await rebuildProjection(deps, input.partnerId, environment, input.currency);
  return outcome;
}

/** The monthly run (1st of the month, 00:00 UTC): every partner and currency with a balance. */
export async function runMonthlySettlements(deps: PartnerDeps, actor: SystemContext | AdminContext = { kind: "system", origin: "monthly-run" }) {
  const environment = deps.settings.environment();
  if (!environment) return { runKey: null, results: [] as { partnerId: string; currency: string; outcome: SettlementOutcome }[] };
  const runKey = monthlyRunKey(deps.clock.now());
  const pairs = await deps.uow.repositories.commissions.balancesToConsider(environment);
  const results: { partnerId: string; currency: string; outcome: SettlementOutcome }[] = [];
  for (const pair of pairs) {
    results.push({ ...pair, outcome: await prepareSettlement(deps, actor, { partnerId: pair.partnerId, currency: pair.currency, runKey }) });
  }
  return { runKey, results };
}

/**
 * Cancels a settlement that has NOT been submitted to Stripe, releasing its
 * reservations. A transfer that was sent, or whose outcome is unknown, is
 * never cancelled this way: money may have moved.
 */
export async function cancelSettlement(
  deps: PartnerDeps,
  actor: SystemContext | AdminContext,
  settlementId: string,
  reason: string,
): Promise<Result<null>> {
  const environment = deps.settings.environment();
  const result = await deps.uow.transaction(async (tx): Promise<Result<{ partnerId: string; currency: string }>> => {
    const settlement = await tx.settlements.lock(settlementId);
    if (!settlement) return fail("not_found");
    if (settlement.state === "canceled") return ok({ partnerId: settlement.partnerId, currency: settlement.currency });
    if (settlement.state !== "reserved") return fail("invalid", `state_${settlement.state}`);
    const attempts = await tx.settlements.transferAttempts(settlementId);
    if (attempts.some((attempt) => !["retryable_failure", "failed"].includes(attempt.status))) return fail("invalid", "transfer_may_exist");
    await tx.settlements.setState(settlementId, ["reserved"], "canceled", { canceledReason: reason.slice(0, 300) });
    const items = await tx.settlements.items(settlementId, true);
    await tx.settlements.deactivateItems(settlementId);
    for (const item of items) {
      const commission = await tx.commissions.lockCommission(item.commissionId);
      if (commission?.status === "reserved") {
        await tx.commissions.updateCommission(commission.id, {
          status: isPayable({ ...snapshotOf(commission), status: "available" }, deps.clock.now()) ? "available" : "pending",
        });
      }
    }
    if (actor.kind === "admin") {
      await tx.audit.record({
        actorEmail: actor.email,
        action: "partner.settlement_canceled",
        targetType: "partner_settlement",
        targetId: settlementId,
        summary: "Cancelled a partner payout before anything was sent to Stripe",
        detail: { reason },
      });
    }
    return ok({ partnerId: settlement.partnerId, currency: settlement.currency });
  });
  if (!result.ok) return result;
  if (environment) await rebuildProjection(deps, result.value.partnerId, environment, result.value.currency);
  return ok(null);
}
