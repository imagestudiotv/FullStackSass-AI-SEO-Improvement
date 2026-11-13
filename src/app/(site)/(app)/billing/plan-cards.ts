import type { PlanRow } from "@/lib/billing-shared";
import { perMonthOfYear, planDisplayPrice } from "@/lib/billing/display-prices";
import type { Locale } from "@/lib/i18n/config";
import { DIRECT_PURCHASE } from "@/lib/i18n/direct-purchase";
import { format, formatNumber, plural } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { PLAN_CARDS_COPY } from "@/lib/i18n/plan-cards";
import { pricingPageCopy, type PerkItem } from "@/lib/i18n/pricing-page";
import { planBenefits } from "@/lib/plans/benefits";
import { FREE_ARTICLES, FREE_ARTICLES_DAYS, isDirectPurchaseTier } from "@/lib/plans/features";

import { formatMoney, planFeatures } from "./billing-view";

/**
 * What each plan card on Billing shows, worked out on the server from the plan
 * rows and the offer that checkout applies (Daniel, 2026-11-13: the cards
 * should list the real benefits and show the original price struck through,
 * as /pricing does).
 *
 * THE PRICE IS planDisplayPrice's (lib/billing/display-prices.ts), the same
 * function /pricing and the onboarding plan step read, which only shows a
 * discount checkout really gives: REPGET's launch price while
 * REPGET_OFFER_ENABLED=1 (LP40_* coupons) and the Grow + Visibility bundle's
 * EUR 299 -> 99 (REPGET_GV_M). A yearly plan is quoted per month with the
 * year's total beside it, as /pricing quotes it.
 *
 * THE TERMS ARE CHECKOUT'S: the free articles only for a workspace that has
 * never subscribed (lib/billing/checkouts.ts isTrialEligible) and never on a
 * plan bought outright; otherwise charged at checkout. Then the price each
 * payment is, which with REPGET stays the launch price (a `forever` coupon).
 */
export type PlanCardView = {
  /** The main figure: per month (a yearly plan's total divided by 12). */
  price: string;
  /** The regular figure on the same basis, struck through; null when nothing is taken off. */
  strike: string | null;
  /** "40% OFF" for REPGET, "SAVE 67%"-style for the bundle; null without a discount. */
  badge: string | null;
  /** "/ month". */
  per: string;
  /** /pricing's line under the price: how it is billed, and the regular total. */
  caption: string;
  /** When money is taken and how it renews. */
  terms: string[];
  /** Under the PayPal button, when PayPal cannot give this plan's free articles. */
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
    /** The workspace has never subscribed: card checkout gives the free articles. */
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

    const caption = yearly
      ? format(shown.strikeCents !== null ? page.card.yearlyCaption : page.card.plainYearlyCaption, {
          price: charged,
          regular: money(shown.strikeCents ?? plan.priceCents),
        })
      : shown.discount === "repget"
        ? page.card.monthlyCaption
        : page.card.plainMonthlyCaption;

    const trial = context.trialEligible && !direct;
    const terms = context.switching && !direct
      ? []
      : direct
      ? [format(DIRECT_PURCHASE[locale].note, { price: charged })]
      : trial
        ? [format(words.trial, { n: FREE_ARTICLES, days: FREE_ARTICLES_DAYS }), format(yearly ? words.renewYear : words.renewMonth, { price: charged })]
        : [format(yearly ? words.chargedYear : words.chargedMonth, { price: charged })];

    const creditsLine = plural(t.creditsEachMonth, plan.monthlyCredits, {
      n: plan.monthlyCredits < 0 ? t.unlimited : formatNumber(plan.monthlyCredits, locale),
    });
    const benefits = planBenefits(plan, locale, { creditsLine });

    cards[plan.id] = {
      price: money(yearly ? perMonthOfYear(shown.chargedCents) : shown.chargedCents),
      strike: shown.strikeCents === null ? null : money(yearly ? perMonthOfYear(shown.strikeCents) : shown.strikeCents),
      badge:
        shown.discount === "repget"
          ? page.card.offerBadge
          : shown.discount === "bundle" && shown.strikeCents
            ? format(t.saveBadge, { n: Math.round(((shown.strikeCents - shown.chargedCents) / shown.strikeCents) * 100) })
            : null,
      per: page.card.perMonth,
      caption,
      terms,
      // PayPal gives the free articles only through the plan's free-articles PayPal plan (beginCheckout).
      paypalNote: trial && !plan.paypalTrialPlanId ? words.paypalNoTrial : null,
      directBadge: direct ? DIRECT_PURCHASE[locale].badge : null,
      features: benefits?.features ?? planFeatures(plan, t, locale),
      perksTitle: benefits && benefits.perks.length > 0 ? page.card.perksTitle : null,
      perks: benefits?.perks ?? [],
    };
  }
  return cards;
}
