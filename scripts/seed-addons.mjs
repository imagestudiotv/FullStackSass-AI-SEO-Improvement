/**
 * Seeds the add-ons table. Idempotent - upserts on slug, so it is safe to
 * re-run and will be needed again for the production database.
 *
 *   npm run db:seed-addons
 *
 * THE CREDIT PACK PRICES ARE THE CLIENT'S, taken from the pricing screen he
 * sent: 79 / 149 / 279 EUR. They were placeholders at 19 / 39 / 69 until
 * then. The 500 pack was 299 until the client lowered it (2026-10-27): at 299
 * it cost more per credit than the 250 pack while being sold as the best
 * value. The packs held 10 / 25 / 50 credits until credits moved to ten times
 * the scale (client, 2026-10-26; drizzle/0076_credit_scale.sql) - the slugs
 * keep the old numbers because Stripe products are found by them.
 *
 * ONLY CREDIT PACKS ARE PAID BY CARD. The services are bought with credits
 * (creditPrice; client, 2026-10-26: "everything can be purchased by credits
 * now"), so they have no Stripe price; priceCents is kept as the figure
 * their credit price was set from.
 *
 * CHANGING A PRICE IS TWO STEPS. Stripe prices are IMMUTABLE: editing this
 * file and re-running it updates what the card SHOWS while checkout still
 * charges the old amount, because stripe_price_id still points at the old
 * price object. Always follow with `npm run stripe:setup`, which creates the
 * new prices and rewrites those ids.
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
   * Credit packs. Priced so a bigger pack is better value per credit, which is
   * the usual reason to buy the bigger one.
   */
  {
    slug: "credits_10",
    name: "100 credits",
    description: "One hundred credits to spend on anything in RepGet.",
    priceCents: 7900,
    creditsGranted: 100,
    kind: "credits",
    sortOrder: 1,
  },
  {
    slug: "credits_25",
    name: "250 credits",
    description: "Two hundred and fifty credits. Better value per credit.",
    priceCents: 14900,
    creditsGranted: 250,
    kind: "credits",
    sortOrder: 2,
  },
  {
    slug: "credits_50",
    name: "500 credits",
    description: "Five hundred credits. Best value per credit.",
    priceCents: 27900,
    creditsGranted: 500,
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
    creditPrice: 250,
    creditsGranted: 0,
    kind: "service",
    sortOrder: 10,
  },
  /**
   * Fixing what the audit found, quoted per site.
   *
   * kind "quote" rather than "service": the work depends entirely on what the
   * audit turned up, so there is no fixed price to sell. Billing shows a
   * "Request a quote" link instead of a Buy button, and no Stripe price is
   * created for it — an add-on with a price would let someone pay a flat fee
   * for undefined work, which we could not honour.
   *
   * priceCents is a guide figure shown as "from", not a total.
   */
  {
    slug: "audit_fix",
    name: "We fix the errors for you",
    description:
      "Your audit lists what is holding the site back. Send it to us and we will tell you what it takes to fix, quote a price, and do the work once you agree.",
    priceCents: 14900,
    // "From": the quote itself is agreed per website.
    creditPrice: 190,
    creditsGranted: 0,
    kind: "quote",
    sortOrder: 20,
  },
];

for (const addon of ADDONS) {
  await sql`
    insert into addons
      (slug, name, description, price_cents, currency, credits_granted,
       credit_price, kind, sort_order, is_active)
    values
      (${addon.slug}, ${addon.name}, ${addon.description}, ${addon.priceCents},
       ${CURRENCY}, ${addon.creditsGranted}, ${addon.creditPrice ?? null},
       ${addon.kind}, ${addon.sortOrder}, true)
    on conflict (slug) do update set
      name = excluded.name,
      description = excluded.description,
      price_cents = excluded.price_cents,
      currency = excluded.currency,
      credits_granted = excluded.credits_granted,
      credit_price = excluded.credit_price,
      kind = excluded.kind,
      sort_order = excluded.sort_order,
      is_active = true,
      updated_at = now()
  `;
  console.log(`upserted ${addon.slug}`);
}

const rows = await sql`
  select slug, name, price_cents, credits_granted, credit_price, kind, stripe_price_id
  from addons where is_active = true order by sort_order
`;
console.table(rows.map((r) => ({ ...r })));

// Only credit packs are paid by card; a service is bought with credits and has no Stripe price on purpose.
const missing = rows.filter((r) => !r.stripe_price_id && r.kind === "credits");
console.log(
  missing.length === 0
    ? "\nAll add-ons have a Stripe price."
    : `\n${missing.length} add-on(s) need \`npm run stripe:setup\` to create a price.`,
);

await sql.end();
