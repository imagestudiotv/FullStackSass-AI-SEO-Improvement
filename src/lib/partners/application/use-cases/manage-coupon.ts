import { MIN_REASON_LENGTH, type AdminContext } from "../contracts/commands";
import { fail, ok, type Result } from "../contracts/results";
import type { CouponRecord } from "../ports/repositories";
import type { PartnerDeps } from "./deps";

/**
 * Affiliate coupons, assigned by an administrator: a Stripe coupon and its
 * customer-facing promotion code, created through the Stripe API. The
 * default for every partner is NO coupon; a partner sees only their own.
 *
 * DURATION, MONTHLY AND ANNUAL. Stripe applies a coupon to the invoices of
 * its duration:
 *   percent_first_payment   "once": the first payment only, monthly or annual.
 *   percent_first_3_months  "repeating", 3 months: on a MONTHLY plan the first
 *                           three payments; on an ANNUAL plan it discounts the
 *                           whole first annual payment (one invoice falls in
 *                           the three months). RepGet's monthly and annual
 *                           prices share a product, so this cannot be limited
 *                           to monthly by product - creating it requires the
 *                           administrator to acknowledge the annual behaviour.
 *   fixed_amount            a fixed amount off the first payment ("once").
 *   custom                  any duration ("once", "repeating" N months,
 *                           "forever"), percent or fixed.
 * Restrictions Stripe enforces: products, expiry date, currency (fixed
 * amounts), maximum redemptions, first-time customers only. A start date in
 * the future creates the code INACTIVE; the commissions sweep activates it
 * when the date comes.
 *
 * Redemption is read from the PAID invoice's discounts (process-payment.ts),
 * never trusted from a form.
 */

export type CouponInput = {
  partnerId: string;
  code: string;
  campaign: string;
  discountType: "percent_first_payment" | "percent_first_3_months" | "fixed_amount" | "custom";
  percentOffBasisPoints?: number | null;
  amountOff?: bigint | null;
  currency?: string | null;
  duration?: "once" | "repeating" | "forever";
  durationInMonths?: number | null;
  appliesToProducts?: string[];
  startsAt?: Date | null;
  expiresAt?: Date | null;
  maxRedemptions?: number | null;
  firstTimeTransaction?: boolean;
  /** Required for percent_first_3_months: on an annual plan it discounts the whole first annual payment. */
  acknowledgeAnnualBehaviour?: boolean;
};

const CODE_RE = /^[A-Z0-9]{4,24}$/;

export function couponTerms(input: CouponInput): Result<Pick<CouponRecord, "percentOffBasisPoints" | "amountOff" | "currency" | "duration" | "durationInMonths">> {
  const percent = input.percentOffBasisPoints ?? null;
  const amount = input.amountOff ?? null;
  const validPercent = percent !== null && Number.isInteger(percent) && percent >= 100 && percent <= 10_000;
  const validAmount = amount !== null && amount > BigInt(0) && amount <= BigInt(Number.MAX_SAFE_INTEGER);
  switch (input.discountType) {
    case "percent_first_payment":
      if (!validPercent) return fail("invalid", "percent");
      return ok({ percentOffBasisPoints: percent, amountOff: null, currency: null, duration: "once", durationInMonths: null });
    case "percent_first_3_months":
      if (!validPercent) return fail("invalid", "percent");
      if (!input.acknowledgeAnnualBehaviour) return fail("invalid", "annual_behaviour_unacknowledged");
      return ok({ percentOffBasisPoints: percent, amountOff: null, currency: null, duration: "repeating", durationInMonths: 3 });
    case "fixed_amount":
      if (!validAmount || !input.currency) return fail("invalid", "amount");
      return ok({ percentOffBasisPoints: null, amountOff: amount, currency: input.currency.toLowerCase(), duration: "once", durationInMonths: null });
    case "custom": {
      if (validPercent === validAmount) return fail("invalid", "percent_or_amount");
      if (validAmount && !input.currency) return fail("invalid", "currency");
      const duration = input.duration ?? "once";
      const months = input.durationInMonths ?? null;
      if (duration === "repeating" && (!months || !Number.isInteger(months) || months < 1 || months > 36)) return fail("invalid", "duration_in_months");
      return ok({
        percentOffBasisPoints: validPercent ? percent : null,
        amountOff: validAmount ? amount : null,
        currency: validAmount ? input.currency!.toLowerCase() : null,
        duration,
        durationInMonths: duration === "repeating" ? months : null,
      });
    }
    default:
      return fail("invalid", "discount_type");
  }
}

export async function createPartnerCoupon(deps: PartnerDeps, admin: AdminContext, input: CouponInput): Promise<Result<CouponRecord>> {
  const gateway = deps.couponGateway;
  const environment = deps.settings.environment();
  if (!gateway || !environment) return fail("disabled", "stripe_not_configured");
  const code = input.code.trim().toUpperCase();
  if (!CODE_RE.test(code)) return fail("invalid", "code");
  const campaign = input.campaign.trim();
  if (campaign.length < 3 || campaign.length > 60) return fail("invalid", "campaign");
  const terms = couponTerms(input);
  if (!terms.ok) return terms;
  const now = deps.clock.now();
  if (input.expiresAt && input.expiresAt.getTime() <= now.getTime()) return fail("invalid", "expires_at");
  if (input.startsAt && input.expiresAt && input.startsAt.getTime() >= input.expiresAt.getTime()) return fail("invalid", "starts_at");
  if (input.maxRedemptions !== undefined && input.maxRedemptions !== null && (!Number.isInteger(input.maxRedemptions) || input.maxRedemptions < 1)) {
    return fail("invalid", "max_redemptions");
  }

  const repos = deps.uow.repositories;
  const partner = await repos.partners.findById(input.partnerId);
  if (!partner) return fail("not_found");
  if (partner.status !== "active") return fail("invalid", "partner_suspended");

  const created = await deps.uow.transaction(async (tx) => {
    const row = await tx.coupons.create({
      environment,
      partnerId: partner.id,
      code,
      campaign,
      discountType: input.discountType,
      ...terms.value,
      appliesToProducts: input.appliesToProducts ?? [],
      startsAt: input.startsAt ?? null,
      expiresAt: input.expiresAt ?? null,
      maxRedemptions: input.maxRedemptions ?? null,
      firstTimeTransaction: input.firstTimeTransaction ?? true,
      createdByEmail: admin.email,
    });
    if (!row) return null;
    await tx.audit.record({
      actorEmail: admin.email,
      action: "partner.coupon_created",
      targetType: "partner_coupon",
      targetId: row.id,
      summary: `Created coupon ${code} for partner ${partner.contactEmail}`,
      detail: { partnerId: partner.id, campaign, discountType: input.discountType, percentOffBasisPoints: terms.value.percentOffBasisPoints, amountOff: terms.value.amountOff?.toString() ?? null },
    });
    return row;
  });
  if (!created) return fail("conflict", "code_taken");

  // Stripe, outside the transaction, with idempotency keys derived from the row.
  try {
    const stripeIds = await gateway.createCouponWithCode({
      name: `${campaign} (${code})`,
      percentOffBasisPoints: terms.value.percentOffBasisPoints,
      amountOff: terms.value.amountOff,
      currency: terms.value.currency,
      duration: terms.value.duration,
      durationInMonths: terms.value.durationInMonths,
      appliesToProducts: input.appliesToProducts ?? [],
      code,
      expiresAt: input.expiresAt ?? null,
      maxRedemptions: input.maxRedemptions ?? null,
      firstTimeTransaction: input.firstTimeTransaction ?? true,
      metadata: { repget_partner_id: partner.id, repget_coupon_id: created.id },
      idempotencyKey: `partner-coupon:${created.id}`,
      active: !(input.startsAt && input.startsAt.getTime() > now.getTime()),
    });
    // A campaign that starts later stays "creating" (not shown, not redeemable) until activateDueCoupons.
    const status = input.startsAt && input.startsAt.getTime() > now.getTime() ? "creating" : "active";
    const ids = { stripeCouponId: stripeIds.couponId, stripePromotionCodeId: stripeIds.promotionCodeId };
    await repos.coupons.attachStripe(created.id, ids, status);
    return ok({ ...created, ...ids, status });
  } catch (error) {
    await repos.coupons.setStatus(created.id, "failed", deps.clock.now());
    console.error("[partners] coupon creation failed at Stripe", error);
    return fail("invalid", "stripe_refused");
  }
}

export async function deactivatePartnerCoupon(deps: PartnerDeps, admin: AdminContext, couponId: string, reason: string): Promise<Result<null>> {
  if (reason.trim().length < MIN_REASON_LENGTH) return fail("invalid", "reason");
  const gateway = deps.couponGateway;
  if (!gateway) return fail("disabled", "stripe_not_configured");
  const repos = deps.uow.repositories;
  const coupon = await repos.coupons.findById(couponId);
  if (!coupon) return fail("not_found");
  if (coupon.status === "inactive") return ok(null);
  if (coupon.stripePromotionCodeId) await gateway.deactivatePromotionCode(coupon.stripePromotionCodeId);
  await deps.uow.transaction(async (tx) => {
    await tx.coupons.setStatus(couponId, "inactive", deps.clock.now());
    await tx.audit.record({
      actorEmail: admin.email,
      action: "partner.coupon_deactivated",
      targetType: "partner_coupon",
      targetId: couponId,
      summary: `Deactivated coupon ${coupon.code}`,
      detail: { reason: reason.trim() },
    });
  });
  return ok(null);
}

/** Codes whose start date has come: activated at Stripe, then shown to the partner. */
export async function activateDueCoupons(deps: PartnerDeps) {
  const gateway = deps.couponGateway;
  const environment = deps.settings.environment();
  if (!gateway || !environment) return { activated: 0 };
  const repos = deps.uow.repositories;
  const now = deps.clock.now();
  let activated = 0;
  const { rows } = await repos.coupons.list(environment, { offset: 0, limit: 200 });
  for (const coupon of rows) {
    if (coupon.status !== "creating" || !coupon.stripePromotionCodeId || !coupon.startsAt || coupon.startsAt.getTime() > now.getTime()) continue;
    await gateway.activatePromotionCode(coupon.stripePromotionCodeId);
    await repos.coupons.setStatus(coupon.id, "active", now);
    activated += 1;
  }
  return { activated };
}
