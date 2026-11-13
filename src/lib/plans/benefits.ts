import type { Locale } from "@/lib/i18n/config";
import { format, formatNumber } from "@/lib/i18n/format";
import { PLAN_CARDS_COPY } from "@/lib/i18n/plan-cards";
import { pricingPageCopy, type PerkItem, type PricingTierId } from "@/lib/i18n/pricing-page";
import { GROW_VISIBILITY_TIER } from "@/lib/plans/features";
import { IDEAS_PER_DAY } from "@/lib/video/formats";

/**
 * What a plan includes, as Billing's plan cards and the onboarding plan step
 * list it (Daniel, 2026-11-13: "add few more options to our checkout packages
 * once we added more features").
 *
 * THE PRICING PAGE'S OWN LISTS, in the reader's language
 * (lib/i18n/pricing-page.ts): the articles, social posts and search terms from
 * the plan row (scripts/plan-catalog.mjs), the website, AI visibility, audits,
 * publishing, AI Growth Copilot and AI Social Opportunities, and each plan's
 * visibility perks; for Grow + Visibility its bundle card's figures, features
 * and bonuses. So a plan reads the same before and after sign-up, and a new
 * line on /pricing reaches these screens too.
 *
 * Added here, because the pricing page does not say them: the videos and
 * carousels every plan can make from its daily ideas (each paid in credits,
 * lib/video), and - Billing only - the credits each month, which Billing
 * always listed.
 *
 * Null for a tier the pricing page does not describe (an older plan); the
 * screen then keeps its own lines. `**words**` are bold.
 */
export type PlanBenefits = { features: string[]; perks: PerkItem[] };

export type BenefitPlan = {
  tier: string;
  articleLimit: number;
  socialPostLimit?: number | null;
  keywordLimit: number;
};

const PRICING_TIERS: readonly string[] = ["launch", "grow", "scale"] satisfies PricingTierId[];

export function planBenefits(plan: BenefitPlan, locale: Locale, extra: { creditsLine?: string | null } = {}): PlanBenefits | null {
  const page = pricingPageCopy(locale);
  const videos = format(PLAN_CARDS_COPY[locale].videos, { ideas: IDEAS_PER_DAY });
  const credits = extra.creditsLine ? [extra.creditsLine] : [];

  if (PRICING_TIERS.includes(plan.tier)) {
    const words = page.plans[plan.tier as PricingTierId];
    const values = { articles: plan.articleLimit, posts: plan.socialPostLimit ?? 0, terms: formatNumber(plan.keywordLimit, locale) };
    const lines = words.features.map((feature) => format(feature, values));
    // The design's order: articles, posts, [videos], terms, website, [credits], then the platform.
    return {
      features: [...lines.slice(0, 2), videos, ...lines.slice(2, 4), ...credits, ...lines.slice(4)],
      perks: words.perks ?? [],
    };
  }

  if (plan.tier === GROW_VISIBILITY_TIER) {
    const figures = [plan.articleLimit, plan.socialPostLimit ?? 0, plan.keywordLimit];
    const stats = page.bundle.stats.map((stat, index) => `**${formatNumber(figures[index], locale)} ${stat.strong}** · ${stat.small}`);
    return {
      features: [...stats.slice(0, 2), videos, ...stats.slice(2), ...credits, ...page.bundle.coreFeatures],
      perks: [...page.bundle.bonuses],
    };
  }

  return null;
}
