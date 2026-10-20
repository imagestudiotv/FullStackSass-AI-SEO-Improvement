import { commissionDisplayStatus, type CommissionDisplayStatus } from "../../domain/entities/commission";
import { canReceiveAutomaticPayout } from "../../domain/entities/partner";
import { bankDisplayState, transferDisplayState, type SettlementState } from "../../domain/entities/settlement";
import { monthlyRunKey, nextMonthlyRun } from "../../domain/policies/maturity";
import { payoutThreshold } from "../../domain/policies/program";
import { Money } from "../../domain/value-objects/money";
import type { AdminContext } from "../contracts/commands";
import type { PartnerRecord, ReviewCaseKind, ReviewCaseRecord } from "../ports/repositories";
import type { PartnerDeps } from "../use-cases/deps";
import { previewSettlement } from "../use-cases/prepare-settlement";
import { ADMIN_PAGE_SIZE } from "./admin-overview";
import { partnerBalances } from "./partner-dashboard";

/**
 * Administrator reports: commissions, payouts, review cases, coupons,
 * attribution, the ledger and CSV exports. The SAME records the partner
 * portal reads (partner-dashboard.ts), with the same status mapping from
 * the domain - an administrator and a partner never see two versions of
 * one payout.
 */

function assertAdmin(admin: AdminContext): void {
  if (admin?.kind !== "admin") throw new Error("An administrator context is required");
}

function pageOf(page: number, size = ADMIN_PAGE_SIZE) {
  const current = Math.max(1, Math.floor(page) || 1);
  return { page: current, offset: (current - 1) * size, limit: size, pageSize: size };
}

async function partnersById(deps: PartnerDeps, ids: string[]): Promise<Map<string, PartnerRecord>> {
  const unique = [...new Set(ids)];
  const found = await Promise.all(unique.map((id) => deps.uow.repositories.partners.findById(id)));
  return new Map(found.filter((partner): partner is PartnerRecord => Boolean(partner)).map((partner) => [partner.id, partner]));
}

function partnerSummary(partner: PartnerRecord | undefined) {
  return partner ? { id: partner.id, name: partner.displayName, email: partner.contactEmail, code: partner.referralCode } : null;
}

export const COMMISSION_FILTERS = ["pending", "available", "reserved", "paid", "reversed", "held", "review"] as const;
export type CommissionFilter = (typeof COMMISSION_FILTERS)[number];

export async function adminCommissions(deps: PartnerDeps, admin: AdminContext, filter: { status?: CommissionFilter; partnerId?: string; from?: Date; to?: Date; page: number }) {
  assertAdmin(admin);
  const environment = deps.settings.environment();
  const paging = pageOf(filter.page);
  if (!environment) return { environment, rows: [], total: 0, page: paging.page, pageSize: paging.pageSize };
  const repos = deps.uow.repositories;
  const status = filter.status;
  const result = await repos.reporting.commissions({
    environment,
    partnerId: filter.partnerId,
    // "review" commissions are never payable, so always pending; the overview counts them the same way.
    status: status === "held" ? undefined : status === "review" ? "pending" : status,
    review: status === "review" ? "needs_review" : undefined,
    held: status === "held" ? true : undefined,
    from: filter.from,
    to: filter.to,
    offset: paging.offset,
    limit: paging.limit,
  });
  const [partners, customers] = await Promise.all([
    partnersById(deps, result.rows.map((row) => row.partnerId)),
    repos.directory.organizationSummaries([...new Set(result.rows.map((row) => row.organizationId))]),
  ]);
  return {
    environment,
    rows: result.rows.map((row) => ({
      ...row,
      display: commissionDisplayStatus(row, deps.clock.now()) as CommissionDisplayStatus,
      partner: partnerSummary(partners.get(row.partnerId)),
      customer: customers[row.organizationId],
    })),
    total: result.total,
    page: paging.page,
    pageSize: paging.pageSize,
  };
}

export const SETTLEMENT_FILTERS: readonly SettlementState[] = [
  "reserved",
  "transfer_processing",
  "transfer_unknown",
  "transferred",
  "payout_pending",
  "payout_in_transit",
  "paid",
  "payout_failed",
  "needs_review",
  "canceled",
];

export async function adminSettlements(deps: PartnerDeps, admin: AdminContext, filter: { state?: SettlementState; partnerId?: string; page: number }) {
  assertAdmin(admin);
  const environment = deps.settings.environment();
  const paging = pageOf(filter.page);
  if (!environment) return { environment, rows: [], total: 0, page: paging.page, pageSize: paging.pageSize };
  const result = await deps.uow.repositories.reporting.settlements({ environment, partnerId: filter.partnerId, state: filter.state, offset: paging.offset, limit: paging.limit });
  const partners = await partnersById(deps, result.rows.map((row) => row.partnerId));
  return {
    environment,
    rows: result.rows.map((row) => ({
      ...row,
      transfer: transferDisplayState(row.state, row.transferStatus),
      bank: bankDisplayState(row.bankStatus),
      partner: partnerSummary(partners.get(row.partnerId)),
    })),
    total: result.total,
    page: paging.page,
    pageSize: paging.pageSize,
  };
}

/** One settlement with everything that happened to it: items, every transfer and bank payout attempt, reversals, cases. */
export async function adminSettlementDetail(deps: PartnerDeps, admin: AdminContext, settlementId: string) {
  assertAdmin(admin);
  const repos = deps.uow.repositories;
  const settlement = await repos.settlements.findById(settlementId);
  if (!settlement) return null;
  const [partner, items, transfers, payouts, cases, ledger] = await Promise.all([
    repos.partners.findById(settlement.partnerId),
    repos.settlements.items(settlement.id),
    repos.settlements.transferAttempts(settlement.id),
    repos.settlements.payoutAttempts(settlement.id),
    repos.reviews.list({ partnerId: settlement.partnerId, offset: 0, limit: 100 }),
    repos.reporting.ledger({ environment: settlement.environment, settlementId: settlement.id, offset: 0, limit: 200 }),
  ]);
  const reversals = (await Promise.all(transfers.map((attempt) => repos.settlements.reversals(attempt.id)))).flat();
  const latestTransfer = [...transfers].sort((a, b) => b.attemptNumber - a.attemptNumber)[0] ?? null;
  const latestPayout = [...payouts].sort((a, b) => b.attemptNumber - a.attemptNumber)[0] ?? null;
  const confirmed = transfers.find((attempt) => attempt.status === "confirmed" || attempt.status === "partially_reversed") ?? null;
  return {
    settlement,
    partner,
    items,
    transfers,
    payouts,
    reversals,
    cases: cases.rows.filter((reviewCase) => reviewCase.settlementId === settlement.id),
    ledger: ledger.rows,
    transfer: transferDisplayState(settlement.state, latestTransfer?.status ?? null),
    bank: bankDisplayState(latestPayout?.status ?? null),
    /** Cancel is offered only before anything may have reached Stripe. */
    cancellable:
      (settlement.state === "reserved" || (settlement.state === "needs_review" && settlement.transferredAt === null)) &&
      transfers.every((attempt) => attempt.status === "retryable_failure" || attempt.status === "failed"),
    /** A payout under review goes back to work only by a person's decision. */
    resumable: settlement.state === "needs_review",
    /** What a reversal could recover at most (the use case re-checks against the ledger). */
    reversible: confirmed ? confirmed.amount - confirmed.amountReversed : BigInt(0),
    retryable: !["paid", "canceled", "needs_review"].includes(settlement.state),
  };
}

/**
 * What the next monthly run would do for each partner and currency with a
 * balance - computed by the same plan the run uses, without reserving
 * anything. Paged: each preview reads (and briefly locks) that balance.
 */
export async function adminPayoutPreview(deps: PartnerDeps, admin: AdminContext, input: { page: number }) {
  assertAdmin(admin);
  const environment = deps.settings.environment();
  const repos = deps.uow.repositories;
  const now = deps.clock.now();
  const paging = pageOf(input.page);
  const [payoutsOn, version] = await Promise.all([repos.controls.isEnabled("partner_payouts"), repos.programs.versionAt(now)]);
  const base = {
    environment,
    payoutsOn,
    moneyMovementAllowed: environment ? deps.settings.moneyMovementAllowed(environment) : false,
    nextRunAt: nextMonthlyRun(now),
    currentRunKey: monthlyRunKey(now),
    page: paging.page,
    pageSize: paging.pageSize,
  };
  if (!environment) return { ...base, rows: [], total: 0 };
  const pairs = await repos.commissions.balancesToConsider(environment);
  const slice = pairs.slice(paging.offset, paging.offset + paging.limit);
  const partners = await partnersById(deps, slice.map((pair) => pair.partnerId));
  const rows = [];
  for (const pair of slice) {
    const partner = partners.get(pair.partnerId);
    const [plan, account, recent] = await Promise.all([
      previewSettlement(deps, pair.partnerId, pair.currency),
      repos.stripeAccounts.find(pair.partnerId, environment),
      repos.reporting.settlements({ environment, partnerId: pair.partnerId, offset: 0, limit: 24 }),
    ]);
    // One settlement per partner, currency and month (unique run key, even once cancelled).
    const preparedThisMonth = recent.rows.some((row) => row.currency === pair.currency && row.runKey === base.currentRunKey);
    const blockers: string[] = [];
    if (!partner) blockers.push("partner_missing");
    else if (!canReceiveAutomaticPayout(partner)) blockers.push(partner.status === "active" ? "payout_hold" : "partner_suspended");
    if (!account?.stripeAccountId || account.status !== "ready") blockers.push("onboarding_incomplete");
    const threshold = payoutThreshold(version.policy, pair.currency);
    rows.push({
      partner: partnerSummary(partner),
      currency: pair.currency,
      plan,
      threshold: threshold?.amount ?? null,
      blockers,
      preparedThisMonth,
    });
  }
  return { ...base, rows, total: pairs.length };
}

export const REVIEW_KINDS: readonly ReviewCaseKind[] = [
  "fraud_signal",
  "attribution_conflict",
  "coupon_conflict",
  "credit_cash_conflict",
  "dispute",
  "financial_inconsistency",
  "payout_discrepancy",
  "transfer_unknown",
  "payout_funding",
  "unexpected_payout",
  "reconciliation",
];

export async function adminReviewCases(
  deps: PartnerDeps,
  admin: AdminContext,
  filter: { status?: ReviewCaseRecord["status"]; kind?: ReviewCaseKind; page: number },
) {
  assertAdmin(admin);
  const paging = pageOf(filter.page);
  const repos = deps.uow.repositories;
  const result = await repos.reviews.list({ status: filter.status, kind: filter.kind, offset: paging.offset, limit: paging.limit });
  const partners = await partnersById(deps, result.rows.map((row) => row.partnerId).filter((id): id is string => Boolean(id)));
  const customers = await repos.directory.organizationSummaries([
    ...new Set(result.rows.map((row) => row.organizationId).filter((id): id is string => Boolean(id))),
  ]);
  return {
    rows: result.rows.map((row) => ({
      ...row,
      partner: row.partnerId ? partnerSummary(partners.get(row.partnerId)) : null,
      customer: row.organizationId ? customers[row.organizationId] ?? null : null,
    })),
    total: result.total,
    page: paging.page,
    pageSize: paging.pageSize,
  };
}

export async function adminCoupons(deps: PartnerDeps, admin: AdminContext, filter: { search?: string; page: number }) {
  assertAdmin(admin);
  const environment = deps.settings.environment();
  const paging = pageOf(filter.page);
  if (!environment) return { environment, rows: [], total: 0, page: paging.page, pageSize: paging.pageSize };
  const result = await deps.uow.repositories.coupons.list(environment, { search: filter.search, offset: paging.offset, limit: paging.limit });
  const partners = await partnersById(deps, result.rows.map((row) => row.partnerId));
  return {
    environment,
    rows: result.rows.map((row) => ({ ...row, partner: partnerSummary(partners.get(row.partnerId)) })),
    total: result.total,
    page: paging.page,
    pageSize: paging.pageSize,
  };
}

export async function adminAttributions(deps: PartnerDeps, admin: AdminContext, filter: { status?: "active" | "review" | "disqualified"; partnerId?: string; page: number }) {
  assertAdmin(admin);
  const paging = pageOf(filter.page);
  const repos = deps.uow.repositories;
  const result = await repos.reporting.referrals({ partnerId: filter.partnerId, status: filter.status, offset: paging.offset, limit: paging.limit });
  const [partners, customers] = await Promise.all([
    partnersById(deps, result.rows.map((row) => row.partnerId)),
    repos.directory.organizationSummaries([...new Set(result.rows.map((row) => row.organizationId))]),
  ]);
  return {
    rows: result.rows.map((row) => ({ ...row, partner: partnerSummary(partners.get(row.partnerId)), customer: customers[row.organizationId] })),
    total: result.total,
    page: paging.page,
    pageSize: paging.pageSize,
  };
}

/** A partner's balances (all currencies) and their ledger - the transaction history. */
export async function adminPartnerFinance(deps: PartnerDeps, admin: AdminContext, input: { partnerId: string; page: number }) {
  assertAdmin(admin);
  const environment = deps.settings.environment();
  const paging = pageOf(input.page, 50);
  if (!environment) return null;
  const repos = deps.uow.repositories;
  const version = await repos.programs.versionAt(deps.clock.now());
  const now = deps.clock.now();
  const [balances, ledger, settlements, ...activity] = await Promise.all([
    partnerBalances(deps, input.partnerId, environment, version.policy),
    repos.reporting.ledger({ environment, partnerId: input.partnerId, offset: paging.offset, limit: paging.limit }),
    repos.reporting.settlements({ environment, partnerId: input.partnerId, offset: 0, limit: 10 }),
    ...ACTIVITY_DAYS.map((days) => repos.reporting.metrics(input.partnerId, environment, new Date(now.getTime() - days * 86_400_000))),
  ]);
  return {
    environment,
    balances,
    ledger: { rows: ledger.rows, total: ledger.total, page: paging.page, pageSize: paging.pageSize },
    settlements: settlements.rows.map((row) => ({ ...row, transfer: transferDisplayState(row.state, row.transferStatus), bank: bankDisplayState(row.bankStatus) })),
    /** The partner's own dashboard figures, for the last 30, 90 and 365 days (UTC). */
    activity: ACTIVITY_DAYS.map((days, index) => ({ days, since: new Date(now.getTime() - days * 86_400_000), ...activity[index] })),
  };
}

const ACTIVITY_DAYS = [30, 90, 365] as const;

/* ------------------------------------------------------------------ exports */

export const EXPORT_REPORTS = ["commissions", "settlements", "ledger"] as const;
export type ExportReport = (typeof EXPORT_REPORTS)[number];
const EXPORT_BATCH = 500;
export const EXPORT_MAX_ROWS = 20_000;

const decimal = (amount: bigint | null, currency: string) => (amount === null ? "" : Money.of(amount, currency).toDecimalString());
const iso = (value: Date | null) => (value ? value.toISOString() : "");

/**
 * CSV rows for an export. Amounts are exact decimal strings in their own
 * currency (one currency per row, never summed across currencies). No
 * secret, no bank detail, no customer name or email: a customer is its
 * opaque reference and internal workspace id.
 */
export async function adminExport(deps: PartnerDeps, admin: AdminContext, input: { report: ExportReport; partnerId?: string; from?: Date; to?: Date }) {
  assertAdmin(admin);
  const environment = deps.settings.environment();
  if (!environment) return null;
  const repos = deps.uow.repositories;
  const now = deps.clock.now();
  const header: string[] =
    input.report === "commissions"
      ? ["commission_id", "partner_id", "partner_code", "customer_reference", "organization_id", "paid_at", "currency", "commissionable", "rate_bps", "tier", "commission", "reversed", "status", "matures_at", "settlement_id"]
      : input.report === "settlements"
        ? ["settlement_id", "partner_id", "partner_code", "run", "currency", "gross", "offset", "transfer_amount", "state", "transfer", "stripe_transfer_id", "bank", "created_at", "transferred_at", "bank_paid_at"]
        : ["entry_id", "partner_id", "currency", "kind", "amount", "operation_key", "commission_id", "settlement_id", "reason", "actor", "created_at"];
  const rows: string[][] = [];
  let truncated = false;
  for (let offset = 0; ; offset += EXPORT_BATCH) {
    if (rows.length >= EXPORT_MAX_ROWS) {
      truncated = true;
      break;
    }
    const limit = Math.min(EXPORT_BATCH, EXPORT_MAX_ROWS - rows.length);
    let fetched = 0;
    if (input.report === "commissions") {
      const page = await repos.reporting.commissions({ environment, partnerId: input.partnerId, from: input.from, to: input.to, offset, limit });
      fetched = page.rows.length;
      const partners = await partnersById(deps, page.rows.map((row) => row.partnerId));
      const customers = await repos.directory.organizationSummaries([...new Set(page.rows.map((row) => row.organizationId))]);
      for (const row of page.rows) {
        rows.push([
          row.id,
          row.partnerId,
          partners.get(row.partnerId)?.referralCode ?? "",
          customers[row.organizationId]?.reference ?? "",
          row.organizationId,
          iso(row.paidAt),
          row.currency.toUpperCase(),
          decimal(row.baseAmount, row.currency),
          String(row.rateBasisPoints),
          row.tierKey,
          decimal(row.amount, row.currency),
          decimal(row.reversedAmount, row.currency),
          commissionDisplayStatus(row, now),
          iso(row.maturesAt),
          row.settlementId ?? "",
        ]);
      }
    } else if (input.report === "settlements") {
      const page = await repos.reporting.settlements({ environment, partnerId: input.partnerId, from: input.from, to: input.to, offset, limit });
      fetched = page.rows.length;
      const partners = await partnersById(deps, page.rows.map((row) => row.partnerId));
      for (const row of page.rows) {
        rows.push([
          row.id,
          row.partnerId,
          partners.get(row.partnerId)?.referralCode ?? "",
          row.runKey,
          row.currency.toUpperCase(),
          decimal(row.grossAmount, row.currency),
          decimal(row.offsetAmount, row.currency),
          decimal(row.transferAmount, row.currency),
          row.state,
          transferDisplayState(row.state, row.transferStatus),
          row.stripeTransferId ?? "",
          bankDisplayState(row.bankStatus),
          iso(row.createdAt),
          iso(row.transferredAt),
          iso(row.bankPaidAt),
        ]);
      }
    } else {
      const page = await repos.reporting.ledger({ environment, partnerId: input.partnerId, from: input.from, to: input.to, offset, limit });
      fetched = page.rows.length;
      for (const row of page.rows) {
        rows.push([
          row.id,
          row.partnerId,
          row.currency.toUpperCase(),
          row.kind,
          decimal(row.amount, row.currency),
          row.operationKey,
          row.commissionId ?? "",
          row.settlementId ?? "",
          row.reason,
          row.actor,
          iso(row.createdAt),
        ]);
      }
    }
    if (fetched < limit) break;
  }
  return { environment, header, rows, truncated };
}
