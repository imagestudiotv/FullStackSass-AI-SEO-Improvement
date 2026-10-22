/**
 * Creates PayPal products and plans from the seeded plans, then writes each
 * plan id back to plans.paypal_plan_id - and, for each, the same plan with
 * the free articles first to plans.paypal_trial_plan_id (2026-10-22; the
 * bodies are in scripts/paypal-plans.mjs). A database that has its plans
 * already gets only the missing free-articles plans: no --switch-mode.
 *
 * RUN THIS AFTER `npm run db:seed`, once PAYPAL_CLIENT_ID and
 * PAYPAL_CLIENT_SECRET are set. Mirrors scripts/stripe-setup.mjs.
 *
 * Idempotent and safe to re-run:
 *  - Products are matched by name, so a re-run reuses them.
 *  - A plan whose stored id still resolves at PayPal is left alone.
 *
 * PayPal plan prices are IMMUTABLE, like Stripe's. Changing a price means
 * creating a new plan and deactivating the old one; existing subscribers stay
 * on the plan they signed up to, which is the intended behaviour.
 *
 * Runs against sandbox unless PAYPAL_ENV=live (exactly "live" or "sandbox";
 * anything else stops it). Live also needs --live.
 *
 * IT WRITES TO THE DATABASE IN DIRECT_URL - from .env.local, which is
 * PRODUCTION, unless the shell sets another. The host is printed first.
 * plans.paypal_plan_id holds ONE mode's ids, so a stored id this mode cannot
 * find most likely belongs to the other mode: the script then stops before
 * writing anything, unless --switch-mode says that switching this
 * database's PayPal mode is the intention. Run with sandbox credentials
 * against production, it used to overwrite the live plan ids with sandbox
 * ones and break every PayPal checkout.
 *
 *   npm run paypal:setup                                  (sandbox)
 *   npm run paypal:setup -- --live                        (live)
 *   npm run paypal:setup -- --live --switch-mode          (sandbox ids -> live)
 */
import nextEnv from "@next/env";
import postgres from "postgres";

import { planBody } from "./paypal-plans.mjs";

nextEnv.loadEnvConfig(process.cwd());

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, DIRECT_URL } = process.env;
const ENV = process.env.PAYPAL_ENV || "sandbox";
if (ENV !== "live" && ENV !== "sandbox") {
  console.error(`PAYPAL_ENV is "${ENV}"; it must be "live" or "sandbox".`);
  process.exit(1);
}
const LIVE = ENV === "live";
const SWITCH_MODE = process.argv.includes("--switch-mode");
const BASE = LIVE
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  console.error(
    "PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set. Add them to .env.local and re-run.",
  );
  process.exit(1);
}
if (!DIRECT_URL) {
  console.error("DIRECT_URL is not set.");
  process.exit(1);
}
if (LIVE && !process.argv.includes("--live")) {
  console.error(
    "Refusing to run against LIVE PayPal without --live.\n" +
      "Use PAYPAL_ENV=sandbox while building.",
  );
  process.exit(1);
}

/** Where the plan ids will be written: host, port and database name - never the user or password. */
function databaseTarget(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname || ""}`;
  } catch {
    return "(DIRECT_URL could not be read as a URL)";
  }
}

console.log(`Mode: ${LIVE ? "LIVE" : "SANDBOX"}`);
console.log(`Database: ${databaseTarget(DIRECT_URL)}  <- plan ids are written HERE\n`);

async function token() {
  const response = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization:
        "Basic " +
        Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString(
          "base64",
        ),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    console.error("PayPal rejected the credentials:", data.error_description ?? data.error);
    process.exit(1);
  }
  return data.access_token;
}

const ACCESS = await token();

async function api(path, init = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      authorization: `Bearer ${ACCESS}`,
      "content-type": "application/json",
    },
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

const rows = await sql`
  select id, name, tier, interval, currency, price_cents, paypal_plan_id, paypal_trial_plan_id
  from plans where is_active = true order by sort_order, price_cents
`;

/*
  Two PayPal plans per RepGet plan (scripts/paypal-plans.mjs): the plan
  itself, and the same plan with the free articles first (2026-10-22).
*/
const KINDS = [
  { key: "regular", column: "paypal_plan_id", label: "plan", freeArticles: false },
  { key: "trial", column: "paypal_trial_plan_id", label: "free-articles plan", freeArticles: true },
];

if (rows.length === 0) {
  console.error("No active plans. Run `npm run db:seed` first.");
  await sql.end();
  process.exit(1);
}

/*
  Every stored id is looked up BEFORE anything is written. Not found in this
  mode most likely means it belongs to the other one; without --switch-mode
  the script stops here, so a run with the wrong credentials changes nothing.
  Any other failure stops it too: an outage is not a reason to replace ids.
*/
const storedState = new Map();
const otherMode = [];
for (const plan of rows) {
  for (const kind of KINDS) {
    const storedId = plan[kind.column];
    if (!storedId) continue;
    try {
      const existing = await api(`/v1/billing/plans/${storedId}`);
      storedState.set(`${plan.id}:${kind.key}`, existing.status === "ACTIVE" ? "active" : "inactive");
    } catch (error) {
      if (error.status === 404 || SWITCH_MODE) {
        storedState.set(`${plan.id}:${kind.key}`, "missing");
        otherMode.push({ name: `${plan.name} (${kind.label})`, id: storedId });
      } else {
        console.error(`Could not look up ${plan.name}'s PayPal ${kind.label} ${storedId}: ${error.message}`);
        console.error("Nothing was changed. Try again later.");
        await sql.end();
        process.exit(1);
      }
    }
  }
}
if (otherMode.length > 0 && !SWITCH_MODE) {
  console.error(
    `${otherMode.length} stored PayPal plan id(s) do not exist in ${LIVE ? "LIVE" : "SANDBOX"} PayPal:`,
  );
  for (const stored of otherMode) console.error(`  ${stored.name}: ${stored.id}`);
  console.error(
    `\nThey most likely belong to the other PayPal mode. Replacing them would switch the database above\n` +
      `to ${LIVE ? "LIVE" : "SANDBOX"} PayPal and break checkout for the other mode. Nothing was changed.\n` +
      "Check PAYPAL_ENV and the credentials. If switching modes IS the intention, re-run with --switch-mode.",
  );
  await sql.end();
  process.exit(1);
}

/** One product per tier; monthly and annual are plans under it. */
const existingProducts = (await api("/v1/catalogs/products?page_size=100")).products ?? [];
const productByTier = new Map();

async function productFor(tier, displayName) {
  if (productByTier.has(tier)) return productByTier.get(tier);

  const name = displayName.replace(/ \(Annual\)$/, "");
  let product = existingProducts.find((p) => p.name === name);

  if (product) {
    console.log(`  product exists: ${product.id}`);
  } else {
    product = await api("/v1/catalogs/products", {
      method: "POST",
      body: JSON.stringify({
        name,
        description: `${name} plan for AI SEO Platform`,
        type: "SERVICE",
        category: "SOFTWARE",
      }),
    });
    console.log(`  product created: ${product.id}`);
  }

  productByTier.set(tier, product);
  return product;
}

for (const plan of rows) {
  console.log(`${plan.name} (${plan.tier}/${plan.interval})`);

  for (const kind of KINDS) {
    // A stored plan that still resolves is left alone.
    const stored = storedState.get(`${plan.id}:${kind.key}`);
    if (stored === "active") {
      console.log(`  ${kind.label} unchanged: ${plan[kind.column]}`);
      continue;
    }
    if (stored === "missing") {
      console.log(`  stored ${kind.label} id not found in this mode - recreating (--switch-mode)`);
    } else if (stored === "inactive") {
      console.log(`  stored ${kind.label} is not active - recreating`);
    }

    const product = await productFor(plan.tier, plan.name);
    const created = await api("/v1/billing/plans", {
      method: "POST",
      body: JSON.stringify(planBody(plan, product.id, { freeArticles: kind.freeArticles })),
    });

    if (kind.key === "trial") {
      await sql`update plans set paypal_trial_plan_id = ${created.id}, updated_at = now() where id = ${plan.id}`;
    } else {
      await sql`update plans set paypal_plan_id = ${created.id}, updated_at = now() where id = ${plan.id}`;
    }
    console.log(`  ${kind.label} created: ${created.id}`);
  }
  console.log("");
}

const final = await sql`
  select name, interval, currency, price_cents, paypal_plan_id, paypal_trial_plan_id
  from plans where is_active = true order by sort_order, price_cents
`;
console.table(final.map((r) => ({ ...r })));

const missing = final.filter((r) => !r.paypal_plan_id || !r.paypal_trial_plan_id);
console.log(
  missing.length === 0
    ? "\nAll plans have a PayPal plan and a free-articles plan. PayPal checkout is ready."
    : `\n${missing.length} plan(s) still missing a PayPal plan or free-articles plan id.`,
);

await sql.end();
