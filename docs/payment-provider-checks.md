# Payment provider checks (owner-run)

This is for the owner. It turns "stub-tested" into "sandbox-verified" for the payment branch `feature/payment-s1-p11`.

**Test mode and sandbox only.** Never point it at production data, and never use live credentials for anything but the read-only configuration check.

## 0. An isolated copy of the app

1. In the payment worktree, create a throwaway database on this machine's Postgres:

   ```
   createdb -h 127.0.0.1 -p 55432 -U postgres repget_pay_verify
   ```

2. Give the worktree its own `.env.local`. Copy the non-secret values from `.env.example`, then set:
   - `DATABASE_URL` and `DIRECT_URL` to `postgres://postgres:postgres@127.0.0.1:55432/repget_pay_verify`;
   - `NEXT_PUBLIC_APP_URL` to the public tunnel URL from step 3.

   Then add **your own** test and sandbox values yourself. The agent must not handle them.
   - Stripe: `STRIPE_SECRET_KEY` (`sk_test_...` only) and `STRIPE_WEBHOOK_SECRET` from `stripe listen`.
   - PayPal sandbox: `PAYPAL_ENV=sandbox`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`.
   - Partners paid through PayPal: `PARTNER_PAYPAL_PAYOUTS=automated` (or `manual`), `PARTNER_PAYPAL_FEE_BEARER=repget`, `PARTNER_PAYPAL_PAYOUT_COUNTRIES=IT`. Turn on the `partner_payouts` switch in Admin only on this copy.

3. Migrate and seed: `npx drizzle-kit migrate` (it includes `0088_blog_images_payments_partner_credits`, the canonical migration for this work). Then `npm run db:seed`, `npm run db:seed-addons`, `npm run plans:activate -- --apply --local`, and the sandbox `npm run paypal:setup` (it refuses a non-local database).

4. Public URL for webhooks. Run `cloudflared tunnel --url http://localhost:3001`, or ngrok, and start the app with `npx next dev -p 3001`.
   - **Stripe:** `stripe listen --forward-to localhost:3001/api/stripe/webhook`.
   - **PayPal sandbox:** developer.paypal.com, Sandbox, your app, Webhooks. Add `<tunnel>/api/paypal/webhook` with every event that `node scripts/payments/owner-check.mjs .env.local config` lists as expected. Put its id in `PAYPAL_WEBHOOK_ID`.

5. Sandbox accounts: one **business** (the merchant, your app's account) and one **personal** buyer, both made in developer.paypal.com under Sandbox, Accounts. For partner payouts, a second personal account receives them; use its email as the partner's PayPal address.

## 1. Configuration, read-only

```
node scripts/payments/owner-check.mjs .env.local config
```

Expected: no "MISSING" events for the test endpoint and the sandbox webhook, and the portal listing every active plan's test price.

For the **live** configuration (S6, S7, P11), run it on a file holding only the live keys, with `--live-read-only`. It makes GET requests only. Send the output: the agent cannot see live settings, and nothing is assumed from code flags.

## 2. Flows

Use the browser on the tunnel URL. After each block, run `node scripts/payments/owner-check.mjs .env.local local` and compare it with "Expect".

| # | Flow | Steps | Expect |
|---|---|---|---|
| 1 | PayPal credit pack | Billing, a pack, "Pay with PayPal", approve as the buyer | Return says received. `paypal_orders` is completed with `fulfilled_at`. One `addon_purchases` row and one credit grant. A `payments` row is a `paypal_capture` |
| 2 | Abandoned approval | Start a pack with PayPal, then "Cancel and return" | Order `voided`, nothing granted. Card checkout still possible |
| 3 | Closed tab after approving | Approve, close the tab before the return page loads | Within about 5 minutes (webhook or maintenance job): completed and granted, once |
| 4 | Get Featured with PayPal | Blog article, Get Featured, fill in, PayPal | Thanks page "paid". Admins emailed once |
| 5 | Get Featured paid twice | Open the card checkout, go back, then pay with PayPal | The card checkout is expired at Stripe before PayPal opens. If you force a double payment, admins get "Placement paid twice" |
| 6 | PayPal refund, partial then rest | Admin, Payments, the PayPal sale, refund 10.00, then all that remains | `payment_refunds` has two completed rows. The payment stays paid after the first and is refunded after the second. The referral reversal happens only after the second |
| 7 | Dashboard refund | Refund part of a sandbox sale in PayPal's own dashboard | A `provider` row in `payment_refunds`, the amount in `refunded_cents` |
| 8 | Capture refund | Refund flow 1's purchase from Admin | Refunded through the capture endpoint. Credits not taken back (Terms) |
| 9 | Free articles, Start now, abandoned | As in `docs/paypal-go-live.md` step 8 "Free articles with PayPal", plus a Start now left unapproved | Free articles shown, "Start my plan now" charges on approval only. Abandoned leaves the free articles |
| 10 | Partner commission on PayPal | A referred workspace pays with PayPal; then refund half | One fact `provider = paypal` with a commission; after the refund, `reversed_amount` = half, rounded half up |
| 11 | Partner PayPal payout | Partner Settings: PayPal address, code from the email, "Pay me with PayPal". With commissions over 30 days old (run the monthly settlement from Admin), Admin, Partner payouts, Run now | Automated: one attempt, then SUCCESS (sandbox pays at once), `transfer_confirmed` once, settlement paid. Manual: Record, then a second admin confirms |
| 12 | Repeated and out-of-order events | In the sandbox webhook's event list, "Resend" a completed capture, a refund and a payout item | Nothing changes a second time |
| 13 | Stripe partial refunds | Admin refund 10.00 of a test card payment, then the rest | As 6, through Stripe. Test card `4242 4242 4242 4242` |

**Not covered here, and why:**
- REPGET on PayPal, and PayPal upgrades: these wait for the owner's answers (report questions Q1, Q2).
- Live money: needs the owner's approval per action.
- PayPal disputes (open holds): not read by the code. A reversal counts as lost.

## 3. Send back

The terminal output of steps 1 and 2. It contains amounts and states, never keys.
