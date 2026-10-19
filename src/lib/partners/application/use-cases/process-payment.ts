import { InconsistentFinancialDataError, UnsupportedCurrencyError } from "../../domain/errors";
import { commissionFor, eligibleBases, type CollectionBase } from "../../domain/policies/commission";
import { eligibilityWindow, isWithinWindow } from "../../domain/policies/eligibility";
import { maturesAt } from "../../domain/policies/maturity";
import { tierAt, tierForCount } from "../../domain/policies/tiers";
import { CommissionRate } from "../../domain/value-objects/commission-rate";
import type { NormalizedCharge, NormalizedCollection, NormalizedInvoice } from "../ports/billing-source";
import type { AttributionRecord, CouponRecord, Environment } from "../ports/repositories";
import type { PartnerRepositories } from "../ports/unit-of-work";
import { attributeByCoupon, eligibilityForOrganization } from "./attribute-new-customer";
import type { PartnerDeps } from "./deps";
import { applyChargeState } from "./process-adjustment";

/**
 * A Stripe invoice was paid (or one of its payments was): record what was
 * actually collected and the commission it earns.
 *
 * THE FLOW. Read the invoice, its payments, payment intents and charges from
 * Stripe - outside any transaction. Then, in ONE short transaction holding
 * the customer organization's attribution lock: complete a link
 * attribution waiting for its workspace, apply a partner coupon (attribute,
 * or a conflict case - never a reassignment), record one payment fact per
 * verified collection (unique per Stripe invoice payment: a webhook
 * delivered twice is the same fact), set the 12-month window from the first
 * qualifying payment, create the commission at the tier in force at the
 * payment's own time with the policy version that applied, write its ledger
 * entry, and apply the charge's current refunds and disputes. The tier and
 * balance projections are refreshed after commit.
 *
 * NOTHING IS GUESSED. Facts that do not add up (a non-subscription line,
 * cash beyond the total, an unsupported currency) become a review case; an
 * unverified or out-of-band collection is not commissionable. A fact and
 * its commission are unique in the database, so concurrent or repeated
 * processing writes them once.
 */

const ZERO = BigInt(0);

export type PaymentOutcome =
  | "commissioned"
  | "recorded"
  | "not_attributed"
  | "not_relevant"
  | "review"
  | "wrong_environment"
  | "disabled";

export async function processInvoice(
  deps: PartnerDeps,
  invoiceId: string,
  environment: Environment,
): Promise<{ outcome: PaymentOutcome; partnerIds: string[]; detail?: string }> {
  const billing = deps.billing;
  if (!billing) return { outcome: "disabled", partnerIds: [] };
  if (billing.environment() !== environment) return { outcome: "wrong_environment", partnerIds: [] };
  const repos = deps.uow.repositories;

  /*
    Cheap first: a customer that is neither attributed nor eligible (the
    payments row the billing webhook wrote names its organization) needs no
    Stripe call at all.
  */
  const knownOrg = await repos.directory.organizationForInvoice(invoiceId);
  if (knownOrg && !(await isRelevant(deps, knownOrg))) return { outcome: "not_relevant", partnerIds: [] };

  const invoice = await billing.loadInvoice(invoiceId);
  if (!invoice.subscriptionId) return { outcome: "not_relevant", partnerIds: [], detail: "not_subscription" };
  const organizationId = knownOrg ?? (invoice.customerId ? await repos.directory.organizationForStripeCustomer(invoice.customerId) : null);
  if (!organizationId) return { outcome: "not_relevant", partnerIds: [], detail: "unknown_customer" };

  const commissionable = invoice.collections.filter((c) => c.verified && !c.outOfBand && c.status === "paid" && c.paidAt);
  const charges = new Map<string, NormalizedCharge>();
  for (const collection of commissionable) {
    if (collection.chargeId && !charges.has(collection.chargeId)) {
      charges.set(collection.chargeId, await billing.loadCharge(collection.chargeId));
    }
  }
  const coupon = await couponFor(repos, environment, invoice);

  const result = await deps.uow.transaction(async (tx) => {
    await eligibilityForOrganization(deps, tx, organizationId);
    let attribution = await tx.attributions.lockByOrganization(organizationId);
    const firstPaidAt = commissionable.map((c) => c.paidAt!).sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
    if (coupon && firstPaidAt) {
      const prior = await tx.directory.priorPaidPayments(organizationId, firstPaidAt, invoice.invoiceId);
      const decided = await attributeByCoupon(deps, tx, {
        organizationId,
        coupon,
        paidAt: firstPaidAt,
        priorPayment: prior,
        paymentReference: invoice.invoiceId,
      });
      attribution = decided.attribution ?? attribution;
    }
    if (!attribution) return { outcome: "not_attributed" as const };
    if (commissionable.length === 0) return { outcome: "recorded" as const, partnerId: attribution.partnerId };

    let bases: CollectionBase[];
    try {
      bases = eligibleBases(
        {
          currency: invoice.currency,
          total: invoice.total,
          tax: invoice.tax,
          allLinesSubscription: invoice.allLinesSubscription,
          linesComplete: invoice.linesComplete,
        },
        commissionable.map((c) => ({ id: c.invoicePaymentId, cash: c.cash, paidAt: c.paidAt! })),
      );
    } catch (error) {
      if (!(error instanceof InconsistentFinancialDataError) && !(error instanceof UnsupportedCurrencyError)) throw error;
      await tx.reviews.open({
        kind: "financial_inconsistency",
        dedupeKey: `invoice:${environment}:${invoice.invoiceId}`,
        environment,
        partnerId: attribution.partnerId,
        attributionId: attribution.id,
        commissionId: null,
        settlementId: null,
        paymentFactId: null,
        organizationId,
        summary: `An invoice for a referred customer cannot be commissioned without guessing: ${error instanceof InconsistentFinancialDataError ? error.reason : "unsupported currency"}`,
        evidence: { invoice: invoice.invoiceId, reason: error.message, ...invoice.evidence },
      });
      return { outcome: "review" as const, partnerId: attribution.partnerId };
    }

    const byId = new Map(commissionable.map((c) => [c.invoicePaymentId, c]));
    let created = false;
    for (const base of bases) {
      const collection = byId.get(base.id)!;
      const { fact } = await tx.commissions.createFactOrGet({
        environment,
        invoicePaymentId: collection.invoicePaymentId,
        invoiceId: invoice.invoiceId,
        paymentIntentId: collection.paymentIntentId,
        chargeId: collection.chargeId,
        stripeSubscriptionId: invoice.subscriptionId,
        stripeCustomerId: invoice.customerId,
        organizationId,
        attributionId: attribution.id,
        paymentId: null,
        currency: base.cash.code,
        cashCollected: base.cash.amount,
        eligibleBase: base.base.amount,
        taxShare: base.taxShare.amount,
        invoiceTotal: invoice.total,
        invoiceTax: invoice.tax,
        invoiceDiscount: invoice.discount,
        invoiceSubtotal: invoice.subtotal,
        invoiceStartingBalance: invoice.startingBalance,
        invoiceAmountPaid: invoice.amountPaid,
        paidAt: collection.paidAt!,
        outcome: "pending",
        evidence: invoice.evidence,
        evidenceVersion: 1,
        syncedAt: deps.clock.now(),
      });
      if (fact.outcome === "pending") {
        const outcome = await commissionFor_(tx, attribution, fact.id, base, collection, environment);
        await tx.commissions.setFactOutcome(fact.id, outcome);
        created = created || outcome === "commissioned";
      }
      if (collection.chargeId && charges.has(collection.chargeId)) {
        const chargeFacts = await tx.commissions.factsByCharge(environment, collection.chargeId);
        await applyChargeState(deps, tx, { factId: fact.id, charge: charges.get(collection.chargeId)!, chargeFacts });
      }
    }
    await checkCreditNotes(tx, invoice, attribution, charges);
    return { outcome: created ? ("commissioned" as const) : ("recorded" as const), partnerId: attribution.partnerId };
  });

  return { outcome: result.outcome, partnerIds: "partnerId" in result && result.partnerId ? [result.partnerId] : [] };
}

/** Attributed, or still attributable (signup eligibility recorded for this workspace or its owner). */
async function isRelevant(deps: PartnerDeps, organizationId: string): Promise<boolean> {
  const repos = deps.uow.repositories;
  if (await repos.attributions.findByOrganization(organizationId)) return true;
  if (await repos.tracking.findEligibilityByOrganization(organizationId)) return true;
  for (const owner of await repos.directory.ownersOf(organizationId)) {
    const eligibility = await repos.tracking.findEligibility(owner);
    if (eligibility && !eligibility.foundingOrganizationId) return true;
  }
  return false;
}

async function couponFor(repos: PartnerRepositories, environment: Environment, invoice: NormalizedInvoice): Promise<CouponRecord | null> {
  for (const promotionCodeId of invoice.promotionCodeIds) {
    const coupon = await repos.coupons.findByPromotionCode(environment, promotionCodeId);
    if (coupon) return coupon;
  }
  return null;
}

/**
 * The commission for one new payment fact, or why there is none. Runs under
 * the attribution's row lock.
 */
async function commissionFor_(
  tx: PartnerRepositories,
  attribution: AttributionRecord,
  factId: string,
  base: CollectionBase,
  collection: NormalizedCollection,
  environment: Environment,
): Promise<string> {
  if (attribution.status === "disqualified") return "disqualified";
  if (!base.base.isPositive()) return "zero_base";

  const paidAt = collection.paidAt!;
  const version = await tx.programs.versionAt(paidAt);

  /*
    The 12-month window starts at the FIRST qualifying payment (provider
    time). A payment processed late but paid earlier moves the start back -
    deterministic whatever the processing order - and anything that then
    falls outside is a review case, not a silent change.
  */
  const earliest = await tx.commissions.earliestQualifyingPaidAt(environment, attribution.organizationId);
  const start = earliest && earliest.getTime() < paidAt.getTime() ? earliest : paidAt;
  if (!attribution.windowStartsAt || start.getTime() < attribution.windowStartsAt.getTime()) {
    const window = eligibilityWindow(start, version.policy.eligibilityMonths);
    if (attribution.windowStartsAt) {
      await tx.reviews.open({
        kind: "financial_inconsistency",
        dedupeKey: `window_moved:${attribution.id}:${start.toISOString()}`,
        environment,
        partnerId: attribution.partnerId,
        attributionId: attribution.id,
        commissionId: null,
        settlementId: null,
        paymentFactId: factId,
        organizationId: attribution.organizationId,
        summary: "An earlier payment arrived late: the commission window now starts earlier; check commissions near its end",
        evidence: { previousStart: attribution.windowStartsAt.toISOString(), newStart: start.toISOString() },
      });
    }
    await tx.attributions.setWindow(attribution.id, { startsAt: window.start, endsAt: window.end });
    attribution = { ...attribution, windowStartsAt: window.start, windowEndsAt: window.end };
  }
  if (!isWithinWindow({ start: attribution.windowStartsAt!, end: attribution.windowEndsAt! }, paidAt)) return "outside_window";

  const periods = await tx.tiers.periods(attribution.partnerId);
  const period = tierAt(periods, paidAt);
  const tier = period ?? (() => {
    const fallback = tierForCount(version.policy, 0);
    return { tierKey: fallback.key, rateBasisPoints: fallback.rateBasisPoints };
  })();
  const amount = commissionFor(base.base, CommissionRate.ofBasisPoints(tier.rateBasisPoints));
  if (!amount.isPositive()) return "zero_base";

  // A customer that is ALSO someone's credit referral: the two claims conflict, so the cash waits for a person.
  const creditConflict = await tx.attributions.hasLegacyCreditReferral(attribution.organizationId);
  const review = attribution.status === "review" || creditConflict;

  const commission = await tx.commissions.createCommission({
    environment,
    partnerId: attribution.partnerId,
    attributionId: attribution.id,
    paymentFactId: factId,
    currency: amount.code,
    baseAmount: base.base.amount,
    rateBasisPoints: tier.rateBasisPoints,
    tierKey: tier.tierKey,
    amount: amount.amount,
    programVersion: version.policy.version,
    programVersionId: version.id,
    earnedAt: paidAt,
    maturesAt: maturesAt(paidAt, version.policy.maturityDays),
    status: "pending",
    reviewState: review ? "needs_review" : "approved",
    holdReason: null,
  });
  if (!commission) return "commissioned";
  await tx.commissions.appendLedger({
    environment,
    partnerId: attribution.partnerId,
    currency: amount.code,
    kind: "commission_earned",
    amount: amount.amount,
    operationKey: `earned:${commission.id}`,
    commissionId: commission.id,
    paymentFactId: factId,
    reason: `Commission at ${CommissionRate.ofBasisPoints(tier.rateBasisPoints).toPercentLabel()} (${tier.tierKey}, policy v${version.policy.version})`,
    actor: "system",
  });
  if (creditConflict) {
    await tx.reviews.open({
      kind: "credit_cash_conflict",
      dedupeKey: `credit_cash_conflict:${attribution.organizationId}`,
      environment,
      partnerId: attribution.partnerId,
      attributionId: attribution.id,
      commissionId: commission.id,
      settlementId: null,
      paymentFactId: factId,
      organizationId: attribution.organizationId,
      summary: "This customer is also a customer's credit referral; its cash commissions wait for a decision",
      evidence: { commissionId: commission.id },
    });
  }
  return "commissioned";
}

/** A credit note credited to the customer's balance (no refund) lowers revenue the commission was paid on. */
async function checkCreditNotes(
  tx: PartnerRepositories,
  invoice: NormalizedInvoice,
  attribution: AttributionRecord,
  charges: Map<string, NormalizedCharge>,
) {
  const refunded = [...charges.values()].reduce((sum, charge) => sum + charge.refunded, ZERO);
  if (invoice.postPaymentCreditNotes <= refunded) return;
  await tx.reviews.open({
    kind: "financial_inconsistency",
    dedupeKey: `credit_note:${invoice.environment}:${invoice.invoiceId}`,
    environment: invoice.environment,
    partnerId: attribution.partnerId,
    attributionId: attribution.id,
    commissionId: null,
    settlementId: null,
    paymentFactId: null,
    organizationId: attribution.organizationId,
    summary: "A credit note on a commissioned invoice was credited without a refund; decide whether to adjust the commission",
    evidence: { invoice: invoice.invoiceId, creditNotes: invoice.postPaymentCreditNotes.toString(), refunded: refunded.toString() },
  });
}
