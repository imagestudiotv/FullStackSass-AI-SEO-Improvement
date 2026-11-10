import { InconsistentFinancialDataError, UnsupportedCurrencyError } from "../../domain/errors";
import { eligibleBases } from "../../domain/policies/commission";
import type { NormalizedCharge, NormalizedCollection } from "../ports/billing-source";
import type { Environment } from "../ports/repositories";
import { eligibilityForOrganization } from "./attribute-new-customer";
import type { PartnerDeps } from "./deps";
import { applyChargeState } from "./process-adjustment";
import { commissionFor_, isRelevant, type PaymentOutcome } from "./process-payment";

/**
 * A PayPal subscription SALE completed, or was refunded or reversed since:
 * record what was collected and the commission it earns, by the same rules
 * as a Stripe invoice payment (review P7; docs/partner-program.md).
 *
 * The same, deliberately: the customer organization's attribution lock; one
 * payment fact per sale (keyed "paypal_sale:<id>", so a webhook delivered
 * twice is the same fact); the 12-month window from the first qualifying
 * payment by the provider's time; the tier in force at that time and the
 * policy version that applied; maturity; a review case instead of a guess;
 * the customer-credit-referral conflict. And refunds and reversals applied
 * cumulatively through the same charge logic, so replays and out-of-order
 * events converge and a commission already paid out is offset later, never
 * recalculated at today's tier.
 *
 * What PayPal cannot do: a partner coupon (PayPal has no promotion codes), so
 * only a link attribution applies. Fees are not subtracted, as with Stripe.
 */

export async function processPayPalSale(
  deps: PartnerDeps,
  input: { saleId: string; environment: Environment },
): Promise<{ outcome: PaymentOutcome | "no_paypal"; partnerIds: string[]; detail?: string }> {
  const source = deps.paypalSales;
  if (!source) return { outcome: "no_paypal", partnerIds: [] };
  if (source.environment() !== input.environment) return { outcome: "wrong_environment", partnerIds: [] };
  // The billing webhook records the sale first (lib/billing/paypal-events.ts); a missing one is retried.
  const organizationId = await source.organizationForSale(input.saleId);
  if (!organizationId) throw new Error(`PayPal sale ${input.saleId} is not recorded yet`);
  if (!(await isRelevant(deps, organizationId))) return { outcome: "not_relevant", partnerIds: [] };

  const sale = await source.loadSale(input.saleId);
  const key = `paypal_sale:${sale.saleId}`;
  const commissionable = sale.verified && sale.paidAt !== null && sale.cash > BigInt(0);

  const result = await deps.uow.transaction(async (tx) => {
    await eligibilityForOrganization(deps, tx, organizationId);
    const attribution = await tx.attributions.lockByOrganization(organizationId);
    if (!attribution) return { outcome: "not_attributed" as const };
    if (!commissionable) return { outcome: "recorded" as const, partnerId: attribution.partnerId };

    let base;
    try {
      [base] = eligibleBases(
        { currency: sale.currency, total: sale.cash, tax: sale.tax, allLinesSubscription: true, linesComplete: true },
        [{ id: key, cash: sale.cash, paidAt: sale.paidAt! }],
      );
    } catch (error) {
      if (!(error instanceof InconsistentFinancialDataError) && !(error instanceof UnsupportedCurrencyError)) throw error;
      await tx.reviews.open({
        kind: "financial_inconsistency",
        dedupeKey: `paypal_sale:${input.environment}:${sale.saleId}`,
        environment: input.environment,
        partnerId: attribution.partnerId,
        attributionId: attribution.id,
        commissionId: null,
        settlementId: null,
        paymentFactId: null,
        organizationId,
        summary: `A PayPal payment for a referred customer cannot be commissioned without guessing: ${error instanceof InconsistentFinancialDataError ? error.reason : "unsupported currency"}`,
        evidence: { sale: sale.saleId, reason: error.message, ...sale.evidence },
      });
      return { outcome: "review" as const, partnerId: attribution.partnerId };
    }

    const { fact } = await tx.commissions.createFactOrGet({
      environment: input.environment,
      provider: "paypal",
      invoicePaymentId: key,
      invoiceId: key,
      paymentIntentId: null,
      chargeId: key,
      stripeSubscriptionId: null,
      stripeCustomerId: null,
      paypalSubscriptionId: sale.subscriptionId,
      organizationId,
      attributionId: attribution.id,
      paymentId: null,
      currency: base.cash.code,
      cashCollected: base.cash.amount,
      eligibleBase: base.base.amount,
      taxShare: base.taxShare.amount,
      invoiceTotal: sale.cash,
      invoiceTax: sale.tax,
      invoiceDiscount: BigInt(0),
      invoiceSubtotal: sale.cash - sale.tax,
      invoiceStartingBalance: BigInt(0),
      invoiceAmountPaid: sale.cash,
      paidAt: sale.paidAt!,
      outcome: "pending",
      evidence: sale.evidence,
      evidenceVersion: 1,
      syncedAt: deps.clock.now(),
    });

    let created = false;
    if (fact.outcome === "pending") {
      const collection: NormalizedCollection = {
        invoicePaymentId: key,
        status: "paid",
        cash: sale.cash,
        currency: sale.currency,
        paidAt: sale.paidAt,
        paymentIntentId: null,
        chargeId: key,
        verified: true,
        outOfBand: false,
      };
      const outcome = await commissionFor_(tx, attribution, fact.id, base, collection, input.environment);
      await tx.commissions.setFactOutcome(fact.id, outcome);
      created = outcome === "commissioned";
    }

    // Refunds and a reversal, cumulative and capped at the cash: the sale is its own "charge".
    const charge: NormalizedCharge = {
      environment: input.environment,
      chargeId: key,
      paymentIntentId: null,
      currency: sale.currency,
      amount: sale.cash,
      refunded: sale.refunded > sale.cash ? sale.cash : sale.refunded,
      disputes: sale.reversed ? [{ id: `${key}:reversal`, status: "lost", amount: sale.cash, currency: sale.currency }] : [],
    };
    const chargeFacts = await tx.commissions.factsByCharge(input.environment, key);
    await applyChargeState(deps, tx, { factId: fact.id, charge, chargeFacts });
    return { outcome: created ? ("commissioned" as const) : ("recorded" as const), partnerId: attribution.partnerId };
  });

  return { outcome: result.outcome, partnerIds: "partnerId" in result && result.partnerId ? [result.partnerId] : [] };
}
