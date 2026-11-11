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

## The REPGET offer

The owner's decisions: 40% off the first paid payment, starting with the paid plan purchase, not with signup or the free period (2026-11-05); and, with the pricing page of 2026-11-11, **applied automatically** at checkout on Launch, Grow and Scale, together with the free trial, monthly and yearly. Nobody types a code. Off until `REPGET_OFFER_ENABLED=1`.

Six fixed-amount coupons, each `once` and limited to its tier's product (`lib/billing/repget-offer.ts`, `scripts/plan-catalog.mjs` REPGET_STRIPE_COUPONS):

| Plan | Monthly coupon | First month | Yearly coupon | First year |
|---|---|---|---|---|
| Launch | `LAUNCH40` EUR 39.60 | EUR 59.40 | `LAUNCH40Y` EUR 400 | EUR 590 |
| Grow | `GROW40` EUR 59.60 | EUR 89.40 | `GROW40Y` EUR 600 | EUR 890 |
| Scale | `SCALE40` EUR 139.60 | EUR 209.40 | `SCALE40Y` EUR 1,400 | EUR 2,090 |

The pricing page shows the monthly offer rounded down to the euro (EUR 59 / 89 / 209), as the client's design does, so the first monthly charge is 40 cents more than shown. The yearly figures are exact. `npm run stripe:setup` creates any of the six that is missing and never changes one that exists.

Monthly and yearly prices share a product, so the product limit does not separate them: the server picks the coupon by interval. **REPGET is not a Stripe promotion code**, and none may be called REPGET: one typed into Stripe's box would bypass all of this.

| Customer | What happens |
|---|---|
| With or without a free period | The plan's coupon is on the Checkout. Stripe keeps a `once` coupon through a free period and uses it on the first paid invoice, including when the period is ended early |
| Plan changed with the discount unused | **Change plan** in Billing carries the new price's coupon (monthly or yearly) in the same Stripe request; a refused coupon stops the change. The portal opened from Billing offers no plan change meanwhile. A change made elsewhere, in Stripe's dashboard, is corrected during the free period by `customer.subscription.updated`; once charged, staff are told (`lib/billing/repget-subscription.ts`) |
| A price other than the coupon's (an older catalogue's) | No discount |
| The account already used it | Checkout goes at the full price, with Stripe's code box for other codes; the plan screens do not mention REPGET |
| Credit packs, Grow + Visibility | Never come here |
| A checkout carrying REPGET | Stripe's code box is off on it, so a partner code cannot be added on top |

**If Stripe refuses a coupon at Checkout,** nothing starts and there is no checkout at full price: the customer is told, and the administrators (`ADMIN_EMAILS`) get an email.

One redemption per user account, across every workspace it owns, decided under a lock when the checkout is made (`beginCheckout`). A completed checkout used it, an open or unknown one holds it (a second checkout elsewhere in the account is refused until that one is settled), and an expired or failed one gives it back.

**PayPal:** the plan's REPGET offer plan, whose one intro cycle is priced per subscription (regular price less the coupon amount: EUR 59.40 a month, or EUR 590 / 890 / 2,090 for the first year). The annual rows' offer plans made by `paypal:setup` serve the yearly offer as they are; no new PayPal plan is needed. A plan without its offer plans gives the discount by card only.

## Grow + Visibility (2026-11-11)

A direct purchase: EUR 99 a month (struck EUR 299 on the page), the Grow allowances, no free trial, no free articles, no REPGET. The visibility perks (blog feature, social channels, email spotlight) are delivered by the team by hand: buyers show as "Grow + Visibility" in Admin -> Users / Organizations. Its row is `BUNDLES` in `scripts/plan-catalog.mjs`, monthly only, kept out of the standard plan grids and of Billing's plan list (except for the website on it).

On a database already selling catalog 2, with the usual backup first:

1. `npm run db:seed`: writes the bundle row, inactive (and raises Grow's search terms to 500, as the page says).
2. `npm run stripe:setup -- --live`: creates the "Grow + Visibility" product and its EUR 99 monthly price, and the three yearly REPGET coupons.
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
