"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/guard";

import type { AdminContext } from "../application/contracts/commands";
import type { Result } from "../application/contracts/results";
import { adminSettlementDetail } from "../application/queries/admin-reports";
import { adjustPartnerBalance, approveCommission, holdCommission, rejectCommission } from "../application/use-cases/manage-commission";
import { createPartnerCoupon, deactivatePartnerCoupon } from "../application/use-cases/manage-coupon";
import { confirmAttribution, disqualifyAttribution, resolveReviewCase } from "../application/use-cases/manage-fraud-case";
import { setProgramControl } from "../application/use-cases/manage-program";
import { prepareSettlementNow, reconcileNow, retrySettlement, runMonthlySettlementsNow } from "../application/use-cases/manage-settlement";
import { cancelSettlement } from "../application/use-cases/prepare-settlement";
import { requestTransferReversal } from "../application/use-cases/reconcile-settlement";
import {
  approveApplication,
  rejectApplication,
  setPartnerStatus,
  setPayoutHold,
} from "../application/use-cases/review-application";
import { InvalidAmountError, UnsupportedCurrencyError } from "../domain/errors";
import { Money } from "../domain/value-objects/money";
import { partnerDeps } from "../server";
import {
  amountTextSchema,
  controlKeySchema,
  couponFormSchema,
  currencySchema,
  idSchema,
  percentToBasisPoints,
  reasonSchema,
  utcDateFrom,
  type CouponForm,
} from "./validation";

/**
 * Administrator actions on the partner program. Every one calls
 * requireAdmin() itself (verified, allowlisted address - lib/admin/guard.ts),
 * requires a reason for anything that overrides, and is audited by the use
 * case in the same transaction as the change.
 */

export type AdminAnswer<T = null> = { ok: true; data: T } | { ok: false; error: string };

const MESSAGES: Record<string, string> = {
  invalid: "That request is not valid.",
  not_found: "Not found. It may have been removed.",
  conflict: "This was changed by someone else. Reload and try again.",
  disabled: "This part of the partner program is switched off.",
  forbidden: "Not allowed.",
  reason: "Give a reason of at least 5 characters.",
  amount: "Enter an amount such as 12.50 (or -12.50 to deduct).",
  currency: "That currency is not supported.",
  stripe_not_configured: "Stripe is not configured on this deployment.",
  unbacked_credit: "A credit can only cancel an earlier deduction. Positive amounts that no commission backs would never be paid out.",
  rejected: "This commission was rejected; it cannot be approved.",
  not_an_admin_hold: "This hold was set by a dispute. Only the dispute's outcome releases it.",
  status_reserved: "This commission is in a payout being sent. Cancel or finish that payout first.",
  status_paid: "This commission is paid. Correct it with a balance adjustment instead.",
  disqualified: "This referral was disqualified.",
  transfer_may_exist: "A transfer may already exist at Stripe. Retry to reconcile it instead of cancelling.",
  no_confirmed_transfer: "No confirmed transfer to reverse.",
  more_than_owed: "That is more than the partner owes back.",
  more_than_transfer: "That is more than what remains of the transfer.",
  code: "Use 4-24 capital letters or digits for the code.",
  campaign: "Give the campaign a name of 3-60 characters.",
  percent: "Enter a percentage between 1 and 100.",
  annual_behaviour_unacknowledged: "Confirm that on an annual plan this discounts the whole first annual payment.",
  expires_at: "The end date must be in the future.",
  starts_at: "The start date must be before the end date.",
  max_redemptions: "The redemption limit must be a whole number of at least 1.",
  code_taken: "That code already exists.",
  stripe_refused: "Stripe refused the coupon. Nothing was created.",
  partner_suspended: "The partner is suspended.",
};

/** Why a payout could not be prepared, in words. */
const SETTLEMENT_REASONS: Record<string, string> = {
  stripe_not_configured: "Stripe is not configured on this deployment.",
  payouts_disabled: "The payouts switch is off.",
  money_movement_blocked: "Live money movement is blocked (PARTNER_LIVE_PAYOUTS is not 'enabled').",
  onboarding_incomplete: "The partner's Stripe account is not ready for payouts.",
  not_found: "Partner not found.",
  payout_hold: "The partner's payouts are held.",
  partner_suspended: "The partner is suspended.",
  already_settled: "This month already has a payout for this partner and currency, or one is still being sent.",
  nothing_payable: "Nothing is payable yet.",
  negative_position: "Corrections still to deduct exceed what is payable.",
  no_threshold: "Automatic payouts are not offered in this currency.",
  below_threshold: "The payable amount is below the payout threshold.",
};

async function admin(): Promise<AdminContext> {
  const who = await requireAdmin();
  return { kind: "admin", userId: who.userId, email: who.email };
}

function answer<T>(result: Result<T>): AdminAnswer<T> {
  if (result.ok) return { ok: true, data: result.value };
  const detail = result.detail ?? "";
  if (detail.startsWith("state_")) return { ok: false, error: `Not possible while the payout is "${detail.slice(6).replace(/_/g, " ")}".` };
  return { ok: false, error: MESSAGES[detail] ?? MESSAGES[result.reason] ?? `Refused: ${result.reason}` };
}

const invalid = (key = "invalid"): AdminAnswer<never> => ({ ok: false, error: MESSAGES[key] });

function moneyFrom(text: string, currency: string): Money | null {
  if (!amountTextSchema.safeParse(text).success) return null;
  try {
    return Money.parseDecimal(text, currency);
  } catch (error) {
    if (error instanceof InvalidAmountError || error instanceof UnsupportedCurrencyError) return null;
    throw error;
  }
}

function refresh() {
  revalidatePath("/admin/partners", "layout");
}

export async function approvePartnerApplicationAction(applicationId: string, note?: string): Promise<AdminAnswer<{ partnerId: string }>> {
  const who = await admin();
  if (!idSchema.safeParse(applicationId).success) return { ok: false, error: MESSAGES.invalid };
  const result = await approveApplication(partnerDeps(), who, applicationId, note?.trim() || null);
  refresh();
  return result.ok ? { ok: true, data: { partnerId: result.value.partner.id } } : answer(result);
}

export async function rejectPartnerApplicationAction(applicationId: string, reason: string): Promise<AdminAnswer> {
  const who = await admin();
  if (!idSchema.safeParse(applicationId).success) return { ok: false, error: MESSAGES.invalid };
  if (!reasonSchema.safeParse(reason).success) return { ok: false, error: MESSAGES.reason };
  const result = await rejectApplication(partnerDeps(), who, applicationId, reason);
  refresh();
  return answer(result);
}

export async function setPartnerStatusAction(partnerId: string, status: "active" | "suspended", reason: string): Promise<AdminAnswer> {
  const who = await admin();
  if (!idSchema.safeParse(partnerId).success || !["active", "suspended"].includes(status)) {
    return { ok: false, error: MESSAGES.invalid };
  }
  if (!reasonSchema.safeParse(reason).success) return { ok: false, error: MESSAGES.reason };
  const result = await setPartnerStatus(partnerDeps(), who, partnerId, status, reason);
  refresh();
  return answer(result);
}

export async function setPartnerPayoutHoldAction(partnerId: string, hold: boolean, reason: string): Promise<AdminAnswer> {
  const who = await admin();
  if (!idSchema.safeParse(partnerId).success) return { ok: false, error: MESSAGES.invalid };
  if (!reasonSchema.safeParse(reason).success) return { ok: false, error: MESSAGES.reason };
  const result = await setPayoutHold(partnerDeps(), who, partnerId, Boolean(hold), reason);
  refresh();
  return answer(result);
}

export async function setPartnerControlAction(key: string, enabled: boolean, reason: string): Promise<AdminAnswer> {
  const who = await admin();
  const parsedKey = controlKeySchema.safeParse(key);
  if (!parsedKey.success) return { ok: false, error: MESSAGES.invalid };
  if (!reasonSchema.safeParse(reason).success) return { ok: false, error: MESSAGES.reason };
  const result = await setProgramControl(partnerDeps(), who, parsedKey.data, Boolean(enabled), reason);
  refresh();
  return answer(result);
}

/* ---------------------------------------------------------------- payouts */

export async function prepareSettlementNowAction(partnerId: string, currency: string, reason: string): Promise<AdminAnswer<{ message: string }>> {
  const who = await admin();
  const parsedCurrency = currencySchema.safeParse(currency);
  if (!idSchema.safeParse(partnerId).success || !parsedCurrency.success) return invalid();
  if (!reasonSchema.safeParse(reason).success) return invalid("reason");
  const result = await prepareSettlementNow(partnerDeps(), who, { partnerId, currency: parsedCurrency.data, reason });
  refresh();
  if (!result.ok) return answer(result);
  const outcome = result.value;
  if (outcome.kind === "created") return { ok: true, data: { message: "Payout prepared. It is being sent through Stripe now." } };
  return { ok: false, error: SETTLEMENT_REASONS[outcome.reason] ?? `Not prepared: ${outcome.reason}` };
}

export async function runMonthlySettlementsAction(reason: string): Promise<AdminAnswer<{ message: string }>> {
  const who = await admin();
  if (!reasonSchema.safeParse(reason).success) return invalid("reason");
  const result = await runMonthlySettlementsNow(partnerDeps(), who, reason);
  refresh();
  if (!result.ok) return answer(result);
  const { created, carriedForward, skipped } = result.value;
  return { ok: true, data: { message: `${created} prepared, ${carriedForward} carried forward, ${skipped} skipped.` } };
}

export async function retrySettlementAction(settlementId: string, reason: string): Promise<AdminAnswer<{ state: string }>> {
  const who = await admin();
  if (!idSchema.safeParse(settlementId).success) return invalid();
  if (!reasonSchema.safeParse(reason).success) return invalid("reason");
  const result = await retrySettlement(partnerDeps(), who, settlementId, reason);
  refresh();
  if (!result.ok) return answer(result);
  if (result.value.state === "busy") return { ok: false, error: "Another worker is executing this payout right now. Reload in a minute." };
  return { ok: true, data: { state: result.value.state } };
}

export async function cancelSettlementAction(settlementId: string, reason: string): Promise<AdminAnswer> {
  const who = await admin();
  if (!idSchema.safeParse(settlementId).success) return invalid();
  if (!reasonSchema.safeParse(reason).success) return invalid("reason");
  const result = await cancelSettlement(partnerDeps(), who, settlementId, reason.trim());
  refresh();
  return answer(result);
}

export async function requestTransferReversalAction(settlementId: string, amount: string, reason: string): Promise<AdminAnswer<{ status: string }>> {
  const who = await admin();
  if (!idSchema.safeParse(settlementId).success) return invalid();
  if (!reasonSchema.safeParse(reason).success) return invalid("reason");
  const deps = partnerDeps();
  const detail = await adminSettlementDetail(deps, who, settlementId);
  if (!detail) return invalid("not_found");
  const money = moneyFrom(amount, detail.settlement.currency);
  if (!money || !money.isPositive()) return invalid("amount");
  const result = await requestTransferReversal(deps, who, { settlementId, amount: money.amount, reason });
  refresh();
  return answer(result);
}

export async function reconcileNowAction(reason: string): Promise<AdminAnswer<{ message: string }>> {
  const who = await admin();
  if (!reasonSchema.safeParse(reason).success) return invalid("reason");
  const result = await reconcileNow(partnerDeps(), who, reason);
  refresh();
  if (!result.ok) return answer(result);
  return { ok: true, data: { message: `${result.value.findings} finding(s) recorded as review cases; ${result.value.recovered} missed payment(s) queued again.` } };
}

/* ------------------------------------------------------------ commissions */

export async function approveCommissionAction(commissionId: string, reason: string): Promise<AdminAnswer> {
  const who = await admin();
  if (!idSchema.safeParse(commissionId).success) return invalid();
  if (!reasonSchema.safeParse(reason).success) return invalid("reason");
  const result = await approveCommission(partnerDeps(), who, commissionId, reason);
  refresh();
  return answer(result);
}

export async function rejectCommissionAction(commissionId: string, reason: string): Promise<AdminAnswer> {
  const who = await admin();
  if (!idSchema.safeParse(commissionId).success) return invalid();
  if (!reasonSchema.safeParse(reason).success) return invalid("reason");
  const result = await rejectCommission(partnerDeps(), who, commissionId, reason);
  refresh();
  return answer(result);
}

export async function holdCommissionAction(commissionId: string, hold: boolean, reason: string): Promise<AdminAnswer> {
  const who = await admin();
  if (!idSchema.safeParse(commissionId).success) return invalid();
  if (!reasonSchema.safeParse(reason).success) return invalid("reason");
  const result = await holdCommission(partnerDeps(), who, commissionId, Boolean(hold), reason);
  refresh();
  return answer(result);
}

export async function adjustPartnerBalanceAction(partnerId: string, currency: string, amount: string, reason: string): Promise<AdminAnswer> {
  const who = await admin();
  const parsedCurrency = currencySchema.safeParse(currency);
  if (!idSchema.safeParse(partnerId).success) return invalid();
  if (!parsedCurrency.success) return invalid("currency");
  if (!reasonSchema.safeParse(reason).success) return invalid("reason");
  const money = moneyFrom(amount, parsedCurrency.data);
  if (!money || money.isZero()) return invalid("amount");
  const result = await adjustPartnerBalance(partnerDeps(), who, { partnerId, currency: money.code, amount: money.amount, reason });
  refresh();
  return answer(result);
}

/* ---------------------------------------------------------------- coupons */

export async function createPartnerCouponAction(partnerId: string, form: CouponForm): Promise<AdminAnswer<{ code: string }>> {
  const who = await admin();
  const parsed = couponFormSchema.safeParse(form);
  if (!idSchema.safeParse(partnerId).success || !parsed.success) return invalid();
  const values = parsed.data;
  const startsAt = utcDateFrom(values.startsAt);
  const expiresAt = utcDateFrom(values.expiresAt);
  if (startsAt === undefined) return invalid("starts_at");
  if (expiresAt === undefined) return invalid("expires_at");
  const maxRedemptions = values.maxRedemptions ? Number(values.maxRedemptions) : null;
  if (maxRedemptions !== null && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1)) return invalid("max_redemptions");

  let percentOffBasisPoints: number | null = null;
  let amountOff: bigint | null = null;
  let currency: string | null = null;
  if (values.discountType === "fixed_amount") {
    const parsedCurrency = currencySchema.safeParse(values.currency ?? "");
    if (!parsedCurrency.success) return invalid("currency");
    const money = moneyFrom(values.amount ?? "", parsedCurrency.data);
    if (!money || !money.isPositive()) return invalid("amount");
    amountOff = money.amount;
    currency = money.code;
  } else {
    percentOffBasisPoints = percentToBasisPoints(values.percent ?? "");
    if (percentOffBasisPoints === null) return invalid("percent");
  }

  const result = await createPartnerCoupon(partnerDeps(), who, {
    partnerId,
    code: values.code,
    campaign: values.campaign,
    discountType: values.discountType,
    percentOffBasisPoints,
    amountOff,
    currency,
    startsAt,
    expiresAt,
    maxRedemptions,
    firstTimeTransaction: true,
    acknowledgeAnnualBehaviour: values.acknowledgeAnnualBehaviour === true,
  });
  refresh();
  return result.ok ? { ok: true, data: { code: result.value.code } } : answer(result);
}

export async function deactivatePartnerCouponAction(couponId: string, reason: string): Promise<AdminAnswer> {
  const who = await admin();
  if (!idSchema.safeParse(couponId).success) return invalid();
  if (!reasonSchema.safeParse(reason).success) return invalid("reason");
  const result = await deactivatePartnerCoupon(partnerDeps(), who, couponId, reason);
  refresh();
  return answer(result);
}

/* ------------------------------------------------ review cases, attribution */

export async function resolveReviewCaseAction(caseId: string, outcome: "resolved" | "dismissed", reason: string): Promise<AdminAnswer> {
  const who = await admin();
  if (!idSchema.safeParse(caseId).success || !["resolved", "dismissed"].includes(outcome)) return invalid();
  if (!reasonSchema.safeParse(reason).success) return invalid("reason");
  const result = await resolveReviewCase(partnerDeps(), who, { caseId, outcome, resolution: reason, reason });
  refresh();
  return answer(result);
}

export async function confirmAttributionAction(attributionId: string, reason: string): Promise<AdminAnswer<{ approved: number }>> {
  const who = await admin();
  if (!idSchema.safeParse(attributionId).success) return invalid();
  if (!reasonSchema.safeParse(reason).success) return invalid("reason");
  const result = await confirmAttribution(partnerDeps(), who, attributionId, reason);
  refresh();
  return answer(result);
}

export async function disqualifyAttributionAction(attributionId: string, reason: string): Promise<AdminAnswer<{ rejected: number }>> {
  const who = await admin();
  if (!idSchema.safeParse(attributionId).success) return invalid();
  if (!reasonSchema.safeParse(reason).success) return invalid("reason");
  const result = await disqualifyAttribution(partnerDeps(), who, attributionId, reason);
  refresh();
  return answer(result);
}
