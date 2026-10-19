import type { Locale } from "@/lib/i18n/config";
import { formatDate, intlTag } from "@/lib/i18n/format";

import type { CouponRecord } from "../application/ports/repositories";
import type { CommissionDisplayStatus } from "../domain/entities/commission";
import type { BankDisplayState, TransferDisplayState } from "../domain/entities/settlement";
import { fill, type PartnerCopy } from "./copy";
import { rateLabel } from "./format";
import { moneyView } from "./serializers";

/**
 * Portal view models: the query results (exact records) turned into the
 * words and formatted figures a page shows. Formatting only - every amount
 * was computed by the application layer from the ledger; nothing here adds,
 * subtracts or converts money.
 */

type Portal = PartnerCopy["portal"];

const day = (value: Date | null | undefined, locale: Locale) =>
  value ? formatDate(value, locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "-";

export type FigureView = { key: "earned" | "pending" | "available" | "transferred" | "bankPaid"; label: string; value: string; definition: string };

export type DashboardFigures = {
  currency: string;
  earned: bigint;
  pending: bigint;
  available: bigint;
  inPayout: bigint;
  transferred: bigint;
  bankPaid: bigint;
  offset: bigint;
  threshold: bigint | null;
  belowThreshold: boolean;
  updatedAt: Date;
};

const ZERO = BigInt(0);

export function balanceView(balance: DashboardFigures, copy: Portal, locale: Locale, maturityDays: number) {
  const money = (amount: bigint) => moneyView(amount, balance.currency, locale).display;
  const o = copy.overview;
  const figures: FigureView[] = [
    { key: "earned", label: o.cards.earned, value: money(balance.earned), definition: o.definitions.earned },
    { key: "pending", label: o.cards.pending, value: money(balance.pending), definition: fill(o.definitions.pending, { maturity: maturityDays }) },
    { key: "available", label: o.cards.available, value: money(balance.available), definition: o.definitions.available },
    { key: "transferred", label: o.cards.transferred, value: money(balance.transferred), definition: o.definitions.transferred },
    { key: "bankPaid", label: o.cards.bankPaid, value: money(balance.bankPaid), definition: o.definitions.bankPaid },
  ];
  const notes: string[] = [];
  if (balance.inPayout > ZERO) notes.push(fill(o.inPayout, { amount: money(balance.inPayout) }));
  if (balance.offset > ZERO) notes.push(fill(o.offset, { amount: money(balance.offset) }));
  if (balance.threshold === null) notes.push(fill(o.noThreshold, { currency: balance.currency.toUpperCase() }));
  else if (balance.belowThreshold) notes.push(fill(o.threshold, { amount: money(balance.threshold) }));
  return { currency: balance.currency.toUpperCase(), figures, notes };
}

export function metricsView(
  metrics: { clicks: number; signups: number; customers: number; payingCustomers: number; days: number; since: Date; until: Date },
  copy: Portal,
  locale: Locale,
) {
  const m = copy.overview.metrics;
  const number = new Intl.NumberFormat(intlTag(locale));
  let conversion = "-";
  if (metrics.clicks > 0) {
    conversion = new Intl.NumberFormat(intlTag(locale), { style: "percent", maximumFractionDigits: 1 }).format(metrics.payingCustomers / metrics.clicks);
  }
  return {
    period: fill(m.since, { start: day(metrics.since, locale), end: day(metrics.until, locale) }),
    definition: m.definition,
    tiles: [
      { key: "clicks", label: m.clicks, value: number.format(metrics.clicks) },
      { key: "signups", label: m.signups, value: number.format(metrics.signups) },
      { key: "referred", label: m.referred, value: number.format(metrics.customers) },
      { key: "customers", label: m.customers, value: number.format(metrics.payingCustomers) },
      { key: "conversion", label: m.conversion, value: conversion },
    ],
  };
}

export function couponView(coupon: Pick<CouponRecord, "code" | "percentOffBasisPoints" | "amountOff" | "currency" | "expiresAt">, copy: Portal, locale: Locale) {
  const discount =
    coupon.percentOffBasisPoints !== null
      ? rateLabel(coupon.percentOffBasisPoints)
      : coupon.amountOff !== null && coupon.currency
        ? moneyView(coupon.amountOff, coupon.currency, locale).display
        : "";
  return { code: coupon.code, discount: fill(copy.overview.couponDiscount, { discount }), expires: coupon.expiresAt ? day(coupon.expiresAt, locale) : null };
}

const COMMISSION_TONE: Record<CommissionDisplayStatus, Tone> = {
  pending: "neutral",
  available: "success",
  reserved: "info",
  paid: "success",
  reversed: "danger",
  held: "warning",
  review: "warning",
};

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

export function commissionRowView(
  row: { id: string; paidAt: Date; customer: string | undefined; currency: string; base: bigint; rateBasisPoints: number; amount: bigint; reversed: bigint; status: CommissionDisplayStatus; maturesAt: Date },
  copy: Portal,
  locale: Locale,
) {
  const money = (amount: bigint) => moneyView(amount, row.currency, locale).display;
  return {
    id: row.id,
    date: day(row.paidAt, locale),
    customer: row.customer ?? "-",
    base: money(row.base),
    rate: rateLabel(row.rateBasisPoints),
    amount: money(row.amount),
    reversed: row.reversed > ZERO ? fill(copy.commissions.reversed, { amount: money(row.reversed) }) : null,
    status: copy.commissions.statuses[row.status],
    tone: COMMISSION_TONE[row.status],
    matures: row.status === "pending" || row.status === "held" || row.status === "review" ? day(row.maturesAt, locale) : null,
  };
}

const TRANSFER_TONE: Record<TransferDisplayState, Tone> = { pending: "neutral", processing: "info", confirmed: "success", reversed: "danger" };
const BANK_TONE: Record<BankDisplayState, Tone> = { not_started: "neutral", pending: "info", in_transit: "info", paid: "success", failed: "warning" };

export function payoutRowView(
  row: {
    id: string;
    createdAt: Date;
    currency: string;
    amount: bigint;
    offset: bigint;
    transfer: TransferDisplayState;
    bank: BankDisplayState;
    bankPaidAt: Date | null;
    bankArrivalDate: Date | null;
  },
  copy: Portal,
  locale: Locale,
) {
  const money = (amount: bigint) => moneyView(amount, row.currency, locale).display;
  let bankDetail: string | null = null;
  if (row.bank === "paid") bankDetail = day(row.bankPaidAt ?? row.bankArrivalDate, locale);
  else if ((row.bank === "pending" || row.bank === "in_transit") && row.bankArrivalDate) bankDetail = fill(copy.payouts.arrival, { date: day(row.bankArrivalDate, locale) });
  return {
    id: row.id,
    date: day(row.createdAt, locale),
    amount: money(row.amount),
    offset: row.offset > ZERO ? fill(copy.payouts.offset, { amount: money(row.offset) }) : null,
    transfer: copy.payouts.transferStates[row.transfer],
    transferTone: TRANSFER_TONE[row.transfer],
    bank: copy.payouts.bankStates[row.bank],
    bankTone: BANK_TONE[row.bank],
    bankDetail,
  };
}

const REFERRAL_TONE: Record<"active" | "review" | "disqualified", Tone> = { active: "success", review: "warning", disqualified: "neutral" };

export function referralRowView(
  row: { id: string; customer: string | undefined; source: "link" | "coupon"; status: "active" | "review" | "disqualified"; since: Date },
  copy: Portal,
  locale: Locale,
) {
  return {
    id: row.id,
    customer: row.customer ?? "-",
    source: copy.referrals.sources[row.source],
    since: day(row.since, locale),
    status: copy.referrals.statuses[row.status],
    tone: REFERRAL_TONE[row.status],
  };
}

export function pagerView(input: { page: number; pageSize: number; total: number }, copy: Portal) {
  const pages = Math.max(1, Math.ceil(input.total / input.pageSize));
  return {
    page: input.page,
    pages,
    label: fill(copy.pagination.page, { page: input.page, pages }),
    previous: input.page > 1 ? input.page - 1 : null,
    next: input.page < pages ? input.page + 1 : null,
    previousLabel: copy.pagination.previous,
    nextLabel: copy.pagination.next,
  };
}

export { day as formatPortalDate };
