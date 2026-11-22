/**
 * The client's plan allowances of 2026-11-21, written onto the catalog 2 rows
 * IN PLACE (no new catalog version, no new prices):
 *
 *   Grow (monthly and annual)     articles 60 -> 30, social posts 90 (same), search terms 500 -> 300
 *   Scale (monthly and annual)    articles 100 -> 60, social posts 240 -> 180, search terms 1,500 -> 1,200
 *   Grow + Visibility (monthly)   articles 60 -> 30, social posts 90 -> 120, search terms 500 -> 400
 *
 * Only article_limit, social_post_limit and keyword_limit (and updated_at) of
 * those five rows change. Never the price, the Stripe or PayPal ids, the
 * credits, the sites, is_active, or any other catalog's row, so nothing is
 * charged differently and Stripe and PayPal are not contacted.
 *
 * THIS LOWERS THE LIMITS OF EVERYONE ON THOSE ROWS, at once: a subscription's
 * limits are read live from its plan row (lib/usage.ts). scripts/plan-catalog.mjs
 * explains why a catalog is normally never edited; the client's decision and
 * its consequences are in review-reports/2026-11-21/ticket/plan-limits-production.md.
 *
 * A DRY RUN unless --apply: it only selects, and prints each row before and
 * after, how many live subscriptions (active, trialing, past_due) are on it,
 * and how many of their websites already keep more search terms than the new
 * limit. --apply also needs --confirm-host=<the database host it printed>, so
 * it cannot write to a database other than the one that was checked. All five
 * rows are written in one transaction, each only while it still holds the
 * values the dry run showed; anything else rolls the whole change back.
 * Re-running after it applied does nothing.
 *
 * Writes to the database in DIRECT_URL (from .env.local unless the shell sets
 * another); the host is printed first, never the user or password.
 *
 *   node scripts/ops/plan-limits-2026-11-21.mjs                                      dry run
 *   node scripts/ops/plan-limits-2026-11-21.mjs --apply --confirm-host=<host>        writes
 */
import nextEnv from "@next/env";
import postgres from "postgres";

import { CATALOG_VERSION, catalogRows } from "../plan-catalog.mjs";

/** The change, written out: what each row holds today and what it gets. */
const CHANGES = [
  { tier: "grow", interval: "month", from: [60, 90, 500], to: [30, 90, 300] },
  { tier: "grow", interval: "year", from: [60, 90, 500], to: [30, 90, 300] },
  { tier: "scale", interval: "month", from: [100, 240, 1500], to: [60, 180, 1200] },
  { tier: "scale", interval: "year", from: [100, 240, 1500], to: [60, 180, 1200] },
  { tier: "grow_visibility", interval: "month", from: [60, 90, 500], to: [30, 120, 400] },
];
const LIVE_STATUSES = ["active", "trialing", "past_due"];

const limitsOf = (row) => [row.article_limit, row.social_post_limit, row.keyword_limit];
const same = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);
const shown = ([articles, posts, terms]) => `${articles} articles / ${posts} posts / ${terms} terms`;

/* The catalog in code must already say the same, or code and database would disagree after this. */
if (CATALOG_VERSION !== 2) {
  console.error(`scripts/plan-catalog.mjs is catalog ${CATALOG_VERSION}, not 2. Nothing was changed.`);
  process.exit(1);
}
for (const change of CHANGES) {
  const row = catalogRows().find((r) => r.tier === change.tier && r.interval === change.interval);
  if (!row || !same([row.articleLimit, row.socialPostLimit, row.keywordLimit], change.to)) {
    console.error(`${change.tier}/${change.interval}: scripts/plan-catalog.mjs does not hold ${shown(change.to)}. Nothing was changed.`);
    process.exit(1);
  }
}

nextEnv.loadEnvConfig(process.cwd());
const { DIRECT_URL } = process.env;
if (!DIRECT_URL) {
  console.error("DIRECT_URL is not set. Nothing was changed.");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const confirmHost = process.argv.find((arg) => arg.startsWith("--confirm-host="))?.slice("--confirm-host=".length);
const unknown = process.argv.slice(2).filter((arg) => arg !== "--apply" && !arg.startsWith("--confirm-host="));
if (unknown.length > 0) {
  console.error(`Unknown argument(s): ${unknown.join(" ")}. Nothing was changed.`);
  process.exit(2);
}

const target = new URL(DIRECT_URL);
console.log(`Database: ${target.hostname}${target.port ? `:${target.port}` : ""}${target.pathname}`);
console.log(`Catalog:  ${CATALOG_VERSION}`);
console.log(`Mode:     ${APPLY ? "APPLY" : "dry run (add --apply --confirm-host=<host> to write)"}\n`);

if (APPLY && confirmHost !== target.hostname) {
  console.error(`--apply needs --confirm-host=${target.hostname} (the host above). Nothing was changed.`);
  process.exit(2);
}

const sql = postgres(DIRECT_URL, { connect_timeout: 30 });

/** Each row of the change as the database has it, with who is on it. */
async function survey(executor) {
  const report = [];
  for (const change of CHANGES) {
    const [row] = await executor`
      select id, name, tier, interval, is_active, price_cents, stripe_price_id,
             article_limit, social_post_limit, keyword_limit
      from plans
      where catalog_version = ${CATALOG_VERSION} and tier = ${change.tier} and interval = ${change.interval}
    `;
    if (!row) {
      report.push({ change, row: null, live: 0, overTerms: 0 });
      continue;
    }
    // Per website: a subscription is one website's (subscriptions.website_id), and so is the keyword count (lib/usage.ts).
    const subs = await executor`
      select s.status, (select count(*) from keywords k where k.website_id = s.website_id)::int as terms
      from subscriptions s
      where s.plan_id = ${row.id} and s.status in ${executor(LIVE_STATUSES)}
    `;
    report.push({
      change,
      row,
      live: subs.length,
      byStatus: Object.fromEntries(LIVE_STATUSES.map((status) => [status, subs.filter((s) => s.status === status).length])),
      overTerms: subs.filter((s) => s.terms > change.to[2]).length,
      maxTerms: subs.reduce((max, s) => Math.max(max, s.terms), 0),
    });
  }
  return report;
}

const before = await survey(sql);

let problems = 0;
const plan = before.map(({ change, row, live, byStatus, overTerms, maxTerms }) => {
  const key = `${change.tier}/${change.interval}`;
  if (!row) {
    problems += 1;
    return { row: key, state: "MISSING - not in the database" };
  }
  const now = limitsOf(row);
  const state = same(now, change.to) ? "already done" : same(now, change.from) ? "will change" : "UNEXPECTED VALUES";
  if (state === "UNEXPECTED VALUES") problems += 1;
  return {
    row: key,
    name: row.name,
    on_sale: row.is_active,
    price_cents: row.price_cents,
    before: shown(now),
    after: shown(change.to),
    state,
    live_subscriptions: live,
    ...byStatus,
    websites_over_new_terms: overTerms,
    most_terms_on_one_website: maxTerms,
  };
});
console.table(plan);

if (problems > 0) {
  console.error("\nA row is missing or holds values this change does not expect (someone changed it since 2026-11-21?). Nothing was changed.");
  await sql.end();
  process.exit(1);
}

const pending = before.filter(({ change, row }) => !same(limitsOf(row), change.to));
if (pending.length === 0) {
  console.log("\nEvery row already holds the new limits. Nothing to do.");
  await sql.end();
  process.exit(0);
}

console.log(`
Prices, Stripe and PayPal ids, credits, sites and is_active are not touched.
websites_over_new_terms: those websites keep every search term they have; research adds
no more and adding by hand is refused until they are under the new limit (lib/keywords).`);

if (!APPLY) {
  console.log(`\nDry run: nothing was changed. ${pending.length} row(s) would change.`);
  console.log(`To write: node scripts/ops/plan-limits-2026-11-21.mjs --apply --confirm-host=${target.hostname}`);
  await sql.end();
  process.exit(0);
}

try {
  await sql.begin(async (tx) => {
    for (const { change, row } of pending) {
      const [articles, posts, terms] = change.to;
      const [oldArticles, oldPosts, oldTerms] = change.from;
      // Only while the row still holds what the survey read: a concurrent edit makes this 0 rows and rolls everything back.
      const written = await tx`
        update plans
        set article_limit = ${articles}, social_post_limit = ${posts}, keyword_limit = ${terms}, updated_at = now()
        where id = ${row.id}
          and catalog_version = ${CATALOG_VERSION}
          and article_limit = ${oldArticles} and social_post_limit = ${oldPosts} and keyword_limit = ${oldTerms}
      `;
      if (written.count !== 1) throw new Error(`${change.tier}/${change.interval}: expected 1 row updated, got ${written.count}`);
    }
  });
} catch (error) {
  console.error(`\nRolled back, nothing was changed: ${error instanceof Error ? error.message : error}`);
  await sql.end();
  process.exit(1);
}

const after = await survey(sql);
console.log("\nWritten. The rows now:");
console.table(
  after.map(({ change, row, live }) => ({
    row: `${change.tier}/${change.interval}`,
    limits: shown(limitsOf(row)),
    price_cents: row.price_cents,
    stripe_price_id: row.stripe_price_id,
    live_subscriptions: live,
  })),
);
console.log(`
To undo, in one transaction:
${CHANGES.map(
  ({ tier, interval, from: [a, p, t] }) =>
    `  update plans set article_limit = ${a}, social_post_limit = ${p}, keyword_limit = ${t}, updated_at = now() where catalog_version = ${CATALOG_VERSION} and tier = '${tier}' and interval = '${interval}';`,
).join("\n")}
Then redeploy (or wait up to an hour) so the cached homepage and /pricing read the rows again.`);
await sql.end();
