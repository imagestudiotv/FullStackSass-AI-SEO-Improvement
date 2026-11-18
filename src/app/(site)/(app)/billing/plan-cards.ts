import type { PlanRow } from "@/lib/billing-shared";
import { perMonthOfYear, planDisplayPrice } from "@/lib/billing/display-prices";
import type { Locale } from "@/lib/i18n/config";
import { DIRECT_PURCHASE } from "@/lib/i18n/direct-purchase";
import { format, formatNumber, plural } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { PLAN_CARDS_COPY } from "@/lib/i18n/plan-cards";
import { pricingPageCopy, type PerkItem } from "@/lib/i18n/pricing-page";
import { planBenefits } from "@/lib/plans/benefits";
import { isDirectPurchaseTier, TRIAL_DAYS } from "@/lib/plans/features";

import { formatMoney, planFeatures } from "./billing-view";

/**
 * What each plan card on Billing shows, worked out on the server from the plan
 * rows and the offer that checkout applies (Daniel, 2026-11-13: the cards
 * should list the real benefits, as /pricing does).
 *
 * THE PRICE IS planDisplayPrice's chargedCents (lib/billing/display-prices.ts),
 * the same function /pricing and the onboarding plan step read: what checkout
 * charges, REPGET's launch price while REPGET_OFFER_ENABLED=1, and nothing
 * else - no regular price struck through and no "% off" badge (conservative
 * copy, 2026-11-18). A yearly plan is quoted per month with the year's total
 * beside it, as /pricing quotes it.
 *
 * THE TERMS ARE CHECKOUT'S: the TRIAL_DAYS free trial only for a workspace that has
 * never subscribed (lib/billing/checkouts.ts isTrialEligible) and never on a
 * plan bought outright; otherwise charged at checkout. Then the price each
 * payment is, which with REPGET stays the launch price (a `forever` coupon).
 */
export type PlanCardView = {
  /** The main figure: per month (a yearly plan's total divided by 12). */
  price: string;
  /** "/ month". */
  per: string;
  /** /pricing's line under the price: how it is billed, and a yearly plan's total. */
  caption: string;
  /** When money is taken and how it renews. */
  terms: string[];
  /** Under the PayPal button, when PayPal cannot give this plan's free trial. */
  paypalNote: string | null;
  /** Bought outright (Grow + Visibility): its badge. */
  directBadge: string | null;
  features: string[];
  perksTitle: string | null;
  perks: PerkItem[];
};

export function planCardsFor(
  plans: PlanRow[],
  context: {
    /** REPGET_OFFER_ENABLED: the launch price on every Launch/Grow/Scale checkout. */
    offerOn: boolean;
    /** The workspace has never subscribed: card checkout gives the free trial. */
    trialEligible: boolean;
    /**
     * The website on screen already has a plan: choosing another changes it
     * (prorated by the provider), so no "charged today" or trial line is said.
     */
    switching?: boolean;
    locale: Locale;
    t: Messages["app"]["billing"];
  },
): Record<string, PlanCardView> {
  const { locale, t } = context;
  const page = pricingPageCopy(locale);
  const words = PLAN_CARDS_COPY[locale];
  const cards: Record<string, PlanCardView> = {};

  for (const plan of plans) {
    const money = (cents: number) => formatMoney(cents, plan.currency, locale);
    const shown = planDisplayPrice(plan, context.offerOn);
    const yearly = plan.interval === "year";
    const direct = isDirectPurchaseTier(plan.tier);
    const charged = money(shown.chargedCents);

    const caption = yearly ? format(page.card.yearlyCaption, { price: charged }) : page.card.monthlyCaption;

    const trial = context.trialEligible && !direct;
    // The trial line: n and days are both TRIAL_DAYS, so it reads right in its old ({n}) and new ({days}) wording.
    const terms = context.switching && !direct
      ? []
      : direct
      ? [format(DIRECT_PURCHASE[locale].note, { price: charged })]
      : trial
        ? [format(words.trial, { n: TRIAL_DAYS, days: TRIAL_DAYS }), format(yearly ? words.renewYear : words.renewMonth, { price: charged })]
        : [format(yearly ? words.chargedYear : words.chargedMonth, { price: charged })];

    const creditsLine = plural(t.creditsEachMonth, plan.monthlyCredits, {
      n: plan.monthlyCredits < 0 ? t.unlimited : formatNumber(plan.monthlyCredits, locale),
    });
    const benefits = planBenefits(plan, locale, { creditsLine });

    cards[plan.id] = {
      price: money(yearly ? perMonthOfYear(shown.chargedCents) : shown.chargedCents),
      per: page.card.perMonth,
      caption,
      terms,
      // PayPal gives the free trial only through the plan's trial PayPal plan (beginCheckout).
      paypalNote: trial && !plan.paypalTrialPlanId ? words.paypalNoTrial : null,
      directBadge: direct ? DIRECT_PURCHASE[locale].badge : null,
      features: benefits?.features ?? planFeatures(plan, t, locale),
      perksTitle: benefits && benefits.perks.length > 0 ? page.card.perksTitle : null,
      perks: benefits?.perks ?? [],
    };
  }
  return cards;
}
