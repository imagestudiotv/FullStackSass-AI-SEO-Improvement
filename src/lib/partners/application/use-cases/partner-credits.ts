import { canReceiveAutomaticPayout } from "../../domain/entities/partner";
import { Money } from "../../domain/value-objects/money";
import { fail, ok, type Result } from "../contracts/results";
import type { CreditPack, Environment } from "../ports/repositories";
import type { PartnerDeps } from "./deps";
import { rebuildProjection } from "./mature-commissions";
import { plan } from "./prepare-settlement";

/**
 * Partners paid in RepGet CREDITS (owner's decisions, 2026-11-07):
 *
 *   form      "credits now, cash later" - PARTNER_PAYOUT_FORM, credits by default;
 *             the cash methods (Stripe Connect, PayPal) stay built, and off.
 *   rate      the smallest credit pack's price - EUR 79.00 for 100 credits
 *             today, read when converting and recorded on each grant, so a
 *             later price change never re-prices what was granted.
 *   where     a workspace the partner OWNS, chosen by the partner.
 *   when      each commission once it is 30 days old (its normal maturity),
 *             with no minimum: a frequent run converts whatever has matured.
 *
 * WHAT IS THE SAME AS CASH. The same ledger and plan (prepare-settlement.ts
 * `plan`, with no threshold): mature, approved, unheld commissions, net of
 * reversals, after any deduction the partner owes from a refund AFTER an
 * earlier conversion - that is how a later refund "reduces future credits";
 * credits already spent are never taken back. A settlement records it
 * (payout_method 'credits'), with one `transfer_confirmed` ledger entry, so
 * the same commission is never converted twice or also paid in cash.
 *
 * ALL IN ONE TRANSACTION, no provider call: the settlement, the ledger entry,
 * the commissions marked paid, the grant row and the workspace's credit
 * ledger entry (keyed) commit together or not at all.
 *
 * FRACTIONS ARE NEVER LOST: a conversion's credits are the whole credits of
 * everything converted so far at this rate, less those already granted at it.
 */

export function creditsForTotal(totalMinor: bigint, pack: Pick<CreditPack, "priceCents" | "credits">): number {
  return Number((totalMinor * BigInt(pack.credits)) / BigInt(pack.priceCents));
}

/** The partner picks one of the workspaces they own; checked here, never trusted from the browser. */
export async function chooseCreditWorkspace(deps: PartnerDeps, input: { partnerId: string; organizationId: string }): Promise<Result<null>> {
  const repos = deps.uow.repositories;
  const partner = await repos.partners.findById(input.partnerId);
  if (!partner || partner.status !== "active" || !partner.userId) return fail("forbidden");
  const owned = await repos.credits.ownedWorkspaces(partner.userId);
  if (!owned.some((workspace) => workspace.id === input.organizationId)) return fail("forbidden", "not_owner");
  await repos.credits.setCreditWorkspace(partner.id, input.organizationId, deps.clock.now());
  return ok(null);
}

export type CreditConversion =
  | { kind: "converted"; settlementId: string; amount: bigint; credits: number }
  | { kind: "skipped"; reason: string };

/** Converts one partner's matured commissions in one currency. Safe to repeat: what is converted is reserved. */
export async function convertPartnerCommissions(deps: PartnerDeps, input: { partnerId: string; currency: string }): Promise<CreditConversion> {
  const environment = deps.settings.environment();
  if (!environment) return { kind: "skipped", reason: "not_configured" };
  if ((deps.settings.payoutForm?.() ?? "cash") !== "credits") return { kind: "skipped", reason: "cash_form" };
  const repos = deps.uow.repositories;
  if (!(await repos.controls.isEnabled("partner_payouts"))) return { kind: "skipped", reason: "payouts_disabled" };
  const organizationId = await repos.credits.creditWorkspaceOf(input.partnerId);
  if (!organizationId) return { kind: "skipped", reason: "no_credit_workspace" };
  const pack = await repos.credits.smallestPack();
  if (!pack) return { kind: "skipped", reason: "no_credit_pack" };
  // The rate is in the pack's currency; a commission in another currency is never converted at a guessed rate.
  if (pack.currency !== input.currency) return { kind: "skipped", reason: "currency_without_rate" };

  const outcome = await deps.uow.transaction(async (tx): Promise<CreditConversion> => {
    const partner = await tx.partners.lock(input.partnerId);
    if (!partner) return { kind: "skipped", reason: "not_found" };
    if (!canReceiveAutomaticPayout(partner)) return { kind: "skipped", reason: partner.status === "active" ? "payout_hold" : "partner_suspended" };
    // The workspace must still be the partner's own.
    if (!partner.userId || !(await tx.credits.ownedWorkspaces(partner.userId)).some((w) => w.id === organizationId)) {
      return { kind: "skipped", reason: "workspace_not_owned" };
    }
    const now = deps.clock.now();
    await tx.settlements.lockBalance(input.partnerId, environment, input.currency, now);
    const { plan: decided } = await plan(tx, deps, input.partnerId, environment, input.currency, { threshold: Money.zero(input.currency) });
    if (decided.kind === "carry_forward") return { kind: "skipped", reason: decided.reason };

    const settlement = await tx.settlements.create({
      environment,
      partnerId: input.partnerId,
      currency: input.currency,
      runKey: `credits:${deps.random.uuid()}`,
      grossAmount: decided.gross.amount,
      offsetAmount: decided.offset.amount,
      transferAmount: decided.transferAmount.amount,
      payoutMethod: "credits",
      stripeAccountId: null,
      paypalAccountId: null,
      transferGroup: `repget-partner-credits-${deps.random.uuid()}`,
      createdBy: "system:partner-credits",
      items: decided.allocations.map((allocation) => ({ commissionId: allocation.commissionId, amount: allocation.amount.amount })),
      now,
    });
    if (!settlement) return { kind: "skipped", reason: "already_settled" };

    const before = await tx.credits.grantedAtRate(input.partnerId, environment, input.currency, pack.priceCents, pack.credits);
    const credits = creditsForTotal(before.amount + settlement.transferAmount, pack) - before.credits;
    const ledgerKey = `partner-credits:${settlement.id}`;

    await tx.commissions.appendLedger({
      environment,
      partnerId: input.partnerId,
      currency: input.currency,
      kind: "transfer_confirmed",
      amount: -settlement.transferAmount,
      operationKey: `credits:${settlement.id}`,
      settlementId: settlement.id,
      reason: `Paid ${Money.of(settlement.transferAmount, input.currency).toDecimalString()} ${input.currency.toUpperCase()} as ${credits} RepGet credits (${pack.credits} for ${Money.of(pack.priceCents, input.currency).toDecimalString()})`,
      actor: "system",
    });
    await tx.settlements.setState(settlement.id, ["reserved"], "transferred", { transferredAt: now });
    await tx.settlements.setState(settlement.id, ["transferred"], "paid", { paidAt: now });
    for (const allocation of decided.allocations) {
      await tx.commissions.updateCommission(allocation.commissionId, { status: "paid", paidSettlementId: settlement.id });
    }
    await tx.credits.recordGrant({
      settlementId: settlement.id,
      partnerId: input.partnerId,
      environment,
      organizationId,
      currency: input.currency,
      amount: settlement.transferAmount,
      credits,
      packCents: pack.priceCents,
      packCredits: pack.credits,
      ledgerKey,
      now,
    });
    await tx.credits.grantCredits({ organizationId, credits, ledgerKey, settlementId: settlement.id, note: "Partner commission, paid as credits" });
    return { kind: "converted", settlementId: settlement.id, amount: settlement.transferAmount, credits };
  });

  if (outcome.kind === "converted") await rebuildProjection(deps, input.partnerId, environment, input.currency);
  return outcome;
}

/** The frequent run (the partner commissions sweep): every partner and currency with a balance. */
export async function convertMaturedCommissions(deps: PartnerDeps): Promise<{ converted: number; credits: number }> {
  const environment = deps.settings.environment();
  if (!environment || (deps.settings.payoutForm?.() ?? "cash") !== "credits") return { converted: 0, credits: 0 };
  const pairs = await deps.uow.repositories.commissions.balancesToConsider(environment);
  let converted = 0;
  let credits = 0;
  for (const pair of pairs) {
    try {
      const result = await convertPartnerCommissions(deps, pair);
      if (result.kind === "converted") {
        converted += 1;
        credits += result.credits;
      }
    } catch (error) {
      console.error(`[partners] could not convert ${pair.partnerId}'s ${pair.currency} commissions to credits; the next run tries again`, error);
    }
  }
  return { converted, credits };
}

export type { Environment };
