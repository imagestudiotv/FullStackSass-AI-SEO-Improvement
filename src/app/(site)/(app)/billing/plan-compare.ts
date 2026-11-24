import type { PlanRow } from "@/lib/billing-shared";
import type { BillingPlansCopy } from "@/lib/i18n/billing-plans";
import type { Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import { pricingPageCopy } from "@/lib/i18n/pricing-page";
import { isDirectPurchaseTier } from "@/lib/plans/features";

/**
 * Billing's comparison table: the pricing page's own rows and words
 * (marketing/pricing compareRows), for the plans on sale here. Every count is
 * the plan row's; a row the pricing page does not make a claim in is not here.
 */
export type CompareCell = { kind: "text"; text: string } | { kind: "yes" } | { kind: "no" };

export type CompareRow = {
  key: string;
  label: string;
  help?: string;
  cells: CompareCell[];
  /** Only with the complete comparison. */
  extra: boolean;
};

/**
 * The cards' order (Daniel's design): Grow, Grow + Visibility, Scale. The
 * bundle goes in the middle of whatever the tiers are, after the first one;
 * tiers keep their own order.
 */
export function orderPlans<T extends Pick<PlanRow, "tier" | "sortOrder">>(plans: T[]): T[] {
  const tiers = plans.filter((plan) => !isDirectPurchaseTier(plan.tier)).sort((a, b) => a.sortOrder - b.sortOrder);
  const bundles = plans.filter((plan) => isDirectPurchaseTier(plan.tier)).sort((a, b) => a.sortOrder - b.sortOrder);
  return [...tiers.slice(0, 1), ...bundles, ...tiers.slice(1)];
}

export function planCompareRows(plans: PlanRow[], locale: Locale, copy: BillingPlansCopy, unlimited: string): CompareRow[] {
  const words = pricingPageCopy(locale).compare;
  const count = (n: number): CompareCell => ({ kind: "text", text: n < 0 ? unlimited : formatNumber(n, locale) });
  const yes: CompareCell = { kind: "yes" };
  const no: CompareCell = { kind: "no" };
  // The visibility perks: Priority on Scale, included on Grow and the bundle, none on Launch.
  const perk = (plan: PlanRow): CompareCell =>
    plan.tier === "scale" ? { kind: "text", text: words.statusPriority } : plan.tier === "grow" || isDirectPurchaseTier(plan.tier) ? yes : no;
  const row = (key: string, label: string, cell: (plan: PlanRow) => CompareCell, extra = true, help?: string): CompareRow => ({
    key,
    label,
    help,
    cells: plans.map(cell),
    extra,
  });

  return [
    row("articles", words.articles, (plan) => count(plan.articleLimit), false),
    row("posts", words.posts, (plan) => count(plan.socialPostLimit ?? 0), false),
    row("terms", words.terms, (plan) => count(plan.keywordLimit), false),
    row("credits", copy.monthlyCredits, (plan) => count(plan.monthlyCredits), false),
    // One website per subscription, on every plan (lib/plans/features.ts): siteLimit is not what a plan sells.
    row("websites", words.websites, () => count(1), false),
    row("copilot", words.copilot.strong, () => yes, true, words.copilot.small),
    row("social", words.social.strong, () => yes, true, words.social.small),
    row("videos", copy.videos, () => yes),
    row("cms", words.cms, () => yes),
    row("audits", words.audits, () => yes),
    row("visibility", words.visibility, () => yes),
    row("backlinks", words.backlinks, () => yes),
    row("blog", words.blog.strong, perk, true, words.blog.small),
    row("channels", words.channels.strong, perk, true, words.channels.small),
    row("email", words.email.strong, perk, true, words.email.small),
    row("custom", words.custom, (plan) => (plan.tier === "scale" ? yes : no)),
  ];
}
