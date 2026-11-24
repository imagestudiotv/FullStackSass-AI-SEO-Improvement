/**
 * Deletes imagestudio.com's old test drafts (Daniel, 2026-11-24: "Can we delete
 * all the old links from imagestudio fails, we will never using this articles").
 *
 * ONE WEBSITE ONLY, written out below, and only drafts created before --before
 * (UTC day, exclusive) that were never published and never delivered: the same
 * rules as Admin -> Partner Network's "Delete selected"
 * (src/lib/admin/draft-deletion-rules.mjs). Anything live, delivered, possibly
 * delivered, being delivered, requested, approved, or carrying a network link
 * is kept and counted with its reason. Each deleted draft's calendar topic is
 * marked "skipped" so the scheduler never writes it again. Credits, the
 * allowance ledger, Stripe, PayPal and the website itself are not touched.
 *
 * A DRY RUN unless --apply: it only selects, and prints what would be deleted
 * and why the rest is kept. --apply also needs --confirm-host=<the database
 * host it printed> and --backup=<a new file>: every row the deletion removes
 * or changes is written there BEFORE anything is deleted. One transaction: a
 * failure at any point, the backup included, changes nothing. Running it again
 * after it applied deletes nothing more.
 *
 * Writes to the database in DIRECT_URL (from .env.local unless the shell sets
 * another); the host is printed first, never the user or password.
 *
 *   node scripts/ops/delete-imagestudio-drafts-2026-11-24.mjs --before=2026-11-01
 *   node scripts/ops/delete-imagestudio-drafts-2026-11-24.mjs --before=2026-11-01 --apply --confirm-host=<host> --backup=<file.json>
 */
import { existsSync } from "node:fs";
import { open } from "node:fs/promises";

import nextEnv from "@next/env";
import postgres from "postgres";

import { deleteDrafts, keptCounts, surveyDrafts } from "../../src/lib/admin/draft-cleanup.mjs";

const WEBSITE_ID = "4aec4382-f158-4deb-b7a3-b4968aac6b41";
const DOMAIN = "imagestudio.com";
const NOTE = "Old test drafts nobody will use (Daniel, 2026-11-24)";

function refuse(message, code = 2) {
  console.error(`${message} Nothing was changed.`);
  process.exit(code);
}

const args = process.argv.slice(2);
const value = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const APPLY = args.includes("--apply");
const before = value("before");
const backupPath = value("backup");
const confirmHost = value("confirm-host");
const unknown = args.filter((arg) => arg !== "--apply" && !/^--(before|backup|confirm-host)=/.test(arg));
if (unknown.length > 0) refuse(`Unknown argument(s): ${unknown.join(" ")}.`);
if (!before || !/^\d{4}-\d{2}-\d{2}$/.test(before) || Number.isNaN(Date.parse(`${before}T00:00:00Z`))) refuse("--before=YYYY-MM-DD is required.");
if (Date.parse(`${before}T00:00:00Z`) > Date.now()) refuse("--before must not be in the future.");

nextEnv.loadEnvConfig(process.cwd());
const { DIRECT_URL } = process.env;
if (!DIRECT_URL) refuse("DIRECT_URL is not set.", 1);

const target = new URL(DIRECT_URL);
console.log(`Database: ${target.hostname}${target.port ? `:${target.port}` : ""}${target.pathname}`);
console.log(`Website:  ${DOMAIN} (${WEBSITE_ID})`);
console.log(`Drafts:   created before ${before} 00:00 UTC`);
console.log(`Mode:     ${APPLY ? "APPLY" : "dry run (add --apply --confirm-host=<host> --backup=<file> to delete)"}\n`);

if (APPLY && confirmHost !== target.hostname) refuse(`--apply needs --confirm-host=${target.hostname} (the host above).`);
if (APPLY && !backupPath) refuse("--apply needs --backup=<a new file> for the rows it deletes.");
if (APPLY && existsSync(backupPath)) refuse(`The backup file already exists: ${backupPath}.`);

const sql = postgres(DIRECT_URL, { connect_timeout: 30, max: 1 });
const queryOn = (executor) => async (text, params) => [...(await executor.unsafe(text, params))];
const scope = { websiteId: WEBSITE_ID, before: `${before}T00:00:00Z` };

function report(rows, heading) {
  const kept = keptCounts(rows);
  console.log(`${heading}: ${rows.length} drafts in scope, ${rows.filter((row) => row.keep === null).length} to delete, ${rows.filter((row) => row.keep !== null).length} kept.`);
  if (kept.length > 0) console.table(kept);
}

let exitCode = 0;
let committed = false;
try {
  const [site] = await sql`select domain from websites where id = ${WEBSITE_ID}`;
  if (!site) throw new Error("the website does not exist in this database");
  if (site.domain.replace(/^www\./, "").toLowerCase() !== DOMAIN) throw new Error(`the website is ${site.domain}, not ${DOMAIN}`);

  const rows = await surveyDrafts(queryOn(sql), scope);
  report(rows, "Now");
  const doomed = rows.filter((row) => row.keep === null);
  console.table(doomed.slice(0, 20).map((row) => ({ id: row.id, created: new Date(row.created_at).toISOString().slice(0, 10), title: String(row.title).slice(0, 70) })));
  if (doomed.length > 20) console.log(`... and ${doomed.length - 20} more.`);

  if (!APPLY) {
    console.log("\nDry run: nothing was changed.");
  } else if (doomed.length === 0) {
    console.log("\nNothing to delete.");
  } else {
    const result = await sql.begin((tx) =>
      deleteDrafts(queryOn(tx), {
        ...scope,
        actor: "ops script (delete-imagestudio-drafts-2026-11-24)",
        note: NOTE,
        backup: async (data) => {
          // "wx": never over an existing file. Flushed to disk before the first delete.
          const file = await open(backupPath, "wx");
          try {
            await file.writeFile(JSON.stringify({ website: DOMAIN, websiteId: WEBSITE_ID, before, at: new Date().toISOString(), ...data }, null, 1));
            await file.sync();
          } finally {
            await file.close();
          }
          console.log(`Backup written: ${backupPath} (${data.articles.length} articles, ${data.article_versions.length} versions, ${data.placements.length} links, ${data.calendar_items.length} topics)`);
        },
      }),
    );
    committed = true;
    console.log(`\nDeleted ${result.deleted} drafts; ${result.topics} calendar topics marked skipped.`);
    report(await surveyDrafts(queryOn(sql), scope), "After");
  }
} catch (error) {
  console.error(`\nFailed, ${committed ? "but the deletion above is done" : "nothing was changed"}: ${error instanceof Error ? error.message : error}`);
  exitCode = 1;
} finally {
  await sql.end();
}
process.exit(exitCode);
