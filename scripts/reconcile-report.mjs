/**
 * Read-only reconciliation report.
 *
 *   npm run reconcile:report                 # every report
 *   npm run reconcile:report -- duplicateLiveSubscriptions owedCancellations
 *
 * Lists what needs a person's decision after the audit fixes - duplicate
 * live subscriptions for one website, provider cancellations still owed,
 * checkouts that never settled, webhook events that failed or were
 * abandoned, add-on purchases and referral rewards without their credits,
 * backlink placements charged under the old draft-time model, and jobs that
 * were never delivered or work stranded before the outbox existed.
 *
 * It CHANGES NOTHING. Every statement runs inside a READ ONLY transaction,
 * which Postgres enforces - an accidental write would fail - and the
 * transaction is rolled back. The SQL is the same the app's tests run
 * (src/lib/billing/reconciliation-sql.mjs).
 *
 * Uses DIRECT_URL like the other scripts. Point it at the database you mean
 * to inspect; it prints ids and amounts, never credentials.
 */
import nextEnv from "@next/env";
import postgres from "postgres";

import { RECONCILIATION_SQL } from "../src/lib/billing/reconciliation-sql.mjs";

nextEnv.loadEnvConfig(process.cwd());

const url = process.env.DIRECT_URL;
if (!url) {
  console.error("DIRECT_URL is not set");
  process.exit(2);
}

const wanted = process.argv.slice(2).filter((name) => !name.startsWith("-"));
const unknown = wanted.filter((name) => !(name in RECONCILIATION_SQL));
if (unknown.length > 0) {
  console.error(`Unknown report(s): ${unknown.join(", ")}`);
  console.error(`Available: ${Object.keys(RECONCILIATION_SQL).join(", ")}`);
  process.exit(2);
}
const reports = wanted.length > 0 ? wanted : Object.keys(RECONCILIATION_SQL);

const sql = postgres(url, { max: 1, connect_timeout: 30, onnotice: () => {} });
let findings = 0;
try {
  await sql.begin("read only", async (tx) => {
    for (const name of reports) {
      let rows;
      try {
        rows = await tx.unsafe(RECONCILIATION_SQL[name]);
      } catch (error) {
        // A table this report reads may not exist until its migration runs.
        console.log(`\n## ${name}: could not run (${error.message})`);
        throw error;
      }
      findings += rows.length;
      console.log(`\n## ${name}: ${rows.length}`);
      for (const row of rows.slice(0, 50)) console.log(JSON.stringify(row));
      if (rows.length > 50) console.log(`... and ${rows.length - 50} more`);
    }
    // Nothing to keep: end the read-only transaction without committing.
    throw Object.assign(new Error("rollback"), { rollback: true });
  });
} catch (error) {
  if (!error.rollback) {
    console.error(error.message);
    await sql.end();
    process.exit(2);
  }
}
await sql.end();
console.log(`\n${findings} finding(s). Nothing was changed.`);
process.exit(findings > 0 ? 1 : 0);
