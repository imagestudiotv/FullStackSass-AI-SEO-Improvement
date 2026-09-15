/**
 * Checks that subscriptions are attached to the website they pay for.
 *
 * Run after a test-mode checkout. Billing moved from the workspace to the
 * website, and the identifier travels through the processor and back: Stripe
 * carries it in subscription metadata, PayPal in custom_id as
 * "<organizationId>:<websiteId>".
 *
 * If it does not survive that round trip the failure is silent and expensive
 * to find. The payment succeeds, the subscription row is written, and the
 * customer simply gets no allowance — checkLimit reads website_id and finds
 * nothing. Nothing errors, nothing logs.
 *
 *   node scripts/check-subscriptions.mjs
 *
 * Exits non-zero when a subscription created after per-website billing has no
 * website, so it can gate a deploy.
 */
import nextEnv from "@next/env";
import postgres from "postgres";

nextEnv.loadEnvConfig(process.cwd());
const sql = postgres(process.env.DIRECT_URL, { connect_timeout: 30 });

/**
 * The column has to exist before anything else means anything.
 *
 * Without this the script dies on a raw Postgres "column does not exist",
 * which reads as a broken script rather than the real answer: the migration
 * has not run, so no subscription can name a website yet.
 */
const [{ exists: hasColumn }] = await sql`
  select exists(
    select 1 from information_schema.columns
    where table_name = 'subscriptions' and column_name = 'website_id'
  ) as exists`;

if (!hasColumn) {
  console.error(
    "\nsubscriptions.website_id does not exist — migration 0021 has not run." +
      "\nApply it first:  npm run db:push\n",
  );
  await sql.end();
  process.exit(1);
}

/**
 * What counts as excusable.
 *
 * This used to date the change from the oldest subscription that names a
 * website, falling back to now(). Both halves were wrong. With no row yet
 * carrying a website the fallback made the cutoff now(), so EVERY row sorted
 * as "created before the change" and the script reported success while not one
 * subscription named a site. A check that passes when nothing works is worse
 * than no check.
 *
 * The real question is not when a row was made, it is whether it CAN name a
 * website: a subscription whose account owns a site and still points at none
 * is broken regardless of its age, because checkLimit reads website_id and
 * that customer gets no allowance. An account with no website has nothing to
 * point at and is genuinely excusable.
 */

const rows = await sql`
  select
    s.id,
    s.provider,
    s.status,
    s.created_at,
    s.website_id,
    w.domain,
    o.name as workspace,
    p.name as plan,
    s.stripe_subscription_id,
    s.paypal_subscription_id,
    (select count(*) from websites w2 where w2.organization_id = s.organization_id)
      as owned_sites,
    (select string_agg(w2.domain, ', ') from websites w2
      where w2.organization_id = s.organization_id) as owned_domains
  from subscriptions s
  join organization o on o.id = s.organization_id
  left join websites w on w.id = s.website_id
  left join plans p on p.id = s.plan_id
  order by s.created_at desc`;

console.log(`\n${rows.length} subscription${rows.length === 1 ? "" : "s"}\n`);

let missing = 0;

for (const row of rows) {
  const ref =
    row.stripe_subscription_id ?? row.paypal_subscription_id ?? "(no processor id)";

  if (row.website_id) {
    console.log(
      `  OK       ${row.provider.padEnd(6)} ${row.status.padEnd(9)} ${row.plan ?? "no plan"} ` +
        `-> ${row.domain ?? "(deleted site)"}  ${ref}`,
    );
    continue;
  }

  /**
   * No website to point at. Nothing is broken and nothing can be fixed here:
   * there is no site to grant an allowance to, and connecting one later is
   * what attaches the subscription.
   */
  if (Number(row.owned_sites) === 0) {
    console.log(
      `  none     ${row.provider.padEnd(6)} ${row.status.padEnd(9)} ${row.workspace} ` +
        `has no website at all  ${ref}`,
    );
    continue;
  }

  /**
   * The real fault, whatever the row's age: an account that owns a site, with
   * a subscription naming none of them. checkLimit reads website_id, so this
   * customer pays and gets nothing.
   */
  missing += 1;
  console.log(
    `  MISSING  ${row.provider.padEnd(6)} ${row.status.padEnd(9)} ${row.workspace} ` +
      `owns ${row.owned_sites} site(s) [${row.owned_domains}] but names none ` +
      `— they get NO allowance  ${ref}`,
  );
}

/**
 * The other half of the check: a website that is paying should also be able
 * to spend. A subscription whose plan is gone grants nothing either.
 */
const orphanPlans = rows.filter((row) => row.website_id && !row.plan).length;
if (orphanPlans > 0) {
  console.log(
    `\n${orphanPlans} subscription(s) have a website but no plan — the price id did not match ours.`,
  );
}

console.log("");

if (missing > 0) {
  console.error(
    `${missing} subscription(s) own a website but do not name one.\n\n` +
      `For rows that predate per-website billing, attach them:\n` +
      `  node scripts/attach-subscriptions.mjs --apply\n\n` +
      `For one created by a NEW checkout, the identifier did not survive the\n` +
      `processor round trip: check the metadata written in lib/stripe/actions.ts\n` +
      `or lib/paypal/subscriptions.ts.`,
  );
  await sql.end();
  process.exit(1);
}

console.log("Every current subscription names the website it pays for.");
await sql.end();
