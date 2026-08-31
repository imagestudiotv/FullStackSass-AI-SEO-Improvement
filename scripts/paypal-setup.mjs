/**
 * Creates PayPal products and plans from the seeded plans, then writes each
 * plan id back to plans.paypal_plan_id.
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
 * Runs against sandbox unless PAYPAL_ENV=live.
 */
import nextEnv from "@next/env";
import postgres from "postgres";

nextEnv.loadEnvConfig(process.cwd());

const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, DIRECT_URL } = process.env;
const LIVE = process.env.PAYPAL_ENV === "live";
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
if (LIVE && process.argv[2] !== "--live") {
  console.error(
    "Refusing to run against LIVE PayPal without --live.\n" +
      "Use PAYPAL_ENV=sandbox while building.",
  );
  process.exit(1);
}

console.log(`Mode: ${LIVE ? "LIVE" : "SANDBOX"}\n`);

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
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(body?.message ?? `PayPal returned ${response.status}`);
  }
  return body;
}

const sql = postgres(DIRECT_URL, { connect_timeout: 30 });

const rows = await sql`
  select id, name, tier, interval, currency, price_cents, paypal_plan_id
  from plans where is_active = true order by sort_order, price_cents
`;

if (rows.length === 0) {
  console.error("No active plans. Run `npm run db:seed` first.");
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

  // A stored plan that still resolves is left alone.
  if (plan.paypal_plan_id) {
    try {
      const existing = await api(`/v1/billing/plans/${plan.paypal_plan_id}`);
      if (existing.status === "ACTIVE") {
        console.log(`  plan unchanged: ${existing.id}\n`);
        continue;
      }
    } catch {
      console.log("  stored plan id not found in this mode - recreating");
    }
  }

  const product = await productFor(plan.tier, plan.name);

  const created = await api("/v1/billing/plans", {
    method: "POST",
    body: JSON.stringify({
      product_id: product.id,
      name: plan.name,
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: {
            interval_unit: plan.interval === "year" ? "YEAR" : "MONTH",
            interval_count: 1,
          },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: {
              value: (plan.price_cents / 100).toFixed(2),
              currency_code: plan.currency.toUpperCase(),
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: "CANCEL",
        payment_failure_threshold: 3,
      },
    }),
  });

  await sql`update plans set paypal_plan_id = ${created.id}, updated_at = now() where id = ${plan.id}`;
  console.log(`  plan created: ${created.id}\n`);
}

const final = await sql`
  select name, interval, currency, price_cents, paypal_plan_id
  from plans where is_active = true order by sort_order, price_cents
`;
console.table(final.map((r) => ({ ...r })));

const missing = final.filter((r) => !r.paypal_plan_id);
console.log(
  missing.length === 0
    ? "\nAll plans have a PayPal plan. PayPal checkout is ready."
    : `\n${missing.length} plan(s) still missing a PayPal plan id.`,
);

await sql.end();
