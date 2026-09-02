/**
 * Creates Stripe products and prices from the seeded plans, then writes each
 * price id back to plans.stripe_price_id.
 *
 * RUN THIS AFTER `npm run db:seed`, once STRIPE_SECRET_KEY is set.
 *
 * Idempotent, and safe to re-run:
 *  - Products are looked up by metadata.tier, so re-running reuses them.
 *  - A price whose amount, currency and interval already match is reused.
 *    Stripe prices are IMMUTABLE, so a changed amount means creating a new
 *    price and deactivating the old one - never editing in place. Existing
 *    subscribers stay on the price they signed up on, which is the intended
 *    behaviour: grandfathering, not a surprise change.
 *
 * Nothing here touches live mode by itself - that is decided entirely by
 * whether STRIPE_SECRET_KEY is sk_test_... or sk_live_...
 */
import nextEnv from "@next/env";
import postgres from "postgres";
import Stripe from "stripe";

nextEnv.loadEnvConfig(process.cwd());

const { STRIPE_SECRET_KEY, DIRECT_URL } = process.env;

if (!STRIPE_SECRET_KEY) {
  console.error(
    "STRIPE_SECRET_KEY is not set. Add it to .env.local and re-run.",
  );
  process.exit(1);
}
if (!DIRECT_URL) {
  console.error("DIRECT_URL is not set.");
  process.exit(1);
}

const live = STRIPE_SECRET_KEY.startsWith("sk_live_");
if (live && process.argv[2] !== "--live") {
  console.error(
    "Refusing to run against a LIVE key without --live.\n" +
      "Use a test key (sk_test_...) while building.",
  );
  process.exit(1);
}

console.log(`Mode: ${live ? "LIVE" : "TEST"}\n`);

// Pinned to match src/lib/stripe/client.ts.
const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2026-08-26.dahlia",
});
const sql = postgres(DIRECT_URL, { connect_timeout: 30 });

const plans = await sql`
  select id, name, tier, interval, currency, price_cents, stripe_price_id
  from plans where is_active = true order by sort_order, price_cents
`;

if (plans.length === 0) {
  console.error("No active plans. Run `npm run db:seed` first.");
  await sql.end();
  process.exit(1);
}

/** One product per tier; monthly and annual are prices UNDER that product. */
const productByTier = new Map();

async function findOrCreateProduct(tier, name) {
  if (productByTier.has(tier)) return productByTier.get(tier);

  /**
   * list() rather than search(): the search index is eventually consistent and
   * does NOT return products created moments earlier, so a re-run would create
   * a duplicate product for every tier. list() reads live data, so re-runs are
   * genuinely idempotent. Paginated because the account may hold unrelated
   * products.
   */
  let product;
  for await (const candidate of stripe.products.list({ limit: 100 })) {
    if (candidate.metadata?.tier === tier && candidate.active) {
      product = candidate;
      break;
    }
  }
  if (product) {
    console.log(`  product exists: ${product.id}`);
  } else {
    product = await stripe.products.create({
      name: name.replace(/ \(Annual\)$/, ""),
      metadata: { tier },
    });
    console.log(`  product created: ${product.id}`);
  }

  productByTier.set(tier, product);
  return product;
}

for (const plan of plans) {
  console.log(`${plan.name} (${plan.tier}/${plan.interval})`);

  const product = await findOrCreateProduct(plan.tier, plan.name);

  // Reuse the existing price when it still matches in every respect.
  if (plan.stripe_price_id) {
    try {
      const price = await stripe.prices.retrieve(plan.stripe_price_id);
      const matches =
        price.active &&
        price.unit_amount === plan.price_cents &&
        price.currency === plan.currency &&
        price.recurring?.interval === plan.interval;

      if (matches) {
        console.log(`  price unchanged: ${price.id}\n`);
        continue;
      }
      console.log(`  price changed - creating a replacement`);
      await stripe.prices.update(price.id, { active: false });
    } catch {
      console.log(`  stored price id not found in this mode - recreating`);
    }
  }

  const price = await stripe.prices.create({
    product: product.id,
    currency: plan.currency,
    unit_amount: plan.price_cents,
    recurring: { interval: plan.interval },
    metadata: { tier: plan.tier, planId: plan.id },
  });

  await sql`
    update plans set stripe_price_id = ${price.id}, updated_at = now()
    where id = ${plan.id}
  `;
  console.log(`  price created: ${price.id}\n`);
}

const final = await sql`
  select name, tier, interval, currency, price_cents, stripe_price_id
  from plans where is_active = true order by sort_order, price_cents
`;
console.table(final.map((r) => ({ ...r })));

const missing = final.filter((r) => !r.stripe_price_id);
console.log(
  missing.length === 0
    ? "\nAll plans have a Stripe price. Checkout is ready."
    : `\n${missing.length} plan(s) still missing a price id.`,
);

/* -------------------------------------------------------------------------- */
/* Add-ons                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One-off prices, not subscriptions. Same idempotency rules as plans above: a
 * price whose amount and currency still match is reused, and a changed amount
 * means a NEW price with the old one deactivated, because Stripe prices are
 * immutable. Anyone who already paid is unaffected - they bought once.
 */
const addons = await sql`
  select id, slug, name, price_cents, currency, stripe_price_id
  from addons where is_active = true order by sort_order
`;

if (addons.length > 0) console.log("\nAdd-ons\n");

for (const addon of addons) {
  console.log(`${addon.name} (${addon.slug})`);

  if (addon.stripe_price_id) {
    try {
      const price = await stripe.prices.retrieve(addon.stripe_price_id);
      const matches =
        price.active &&
        price.unit_amount === addon.price_cents &&
        price.currency === addon.currency &&
        // A one-off price has no recurring block; a subscription price does.
        !price.recurring;

      if (matches) {
        console.log(`  price unchanged: ${price.id}\n`);
        continue;
      }
      console.log(`  price changed - creating a replacement`);
      await stripe.prices.update(price.id, { active: false });
    } catch {
      console.log(`  stored price id not found in this mode - recreating`);
    }
  }

  /**
   * One product per add-on, looked up by metadata.addonSlug. list() rather
   * than search() for the same reason as plans: the search index is eventually
   * consistent and would create a duplicate product on every re-run.
   */
  let product;
  for await (const candidate of stripe.products.list({ limit: 100 })) {
    if (candidate.metadata?.addonSlug === addon.slug && candidate.active) {
      product = candidate;
      break;
    }
  }
  if (product) {
    console.log(`  product exists: ${product.id}`);
  } else {
    product = await stripe.products.create({
      name: addon.name,
      metadata: { addonSlug: addon.slug },
    });
    console.log(`  product created: ${product.id}`);
  }

  const price = await stripe.prices.create({
    product: product.id,
    currency: addon.currency,
    unit_amount: addon.price_cents,
    // No `recurring`: this is a one-time payment.
    metadata: { addonSlug: addon.slug, addonId: addon.id },
  });

  await sql`
    update addons set stripe_price_id = ${price.id}, updated_at = now()
    where id = ${addon.id}
  `;
  console.log(`  price created: ${price.id}\n`);
}

if (addons.length > 0) {
  const finalAddons = await sql`
    select slug, name, currency, price_cents, stripe_price_id
    from addons where is_active = true order by sort_order
  `;
  console.table(finalAddons.map((r) => ({ ...r })));

  const missingAddons = finalAddons.filter((r) => !r.stripe_price_id);
  console.log(
    missingAddons.length === 0
      ? "All add-ons have a Stripe price."
      : `${missingAddons.length} add-on(s) still missing a price id.`,
  );
}

await sql.end();
