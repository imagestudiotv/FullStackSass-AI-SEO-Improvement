/**
 * Removes competitor domains that do not exist.
 *
 * Suggested competitors are the one extracted field the model infers rather
 * than reads, and it invented several: in one real account 7 of 20 did not
 * resolve, four with no DNS record at all. The customer clicked them and got
 * a browser error.
 *
 * analyze-website now verifies before storing, so new rows are clean. This
 * clears what was written before that check existed.
 *
 *   node scripts/prune-competitors.mjs            # dry run, writes nothing
 *   node scripts/prune-competitors.mjs --apply
 *
 * MANUAL ENTRIES ARE NEVER TOUCHED. If a customer typed a domain we cannot
 * reach, that is their judgement about their own market — perhaps an intranet,
 * perhaps a site that is down today. Deleting it would be us overruling them.
 */
import nextEnv from "@next/env";
import postgres from "postgres";
import { lookup } from "node:dns/promises";

nextEnv.loadEnvConfig(process.cwd());
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

const APPLY = process.argv.includes("--apply");
const TIMEOUT_MS = 6000;
const ALIVE_STATUSES = new Set([401, 403, 405, 429]);

/** Mirrors lib/websites/verify-domain.ts; see that file for the reasoning. */
async function verify(domain) {
  try {
    await lookup(domain);
  } catch {
    return { alive: false, reason: "no DNS record" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://${domain}`, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; RepGetBot/1.0; +https://repget.com/bot)",
      },
    });
    if (res.ok || ALIVE_STATUSES.has(res.status)) {
      return { alive: true, reason: `http ${res.status}` };
    }
    return { alive: false, reason: `http ${res.status}` };
  } catch {
    // Registered but unreachable from here: kept, as in the app.
    return { alive: true, reason: "registered, no response" };
  } finally {
    clearTimeout(timer);
  }
}

const rows = await sql`
  select c.id, c.domain, w.domain as site
  from competitors c
  join websites w on w.id = c.website_id
  where c.source <> 'manual'
`;
console.log(`checking ${rows.length} suggested competitor(s)…\n`);

const dead = [];
// Batched: a few hundred parallel DNS lookups exhausts the resolver.
const BATCH = 10;
for (let i = 0; i < rows.length; i += BATCH) {
  const slice = rows.slice(i, i + BATCH);
  const checks = await Promise.all(slice.map((r) => verify(r.domain)));
  slice.forEach((row, j) => {
    const check = checks[j];
    if (!check.alive) {
      dead.push(row);
      console.log(
        `  DEAD  ${row.domain.padEnd(34)} ${check.reason}  (${row.site})`,
      );
    }
  });
}

console.log(`\n${dead.length} of ${rows.length} unusable.`);

if (!APPLY) {
  console.log("dry run — pass --apply to delete them");
} else if (dead.length > 0) {
  await sql`delete from competitors where id = any(${dead.map((d) => d.id)})`;
  console.log(`deleted ${dead.length}.`);
}

await sql.end();
