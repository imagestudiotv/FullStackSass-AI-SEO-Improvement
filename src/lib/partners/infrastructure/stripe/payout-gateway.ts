import type Stripe from "stripe";

import type { PayoutEvidence, StripePayoutGateway, TransferEvidence } from "../../application/ports/payout-gateway";
import type { Environment } from "../../application/ports/repositories";
import { connectAccountGateway } from "./connect-onboarding";
import { classifyStripeError } from "./errors";

/**
 * Stripe Connect money movement for partner settlements.
 *
 *   TRANSFER (platform balance -> connected balance): transfers.create on the
 *   PLATFORM account, with the settlement's transfer_group, the operation id
 *   as idempotency key and in metadata. The transfer_group is durable
 *   evidence: transfers.list({ transfer_group }) finds what a lost answer
 *   created, long after Stripe's idempotency keys (24 hours) expire.
 *
 *   BANK PAYOUT (connected balance -> bank): payouts.create ON THE CONNECTED
 *   ACCOUNT (the Stripe-Account header), possible because its schedule is
 *   manual. Its metadata carries the operation id; payouts.list on that
 *   account finds a payout whose creation answer was lost.
 *
 * The platform's own balance is never paid out or rearranged here: funding
 * the platform balance for transfers is an operator task
 * (docs/partner-program.md, "Funding").
 */

const big = (value: number | null | undefined) => BigInt(value ?? 0);
const id = (value: string | { id: string } | null | undefined): string | null =>
  !value ? null : typeof value === "string" ? value : value.id;
const asNumber = (amount: bigint) => {
  if (amount <= BigInt(0) || amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Amount out of range");
  return Number(amount);
};

export function transferEvidence(transfer: Stripe.Transfer, allReversals?: Stripe.TransferReversal[]): TransferEvidence {
  return {
    id: transfer.id,
    livemode: transfer.livemode,
    amount: big(transfer.amount),
    currency: transfer.currency,
    destination: id(transfer.destination as string | { id: string } | null),
    transferGroup: transfer.transfer_group,
    amountReversed: big(transfer.amount_reversed),
    reversed: transfer.reversed,
    reversals: (allReversals ?? transfer.reversals?.data ?? []).map((reversal) => ({
      id: reversal.id,
      amount: big(reversal.amount),
      created: new Date(reversal.created * 1000),
      operationId: reversal.metadata?.repget_operation_id ?? null,
    })),
    balanceTransactionId: id(transfer.balance_transaction as string | { id: string } | null),
    created: new Date(transfer.created * 1000),
    metadata: transfer.metadata ?? {},
  };
}

export function payoutEvidence(payout: Stripe.Payout, accountId: string): PayoutEvidence {
  return {
    id: payout.id,
    accountId,
    livemode: payout.livemode,
    amount: big(payout.amount),
    currency: payout.currency,
    status: payout.status,
    automatic: payout.automatic,
    arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000) : null,
    failureCode: payout.failure_code,
    failureMessage: payout.failure_message,
    created: new Date(payout.created * 1000),
    metadata: payout.metadata ?? {},
  };
}

function available(balance: Stripe.Balance, currency: string): bigint {
  return balance.available.filter((entry) => entry.currency === currency).reduce((sum, entry) => sum + big(entry.amount), BigInt(0));
}

export function stripePayoutGateway(stripe: Stripe, environment: Environment): StripePayoutGateway {
  return {
    ...connectAccountGateway(stripe, environment),

    async platformAvailableBalance(currency) {
      return available(await stripe.balance.retrieve(), currency);
    },
    async connectedAvailableBalance(accountId, currency) {
      return available(await stripe.balance.retrieve({}, { stripeAccount: accountId }), currency);
    },

    async createTransfer(input) {
      try {
        const transfer = await stripe.transfers.create(
          {
            amount: asNumber(input.amount),
            currency: input.currency,
            destination: input.destination,
            transfer_group: input.transferGroup,
            description: "RepGet partner commission",
            metadata: input.metadata,
          },
          { idempotencyKey: input.idempotencyKey },
        );
        return { kind: "succeeded", value: transferEvidence(transfer) };
      } catch (error) {
        return classifyStripeError(error);
      }
    },
    async findTransfersByGroup(transferGroup) {
      const found: TransferEvidence[] = [];
      for await (const transfer of stripe.transfers.list({ transfer_group: transferGroup, limit: 100 })) found.push(transferEvidence(transfer));
      return found;
    },
    async retrieveTransfer(transferId) {
      const transfer = await stripe.transfers.retrieve(transferId);
      // The embedded list holds the first 10 reversals only.
      if (!transfer.reversals?.has_more) return transferEvidence(transfer);
      const all: Stripe.TransferReversal[] = [];
      for await (const reversal of stripe.transfers.listReversals(transferId, { limit: 100 })) all.push(reversal);
      return transferEvidence(transfer, all);
    },
    async createTransferReversal(input) {
      try {
        const reversal = await stripe.transfers.createReversal(
          input.transferId,
          { amount: asNumber(input.amount), metadata: input.metadata, description: "RepGet partner commission recovered" },
          { idempotencyKey: input.idempotencyKey },
        );
        return { kind: "succeeded", value: { reversalId: reversal.id, amount: big(reversal.amount) } };
      } catch (error) {
        return classifyStripeError(error);
      }
    },

    async createBankPayout(input) {
      try {
        const payout = await stripe.payouts.create(
          { amount: asNumber(input.amount), currency: input.currency, metadata: input.metadata, description: "RepGet partner payout" },
          { stripeAccount: input.accountId, idempotencyKey: input.idempotencyKey },
        );
        return { kind: "succeeded", value: payoutEvidence(payout, input.accountId) };
      } catch (error) {
        return classifyStripeError(error);
      }
    },
    async retrievePayout(accountId, payoutId) {
      return payoutEvidence(await stripe.payouts.retrieve(payoutId, {}, { stripeAccount: accountId }), accountId);
    },
    async listPayouts(accountId, since) {
      const found: PayoutEvidence[] = [];
      for await (const payout of stripe.payouts.list({ created: { gte: Math.floor(since.getTime() / 1000) }, limit: 100 }, { stripeAccount: accountId })) {
        found.push(payoutEvidence(payout, accountId));
      }
      return found;
    },
  };
}
