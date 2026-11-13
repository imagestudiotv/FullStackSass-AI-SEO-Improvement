/**
 * Replaces the PayPal TRIAL plans of the free articles (30 free days, until
 * 2026-11-13) with TRIAL_DAYS ones (scripts/paypal-plans.mjs) - the 3-day
 * free trial (client, 2026-11-13: "3-day free trial is good instead of 3 free
 * articles"). PayPal cannot change a plan's billing cycles, so each is a new
 * PayPal plan.
 *
 * Only plans.paypal_trial_plan_id and plans.paypal_trial_offer_plan_id are
 * touched - never paypal_plan_id or paypal_offer_plan_id, and never a bundle
 * (it has no trial). For each one of the current catalog:
 *  - no stored id: nothing (npm run paypal:setup makes a TRIAL_DAYS one);
 *  - its free days are already TRIAL_DAYS: nothing (so a re-run does nothing);
 *  - otherwise: a new plan with TRIAL_DAYS free, under the old plan's PayPal
 *    product, priced as the row; the row then names it, and in
 *    paypal_plan_versions the old id is kept and marked retired, the new one
 *    recorded with this mode - as scripts/paypal-setup.mjs keeps history
 *    (review P3). The old plan is NOT deactivated: its subscribers keep their
 *    30 free days and their price, and their events still map to the row
 *    (lib/billing/paypal-events.ts reads the history), as a legacy
 *    free-articles trial.
 *
 * A DRY RUN unless --apply: it reads PayPal and the database (GET and select
 * only) and prints what it would do. Prints plan ids, never credentials or the
 * database user and password.
 *
 * The same guards as scripts/paypal-setup.mjs: sandbox unless PAYPAL_ENV=live
 * (exactly "live" or "sandbox"), live also needs --live, and a sandbox run
 * refuses a database that is not on this machine unless --remote-database. A
 * stored id this mode cannot find most likely belongs to the other mode: the
 * script stops before writing anything. IT WRITES TO THE DATABASE IN
 * DIRECT_URL - from .env.local unless the shell sets another; the host is
 * printed first.
 *
 *   node scripts/paypal-trial-3day.mjs                          (sandbox, dry run)
 *   node scripts/paypal-trial-3day.mjs --apply                  (sandbox)
 *   PAYPAL_ENV=live node scripts/paypal-trial-3day.mjs --live            (live, dry run)
 *   PAYPAL_ENV=live node scripts/paypal-trial-3day.mjs --live --apply    (live)
 */
import nextEnv from "@next/env";
import postgres from "postgres";

import { CATALOG_VERSION, isBundleTier } from "./plan-catalog.mjs";
import { freeTrialDays, planBody, TRIAL_DAYS } from "./paypal-plans.mjs";

nextEnv.loadEnvConfig(process.cwd());

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, DIRECT_URL } = process.env;
const ENV = process.env.PAYPAL_ENV || "sandbox";
if (ENV !== "live" && ENV !== "sandbox") {
  console.error(`PAYPAL_ENV is "${ENV}"; it must be "live" or "sandbox".`);
  process.exit(1);
}
const LIVE = ENV === "live";
const APPLY = process.argv.includes("--apply");
const BASE = LIVE ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  console.error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set. Add them to .env.local and re-run.");
  process.exit(1);
}
if (!DIRECT_URL) {
  console.error("DIRECT_URL is not set.");
  process.exit(1);
}
if (LIVE && !process.argv.includes("--live")) {
  console.error("Refusing to run against LIVE PayPal without --live.");
  process.exit(1);
}

/** Host, port and database name - never the user or password. */
function databaseTarget(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname || ""}`;
  } catch {
    return "(DIRECT_URL could not be read as a URL)";
  }
}
function isLocalDatabase(url) {
  try {
    return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

console.log(`Mode: ${LIVE ? "LIVE" : "SANDBOX"}${APPLY ? "" : "  (DRY RUN - nothing is created or written; add --apply)"}`);
console.log(`Database: ${databaseTarget(DIRECT_URL)}  <- plan ids are written HERE${APPLY ? "" : " with --apply"}`);
console.log(`New trial plans: ${TRIAL_DAYS} free days, then the plan's price.\n`);

if (!LIVE && !isLocalDatabase(DIRECT_URL) && !process.argv.includes("--remote-database")) {
  console.error(
    "Refusing to use SANDBOX PayPal with a database that is not on this machine.\n" +
      "If this really is a sandbox/staging database, re-run with --remote-database.",
  );
  process.exit(1);
}

async function token() {
  const response = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: "Basic " + Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64"),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    console.error("PayPal rejected the credentials:", data.error_description ?? data.error ?? response.status);
    process.exit(1);
  }
  return data.access_token;
}

const ACCESS = await token();

async function api(path, init = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${ACCESS}`, "content-type": "application/json" },
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // A gateway's HTML error page: reported by status below.
  }
  if (!response.ok) {
    const error = new Error(body?.message ?? `PayPal returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

const sql = postgres(DIRECT_URL, { connect_timeout: 30 });

async function stop(message) {
  console.error(message);
  console.error("Nothing was changed.");
  await sql.end();
  process.exit(1);
}

const [{ exists: hasHistory }] = await sql`select to_regclass('public.paypal_plan_versions') is not null as exists`;
if (!hasHistory) {
  await stop(
    "paypal_plan_versions does not exist (migration pending). Without it the subscribers on the old plans\n" +
      "could no longer be matched to their plan, so the plans are not replaced.",
  );
}
const [{ count: offerColumns }] = await sql`
  select count(*)::int as count from information_schema.columns
  where table_schema = 'public' and table_name = 'plans' and column_name = 'paypal_trial_offer_plan_id'`;
const KINDS = [
  { key: "trial", column: "paypal_trial_plan_id", label: "trial plan", offer: false },
  ...(offerColumns === 1 ? [{ key: "trial_offer", column: "paypal_trial_offer_plan_id", label: "trial offer plan", offer: true }] : []),
];

const rows = await sql`
  select id, name, tier, interval, currency, price_cents, paypal_trial_plan_id${offerColumns === 1 ? sql`, paypal_trial_offer_plan_id` : sql``}
  from plans where catalog_version = ${CATALOG_VERSION} order by sort_order, price_cents
`;
if (rows.length === 0) await stop("This catalog has no plans.");

/*
  Every stored id is read from PayPal BEFORE anything is created or written.
  One this mode cannot find - most likely the other mode's - or any other
  failure stops the run: an outage is not a reason to replace plans.
*/
const work = [];
for (const plan of rows) {
  if (isBundleTier(plan.tier)) continue;
  for (const kind of KINDS) {
    const storedId = plan[kind.column];
    const name = `${plan.name} (${kind.label})`;
    if (!storedId) {
      console.log(`  ${name}: none stored - npm run paypal:setup makes a ${TRIAL_DAYS}-day one`);
      continue;
    }
    let existing;
    try {
      existing = await api(`/v1/billing/plans/${storedId}`);
    } catch (error) {
      await stop(
        error.status === 404
          ? `${name}: ${storedId} does not exist in ${LIVE ? "LIVE" : "SANDBOX"} PayPal - it most likely belongs to the other mode.\nCheck PAYPAL_ENV and the credentials.`
          : `${name}: could not read ${storedId}: ${error.message}. Try again later.`,
      );
    }
    const days = freeTrialDays(existing);
    if (days === TRIAL_DAYS) {
      console.log(`  ${name}: ${storedId} already has ${TRIAL_DAYS} free days - unchanged`);
      continue;
    }
    if (!existing.product_id) await stop(`${name}: PayPal did not return the product of ${storedId}.`);
    work.push({ plan, kind, name, oldId: storedId, oldDays: days, productId: existing.product_id });
    console.log(`  ${name}: ${storedId} has ${days ?? "?"} free days - ${APPLY ? "replacing" : "would be replaced"} by a ${TRIAL_DAYS}-day plan`);
  }
}

if (work.length === 0) {
  console.log(`\nEvery stored trial plan already has ${TRIAL_DAYS} free days. Nothing to do.`);
  await sql.end();
  process.exit(0);
}
if (!APPLY) {
  console.log(`\nDry run: ${work.length} trial plan(s) would be replaced. Re-run with --apply to create them and store their ids.`);
  await sql.end();
  process.exit(0);
}

let replaced = 0;
for (const item of work) {
  const { plan, kind, name, oldId, productId } = item;
  /*
    PayPal-Request-Id makes the create idempotent: a re-run after a crash
    between PayPal's answer and the database write gets the same plan back
    rather than a second one.
  */
  const created = await api("/v1/billing/plans", {
    method: "POST",
    headers: { "PayPal-Request-Id": `repget-trial${TRIAL_DAYS}d-${plan.id}-${kind.key}-${oldId}` },
    body: JSON.stringify(planBody(plan, productId, { trial: true, offer: kind.offer })),
  });
  if (freeTrialDays(created) !== null && freeTrialDays(created) !== TRIAL_DAYS) {
    await stop(`${name}: PayPal made ${created.id} with ${freeTrialDays(created)} free days, not ${TRIAL_DAYS}. Not stored.`);
  }

  const changed = await sql.begin(async (tx) => {
    // The old id is kept (in case it predates the history), then retired: its subscribers still send events for it.
    await tx`
      insert into paypal_plan_versions (plan_id, environment, kind, paypal_plan_id, price_cents, currency)
      values (${plan.id}, ${ENV}, ${kind.key}, ${oldId}, ${plan.price_cents}, ${plan.currency})
      on conflict (paypal_plan_id) do nothing`;
    // Only if the row still names the old id: a change made meanwhile is not overwritten.
    const updated = await tx`
      update plans set ${tx(kind.column)} = ${created.id}, updated_at = now()
      where id = ${plan.id} and ${tx(kind.column)} = ${oldId}
      returning id`;
    if (updated.length === 0) return false;
    await tx`update paypal_plan_versions set retired_at = now(), updated_at = now() where paypal_plan_id = ${oldId} and retired_at is null`;
    await tx`
      insert into paypal_plan_versions (plan_id, environment, kind, paypal_plan_id, price_cents, currency)
      values (${plan.id}, ${ENV}, ${kind.key}, ${created.id}, ${plan.price_cents}, ${plan.currency})
      on conflict (paypal_plan_id) do update
        set environment = coalesce(paypal_plan_versions.environment, excluded.environment), retired_at = null, updated_at = now()
        where paypal_plan_versions.plan_id = excluded.plan_id`;
    return true;
  });
  if (changed) {
    replaced += 1;
    console.log(`  ${name}: ${created.id} created (replaces ${oldId}, kept in history as retired)`);
  } else {
    console.warn(`  ${name}: the row no longer names ${oldId} - ${created.id} was made at PayPal but NOT stored; check the row.`);
  }
}

const final = await sql`
  select name, tier, interval, paypal_trial_plan_id${offerColumns === 1 ? sql`, paypal_trial_offer_plan_id` : sql``}
  from plans where catalog_version = ${CATALOG_VERSION} order by sort_order, price_cents
`;
console.table(final.map((row) => ({ ...row })));
console.log(`\n${replaced} of ${work.length} trial plan(s) replaced with ${TRIAL_DAYS}-day plans.`);
await sql.end();
