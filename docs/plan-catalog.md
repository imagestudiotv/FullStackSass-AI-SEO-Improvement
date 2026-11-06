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

## The REPGET code and annual plans

The owner's decision (2026-11-05): 40% for one month, starting with the paid plan purchase, not with signup or the free period. Annual handling is still open, so 40% must not reach a full annual payment without confirmation. Stripe's local-currency behaviour stays as it is. None of this activates the coupon, and no code here creates one.

Stripe counts a coupon's "1 month" from when it is first applied, and a code typed at Checkout is applied at once, during the free period. `STRIPE_PAID_START_COUPON=<coupon id>` moves that (`lib/billing/paid-start-coupon.ts`): the coupon is taken off during the free period and put back before the first paid invoice, three days before the period runs out, or in the update that ends it early. Monthly plans only. It needs `customer.subscription.trial_will_end` on the webhook endpoint, and that event must be added before the setting is turned on. Unset, nothing changes.

Monthly and annual prices share a Stripe product, so a coupon cannot be limited to monthly by product. `STRIPE_PROMO_CODES_MONTHLY_ONLY=1` does it in the app, in `lib/stripe/actions.ts`:

- An annual subscription checkout has no code box (`allow_promotion_codes: false`). A monthly one is unchanged.
- A subscription carrying a discount cannot move to an annual price through **Change plan**. Otherwise a discount not yet used on a trial would land on the full annual payment.

Unset, both behave as before. What it does not cover:

- **Every code is affected, not only REPGET.** With it on, partner coupons also cannot be entered on an annual checkout (`docs/partner-program.md`).
- **Credit packs** still accept codes (`lib/addons/actions.ts`). Limit the coupon to the plans' product in Stripe.
- **PayPal** has no code field.
- **The customer portal's** own plan-switching settings live in Stripe's dashboard.
- **A checkout already open** when it is turned on keeps its code box until it expires, since an open checkout is reused rather than made again.

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
