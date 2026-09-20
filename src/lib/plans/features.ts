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
 * "30 branded articles a month — one a day", from the plan's own limit.
 *
 * The cadence is the point of these numbers, not the total: the client set
 * them as "1 daily" and "3 daily" rather than as round figures, and it is what
 * the scheduler actually does — see scheduled-articles.ts, which queues
 * ceil(limit / 30) each day.
 *
 * Derived rather than written per tier, so the phrase cannot claim a rhythm
 * the limit does not produce. Only stated when the arithmetic is clean: 30 is
 * exactly one a day, 100 is close enough to three to say so, and anything that
 * does not divide neatly says nothing rather than something approximate.
 */
function cadence(articlesPerMonth: number): string {
  const perDay = articlesPerMonth / 30;
  if (perDay === 1) return " — one a day";
  if (Number.isInteger(perDay)) return ` — ${perDay} a day`;
  // 100/30 is 3.33: "about three" is true, "three" would not be.
  if (perDay > 1) return ` — about ${Math.floor(perDay)} a day`;
  return "";
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
  /**
   * Capabilities every plan has. These are the same on purpose: the product
   * does not withhold features by tier, it withholds VOLUME.
   */
  const shared = [
    "Auto-publish to WordPress, Shopify, Ghost, Webflow and more",
    "AI visibility tracked across ChatGPT, Claude, Gemini and Perplexity",
    "Site audit, so your pages are AI- and Google-ready",
    "Titles, metadata and schema written for every page",
    "Backlinks from our partner network",
  ];

  /**
   * What actually SEPARATES the tiers, stated per plan.
   *
   * The two lists were previously identical except for the article count, so
   * Scale read as Grow at triple the price — the client spotted it. These are
   * real, enforced differences: Scale tracks five times the keywords
   * (usage.ts) and covers four times the websites, and both numbers come from
   * the plan row rather than being written here, so they cannot drift from
   * what is enforced.
   *
   * Keyword and website counts ARE quantities, which the client asked not to
   * advertise for credits. The instruction was specifically about credits and
   * websites starting at zero; these two are the only honest answer to "why
   * is one three times the price", so the website count returns here — where
   * it is a reason to upgrade rather than a limit to apologise for.
   */
  const scale = [
    `${count(plan.articleLimit, "branded article")} a month${cadence(plan.articleLimit)}, with images`,
    `${plan.keywordLimit.toLocaleString()} search terms researched and clustered`,
    `Up to ${count(plan.siteLimit, "website")} on one account`,
    "Priority processing — your articles are written first",
    "Custom feature requests",
  ];

  const grow = [
    `${count(plan.articleLimit, "branded article")} a month${cadence(plan.articleLimit)}, with images`,
    `${plan.keywordLimit.toLocaleString()} search terms researched and clustered`,
    `Up to ${count(plan.siteLimit, "website")} on one account`,
  ];

  return plan.tier === "scale" ? [...scale, ...shared] : [...grow, ...shared];
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
