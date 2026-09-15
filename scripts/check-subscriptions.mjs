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
 * Rows created before the change legitimately have no website; the migration
 * backfills what it can, but a workspace with no site at the time keeps null.
 * Anything newer is a real fault.
 */
const [{ applied_at: cutoff }] = await sql`
  select coalesce(
    (select min(created_at) from subscriptions where website_id is not null),
    now()
  ) as applied_at`;

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
    s.paypal_subscription_id
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
   * Old rows are reported but not counted as failures: they predate the
   * change and cannot be fixed by re-running a checkout.
   */
  const legacy = row.created_at < cutoff;
  if (legacy) {
    console.log(
      `  legacy   ${row.provider.padEnd(6)} ${row.status.padEnd(9)} ${row.workspace} ` +
        `has no website (created before per-site billing)  ${ref}`,
    );
    continue;
  }

  missing += 1;
  console.log(
    `  MISSING  ${row.provider.padEnd(6)} ${row.status.padEnd(9)} ${row.workspace} ` +
      `has NO website — this site gets no allowance  ${ref}`,
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
    `${missing} subscription(s) created after per-website billing have no website.\n` +
      `The identifier did not survive the processor round trip: check the\n` +
      `metadata written in lib/stripe/actions.ts or lib/paypal/subscriptions.ts.`,
  );
  await sql.end();
  process.exit(1);
}

console.log("Every current subscription names the website it pays for.");
await sql.end();
