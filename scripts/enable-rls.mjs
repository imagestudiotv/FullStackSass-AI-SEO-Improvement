/**
 * Turns Row Level Security on for every table.
 *
 *   npm run db:rls            # report only, changes nothing
 *   npm run db:rls -- --apply
 *
 * WHY A SCRIPT AND NOT db:push. drizzle-kit push diffs the schema file against
 * the database and writes the DDL it infers; RLS is not expressed in the
 * schema file at all, so push neither applies drizzle/0026_enable_rls.sql nor
 * notices it is missing. The statements are idempotent — ENABLE on a table
 * that already has it is a no-op — so running this repeatedly is safe, and it
 * doubles as the check that nothing has drifted back.
 *
 * WHAT IT DOES NOT DO: create policies. RLS with no policy denies every row to
 * every ordinary role, which is the intent. The application is unaffected
 * because it connects as a role carrying rolbypassrls, which the report below
 * verifies before changing anything — if that is ever false, this refuses
 * rather than locking the product out of its own database.
 */
import nextEnv from "@next/env";
import postgres from "postgres";

nextEnv.loadEnvConfig(process.cwd());

const apply = process.argv.includes("--apply");

const url = process.env.DIRECT_URL;
if (!url) {
  console.error("\nDIRECT_URL is not set.\n");
  process.exit(1);
}

const host = new URL(url).hostname;
const sql = postgres(url, { connect_timeout: 30 });

console.log(`\nDatabase: ${host}`);

try {
  /**
   * The role the application connects as must bypass RLS, or enabling it
   * would take the product offline the moment this lands.
   */
  const [role] = await sql`
    select current_user as name,
           (select rolbypassrls from pg_roles where rolname = current_user) as bypassrls`;

  console.log(`Role:     ${role.name} (bypassrls: ${role.bypassrls})`);

  if (!role.bypassrls) {
    console.error(
      `\nRefusing to continue: ${role.name} does not bypass RLS, so enabling it\n` +
        `would deny this connection every row. Grant BYPASSRLS, or add policies\n` +
        `for this role first.\n`,
    );
    await sql.end();
    process.exit(1);
  }

  const tables = await sql`
    select c.relname as table, c.relrowsecurity as enabled
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname`;

  const off = tables.filter((t) => !t.enabled);

  console.log(
    `\n${tables.length} table(s): ${tables.length - off.length} with RLS on, ${off.length} off.`,
  );
  if (off.length > 0) {
    console.log("\nWould enable on:");
    for (const t of off) console.log(`  ${t.table}`);
  }

  if (off.length === 0) {
    console.log("\nEvery table already has RLS enabled. Nothing to do.\n");
    await sql.end();
    process.exit(0);
  }

  if (!apply) {
    console.log("\nReport only — nothing written. Re-run with --apply.\n");
    await sql.end();
    process.exit(0);
  }

  // One transaction: a half-enabled schema is a confusing state to debug.
  await sql.begin(async (tx) => {
    for (const t of off) {
      await tx.unsafe(`ALTER TABLE "${t.table}" ENABLE ROW LEVEL SECURITY`);
    }
  });

  const after = await sql`
    select count(*)::int n
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`;

  if (after[0].n > 0) {
    console.error(`\n${after[0].n} table(s) still without RLS. Verification failed.\n`);
    await sql.end();
    process.exit(1);
  }

  /**
   * Proof the connection still works AFTER the change, not before. A
   * successful ALTER says nothing about whether the app can still read.
   */
  const [check] = await sql`select count(*)::int n from plans`;
  console.log(`\nRLS enabled on ${off.length} table(s).`);
  console.log(`Read-back check: plans returned ${check.n} row(s) — access intact.\n`);
} catch (error) {
  console.error("\nFailed:", error instanceof Error ? error.message : error, "\n");
  await sql.end();
  process.exit(1);
}

await sql.end();
