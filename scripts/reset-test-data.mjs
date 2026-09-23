/**
 * Empties the database of customer data, keeping the administrator's login
 * and the pricing configuration.
 *
 * For starting a test from scratch: after this the admin can sign in and is
 * treated as a brand-new customer — no workspace, no website, so the
 * onboarding flow runs from its first step.
 *
 *   npm run db:reset                       # dry run, writes nothing
 *   npm run db:reset -- --apply --i-understand=<db-host>
 *
 * The dry run is the default and prints a row count per table. Applying
 * needs the database's own hostname repeated back, so that emptying the
 * wrong database takes a deliberate act rather than one stale shell.
 *
 * WHAT IS KEPT
 *   user/account/session for ADMIN_EMAILS  the login itself
 *   plans, addons                          pricing config with Stripe price ids
 *
 * WHAT IS DELETED
 *   every other user, and every organization including the admin's own,
 *   which cascades to websites, articles, keywords, pages, audits, issues,
 *   calendars, backlinks, credits, payments, subscriptions and notifications
 *
 * NOT HANDLED HERE — subscriptions live at Stripe are not cancelled by
 * deleting our rows. Cancel them in the Stripe dashboard first, or the
 * processor keeps billing and sends webhooks for subscriptions this database
 * no longer recognises.
 */
import nextEnv from "@next/env";
import postgres from "postgres";

nextEnv.loadEnvConfig(process.cwd());

const apply = process.argv.includes("--apply");

/**
 * --apply on its own is not enough to wipe a database.
 *
 * This reads DIRECT_URL from whatever .env the working directory happens to
 * have, and a developer with production credentials in .env.local is one
 * command away from deleting every customer's work — irreversibly, since
 * nothing here is a soft delete. The flag is easy to add on autopilot;
 * naming the host is not, because it forces a look at WHICH database is
 * about to be emptied.
 *
 *   node scripts/reset-test-data.mjs --apply --i-understand=<db-host>
 *
 * The dry run needs none of this: it only counts.
 */
const url = process.env.DIRECT_URL;
if (!url) {
  console.error("\nDIRECT_URL is not set. Nothing to connect to.\n");
  process.exit(1);
}

let host;
try {
  host = new URL(url).hostname;
} catch {
  console.error("\nDIRECT_URL is not a valid connection string.\n");
  process.exit(1);
}

if (apply) {
  const confirmed = process.argv
    .find((arg) => arg.startsWith("--i-understand="))
    ?.slice("--i-understand=".length);

  if (confirmed !== host) {
    console.error(
      `\nRefusing to wipe ${host}.\n\n` +
        `This deletes every customer's websites, articles and history, and\n` +
        `there is no undo. To confirm you mean THIS database, re-run with:\n\n` +
        `  node scripts/reset-test-data.mjs --apply --i-understand=${host}\n\n` +
        `If that hostname is not the one you expected, stop and check which\n` +
        `.env file is being loaded.\n`,
    );
    process.exit(1);
  }
}

const sql = postgres(url, { connect_timeout: 30 });

console.log(`\nDatabase: ${host}`);

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

/**
 * An empty allowlist would delete every account including the one meant to
 * survive, leaving no way back in. Refusing is the only safe reading.
 */
if (adminEmails.length === 0) {
  console.error(
    "\nADMIN_EMAILS is empty. Refusing to run: there would be no account left to sign in with.\n",
  );
  await sql.end();
  process.exit(1);
}

const admins = await sql`
  select id, email from "user" where lower(email) = any(${adminEmails})`;

if (admins.length === 0) {
  console.error(
    `\nNo account matches ADMIN_EMAILS (${adminEmails.join(", ")}).\n` +
      `Refusing to run: every account would be deleted and nobody could sign in.\n`,
  );
  await sql.end();
  process.exit(1);
}

const adminIds = admins.map((row) => row.id);

console.log(`\nKeeping ${admins.length} administrator login(s):`);
for (const row of admins) console.log(`  ${row.email}`);

/**
 * Counted before anything is deleted, so the dry run reports what a real run
 * would remove rather than what is left afterwards.
 */
const [{ n: orgCount }] = await sql`select count(*)::int n from organization`;
const [{ n: userCount }] = await sql`
  select count(*)::int n from "user" where id <> all(${adminIds})`;

const TABLES = [
  "placements",
  "backlink_requests",
  "network_sites",
  "link_checks",
  "article_versions",
  "publish_logs",
  "articles",
  "calendar_items",
  "clusters",
  "keywords",
  "pages",
  "issues",
  "audits",
  "crawls",
  "competitors",
  "brand_voice",
  "geo_results",
  "geo_prompts",
  "ga_metrics",
  "gsc_metrics",
  "integrations",
  "integration_keys",
  "website_members",
  "websites",
  "addon_purchases",
  "payments",
  "subscriptions",
  /*
    Cascades from organization like the rest, but it was missing from this
    list — so it was being emptied and never CHECKED. The leftover guard
    below is the point of the list: a table absent from it can quietly
    survive a reset and nothing reports it.
  */
  "billing_customers",
  "usage_events",
  "credit_ledger",
  "referrals",
  "referral_codes",
  "notifications",
  "invitation",
  "agency_workspaces",
  "member",
  "organization",
  "webhook_events",
  "provider_cache",
  "admin_audit_log",
];

console.log("\nWould delete:");
const before = {};
for (const table of TABLES) {
  const [{ n }] = await sql.unsafe(`select count(*)::int n from "${table}"`);
  before[table] = n;
  if (n > 0) console.log(`  ${String(n).padStart(5)}  ${table}`);
}
console.log(`  ${String(userCount).padStart(5)}  user (all but the administrator)`);
console.log(
  `\n  ${orgCount} organization(s) and their cascades are included above.`,
);

const [{ n: plans }] = await sql`select count(*)::int n from plans`;
const [{ n: addons }] = await sql`select count(*)::int n from addons`;
console.log(`\nKeeping ${plans} plan(s) and ${addons} add-on(s) — pricing config.`);

if (!apply) {
  console.log("\nDry run — nothing written. Re-run with --apply.\n");
  await sql.end();
  process.exit(0);
}

/**
 * One transaction: a half-applied wipe is worse than either outcome, leaving
 * orphaned rows that no cascade will ever reach.
 */
await sql.begin(async (tx) => {
  /**
   * Deleted explicitly and first, because addons RESTRICTs deletion while a
   * purchase references it. Nothing else here blocks a delete.
   */
  await tx`delete from addon_purchases`;

  /**
   * Organizations cascade to almost everything customer-owned: websites (and
   * through them articles, keywords, pages, audits, calendars, integrations),
   * subscriptions, payments, credits, referrals, notifications and members.
   */
  await tx`delete from organization`;

  // Non-admin accounts. Cascades to their sessions and OAuth links.
  await tx`delete from "user" where id <> all(${adminIds})`;

  /**
   * The admin's own sessions are kept: signing the operator out of the
   * browser they are testing from is a surprise, not a safety measure, and
   * the session names an organization that no longer exists — which
   * requireOrg handles by falling back to a real membership row, finds none,
   * and sends them to onboarding. Which is the point of the reset.
   */

  /**
   * Tables with no foreign key to an organization, so no cascade reaches
   * them. The audit log deliberately has no FKs — it must outlive what it
   * describes — which is exactly why it has to be cleared by name here.
   */
  await tx`delete from admin_audit_log`;
  await tx`delete from webhook_events`;
  await tx`delete from provider_cache`;

  /**
   * Anything left in a table that should now be empty means a row was
   * reachable by neither a cascade nor a delete above — a new table added
   * without a tenant foreign key, most likely. Better to fail the whole
   * transaction than to report success over a half-empty database.
   */
  const leftovers = [];
  for (const table of TABLES) {
    const [{ n }] = await tx.unsafe(`select count(*)::int n from "${table}"`);
    if (n > 0) leftovers.push(`${table} (${n})`);
  }
  if (leftovers.length > 0) {
    throw new Error(`Rows survived deletion: ${leftovers.join(", ")}`);
  }
});

console.log("\nDone. Verifying...\n");

let bad = 0;
for (const table of TABLES) {
  const [{ n }] = await sql.unsafe(`select count(*)::int n from "${table}"`);
  if (n > 0) {
    bad += 1;
    console.log(`  NOT EMPTY  ${table}: ${n}`);
  }
}

const users = await sql`select email from "user" order by email`;
console.log(`  user: ${users.length} row(s) — ${users.map((u) => u.email).join(", ")}`);
const [{ n: sessions }] = await sql`select count(*)::int n from session`;
console.log(`  session: ${sessions} (the administrator's, kept so they stay signed in)`);
console.log(`  plans: ${plans}, addons: ${addons} (kept)`);

if (bad > 0 || users.length !== admins.length) {
  console.error("\nVerification failed.\n");
  await sql.end();
  process.exit(1);
}

console.log("\nDatabase is clean. Sign in and the onboarding flow starts from step one.\n");
await sql.end();
