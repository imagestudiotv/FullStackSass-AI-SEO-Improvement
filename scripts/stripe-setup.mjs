/**
 * Creates Stripe products and prices from the seeded plans, then writes each
 * price id back to plans.stripe_price_id.
 *
 * RUN THIS AFTER `npm run db:seed`, once STRIPE_SECRET_KEY is set. It prices
 * the current catalog (scripts/plan-catalog.mjs), before that catalog goes on
 * sale. Rows of an earlier catalog are left alone: current subscribers are
 * billed on their prices.
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

import { BUNDLE_STRIPE_COUPONS, CATALOG_VERSION, CURRENCY, REPGET_COUPON_NAME, REPGET_STRIPE_COUPONS, stripeAmountFor } from "./plan-catalog.mjs";

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
  from plans where catalog_version = ${CATALOG_VERSION} order by sort_order, price_cents
`;

if (plans.length === 0) {
  console.error("This catalog has no plans. Run `npm run db:seed` first.");
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
  // A bundle is priced at its list price, which its coupon brings down to price_cents (plan-catalog.mjs BUNDLE_STRIPE_COUPONS).
  const amount = stripeAmountFor(plan);

  // Reuse the existing price when it still matches in every respect.
  if (plan.stripe_price_id) {
    try {
      const price = await stripe.prices.retrieve(plan.stripe_price_id);
      const matches =
        price.active &&
        price.unit_amount === amount &&
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
    unit_amount: amount,
    recurring: { interval: plan.interval },
    metadata: { tier: plan.tier, planId: plan.id },
  });

  await sql`
    update plans set stripe_price_id = ${price.id}, updated_at = now()
    where id = ${plan.id}
  `;
  console.log(`  price created: ${price.id}\n`);
}

/* -------------------------------------------------------------------------- */
/* REPGET coupons                                                              */
/* -------------------------------------------------------------------------- */

/*
  The REPGET launch price's coupons (plan-catalog.mjs REPGET_STRIPE_COUPONS):
  one per tier and interval, a fixed amount off every payment (`forever`),
  limited to the tier's product - and the Grow + Visibility bundle's
  (BUNDLE_STRIPE_COUPONS: EUR 200 off its EUR 299 list price, every payment).
  A missing one is created; an existing one is NEVER changed or recreated
  (Stripe coupons cannot be edited, and subscribers keep the one they have) -
  a mismatch is only reported, for the owner to look at. Only the name, the
  one thing Stripe lets change, is brought up to date: it is what Checkout
  shows on the discount line ("REPGET (40% off)", 2026-11-12).
*/
console.log("\nREPGET coupons\n");
for (const want of [...REPGET_STRIPE_COUPONS.map((coupon) => ({ ...coupon, name: REPGET_COUPON_NAME })), ...BUNDLE_STRIPE_COUPONS]) {
  const product = productByTier.get(want.tier);
  if (!product) {
    console.log(`${want.id}: no ${want.tier} product in this run - skipped`);
    continue;
  }
  let existing = null;
  try {
    existing = await stripe.coupons.retrieve(want.id, { expand: ["applies_to"] });
  } catch (error) {
    if (error?.statusCode !== 404) throw error;
  }
  if (existing) {
    const products = existing.applies_to?.products ?? [];
    const right =
      existing.valid &&
      existing.amount_off === want.amountOffCents &&
      existing.currency === CURRENCY &&
      existing.duration === "forever" &&
      products.length === 1 &&
      products[0] === product.id;
    console.log(right ? `${want.id}: exists, as expected` : `${want.id}: EXISTS BUT DIFFERS (amount, currency, duration, product or validity) - check it in the Dashboard`);
    if (existing.name !== want.name) {
      await stripe.coupons.update(want.id, { name: want.name });
      console.log(`${want.id}: renamed "${want.name}" (shown at Checkout)`);
    }
    continue;
  }
  await stripe.coupons.create({
    id: want.id,
    name: want.name,
    amount_off: want.amountOffCents,
    currency: CURRENCY,
    duration: "forever",
    applies_to: { products: [product.id] },
  });
  console.log(`${want.id}: created, ${(want.amountOffCents / 100).toFixed(2)} ${CURRENCY.toUpperCase()} off every payment,${want.tier} product ${product.id}`);
}

/* -------------------------------------------------------------------------- */
/* Win-back coupon                                                             */
/* -------------------------------------------------------------------------- */

/*
  The win-back offer's coupon (src/lib/billing/winback-offer.ts WINBACK_COUPON):
  20% off the first payment, once, limited to the Launch, Grow and Scale
  products - never the Grow + Visibility bundle. A percentage, so one coupon
  fits every price and interval. Created when missing, NEVER changed (Stripe
  coupons cannot be edited): a mismatch is only reported. The app applies it
  only once WINBACK_OFFER_ENABLED=1.
*/
const WINBACK = { id: "WINBACK20", percentOff: 20, tiers: ["launch", "grow", "scale"] };
console.log("\nWin-back coupon\n");
const winbackProducts = WINBACK.tiers.map((tier) => productByTier.get(tier)?.id).filter(Boolean);
if (winbackProducts.length !== WINBACK.tiers.length) {
  console.log(`${WINBACK.id}: not every one of ${WINBACK.tiers.join(", ")} has a product in this run - skipped`);
} else {
  let existing = null;
  try {
    existing = await stripe.coupons.retrieve(WINBACK.id, { expand: ["applies_to"] });
  } catch (error) {
    if (error?.statusCode !== 404) throw error;
  }
  if (existing) {
    const products = [...(existing.applies_to?.products ?? [])].sort();
    const right =
      existing.valid &&
      existing.percent_off === WINBACK.percentOff &&
      existing.duration === "once" &&
      products.length === winbackProducts.length &&
      products.every((id, index) => id === [...winbackProducts].sort()[index]);
    console.log(right ? `${WINBACK.id}: exists, as expected` : `${WINBACK.id}: EXISTS BUT DIFFERS (percent, duration, products or validity) - check it in the Dashboard`);
  } else {
    await stripe.coupons.create({
      id: WINBACK.id,
      name: "Welcome back: 20% off the first payment",
      percent_off: WINBACK.percentOff,
      duration: "once",
      applies_to: { products: winbackProducts },
    });
    console.log(`${WINBACK.id}: created, ${WINBACK.percentOff}% off once, products ${winbackProducts.join(", ")}`);
  }
}

const final = await sql`
  select name, tier, interval, currency, price_cents, stripe_price_id
  from plans where catalog_version = ${CATALOG_VERSION} order by sort_order, price_cents
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
/**
 * Credit packs only. Services are bought with credits (client, 2026-10-26:
 * "everything can be purchased by credits now"; lib/addons/actions.ts
 * buyAddonWithCredits), so a Stripe price for one would only be a second,
 * unused way to pay. A quote never had one: its price depends on what we
 * find.
 */
const addons = await sql`
  select id, slug, name, price_cents, currency, stripe_price_id
  from addons where is_active = true and kind = 'credits' order by sort_order
`;

/**
 * The product name is what the checkout page shows. A pack renamed in the
 * database ("10 link credits" -> "100 credits") is renamed in Stripe too,
 * or the customer pays for one thing and is shown another.
 */
async function nameProduct(productId, name) {
  const product = await stripe.products.retrieve(productId);
  if (product.name === name) return;
  await stripe.products.update(productId, { name });
  console.log(`  product renamed: "${product.name}" -> "${name}"`);
}

if (addons.length > 0) console.log("\nAdd-ons\n");

for (const addon of addons) {
  console.log(`${addon.name} (${addon.slug})`);

  if (addon.stripe_price_id) {
    let unchanged = null;
    try {
      const price = await stripe.prices.retrieve(addon.stripe_price_id);
      const matches =
        price.active &&
        price.unit_amount === addon.price_cents &&
        price.currency === addon.currency &&
        // A one-off price has no recurring block; a subscription price does.
        !price.recurring;

      if (matches) {
        unchanged = price;
      } else {
        console.log(`  price changed - creating a replacement`);
        await stripe.prices.update(price.id, { active: false });
      }
    } catch {
      console.log(`  stored price id not found in this mode - recreating`);
    }
    if (unchanged) {
      console.log(`  price unchanged: ${unchanged.id}`);
      await nameProduct(String(unchanged.product), addon.name);
      console.log("");
      continue;
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
    await nameProduct(product.id, addon.name);
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

/* -------------------------------------------------------------------------- */
/* Portal without plan changes                                                 */
/* -------------------------------------------------------------------------- */

/*
  A subscription on the REPGET launch price opens a Customer Portal that cannot
  change its plan (lib/stripe/portal.ts): the coupon of one plan does not fit
  another, so Billing's Change plan does that. Such a configuration can only be
  made through the API. This one copies the default configuration's business
  profile and features, with plan changes off. Found again by its metadata, so a
  re-run reuses it; never changed once made. Its id goes in
  STRIPE_PORTAL_CONFIG_NO_PLAN_CHANGE; without it, those customers' portal
  opens on updating the card alone.
*/
console.log("\nPortal without plan changes\n");
const portalConfigs = await stripe.billingPortal.configurations.list({ limit: 100 });
let noPlanChange = portalConfigs.data.find((config) => config.metadata?.repget === "no_plan_change" && config.active);
if (noPlanChange) {
  console.log(`exists: ${noPlanChange.id}`);
} else {
  const base = portalConfigs.data.find((config) => config.is_default);
  if (!base) {
    console.log("No default portal configuration in this mode: save the Customer portal settings in the Dashboard once, then re-run.");
  } else {
    const { features, business_profile: profile } = base;
    noPlanChange = await stripe.billingPortal.configurations.create({
      metadata: { repget: "no_plan_change" },
      business_profile: {
        ...(profile.headline ? { headline: profile.headline } : {}),
        ...(profile.privacy_policy_url ? { privacy_policy_url: profile.privacy_policy_url } : {}),
        ...(profile.terms_of_service_url ? { terms_of_service_url: profile.terms_of_service_url } : {}),
      },
      features: {
        customer_update: features.customer_update.enabled
          ? { enabled: true, allowed_updates: features.customer_update.allowed_updates }
          : { enabled: false },
        invoice_history: { enabled: features.invoice_history.enabled },
        payment_method_update: { enabled: features.payment_method_update.enabled },
        subscription_cancel: features.subscription_cancel.enabled
          ? {
              enabled: true,
              mode: features.subscription_cancel.mode,
              proration_behavior: features.subscription_cancel.proration_behavior,
              cancellation_reason: features.subscription_cancel.cancellation_reason.enabled
                ? { enabled: true, options: features.subscription_cancel.cancellation_reason.options }
                : { enabled: false },
            }
          : { enabled: false },
        subscription_update: { enabled: false },
      },
    });
    console.log(`created: ${noPlanChange.id} (a copy of ${base.id} with plan changes off)`);
  }
}
if (noPlanChange) {
  console.log(
    process.env.STRIPE_PORTAL_CONFIG_NO_PLAN_CHANGE === noPlanChange.id
      ? "STRIPE_PORTAL_CONFIG_NO_PLAN_CHANGE already names it."
      : `Set STRIPE_PORTAL_CONFIG_NO_PLAN_CHANGE=${noPlanChange.id} in Vercel (Production).`,
  );
}

await sql.end();
