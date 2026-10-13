/**
 * Read-only check of a live database's access controls - the same rules CI
 * applies to a fresh replay of every migration (src/lib/db/security-check.mjs):
 * RLS on every table in "public", no privileges for Supabase's API roles
 * (anon, authenticated) or PUBLIC on tables, sequences or the application's
 * own functions, no policy admitting them, and default privileges that do not
 * hand new objects to them.
 *
 *   CHECK_DATABASE_URL="<connection string>" npm run check:db-security
 *
 * The connection is named explicitly on purpose: this never reads .env.local
 * or DATABASE_URL, so it cannot run against a database by accident. It opens
 * a read-only transaction with a 30-second statement timeout and prints
 * object names, privilege names and counts - never rows or credentials.
 * Exit code 1 means a problem was found (or the check could not run).
 */
import postgres from "postgres";

import { inspectDatabaseSecurity } from "../src/lib/db/security-check.mjs";

const url = process.env.CHECK_DATABASE_URL;
if (!url) {
  console.error("\nCHECK_DATABASE_URL is not set. Name the database to check explicitly.\n");
  process.exit(1);
}

let host = "?";
try {
  host = new URL(url).hostname;
} catch {
  console.error("\nCHECK_DATABASE_URL is not a valid connection URL.\n");
  process.exit(1);
}

const sql = postgres(url, { max: 1, connect_timeout: 30, prepare: false, onnotice: () => {} });

try {
  const { role, result } = await sql.begin("read only", async (tx) => {
    await tx`set local statement_timeout = '30s'`;
    const [role] = await tx`
      select current_user as name,
             (select rolbypassrls from pg_roles where rolname = current_user) as bypassrls,
             (select rolsuper from pg_roles where rolname = current_user) as superuser`;
    return { role, result: await inspectDatabaseSecurity(tx) };
  });

  console.log(`\nDatabase host: ${host}`);
  console.log(`Connected as:  ${role.name} (bypassrls: ${role.bypassrls}, superuser: ${role.superuser})`);
  console.log(`Summary:       ${JSON.stringify(result.summary)}`);
  if (result.problems.length) {
    console.log(`\n${result.problems.length} problem(s):`);
    for (const problem of result.problems) console.log(`  - ${problem}`);
    console.log("");
    await sql.end();
    process.exit(1);
  }
  console.log("\nNo problems found.\n");
} catch (error) {
  // The driver's message never contains the password; still keep it short.
  console.error("\nCheck failed:", error?.code ?? "", String(error?.message ?? error).slice(0, 200), "\n");
  await sql.end();
  process.exit(1);
}

await sql.end();
