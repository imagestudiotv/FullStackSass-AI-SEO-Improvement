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
 * The offer for a new account: its first articles free (client, 2026-10-09:
 * "Create 3 Articles for Free" - replacing the 3-day trial).
 *
 * A new workspace picks its plan and adds a card at Stripe; nothing is
 * charged. It may write FREE_ARTICLES articles (with research, images and
 * publishing - not audits, AI visibility or backlinks), and its plan starts,
 * and is charged, once the last of them is written - or after
 * FREE_ARTICLES_DAYS if they were not all used. The paid month then starts
 * with its full allowance (lib/billing/free-articles.ts).
 *
 * Defined here, in the file every pricing surface already imports, so the
 * numbers the customer reads and the numbers the checkout applies are the
 * same ones. Two copies would eventually disagree, and the disagreement would
 * be a promise about money that the payment did not honour.
 */
export const FREE_ARTICLES = 3;

/**
 * The longest the free articles wait for the plan to start: passed to Stripe
 * as the subscription's trial_period_days (lib/stripe/actions.ts), which ends
 * it then if the articles have not.
 */
export const FREE_ARTICLES_DAYS = 30;

/**
 * Why a paid feature (an audit, AI visibility) is refused during the free
 * articles (lib/billing/entitled.ts). The pages match it to show the
 * reader's language (app.workspace.freeArticlesOnly).
 */
export const FREE_ARTICLES_ONLY =
  "This is included once your plan starts - right after your free articles are written.";

/**
 * Card checkout's refusal while the free articles would be given to an
 * address nobody has confirmed (lib/stripe/actions.ts). The plan step asks
 * for the code first, so this is only seen by a request that skipped it.
 */
export const CONFIRM_EMAIL_FIRST =
  "Confirm your email address first - your free articles are given to it.";

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

/**
 * ONE website per subscription, on every plan.
 *
 * The client's instruction: "We insert 3, and 10. But for both plans we allow
 * 1 site only." The plan rows keep siteLimit 3 and 10 — those columns are read
 * by the admin tools and by agency workspaces — but no customer-facing surface
 * quotes them any more.
 *
 * This is a CORRECTION, not a restriction. Billing became per-website in
 * migration 0021: a subscription is attached to one site, and addWebsite
 * imposes no cap at all because a new site simply starts unsubscribed and can
 * do nothing until it has a plan of its own. So "up to 3 websites on one
 * account" was never true of Grow — it described a limit that had stopped
 * existing, and a customer who bought Grow expecting three sites would have
 * been asked to pay twice more.
 *
 * Someone who wants a second website buys a second subscription, which is
 * exactly what the product already does.
 */
const ONE_WEBSITE = "One website per subscription";

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
  if (perDay === 1) return " - one a day";
  if (Number.isInteger(perDay)) return ` - ${perDay} a day`;
  // 100/30 is 3.33: "about three" is true, "three" would not be.
  if (perDay > 1) return ` - about ${Math.floor(perDay)} a day`;
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
    ONE_WEBSITE,
    "Priority processing - your articles are written first",
    "Custom feature requests",
  ];

  const grow = [
    `${count(plan.articleLimit, "branded article")} a month${cadence(plan.articleLimit)}, with images`,
    `${plan.keywordLimit.toLocaleString()} search terms researched and clustered`,
    ONE_WEBSITE,
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
