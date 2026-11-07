import "server-only";

import { PayPalError, payPalRequest } from "@/lib/paypal/client";
import { fromPayPalAmount, toPayPalAmount } from "@/lib/paypal/payments";

import type { PayPalPayoutEvidence, PayPalPayoutGateway, ProviderOutcome } from "../../application/ports/payout-gateway";
import type { Environment } from "../../application/ports/repositories";

/**
 * PayPal Payouts (POST /v1/payments/payouts), one batch per payout with one
 * item, for partners paid through PayPal in automated mode. PayPal must have
 * enabled Payouts on the business account; sandbox works without that.
 *
 * The sender_batch_id is ALSO sent as PayPal-Request-Id: PayPal returns the
 * original answer for a repeated request (30 days) and refuses a reused
 * sender_batch_id, so a lost answer can be asked again without paying twice.
 * Amounts are integer minor units in, PayPal's decimal strings out.
 */

type Money = { value?: string; currency?: string };
type Item = {
  payout_item_id?: string;
  transaction_id?: string;
  transaction_status?: string;
  payout_batch_id?: string;
  sender_batch_id?: string;
  payout_item_fee?: Money;
  payout_item?: { amount?: Money; receiver?: string; sender_item_id?: string };
  errors?: { name?: string; message?: string };
};
type Batch = {
  batch_header?: { payout_batch_id?: string; batch_status?: string; sender_batch_header?: { sender_batch_id?: string } };
  items?: Item[];
};

function evidenceOf(batch: Batch, item: Item | undefined): PayPalPayoutEvidence {
  return {
    batchId: batch.batch_header?.payout_batch_id ?? item?.payout_batch_id ?? "",
    senderBatchId: batch.batch_header?.sender_batch_header?.sender_batch_id ?? item?.sender_batch_id ?? null,
    batchStatus: (batch.batch_header?.batch_status ?? "").toUpperCase(),
    itemId: item?.payout_item_id ?? null,
    itemStatus: item?.transaction_status ? item.transaction_status.toUpperCase() : null,
    transactionId: item?.transaction_id ?? null,
    amount: item?.payout_item?.amount?.value !== undefined ? BigInt(fromPayPalAmount(item.payout_item.amount.value) ?? 0) : null,
    currency: item?.payout_item?.amount?.currency?.toLowerCase() ?? null,
    fee: item?.payout_item_fee?.value !== undefined ? BigInt(fromPayPalAmount(item.payout_item_fee.value) ?? 0) : null,
    receiver: item?.payout_item?.receiver?.toLowerCase() ?? null,
    error: item?.errors ? `${item.errors.name ?? ""}: ${item.errors.message ?? ""}`.slice(0, 300) : null,
  };
}

export function payPalPayoutGateway(environment: Environment): PayPalPayoutGateway {
  return {
    environment: () => environment,

    async createPayout(input): Promise<ProviderOutcome<PayPalPayoutEvidence>> {
      let created: Batch;
      try {
        created = await payPalRequest<Batch>("/v1/payments/payouts", {
          method: "POST",
          idempotencyKey: input.senderBatchId,
          body: JSON.stringify({
            sender_batch_header: {
              sender_batch_id: input.senderBatchId,
              email_subject: "You have a payout from RepGet",
              email_message: input.note,
            },
            items: [
              {
                recipient_type: "EMAIL",
                receiver: input.receiver,
                amount: { value: toPayPalAmount(Number(input.amount)), currency: input.currency.toUpperCase() },
                note: input.note,
                sender_item_id: input.senderBatchId,
                purpose: "SERVICES",
              },
            ],
          }),
        });
      } catch (error) {
        if (error instanceof PayPalError && error.kind !== "unknown") {
          // Processed and refused (or never sent: credentials, mode): nothing was paid.
          return { kind: "refused", code: error.issue ?? error.kind, message: error.message };
        }
        return { kind: "unknown", message: error instanceof Error ? error.message : "PayPal did not answer" };
      }
      return { kind: "succeeded", value: evidenceOf(created, created.items?.[0]) };
    },

    async getBatch(batchId) {
      const batch = await payPalRequest<Batch>(`/v1/payments/payouts/${encodeURIComponent(batchId)}`);
      return evidenceOf(batch, batch.items?.[0]);
    },

    async getItem(itemId) {
      const item = await payPalRequest<Item>(`/v1/payments/payouts-item/${encodeURIComponent(itemId)}`);
      return evidenceOf({}, item);
    },
  };
}
