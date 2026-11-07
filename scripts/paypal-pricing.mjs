/**
 * PayPal plan prices: a read-only report, and a deliberate one-plan reprice
 * (review P2).
 *
 * WHAT A REPRICE DOES. PayPal's update-pricing-schemes changes a plan's price
 * for its EXISTING subscribers as well as new ones; only payments within 10
 * days of the change keep the old price (PayPal API reference, "fixed_price").
 * RepGet's rule is that existing subscribers keep their price
 * (docs/plan-catalog.md): a new line-up is new plan rows and new PayPal plans
 * (scripts/paypal-setup.mjs), and THIS is not the way to change prices for new
 * customers. Use it only when the owner has decided that the subscribers on
 * one PayPal plan move to a new price, has told them as PayPal and the law
 * require, and has approved this exact step.
 *
 *   node scripts/paypal-pricing.mjs
 *       Report only. For every PayPal plan id RepGet knows (current and
 *       retired, paypal_plan_versions), PayPal's price now, RepGet's row
 *       price, and how many subscriptions are on that PayPal plan. Writes
 *       nothing anywhere.
 *
 *   node scripts/paypal-pricing.mjs --reprice P-XXXX --price 15900
 *       Dry run of one reprice: shows the cycle, the old and new amount and
 *       the subscribers affected. Writes nothing.
 *
 *   node scripts/paypal-pricing.mjs --reprice P-XXXX --price 15900 --apply --confirm P-XXXX
 *       Sends it. Live also needs PAYPAL_ENV=live and --live. Records the
 *       time on paypal_plan_versions.pricing_updated_at; nothing else in the
 *       database changes (the plan row's own price is the catalog's, and a
 *       row repriced in place would hand its limits to a different price).
 *
 * Refuses: an id recorded under the other PayPal mode, an id RepGet does not
 * know, a non-integer or non-positive price, a SANDBOX write to a database
 * not on this machine (unless --remote-database), and --apply without the
 * matching --confirm.
 */
import nextEnv from "@next/env";
import postgres from "postgres";

nextEnv.loadEnvConfig(process.cwd());

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(name);
const option = (name) => {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
};

const ENV = process.env.PAYPAL_ENV || "sandbox";
if (ENV !== "live" && ENV !== "sandbox") {
  console.error(`PAYPAL_ENV is "${ENV}"; it must be "live" or "sandbox".`);
  process.exit(1);
}
const LIVE = ENV === "live";
if (LIVE && !flag("--live")) {
  console.error("Refusing to talk to LIVE PayPal without --live.");
  process.exit(1);
}
const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, DIRECT_URL } = process.env;
if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET || !DIRECT_URL) {
  console.error("PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET and DIRECT_URL must be set.");
  process.exit(1);
}

const target = option("--reprice");
const priceText = option("--price");
const APPLY = flag("--apply");
if (target && (!priceText || !/^\d+$/.test(priceText) || Number(priceText) <= 0)) {
  console.error("--price must be a whole number of cents greater than zero, e.g. --price 15900 for 159.00.");
  process.exit(1);
}
if (APPLY && (!target || option("--confirm") !== target)) {
  console.error("--apply needs --reprice <id> and --confirm with the SAME id.");
  process.exit(1);
}

const host = (() => {
  try {
    return new URL(DIRECT_URL).hostname;
  } catch {
    return "";
  }
})();
const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);
console.log(`Mode: ${LIVE ? "LIVE" : "SANDBOX"}   Database host: ${host || "(unreadable)"}   ${APPLY ? "APPLY" : "dry run"}\n`);
if (APPLY && !LIVE && !local && !flag("--remote-database")) {
  console.error("Refusing a SANDBOX reprice recorded in a database not on this machine (add --remote-database if it really is a sandbox database).");
  process.exit(1);
}

const BASE = LIVE ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
async function token() {
  const response = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    console.error("PayPal rejected the credentials.");
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
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(body?.message ?? `PayPal returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

const sql = postgres(DIRECT_URL, { connect_timeout: 30, max: 1 });
const [{ exists }] = await sql`select to_regclass('public.paypal_plan_versions') is not null as exists`;
if (!exists) {
  console.error("paypal_plan_versions does not exist in this database (migration pending). Nothing done.");
  await sql.end();
  process.exit(1);
}

const known = await sql`
  select v.paypal_plan_id, v.kind, v.environment, v.retired_at, v.pricing_updated_at, v.price_cents as created_cents,
         p.name, p.tier, p.interval, p.currency, p.price_cents as row_cents, p.catalog_version, p.is_active,
         (select count(*)::int from subscriptions s
            join billing_checkouts c on c.provider_subscription_id = s.paypal_subscription_id
           where s.provider = 'paypal' and s.status in ('active', 'trialing', 'past_due')
             and c.request_params ->> 'plan' = v.paypal_plan_id) as subscribers
  from paypal_plan_versions v join plans p on p.id = v.plan_id
  where v.environment is null or v.environment = ${ENV}
  order by p.catalog_version, p.tier, p.interval, v.kind, v.created_at`;

/** The REGULAR cycle of a PayPal plan, and its price in cents. */
function regularCycle(plan) {
  const cycle = (plan.billing_cycles ?? []).find((c) => c.tenure_type === "REGULAR");
  const value = cycle?.pricing_scheme?.fixed_price?.value;
  return cycle ? { sequence: cycle.sequence, cents: value === undefined ? null : Math.round(Number(value) * 100), currency: cycle.pricing_scheme?.fixed_price?.currency_code } : null;
}

if (!target) {
  const report = [];
  for (const row of known) {
    let paypal = "unreadable";
    try {
      const plan = await api(`/v1/billing/plans/${encodeURIComponent(row.paypal_plan_id)}`);
      const regular = regularCycle(plan);
      paypal = regular?.cents == null ? `${plan.status}, no fixed price` : `${(regular.cents / 100).toFixed(2)} ${regular.currency} (${plan.status})`;
    } catch (error) {
      paypal = error.status === 404 ? "not found in this mode" : `error: ${error.message}`;
    }
    report.push({
      plan: `${row.name} v${row.catalog_version}${row.is_active ? "" : " (off sale)"}`,
      kind: row.kind,
      paypalPlanId: row.paypal_plan_id,
      repget: `${(row.row_cents / 100).toFixed(2)} ${row.currency.toUpperCase()}`,
      paypal,
      subscribers: row.subscribers,
      retired: row.retired_at ? "yes" : "",
    });
  }
  console.table(report);
  console.log("\nReport only. Subscribers are counted from the checkouts that created them (billing_checkouts.request_params.plan).");
  await sql.end();
  process.exit(0);
}

const row = known.find((r) => r.paypal_plan_id === target);
if (!row) {
  console.error(`${target} is not a PayPal plan RepGet knows in ${ENV} mode. Nothing done.`);
  await sql.end();
  process.exit(1);
}
const plan = await api(`/v1/billing/plans/${encodeURIComponent(target)}`);
const regular = regularCycle(plan);
if (!regular || regular.cents == null) {
  console.error(`${target} has no fixed-price REGULAR cycle. Nothing done.`);
  await sql.end();
  process.exit(1);
}
const newCents = Number(priceText);
console.log(`${row.name} v${row.catalog_version} (${row.kind}) ${target}`);
console.log(`  REGULAR cycle ${regular.sequence}: ${(regular.cents / 100).toFixed(2)} -> ${(newCents / 100).toFixed(2)} ${regular.currency}`);
console.log(`  RepGet's row price: ${(row.row_cents / 100).toFixed(2)} ${row.currency.toUpperCase()} (unchanged by this)`);
console.log(`  Subscriptions on this PayPal plan now: ${row.subscribers}. PayPal applies the new price to them too,`);
console.log("  except payments within 10 days of the change.\n");

if (!APPLY) {
  console.log("Dry run. To send it: add --apply --confirm " + target);
  await sql.end();
  process.exit(0);
}

await api(`/v1/billing/plans/${encodeURIComponent(target)}/update-pricing-schemes`, {
  method: "POST",
  body: JSON.stringify({
    pricing_schemes: [
      { billing_cycle_sequence: regular.sequence, pricing_scheme: { fixed_price: { value: (newCents / 100).toFixed(2), currency_code: regular.currency } } },
    ],
  }),
});
await sql`update paypal_plan_versions set pricing_updated_at = now(), updated_at = now() where paypal_plan_id = ${target}`;
const after = regularCycle(await api(`/v1/billing/plans/${encodeURIComponent(target)}`));
console.log(`Sent. PayPal now reports ${after?.cents == null ? "no fixed price" : `${(after.cents / 100).toFixed(2)} ${after.currency}`} for cycle ${regular.sequence}.`);
await sql.end();
