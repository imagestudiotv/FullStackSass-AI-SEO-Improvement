import { isPayable, netPayable } from "../../domain/entities/commission";
import { Money } from "../../domain/value-objects/money";
import type { CommissionRecord, Environment } from "../ports/repositories";
import type { PartnerDeps } from "./deps";

/**
 * Net 30 and the balance projection.
 *
 * matureCommissions marks pending commissions that have waited their 30 days
 * (and are approved and unheld) as available, for display - the monthly
 * settlement re-checks every condition under its own lock anyway.
 *
 * rebuildProjection recomputes a partner's per-currency balances from the
 * immutable ledger and the commissions. It is a projection for dashboards
 * and the row settlements lock; it is never the source of truth, and the
 * reconciliation compares it with a fresh computation.
 */

const ZERO = BigInt(0);

export function snapshotOf(commission: CommissionRecord) {
  return {
    id: commission.id,
    status: commission.status,
    reviewState: commission.reviewState,
    holdReason: commission.holdReason,
    amount: Money.of(commission.amount, commission.currency),
    reversedAmount: Money.of(commission.reversedAmount, commission.currency),
    maturesAt: commission.maturesAt,
  };
}

export async function matureCommissions(deps: PartnerDeps) {
  const environment = deps.settings.environment();
  if (!environment) return { matured: 0 };
  const now = deps.clock.now();
  const ids = await deps.uow.repositories.commissions.pendingMaturity(environment, now);
  let matured = 0;
  const touched = new Set<string>();
  for (const id of ids) {
    const changed = await deps.uow.transaction(async (repos) => {
      const commission = await repos.commissions.lockCommission(id);
      if (!commission || commission.status !== "pending") return null;
      if (!isPayable(snapshotOf(commission), now)) return null;
      await repos.commissions.updateCommission(id, { status: "available" });
      return commission;
    });
    if (changed) {
      matured += 1;
      touched.add(`${changed.partnerId}|${changed.currency}`);
    }
  }
  for (const key of touched) {
    const [partnerId, currency] = key.split("|");
    await rebuildProjection(deps, partnerId, environment, currency);
  }
  return { matured };
}

export type BalanceFigures = {
  netEarned: bigint;
  netTransferred: bigint;
  liability: bigint;
  pending: bigint;
  available: bigint;
  reserved: bigint;
  held: bigint;
  bankPaid: bigint;
};

/** The balances as they follow from the records, without writing anything. */
export async function computeBalances(deps: PartnerDeps, partnerId: string, environment: Environment, currency: string): Promise<BalanceFigures> {
  const repos = deps.uow.repositories;
  const now = deps.clock.now();
  const [ledger, commissions, bankPaid] = await Promise.all([
    repos.commissions.ledgerSum(partnerId, environment, currency),
    repos.commissions.commissionsForPartner(partnerId, environment, currency),
    repos.settlements.bankPaidTotal(partnerId, environment, currency),
  ]);
  let pending = ZERO;
  let available = ZERO;
  let reserved = ZERO;
  let held = ZERO;
  for (const commission of commissions) {
    const net = netPayable(snapshotOf(commission)).amount;
    if (net === ZERO) continue;
    if (commission.status === "reserved") reserved += net;
    else if (commission.status === "paid") continue;
    else if (commission.holdReason || commission.reviewState !== "approved") held += net;
    else if (isPayable(snapshotOf(commission), now)) available += net;
    else pending += net;
  }
  return { netEarned: ledger.netEarned, netTransferred: ledger.netTransferred, liability: ledger.liability, pending, available, reserved, held, bankPaid };
}

export async function rebuildProjection(deps: PartnerDeps, partnerId: string, environment: Environment, currency: string) {
  const figures = await computeBalances(deps, partnerId, environment, currency);
  await deps.uow.repositories.settlements.writeProjection(partnerId, environment, currency, { ...figures, rebuiltAt: deps.clock.now() });
  return figures;
}

/** Every currency a partner has records in, rebuilt. */
export async function rebuildPartnerProjections(deps: PartnerDeps, partnerId: string) {
  const environment = deps.settings.environment();
  if (!environment) return;
  const pairs = await deps.uow.repositories.commissions.balancesToConsider(environment);
  for (const pair of pairs.filter((p) => p.partnerId === partnerId)) {
    await rebuildProjection(deps, partnerId, environment, pair.currency);
  }
}
