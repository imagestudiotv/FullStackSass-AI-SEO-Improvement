/**
 * Payment provider configuration: what the code expects versus what the
 * provider has (reviews S6, S7, P11). READ-ONLY: every provider call is a GET.
 * Nothing is created, changed or deleted anywhere, and no secret is printed.
 *
 * Expected events are DERIVED FROM THE HANDLERS (the `case "..."` lines in
 * src/lib/billing/stripe-events.ts, the partner program's
 * PARTNER_PLATFORM_EVENTS and src/lib/billing/paypal-events.ts), so the list
 * cannot go stale against the code that runs.
 *
 * Run it through scripts/payments/owner-check.mjs, which hands it only the
 * keys it needs from an env file and refuses live keys unless asked:
 *
 *   node scripts/payments/owner-check.mjs <env file> config
 *
 * Environment it reads (set by the wrapper): STRIPE_CHECK_KEY,
 * PAYPAL_CHECK_ENV, PAYPAL_CHECK_CLIENT_ID, PAYPAL_CHECK_SECRET.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (file) => readFileSync(path.join(root, file), "utf8");

function casesIn(file, pattern) {
  return [...source(file).matchAll(/case "([A-Za-z0-9_.\-]+)":/g)].map((m) => m[1]).filter((name) => pattern.test(name));
}

/* ------------------------------------------------------------- expected */

const stripeExpected = new Set(casesIn("src/lib/billing/stripe-events.ts", /^[a-z_]+\.[a-z_.]+$/));
// The partner program's events, from its own list.
const normalizer = source("src/lib/partners/infrastructure/stripe/event-normalizer.ts");
const platformList = /PARTNER_PLATFORM_EVENTS[^=]*=\s*\[([\s\S]*?)\]/.exec(normalizer)?.[1] ?? "";
for (const m of platformList.matchAll(/"([a-z_.]+)"/g)) stripeExpected.add(m[1]);
const paypalExpected = new Set(casesIn("src/lib/billing/paypal-events.ts", /^[A-Z_]+\.[A-Z_.\-]+$/));

function compare(label, expected, observed) {
  const missing = [...expected].filter((name) => !observed.has(name) && !observed.has("*")).sort();
  const extra = [...observed].filter((name) => !expected.has(name) && name !== "*").sort();
  console.log(`\n${label}`);
  console.log(`  expected ${expected.size}, subscribed ${observed.has("*") ? "all (*)" : observed.size}`);
  console.log(missing.length ? `  MISSING (${missing.length}):\n    ${missing.join("\n    ")}` : "  missing: none");
  if (extra.length) console.log(`  subscribed but unused (${extra.length}): ${extra.join(", ")}`);
  return missing.length;
}

let problems = 0;

/* --------------------------------------------------------------- Stripe */

const stripeKey = process.env.STRIPE_CHECK_KEY;
if (!stripeKey) {
  console.log("Stripe: no key given; skipped. Expected events:\n  " + [...stripeExpected].sort().join("\n  "));
} else {
  const mode = /^(sk|rk)_live_/.test(stripeKey) ? "LIVE (read-only)" : "TEST";
  const get = async (p) => {
    const response = await fetch(`https://api.stripe.com/v1/${p}`, { headers: { authorization: `Bearer ${stripeKey}` } });
    if (!response.ok) throw new Error(`Stripe ${p} answered ${response.status}`);
    return response.json();
  };
  console.log(`Stripe: ${mode}`);
  const endpoints = (await get("webhook_endpoints?limit=100")).data ?? [];
  if (endpoints.length === 0) {
    console.log("  No webhook endpoint.");
    problems += 1;
  }
  for (const endpoint of endpoints) {
    problems += compare(`Stripe endpoint ${endpoint.url} (${endpoint.status})`, stripeExpected, new Set(endpoint.enabled_events ?? []));
  }
  // S7: the Customer Portal must list every price "Switch to this plan" can open.
  const configs = (await get("billing_portal/configurations?limit=10&active=true")).data ?? [];
  for (const config of configs) {
    const update = config.features?.subscription_update;
    console.log(`\nStripe Customer Portal ${config.id}${config.is_default ? " (default)" : ""}`);
    console.log(`  plan switching: ${update?.enabled ? "on" : "OFF"}; proration: ${update?.proration_behavior ?? "-"}`);
    for (const product of update?.products ?? []) console.log(`  product ${product.product}: prices ${(product.prices ?? []).join(", ")}`);
    console.log("  Compare with the plans on sale: every active plan's stripe_price_id must be listed.");
  }
}

/* --------------------------------------------------------------- PayPal */

const ppId = process.env.PAYPAL_CHECK_CLIENT_ID;
const ppSecret = process.env.PAYPAL_CHECK_SECRET;
const ppEnv = process.env.PAYPAL_CHECK_ENV === "live" ? "live" : "sandbox";
if (!ppId || !ppSecret) {
  console.log("\nPayPal: no credentials given; skipped. Expected events:\n  " + [...paypalExpected].sort().join("\n  "));
} else {
  const base = ppEnv === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const token = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: { authorization: `Basic ${Buffer.from(`${ppId}:${ppSecret}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  }).then((r) => r.json());
  if (!token.access_token) {
    console.log(`\nPayPal (${ppEnv}): credentials refused.`);
    problems += 1;
  } else {
    const hooks = (await fetch(`${base}/v1/notifications/webhooks`, { headers: { authorization: `Bearer ${token.access_token}` } }).then((r) => r.json())).webhooks ?? [];
    console.log(`\nPayPal: ${ppEnv.toUpperCase()}`);
    if (hooks.length === 0) {
      console.log("  No webhook.");
      problems += 1;
    }
    for (const hook of hooks) {
      problems += compare(`PayPal webhook ${hook.url} (id ${hook.id})`, paypalExpected, new Set((hook.event_types ?? []).map((e) => e.name)));
    }
    console.log("  The deployment's PAYPAL_WEBHOOK_ID must be the id of the webhook pointing at its own /api/paypal/webhook.");
  }
}

console.log(problems ? `\n${problems} problem(s) found. Nothing was changed.` : "\nNo problems found. Nothing was changed.");
process.exit(problems ? 1 : 0);
