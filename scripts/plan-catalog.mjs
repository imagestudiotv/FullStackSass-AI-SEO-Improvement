/**
 * The plans on sale: the one place their prices and allowances are written.
 *
 * scripts/seed-plans.mjs writes these into the plans table, and every surface
 * reads that table - the homepage, /pricing, onboarding, billing, checkout and
 * the allowances - so what is advertised and what is charged cannot disagree.
 *
 * A CATALOG IS NEVER REPRICED. A subscription's limits are read live from its
 * plan row and its charge is fixed by the price id on that row, so editing a
 * row would hand everyone on it the new limits at their old price, and show
 * them a price they do not pay. A new line-up is a new version instead: its
 * rows are written beside the old ones, inactive, and
 * scripts/activate-plan-catalog.mjs moves sales to them in one transaction.
 * Subscribers stay on the row they bought, with its price and limits, until
 * they change plan. docs/plan-catalog.md has the steps.
 *
 * Version 2 is the client's design of 2026-11-04 (Launch EUR 99, Grow EUR 149,
 * Scale EUR 349, with their articles and social posts). It brings Launch back:
 * version 1 was Grow EUR 99 and Scale EUR 299, Launch having been withdrawn at
 * EUR 29 ("We will having only Grow and Scale plan").
 *
 * The design names only the price, the articles and the social posts. The
 * keywords, sites and credits below are not from it: Launch and Grow carry
 * today's Grow figures and Scale today's Scale figures, until the client says
 * otherwise. The pricing page of 2026-11-11 did: search terms are Launch 300,
 * Grow 500, Scale 1,500, so Grow's keyword limit is 500 (a limit raised, not a
 * price: db:seed updates the rows subscribers hold, to their benefit).
 */
export const CATALOG_VERSION = 2;

export const CURRENCY = "eur";

/** Annual = 10 months' price: two months free, as /pricing says. Limits are per month and do not change. */
export const ANNUAL_MONTHS = 10;

/**
 * ARTICLE LIMITS ARE A DAILY CADENCE: scheduled-articles.ts queues
 * `ceil(articleLimit / 30)` a day, so 30 is one a day and 60 is two.
 *
 * SOCIAL POSTS ARE NOT A SECOND METER. Each post costs credits (Admin ->
 * Credits, 1 by the client's price), and socialPostLimit says how many a plan
 * offers; monthlyCredits must cover it (lib/plans/catalog.test.ts).
 */
export const TIERS = [
  { tier: "launch", name: "Launch", monthlyCents: 9900, articleLimit: 30, socialPostLimit: 60, keywordLimit: 300, siteLimit: 3, monthlyCredits: 250, sortOrder: 0 },
  { tier: "grow", name: "Grow", monthlyCents: 14900, articleLimit: 60, socialPostLimit: 90, keywordLimit: 500, siteLimit: 3, monthlyCredits: 250, sortOrder: 1 },
  { tier: "scale", name: "Scale", monthlyCents: 34900, articleLimit: 100, socialPostLimit: 240, keywordLimit: 1500, siteLimit: 10, monthlyCredits: 700, sortOrder: 2 },
];

/**
 * Plans bought outright, monthly only, beside the tiers (client, 2026-11-11).
 *
 * Grow + Visibility: the Grow plan's allowances, plus visibility perks the
 * team delivers by hand (a blog feature, social channels, an email
 * spotlight), EUR 99 a month with no free trial, no free articles and no
 * REPGET (src/lib/plans/features.ts DIRECT_PURCHASE_TIERS; the tier string is
 * kept equal to GROW_VISIBILITY_TIER by lib/plans/catalog.test.ts). Its own
 * product in Stripe and PayPal (stripe:setup, paypal:setup), so the team can
 * see who bought it: its name is the plan name in admin.
 */
export const BUNDLES = [
  { tier: "grow_visibility", name: "Grow + Visibility", monthlyCents: 9900, articleLimit: 60, socialPostLimit: 90, keywordLimit: 500, siteLimit: 3, monthlyCredits: 250, sortOrder: 10 },
];

/** Every row of this version: a monthly and an annual one per tier, and a monthly one per bundle. */
export const catalogRows = () => [
  ...TIERS.flatMap(({ monthlyCents, name, ...rest }) => [
    { ...rest, name, interval: "month", priceCents: monthlyCents },
    { ...rest, name: `${name} (Annual)`, interval: "year", priceCents: monthlyCents * ANNUAL_MONTHS },
  ]),
  ...BUNDLES.map(({ monthlyCents, ...rest }) => ({ ...rest, interval: "month", priceCents: monthlyCents })),
];

/** Whether a tier is bought outright (a bundle): only its own PayPal plan, no free-articles or REPGET ones. */
export const isBundleTier = (tier) => BUNDLES.some((bundle) => bundle.tier === tier);

/**
 * Why this version cannot go on sale yet, given its rows as the database has
 * them (snake_case, as `postgres` returns them). Empty means it can.
 *
 * Checkout refuses a plan without a Stripe price, so activating one would put a
 * price on the site that nobody can pay. `requireStripe: false` is for a local
 * database only; the script enforces that.
 */
export function activationProblems(rows, { requireStripe = true } = {}) {
  const problems = [];
  const found = new Map(rows.map((row) => [`${row.tier}/${row.interval}`, row]));
  for (const want of catalogRows()) {
    const key = `${want.tier}/${want.interval}`;
    const row = found.get(key);
    if (!row) {
      problems.push(`${key}: not in the database - run db:seed`);
      continue;
    }
    const same =
      row.price_cents === want.priceCents &&
      row.article_limit === want.articleLimit &&
      row.social_post_limit === want.socialPostLimit &&
      row.currency === CURRENCY;
    if (!same) problems.push(`${key}: differs from scripts/plan-catalog.mjs - run db:seed`);
    if (requireStripe && !row.stripe_price_id) problems.push(`${key}: no Stripe price - run stripe:setup`);
  }
  return problems;
}

/**
 * The REPGET offer's Stripe coupons (src/lib/billing/repget-offer.ts, which a
 * test keeps equal to this): fixed amounts off the first payment, `once`, each
 * limited to its tier's product. scripts/stripe-setup.mjs creates any that are
 * missing and never changes one that exists.
 *   monthly  40% of the month (live since 2026-11-10).
 *   yearly   40% off the first year, as the pricing page bills it (2026-11-11).
 */
export const REPGET_STRIPE_COUPONS = [
  { id: "LAUNCH40", tier: "launch", interval: "month", amountOffCents: 3960 },
  { id: "GROW40", tier: "grow", interval: "month", amountOffCents: 5960 },
  { id: "SCALE40", tier: "scale", interval: "month", amountOffCents: 13960 },
  { id: "LAUNCH40Y", tier: "launch", interval: "year", amountOffCents: 40000 },
  { id: "GROW40Y", tier: "grow", interval: "year", amountOffCents: 60000 },
  { id: "SCALE40Y", tier: "scale", interval: "year", amountOffCents: 140000 },
];
