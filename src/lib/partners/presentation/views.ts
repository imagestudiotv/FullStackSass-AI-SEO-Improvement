import type { Locale } from "@/lib/i18n/config";
import { formatDate, intlTag } from "@/lib/i18n/format";

import type { PlanSummary } from "../application/ports/directory";
import type { PartnerPayoutStatus, PayoutStep } from "../application/queries/payout-status";
import type { CouponRecord } from "../application/ports/repositories";
import type { CommissionDisplayStatus } from "../domain/entities/commission";
import type { BankDisplayState, TransferDisplayState } from "../domain/entities/settlement";
import { fill, type PartnerCopy } from "./copy";
import { rateLabel } from "./format";
import type { PayoutStatusCopy } from "./payout-status-copy";
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

export type FigureView = {
  key: "earned" | "pending" | "paid" | "referrals" | "payingCustomers";
  label: string;
  value: string;
  definition: string;
  /** What the figure is made of, in words ("Approved, paid at the next payout: EUR 24.75"). */
  details?: string[];
};

export type DashboardFigures = {
  currency: string;
  earned: bigint;
  unpaid: bigint;
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

/**
 * The client's three money figures - Total earned, Pending, Paid - with what
 * Pending and Paid are made of underneath. Pending is everything earned and
 * not yet sent (waiting the maturity days, approved for the next payout, or
 * being sent now); Paid is what was sent through Stripe, of which the part
 * already in the bank is shown too.
 *
 * `paid`: how partners are paid here now, when it is not only Stripe: the
 * words for "Paid", and no bank line or minimum for credits, which have none.
 */
export function balanceView(
  balance: DashboardFigures,
  copy: Portal,
  locale: Locale,
  maturityDays: number,
  paid?: { form: "credits" | "cash"; definition: string },
) {
  const money = (amount: bigint) => moneyView(amount, balance.currency, locale).display;
  const o = copy.overview;
  const b = o.breakdown;
  const pendingDetails = [
    fill(b.approved, { amount: money(balance.available) }),
    fill(b.waiting, { maturity: maturityDays, amount: money(balance.pending) }),
    ...(balance.inPayout > ZERO ? [fill(b.sending, { amount: money(balance.inPayout) })] : []),
  ];
  const figures: FigureView[] = [
    { key: "earned", label: o.cards.earned, value: money(balance.earned), definition: o.definitions.earned },
    { key: "pending", label: o.cards.pending, value: money(balance.unpaid), definition: o.definitions.pending, details: pendingDetails },
    {
      key: "paid",
      label: o.cards.paid,
      value: money(balance.transferred),
      definition: paid?.definition ?? o.definitions.paid,
      // Bank payouts only: credits and PayPal have no bank step.
      details: paid && balance.bankPaid === ZERO ? [] : [fill(b.inBank, { amount: money(balance.bankPaid) })],
    },
  ];
  const notes: string[] = [];
  if (balance.offset > ZERO) notes.push(fill(o.offset, { amount: money(balance.offset) }));
  if (paid?.form === "credits") return { currency: balance.currency.toUpperCase(), figures, notes };
  if (balance.threshold === null) notes.push(fill(o.noThreshold, { currency: balance.currency.toUpperCase() }));
  else if (balance.belowThreshold) notes.push(fill(o.threshold, { amount: money(balance.threshold) }));
  return { currency: balance.currency.toUpperCase(), figures, notes };
}

const STEP_TONE: Record<PayoutStep, "ready" | "todo" | "waiting" | "info"> = {
  credits_ready: "ready",
  credits_choose: "todo",
  credits_no_workspace: "todo",
  stripe_not_started: "todo",
  stripe_setup_required: "todo",
  stripe_verification_pending: "waiting",
  stripe_restricted: "todo",
  stripe_ready: "ready",
  paypal_confirm: "todo",
  paypal_ready: "ready",
  paypal_off: "info",
  country: "info",
  unavailable: "info",
};

/** "How and when you are paid", in words (application/queries/payout-status.ts). */
export function payoutStatusView(status: PartnerPayoutStatus, copy: PayoutStatusCopy, locale: Locale) {
  const step = copy.steps[status.step];
  const f = copy.facts;
  const byPayPal = status.step.startsWith("paypal");
  const facts =
    status.form === "credits"
      ? [fill(f.creditsWhen, { days: status.maturityDays }), f.other]
      : [
          fill(f.cashWhen, { days: status.maturityDays }),
          ...(status.minimum ? [fill(f.minimum, { amount: moneyView(status.minimum.amount, status.minimum.currency, locale).display })] : []),
          ...(status.nextRunAt && !status.paused ? [fill(f.nextRun, { date: day(status.nextRunAt, locale) })] : []),
          ...(status.step.startsWith("stripe") ? [f.bankDelay] : byPayPal ? [f.payPalDelay] : []),
          f.other,
        ];
  return {
    step: status.step,
    tone: STEP_TONE[status.step],
    heading: copy.title,
    title: step.title,
    body: step.body,
    paused: status.paused ? copy.paused : null,
    factsTitle: copy.factsTitle,
    facts,
    action: step.action,
    contact: status.step === "country" || status.step === "paypal_off" ? copy.contact : null,
  };
}

/** The client's two counts beside the money: referrals (all time) and the paying customers that set the tier. */
export function totalsView(totals: { referrals: number; payingCustomers: number }, copy: Portal, locale: Locale): FigureView[] {
  const number = new Intl.NumberFormat(intlTag(locale));
  const o = copy.overview;
  return [
    { key: "referrals", label: o.cards.referrals, value: number.format(totals.referrals), definition: o.definitions.referrals },
    { key: "payingCustomers", label: o.cards.payingCustomers, value: number.format(totals.payingCustomers), definition: o.definitions.payingCustomers },
  ];
}

/** "Grow · €99/month": the plan's name and list price, in the partner's language. */
export function planLabel(plan: PlanSummary | null, copy: Portal, locale: Locale): string {
  if (!plan) return "-";
  const price = new Intl.NumberFormat(intlTag(locale), {
    style: "currency",
    currency: plan.currency.toUpperCase(),
    minimumFractionDigits: plan.priceCents % 100 === 0 ? 0 : 2,
  }).format(plan.priceCents / 100);
  return `${plan.name} · ${fill(plan.interval === "year" ? copy.commissions.perYear : copy.commissions.perMonth, { price })}`;
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
  row: {
    id: string;
    paidAt: Date;
    customer: string | undefined;
    plan?: PlanSummary | null;
    currency: string;
    base: bigint;
    rateBasisPoints: number;
    amount: bigint;
    reversed: bigint;
    status: CommissionDisplayStatus;
    maturesAt: Date;
  },
  copy: Portal,
  locale: Locale,
) {
  const money = (amount: bigint) => moneyView(amount, row.currency, locale).display;
  return {
    id: row.id,
    date: day(row.paidAt, locale),
    customer: row.customer ?? "-",
    plan: planLabel(row.plan ?? null, copy, locale),
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
    /** Missing means Stripe: its two steps. PayPal and credits have one, and no bank. */
    method?: "stripe" | "paypal" | "credits";
    paidAt?: Date | null;
  },
  copy: Portal,
  locale: Locale,
  payouts?: PayoutStatusCopy["payouts"],
) {
  const money = (amount: bigint) => moneyView(amount, row.currency, locale).display;
  let bankDetail: string | null = null;
  if (row.bank === "paid") bankDetail = day(row.bankPaidAt ?? row.bankArrivalDate, locale);
  else if ((row.bank === "pending" || row.bank === "in_transit") && row.bankArrivalDate) bankDetail = fill(copy.payouts.arrival, { date: day(row.bankArrivalDate, locale) });
  const direct = payouts && (row.method === "paypal" || row.method === "credits");
  if (direct) {
    const arrived = row.transfer === "confirmed";
    return {
      id: row.id,
      date: day(row.createdAt, locale),
      amount: money(row.amount),
      offset: row.offset > ZERO ? fill(copy.payouts.offset, { amount: money(row.offset) }) : null,
      transfer: copy.payouts.transferStates[row.transfer],
      transferTone: TRANSFER_TONE[row.transfer],
      bank: row.method === "paypal" ? payouts.viaPayPal : payouts.viaCredits,
      bankTone: arrived ? ("success" as Tone) : ("neutral" as Tone),
      bankDetail: arrived && row.paidAt ? day(row.paidAt, locale) : null,
    };
  }
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
