import type { ApplicationAnswers, ApplicationStatus } from "../../domain/entities/application";
import type { AttributionSource, AttributionStatus } from "../../domain/entities/attribution";
import type { CommissionStatus, ReviewState } from "../../domain/entities/commission";
import type { PartnerStatus } from "../../domain/entities/partner";
import type {
  BankPayoutStatus,
  SettlementState,
  TransferStatus,
} from "../../domain/entities/settlement";
import type { ProgramPolicy } from "../../domain/policies/program";
import type { PartnerAuditAction } from "../contracts/commands";

/**
 * Persistence ports, owned by the application layer and implemented with
 * Drizzle in infrastructure/persistence. Narrow by design: one interface per
 * aggregate, with the operations the use cases actually perform - no generic
 * repository. Every method of a repository obtained inside
 * UnitOfWork.transaction runs in that transaction.
 *
 * Methods named `lock...` take a row lock (SELECT ... FOR UPDATE). Callers
 * lock in one order everywhere - partner, balance projection, attribution,
 * commissions, settlement - so two transactions cannot deadlock on them.
 */

export type Environment = "test" | "live";

/* ---------------------------------------------------------------- program */

export type ProgramVersion = { id: string; policy: ProgramPolicy; effectiveFrom: Date };

export interface ProgramRepository {
  /** The version in force at `at` (the latest with effectiveFrom <= at, else the earliest). */
  versionAt(at: Date): Promise<ProgramVersion>;
  current(): Promise<ProgramVersion>;
}

export type PartnerControlKey = "partner_program" | "partner_commissions" | "partner_payouts";

export interface ControlsRepository {
  isEnabled(key: PartnerControlKey): Promise<boolean>;
  read(): Promise<Record<PartnerControlKey, { enabled: boolean; reason: string | null; updatedBy: string | null; updatedAt: Date | null }>>;
  write(key: PartnerControlKey, enabled: boolean, meta: { reason: string; actor: string }): Promise<void>;
}

/* ---------------------------------------------------- applications, partners */

export type ApplicationRecord = {
  id: string;
  userId: string | null;
  status: ApplicationStatus;
  answers: ApplicationAnswers;
  applicantEmail: string;
  applicantName: string;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewedByEmail: string | null;
  reviewReason: string | null;
};

export interface ApplicationRepository {
  findOpenByUser(userId: string): Promise<ApplicationRecord | null>;
  latestByUser(userId: string): Promise<ApplicationRecord | null>;
  /** Null when the user already has an open application (unique index). */
  create(input: Omit<ApplicationRecord, "id" | "status" | "reviewedAt" | "reviewedByEmail" | "reviewReason">): Promise<ApplicationRecord | null>;
  lock(id: string): Promise<ApplicationRecord | null>;
  decide(id: string, decision: { status: ApplicationStatus; reviewedAt: Date; reviewedByEmail: string; reason: string | null }): Promise<void>;
  list(filter: { status?: ApplicationStatus; search?: string; offset: number; limit: number }): Promise<{ rows: ApplicationRecord[]; total: number }>;
}

export type PartnerRecord = {
  id: string;
  userId: string | null;
  referralCode: string;
  status: PartnerStatus;
  tierKey: string;
  qualifyingCustomers: number;
  displayName: string;
  contactEmail: string;
  country: string | null;
  applicationId: string | null;
  approvedAt: Date;
  approvedByEmail: string;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  payoutHoldReason: string | null;
  welcomeEmailSentAt: Date | null;
};

export type ReferralCodeRecord = {
  code: string;
  createdAt: Date;
  createdByEmail: string | null;
  /** Set once the partner was given another name; the link still works. */
  retiredAt: Date | null;
};

export interface PartnerRepository {
  findById(id: string): Promise<PartnerRecord | null>;
  findByUserId(userId: string): Promise<PartnerRecord | null>;
  /** By the current link name or an earlier one (a renamed partner's old links keep working). */
  findByReferralCode(code: string): Promise<PartnerRecord | null>;
  lock(id: string): Promise<PartnerRecord | null>;
  /** Serialises link-name claims (approval, rename) until the transaction ends. */
  lockReferralCodes(): Promise<void>;
  /** Who has, or had, this link name. */
  referralCodeOwner(code: string): Promise<{ partnerId: string; retiredAt: Date | null } | null>;
  /** Every name the partner has had, the current one first. */
  referralCodes(partnerId: string): Promise<ReferralCodeRecord[]>;
  /**
   * Gives the partner a new current link name; the old one is retired and
   * keeps working. Taking back one of the partner's own earlier names is
   * allowed. Call under lockReferralCodes() after referralCodeOwner().
   */
  renameReferralCode(partnerId: string, change: { from: string; to: string; at: Date; byEmail: string }): Promise<void>;
  /**
   * Creates the user's profile, or returns the existing one (ON CONFLICT on
   * user_id): an approval retried or raced never makes a second profile.
   * `created` says which happened. Null if the referral code is taken (now
   * or earlier, by another partner); a new profile's name is recorded in
   * partner_referral_codes.
   */
  createOrGet(input: {
    userId: string;
    referralCode: string;
    displayName: string;
    contactEmail: string;
    country: string | null;
    applicationId: string;
    approvedAt: Date;
    approvedByEmail: string;
  }): Promise<{ partner: PartnerRecord; created: boolean } | null>;
  setStatus(id: string, status: PartnerStatus, meta: { at: Date; reason: string | null }): Promise<void>;
  setPayoutHold(id: string, hold: { reason: string; at: Date; by: string } | null): Promise<void>;
  setTierProjection(id: string, tierKey: string, qualifyingCustomers: number): Promise<void>;
  /** Claims the one welcome email: true only for the first caller. */
  claimWelcomeEmail(id: string, at: Date): Promise<boolean>;
  releaseWelcomeEmail(id: string): Promise<void>;
  list(filter: { status?: PartnerStatus; search?: string; offset: number; limit: number }): Promise<{ rows: PartnerRecord[]; total: number }>;
  listActiveIds(): Promise<string[]>;
};

export type TierPeriodRecord = {
  id: string;
  partnerId: string;
  tierKey: string;
  rateBasisPoints: number;
  programVersion: number;
  qualifyingCustomers: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

export interface TierRepository {
  periods(partnerId: string): Promise<TierPeriodRecord[]>;
  /** Closes the open period at `at` and opens a new one, in the caller's transaction. */
  open(input: Omit<TierPeriodRecord, "id" | "effectiveTo"> & { evidence: Record<string, unknown> }): Promise<void>;
  /** Distinct organizations that currently qualify for tier counting (see domain/policies/tiers.ts). */
  qualifyingOrganizations(partnerId: string, environment: Environment, at: Date): Promise<string[]>;
}

/* ------------------------------------------------- tracking and attribution */

export type ClickRecord = {
  id: string;
  partnerId: string;
  clickedAt: Date;
  expiresAt: Date;
};

export type EligibilityRecord = {
  id: string;
  userId: string;
  signedUpAt: Date;
  signupMethod: string;
  eligible: boolean;
  exclusions: string[];
  foundingOrganizationId: string | null;
  clickId: string | null;
  candidatePartnerId: string | null;
  linkOutcome: string;
  couponDeadline: Date;
  /** Booleans computed at signup against the link's partner. */
  fraudSignals: { sharedNetwork: boolean; sharedDevice: boolean };
  /** Keyed hashes of the signup's network and browser, to compare with another partner's sessions later. */
  signupNetworkHash: string | null;
  signupDeviceHash: string | null;
};

export interface TrackingRepository {
  createClick(input: {
    partnerId: string;
    tokenHash: string;
    clickedAt: Date;
    expiresAt: Date;
    landingPath: string | null;
    referrerHost: string | null;
    visitorHash: string | null;
  }): Promise<ClickRecord>;
  findClickByTokenHash(tokenHash: string): Promise<ClickRecord | null>;
  /** A click by this visitor for this partner since `since`: a reload is not a new click. */
  recentClick(partnerId: string, visitorHash: string, since: Date): Promise<ClickRecord | null>;
  findEligibility(userId: string): Promise<EligibilityRecord | null>;
  findEligibilityByOrganization(organizationId: string): Promise<EligibilityRecord | null>;
  /** Null when the user already has a record (unique index): eligibility is captured once. */
  createEligibility(input: Omit<EligibilityRecord, "id">): Promise<EligibilityRecord | null>;
  setFoundingOrganization(eligibilityId: string, organizationId: string): Promise<void>;
  purgeClicks(before: Date): Promise<number>;
}

export type AttributionRecord = {
  id: string;
  organizationId: string;
  foundingUserId: string;
  partnerId: string;
  source: AttributionSource;
  clickId: string | null;
  couponId: string | null;
  status: AttributionStatus;
  lockedAt: Date;
  ruleVersion: number;
  windowStartsAt: Date | null;
  windowEndsAt: Date | null;
  reviewReason: string | null;
};

export interface AttributionRepository {
  findByOrganization(organizationId: string): Promise<AttributionRecord | null>;
  findById(id: string): Promise<AttributionRecord | null>;
  lockByOrganization(organizationId: string): Promise<AttributionRecord | null>;
  lock(id: string): Promise<AttributionRecord | null>;
  /**
   * Inserts the organization's attribution, or returns the existing one
   * unchanged (ON CONFLICT DO NOTHING on organization_id): locked means
   * locked, whichever request arrives first.
   */
  createOrGet(input: Omit<AttributionRecord, "id" | "windowStartsAt" | "windowEndsAt"> & {
    fraudSignals: Record<string, unknown>;
  }): Promise<{ attribution: AttributionRecord; created: boolean }>;
  setWindow(id: string, window: { startsAt: Date; endsAt: Date }): Promise<void>;
  setStatus(id: string, status: AttributionStatus, meta: { reason: string; by: string; at: Date }): Promise<void>;
  /** The partner's user is a member of the organization (self-referral). */
  isPartnerMember(organizationId: string, partnerUserId: string | null): Promise<boolean>;
  /** A legacy credit referral names this organization as referred. */
  hasLegacyCreditReferral(organizationId: string): Promise<boolean>;
}

/* --------------------------------------------- payments, commissions, ledger */

export type PaymentFactRecord = {
  id: string;
  environment: Environment;
  invoicePaymentId: string;
  invoiceId: string;
  paymentIntentId: string | null;
  chargeId: string | null;
  organizationId: string;
  attributionId: string | null;
  currency: string;
  cashCollected: bigint;
  eligibleBase: bigint;
  taxShare: bigint;
  paidAt: Date;
  refundedAmount: bigint;
  disputeLostAmount: bigint;
  disputeId: string | null;
  disputeStatus: string | null;
  outcome: string;
};

export type NewPaymentFact = Omit<PaymentFactRecord, "id" | "refundedAmount" | "disputeLostAmount" | "disputeId" | "disputeStatus"> & {
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
  paymentId: string | null;
  invoiceTotal: bigint;
  invoiceTax: bigint;
  invoiceDiscount: bigint;
  invoiceSubtotal: bigint;
  invoiceStartingBalance: bigint;
  invoiceAmountPaid: bigint;
  evidence: Record<string, unknown>;
  evidenceVersion: number;
  syncedAt: Date;
};

export type CommissionRecord = {
  id: string;
  environment: Environment;
  partnerId: string;
  attributionId: string;
  paymentFactId: string;
  currency: string;
  baseAmount: bigint;
  rateBasisPoints: number;
  tierKey: string;
  amount: bigint;
  reversedAmount: bigint;
  programVersion: number;
  earnedAt: Date;
  maturesAt: Date;
  status: CommissionStatus;
  reviewState: ReviewState;
  holdReason: string | null;
  paidSettlementId: string | null;
};

export type LedgerKind = "commission_earned" | "commission_adjustment" | "transfer_confirmed" | "transfer_reversal";

export type LedgerEntryInput = {
  environment: Environment;
  partnerId: string;
  currency: string;
  kind: LedgerKind;
  /** Signed effect on what RepGet owes the partner. */
  amount: bigint;
  operationKey: string;
  commissionId?: string | null;
  settlementId?: string | null;
  paymentFactId?: string | null;
  reason: string;
  actor: string;
};

export interface CommissionRepository {
  findFact(environment: Environment, invoicePaymentId: string): Promise<PaymentFactRecord | null>;
  lockFact(id: string): Promise<PaymentFactRecord | null>;
  factsByCharge(environment: Environment, chargeId: string): Promise<PaymentFactRecord[]>;
  factsByInvoice(environment: Environment, invoiceId: string): Promise<PaymentFactRecord[]>;
  /** Inserts the fact or returns the existing one (ON CONFLICT DO NOTHING). */
  createFactOrGet(input: NewPaymentFact): Promise<{ fact: PaymentFactRecord; created: boolean }>;
  updateFactAdjustments(id: string, values: {
    refundedAmount: bigint;
    disputeLostAmount: bigint;
    disputeId: string | null;
    disputeStatus: string | null;
    syncedAt: Date;
  }): Promise<void>;
  setFactOutcome(id: string, outcome: string): Promise<void>;
  /** Cash collected for the organization before `before` (any fact with cash > 0). */
  hasPriorCash(environment: Environment, organizationId: string, before: Date, excludingFactId: string): Promise<boolean>;
  earliestQualifyingPaidAt(environment: Environment, organizationId: string): Promise<Date | null>;
  findCommissionByFact(paymentFactId: string): Promise<CommissionRecord | null>;
  lockCommission(id: string): Promise<CommissionRecord | null>;
  /** Null when the fact already has a commission (unique index). */
  createCommission(input: Omit<CommissionRecord, "id" | "reversedAmount" | "paidSettlementId"> & { programVersionId: string }): Promise<CommissionRecord | null>;
  updateCommission(id: string, values: Partial<Pick<CommissionRecord, "status" | "reviewState" | "holdReason" | "reversedAmount" | "paidSettlementId">>): Promise<void>;
  commissionsForPartner(partnerId: string, environment: Environment, currency: string): Promise<CommissionRecord[]>;
  lockPayableCandidates(partnerId: string, environment: Environment, currency: string): Promise<CommissionRecord[]>;
  /** Appends a ledger entry; false when its operation key already exists. */
  appendLedger(entry: LedgerEntryInput): Promise<boolean>;
  ledgerSum(partnerId: string, environment: Environment, currency: string): Promise<{
    liability: bigint;
    netEarned: bigint;
    netTransferred: bigint;
  }>;
  ledgerTotalFor(commissionId: string, kind: LedgerKind): Promise<bigint>;
  /** How many ledger entries of a kind a commission has (sequence for adjustment keys). */
  countLedger(commissionId: string, kind: LedgerKind): Promise<number>;
  /** Partner/currency pairs that have any commission (for projections and runs). */
  balancesToConsider(environment: Environment): Promise<{ partnerId: string; currency: string }[]>;
  pendingMaturity(environment: Environment, now: Date): Promise<string[]>;
}

/* ------------------------------------------------------ settlements, payouts */

export type SettlementRecord = {
  id: string;
  environment: Environment;
  partnerId: string;
  currency: string;
  runKey: string;
  state: SettlementState;
  grossAmount: bigint;
  offsetAmount: bigint;
  transferAmount: bigint;
  stripeAccountId: string;
  transferGroup: string;
  attempts: number;
  nextAttemptAt: Date;
  lastError: string | null;
  createdAt: Date;
  transferredAt: Date | null;
  paidAt: Date | null;
  /** Set when a person resumed it after review. */
  resumedAt: Date | null;
};

export type TransferAttemptRecord = {
  id: string;
  settlementId: string;
  attemptNumber: number;
  operationId: string;
  environment: Environment;
  stripeAccountId: string;
  currency: string;
  amount: bigint;
  status: TransferStatus;
  stripeTransferId: string | null;
  amountReversed: bigint;
  submittedAt: Date | null;
  updatedAt: Date;
};

export type BankPayoutAttemptRecord = {
  id: string;
  settlementId: string;
  attemptNumber: number;
  operationId: string;
  environment: Environment;
  stripeAccountId: string;
  currency: string;
  amount: bigint;
  status: BankPayoutStatus;
  stripePayoutId: string | null;
  submittedAt: Date | null;
  updatedAt: Date;
};

export type TransferReversalRecord = {
  id: string;
  transferAttemptId: string;
  operationId: string;
  amount: bigint;
  currency: string;
  status: "processing" | "confirmed" | "failed" | "unknown";
  stripeReversalId: string | null;
};

export interface SettlementRepository {
  /** Locks (creating if absent) the partner/environment/currency projection row: the payout serialisation point. */
  lockBalance(partnerId: string, environment: Environment, currency: string, now: Date): Promise<void>;
  writeProjection(partnerId: string, environment: Environment, currency: string, values: {
    netEarned: bigint;
    netTransferred: bigint;
    liability: bigint;
    pending: bigint;
    available: bigint;
    reserved: bigint;
    held: bigint;
    bankPaid: bigint;
    rebuiltAt: Date;
  }): Promise<void>;
  reservedInFlight(partnerId: string, environment: Environment, currency: string): Promise<bigint>;
  bankPaidTotal(partnerId: string, environment: Environment, currency: string): Promise<bigint>;
  /** Null when this run already has a settlement, or another is still pre-transfer (unique indexes). */
  create(input: Omit<SettlementRecord, "id" | "state" | "attempts" | "nextAttemptAt" | "lastError" | "createdAt" | "transferredAt" | "paidAt" | "resumedAt"> & {
    createdBy: string;
    items: { commissionId: string; amount: bigint }[];
    now: Date;
  }): Promise<SettlementRecord | null>;
  findById(id: string): Promise<SettlementRecord | null>;
  lock(id: string): Promise<SettlementRecord | null>;
  /** Takes the settlement's work lease; null when someone else holds it. */
  claim(id: string, token: string, until: Date, now: Date): Promise<SettlementRecord | null>;
  releaseClaim(id: string, token: string, values: { nextAttemptAt: Date; lastError: string | null }): Promise<void>;
  setState(id: string, from: SettlementState[], to: SettlementState, values?: {
    transferredAt?: Date;
    paidAt?: Date;
    canceledReason?: string;
    reviewReason?: string;
    lastError?: string | null;
    resumedAt?: Date;
  }): Promise<boolean>;
  items(settlementId: string, activeOnly?: boolean): Promise<{ commissionId: string; amount: bigint; active: boolean }[]>;
  deactivateItems(settlementId: string): Promise<void>;
  due(now: Date, limit: number): Promise<string[]>;
  list(filter: { environment: Environment; partnerId?: string; state?: SettlementState; offset: number; limit: number }): Promise<{ rows: SettlementRecord[]; total: number }>;

  transferAttempts(settlementId: string): Promise<TransferAttemptRecord[]>;
  createTransferAttempt(input: Omit<TransferAttemptRecord, "id" | "status" | "stripeTransferId" | "amountReversed" | "submittedAt" | "updatedAt"> & { submittedAt: Date }): Promise<TransferAttemptRecord | null>;
  updateTransferAttempt(id: string, from: TransferStatus[], values: {
    status: TransferStatus;
    stripeTransferId?: string | null;
    stripeBalanceTransactionId?: string | null;
    amountReversed?: bigint;
    failureCode?: string | null;
    failureMessage?: string | null;
    confirmedAt?: Date | null;
    checkedAt: Date;
  }): Promise<boolean>;
  findTransferAttemptByStripeId(stripeTransferId: string): Promise<TransferAttemptRecord | null>;

  payoutAttempts(settlementId: string): Promise<BankPayoutAttemptRecord[]>;
  createPayoutAttempt(input: Omit<BankPayoutAttemptRecord, "id" | "status" | "stripePayoutId" | "submittedAt" | "updatedAt"> & { submittedAt: Date }): Promise<BankPayoutAttemptRecord | null>;
  updatePayoutAttempt(id: string, from: BankPayoutStatus[], values: {
    status: BankPayoutStatus;
    stripePayoutId?: string | null;
    arrivalDate?: Date | null;
    failureCode?: string | null;
    failureMessage?: string | null;
    paidAt?: Date | null;
    failedAt?: Date | null;
    checkedAt: Date;
  }): Promise<boolean>;
  findPayoutAttemptByStripeId(stripeAccountId: string, stripePayoutId: string): Promise<BankPayoutAttemptRecord | null>;
  /** By our operation id (the payout's repget_operation_id metadata), on that connected account. */
  findPayoutAttemptByOperationId(stripeAccountId: string, operationId: string): Promise<BankPayoutAttemptRecord | null>;

  createReversal(input: Omit<TransferReversalRecord, "id" | "status" | "stripeReversalId"> & { reason: string; requestedBy: string }): Promise<TransferReversalRecord | null>;
  updateReversal(id: string, values: { status: TransferReversalRecord["status"]; stripeReversalId?: string | null; failureMessage?: string | null; confirmedAt?: Date | null }): Promise<void>;
  reversals(transferAttemptId: string): Promise<TransferReversalRecord[]>;
}

/* ----------------------------------------------------------- Stripe accounts */

export type StripeAccountStatus =
  | "creating"
  | "onboarding"
  | "verification_pending"
  | "restricted"
  | "ready"
  | "deauthorized";

export type StripeAccountRecord = {
  id: string;
  partnerId: string;
  environment: Environment;
  stripeAccountId: string | null;
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
  creationKey: string;
  lastSyncedAt: Date | null;
  createdAt: Date;
};

export type AccountReadinessValues = Pick<
  StripeAccountRecord,
  | "status"
  | "country"
  | "defaultCurrency"
  | "detailsSubmitted"
  | "payoutsEnabled"
  | "transfersCapability"
  | "requirementsCurrentlyDue"
  | "requirementsPastDue"
  | "requirementsPendingVerification"
  | "disabledReason"
  | "currentDeadline"
  | "payoutInterval"
>;

export interface StripeAccountRepository {
  find(partnerId: string, environment: Environment): Promise<StripeAccountRecord | null>;
  findByStripeId(stripeAccountId: string): Promise<StripeAccountRecord | null>;
  /** Reserves the partner's one account row for this environment (ON CONFLICT DO NOTHING). */
  reserve(partnerId: string, environment: Environment, creationKey: string, country: string | null, now: Date): Promise<StripeAccountRecord>;
  attach(id: string, stripeAccountId: string): Promise<void>;
  updateReadiness(id: string, values: AccountReadinessValues & { syncedAt: Date }): Promise<void>;
  list(environment: Environment): Promise<StripeAccountRecord[]>;
}

/* ------------------------------------------------------------------ coupons */

export type CouponRecord = {
  id: string;
  environment: Environment;
  partnerId: string;
  code: string;
  campaign: string;
  discountType: string;
  percentOffBasisPoints: number | null;
  amountOff: bigint | null;
  currency: string | null;
  duration: "once" | "repeating" | "forever";
  durationInMonths: number | null;
  appliesToProducts: string[];
  startsAt: Date | null;
  expiresAt: Date | null;
  maxRedemptions: number | null;
  firstTimeTransaction: boolean;
  stripeCouponId: string | null;
  stripePromotionCodeId: string | null;
  status: "creating" | "active" | "inactive" | "failed";
};

export interface CouponRepository {
  create(input: Omit<CouponRecord, "id" | "stripeCouponId" | "stripePromotionCodeId" | "status"> & { createdByEmail: string }): Promise<CouponRecord | null>;
  attachStripe(id: string, values: { stripeCouponId: string; stripePromotionCodeId: string }, status: CouponRecord["status"]): Promise<void>;
  setStatus(id: string, status: CouponRecord["status"], at: Date): Promise<void>;
  findById(id: string): Promise<CouponRecord | null>;
  findByPromotionCode(environment: Environment, stripePromotionCodeId: string): Promise<CouponRecord | null>;
  forPartner(partnerId: string, environment: Environment): Promise<CouponRecord[]>;
  list(environment: Environment, filter: { offset: number; limit: number; search?: string }): Promise<{ rows: CouponRecord[]; total: number }>;
  /** Scheduled coupons whose start has come (created at Stripe, not yet active), oldest first. */
  dueToActivate(environment: Environment, now: Date, limit: number): Promise<CouponRecord[]>;
}

/* ------------------------------------------------------------- review cases */

export type ReviewCaseKind =
  | "attribution_conflict"
  | "coupon_conflict"
  | "credit_cash_conflict"
  | "fraud_signal"
  | "financial_inconsistency"
  | "dispute"
  | "payout_discrepancy"
  | "transfer_unknown"
  | "payout_funding"
  | "unexpected_payout"
  | "reconciliation";

export type ReviewCaseRecord = {
  id: string;
  kind: ReviewCaseKind;
  status: "open" | "resolved" | "dismissed";
  dedupeKey: string;
  environment: Environment | null;
  partnerId: string | null;
  attributionId: string | null;
  commissionId: string | null;
  settlementId: string | null;
  paymentFactId: string | null;
  organizationId: string | null;
  summary: string;
  evidence: Record<string, unknown>;
  resolution: string | null;
  resolutionReason: string | null;
  resolvedByEmail: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
};

export interface ReviewCaseRepository {
  /** Opens a case, or returns the existing one with the same dedupe key. */
  open(input: Omit<ReviewCaseRecord, "id" | "status" | "resolution" | "resolutionReason" | "resolvedByEmail" | "resolvedAt" | "createdAt">): Promise<{ reviewCase: ReviewCaseRecord; created: boolean }>;
  findById(id: string): Promise<ReviewCaseRecord | null>;
  lock(id: string): Promise<ReviewCaseRecord | null>;
  resolve(id: string, values: { status: "resolved" | "dismissed"; resolution: string; reason: string; by: string; at: Date }): Promise<boolean>;
  list(filter: { status?: ReviewCaseRecord["status"]; kind?: ReviewCaseKind; partnerId?: string; offset: number; limit: number }): Promise<{ rows: ReviewCaseRecord[]; total: number }>;
}

/* ---------------------------------------------------------- provider events */

export type ProviderEventRecord = {
  id: string;
  environment: Environment;
  stripeEventId: string;
  eventType: string;
  objectId: string;
  connectedAccountId: string | null;
  eventCreatedAt: Date;
  status: "pending" | "processing" | "done" | "ignored" | "failed";
  attempts: number;
};

export interface ProviderEventRepository {
  /** Records owed work once per Stripe event id. */
  record(input: Omit<ProviderEventRecord, "id" | "status" | "attempts"> & { now: Date }): Promise<{ id: string; created: boolean }>;
  /** Claims due work with a token and lease. */
  claimDue(now: Date, token: string, leaseUntil: Date, limit: number, onlyIds?: string[]): Promise<ProviderEventRecord[]>;
  complete(id: string, token: string, values: { status: "done" | "ignored"; outcome: string; at: Date }): Promise<boolean>;
  release(id: string, token: string, values: { error: string; nextAttemptAt: Date; failed: boolean }): Promise<boolean>;
  backlog(): Promise<{ status: string; count: number }[]>;
  /** Puts work that failed every attempt back in the queue, due now; returns how many. */
  retryFailed(now: Date): Promise<number>;
}

/* ----------------------------------------------------- audit, outbox, mailer */

export type AuditEntry = {
  actorEmail: string;
  action: PartnerAuditAction;
  targetType: string;
  targetId: string | null;
  summary: string;
  detail?: Record<string, unknown>;
};

export interface AuditLog {
  record(entry: AuditEntry): Promise<void>;
}

/* ----------------------------------------------------------- reconciliation */

export type ReconciliationFinding = { kind: string; subject: string; detail: Record<string, string | number | null> };

/**
 * Read-only checks that compare independent records. Findings are reported
 * (and turned into review cases or recovered work by the use case) - never
 * "fixed" by editing financial rows.
 */
export interface ReconciliationRepository {
  /** Stripe payments of real money for attributed customers with no payment fact: a missed or unprocessed event. */
  paymentsWithoutFacts(environment: Environment, limit: number): Promise<{ invoiceId: string; organizationId: string }[]>;
  /** Facts that say "commissioned" with no commission row. */
  factsWithoutCommission(environment: Environment, limit: number): Promise<ReconciliationFinding[]>;
  /** A commission whose earned entry is missing, duplicated or of another amount. */
  earnedMismatches(environment: Environment, limit: number): Promise<ReconciliationFinding[]>;
  /** A commission whose recorded reversal differs from its reversal ledger entries. */
  reversalMismatches(environment: Environment, limit: number): Promise<ReconciliationFinding[]>;
  /** Stored balance projections, for comparison with a fresh computation. */
  projections(environment: Environment): Promise<{ partnerId: string; currency: string; values: Record<string, bigint> }[]>;
}

/* ---------------------------------------------------------------- reporting */

export type CommissionView = {
  id: string;
  partnerId: string;
  organizationId: string;
  paidAt: Date;
  currency: string;
  baseAmount: bigint;
  rateBasisPoints: number;
  tierKey: string;
  amount: bigint;
  reversedAmount: bigint;
  status: CommissionRecord["status"];
  reviewState: CommissionRecord["reviewState"];
  holdReason: string | null;
  maturesAt: Date;
  settlementId: string | null;
  /** The Stripe price the payment's invoice charged (first subscription line), when recorded. */
  priceId: string | null;
  stripeSubscriptionId: string | null;
};

export type SettlementView = SettlementRecord & {
  transferStatus: TransferStatus | null;
  stripeTransferId: string | null;
  bankStatus: BankPayoutStatus | null;
  bankPaidAt: Date | null;
  bankArrivalDate: Date | null;
};

export type ReferralView = {
  attributionId: string;
  organizationId: string;
  source: AttributionSource;
  status: AttributionStatus;
  lockedAt: Date;
  windowEndsAt: Date | null;
  payments: number;
};

export type LedgerView = {
  id: string;
  partnerId: string;
  currency: string;
  kind: "commission_earned" | "commission_adjustment" | "transfer_confirmed" | "transfer_reversal";
  amount: bigint;
  operationKey: string;
  commissionId: string | null;
  settlementId: string | null;
  reason: string;
  actor: string;
  createdAt: Date;
};

export type BalanceView = {
  currency: string;
  netEarned: bigint;
  netTransferred: bigint;
  liability: bigint;
  pending: bigint;
  available: bigint;
  reserved: bigint;
  held: bigint;
  bankPaid: bigint;
  rebuiltAt: Date;
};

/**
 * Dedicated read queries for dashboards and exports - the SAME records the
 * financial code writes (ledger projections, commissions, settlements),
 * never totals recomputed in a page. Partner queries take the partner id the
 * guard derived from the session.
 */
export interface ReportingRepository {
  balances(partnerId: string, environment: Environment): Promise<BalanceView[]>;
  /** Every currency the partner has ledger entries in (each commission writes one when earned). */
  currencies(partnerId: string, environment: Environment): Promise<string[]>;
  metrics(partnerId: string, environment: Environment, since: Date): Promise<{ clicks: number; signups: number; customers: number; payingCustomers: number }>;
  /** All time: customers attributed to the partner (link or coupon), disqualified ones not counted. */
  referralTotal(partnerId: string): Promise<number>;
  /** `from` inclusive, `to` exclusive (UTC), on the payment date. */
  commissions(filter: { environment: Environment; partnerId?: string; status?: string; review?: string; held?: boolean; from?: Date; to?: Date; offset: number; limit: number }): Promise<{ rows: CommissionView[]; total: number }>;
  /** `from` inclusive, `to` exclusive (UTC), on the creation date. */
  settlements(filter: { environment: Environment; partnerId?: string; state?: string; excludeStates?: string[]; from?: Date; to?: Date; offset: number; limit: number }): Promise<{ rows: SettlementView[]; total: number }>;
  referrals(filter: { partnerId?: string; status?: string; offset: number; limit: number }): Promise<{ rows: (ReferralView & { partnerId: string })[]; total: number }>;
  /** The immutable ledger, newest first: the transaction history behind every balance. */
  ledger(filter: { environment: Environment; partnerId?: string; currency?: string; settlementId?: string; from?: Date; to?: Date; offset: number; limit: number }): Promise<{ rows: LedgerView[]; total: number }>;
}
