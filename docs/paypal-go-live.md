# PayPal go-live checklist

For the owner. It switches PayPal subscriptions on for real customers at https://www.repget.com.

Do the steps in order. Steps 4 and 5 change production: do them together, at a quiet hour.

What the code now does for you (2026-10-10):
- The PayPal button shows only when PayPal can finish a payment: the client id, the secret, the webhook id and a valid `PAYPAL_ENV` are all set, and the plan has a PayPal plan.
- `PAYPAL_ENV` must be exactly `live` or `sandbox`. Anything else (`Live`, `production`) switches PayPal off and logs `[paypal] PAYPAL_ENV is ...`.
- When the customer comes back from PayPal, the app asks PayPal for the subscription and records it. A late or missing webhook no longer leaves a paying customer without a plan. The 5-minute maintenance job does the same as a backup.
- When the customer clicks "Cancel and return" on PayPal, the unfinished approval is released. They can pay by card or delete the website straight away.
- A subscription that stops paying is no longer kept active. While PayPal retries a payment it shows "Payment overdue". Once PayPal suspends it, it shows "Unpaid" and the plan stops.
- Subscriptions made by other tools on the same PayPal account are ignored. They are never recorded and never cancelled.
- The setup script shows which database it writes to. It stops if the stored plan ids belong to the other PayPal mode.

## Decisions still open

1. **PayPal has no free articles.** The free articles are a card trial. PayPal charges the first month straight away. The plan step already tells the customer. Recommended: keep it this way.
2. **A PayPal cancellation ends access straight away.** The customer loses the rest of the month they paid for. Card customers keep access to the end of the period. Changing this is review item M1. Until then, say it in your support answers if asked.
3. Still open from the review: price changes do not reach PayPal (M3), plan changes through PayPal are unverified and do not charge the difference on an upgrade (M5), old PayPal plan ids are forgotten (M8), and there is no switch to pause PayPal for new customers only (L9).

## 1. Check the PayPal business account

1. It is verified and a bank account is linked.
2. It can receive EUR. Add a EUR balance, or set payments in other currencies to be accepted and converted. Otherwise payments wait as "pending - accept or deny".
3. Best: it is used only for RepGet. The app now ignores other tools' subscriptions, but a separate account keeps the reports clean.

## 2. Create the live app

1. Go to developer.paypal.com and log in **with the business account**.
2. Switch to **Live**. Open Apps & Credentials, then **Create App**. Name: "RepGet". Type: Merchant. Create.
3. Copy the **Client ID**. Under Secret key, click Show and copy the **Secret**.
4. If the app lists features, keep "Accept payments" and "Subscriptions" on. (Labels may differ slightly.)

## 3. Add the live webhook

1. In the same app (Live), open Webhooks, then **Add Webhook**.
2. URL: `https://www.repget.com/api/paypal/webhook`. Use the www address exactly. The bare domain redirects, and webhooks must not depend on a redirect.
3. Tick these 11 events:
   - `BILLING.SUBSCRIPTION.ACTIVATED`
   - `BILLING.SUBSCRIPTION.UPDATED`
   - `BILLING.SUBSCRIPTION.CANCELLED`
   - `BILLING.SUBSCRIPTION.SUSPENDED`
   - `BILLING.SUBSCRIPTION.EXPIRED`
   - `BILLING.SUBSCRIPTION.RE-ACTIVATED`
   - `BILLING.SUBSCRIPTION.PAYMENT.FAILED`
   - `PAYMENT.SALE.COMPLETED`
   - `PAYMENT.SALE.DENIED`
   - `PAYMENT.SALE.REFUNDED`
   - `PAYMENT.SALE.REVERSED`
4. Save. Copy the **Webhook ID**.

## 4. Set the Vercel variables (Production only)

1. Vercel, the project, Settings, Environment Variables. Choose **Production** only.
2. Add or update these four:
   - `PAYPAL_CLIENT_ID` = the live Client ID
   - `PAYPAL_CLIENT_SECRET` = the live Secret. Mark it **Sensitive**.
   - `PAYPAL_WEBHOOK_ID` = the live Webhook ID
   - `PAYPAL_ENV` = `live` (lower case, nothing else)
3. Check that `NEXT_PUBLIC_APP_URL` is `https://www.repget.com`.
4. Leave Preview and Development on sandbox values, or empty. Never put live credentials in `.env.local`.
5. **Do not redeploy yet.**

## 5. Write the live plan ids into production, then redeploy

This writes to the **production database**. You run it, from `platform/` in PowerShell:

```powershell
$env:PAYPAL_ENV = "live"
$env:PAYPAL_CLIENT_ID = "<live client id>"
$env:PAYPAL_CLIENT_SECRET = "<live secret>"
node scripts/paypal-setup.mjs --live
```

1. Read the first two lines. They must say `Mode: LIVE` and `Database: <production host>/<database>`. If the host is not production's, stop.
2. Production most likely still holds the sandbox plan ids. Then the first run stops with "... stored PayPal plan id(s) do not exist in LIVE PayPal ... Nothing was changed." and lists them. (If the plans had no PayPal ids, it creates them straight away; skip the next step.)
3. That is the one time switching is right. Run it again with the extra flag:

   ```powershell
   node scripts/paypal-setup.mjs --live --switch-mode
   ```

   Expected: "recreating (--switch-mode)" for each of the 4 plans, 2 products created, a table with 4 ids, then "All plans have a PayPal plan. PayPal checkout is ready." Keep the output.
4. Clear the variables from the window:

   ```powershell
   Remove-Item Env:PAYPAL_ENV, Env:PAYPAL_CLIENT_ID, Env:PAYPAL_CLIENT_SECRET
   ```

5. **Redeploy straight away.** Vercel, Deployments, the current production deployment, the "..." menu, **Redeploy**. Variable changes only reach new deployments.

Between running the script and the redeploy, a PayPal checkout fails with "PayPal could not start the subscription". No money moves.

From now on, never run the setup script with sandbox credentials against production. It now stops if you do. Only use `--switch-mode` when you really mean to change mode.

## 6. Remove the old sandbox webhook

1. developer.paypal.com, **Sandbox**, the old app, Webhooks.
2. Delete the webhook that points at `full-stack-sass-ai-seo-improvement.vercel.app`.

Production now verifies events with the live webhook id. Sandbox events would only be refused.

## 7. Look for sandbox subscriptions left in production

Read-only. Run it in the Supabase SQL editor:

```sql
select s.id, s.organization_id, s.website_id, s.status, s.paypal_subscription_id, s.created_at
from subscriptions s
where s.provider = 'paypal'
order by s.created_at;
```

Every row here is a sandbox test. One still marked `active` will never get another event, so it stays active. Decide on each one on purpose.

Old sandbox approvals in `billing_checkouts` need nothing. The maintenance job asks live PayPal about them, PayPal answers "not found", and they are marked expired.

## 8. One live test payment

There is no cheap plan. Pay one Grow monthly (EUR 99) and refund it. The cost is about PayPal's fixed fee.

1. Use a personal PayPal account that is **not** the business account. PayPal refuses payments to yourself.
2. On www.repget.com, use a test workspace and website. Billing (or onboarding), Pay with PayPal, approve.
3. Within a minute, check:
   - the RepGet billing page shows Grow, active, billed through PayPal (it should appear within seconds, even before the webhook);
   - PayPal Developer, Live, the app, Webhooks events: the deliveries show 200;
   - Admin, Payments: EUR 99.00, PayPal, paid;
   - Vercel logs: no `[paypal-webhook]` errors.
4. PayPal business account, Activity, that payment: refund it in full. The RepGet payment becomes "refunded".
5. Cancel the subscription (as the business, or as the buyer under Automatic payments). The status becomes canceled. **A refund alone does not cancel it.**
6. Check "Cancel and return": on a second test website, click Pay with PayPal, then "Cancel and return" on PayPal's page. Pay by card must now be possible for that website (you can stop at Stripe's page).
7. Delete the test websites and workspace.

## 9. The first week

Every day:
1. PayPal, Webhooks events: look for failed deliveries.
2. Vercel logs: search `[paypal-webhook]`, `[paypal]`, `[billing]`, `[checkouts]` and `[cancellations]`.
3. Admin: the past-due count.
4. Run the read-only report from `platform/`: `npm run reconcile:report`. Look at:
   - `releasedApprovalsToRefund` - see below;
   - `owedCancellations` - cancellations the app could not finish yet;
   - `duplicateLiveSubscriptions` - a website paying twice;
   - `unsettledCheckouts` - checkouts that never settled.

**Refunds you must make by hand.** A customer can walk away from PayPal ("Cancel and return"), pay by card, and later approve the old PayPal page anyway. The app then cancels the PayPal subscription by itself. But PayPal takes the first payment when it activates. You will see it in `releasedApprovalsToRefund`, and in the logs as `REFUND its first payment in PayPal`. Refund that sale in full in PayPal (Activity, the payment, Refund). It then drops off the report.

Other rules:
- PayPal refunds are made in PayPal, not in the RepGet admin. Cancel the subscription separately if the customer is leaving.
- To stop PayPal for new customers today you must remove the variables, which also stops webhooks for existing PayPal customers (L9). Ask for a checkout-only switch before you need it.

## Not verified without a sandbox test

These come from PayPal's documentation, not a test. The code takes the safe path for each.
- How long an unfinished approval link keeps working, and whether PayPal ever ends an approval left pending. If a customer just closes the PayPal tab (no "Cancel and return"), the approval still blocks card payment and deletion for that website. If PayPal still shows the approval page, Pay with PayPal for the same plan and then "Cancel and return" clears it. If not, there is no button for it yet: it needs a developer (review H1, admin action).
- Whether PayPal accepts a plan change to another tier or interval, and when it charges for it (M5).
- How long webhooks take in live. The app no longer depends on them for the first activation.
