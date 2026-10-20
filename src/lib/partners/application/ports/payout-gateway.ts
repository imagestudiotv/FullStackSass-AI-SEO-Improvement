import type { Environment, StripeAccountStatus } from "./repositories";

/**
 * Stripe Connect, behind an application-owned interface.
 *
 * ONBOARDING, TRANSFERS AND BANK PAYOUTS ARE SEPARATE OPERATIONS. A transfer
 * moves money from RepGet's platform balance to the partner's connected
 * balance and settles the commission; a bank payout moves it from that
 * balance to the partner's bank. There is deliberately no "sendMoney".
 *
 * Calls that move money return a ProviderOutcome: "refused" only when Stripe
 * definitely refused (a 4xx: nothing was created); "unknown" for a timeout,
 * a connection error or a 5xx - the operation MAY exist, and the caller must
 * reconcile (find it by transfer group / metadata) before trying again.
 */

export type ProviderOutcome<T> =
  | { kind: "succeeded"; value: T }
  | { kind: "refused"; code: string | null; message: string }
  | { kind: "unknown"; message: string };

export type AccountReadiness = {
  accountId: string;
  livemode: boolean;
  status: StripeAccountStatus;
  country: string | null;
  defaultCurrency: string | null;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  transfersCapability: string | null;
  requirementsCurrentlyDue: string[];
  requirementsPastDue: string[];
  requirementsPendingVerification: string[];
  disabledReason: string | null;
  currentDeadline: Date | null;
  payoutInterval: string | null;
  metadataPartnerId: string | null;
};

export type TransferEvidence = {
  id: string;
  livemode: boolean;
  amount: bigint;
  currency: string;
  destination: string | null;
  transferGroup: string | null;
  amountReversed: bigint;
  reversed: boolean;
  /** Every reversal Stripe holds for it (whoever made it), so each is recorded once by its id. */
  reversals: { id: string; amount: bigint; created: Date; /** repget_operation_id from its metadata, when RepGet made it. */ operationId: string | null }[];
  balanceTransactionId: string | null;
  created: Date;
  metadata: Record<string, string>;
};

export type PayoutEvidence = {
  id: string;
  accountId: string;
  livemode: boolean;
  amount: bigint;
  currency: string;
  status: string;
  automatic: boolean;
  arrivalDate: Date | null;
  failureCode: string | null;
  failureMessage: string | null;
  created: Date;
  metadata: Record<string, string>;
};

/** Connected-account onboarding and readiness: no money moves here. */
export interface ConnectAccountGateway {
  environment(): Environment;
  createConnectedAccount(input: {
    partnerId: string;
    email: string;
    country: string;
    idempotencyKey: string;
  }): Promise<ProviderOutcome<{ accountId: string }>>;
  /** Short-lived and single use: never stored, never emailed. */
  createOnboardingLink(input: { accountId: string; refreshUrl: string; returnUrl: string }): Promise<{ url: string; expiresAt: Date }>;
  /** Express Dashboard login link for an onboarded account. */
  createDashboardLink(accountId: string): Promise<{ url: string }>;
  retrieveAccount(accountId: string): Promise<AccountReadiness>;
}

/** Money movement: platform balance, transfers, reversals, bank payouts. */
export interface StripePayoutGateway extends ConnectAccountGateway {
  /* Funds */
  platformAvailableBalance(currency: string): Promise<bigint>;
  connectedAvailableBalance(accountId: string, currency: string): Promise<bigint>;

  /* Transfers: platform -> connected balance */
  createTransfer(input: {
    destination: string;
    amount: bigint;
    currency: string;
    transferGroup: string;
    idempotencyKey: string;
    metadata: Record<string, string>;
  }): Promise<ProviderOutcome<TransferEvidence>>;
  findTransfersByGroup(transferGroup: string): Promise<TransferEvidence[]>;
  retrieveTransfer(transferId: string): Promise<TransferEvidence>;
  createTransferReversal(input: {
    transferId: string;
    amount: bigint;
    idempotencyKey: string;
    metadata: Record<string, string>;
  }): Promise<ProviderOutcome<{ reversalId: string; amount: bigint }>>;

  /* Bank payouts: connected balance -> bank, on the connected account */
  createBankPayout(input: {
    accountId: string;
    amount: bigint;
    currency: string;
    idempotencyKey: string;
    metadata: Record<string, string>;
  }): Promise<ProviderOutcome<PayoutEvidence>>;
  retrievePayout(accountId: string, payoutId: string): Promise<PayoutEvidence>;
  /** Payouts on the account created since `since`, for reconciling an unknown create. */
  listPayouts(accountId: string, since: Date): Promise<PayoutEvidence[]>;
}
