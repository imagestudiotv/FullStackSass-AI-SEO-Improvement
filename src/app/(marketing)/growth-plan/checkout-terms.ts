import { perMonthOfYear, planDisplayPrice } from "@/lib/billing/display-prices";
import { isDirectPurchaseTier, toPickerPlan, type PickerPlan } from "@/lib/plans/features";

/**
 * The growth plan's billing step (billing-step.tsx): the plan being bought,
 * and the terms said beside the payment buttons.
 *
 * THE SAME RULES AS THE ONBOARDING PLAN STEP (onboarding/plan/plan-step.tsx),
 * which is what checkout itself follows, so this step can never promise what
 * Stripe or PayPal will not do:
 *
 *  - The free trial is offered only to a workspace that has never subscribed
 *    (isTrialEligible), and then by card it is "€0 today · 3 days free", then
 *    the price (the REPGET wording while the launch price applies; a yearly
 *    plan with REPGET leaves the total to checkout, as the plan step does).
 *    Without the trial, the plan is charged today.
 *  - PayPal gives the same trial only when the plan has its trial PayPal plan;
 *    otherwise PayPal charges at once (review 2026-11-20: "€0 today" must
 *    never be said next to a PayPal that charges on day one).
 *  - The email is confirmed with a code before a trial checkout (card, and
 *    PayPal with the trial): checkout refuses without it.
 *
 * Every amount is planDisplayPrice's, the function /pricing, Billing and the
 * plan step read. Pure, so it is tested without a browser.
 */
export type CheckoutPlan = {
  /** The plans row checkout is called with (createCheckoutSession / createPayPalCheckout). */
  id: string;
  tier: string;
  interval: "month" | "year";
  name: string;
  currency: string;
  /** The catalogue price (what the offer notice, OfferApplied, works from). */
  priceCents: number;
  /** What each payment is (the month's, or the year's). */
  chargedCents: number;
  /** The regular price struck beside it, or null. */
  strikeCents: number | null;
  /** REPGET's launch price applies to it. */
  repget: boolean;
  /** PayPal can take this plan (configured, on, and the plan mirrored into PayPal). */
  paypal: boolean;
  /** ...and give it the free trial (its trial PayPal plan). */
  paypalTrial: boolean;
};

type PlanRowLike = PickerPlan & { paypalPlanId?: string | null; paypalTrialPlanId?: string | null };

/**
 * One tier's plans on sale, monthly and yearly, as checkout will charge them:
 * the same rows the plan step offers (no plan bought outright, nothing at €0).
 */
export function checkoutPlans(rows: readonly PlanRowLike[], tier: string, offerOn: boolean, paypalOn: boolean): CheckoutPlan[] {
  return rows
    .filter((row) => row.tier === tier && !isDirectPurchaseTier(row.tier) && row.priceCents > 0 && (row.interval === "month" || row.interval === "year"))
    .map((row) => {
      const plan = toPickerPlan(row);
      const shown = planDisplayPrice(plan, offerOn);
      const paypal = paypalOn && Boolean(row.paypalPlanId);
      return {
        id: plan.id,
        tier: plan.tier,
        interval: plan.interval as "month" | "year",
        name: plan.name,
        currency: plan.currency,
        priceCents: plan.priceCents,
        chargedCents: shown.chargedCents,
        strikeCents: shown.strikeCents,
        repget: shown.discount === "repget",
        paypal,
        paypalTrial: paypal && Boolean(row.paypalTrialPlanId),
      };
    });
}

/** The plan for the period asked, or the monthly one when that tier has no yearly row (as the plan step falls back). */
export function pickCheckoutPlan(plans: readonly CheckoutPlan[], period: "month" | "year"): CheckoutPlan | null {
  return plans.find((plan) => plan.interval === period) ?? plans.find((plan) => plan.interval === "month") ?? null;
}

/** Which sentence goes under the card button, and its amount. */
export type TermsLine =
  | "trialMonth"
  | "trialMonthRepget"
  | "trialYear"
  | "trialYearRepget"
  | "chargedMonth"
  | "chargedYear";

export type CheckoutTerms = {
  /** The free trial is given by card. */
  trial: boolean;
  /** The trial needs the email confirmed first. */
  needsEmail: boolean;
  /** What the card checkout takes today. */
  todayCents: number;
  /** The large figure, per month (a yearly plan quoted per month, as the plan step does). */
  perMonthCents: number;
  strikePerMonthCents: number | null;
  line: { kind: TermsLine; cents: number };
  /**
   * What PayPal does, said under its button while a trial is on offer: the
   * same trial, or charged at once. Null when PayPal is not offered for this
   * plan or there is no trial (both charge today, as the line says).
   */
  paypal: "trial" | "now" | null;
  /** PayPal's button waits for the email code too (its checkout gives the trial). */
  paypalNeedsEmail: boolean;
};

export function checkoutTerms(plan: CheckoutPlan, account: { trialEligible: boolean; emailVerified: boolean }): CheckoutTerms {
  const trial = account.trialEligible;
  const needsEmail = trial && !account.emailVerified;
  const yearly = plan.interval === "year";
  const charged = plan.chargedCents;
  const kind: TermsLine = trial
    ? yearly
      ? plan.repget
        ? "trialYearRepget"
        : "trialYear"
      : plan.repget
        ? "trialMonthRepget"
        : "trialMonth"
    : yearly
      ? "chargedYear"
      : "chargedMonth";
  const paypalTrial = plan.paypal && trial && plan.paypalTrial;
  return {
    trial,
    needsEmail,
    todayCents: trial ? 0 : charged,
    perMonthCents: yearly ? perMonthOfYear(charged) : charged,
    strikePerMonthCents: plan.strikeCents === null ? null : yearly ? perMonthOfYear(plan.strikeCents) : plan.strikeCents,
    line: { kind, cents: charged },
    paypal: plan.paypal && trial ? (paypalTrial ? "trial" : "now") : null,
    paypalNeedsEmail: paypalTrial && needsEmail,
  };
}
