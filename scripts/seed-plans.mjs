/**
 * Writes the current catalog (scripts/plan-catalog.mjs) into the plans table.
 * Idempotent - upserts on (tier, interval, catalog_version), so it is safe to
 * re-run and will be needed again for the production database.
 *
 * NOTHING GOES ON SALE HERE, and no other catalog's row is touched. New rows
 * are written inactive; `npm run plans:activate` puts them on sale once they
 * have their prices. So running this cannot change what the site shows, what
 * checkout charges, or anything a subscriber has.
 *
 * Withdrawn tiers and plans are deactivated rather than deleted, for two
 * reasons. subscriptions.plan_id is ON DELETE RESTRICT, so removing a plan
 * somebody holds would fail outright. And a plan named on a past invoice must
 * keep existing, or the payment history stops saying what the customer was
 * charged for. Anyone already on one keeps it until they cancel or change plan.
 *
 * stripePriceId stays null until `npm run stripe:setup` creates the Stripe
 * products and writes the ids back. Checkout refuses any plan without one, so
 * a half-configured plan cannot take money.
 *
 * Writes to the database in DIRECT_URL; the host is printed first.
 */
import nextEnv from "@next/env";
import postgres from "postgres";

import { CATALOG_VERSION, CURRENCY, catalogRows } from "./plan-catalog.mjs";

nextEnv.loadEnvConfig(process.cwd());
const sql = postgres(process.env.DIRECT_URL, { connect_timeout: 30 });

const target = new URL(process.env.DIRECT_URL);
console.log(`Database: ${target.hostname}${target.port ? `:${target.port}` : ""}${target.pathname}\n`);

for (const p of catalogRows()) {
  await sql`
    insert into plans
      (name, tier, interval, currency, price_cents, article_limit,
       social_post_limit, keyword_limit, site_limit, monthly_credits,
       sort_order, catalog_version, is_active)
    values
      (${p.name}, ${p.tier}, ${p.interval}, ${CURRENCY}, ${p.priceCents},
       ${p.articleLimit}, ${p.socialPostLimit}, ${p.keywordLimit}, ${p.siteLimit},
       ${p.monthlyCredits}, ${p.sortOrder}, ${CATALOG_VERSION}, false)
    on conflict (tier, interval, catalog_version) do update set
      name = excluded.name,
      currency = excluded.currency,
      price_cents = excluded.price_cents,
      article_limit = excluded.article_limit,
      social_post_limit = excluded.social_post_limit,
      keyword_limit = excluded.keyword_limit,
      site_limit = excluded.site_limit,
      monthly_credits = excluded.monthly_credits,
      sort_order = excluded.sort_order,
      updated_at = now()
  `;
  console.log(`upserted ${p.tier}/${p.interval} (catalog ${CATALOG_VERSION})`);
}

const all = await sql`
  select name, tier, interval, catalog_version, currency, price_cents, article_limit,
         social_post_limit, keyword_limit, site_limit, monthly_credits, stripe_price_id, is_active
  from plans order by catalog_version desc, sort_order, price_cents
`;
console.table(all.map((r) => ({ ...r })));
console.log("Next: stripe:setup, paypal:setup, then plans:activate (docs/plan-catalog.md).");
await sql.end();
