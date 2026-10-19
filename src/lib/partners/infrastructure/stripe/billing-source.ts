import type Stripe from "stripe";

import type {
  BillingSource,
  CouponGateway,
  NormalizedCharge,
  NormalizedCollection,
  NormalizedInvoice,
} from "../../application/ports/billing-source";
import type { Environment } from "../../application/ports/repositories";

/**
 * Stripe Billing, normalized for commission calculation. Read-only, and
 * always the CURRENT state from Stripe (never an event body).
 *
 * What counts as collected money is decided here, conservatively:
 *
 *   - one fact per Stripe INVOICE PAYMENT (the economic collection), so
 *     several partial payments of one invoice are counted once each and the
 *     invoice total is never counted;
 *   - a collection is VERIFIED only when the invoice payment is "paid" and
 *     its payment intent succeeded with at least that amount received, or
 *     (older integrations) its charge is captured and succeeded;
 *   - a "payment record" is money recorded as paid outside Stripe: never
 *     commissionable;
 *   - lines are read in full (paginated) to tell subscription revenue from
 *     anything else.
 */

const big = (value: number | null | undefined) => BigInt(value ?? 0);
const id = (value: string | { id: string } | null | undefined): string | null =>
  !value ? null : typeof value === "string" ? value : value.id;

export function stripeBillingSource(stripe: Stripe, environment: Environment): BillingSource {
  async function allLines(invoice: Stripe.Invoice): Promise<Stripe.InvoiceLineItem[]> {
    const lines = [...(invoice.lines?.data ?? [])];
    if (!invoice.lines?.has_more || !invoice.id) return lines;
    const all: Stripe.InvoiceLineItem[] = [];
    for await (const line of stripe.invoices.listLineItems(invoice.id, { limit: 100 })) all.push(line);
    return all;
  }

  async function allPayments(invoice: Stripe.Invoice): Promise<Stripe.InvoicePayment[]> {
    if (!invoice.id) return [];
    const all: Stripe.InvoicePayment[] = [];
    for await (const payment of stripe.invoicePayments.list({ invoice: invoice.id, limit: 100 })) all.push(payment);
    return all;
  }

  async function verify(payment: Stripe.InvoicePayment): Promise<NormalizedCollection> {
    const paid = payment.status === "paid";
    const amount = paid ? big(payment.amount_paid) : BigInt(0);
    const paidAt = payment.status_transitions?.paid_at ? new Date(payment.status_transitions.paid_at * 1000) : null;
    const base: NormalizedCollection = {
      invoicePaymentId: payment.id,
      status: payment.status,
      cash: amount,
      currency: payment.currency,
      paidAt,
      paymentIntentId: null,
      chargeId: null,
      verified: false,
      outOfBand: payment.payment.type === "payment_record",
    };
    if (!paid || base.outOfBand) return base;

    if (payment.payment.type === "payment_intent") {
      const intentId = id(payment.payment.payment_intent as string | { id: string });
      if (!intentId) return base;
      const intent = await stripe.paymentIntents.retrieve(intentId, { expand: ["latest_charge"] });
      const charge = typeof intent.latest_charge === "object" ? intent.latest_charge : null;
      const verified =
        intent.status === "succeeded" &&
        big(intent.amount_received) >= amount &&
        (charge === null || (charge.captured && charge.status === "succeeded"));
      return { ...base, paymentIntentId: intent.id, chargeId: id(intent.latest_charge as string | { id: string }), verified };
    }
    if (payment.payment.type === "charge") {
      const chargeId = id(payment.payment.charge as string | { id: string });
      if (!chargeId) return base;
      const charge = await stripe.charges.retrieve(chargeId);
      const verified = charge.captured && charge.status === "succeeded" && big(charge.amount_captured) >= amount;
      return { ...base, chargeId: charge.id, paymentIntentId: id(charge.payment_intent as string | { id: string }), verified };
    }
    return base;
  }

  return {
    environment: () => environment,

    async loadInvoice(invoiceId) {
      const invoice = await stripe.invoices.retrieve(invoiceId, { expand: ["discounts"] });
      const [lines, payments] = await Promise.all([allLines(invoice), allPayments(invoice)]);
      const collections = await Promise.all(payments.map(verify));
      const tax = (invoice.total_taxes ?? []).reduce((sum, t) => sum + big(t.amount), BigInt(0));
      const discount = (invoice.total_discount_amounts ?? []).reduce((sum, d) => sum + big(d.amount), BigInt(0));
      const promotionCodeIds = (invoice.discounts ?? [])
        .map((d) => (typeof d === "string" ? null : "promotion_code" in d ? id(d.promotion_code as string | { id: string }) : null))
        .filter((value): value is string => Boolean(value));
      const subscription = invoice.parent?.subscription_details?.subscription;
      const normalized: NormalizedInvoice = {
        environment,
        invoiceId: invoice.id ?? invoiceId,
        customerId: id(invoice.customer as string | { id: string }),
        subscriptionId: id(subscription as string | { id: string } | null | undefined),
        currency: invoice.currency,
        status: invoice.status,
        billingReason: invoice.billing_reason,
        total: big(invoice.total),
        subtotal: big(invoice.subtotal),
        tax,
        discount,
        startingBalance: big(invoice.starting_balance),
        amountPaid: big(invoice.amount_paid),
        amountPaidOffStripe: big(invoice.amount_paid_off_stripe),
        postPaymentCreditNotes: big(invoice.post_payment_credit_notes_amount),
        allLinesSubscription: lines.length > 0 && lines.every((line) => line.parent?.type === "subscription_item_details"),
        linesComplete: true,
        promotionCodeIds,
        collections,
        evidence: {
          invoice: { id: invoice.id, status: invoice.status, billingReason: invoice.billing_reason, livemode: invoice.livemode },
          amounts: {
            total: invoice.total,
            subtotal: invoice.subtotal,
            totalExcludingTax: invoice.total_excluding_tax,
            amountPaid: invoice.amount_paid,
            amountPaidOffStripe: invoice.amount_paid_off_stripe ?? 0,
            startingBalance: invoice.starting_balance,
            prePaymentCreditNotes: invoice.pre_payment_credit_notes_amount,
            postPaymentCreditNotes: invoice.post_payment_credit_notes_amount,
          },
          taxes: (invoice.total_taxes ?? []).map((t) => ({ amount: t.amount, behavior: t.tax_behavior })),
          discounts: (invoice.total_discount_amounts ?? []).map((d) => ({ amount: d.amount, discount: id(d.discount as string | { id: string }) })),
          promotionCodes: promotionCodeIds,
          lines: lines.map((line) => ({ id: line.id, amount: line.amount, parent: line.parent?.type ?? null, proration: line.parent?.subscription_item_details?.proration ?? null })),
          payments: collections.map((c) => ({ id: c.invoicePaymentId, status: c.status, cash: c.cash.toString(), verified: c.verified, outOfBand: c.outOfBand })),
        },
      };
      return normalized;
    },

    async loadCharge(chargeId) {
      const charge = await stripe.charges.retrieve(chargeId);
      const disputes: NormalizedCharge["disputes"] = [];
      for await (const dispute of stripe.disputes.list({ charge: chargeId, limit: 100 })) {
        disputes.push({ id: dispute.id, status: dispute.status, amount: big(dispute.amount), currency: dispute.currency });
      }
      return {
        environment,
        chargeId: charge.id,
        paymentIntentId: id(charge.payment_intent as string | { id: string }),
        currency: charge.currency,
        amount: big(charge.amount_captured || charge.amount),
        refunded: big(charge.amount_refunded),
        disputes,
      };
    },

    async invoiceIdsForPaymentIntent(paymentIntentId) {
      const ids: string[] = [];
      for await (const payment of stripe.invoicePayments.list({ payment: { type: "payment_intent", payment_intent: paymentIntentId }, limit: 100 })) {
        const invoice = id(payment.invoice as string | { id: string });
        if (invoice) ids.push(invoice);
      }
      return [...new Set(ids)];
    },

    async chargeForDispute(disputeId) {
      const dispute = await stripe.disputes.retrieve(disputeId);
      return id(dispute.charge as string | { id: string });
    },
  };
}

/**
 * Affiliate coupons: a Stripe coupon and its customer-facing promotion code,
 * created by an administrator. Percentages are whole or two-decimal
 * percents (basis points / 100 is a rate PARAMETER for Stripe, not money).
 */
export function stripeCouponGateway(stripe: Stripe): CouponGateway {
  return {
    async createCouponWithCode(spec) {
      const coupon = await stripe.coupons.create(
        {
          name: spec.name.slice(0, 40),
          ...(spec.percentOffBasisPoints !== null
            ? { percent_off: spec.percentOffBasisPoints / 100 }
            : { amount_off: Number(spec.amountOff), currency: spec.currency ?? undefined }),
          duration: spec.duration,
          ...(spec.duration === "repeating" ? { duration_in_months: spec.durationInMonths ?? undefined } : {}),
          ...(spec.appliesToProducts.length > 0 ? { applies_to: { products: spec.appliesToProducts } } : {}),
          metadata: spec.metadata,
        },
        { idempotencyKey: `${spec.idempotencyKey}:coupon` },
      );
      const promotion = await stripe.promotionCodes.create(
        {
          promotion: { type: "coupon", coupon: coupon.id },
          code: spec.code,
          active: spec.active,
          ...(spec.expiresAt ? { expires_at: Math.floor(spec.expiresAt.getTime() / 1000) } : {}),
          ...(spec.maxRedemptions ? { max_redemptions: spec.maxRedemptions } : {}),
          restrictions: { first_time_transaction: spec.firstTimeTransaction },
          metadata: spec.metadata,
        },
        { idempotencyKey: `${spec.idempotencyKey}:promotion` },
      );
      return { couponId: coupon.id, promotionCodeId: promotion.id };
    },
    async deactivatePromotionCode(promotionCodeId) {
      await stripe.promotionCodes.update(promotionCodeId, { active: false });
    },
    async activatePromotionCode(promotionCodeId) {
      await stripe.promotionCodes.update(promotionCodeId, { active: true });
    },
    async productIntervals(productIds) {
      const result: Record<string, string[]> = {};
      for (const product of productIds) {
        const intervals = new Set<string>();
        for await (const price of stripe.prices.list({ product, active: true, limit: 100 })) {
          if (price.recurring?.interval) intervals.add(price.recurring.interval);
        }
        result[product] = [...intervals];
      }
      return result;
    },
  };
}
