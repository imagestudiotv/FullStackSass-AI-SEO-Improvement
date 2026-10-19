import { commissionDisplayStatus } from "../../domain/entities/commission";
import { bankDisplayState, transferDisplayState } from "../../domain/entities/settlement";
import { nextMonthlyRun } from "../../domain/policies/maturity";
import { payoutThreshold } from "../../domain/policies/program";
import { tierProgress } from "../../domain/policies/tiers";
import type { PartnerContext } from "../contracts/commands";
import type { Environment } from "../ports/repositories";
import type { PartnerDeps } from "../use-cases/deps";
import { payoutSetupStatus } from "../use-cases/manage-payout-account";
import { computeBalances, type BalanceFigures } from "../use-cases/mature-commissions";

/**
 * The partner's own dashboard and histories.
 *
 * Every function is scoped by the PartnerContext the guard derived from the
 * session (never an id from the browser) and re-checks that the profile
 * belongs to that user. Figures come from the same records the financial
 * code writes: balances are computed from the immutable ledger and the
 * commissions by the same function that maintains the balance projection
 * (so they are current, not as of the last rebuild), histories are the
 * commission and settlement rows. Nothing is recomputed in a page.
 */

export const PARTNER_PAGE_SIZE = 20;
export const METRIC_RANGES = [30, 90, 365] as const;
export type MetricRange = (typeof METRIC_RANGES)[number];

const DAY = 86_400_000;
const ZERO = BigInt(0);

async function ownPartner(deps: PartnerDeps, context: PartnerContext) {
  const partner = await deps.uow.repositories.partners.findById(context.partnerId);
  return partner && partner.userId === context.userId ? partner : null;
}

/**
 * The five dashboard figures for one currency, defined so none counts the
 * same money twice:
 *
 *   earned       net commission earned (commissions minus refunds,
 *                chargebacks and corrections), all time
 *   pending      unpaid, not payable yet: maturing, held or under review
 *   available    unpaid and payable at the next monthly run
 *   inPayout     part of a payout being sent right now
 *   transferred  net amount sent to the partner's Stripe balance
 *   bankPaid     the part of `transferred` Stripe confirmed paid to the bank
 *
 * earned = pending + available + inPayout + transferred - offset, where
 * `offset` is a correction (for example a refund after payment) that will
 * be deducted from upcoming payouts.
 */
export function dashboardFigures(currency: string, balance: BalanceFigures, threshold: bigint | null, at: Date) {
  const pending = balance.pending + balance.held;
  const unpaid = pending + balance.available + balance.reserved;
  // What the ledger owes is less than the unpaid commissions by any correction still to be deducted.
  const offset = unpaid > balance.liability ? unpaid - balance.liability : ZERO;
  return {
    currency,
    earned: balance.netEarned,
    pending,
    available: balance.available,
    inPayout: balance.reserved,
    transferred: balance.netTransferred,
    bankPaid: balance.bankPaid,
    offset,
    liability: balance.liability,
    threshold,
    belowThreshold: threshold !== null && balance.available - offset < threshold,
    updatedAt: at,
  };
}

/** Every currency's figures for one partner, computed now from the ledger. */
export async function partnerBalances(deps: PartnerDeps, partnerId: string, environment: Environment, policy: Parameters<typeof payoutThreshold>[0]) {
  const now = deps.clock.now();
  const currencies = await deps.uow.repositories.reporting.currencies(partnerId, environment);
  const figures = [];
  for (const currency of currencies) {
    const threshold = payoutThreshold(policy, currency);
    figures.push(dashboardFigures(currency, await computeBalances(deps, partnerId, environment, currency), threshold ? threshold.amount : null, now));
  }
  return figures;
}

export async function partnerDashboard(deps: PartnerDeps, context: PartnerContext, input: { days: MetricRange }) {
  const partner = await ownPartner(deps, context);
  if (!partner) return null;
  const repos = deps.uow.repositories;
  const now = deps.clock.now();
  const version = await repos.programs.versionAt(now);
  const environment = deps.settings.environment();
  const since = new Date(now.getTime() - input.days * DAY);
  const [setup, coupons, balances, metrics] = await Promise.all([
    payoutSetupStatus(deps, partner.id),
    environment ? repos.coupons.forPartner(partner.id, environment) : Promise.resolve([]),
    environment ? partnerBalances(deps, partner.id, environment, version.policy) : Promise.resolve([]),
    environment
      ? repos.reporting.metrics(partner.id, environment, since)
      : Promise.resolve({ clicks: 0, signups: 0, customers: 0, payingCustomers: 0 }),
  ]);
  return {
    partner,
    policy: version.policy,
    progress: tierProgress(version.policy, partner.qualifyingCustomers),
    referralUrl: `${deps.settings.appUrl()}/go/${partner.referralCode}`,
    setup,
    coupons: coupons.filter((coupon) => coupon.status === "active"),
    balances,
    metrics: { ...metrics, days: input.days, since, until: now },
    nextPayoutAt: nextMonthlyRun(now),
  };
}

function pageOf(page: number) {
  const current = Math.max(1, Math.floor(page) || 1);
  return { page: current, offset: (current - 1) * PARTNER_PAGE_SIZE, limit: PARTNER_PAGE_SIZE };
}

export async function partnerCommissionHistory(deps: PartnerDeps, context: PartnerContext, input: { page: number }) {
  const partner = await ownPartner(deps, context);
  const environment = deps.settings.environment();
  const { page, offset, limit } = pageOf(input.page);
  if (!partner || !environment) return { rows: [], total: 0, page, pageSize: PARTNER_PAGE_SIZE };
  const repos = deps.uow.repositories;
  const result = await repos.reporting.commissions({ environment, partnerId: partner.id, offset, limit });
  const labels = await repos.directory.customerLabels([...new Set(result.rows.map((row) => row.organizationId))]);
  const now = deps.clock.now();
  return {
    rows: result.rows.map((row) => ({
      id: row.id,
      paidAt: row.paidAt,
      customer: labels[row.organizationId],
      currency: row.currency,
      base: row.baseAmount,
      rateBasisPoints: row.rateBasisPoints,
      amount: row.amount,
      reversed: row.reversedAmount,
      status: commissionDisplayStatus(row, now),
      maturesAt: row.maturesAt,
    })),
    total: result.total,
    page,
    pageSize: PARTNER_PAGE_SIZE,
  };
}

export async function partnerPayoutHistory(deps: PartnerDeps, context: PartnerContext, input: { page: number }) {
  const partner = await ownPartner(deps, context);
  const environment = deps.settings.environment();
  const { page, offset, limit } = pageOf(input.page);
  if (!partner || !environment) return { rows: [], total: 0, page, pageSize: PARTNER_PAGE_SIZE };
  // A cancelled settlement moved no money: the partner is not shown it.
  const result = await deps.uow.repositories.reporting.settlements({ environment, partnerId: partner.id, excludeStates: ["canceled"], offset, limit });
  return {
    rows: result.rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      currency: row.currency,
      amount: row.transferAmount,
      offset: row.offsetAmount,
      transfer: transferDisplayState(row.state, row.transferStatus),
      transferredAt: row.transferredAt,
      bank: bankDisplayState(row.bankStatus),
      bankPaidAt: row.bankPaidAt,
      bankArrivalDate: row.bankArrivalDate,
    })),
    total: result.total,
    page,
    pageSize: PARTNER_PAGE_SIZE,
  };
}

export async function partnerReferrals(deps: PartnerDeps, context: PartnerContext, input: { page: number }) {
  const partner = await ownPartner(deps, context);
  const { page, offset, limit } = pageOf(input.page);
  if (!partner) return { rows: [], total: 0, page, pageSize: PARTNER_PAGE_SIZE };
  const repos = deps.uow.repositories;
  const result = await repos.reporting.referrals({ partnerId: partner.id, offset, limit });
  const labels = await repos.directory.customerLabels([...new Set(result.rows.map((row) => row.organizationId))]);
  return {
    rows: result.rows.map((row) => ({
      id: row.attributionId,
      customer: labels[row.organizationId],
      source: row.source,
      status: row.status,
      since: row.lockedAt,
      windowEndsAt: row.windowEndsAt,
      payments: row.payments,
    })),
    total: result.total,
    page,
    pageSize: PARTNER_PAGE_SIZE,
  };
}

/** The partner's own link, for the resources page's ready-made texts. */
export async function partnerLink(deps: PartnerDeps, context: PartnerContext): Promise<string | null> {
  const partner = await ownPartner(deps, context);
  return partner ? `${deps.settings.appUrl()}/go/${partner.referralCode}` : null;
}
