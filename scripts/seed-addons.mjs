/**
 * Seeds the add-ons table. Idempotent - upserts on slug, so it is safe to
 * re-run and will be needed again for the production database.
 *
 *   npm run db:seed-addons
 *
 * THE CREDIT PACK PRICES ARE THE CLIENT'S, taken from the pricing screen he
 * sent: 79 / 149 / 299 EUR for 10 / 25 / 50 credits. They were placeholders
 * at 19 / 39 / 69 until then.
 *
 * The two service add-ons below are still guide figures - the brief shows
 * their prices only in a screenshot.
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
    name: "10 link credits",
    description: "Request ten more backlinks from the network.",
    priceCents: 7900,
    creditsGranted: 10,
    kind: "credits",
    sortOrder: 1,
  },
  {
    slug: "credits_25",
    name: "25 link credits",
    description: "Request twenty-five more backlinks. Better value per credit.",
    priceCents: 14900,
    creditsGranted: 25,
    kind: "credits",
    sortOrder: 2,
  },
  {
    slug: "credits_50",
    name: "50 link credits",
    description: "Request fifty more backlinks. Best value per credit.",
    priceCents: 29900,
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
    creditsGranted: 0,
    kind: "quote",
    sortOrder: 20,
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

// A quoted service has no Stripe price on purpose, so it is not "missing" one.
const missing = rows.filter((r) => !r.stripe_price_id && r.kind !== "quote");
console.log(
  missing.length === 0
    ? "\nAll add-ons have a Stripe price."
    : `\n${missing.length} add-on(s) need \`npm run stripe:setup\` to create a price.`,
);

await sql.end();
