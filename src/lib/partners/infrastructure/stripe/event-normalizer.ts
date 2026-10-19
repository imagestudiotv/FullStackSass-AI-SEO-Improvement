import type Stripe from "stripe";

import type { Environment } from "../../application/ports/repositories";

/**
 * Which partner work a verified PLATFORM Stripe event implies, from the
 * installed SDK's documented event shapes (API 2026-08-26.dahlia).
 *
 * Only the object's id is taken. The worker then READS the current state
 * from Stripe, so a duplicated, delayed or out-of-order event converges on
 * the same result, and the event body is never trusted for amounts.
 *
 *   invoice        - a paid invoice (or one of its payments): collections,
 *                    tax, discounts and promotion codes
 *   charge         - refunds and disputes on a charge: cumulative reversals
 *   transfer       - a reversal or update of a transfer RepGet made (Part 4)
 *
 * Events for connected accounts never come here (they carry `account`, and
 * arrive on the Connect endpoint).
 */

export type PartnerWork = {
  kind: "invoice" | "charge" | "transfer";
  objectId: string;
  environment: Environment;
};

const id = (value: string | { id: string } | null | undefined): string | null =>
  !value ? null : typeof value === "string" ? value : value.id;

export function partnerWorkFor(event: Stripe.Event): PartnerWork | null {
  if (event.account) return null;
  const environment: Environment = event.livemode ? "live" : "test";
  const work = (kind: PartnerWork["kind"], objectId: string | null): PartnerWork | null =>
    objectId ? { kind, objectId, environment } : null;

  switch (event.type) {
    case "invoice.paid":
    case "invoice.payment_succeeded":
    case "credit_note.created":
    case "credit_note.updated":
    case "credit_note.voided": {
      const object = event.data.object as Stripe.Invoice | Stripe.CreditNote;
      return work("invoice", object.object === "invoice" ? (object.id ?? null) : id((object as Stripe.CreditNote).invoice));
    }
    case "invoice_payment.paid":
      return work("invoice", id(event.data.object.invoice as string | { id: string }));
    case "charge.refunded":
    case "charge.dispute.created":
    case "charge.dispute.updated":
    case "charge.dispute.closed":
    case "charge.dispute.funds_withdrawn":
    case "charge.dispute.funds_reinstated": {
      const object = event.data.object as Stripe.Charge | Stripe.Dispute;
      return work("charge", object.object === "charge" ? object.id : id((object as Stripe.Dispute).charge));
    }
    case "charge.refund.updated":
    case "refund.created":
    case "refund.updated":
    case "refund.failed":
      return work("charge", id(event.data.object.charge));
    case "transfer.reversed":
    case "transfer.updated":
      return work("transfer", event.data.object.id);
    default:
      return null;
  }
}

/** Every platform event type the partner program listens to (for the Stripe endpoint configuration). */
export const PARTNER_PLATFORM_EVENTS = [
  "invoice.paid",
  "invoice.payment_succeeded",
  "invoice_payment.paid",
  "credit_note.created",
  "credit_note.updated",
  "credit_note.voided",
  "charge.refunded",
  "charge.refund.updated",
  "refund.created",
  "refund.updated",
  "refund.failed",
  "charge.dispute.created",
  "charge.dispute.updated",
  "charge.dispute.closed",
  "charge.dispute.funds_withdrawn",
  "charge.dispute.funds_reinstated",
  "transfer.reversed",
  "transfer.updated",
] as const;
