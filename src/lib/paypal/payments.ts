import { payPalRequest } from "@/lib/paypal/client";

/**
 * PayPal one-off payments (Orders v2) and refunds.
 *
 * TWO KINDS OF PAYPAL MONEY, TWO REFUND ENDPOINTS. A subscription payment is
 * a v1 SALE (PAYMENT.SALE.COMPLETED carries its id), refunded at
 * /v1/payments/sale/{id}/refund. A one-off purchase is an Orders v2 CAPTURE,
 * refunded at /v2/payments/captures/{id}/refund. An ORDER id is neither: it
 * cannot be refunded, which is why payments store the capture id and say which
 * kind it is (payments.provider_object).
 *
 * Every call that may move money carries a PayPal-Request-Id, so repeating it
 * after a lost answer returns PayPal's original result instead of acting
 * twice. A timeout or 5xx surfaces as PayPalError "unknown" (client.ts): the
 * caller must treat it as "may have happened", never as refused.
 */

/** "12.34" from 1234 minor units. Only two-decimal currencies are sold (EUR). */
export function toPayPalAmount(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) throw new Error(`Not an amount in minor units: ${cents}`);
  return (cents / 100).toFixed(2);
}

/** 1234 from "12.34". NaN-safe: an unreadable amount is null, never 0. */
export function fromPayPalAmount(value: string | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(Math.abs(parsed) * 100) : null;
}

type Money = { value?: string; currency_code?: string };
type Link = { href: string; rel: string; method?: string };

export type PayPalCapture = {
  id: string;
  /** COMPLETED | PENDING | DECLINED | PARTIALLY_REFUNDED | REFUNDED | FAILED */
  status: string;
  amount?: Money;
  custom_id?: string;
  invoice_id?: string;
  final_capture?: boolean;
  create_time?: string;
  status_details?: { reason?: string };
  seller_receivable_breakdown?: { gross_amount?: Money; paypal_fee?: Money; net_amount?: Money };
};

export type PayPalOrder = {
  id: string;
  /** CREATED | SAVED | APPROVED | VOIDED | COMPLETED | PAYER_ACTION_REQUIRED */
  status: string;
  links?: Link[];
  purchase_units?: {
    reference_id?: string;
    custom_id?: string;
    invoice_id?: string;
    amount?: Money;
    payments?: { captures?: PayPalCapture[] };
  }[];
};

export type CreatedOrder = { orderId: string; approveUrl: string };

/**
 * Creates an order the buyer approves on PayPal. Nothing is charged here: the
 * money moves only when RepGet captures the approved order (captureOrder).
 *
 * Amount, currency and description come from the caller, who derives them on
 * the server from its own record - never from the browser. custom_id carries
 * that record's id back on every webhook; invoice_id makes PayPal refuse a
 * second order for the same record (it must be unique per merchant account).
 */
export async function createOrder(input: {
  /** Our record's id (an add-on purchase or a sponsorship). Also the idempotency key's root. */
  reference: string;
  /** "<kind>:<id>", carried on the order and its capture (127 characters at most). */
  customId: string;
  amountCents: number;
  currency: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<CreatedOrder> {
  const order = await payPalRequest<PayPalOrder>("/v2/checkout/orders", {
    method: "POST",
    idempotencyKey: `order:${input.reference}`,
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.reference,
          custom_id: input.customId,
          invoice_id: `repget:${input.reference}`,
          description: input.description.slice(0, 127),
          amount: { currency_code: input.currency.toUpperCase(), value: toPayPalAmount(input.amountCents) },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "RepGet",
            // A software service: PayPal must not ask for a shipping address.
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: input.returnUrl,
            cancel_url: input.cancelUrl,
          },
        },
      },
    }),
  });
  // "payer-action" with payment_source; "approve" with the older application_context.
  const approve = order.links?.find((link) => link.rel === "payer-action" || link.rel === "approve");
  if (!approve) throw new Error("PayPal did not return an approval URL for the order");
  return { orderId: order.id, approveUrl: approve.href };
}

export async function getOrder(orderId: string): Promise<PayPalOrder> {
  return payPalRequest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`);
}

/**
 * Captures an approved order: the moment money moves. Keyed per order, so a
 * retried capture (double click, a retry after a timeout, the return page and
 * the webhook racing) returns the same capture rather than charging twice.
 * PayPal answers ORDER_ALREADY_CAPTURED for a capture made under another key;
 * the caller then reads the order (getOrder) for the capture that exists.
 */
export async function captureOrder(orderId: string): Promise<PayPalOrder> {
  return payPalRequest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    idempotencyKey: `capture:${orderId}`,
    body: "{}",
  });
}

/** The order's capture, if it has one: the payment that a refund or a fulfilment refers to. */
export function captureOf(order: PayPalOrder): PayPalCapture | null {
  return order.purchase_units?.[0]?.payments?.captures?.[0] ?? null;
}

export type PayPalRefund = {
  id: string;
  /** Normalised: COMPLETED | PENDING | FAILED | CANCELLED (v1 states upper-cased). */
  status: string;
  amountCents: number | null;
};

/**
 * Refunds part or all of a subscription SALE (v1). The amount is always sent:
 * an empty body would refund the whole sale. invoice_number carries our
 * refund row's id, so the PAYMENT.SALE.REFUNDED webhook can be matched to it.
 */
export async function refundSale(input: {
  saleId: string;
  amountCents: number;
  currency: string;
  /** payment_refunds.operation_key: the idempotency key. */
  operationKey: string;
  /** payment_refunds.id. */
  refundRowId: string;
}): Promise<PayPalRefund> {
  const refund = await payPalRequest<{ id: string; state?: string; amount?: { total?: string } }>(
    `/v1/payments/sale/${encodeURIComponent(input.saleId)}/refund`,
    {
      method: "POST",
      idempotencyKey: input.operationKey,
      body: JSON.stringify({
        amount: { total: toPayPalAmount(input.amountCents), currency: input.currency.toUpperCase() },
        invoice_number: input.refundRowId,
      }),
    },
  );
  return { id: refund.id, status: (refund.state ?? "").toUpperCase(), amountCents: fromPayPalAmount(refund.amount?.total) };
}

/** Refunds part or all of an Orders CAPTURE (v2). custom_id carries our refund row's id. */
export async function refundCapture(input: {
  captureId: string;
  amountCents: number;
  currency: string;
  operationKey: string;
  refundRowId: string;
}): Promise<PayPalRefund> {
  const refund = await payPalRequest<{ id: string; status?: string; amount?: Money }>(
    `/v2/payments/captures/${encodeURIComponent(input.captureId)}/refund`,
    {
      method: "POST",
      idempotencyKey: input.operationKey,
      body: JSON.stringify({
        amount: { value: toPayPalAmount(input.amountCents), currency_code: input.currency.toUpperCase() },
        custom_id: input.refundRowId,
      }),
    },
  );
  return { id: refund.id, status: (refund.status ?? "").toUpperCase(), amountCents: fromPayPalAmount(refund.amount?.value) };
}
