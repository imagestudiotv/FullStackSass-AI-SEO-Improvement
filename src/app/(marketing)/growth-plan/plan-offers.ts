import { cardPrices } from "@/app/(marketing)/pricing/prices";
import { formatPrice } from "@/lib/billing-shared";
import type { Locale } from "@/lib/i18n/config";
import { pricingPageCopy, type PricingTierId } from "@/lib/i18n/pricing-page";
import { planBenefits } from "@/lib/plans/benefits";
import { isDirectPurchaseTier, toPickerPlan, type PickerPlan } from "@/lib/plans/features";

/**
 * The plans the growth plan's last step offers (growth-plan-flow.tsx
 * Billing), as plain words and figures for the browser.
 *
 * The same plans as the onboarding plan step, read the same way
 * (onboarding/plan/page.tsx): the monthly rows on sale, without the bundle
 * that is bought outright, each with its yearly row when there is one. The
 * figures are /pricing's (pricing/prices.ts cardPrices -> planDisplayPrice),
 * so this step cannot quote a price checkout does not charge; the words are
 * the pricing page's own (lib/i18n/pricing-page.ts, lib/plans/benefits.ts).
 *
 * These are only the words and figures to choose by: the billing step reads
 * the plan rows again for the signed-in account (billing-actions.ts,
 * checkout-terms.ts) and checks out with Stripe or PayPal as the plan step
 * does.
 */
export type GrowthPlanOffer = {
  tier: string;
  name: string;
  /** The pricing page's short tag ("Get discovered"), or null. */
  tag: string | null;
  /** The pricing page's line about who it is for, or null. */
  description: string | null;
  /** What each monthly payment is, formatted ("€59"). */
  price: string;
  /** The regular price struck through beside it while the launch price is on, else null. */
  regular: string | null;
  /** The yearly plan quoted per month ("€49.17") with the year's total, or null without a yearly row. */
  yearly: { perMonth: string; total: string } | null;
  /** What paying yearly saves against twelve monthly payments, in whole percent (the plan step's figure), or null. */
  yearlySaving: number | null;
  /** The first lines of what it includes, `**bold**` marked. */
  features: string[];
  /** The tier the pricing page marks "Most popular". */
  popular: boolean;
  /** Nothing in its currency ("€0"): what the free trial charges today. */
  dueToday: string;
  /**
   * Whether the plan step will offer PayPal WITH the free trial for it (a PayPal plan and its trial plan, and
   * PayPal on), so the order summary, which says "€0 today", names PayPal only then. Without the trial plan
   * PayPal charges the first month at once (onboarding/plan/page.tsx paypalTrialPlanIds).
   */
  paypal: boolean;
};

/** Lines of each plan's list on the card: enough to compare, short enough to scan. */
export const OFFER_FEATURES = 5;

/** The tier /pricing marks "Most popular", and the one chosen until the visitor picks. */
export const POPULAR_TIER = "grow";

export function growthPlanOffers(
  rows: readonly (PickerPlan & { paypalPlanId?: string | null; paypalTrialPlanId?: string | null })[],
  locale: Locale,
  offerOn: boolean,
  paypalOn: boolean,
): GrowthPlanOffer[] {
  const page = pricingPageCopy(locale);
  const sold = rows.filter((row) => !isDirectPurchaseTier(row.tier) && row.priceCents > 0);
  return sold
    .filter((row) => row.interval === "month")
    .map((row) => {
      const plan = toPickerPlan(row);
      const annual = sold.find((other) => other.interval === "year" && other.tier === row.tier && other.currency === row.currency) ?? null;
      const prices = cardPrices(plan, annual, offerOn);
      const words = page.plans[plan.tier as PricingTierId];
      const benefits = planBenefits(plan, locale);
      return {
        tier: plan.tier,
        name: plan.name,
        tag: words?.tag ?? null,
        description: words?.desc ?? null,
        price: prices.monthly.price,
        regular: prices.monthly.regular !== prices.monthly.price ? prices.monthly.regular : null,
        yearly: prices.yearly ? { perMonth: prices.yearly.price, total: prices.yearly.total } : null,
        yearlySaving: yearlySaving(plan.priceCents, annual?.priceCents ?? null),
        features: (benefits?.features ?? []).slice(0, OFFER_FEATURES),
        popular: plan.tier === POPULAR_TIER,
        dueToday: formatPrice(0, plan.currency),
        paypal: paypalOn && Boolean(row.paypalPlanId && row.paypalTrialPlanId),
      };
    });
}

/** The plan step's saving (onboarding/plan/plan-step.tsx): from the two catalogue prices, never a round number. */
export function yearlySaving(monthlyCents: number, annualCents: number | null): number | null {
  if (annualCents === null) return null;
  const full = monthlyCents * 12;
  if (full <= annualCents) return null;
  return Math.round(((full - annualCents) / full) * 100);
}

/** The plan chosen when the step opens: the popular one, else the first. */
export function defaultTier(offers: readonly GrowthPlanOffer[]): string | null {
  return (offers.find((offer) => offer.popular) ?? offers[0])?.tier ?? null;
}

/**
 * The order the plan choice draws the paid plans in: the popular one (Grow)
 * first, the chosen one when the step opens, then the others in catalogue
 * order. The Free card comes after all of them (growth-plan-flow.tsx Choose).
 *
 * Daniel, 2026-11-21: "there is some wrong perceive free plan and the banner
 * on right which reflects the grow plan - I suggest to displaying the grow
 * plan first". Free was drawn first, at the top in green, while the order
 * summary beside it described Grow, the plan actually chosen.
 */
export function offerOrder(offers: readonly GrowthPlanOffer[]): GrowthPlanOffer[] {
  return [...offers.filter((offer) => offer.popular), ...offers.filter((offer) => !offer.popular)];
}

/**
 * INTEGRATION(free-plan): the Free plan's card, in this shape, comes from
 * agent A's src/lib/plans/free-plan.ts (display data in the reader's
 * language). The page passes null until it is wired (growth-plan-page.tsx);
 * with it, the card is drawn after the paid plans (offerOrder) and choosing it sends the visitor through
 * sign-up with ?plan=<tier>, like the paid ones, but promising no card.
 */
export type FreePlanOption = {
  /** The tier carried to the plan step (?plan=), A's Free tier id. */
  tier: string;
  name: string;
  /** "Experience RepGet with real AI content and social publishing. No credit card required." */
  description: string;
  /** "FREE FOREVER · NO CREDIT CARD" */
  badge: string;
  /** "€0" */
  price: string;
  /** "Always free · upgrade anytime" */
  priceNote: string;
  /** What it includes, `**bold**` marked. */
  features: string[];
  /** The button: "Start Free · No card required". */
  cta: string;
};
