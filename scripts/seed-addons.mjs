/**
 * Seeds the add-ons table. Idempotent - upserts on slug, so it is safe to
 * re-run and will be needed again for the production database.
 *
 *   npm run db:seed-addons
 *
 * PRICES ARE PLACEHOLDERS. The brief specifies the citations add-on but shows
 * its price only in a screenshot, so the numbers below are round guesses that
 * exist to make the flow work end to end. Change them here, re-run this, then
 * run `npm run stripe:setup` to create the matching Stripe prices.
 *
 * stripePriceId stays null until that setup runs. Checkout refuses an add-on
 * without one, so a half-configured add-on cannot take money.
 */
import nextEnv from "@next/env";
import postgres from "postgres";

nextEnv.loadEnvConfig(process.cwd());
const sql = postgres(process.env.DIRECT_URL, { connect_timeout: 30 });

const CURRENCY = "eur";

const ADDONS = [
  /**
   * The Starter trial.
   *
   * The brief: "I just want to add one more package here - Starter (where
   * onboardings is receiving one article and one backlink, to attrack to
   * subscribe, and later upgrade the plans)".
   *
   * A one-off payment rather than a subscription, matching the reference
   * design's "$1 /one-time" and "No subscription required". That wording is
   * the whole point of the offer: the barrier to trying is lowest when there
   * is nothing to cancel, and upgrading afterwards stays a separate, clean
   * decision rather than a change to something already running.
   *
   * kind "trial" so fulfilment grants BOTH the link credit and the article
   * allowance. The existing "credits" kind grants only credits, which would
   * have given someone a backlink and no article.
   */
  {
    slug: "starter_trial",
    name: "Starter",
    description:
      "One SEO article with images and one niche-relevant backlink. No subscription.",
    priceCents: 100,
    creditsGranted: 1,
    kind: "trial",
    sortOrder: 0,
  },
  /**
   * Credit packs. Priced so a bigger pack is better value per credit, which is
   * the usual reason to buy the bigger one.
   */
  {
    slug: "credits_10",
    name: "10 link credits",
    description: "Request ten more backlinks from the network.",
    priceCents: 1900,
    creditsGranted: 10,
    kind: "credits",
    sortOrder: 1,
  },
  {
    slug: "credits_25",
    name: "25 link credits",
    description: "Request twenty-five more backlinks. Better value per credit.",
    priceCents: 3900,
    creditsGranted: 25,
    kind: "credits",
    sortOrder: 2,
  },
  {
    slug: "credits_50",
    name: "50 link credits",
    description: "Request fifty more backlinks. Best value per credit.",
    priceCents: 6900,
    creditsGranted: 50,
    kind: "credits",
    sortOrder: 3,
  },
  /**
   * A service we deliver by hand. creditsGranted is 0 and kind is "service",
   * so the webhook records the payment and grants nothing — a manual service
   * that silently granted credits would be worse than one that grants nothing.
   */
  {
    slug: "usa_local_citations",
    name: "Top 250 live USA Local Citations",
    description:
      "We submit your business to 250 US directories and citation sites by hand, then send you the full list. Delivered within 14 days.",
    priceCents: 19900,
    creditsGranted: 0,
    kind: "service",
    sortOrder: 10,
  },
];

for (const addon of ADDONS) {
  await sql`
    insert into addons
      (slug, name, description, price_cents, currency, credits_granted,
       kind, sort_order, is_active)
    values
      (${addon.slug}, ${addon.name}, ${addon.description}, ${addon.priceCents},
       ${CURRENCY}, ${addon.creditsGranted}, ${addon.kind}, ${addon.sortOrder},
       true)
    on conflict (slug) do update set
      name = excluded.name,
      description = excluded.description,
      price_cents = excluded.price_cents,
      currency = excluded.currency,
      credits_granted = excluded.credits_granted,
      kind = excluded.kind,
      sort_order = excluded.sort_order,
      is_active = true,
      updated_at = now()
  `;
  console.log(`upserted ${addon.slug}`);
}

const rows = await sql`
  select slug, name, price_cents, credits_granted, kind, stripe_price_id
  from addons where is_active = true order by sort_order
`;
console.table(rows.map((r) => ({ ...r })));

const missing = rows.filter((r) => !r.stripe_price_id);
console.log(
  missing.length === 0
    ? "\nAll add-ons have a Stripe price."
    : `\n${missing.length} add-on(s) need \`npm run stripe:setup\` to create a price.`,
);

await sql.end();
