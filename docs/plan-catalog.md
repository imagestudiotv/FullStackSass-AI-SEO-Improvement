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
- **Coupons:** a coupon limited to certain products does not apply to a new one. Check that the 40% REPGET code and partner coupons cover Launch.

## The REPGET code

The owner's decision (2026-11-05): 40% off the first paid month, starting with the paid plan purchase, not with signup or the free period. Annual handling is still open, so no discount reaches a full annual payment. Stripe's local-currency behaviour stays as it is.

The discount is three fixed-amount coupons, limited by product, one per plan: `LAUNCH40` €39.60, `GROW40` €59.60, `SCALE40` €139.60, each `once`. A Stripe promotion code points at one coupon and must be unique while active, so **REPGET is not a Stripe promotion code**. The customer gives it to RepGet on a plan screen, and the server picks the coupon (`lib/billing/repget-offer.ts`). Off until `REPGET_OFFER_ENABLED=1`.

| Customer | What happens |
|---|---|
| With or without a free period | The plan's coupon is on the Checkout. Stripe keeps a `once` coupon through a free period, and uses it on the first paid invoice, including when the period is ended early (checked in Stripe's test mode, in euros) |
| Plan changed during the free period | Each coupon is limited to its plan's product, so the coupon follows the plan on `customer.subscription.updated` (`lib/billing/repget-subscription.ts`). Moved to annual: it comes off |
| Annual plan, or a price other than the coupon's | Refused before Stripe. The coupons' product limit does **not** exclude annual, because the prices share a product: Stripe takes the fixed amount off |
| Credit packs | Never come here, and Stripe refuses the coupons on them |
| Any other promotion code | Stripe's code box as before, partner coupons included. The box is off only on a REPGET checkout, so a second code cannot replace it |

**If Stripe refuses a coupon at Checkout,** nothing starts and there is no checkout at full price: the customer is told, and the administrators (`ADMIN_EMAILS`) get an email.

Before turning it on: **no active Stripe promotion code may be called REPGET.** One typed into Stripe's box would bypass all of this, on annual too.

One redemption per workspace, counted from completed checkouts. PayPal has no way to take it.

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
