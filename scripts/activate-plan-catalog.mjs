/**
 * Puts the current catalog (scripts/plan-catalog.mjs) on sale, and takes every
 * other plan off sale, in one transaction. docs/plan-catalog.md has the steps.
 *
 *   npm run plans:activate                     shows what would happen; writes nothing
 *   npm run plans:activate -- --apply          does it
 *   npm run plans:activate -- --apply --local  a local database with no Stripe prices
 *
 * Refuses if a row is missing, differs from the catalog, or has no Stripe
 * price: checkout refuses such a plan, so the site would advertise a price
 * nobody can pay. --local waives only the last check, and only for a database
 * on this machine.
 *
 * Subscribers are not touched: only is_active changes, so everyone keeps the
 * plan row they bought, with its limits and the price id Stripe bills them on.
 * It prints how many stay on each plan leaving sale.
 *
 * Writes to the database in DIRECT_URL; the host is printed first.
 */
import nextEnv from "@next/env";
import postgres from "postgres";

import { CATALOG_VERSION, activationProblems } from "./plan-catalog.mjs";

nextEnv.loadEnvConfig(process.cwd());

const { DIRECT_URL } = process.env;
if (!DIRECT_URL) {
  console.error("DIRECT_URL is not set.");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const LOCAL = process.argv.includes("--local");

const target = new URL(DIRECT_URL);
console.log(`Database: ${target.hostname}${target.port ? `:${target.port}` : ""}${target.pathname}`);
console.log(`Catalog:  ${CATALOG_VERSION}\n`);

if (LOCAL && !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)) {
  console.error("--local is only for a database on this machine. Nothing was changed.");
  process.exit(1);
}

const sql = postgres(DIRECT_URL, { connect_timeout: 30 });

const rows = await sql`select * from plans where catalog_version = ${CATALOG_VERSION}`;
const problems = activationProblems(rows, { requireStripe: !LOCAL });
if (problems.length > 0) {
  console.error("This catalog cannot go on sale yet. Nothing was changed.\n");
  for (const problem of problems) console.error(`  ${problem}`);
  await sql.end();
  process.exit(1);
}

// PayPal is optional per plan: without its id the plan step offers card only.
const noPayPal = rows.filter((row) => !row.paypal_plan_id || !row.paypal_trial_plan_id);
if (noPayPal.length > 0) {
  console.log(`NOTE: ${noPayPal.length} plan(s) have no PayPal plans yet, so they will be sold by card only (paypal:setup).\n`);
}

const leaving = await sql`
  select p.name, p.tier, p.interval, p.price_cents,
         count(s.id) filter (where s.status in ('active', 'trialing', 'past_due'))::int as live_subscriptions
  from plans p
  left join subscriptions s on s.plan_id = p.id
  where p.is_active = true and p.catalog_version <> ${CATALOG_VERSION}
  group by p.id
  order by p.sort_order, p.price_cents
`;
if (leaving.length > 0) {
  console.log("Leaving sale - anyone on these stays on them, unchanged:");
  console.table(leaving.map((r) => ({ ...r })));
}

if (!APPLY) {
  console.log("Dry run: nothing was changed. Add --apply to put this catalog on sale.");
  await sql.end();
  process.exit(0);
}

await sql.begin(async (tx) => {
  await tx`update plans set is_active = true, updated_at = now() where catalog_version = ${CATALOG_VERSION} and is_active = false`;
  await tx`update plans set is_active = false, updated_at = now() where catalog_version <> ${CATALOG_VERSION} and is_active = true`;
});

const onSale = await sql`
  select name, tier, interval, price_cents, article_limit, social_post_limit, monthly_credits, stripe_price_id
  from plans where is_active = true order by sort_order, price_cents
`;
console.log("On sale now:");
console.table(onSale.map((r) => ({ ...r })));
await sql.end();
