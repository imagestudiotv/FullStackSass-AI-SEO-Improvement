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

/**
 * Days of free trial on a new subscription.
 *
 * Defined here, in the file every pricing surface already imports, so the
 * number the customer reads and the number Stripe applies are the same one.
 * Two copies would eventually disagree, and the disagreement would be a
 * promise about money that the payment did not honour.
 *
 * Passed to Stripe as subscription_data.trial_period_days; see
 * lib/stripe/actions.ts. Zero would mean "charge immediately" — change it
 * here and both the copy and the charge follow.
 */
export const TRIAL_DAYS = 3;

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
 * WHAT IS DELIBERATELY NOT LISTED: backlink credits and the number of
 * websites. The client's instruction — "We don't mention number of websites,
 * how many credits we are giving, etc. Because they will most likely start
 * with 0 credits, or some amount we set like a bonus credits."
 *
 * The LIMITS STILL EXIST and are still enforced: monthly_credits is granted
 * monthly by lib/backlinks/credits.ts and site_limit gates how many sites can
 * be added. They have simply stopped being a selling point, because a credit
 * balance that starts at zero and is topped up by a bonus is not a promise
 * worth printing next to a price.
 *
 * The article count IS kept and is still read from the plan, so it cannot
 * drift from what usage.ts enforces. Everything else is capability rather
 * than quantity, which is what the client asked for.
 */
export function planFeatures(plan: PickerPlan): string[] {
  const shared = [
    "Auto-publish to WordPress, Shopify, Ghost, Webflow and more",
    "AI visibility tracked across ChatGPT, Claude, Gemini and Perplexity",
    "Automated keyword research and SERP-based clustering",
    "Site audit, so your pages are AI- and Google-ready",
    "Titles, metadata and schema written for every page",
    "Backlinks from our partner network",
  ];

  if (plan.tier === "scale") {
    return [
      `${count(plan.articleLimit, "branded article")} a month, with images`,
      ...shared,
      "Priority processing",
      "Custom feature requests",
    ];
  }

  return [
    `${count(plan.articleLimit, "branded article")} a month, with images`,
    ...shared,
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
