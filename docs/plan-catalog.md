# Plan catalog

The plans on sale are written once, in `scripts/plan-catalog.mjs`. `npm run db:seed` puts them in the `plans` table, and the homepage, `/pricing`, onboarding, billing, checkout and the allowances all read that table.

A plan row is never repriced. A subscription's limits come from its plan row and its charge from the price id on that row, so editing a row would give every subscriber on it the new limits at their old price and show them a price they do not pay. A new line-up is a new `catalog_version` instead, written beside the old rows.

## Moving to catalog 2 (Launch €99, Grow €149, Scale €349)

Nothing here charges anyone. Steps 1-4 change nothing a visitor or subscriber can see. Run them with `DIRECT_URL` pointing at production, after the usual backup and rehearsal.

1. `npx drizzle-kit migrate`: adds `catalog_version` (1 for every existing row) and `social_post_limit` (0 for them).
2. `npm run db:seed`: writes the new rows, inactive.
3. `npm run stripe:setup -- --live`: needs the live key. Creates the new prices under the existing Grow and Scale products, and a Launch product if none is active. It does not touch the prices current subscribers are on. Without the live key, create the six prices in the Stripe Dashboard and write their ids to `plans.stripe_price_id` on the catalog 2 rows.
4. `PAYPAL_ENV=live npm run paypal:setup -- --live`: the same for PayPal. Optional: a plan with no PayPal id is sold by card only.
5. `npm run plans:activate`: a dry run. Shows who stays on the plans leaving sale, and refuses if a price is missing.
6. `npm run plans:activate -- --apply`, then merge straight away. The merge rebuilds the homepage, which is otherwise cached for up to an hour.

Until step 6 the site keeps selling catalog 1. Do not merge the code before it: the homepage reads the plans table, so it would show two plans without social posts until the switch.

## In the Stripe Dashboard

- **Customer Portal (required):** "Switch to this plan" opens the portal's update flow with the target price, and fails unless that price is in the portal's configuration. In Settings -> Billing -> Customer portal, enable "Customers can switch plans" and add all three products with their new prices. While there, check the proration setting: it decides what an upgrade charges and what a downgrade credits.
- **Coupons:** a coupon limited to certain products does not apply to a new one. Check that the REPGET coupons and partner coupons cover Launch.

## The REPGET offer: the launch price

The owner's decisions: 40% off, starting with the paid plan purchase, not with signup or the free period (2026-11-05); with the pricing page of 2026-11-11, **applied automatically** at checkout on Launch, Grow and Scale, together with the free trial, monthly and yearly; and, the same day (owner and client), a **launch price**: 40% off the regular price on **every** payment, not only the first, for every subscription started while the offer is on. Nobody types a code. Off until `REPGET_OFFER_ENABLED=1`. Nothing is built for ending it: the client changes the prices himself later.

Six fixed-amount coupons, each `forever` and limited to its tier's product (`lib/billing/repget-offer.ts`, `scripts/plan-catalog.mjs` REPGET_STRIPE_COUPONS). Each charge is exactly the price the pricing page shows:

| Plan | Monthly coupon | Each month | Yearly coupon | Each year |
|---|---|---|---|---|
| Launch | `LP40_LAUNCH_M` EUR 40 | EUR 59 (regular 99) | `LP40_LAUNCH_Y` EUR 400 | EUR 590 (regular 990) |
| Grow | `LP40_GROW_M` EUR 60 | EUR 89 (regular 149) | `LP40_GROW_Y` EUR 600 | EUR 890 (regular 1,490) |
| Scale | `LP40_SCALE_M` EUR 140 | EUR 209 (regular 349) | `LP40_SCALE_Y` EUR 1,400 | EUR 2,090 (regular 3,490) |

`npm run stripe:setup` creates any of the six that is missing and never changes one that exists. The first-payment-only coupons of before (`LAUNCH40`, `GROW40`, `SCALE40` and their `...40Y` yearly ones) are no longer used anywhere; the owner deletes them in Stripe after the deploy.

Monthly and yearly prices share a product, so the product limit does not separate them: the server picks the coupon by interval. **REPGET is not a Stripe promotion code**, and none may be called REPGET: one typed into Stripe's box would bypass all of this.

| Customer | What happens |
|---|---|
| With or without a free period | The plan's coupon is on the Checkout. The free period stays free; the discount starts with the first paid invoice and stays on every invoice after it |
| A returning customer | Gets it too: there is no limit per account while the offer is on |
| Plan changed (another tier, or monthly <-> yearly) | Keeps the launch price on the new plan, at any time: **Change plan** in Billing carries the new price's coupon in the same Stripe request; a refused coupon stops the change. A change made elsewhere, in Stripe's dashboard, is handled by `lib/billing/repget-subscription.ts` |
| A price other than the coupon's (an older catalogue's) | No discount |
| Credit packs, Grow + Visibility | Never come here |
| A checkout carrying REPGET | Stripe's code box is off on it, so a partner code cannot be added on top |

**If Stripe refuses a coupon at Checkout,** nothing starts and there is no checkout at full price: the customer is told, and the administrators (`ADMIN_EMAILS`) get an email.

The win-back offer (20% off the first payment, `WINBACK20`, docs/emails.md) applies only when REPGET does not, so in practice only while the launch price is off.

**PayPal:** the subscription's regular cycle is priced at the launch price on that subscription only (PayPal's per-subscription plan override, `lib/paypal/subscriptions.ts`), so every PayPal payment is the same EUR 59 / 89 / 209 a month or EUR 590 / 890 / 2,090 a year; a plan change through PayPal sets it again on the new plan. The PayPal plans themselves keep the regular price for everyone else.

## Grow + Visibility (2026-11-11)

A direct purchase: EUR 99 a month (struck EUR 299 on the page), the Grow allowances, no free trial, no free articles, no REPGET. The visibility perks (blog feature, social channels, email spotlight) are delivered by the team by hand: buyers show as "Grow + Visibility" in Admin -> Users / Organizations. Its row is `BUNDLES` in `scripts/plan-catalog.mjs`, monthly only, kept out of the standard plan grids and of Billing's plan list (except for the website on it).

**At Stripe (2026-11-12, the client: "We need like auto apply coupon code"):** its price is the struck-through EUR 299, and every bundle checkout carries the `forever` coupon `REPGET_GV_M` (EUR 200 off, named "REPGET (67% off)"), so Checkout shows the discount line and charges EUR 99 on every payment, with no promotion-code box. The app reads the Stripe price first: on the old EUR 99 price it adds no coupon, and at any other amount it refuses the checkout and tells staff. PayPal has no discount line; its plan stays EUR 99. The launch-price coupons are named "REPGET (40% off)", which is what Checkout shows for Launch, Grow and Scale. `stripe:setup` makes the EUR 299 price (the EUR 99 one is deactivated), creates `REPGET_GV_M` and renames the existing coupons.

On a database already selling catalog 2, with the usual backup first:

1. `npm run db:seed`: writes the bundle row, inactive (and raises Grow's search terms to 500, as the page says).
2. `npm run stripe:setup -- --live`: creates the "Grow + Visibility" product and its EUR 99 monthly price, and the six REPGET launch-price coupons (`LP40_...`).
3. `PAYPAL_ENV=live npm run paypal:setup -- --live`: its PayPal plan (only the plan itself; no free-articles or offer plans). Optional: without it the bundle is card only.
4. `npm run plans:activate`, then `npm run plans:activate -- --apply`: puts the bundle on sale. Until then the pricing page leaves its card out.

## What happens to existing subscribers

- They stay on their catalog 1 row: same price id, price and limits (a Grow subscriber keeps €99 and 30 articles a month).
- Billing names the plan they are on, and admin revenue counts the price they pay.
- Webhooks still map their price id to that row.
- They can move to any plan on sale from Billing, including the new Grow.

## Undoing it

Run this in one transaction, then redeploy to refresh the homepage:

```sql
update plans set is_active = false, updated_at = now() where catalog_version = 2;
update plans set is_active = true, updated_at = now() where catalog_version = 1 and tier in ('grow', 'scale');
```

## A local database

```
npx drizzle-kit migrate
npm run db:seed
npm run plans:activate -- --apply --local
```

`--local` skips the Stripe check, and only on a database on this machine. Checkout on those rows answers "has no Stripe price configured" until `npm run stripe:setup` runs with a test key.
