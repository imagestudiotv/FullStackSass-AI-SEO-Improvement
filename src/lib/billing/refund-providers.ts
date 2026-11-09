import "server-only";

import type { ProviderRefundAnswer, RefundablePayment, RefundProviderOps } from "@/lib/billing/refunds";
import { classifyStripeError } from "@/lib/partners/infrastructure/stripe/errors";
import { isPayPalConfigured, PayPalError } from "@/lib/paypal/client";
import { refundCapture, refundSale, type PayPalRefund } from "@/lib/paypal/payments";
import { isStripeConfigured, stripe } from "@/lib/stripe/client";

/**
 * The real provider calls behind lib/billing/refunds.ts. Each answer is
 * classified for money: "refused" only when the provider definitely did
 * nothing; anything that may have reached it is "unknown".
 */

/** What a PayPal refund status means for the money. */
function settledOf(refund: PayPalRefund): ProviderRefundAnswer {
  if (refund.status === "COMPLETED") return { kind: "succeeded", providerRefundId: refund.id, settled: "completed" };
  // PENDING: PayPal accepted it and will send it (e.g. an eCheck still clearing). It counts as sent back.
  if (refund.status === "PENDING") return { kind: "succeeded", providerRefundId: refund.id, settled: "pending" };
  if (refund.status === "FAILED" || refund.status === "CANCELLED") {
    return { kind: "refused", message: `PayPal reports the refund ${refund.status.toLowerCase()} (${refund.id})` };
  }
  return { kind: "unknown", message: `PayPal answered an unexpected refund status "${refund.status}" (${refund.id})` };
}

async function refundPayPal(input: Parameters<RefundProviderOps["refund"]>[0]): Promise<ProviderRefundAnswer> {
  if (!isPayPalConfigured()) return { kind: "refused", message: "PayPal is not configured on this deployment." };
  const { payment } = input;
  // Older PayPal rows have no provider_object: subscription sales, the only kind there was.
  const object = payment.providerObject ?? "paypal_sale";
  try {
    const refund =
      object === "paypal_capture"
        ? await refundCapture({ captureId: payment.externalId, amountCents: input.amountCents, currency: payment.currency, operationKey: input.operationKey, refundRowId: input.refundRowId })
        : object === "paypal_sale"
          ? await refundSale({ saleId: payment.externalId, amountCents: input.amountCents, currency: payment.currency, operationKey: input.operationKey, refundRowId: input.refundRowId })
          : null;
    if (!refund) return { kind: "refused", message: `A PayPal "${object}" cannot be refunded here.` };
    return settledOf(refund);
  } catch (error) {
    if (error instanceof PayPalError) {
      // config / auth / not_found / rejected: PayPal did nothing. "unknown": it may have.
      return error.kind === "unknown"
        ? { kind: "unknown", message: error.message }
        : { kind: "refused", message: error.issue ? `${error.message} (${error.issue})` : error.message };
    }
    return { kind: "unknown", message: error instanceof Error ? error.message : "PayPal request failed" };
  }
}

/**
 * What a stored Stripe id refunds. A subscription payment is stored under its
 * INVOICE (in_...), which Stripe cannot refund: the payment intent is read
 * from the invoice's payments. One-off add-ons store a payment intent, and
 * older rows may hold a charge.
 */
async function stripeTarget(payment: RefundablePayment): Promise<{ charge: string } | { payment_intent: string } | null> {
  if (payment.externalId.startsWith("in_")) {
    const invoice = await stripe.invoices.retrieve(payment.externalId, { expand: ["payments"] });
    const paid = invoice.payments?.data?.[0]?.payment;
    const intent = paid?.type === "payment_intent" ? paid.payment_intent : null;
    const intentId = typeof intent === "string" ? intent : (intent?.id ?? null);
    return intentId ? { payment_intent: intentId } : null;
  }
  if (payment.externalId.startsWith("ch_")) return { charge: payment.externalId };
  return { payment_intent: payment.externalId };
}

async function refundStripe(input: Parameters<RefundProviderOps["refund"]>[0]): Promise<ProviderRefundAnswer> {
  if (!isStripeConfigured()) return { kind: "refused", message: "Stripe is not configured on this deployment." };
  let target: Awaited<ReturnType<typeof stripeTarget>>;
  try {
    target = await stripeTarget(input.payment);
  } catch (error) {
    // Only a read: nothing was refunded, whatever went wrong.
    return { kind: "refused", message: classifyStripeError(error).message };
  }
  if (!target) return { kind: "refused", message: "This invoice has no refundable payment on Stripe. Refund it in the Stripe dashboard." };
  try {
    const refund = await stripe.refunds.create(
      // Omitting amount would refund the whole charge, so it is always sent.
      { ...target, amount: input.amountCents, metadata: { repget_refund_id: input.refundRowId } },
      { idempotencyKey: input.operationKey },
    );
    if (refund.status === "succeeded") return { kind: "succeeded", providerRefundId: refund.id, settled: "completed" };
    if (refund.status === "pending" || refund.status === "requires_action") {
      return { kind: "succeeded", providerRefundId: refund.id, settled: "pending" };
    }
    if (refund.status === "failed" || refund.status === "canceled") {
      return { kind: "refused", message: `Stripe reports the refund ${refund.status} (${refund.id})` };
    }
    return { kind: "unknown", message: `Stripe answered an unexpected refund status "${refund.status}" (${refund.id})` };
  } catch (error) {
    const classified = classifyStripeError(error);
    return classified.kind === "refused" ? { kind: "refused", message: classified.message } : { kind: "unknown", message: classified.message };
  }
}

export const refundProviderOps: RefundProviderOps = {
  refund: (input) => (input.payment.provider === "paypal" ? refundPayPal(input) : refundStripe(input)),
};
