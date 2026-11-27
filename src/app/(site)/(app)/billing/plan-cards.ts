import type { PlanRow } from "@/lib/billing-shared";
import { perMonthOfYear, planDisplayPrice } from "@/lib/billing/display-prices";
import { repgetFirstPaymentCents } from "@/lib/billing/repget-offer";
import type { Locale } from "@/lib/i18n/config";
import { DIRECT_PURCHASE } from "@/lib/i18n/direct-purchase";
import { format, formatNumber, plural } from "@/lib/i18n/format";
import type { Messages } from "@/lib/i18n/messages";
import { PLAN_CARDS_COPY } from "@/lib/i18n/plan-cards";
import { pricingPageCopy, type PerkItem, type PricingTierId } from "@/lib/i18n/pricing-page";
import { planBenefits } from "@/lib/plans/benefits";
import { isDirectPurchaseTier, TRIAL_DAYS } from "@/lib/plans/features";

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
 * REPGET_OFFER_ENABLED=1 (LP40_* coupons). The Grow + Visibility bundle shows
 * its EUR 129 alone, nothing struck (owner, 2026-11-27). A yearly plan is quoted per month with the
 * year's total beside it, as /pricing quotes it.
 *
 * THE TERMS ARE CHECKOUT'S: the TRIAL_DAYS free trial only for a workspace that has
 * never subscribed (lib/billing/checkouts.ts isTrialEligible) and never on a
 * plan bought outright; otherwise charged at checkout. Then the price each
 * payment is, which with REPGET stays the launch price (a `forever` coupon).
 */
export type PlanCardView = {
  /** The pricing page's line over the name ("Reach more people") and under it; null for a tier it does not describe. */
  tag: string | null;
  description: string | null;
  /** The main figure: per month (a yearly plan's total divided by 12). */
  price: string;
  /** The regular figure on the same basis, struck through; null when nothing is taken off. */
  strike: string | null;
  /** "40% OFF" for REPGET, "SAVE 57%"-style for the bundle; null without a discount. */
  badge: string | null;
  /** "/ month". */
  per: string;
  /** /pricing's line under the price: how it is billed, and the regular total. */
  caption: string;
  /** What one payment is, for the checkout dialog: the year's total for a yearly plan. */
  payment: string;
  /** When money is taken and how it renews. */
  terms: string[];
  /** The same for PayPal where it cannot give the free trial (paypalNote): charged at once. */
  paypalTerms: string[];
  /** Under the PayPal button, when PayPal cannot give this plan's free trial. */
  paypalNote: string | null;
  /** Bought outright (Grow + Visibility): its badge. */
  directBadge: string | null;
  features: string[];
  /** The lines the card shows; the rest is in the comparison. */
  highlights: string[];
  /** The server refuses this change: the website is on the launch price, which this plan does not have. */
  launchNotCovered: boolean;
  /** The server refuses this change onto the bundle: from a yearly plan, or during a free trial (repget-subscription.ts bundleChangeRefusal). */
  bundleBlocked: "yearly" | "trial" | null;
  /** A change onto the bundle leaves the launch price, which a change back brings back: said before choosing. */
  leavesLaunchPrice: boolean;
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
    /**
     * The website on screen is on the REPGET launch price (lib/billing/
     * repget-subscription.ts). A plan change takes no new discount and keeps
     * that one, so while switching it decides the prices - not whether the
     * offer is on - and a plan it does not cover cannot be moved to.
     */
    launchPrice?: boolean;
    /** The plan the website on screen has now, when switching. */
    current?: { interval: string | null; status: string } | null;
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
    const shown = planDisplayPrice(plan, context.switching ? Boolean(context.launchPrice) : context.offerOn);
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
    const chargedTerms = [format(yearly ? words.chargedYear : words.chargedMonth, { price: charged })];
    // The trial line: n and days are both TRIAL_DAYS, so it reads right in its old ({n}) and new ({days}) wording.
    const terms = context.switching
      ? []
      : direct
      ? [format(DIRECT_PURCHASE[locale].note, { price: charged })]
      : trial
        ? [format(words.trial, { n: TRIAL_DAYS, days: TRIAL_DAYS }), format(yearly ? words.renewYear : words.renewMonth, { price: charged })]
        : chargedTerms;

    const creditsLine = plural(t.creditsEachMonth, plan.monthlyCredits, {
      n: plan.monthlyCredits < 0 ? t.unlimited : formatNumber(plan.monthlyCredits, locale),
    });
    const benefits = planBenefits(plan, locale, { creditsLine });

    const features = benefits?.features ?? planFeatures(plan, t, locale);
    const tier = plan.tier in page.plans ? page.plans[plan.tier as PricingTierId] : null;

    cards[plan.id] = {
      tag: tier?.tag ?? null,
      description: tier?.desc ?? (direct ? page.bundle.lede : null),
      payment: charged,
      paypalTerms: trial ? chargedTerms : terms,
      price: money(yearly ? perMonthOfYear(shown.chargedCents) : shown.chargedCents),
      strike: shown.strikeCents === null ? null : money(yearly ? perMonthOfYear(shown.strikeCents) : shown.strikeCents),
      // The bundle shows no saving badge: no struck EUR 299 anywhere (owner, 2026-11-27).
      badge: shown.discount === "repget" ? page.card.offerBadge : null,
      per: page.card.perMonth,
      caption,
      terms,
      // PayPal gives the free trial only through the plan's trial PayPal plan (beginCheckout).
      paypalNote: trial && !plan.paypalTrialPlanId ? words.paypalNoTrial : null,
      directBadge: direct ? DIRECT_PURCHASE[locale].badge : null,
      features,
      highlights: benefits?.highlights ?? features,
      // As the server decides it (offerForPlanChange): only a price its coupon was made for, or the bundle at its own price.
      launchNotCovered: Boolean(context.switching && context.launchPrice) && !direct && repgetFirstPaymentCents(plan) === null,
      bundleBlocked:
        !direct || !context.switching
          ? null
          : context.current?.status === "trialing"
            ? "trial"
            : context.current?.interval === "year"
              ? "yearly"
              : null,
      leavesLaunchPrice: direct && Boolean(context.switching && context.launchPrice),
      perksTitle: benefits && benefits.perks.length > 0 ? page.card.perksTitle : null,
      perks: benefits?.perks ?? [],
    };
  }
  return cards;
}
