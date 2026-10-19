import { Money } from "../../domain/value-objects/money";
import { MIN_REASON_LENGTH, type AdminContext } from "../contracts/commands";
import { fail, ok, type Result } from "../contracts/results";
import type { PartnerDeps } from "./deps";
import { rebuildPartnerProjections } from "./mature-commissions";

/**
 * Review cases and attribution decisions - administrators only, with a
 * reason, audited.
 *
 *   resolveReviewCase    closes a case as resolved or dismissed, with what was
 *                        decided. Closing a case changes no money by itself;
 *                        the decision is taken with the actions below.
 *   confirmAttribution   a referral held for review (fraud signal) is
 *                        genuine: it becomes active, and its commissions held
 *                        for review are approved - unless the customer is
 *                        also a credit referral with an open conflict case.
 *   disqualifyAttribution the referral does not count: it earns nothing more,
 *                        and its unpaid commissions are rejected (a ledger
 *                        reversal each). Money already transferred stays
 *                        recorded; recovering it is a transfer reversal.
 *
 * An attribution is never moved to another partner: that would be a
 * disqualification plus a new attribution, decided by a person.
 */

export async function resolveReviewCase(
  deps: PartnerDeps,
  admin: AdminContext,
  input: { caseId: string; outcome: "resolved" | "dismissed"; resolution: string; reason: string },
): Promise<Result<null>> {
  if (input.reason.trim().length < MIN_REASON_LENGTH) return fail("invalid", "reason");
  const resolution = input.resolution.trim().slice(0, 300) || input.outcome;
  return deps.uow.transaction(async (tx) => {
    const reviewCase = await tx.reviews.lock(input.caseId);
    if (!reviewCase) return fail("not_found");
    if (reviewCase.status !== "open") return ok(null);
    await tx.reviews.resolve(reviewCase.id, { status: input.outcome, resolution, reason: input.reason.trim(), by: admin.email, at: deps.clock.now() });
    await tx.audit.record({
      actorEmail: admin.email,
      action: "partner.review_resolved",
      targetType: "partner_review_case",
      targetId: reviewCase.id,
      summary: `${input.outcome === "resolved" ? "Resolved" : "Dismissed"} a partner ${reviewCase.kind.replace(/_/g, " ")} case`,
      detail: { resolution, reason: input.reason.trim() },
    });
    return ok(null);
  });
}

export async function confirmAttribution(deps: PartnerDeps, admin: AdminContext, attributionId: string, reason: string): Promise<Result<{ approved: number }>> {
  if (reason.trim().length < MIN_REASON_LENGTH) return fail("invalid", "reason");
  const result = await deps.uow.transaction(async (tx) => {
    const attribution = await tx.attributions.lock(attributionId);
    if (!attribution) return fail("not_found");
    if (attribution.status === "disqualified") return fail("invalid", "disqualified");
    const now = deps.clock.now();
    await tx.attributions.setStatus(attribution.id, "active", { reason: reason.trim(), by: admin.email, at: now });
    const conflict = await tx.attributions.hasLegacyCreditReferral(attribution.organizationId);
    let approved = 0;
    if (!conflict) {
      const environment = deps.settings.environment();
      if (environment) {
        for (const listed of await commissionsOf(tx, attribution.partnerId, environment, attribution.id)) {
          // Locked and re-read: a settlement may be reserving it concurrently.
          const commission = await tx.commissions.lockCommission(listed.id);
          if (commission && commission.reviewState === "needs_review" && (commission.status === "pending" || commission.status === "available")) {
            await tx.commissions.updateCommission(commission.id, { reviewState: "approved" });
            approved += 1;
          }
        }
      }
    }
    await tx.audit.record({
      actorEmail: admin.email,
      action: "partner.attribution_confirmed",
      targetType: "partner_attribution",
      targetId: attribution.id,
      summary: "Confirmed a partner referral held for review",
      detail: { reason: reason.trim(), approvedCommissions: approved, creditConflict: conflict },
    });
    return ok({ approved, partnerId: attribution.partnerId });
  });
  if (!result.ok) return result;
  await rebuildPartnerProjections(deps, result.value.partnerId);
  return ok({ approved: result.value.approved });
}

export async function disqualifyAttribution(deps: PartnerDeps, admin: AdminContext, attributionId: string, reason: string): Promise<Result<{ rejected: number }>> {
  if (reason.trim().length < MIN_REASON_LENGTH) return fail("invalid", "reason");
  const environment = deps.settings.environment();
  const result = await deps.uow.transaction(async (tx) => {
    const attribution = await tx.attributions.lock(attributionId);
    if (!attribution) return fail("not_found");
    if (attribution.status === "disqualified") return ok({ rejected: 0, partnerId: attribution.partnerId });
    const now = deps.clock.now();
    await tx.attributions.setStatus(attribution.id, "disqualified", { reason: reason.trim(), by: admin.email, at: now });
    let rejected = 0;
    if (environment) {
      for (const listed of await commissionsOf(tx, attribution.partnerId, environment, attribution.id)) {
        const commission = await tx.commissions.lockCommission(listed.id);
        if (!commission || (commission.status !== "pending" && commission.status !== "available")) continue;
        const remaining = commission.amount - commission.reversedAmount;
        if (remaining > BigInt(0)) {
          await tx.commissions.appendLedger({
            environment,
            partnerId: commission.partnerId,
            currency: commission.currency,
            kind: "commission_adjustment",
            amount: -remaining,
            operationKey: `disqualified:${commission.id}`,
            commissionId: commission.id,
            reason: `Referral disqualified: ${Money.of(remaining, commission.currency).toDecimalString()} ${commission.currency.toUpperCase()} not paid`,
            actor: admin.email,
          });
        }
        await tx.commissions.updateCommission(commission.id, { reviewState: "rejected", status: "reversed" });
        rejected += 1;
      }
    }
    await tx.audit.record({
      actorEmail: admin.email,
      action: "partner.attribution_disqualified",
      targetType: "partner_attribution",
      targetId: attribution.id,
      summary: "Disqualified a partner referral",
      detail: { reason: reason.trim(), rejectedCommissions: rejected },
    });
    return ok({ rejected, partnerId: attribution.partnerId });
  });
  if (!result.ok) return result;
  await rebuildPartnerProjections(deps, result.value.partnerId);
  return ok({ rejected: result.value.rejected });
}

async function commissionsOf(
  tx: Parameters<Parameters<PartnerDeps["uow"]["transaction"]>[0]>[0],
  partnerId: string,
  environment: "test" | "live",
  attributionId: string,
) {
  const currencies = new Set((await tx.commissions.balancesToConsider(environment)).filter((p) => p.partnerId === partnerId).map((p) => p.currency));
  const all = [];
  for (const currency of currencies) all.push(...(await tx.commissions.commissionsForPartner(partnerId, environment, currency)));
  return all.filter((commission) => commission.attributionId === attributionId);
}
