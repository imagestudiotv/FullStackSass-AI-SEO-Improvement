import type { Environment } from "./repositories";

/**
 * Billing facts, normalized from the payment provider. Implemented for
 * Stripe in infrastructure/stripe/billing-source.ts; another provider would
 * be another adapter. Every call reads the provider's CURRENT state: event
 * bodies are only ever used to know what to read.
 */

export type NormalizedCollection = {
  /** Stripe invoice payment id (inpay_...): one economic collection. */
  invoicePaymentId: string;
  /** The invoice payment's status: "paid" counts; anything else does not. */
  status: string;
  /** Cash collected in this payment, minor units (0 unless paid). */
  cash: bigint;
  currency: string;
  /** The provider's payment time. */
  paidAt: Date | null;
  paymentIntentId: string | null;
  chargeId: string | null;
  /**
   * Stripe confirms the money moved: the payment intent succeeded with at
   * least this amount received and its charge was captured. Unverified
   * collections never earn commission.
   */
  verified: boolean;
  /** Recorded as paid outside Stripe (a payment record): never commissionable. */
  outOfBand: boolean;
};

export type NormalizedInvoice = {
  environment: Environment;
  invoiceId: string;
  customerId: string | null;
  subscriptionId: string | null;
  currency: string;
  status: string | null;
  billingReason: string | null;
  total: bigint;
  subtotal: bigint;
  tax: bigint;
  discount: bigint;
  startingBalance: bigint;
  amountPaid: bigint;
  amountPaidOffStripe: bigint;
  allLinesSubscription: boolean;
  linesComplete: boolean;
  /** Stripe promotion code ids redeemed on this invoice. */
  promotionCodeIds: string[];
  collections: NormalizedCollection[];
  /** What the calculation is reproduced from. No personal data. */
  evidence: Record<string, unknown>;
};

export type NormalizedDispute = { id: string; status: string; amount: bigint; currency: string };

export type NormalizedCharge = {
  environment: Environment;
  chargeId: string;
  paymentIntentId: string | null;
  currency: string;
  amount: bigint;
  /** Cumulative, as Stripe reports it now. */
  refunded: bigint;
  disputes: NormalizedDispute[];
};

export interface BillingSource {
  /** The environment of the configured credentials. */
  environment(): Environment;
  loadInvoice(invoiceId: string): Promise<NormalizedInvoice>;
  loadCharge(chargeId: string): Promise<NormalizedCharge>;
  /** Invoices a payment intent paid (via Stripe invoice payments). */
  invoiceIdsForPaymentIntent(paymentIntentId: string): Promise<string[]>;
  /** The charge behind a dispute or refund, when the event names only that. */
  chargeForDispute(disputeId: string): Promise<string | null>;
}

/* ----------------------------------------------------------------- coupons */

export type CouponSpec = {
  name: string;
  /** Basis points; mutually exclusive with amountOff. */
  percentOffBasisPoints: number | null;
  amountOff: bigint | null;
  currency: string | null;
  duration: "once" | "repeating" | "forever";
  durationInMonths: number | null;
  appliesToProducts: string[];
  code: string;
  expiresAt: Date | null;
  maxRedemptions: number | null;
  firstTimeTransaction: boolean;
  metadata: Record<string, string>;
  idempotencyKey: string;
};

export interface CouponGateway {
  createCouponWithCode(spec: CouponSpec): Promise<{ couponId: string; promotionCodeId: string }>;
  deactivatePromotionCode(promotionCodeId: string): Promise<void>;
  /** Product ids and their recurring intervals, to validate a campaign's restrictions. */
  productIntervals(productIds: string[]): Promise<Record<string, string[]>>;
}
