/**
 * Seeds the plans table. Idempotent - upserts on (tier, interval), so it is
 * safe to re-run and will be needed again for the production database.
 *
 * Prices are the agreed EUR line-up. Annual rows are ten months' money for
 * twelve months of service (~17% off), which is the usual prepay incentive.
 *
 * stripePriceId stays null until `npm run stripe:setup` creates the Stripe
 * products and writes the ids back. Checkout refuses any plan without one, so
 * a half-configured plan cannot take money.
 */
import nextEnv from "@next/env";
import postgres from "postgres";

nextEnv.loadEnvConfig(process.cwd());
const sql = postgres(process.env.DIRECT_URL, { connect_timeout: 30 });

const CURRENCY = "eur";

/**
 * Tiers RETIRED from sale.
 *
 * Starter (EUR 1) and Launch (EUR 29) were dropped at the client's request:
 * "We will having only Grow and Scale plan, we delete the other 2 plans, it's
 * not convenient to keep."
 *
 * Deactivated rather than deleted, for two reasons. subscriptions.plan_id is
 * ON DELETE RESTRICT, so removing a plan somebody holds would fail outright.
 * And a plan named on a past invoice must keep existing, or the payment
 * history stops saying what the customer was charged for.
 *
 * Anyone already on one keeps it until they cancel or upgrade; it simply
 * cannot be bought any more.
 */
const RETIRED_TIERS = ["starter", "launch"];

/**
 * Monthly price per tier, in minor units. Annual is derived as x10.
 *
 * ARTICLE LIMITS ARE A DAILY CADENCE, not a round number. The client set
 * them that way: "we write 30 articles for grow plan (1 daily) and 100 for
 * scale plan (3 daily)".
 *
 * That matters beyond the label. scheduled-articles.ts derives how many to
 * queue per day as `ceil(articleLimit / 30)`, so 30 produces exactly one a
 * day and 100 produces between three and four — the promise on the pricing
 * page and the behaviour of the scheduler come from this one number.
 *
 * Grow was 25, which is neither a daily rhythm nor what was agreed: it gave
 * one article a day for 25 days and then five silent days at the end of every
 * month.
 */
const TIERS = [
  {
    tier: "grow",
    name: "Grow",
    monthlyCents: 9900,
    // 1 a day.
    articleLimit: 30,
    keywordLimit: 300,
    siteLimit: 3,
    monthlyCredits: 25,
    sortOrder: 0,
  },
  {
    tier: "scale",
    name: "Scale",
    monthlyCents: 29900,
    // ~3 a day.
    articleLimit: 100,
    keywordLimit: 1500,
    siteLimit: 10,
    monthlyCredits: 100,
    sortOrder: 1,
  },
];

/** Annual = 10 months' price. Limits are per month and do not change. */
const ANNUAL_MONTHS = 10;

const rows = TIERS.flatMap((t) => [
  {
    tier: t.tier,
    name: t.name,
    interval: "month",
    priceCents: t.monthlyCents,
    articleLimit: t.articleLimit,
    keywordLimit: t.keywordLimit,
    siteLimit: t.siteLimit,
    monthlyCredits: t.monthlyCredits,
    sortOrder: t.sortOrder,
  },
  // A tier can opt out of an annual row; see Starter above.
  ...(t.monthlyOnly
    ? []
    : [
        {
          tier: t.tier,
          name: `${t.name} (Annual)`,
          interval: "year",
          priceCents: t.monthlyCents * ANNUAL_MONTHS,
          articleLimit: t.articleLimit,
          keywordLimit: t.keywordLimit,
          siteLimit: t.siteLimit,
          monthlyCredits: t.monthlyCredits,
          sortOrder: t.sortOrder,
        },
      ]),
]);

for (const p of rows) {
  await sql`
    insert into plans
      (name, tier, interval, currency, price_cents, article_limit,
       keyword_limit, site_limit, monthly_credits, sort_order, is_active)
    values
      (${p.name}, ${p.tier}, ${p.interval}, ${CURRENCY}, ${p.priceCents},
       ${p.articleLimit}, ${p.keywordLimit}, ${p.siteLimit},
       ${p.monthlyCredits}, ${p.sortOrder}, true)
    on conflict (tier, interval) do update set
      name = excluded.name,
      currency = excluded.currency,
      price_cents = excluded.price_cents,
      article_limit = excluded.article_limit,
      keyword_limit = excluded.keyword_limit,
      site_limit = excluded.site_limit,
      monthly_credits = excluded.monthly_credits,
      sort_order = excluded.sort_order,
      is_active = true,
      updated_at = now()
  `;
  console.log(`upserted ${p.tier}/${p.interval}`);
}

/**
 * Any plan seeded before tiers existed keeps tier "legacy" and is retired
 * here, so the pricing page shows exactly the line-up above.
 */
const retired = await sql`
  update plans set is_active = false, updated_at = now()
  where tier like 'legacy%' and is_active = true
  returning name
`;
for (const r of retired) console.log(`retired legacy plan: ${r.name}`);

/**
 * Tiers withdrawn from sale.
 *
 * is_active = false is the whole change: every surface lists plans with
 * `where is_active`, and checkout refuses an inactive plan, so this removes
 * them from sale everywhere at once.
 *
 * It does NOT touch anyone already subscribed. Their subscription row points
 * at this plan and keeps its limits, so they carry on exactly as before until
 * they cancel or move up — withdrawing a product from sale is not the same as
 * cancelling the people already on it.
 */
const withdrawn = await sql`
  update plans set is_active = false, updated_at = now()
  where tier = any(${RETIRED_TIERS}) and is_active = true
  returning name, tier
`;
for (const r of withdrawn) console.log(`withdrawn from sale: ${r.name}`);

/**
 * Warn if anyone is still on one.
 *
 * Silence here would hide the one case that needs a human decision: a paying
 * customer on a plan we no longer sell. Nothing is changed for them
 * automatically — what happens to their price is the client's call.
 */
const stranded = await sql`
  select p.name, count(*)::int as n
  from subscriptions s
  join plans p on p.id = s.plan_id
  where p.tier = any(${RETIRED_TIERS})
    and s.status in ('active', 'trialing', 'past_due')
  group by p.name
`;
for (const r of stranded) {
  console.log(
    `NOTE: ${r.n} live subscription(s) remain on "${r.name}" — left running on purpose.`,
  );
}

const all = await sql`
  select name, tier, interval, currency, price_cents, article_limit,
         keyword_limit, site_limit, monthly_credits, stripe_price_id, is_active
  from plans order by sort_order, price_cents
`;
console.table(all.map((r) => ({ ...r })));
await sql.end();
