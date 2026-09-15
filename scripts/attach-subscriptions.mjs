/**
 * Points existing subscriptions at the website they pay for.
 *
 * Billing moved from the account to the website, which added
 * subscriptions.website_id. Applying the schema change does NOT fill it in —
 * drizzle-kit push diffs structure and adds the column; it runs no data
 * statements. So every subscription taken out before the change still names no
 * website, and checkLimit reads website_id: those customers pay and get no
 * allowance, silently.
 *
 * Only attaches where the answer is unambiguous — an account owning exactly
 * one website. With two or more there is no way to tell from the database
 * which one the money was for, and guessing would grant an allowance to the
 * wrong site while leaving the paid one empty. Those are printed for a human.
 *
 *   node scripts/attach-subscriptions.mjs            # dry run
 *   node scripts/attach-subscriptions.mjs --apply
 *
 * Idempotent: rows that already name a website are left alone, so running it
 * twice changes nothing the second time.
 */
import nextEnv from "@next/env";
import postgres from "postgres";

nextEnv.loadEnvConfig(process.cwd());

const apply = process.argv.includes("--apply");
const sql = postgres(process.env.DIRECT_URL, { connect_timeout: 30 });

const [{ exists: hasColumn }] = await sql`
  select exists(
    select 1 from information_schema.columns
    where table_name = 'subscriptions' and column_name = 'website_id'
  ) as exists`;

if (!hasColumn) {
  console.error("\nsubscriptions.website_id does not exist. Run: npm run db:push\n");
  await sql.end();
  process.exit(1);
}

/**
 * Candidates: a subscription naming no website, whose account owns some.
 * Ordered oldest website first, so "the only one" is stable if it is also
 * "the first one".
 */
const rows = await sql`
  select
    s.id,
    s.provider,
    s.status,
    o.name as workspace,
    (select count(*) from websites w where w.organization_id = s.organization_id)
      as owned,
    (select w.id from websites w
      where w.organization_id = s.organization_id
      order by w.created_at asc limit 1) as first_site_id,
    (select string_agg(w.domain, ', ' order by w.created_at asc) from websites w
      where w.organization_id = s.organization_id) as domains
  from subscriptions s
  join organization o on o.id = s.organization_id
  where s.website_id is null
  order by s.created_at asc`;

if (rows.length === 0) {
  console.log("\nEvery subscription already names a website. Nothing to do.\n");
  await sql.end();
  process.exit(0);
}

console.log("");

let attached = 0;
let ambiguous = 0;
let empty = 0;

for (const row of rows) {
  const owned = Number(row.owned);
  const label = `${row.provider.padEnd(6)} ${row.status.padEnd(9)} ${row.workspace}`;

  if (owned === 0) {
    empty += 1;
    console.log(`  skip       ${label} — owns no website, nothing to attach`);
    continue;
  }

  if (owned > 1) {
    ambiguous += 1;
    console.log(
      `  AMBIGUOUS  ${label} — owns ${owned} sites [${row.domains}].\n` +
        `             Which one is paid for cannot be known from here. Set it by hand:\n` +
        `             update subscriptions set website_id = '<id>' where id = '${row.id}';`,
    );
    continue;
  }

  attached += 1;
  console.log(`  attach     ${label} -> ${row.domains}`);

  if (apply) {
    /**
     * Guarded on website_id still being null, so a concurrent checkout that
     * attached this row first is not overwritten.
     */
    await sql`
      update subscriptions
      set website_id = ${row.first_site_id}, updated_at = now()
      where id = ${row.id} and website_id is null`;
  }
}

console.log("");
console.log(
  `${attached} to attach, ${ambiguous} ambiguous, ${empty} with no website.`,
);

if (ambiguous > 0) {
  console.log(
    "\nAmbiguous rows need a decision: check which site the customer is\n" +
      "actually using, or ask them, then run the update printed above.",
  );
}

if (!apply && attached > 0) {
  console.log("\nDry run — nothing written. Re-run with --apply.");
}

await sql.end();
