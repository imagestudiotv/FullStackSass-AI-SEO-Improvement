/**
 * The cash partner (affiliate) program's tables. Re-exported by ./schema.
 *
 * Separate from the legacy credit referral program (referral_codes,
 * referrals), which pays organizations in account credit and is unchanged.
 *
 * FINANCIAL HISTORY OUTLIVES ACCOUNTS. Rows that record money - attributions,
 * payment facts, commissions, ledger entries, settlements, transfer and payout
 * attempts - reference customer organizations and users by TEXT id without a
 * foreign key (like admin_audit_log), and reference each other with ON DELETE
 * RESTRICT. Deleting a workspace or a user can never cascade into them.
 *
 * Money is integer minor units in bigint columns with an explicit currency
 * column; never numeric, never a float. Every Stripe-derived row carries an
 * `environment` ("test" | "live") so test and live provider ids never mix.
 *
 * See docs/partner-program.md for the design.
 */

import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// Every table gets Row Level Security - see ./table.ts.
import { pgTable } from "./table";

import { user } from "./auth-tables";
import { pk, timestamps } from "./columns";

const money = (name: string) => bigint(name, { mode: "bigint" });

/* ------------------------------------------------------------------------- */
/* Program policy                                                             */
/* ------------------------------------------------------------------------- */

/**
 * Versioned program rules: tiers and rates, attribution and eligibility
 * windows, maturity, payout thresholds. A commission records the version it
 * was calculated under; a new version never changes past commissions.
 */
export const partnerProgramVersions = pgTable(
  "partner_program_versions",
  {
    id: pk(),
    version: integer("version").notNull(),
    /** Validated by parseProgramPolicy (lib/partners/domain/policies/program.ts). */
    policy: jsonb("policy").notNull(),
    effectiveFrom: timestamp("effective_from").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("partner_program_versions_version_uidx").on(table.version)],
);

/* ------------------------------------------------------------------------- */
/* Applications and partners                                                  */
/* ------------------------------------------------------------------------- */

export const partnerApplications = pgTable(
  "partner_applications",
  {
    id: pk(),
    /** The applicant's existing RepGet login. Set null if the user is deleted; the row stays. */
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    /** submitted | approved | rejected | withdrawn */
    status: text("status").default("submitted").notNull(),
    /** { website, audience, promotion, country } */
    answers: jsonb("answers").notNull(),
    applicantEmail: text("applicant_email").notNull(),
    applicantName: text("applicant_name").notNull(),
    submittedAt: timestamp("submitted_at").notNull(),
    reviewedAt: timestamp("reviewed_at"),
    reviewedByEmail: text("reviewed_by_email"),
    reviewReason: text("review_reason"),
    ...timestamps,
  },
  (table) => [
    // One open application per user.
    uniqueIndex("partner_applications_open_uidx")
      .on(table.userId)
      .where(sql`${table.status} = 'submitted'`),
    index("partner_applications_status_idx").on(table.status, table.submittedAt),
    check(
      "partner_applications_status_check",
      sql`${table.status} in ('submitted', 'approved', 'rejected', 'withdrawn')`,
    ),
  ],
);

export const partnerProfiles = pgTable(
  "partner_profiles",
  {
    id: pk(),
    /** One profile per user, ever: approval retries cannot make a second. */
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    /**
     * The current link name (?ref=<code>), lower case
     * (lib/partners/domain/entities/partner.ts). Every name a partner has
     * had, this one included, is in partner_referral_codes.
     */
    referralCode: text("referral_code").notNull(),
    /** active | suspended */
    status: text("status").default("active").notNull(),
    /** Projection of the current tier (partner_tier_history is the record). */
    tierKey: text("tier_key").default("base").notNull(),
    qualifyingCustomers: integer("qualifying_customers").default(0).notNull(),
    displayName: text("display_name").notNull(),
    contactEmail: text("contact_email").notNull(),
    /** ISO 3166-1 alpha-2, from the application; the Stripe account is created in it. */
    country: text("country"),
    applicationId: uuid("application_id").references(() => partnerApplications.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at").notNull(),
    approvedByEmail: text("approved_by_email").notNull(),
    suspendedAt: timestamp("suspended_at"),
    suspendedReason: text("suspended_reason"),
    /** No automatic payouts while set. Administrators only. */
    payoutHoldReason: text("payout_hold_reason"),
    payoutHoldSetAt: timestamp("payout_hold_set_at"),
    payoutHoldBy: text("payout_hold_by"),
    /** Set when the one welcome email was handed to the mailer. */
    welcomeEmailSentAt: timestamp("welcome_email_sent_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("partner_profiles_user_uidx").on(table.userId),
    uniqueIndex("partner_profiles_code_uidx").on(table.referralCode),
    check("partner_profiles_status_check", sql`${table.status} in ('active', 'suspended')`),
  ],
);

/**
 * Every link name a partner has had: the current one (also in
 * partner_profiles.referral_code) and, after a rename, the earlier ones
 * (retired_at set), which keep attributing clicks to the same partner. The
 * primary key means a name is never given to two partners, even after a
 * rename. Claims are serialised by an advisory lock (repositories/partners.ts).
 */
export const partnerReferralCodes = pgTable(
  "partner_referral_codes",
  {
    code: text("code").primaryKey(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partnerProfiles.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    /** The administrator who chose it (null for names that existed before this table). */
    createdByEmail: text("created_by_email"),
    /** Set when the partner was given another name; the link still works. */
    retiredAt: timestamp("retired_at"),
  },
  (table) => [index("partner_referral_codes_partner_idx").on(table.partnerId)],
);

/** Effective-dated tier periods. One open period per partner. */
export const partnerTierHistory = pgTable(
  "partner_tier_history",
  {
    id: pk(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partnerProfiles.id, { onDelete: "restrict" }),
    tierKey: text("tier_key").notNull(),
    rateBasisPoints: integer("rate_basis_points").notNull(),
    programVersion: integer("program_version").notNull(),
    qualifyingCustomers: integer("qualifying_customers").notNull(),
    effectiveFrom: timestamp("effective_from").notNull(),
    effectiveTo: timestamp("effective_to"),
    /** Which organizations were counted, when the change was evaluated. */
    evidence: jsonb("evidence").default({}).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("partner_tier_history_open_uidx")
      .on(table.partnerId)
      .where(sql`${table.effectiveTo} is null`),
    index("partner_tier_history_partner_idx").on(table.partnerId, table.effectiveFrom),
    check("partner_tier_history_rate_check", sql`${table.rateBasisPoints} between 0 and 10000`),
  ],
);

/* ------------------------------------------------------------------------- */
/* Tracking and attribution                                                   */
/* ------------------------------------------------------------------------- */

/**
 * One opened partner link. The browser holds only a random token; this row
 * holds its SHA-256, so a cookie cannot be forged into another partner's
 * click. Minimal metadata; the visitor is an HMAC, never an address.
 * Unattributed clicks are deleted after the retention period
 * (lib/partners - purgeExpiredClicks).
 */
export const partnerClicks = pgTable(
  "partner_clicks",
  {
    id: pk(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partnerProfiles.id, { onDelete: "restrict" }),
    tokenHash: text("token_hash").notNull(),
    clickedAt: timestamp("clicked_at").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    landingPath: text("landing_path"),
    referrerHost: text("referrer_host"),
    visitorHash: text("visitor_hash"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("partner_clicks_token_uidx").on(table.tokenHash),
    index("partner_clicks_partner_idx").on(table.partnerId, table.clickedAt),
    index("partner_clicks_expires_idx").on(table.expiresAt),
  ],
);

/**
 * Captured once, on the server, when a RepGet account is created - never for
 * an existing account. Says whether the account may be attributed at all, and
 * why not (invited team member).
 */
export const partnerSignupEligibility = pgTable(
  "partner_signup_eligibility",
  {
    id: pk(),
    userId: text("user_id").notNull(),
    signedUpAt: timestamp("signed_up_at").notNull(),
    /** email | google | otp | unknown */
    signupMethod: text("signup_method").notNull(),
    eligible: boolean("eligible").notNull(),
    exclusions: jsonb("exclusions").default([]).notNull(),
    /** The workspace created at this signup; filled in later if the hook could not create it. */
    foundingOrganizationId: text("founding_organization_id"),
    clickId: uuid("click_id").references(() => partnerClicks.id, { onDelete: "set null" }),
    candidatePartnerId: uuid("candidate_partner_id").references(() => partnerProfiles.id, {
      onDelete: "restrict",
    }),
    /** What the link rule decided: attribute | no_click | click_expired | ... */
    linkOutcome: text("link_outcome").notNull(),
    couponDeadline: timestamp("coupon_deadline").notNull(),
    /** Booleans only (shared network / device with the partner). */
    fraudSignals: jsonb("fraud_signals").default({}).notNull(),
    /**
     * Keyed hashes (HMAC) of the signup's network (an IPv6 address as its /64)
     * and browser - never the address itself - so a later attribution (a
     * coupon, a workspace created after signup) can be compared with THAT
     * partner's sessions.
     */
    signupNetworkHash: text("signup_network_hash"),
    signupDeviceHash: text("signup_device_hash"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("partner_signup_eligibility_user_uidx").on(table.userId),
    index("partner_signup_eligibility_org_idx").on(table.foundingOrganizationId),
  ],
);

/**
 * Which partner referred a customer organization. ONE per organization,
 * ever, and locked once written: the partner column is never updated.
 */
export const partnerAttributions = pgTable(
  "partner_attributions",
  {
    id: pk(),
    organizationId: text("organization_id").notNull(),
    foundingUserId: text("founding_user_id").notNull(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partnerProfiles.id, { onDelete: "restrict" }),
    /** link | coupon */
    source: text("source").notNull(),
    clickId: uuid("click_id").references(() => partnerClicks.id, { onDelete: "set null" }),
    couponId: uuid("coupon_id").references((): AnyPgColumn => partnerCoupons.id, { onDelete: "set null" }),
    /** active | review | disqualified */
    status: text("status").default("active").notNull(),
    lockedAt: timestamp("locked_at").notNull(),
    ruleVersion: integer("rule_version").notNull(),
    /** Start of the 12-month commission window: the first qualifying payment (provider time). */
    windowStartsAt: timestamp("window_starts_at"),
    windowEndsAt: timestamp("window_ends_at"),
    fraudSignals: jsonb("fraud_signals").default({}).notNull(),
    reviewReason: text("review_reason"),
    disqualifiedAt: timestamp("disqualified_at"),
    disqualifiedReason: text("disqualified_reason"),
    decidedByEmail: text("decided_by_email"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("partner_attributions_org_uidx").on(table.organizationId),
    index("partner_attributions_partner_idx").on(table.partnerId, table.status),
    check("partner_attributions_source_check", sql`${table.source} in ('link', 'coupon')`),
    check("partner_attributions_status_check", sql`${table.status} in ('active', 'review', 'disqualified')`),
  ],
);

/* ------------------------------------------------------------------------- */
/* Coupons                                                                    */
/* ------------------------------------------------------------------------- */

/**
 * An administrator-assigned affiliate coupon: a Stripe coupon plus the
 * customer-facing promotion code, created through the Stripe API. Redemption
 * is read from the paid invoice's discounts, never trusted from a form.
 */
export const partnerCoupons = pgTable(
  "partner_coupons",
  {
    id: pk(),
    environment: text("environment").notNull(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partnerProfiles.id, { onDelete: "restrict" }),
    /** The promotion code customers type, upper case. */
    code: text("code").notNull(),
    campaign: text("campaign").notNull(),
    /** percent_first_payment | percent_first_3_months | fixed_amount | custom */
    discountType: text("discount_type").notNull(),
    /** Basis points: 1000 = 10%. */
    percentOffBasisPoints: integer("percent_off_basis_points"),
    amountOff: money("amount_off"),
    currency: text("currency"),
    /** once | repeating | forever (Stripe's coupon duration). */
    duration: text("duration").notNull(),
    durationInMonths: integer("duration_in_months"),
    appliesToProducts: jsonb("applies_to_products").default([]).notNull(),
    startsAt: timestamp("starts_at"),
    expiresAt: timestamp("expires_at"),
    maxRedemptions: integer("max_redemptions"),
    firstTimeTransaction: boolean("first_time_transaction").default(true).notNull(),
    stripeCouponId: text("stripe_coupon_id"),
    stripePromotionCodeId: text("stripe_promotion_code_id"),
    /** creating | active | inactive | failed */
    status: text("status").default("creating").notNull(),
    createdByEmail: text("created_by_email").notNull(),
    deactivatedAt: timestamp("deactivated_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("partner_coupons_code_uidx").on(table.environment, table.code),
    uniqueIndex("partner_coupons_promotion_uidx").on(table.stripePromotionCodeId),
    index("partner_coupons_partner_idx").on(table.partnerId),
  ],
);

/* ------------------------------------------------------------------------- */
/* Payments and commissions                                                   */
/* ------------------------------------------------------------------------- */

/**
 * One ECONOMIC collection: a Stripe invoice payment that moved money, with
 * the breakdown its commission was calculated from. Keyed by the invoice
 * payment, so several partial payments of one invoice are several facts and
 * an invoice's total is never counted twice; a repeated webhook delivery is
 * the same fact.
 */
export const partnerPaymentFacts = pgTable(
  "partner_payment_facts",
  {
    id: pk(),
    environment: text("environment").notNull(),
    invoicePaymentId: text("invoice_payment_id").notNull(),
    invoiceId: text("invoice_id").notNull(),
    paymentIntentId: text("payment_intent_id"),
    chargeId: text("charge_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripeCustomerId: text("stripe_customer_id"),
    organizationId: text("organization_id").notNull(),
    attributionId: uuid("attribution_id").references(() => partnerAttributions.id, { onDelete: "restrict" }),
    /** The existing payments row for the invoice, when there is one. */
    paymentId: uuid("payment_id"),
    currency: text("currency").notNull(),
    cashCollected: money("cash_collected").notNull(),
    eligibleBase: money("eligible_base").notNull(),
    taxShare: money("tax_share").notNull(),
    invoiceTotal: money("invoice_total").notNull(),
    invoiceTax: money("invoice_tax").notNull(),
    invoiceDiscount: money("invoice_discount").notNull(),
    invoiceSubtotal: money("invoice_subtotal").notNull(),
    invoiceStartingBalance: money("invoice_starting_balance").notNull(),
    invoiceAmountPaid: money("invoice_amount_paid").notNull(),
    /** The provider's payment time - never the webhook's arrival. */
    paidAt: timestamp("paid_at").notNull(),
    /** Cumulative, as Stripe reports it now. */
    refundedAmount: money("refunded_amount").default(sql`0`).notNull(),
    disputeLostAmount: money("dispute_lost_amount").default(sql`0`).notNull(),
    disputeId: text("dispute_id"),
    disputeStatus: text("dispute_status"),
    /** commissioned | outside_window | zero_base | review | disqualified | not_attributed */
    outcome: text("outcome").notNull(),
    /** Normalized evidence: lines, discounts and promotion codes, statuses. */
    evidence: jsonb("evidence").notNull(),
    evidenceVersion: integer("evidence_version").notNull(),
    lastSyncedAt: timestamp("last_synced_at").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("partner_payment_facts_collection_uidx").on(table.environment, table.invoicePaymentId),
    index("partner_payment_facts_charge_idx").on(table.environment, table.chargeId),
    index("partner_payment_facts_intent_idx").on(table.environment, table.paymentIntentId),
    index("partner_payment_facts_invoice_idx").on(table.environment, table.invoiceId),
    index("partner_payment_facts_org_idx").on(table.organizationId),
    check("partner_payment_facts_amounts_check", sql`${table.cashCollected} >= 0 and ${table.eligibleBase} >= 0`),
  ],
);

export const partnerCommissions = pgTable(
  "partner_commissions",
  {
    id: pk(),
    environment: text("environment").notNull(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partnerProfiles.id, { onDelete: "restrict" }),
    attributionId: uuid("attribution_id")
      .notNull()
      .references(() => partnerAttributions.id, { onDelete: "restrict" }),
    paymentFactId: uuid("payment_fact_id")
      .notNull()
      .references(() => partnerPaymentFacts.id, { onDelete: "restrict" }),
    currency: text("currency").notNull(),
    baseAmount: money("base_amount").notNull(),
    rateBasisPoints: integer("rate_basis_points").notNull(),
    tierKey: text("tier_key").notNull(),
    amount: money("amount").notNull(),
    reversedAmount: money("reversed_amount").default(sql`0`).notNull(),
    programVersion: integer("program_version").notNull(),
    programVersionId: uuid("program_version_id")
      .notNull()
      .references(() => partnerProgramVersions.id, { onDelete: "restrict" }),
    earnedAt: timestamp("earned_at").notNull(),
    maturesAt: timestamp("matures_at").notNull(),
    /** pending | available | reserved | paid | reversed (lib/partners/domain/entities/commission.ts) */
    status: text("status").default("pending").notNull(),
    /** approved | needs_review | rejected */
    reviewState: text("review_state").default("approved").notNull(),
    holdReason: text("hold_reason"),
    paidSettlementId: uuid("paid_settlement_id"),
    ...timestamps,
  },
  (table) => [
    // One commission per economic payment.
    uniqueIndex("partner_commissions_fact_uidx").on(table.paymentFactId),
    index("partner_commissions_partner_idx").on(table.partnerId, table.environment, table.currency, table.status),
    check(
      "partner_commissions_amounts_check",
      sql`${table.amount} >= 0 and ${table.reversedAmount} >= 0 and ${table.reversedAmount} <= ${table.amount}`,
    ),
    check(
      "partner_commissions_status_check",
      sql`${table.status} in ('pending', 'available', 'reserved', 'paid', 'reversed')`,
    ),
    check(
      "partner_commissions_review_check",
      sql`${table.reviewState} in ('approved', 'needs_review', 'rejected')`,
    ),
  ],
);

/**
 * THE FINANCIAL RECORD. Append-only (a trigger refuses UPDATE and DELETE):
 * a correction is a new entry. `amount` is the signed effect on what RepGet
 * owes the partner:
 *
 *   commission_earned      +  a commission was earned
 *   commission_adjustment  +/- a refund, chargeback, rejection or admin correction
 *   transfer_confirmed     -  Stripe confirmed a transfer to the partner
 *   transfer_reversal      +  Stripe confirmed money reversed back from the partner
 *
 * Bank payouts are NOT here: they move money the partner already holds.
 * `operation_key` is unique, so a retried operation writes its entry once.
 */
export const partnerLedgerEntries = pgTable(
  "partner_ledger_entries",
  {
    id: pk(),
    environment: text("environment").notNull(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partnerProfiles.id, { onDelete: "restrict" }),
    currency: text("currency").notNull(),
    kind: text("kind").notNull(),
    amount: money("amount").notNull(),
    operationKey: text("operation_key").notNull(),
    commissionId: uuid("commission_id").references(() => partnerCommissions.id, { onDelete: "restrict" }),
    settlementId: uuid("settlement_id").references((): AnyPgColumn => partnerSettlements.id, {
      onDelete: "restrict",
    }),
    paymentFactId: uuid("payment_fact_id").references(() => partnerPaymentFacts.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    /** "system" or the administrator's email. */
    actor: text("actor").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("partner_ledger_operation_uidx").on(table.operationKey),
    index("partner_ledger_partner_idx").on(table.partnerId, table.environment, table.currency),
    index("partner_ledger_commission_idx").on(table.commissionId),
    check(
      "partner_ledger_kind_check",
      sql`${table.kind} in ('commission_earned', 'commission_adjustment', 'transfer_confirmed', 'transfer_reversal')`,
    ),
  ],
);

/**
 * Per partner, environment and currency: a REBUILDABLE projection of the
 * ledger and commissions for dashboards, and the row settlement locks to
 * serialise payouts. Never the source of financial truth.
 */
export const partnerBalanceProjections = pgTable(
  "partner_balance_projections",
  {
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partnerProfiles.id, { onDelete: "restrict" }),
    environment: text("environment").notNull(),
    currency: text("currency").notNull(),
    netEarned: money("net_earned").default(sql`0`).notNull(),
    netTransferred: money("net_transferred").default(sql`0`).notNull(),
    liability: money("liability").default(sql`0`).notNull(),
    pending: money("pending").default(sql`0`).notNull(),
    available: money("available").default(sql`0`).notNull(),
    reserved: money("reserved").default(sql`0`).notNull(),
    held: money("held").default(sql`0`).notNull(),
    bankPaid: money("bank_paid").default(sql`0`).notNull(),
    rebuiltAt: timestamp("rebuilt_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.partnerId, table.environment, table.currency] })],
);

/* ------------------------------------------------------------------------- */
/* Settlements, transfers and bank payouts                                     */
/* ------------------------------------------------------------------------- */

export const partnerSettlements = pgTable(
  "partner_settlements",
  {
    id: pk(),
    environment: text("environment").notNull(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partnerProfiles.id, { onDelete: "restrict" }),
    currency: text("currency").notNull(),
    /** "2026-11": the monthly run, or "manual:<uuid>" for an administrator's run. */
    runKey: text("run_key").notNull(),
    /** lib/partners/domain/entities/settlement.ts */
    state: text("state").default("reserved").notNull(),
    grossAmount: money("gross_amount").notNull(),
    offsetAmount: money("offset_amount").notNull(),
    transferAmount: money("transfer_amount").notNull(),
    stripeAccountId: text("stripe_account_id").notNull(),
    /** Stripe transfer_group: durable evidence that outlives idempotency keys. */
    transferGroup: text("transfer_group").notNull(),
    claimToken: uuid("claim_token"),
    claimedUntil: timestamp("claimed_until"),
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at").defaultNow().notNull(),
    lastError: text("last_error"),
    canceledReason: text("canceled_reason"),
    reviewReason: text("review_reason"),
    createdBy: text("created_by").notNull(),
    transferredAt: timestamp("transferred_at"),
    paidAt: timestamp("paid_at"),
    /** When a person last resumed it after review: earlier failures no longer count against it. */
    resumedAt: timestamp("resumed_at"),
    ...timestamps,
  },
  (table) => [
    // One per partner, currency and run - a cancelled one does not use up the month.
    uniqueIndex("partner_settlements_run_uidx")
      .on(table.partnerId, table.environment, table.currency, table.runKey)
      .where(sql`${table.state} <> 'canceled'`),
    uniqueIndex("partner_settlements_group_uidx").on(table.transferGroup),
    // At most one settlement per partner and currency whose transfer is not settled.
    uniqueIndex("partner_settlements_open_uidx")
      .on(table.partnerId, table.environment, table.currency)
      .where(sql`${table.state} in ('reserved', 'transfer_processing', 'transfer_unknown')`),
    index("partner_settlements_due_idx").on(table.state, table.nextAttemptAt),
    check(
      "partner_settlements_amounts_check",
      sql`${table.transferAmount} > 0 and ${table.offsetAmount} >= 0 and ${table.grossAmount} = ${table.transferAmount} + ${table.offsetAmount}`,
    ),
  ],
);

/** Exact commission allocations. A commission is in at most one ACTIVE allocation. */
export const partnerSettlementItems = pgTable(
  "partner_settlement_items",
  {
    id: pk(),
    settlementId: uuid("settlement_id")
      .notNull()
      .references(() => partnerSettlements.id, { onDelete: "restrict" }),
    commissionId: uuid("commission_id")
      .notNull()
      .references(() => partnerCommissions.id, { onDelete: "restrict" }),
    amount: money("amount").notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("partner_settlement_items_active_uidx")
      .on(table.commissionId)
      .where(sql`${table.active}`),
    index("partner_settlement_items_settlement_idx").on(table.settlementId),
    check("partner_settlement_items_amount_check", sql`${table.amount} > 0`),
  ],
);

/**
 * A partner's connected Stripe account in one environment. Readiness only:
 * Stripe collects identity and bank details, and none of them is stored here.
 */
export const partnerStripeAccounts = pgTable(
  "partner_stripe_accounts",
  {
    id: pk(),
    partnerId: uuid("partner_id")
      .notNull()
      .references(() => partnerProfiles.id, { onDelete: "restrict" }),
    environment: text("environment").notNull(),
    /** Null only while the create call is in flight. */
    stripeAccountId: text("stripe_account_id"),
    /** creating | onboarding | verification_pending | restricted | ready | deauthorized */
    status: text("status").default("creating").notNull(),
    country: text("country"),
    defaultCurrency: text("default_currency"),
    detailsSubmitted: boolean("details_submitted").default(false).notNull(),
    payoutsEnabled: boolean("payouts_enabled").default(false).notNull(),
    transfersCapability: text("transfers_capability"),
    requirementsCurrentlyDue: jsonb("requirements_currently_due").default([]).notNull(),
    requirementsPastDue: jsonb("requirements_past_due").default([]).notNull(),
    requirementsPendingVerification: jsonb("requirements_pending_verification").default([]).notNull(),
    disabledReason: text("disabled_reason"),
    currentDeadline: timestamp("current_deadline"),
    payoutInterval: text("payout_interval"),
    creationKey: text("creation_key").notNull(),
    lastSyncedAt: timestamp("last_synced_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("partner_stripe_accounts_partner_uidx").on(table.partnerId, table.environment),
    uniqueIndex("partner_stripe_accounts_account_uidx").on(table.stripeAccountId),
  ],
);

export const partnerTransferAttempts = pgTable(
  "partner_transfer_attempts",
  {
    id: pk(),
    settlementId: uuid("settlement_id")
      .notNull()
      .references(() => partnerSettlements.id, { onDelete: "restrict" }),
    attemptNumber: integer("attempt_number").notNull(),
    /** The Stripe idempotency key, and the metadata a reconciliation searches for. */
    operationId: text("operation_id").notNull(),
    environment: text("environment").notNull(),
    stripeAccountId: text("stripe_account_id").notNull(),
    currency: text("currency").notNull(),
    amount: money("amount").notNull(),
    /** lib/partners/domain/entities/settlement.ts TransferStatus */
    status: text("status").default("not_started").notNull(),
    stripeTransferId: text("stripe_transfer_id"),
    stripeBalanceTransactionId: text("stripe_balance_transaction_id"),
    amountReversed: money("amount_reversed").default(sql`0`).notNull(),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    submittedAt: timestamp("submitted_at"),
    confirmedAt: timestamp("confirmed_at"),
    lastCheckedAt: timestamp("last_checked_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("partner_transfer_attempts_operation_uidx").on(table.operationId),
    uniqueIndex("partner_transfer_attempts_number_uidx").on(table.settlementId, table.attemptNumber),
    uniqueIndex("partner_transfer_attempts_transfer_uidx").on(table.stripeTransferId),
    /*
      THE DUPLICATE-PAYMENT GUARD IN THE DATABASE: per settlement, at most one
      transfer that may have moved money (in flight, unknown or confirmed).
    */
    uniqueIndex("partner_transfer_attempts_live_uidx")
      .on(table.settlementId)
      .where(sql`${table.status} in ('processing', 'unknown', 'confirmed', 'partially_reversed', 'reversed')`),
  ],
);

/** Recoveries of money already transferred, by Stripe transfer reversal. */
export const partnerTransferReversals = pgTable(
  "partner_transfer_reversals",
  {
    id: pk(),
    transferAttemptId: uuid("transfer_attempt_id")
      .notNull()
      .references(() => partnerTransferAttempts.id, { onDelete: "restrict" }),
    operationId: text("operation_id").notNull(),
    amount: money("amount").notNull(),
    currency: text("currency").notNull(),
    /** processing | confirmed | failed | unknown */
    status: text("status").default("processing").notNull(),
    stripeReversalId: text("stripe_reversal_id"),
    reason: text("reason").notNull(),
    requestedBy: text("requested_by").notNull(),
    failureMessage: text("failure_message"),
    confirmedAt: timestamp("confirmed_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("partner_transfer_reversals_operation_uidx").on(table.operationId),
    uniqueIndex("partner_transfer_reversals_stripe_uidx").on(table.stripeReversalId),
    check("partner_transfer_reversals_amount_check", sql`${table.amount} > 0`),
  ],
);

export const partnerBankPayoutAttempts = pgTable(
  "partner_bank_payout_attempts",
  {
    id: pk(),
    settlementId: uuid("settlement_id")
      .notNull()
      .references(() => partnerSettlements.id, { onDelete: "restrict" }),
    attemptNumber: integer("attempt_number").notNull(),
    operationId: text("operation_id").notNull(),
    environment: text("environment").notNull(),
    stripeAccountId: text("stripe_account_id").notNull(),
    currency: text("currency").notNull(),
    amount: money("amount").notNull(),
    /** lib/partners/domain/entities/settlement.ts BankPayoutStatus */
    status: text("status").default("not_started").notNull(),
    stripePayoutId: text("stripe_payout_id"),
    arrivalDate: timestamp("arrival_date"),
    failureCode: text("failure_code"),
    failureMessage: text("failure_message"),
    submittedAt: timestamp("submitted_at"),
    paidAt: timestamp("paid_at"),
    failedAt: timestamp("failed_at"),
    lastCheckedAt: timestamp("last_checked_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("partner_bank_payout_attempts_operation_uidx").on(table.operationId),
    uniqueIndex("partner_bank_payout_attempts_number_uidx").on(table.settlementId, table.attemptNumber),
    uniqueIndex("partner_bank_payout_attempts_payout_uidx").on(table.stripeAccountId, table.stripePayoutId),
    // Per settlement, at most one bank payout that may still pay (or has paid).
    uniqueIndex("partner_bank_payout_attempts_live_uidx")
      .on(table.settlementId)
      .where(sql`${table.status} in ('unknown', 'pending', 'in_transit', 'paid')`),
  ],
);

/* ------------------------------------------------------------------------- */
/* Review cases and provider work                                              */
/* ------------------------------------------------------------------------- */

/**
 * Everything a person must decide: attribution conflicts, fraud signals,
 * financial facts that do not add up, payout discrepancies. Resolution needs
 * an administrator and a reason; nothing here is resolved automatically
 * except by the event that makes it moot (a dispute won).
 */
export const partnerReviewCases = pgTable(
  "partner_review_cases",
  {
    id: pk(),
    kind: text("kind").notNull(),
    /** open | resolved | dismissed */
    status: text("status").default("open").notNull(),
    /** One open case per subject and kind. */
    dedupeKey: text("dedupe_key").notNull(),
    environment: text("environment"),
    partnerId: uuid("partner_id").references(() => partnerProfiles.id, { onDelete: "restrict" }),
    attributionId: uuid("attribution_id").references(() => partnerAttributions.id, { onDelete: "restrict" }),
    commissionId: uuid("commission_id").references(() => partnerCommissions.id, { onDelete: "restrict" }),
    settlementId: uuid("settlement_id").references(() => partnerSettlements.id, { onDelete: "restrict" }),
    paymentFactId: uuid("payment_fact_id").references(() => partnerPaymentFacts.id, { onDelete: "restrict" }),
    organizationId: text("organization_id"),
    summary: text("summary").notNull(),
    evidence: jsonb("evidence").default({}).notNull(),
    resolution: text("resolution"),
    resolutionReason: text("resolution_reason"),
    resolvedByEmail: text("resolved_by_email"),
    resolvedAt: timestamp("resolved_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("partner_review_cases_dedupe_uidx").on(table.dedupeKey),
    index("partner_review_cases_status_idx").on(table.status, table.createdAt),
    index("partner_review_cases_partner_idx").on(table.partnerId),
  ],
);

/**
 * Affiliate work owed for a verified Stripe event, recorded in the webhook
 * BEFORE the event is marked complete, so a crash cannot lose it. Processed
 * by the partner-commissions job (and its cron, which also picks up work
 * deferred while commission processing was switched off). The webhook
 * storage itself is webhook_events; this row only tracks the partner work.
 */
export const partnerProviderEvents = pgTable(
  "partner_provider_events",
  {
    id: pk(),
    environment: text("environment").notNull(),
    stripeEventId: text("stripe_event_id").notNull(),
    eventType: text("event_type").notNull(),
    objectId: text("object_id").notNull(),
    /** The connected account an event came from (Connect events only). */
    connectedAccountId: text("connected_account_id"),
    eventCreatedAt: timestamp("event_created_at").notNull(),
    /** pending | processing | done | ignored | failed */
    status: text("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at").defaultNow().notNull(),
    claimToken: uuid("claim_token"),
    claimedUntil: timestamp("claimed_until"),
    lastError: text("last_error"),
    outcome: text("outcome"),
    processedAt: timestamp("processed_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("partner_provider_events_event_uidx").on(table.stripeEventId),
    index("partner_provider_events_due_idx").on(table.status, table.nextAttemptAt),
  ],
);
