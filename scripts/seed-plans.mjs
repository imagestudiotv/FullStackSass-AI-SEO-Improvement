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

/** Monthly price per tier, in minor units. Annual is derived as x10. */
const TIERS = [
  {
    /**
     * The entry tier from the brief: "one article and one backlink, to attract
     * to subscribe, and later upgrade the plans".
     *
     * Monthly only. An annual Starter would be EUR 10 for a year of service,
     * which undercuts every other plan and gives someone no reason to move up
     * — the opposite of what an entry tier is for.
     */
    tier: "starter",
    name: "Starter",
    monthlyCents: 100,
    articleLimit: 1,
    keywordLimit: 25,
    siteLimit: 1,
    monthlyCredits: 1,
    sortOrder: 0,
    monthlyOnly: true,
  },
  {
    tier: "launch",
    name: "Launch",
    monthlyCents: 2900,
    articleLimit: 5,
    keywordLimit: 50,
    siteLimit: 1,
    monthlyCredits: 5,
    sortOrder: 1,
  },
  {
    tier: "grow",
    name: "Grow",
    monthlyCents: 9900,
    articleLimit: 25,
    keywordLimit: 300,
    siteLimit: 3,
    monthlyCredits: 25,
    sortOrder: 2,
  },
  {
    tier: "scale",
    name: "Scale",
    monthlyCents: 29900,
    articleLimit: 100,
    keywordLimit: 1500,
    siteLimit: 10,
    monthlyCredits: 100,
    sortOrder: 3,
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

const all = await sql`
  select name, tier, interval, currency, price_cents, article_limit,
         keyword_limit, site_limit, monthly_credits, stripe_price_id, is_active
  from plans order by sort_order, price_cents
`;
console.table(all.map((r) => ({ ...r })));
await sql.end();
