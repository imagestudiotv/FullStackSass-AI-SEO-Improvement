/**
 * Adds https://www.repget.com as a normal website in the workspace holding
 * imagestudio.com, without starting a second blog, publishing anything or
 * swapping links (client, 2026-11-05; docs/social-media.md, "RepGet's own
 * website"). It grants nothing and no subscription is bought: audits and social
 * tools open when the id it prints is listed in INTERNAL_TEST_WEBSITE_IDS.
 *
 *   node --env-file=<env file> --import tsx scripts/setup-repget-site.ts --workspace <organization id or slug>
 *       shows what would happen; writes nothing
 *   ... --apply
 *       does it
 *
 * Safe to run again: it finds the existing record and does not make a second
 * one. It refuses when the workspace is missing, unknown or ambiguous, when it
 * has no owner or does not hold imagestudio.com, and when the domain is already
 * in another workspace. It never picks a workspace by itself.
 *
 * Reads and writes the database in DIRECT_URL; the host is printed first.
 * What it does and why: lib/websites/own-site-setup.ts.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import type { Database } from "@/lib/db/types";
import { applyOwnSite, OWN_SITE_NETWORK, OWN_SITE_SETTINGS, OWN_SITE_TRIGGERS, planOwnSite, type OwnSitePlan } from "@/lib/websites/own-site-setup";

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

function report(plan: Exclude<OwnSitePlan, { action: "refuse" }>, applied: boolean): void {
  const line = (label: string, value: unknown) => console.log(`${label.padEnd(20)} ${String(value)}`);
  line("Workspace", `${plan.workspace.name} (${plan.workspace.id}, slug ${plan.workspace.slug})`);
  line("Owners", plan.workspace.owners.join(", "));
  line("Website", `${plan.url}  (normal validation stores it without "www.")`);
  line("Existing record", plan.websiteId && plan.action !== "create" ? plan.websiteId : applied ? "none before this run" : "none");
  if (applied && plan.action === "create") line("Created", plan.websiteId);
  console.log("");

  console.log(plan.action === "nothing" ? "Nothing to change: it is already set up." : `${applied ? "Changed" : "Would change"}:`);
  for (const change of plan.changes) console.log(`  ${change.field}: ${JSON.stringify(change.from)} -> ${JSON.stringify(change.to)}`);
  if (plan.action === "create") console.log(`  ${applied ? "Recorded" : "Would record"} the normal analysis job (website/analyze.requested): one homepage fetch, one model call.`);
  console.log("");

  console.log("Settings it keeps:");
  console.log(`  ${JSON.stringify(OWN_SITE_SETTINGS)}`);
  console.log(`  network: ${JSON.stringify(OWN_SITE_NETWORK)}`);
  console.log("");

  console.log("What a new website sets off, and what happens to this one:");
  for (const trigger of OWN_SITE_TRIGGERS) {
    console.log(`  - ${trigger.what}`);
    console.log(`    ${trigger.outcome}`);
  }
  console.log("");

  console.log("Today on this website:");
  line("  Live plan", plan.plan ? plan.plan.status : "none");
  line("  Calendar items", plan.calendarItems);
  line("  Social accounts", plan.socialAccounts);
  line("  CMS connections", plan.cmsConnections);
  console.log("");

  console.log("Next step (this script does none of it; it grants nothing, and no subscription is bought):");
  if (plan.subscriptionStatus) {
    console.log(`  - This website has a subscription (${plan.subscriptionStatus}), so INTERNAL_TEST_WEBSITE_IDS does not apply to it: it is treated as that subscription says.`);
  } else {
    const id = plan.websiteId ?? "<the website id, printed once this has run with --apply>";
    console.log("  - On the deployment, set INTERNAL_TEST_WEBSITE_IDS to include this website id, and redeploy:");
    console.log(`      INTERNAL_TEST_WEBSITE_IDS=${id}`);
    console.log("    Keep any ids already there (comma-separated). Until then audits and social tools answer");
    console.log('    "Choose a plan for this website first". It opens those two tools on this website only.');
  }
  console.log("  - Connecting social accounts is a person's choice in the dashboard. Nothing here connects or posts to one.");
}

async function main(): Promise<number> {
  const url = process.env.DIRECT_URL;
  if (!url) {
    console.error("DIRECT_URL is not set. Nothing was changed.");
    return 1;
  }
  const apply = process.argv.includes("--apply");
  const workspace = option("--workspace");
  const target = new URL(url);

  console.log(`Database: ${target.hostname}${target.port ? `:${target.port}` : ""}${target.pathname}`);
  console.log(apply ? "APPLY: this writes to that database.\n" : "DRY RUN: nothing is written. Add --apply to do it.\n");

  const client = postgres(url, { connect_timeout: 30, max: 1 });
  const db = drizzle(client) as unknown as Database;
  try {
    const plan = apply ? await applyOwnSite(db, { workspace }) : await planOwnSite(db, { workspace });
    if (plan.action === "refuse") {
      console.error(`REFUSED: ${plan.reason}`);
      return 1;
    }
    report(plan, apply);
    return 0;
  } finally {
    await client.end();
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
