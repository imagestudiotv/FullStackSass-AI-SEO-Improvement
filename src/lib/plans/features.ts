/**
 * What a plan includes, in the customer's terms.
 *
 * Shared by every surface that lists plans — the public pricing page, its four
 * translations, the homepage preview, the in-app billing page and onboarding —
 * so a plan is described the same way wherever someone meets it. Four separate
 * feature lists would drift, and the one that drifted would be the one the
 * customer read before paying.
 *
 * No database or Stripe import: this is pulled into the client bundle by the
 * plan picker.
 */

/** The entry tier. Named once so no surface has to hardcode the string. */
export const STARTER_TIER = "starter";

/** The subset of a plan row these helpers need. */
export type PickerPlan = {
  id: string;
  tier: string;
  name: string;
  priceCents: number;
  currency: string;
  interval: string;
  articleLimit: number;
  keywordLimit: number;
  siteLimit: number;
  monthlyCredits: number;
};

/** Plural-aware, so a Starter customer is not told "1 articles". */
function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/**
 * The bullet list for a plan.
 *
 * Built from the plan's own limits rather than written per tier, so a limit
 * change in the seed cannot leave a stale promise on the pricing page.
 */
export function planFeatures(plan: PickerPlan): string[] {
  return [
    `${count(plan.articleLimit, "article")} with images a month`,
    `${count(plan.monthlyCredits, "backlink credit")} a month`,
    `${count(plan.keywordLimit, "keyword")} researched`,
    count(plan.siteLimit, "website"),
    "AI visibility tracking",
    "Titles, metadata and schema on every page",
  ];
}

/**
 * Narrows a plan row to what the plan surfaces need.
 *
 * Also strips the "(Annual)" suffix from the name: the billing interval is
 * already shown beside the price, so repeating it in the title reads as a
 * different product rather than the same plan billed differently.
 */
export function toPickerPlan(plan: PickerPlan): PickerPlan {
  return {
    ...plan,
    name: plan.name.replace(/\s*\(Annual\)\s*$/i, ""),
  };
}

/** One line on who a tier is for, or null when the price speaks for itself. */
export function planTagline(tier: string): string | null {
  return tier === STARTER_TIER
    ? "Try us with a real article and a real backlink before moving up."
    : null;
}
