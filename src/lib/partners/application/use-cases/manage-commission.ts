import { netPayable, projectedStatus } from "../../domain/entities/commission";
import { Money } from "../../domain/value-objects/money";
import { MIN_REASON_LENGTH, type AdminContext } from "../contracts/commands";
import { fail, ok, type Result } from "../contracts/results";
import type { PartnerDeps } from "./deps";
import { rebuildProjection, snapshotOf } from "./mature-commissions";

/**
 * Administrator decisions on single commissions - always with a reason,
 * always audited, never by editing a past amount:
 *
 *   approve   a commission held for review (credit/cash conflict, fraud
 *             signal) becomes payable when mature
 *   reject    it will not be paid: a `commission_adjustment` reverses what is
 *             left of it in the ledger (a new entry; the original stays)
 *   hold      no settlement takes it until released (a reason is kept)
 *   release   the administrator's hold is lifted (a dispute hold is not -
 *             only the dispute's outcome lifts that)
 *   adjust    a signed correction in the ledger (`manual:<id>`): a negative
 *             one is deducted from upcoming payouts; a positive one may only
 *             cancel an earlier deduction (payouts pay commissions, so a
 *             credit no commission backs would be owed but never paid - it is
 *             refused rather than shown as a balance that cannot arrive). It
 *             changes what is owed, never a commission's recorded calculation
 *
 * A commission that is reserved by a settlement in flight, or already paid,
 * cannot be rejected or held here; a paid one is corrected by adjustment.
 * Partners can do none of this.
 */

const ADMIN_HOLD_PREFIX = "admin:";

export async function approveCommission(deps: PartnerDeps, admin: AdminContext, commissionId: string, reason: string): Promise<Result<null>> {
  if (reason.trim().length < MIN_REASON_LENGTH) return fail("invalid", "reason");
  const result = await deps.uow.transaction(async (tx) => {
    const commission = await tx.commissions.lockCommission(commissionId);
    if (!commission) return fail("not_found");
    if (commission.reviewState === "rejected") return fail("invalid", "rejected");
    if (commission.reviewState === "approved") return ok(commission);
    const status =
      commission.status === "pending" || commission.status === "available"
        ? projectedStatus({ ...snapshotOf(commission), reviewState: "approved" }, deps.clock.now())
        : commission.status;
    await tx.commissions.updateCommission(commission.id, { reviewState: "approved", status });
    await tx.audit.record({
      actorEmail: admin.email,
      action: "partner.commission_approved",
      targetType: "partner_commission",
      targetId: commission.id,
      summary: "Approved a partner commission held for review",
      detail: { reason: reason.trim() },
    });
    return ok(commission);
  });
  if (!result.ok) return result;
  await rebuildProjection(deps, result.value.partnerId, result.value.environment, result.value.currency);
  return ok(null);
}

export async function rejectCommission(deps: PartnerDeps, admin: AdminContext, commissionId: string, reason: string): Promise<Result<null>> {
  if (reason.trim().length < MIN_REASON_LENGTH) return fail("invalid", "reason");
  const result = await deps.uow.transaction(async (tx) => {
    const commission = await tx.commissions.lockCommission(commissionId);
    if (!commission) return fail("not_found");
    if (commission.status === "reserved" || commission.status === "paid") return fail("invalid", `status_${commission.status}`);
    if (commission.reviewState === "rejected") return ok(commission);
    const remaining = commission.amount - commission.reversedAmount;
    if (remaining > BigInt(0)) {
      await tx.commissions.appendLedger({
        environment: commission.environment,
        partnerId: commission.partnerId,
        currency: commission.currency,
        kind: "commission_adjustment",
        amount: -remaining,
        operationKey: `rejected:${commission.id}`,
        commissionId: commission.id,
        reason: `Commission rejected by ${admin.email}: ${reason.trim()}`.slice(0, 500),
        actor: admin.email,
      });
    }
    await tx.commissions.updateCommission(commission.id, { reviewState: "rejected", status: "reversed" });
    await tx.audit.record({
      actorEmail: admin.email,
      action: "partner.commission_rejected",
      targetType: "partner_commission",
      targetId: commission.id,
      summary: `Rejected a partner commission of ${Money.of(remaining, commission.currency).toDecimalString()} ${commission.currency.toUpperCase()}`,
      detail: { reason: reason.trim() },
    });
    return ok(commission);
  });
  if (!result.ok) return result;
  await rebuildProjection(deps, result.value.partnerId, result.value.environment, result.value.currency);
  return ok(null);
}

export async function holdCommission(deps: PartnerDeps, admin: AdminContext, commissionId: string, hold: boolean, reason: string): Promise<Result<null>> {
  if (reason.trim().length < MIN_REASON_LENGTH) return fail("invalid", "reason");
  const result = await deps.uow.transaction(async (tx) => {
    const commission = await tx.commissions.lockCommission(commissionId);
    if (!commission) return fail("not_found");
    if (commission.status === "reserved" || commission.status === "paid") return fail("invalid", `status_${commission.status}`);
    if (!hold && commission.holdReason && !commission.holdReason.startsWith(ADMIN_HOLD_PREFIX)) return fail("invalid", "not_an_admin_hold");
    const holdReason = hold ? `${ADMIN_HOLD_PREFIX}${reason.trim()}`.slice(0, 300) : null;
    await tx.commissions.updateCommission(commission.id, {
      holdReason,
      status: projectedStatus({ ...snapshotOf(commission), holdReason }, deps.clock.now()),
    });
    await tx.audit.record({
      actorEmail: admin.email,
      action: hold ? "partner.commission_held" : "partner.commission_released",
      targetType: "partner_commission",
      targetId: commission.id,
      summary: hold ? "Held a partner commission" : "Released a partner commission hold",
      detail: { reason: reason.trim() },
    });
    return ok(commission);
  });
  if (!result.ok) return result;
  await rebuildProjection(deps, result.value.partnerId, result.value.environment, result.value.currency);
  return ok(null);
}

export async function adjustPartnerBalance(
  deps: PartnerDeps,
  admin: AdminContext,
  input: { partnerId: string; currency: string; amount: bigint; reason: string; commissionId?: string | null },
): Promise<Result<null>> {
  if (input.reason.trim().length < MIN_REASON_LENGTH) return fail("invalid", "reason");
  if (input.amount === BigInt(0)) return fail("invalid", "amount");
  const environment = deps.settings.environment();
  if (!environment) return fail("disabled", "stripe_not_configured");
  const amount = Money.of(input.amount, input.currency);
  const result = await deps.uow.transaction(async (tx) => {
    const partner = await tx.partners.lock(input.partnerId);
    if (!partner) return fail("not_found");
    if (amount.isPositive()) {
      // Held under the partner lock, which every settlement also takes first.
      const ledger = await tx.commissions.ledgerSum(partner.id, environment, amount.code);
      const unpaid = (await tx.commissions.commissionsForPartner(partner.id, environment, amount.code))
        .filter((commission) => commission.status !== "paid")
        .reduce((sum, commission) => sum.add(netPayable(snapshotOf(commission))), Money.zero(amount.code));
      if (ledger.liability + amount.amount > unpaid.amount) return fail("invalid", "unbacked_credit");
    }
    await tx.commissions.appendLedger({
      environment,
      partnerId: partner.id,
      currency: amount.code,
      kind: "commission_adjustment",
      amount: amount.amount,
      operationKey: `manual:${deps.random.uuid()}`,
      commissionId: input.commissionId ?? null,
      reason: `Adjustment by ${admin.email}: ${input.reason.trim()}`.slice(0, 500),
      actor: admin.email,
    });
    await tx.audit.record({
      actorEmail: admin.email,
      action: "partner.commission_adjusted",
      targetType: "partner",
      targetId: partner.id,
      summary: `Adjusted a partner balance by ${amount.toDecimalString()} ${amount.code.toUpperCase()}`,
      detail: { reason: input.reason.trim(), commissionId: input.commissionId ?? null },
    });
    return ok(partner);
  });
  if (!result.ok) return result;
  await rebuildProjection(deps, input.partnerId, environment, amount.code);
  return ok(null);
}
