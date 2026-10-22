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

Added on 2026-10-20:
- **Cancelling in PayPal keeps the time paid for** (review M1), as a card cancellation does. The plan stays active and shows "Access ends on <date>" until the last payment's month (or year) is over. The 5-minute maintenance job then ends it. If that last payment was refunded in full, or nothing was paid, it ends at once. While it runs out, the website can't change plan or start another subscription; the billing page says from which day it can.
- **`PAYPAL_CHECKOUT=off` pauses new PayPal checkouts only** (review L9): the button, new subscriptions and plan changes. Webhooks, the return from PayPal and the maintenance job keep working, so existing PayPal subscribers are still billed, recorded and cancelled. Leave it unset normally.
- **A PayPal payment started and never finished can be cancelled by the customer** (review H1). If someone closes PayPal's tab instead of paying or using "Cancel and return", the billing page and the plan step show a notice after 10 minutes, with a button "Cancel the PayPal payment". It does what "Cancel and return" does: an approval PayPal still has waiting is released, so the website can pay by card again; one PayPal reports paid is recorded instead.

Added on 2026-10-22 (the client: PayPal "as same as the case of Stripe"):
- **The 3 free articles with PayPal too.** Each plan has a second PayPal plan, "<plan> - free articles first": 30 free days, then the plan's price. A workspace that has never had a plan, with a confirmed email, gets it when it pays with PayPal. Nothing is charged that day. RepGet records the free days as "Free articles", like a card trial. The same 3 articles are free, and audits, AI visibility and the Partner Network wait for the plan. A plan without its free-articles PayPal plan charges at once, as before.
- **PayPal cannot start the plan early by itself.** By card, the plan starts right after the 3rd article. Through PayPal, it starts when the 30 days end, or earlier when the customer presses **Start my plan now** on Billing. Choosing any plan there does the same. After the 3rd article the customer gets a notification saying so, and a 4th article is refused with the same words.
- **Start my plan now** opens a second PayPal subscription to the plan itself, charged on approval. Once PayPal has activated it, RepGet moves the website to it and cancels the free subscription by itself. Nothing was charged on the free one. Until PayPal has activated the new one, nothing changes, and the free articles carry on.
- **Cancelling during the free days** ends it at once. Nothing was paid, so there is no time left to keep.
- During the free days the website cannot switch to card. The customer cancels the PayPal free subscription first; the workspace has then had its free articles, so card charges at once.

## Releasing the free articles with PayPal (owner steps, in order)

Steps 1 to 7 below were done before this. These four steps add the free articles:

1. **Migrate production** before the new code goes out. The code reads these columns:
   - `0073_paypal_trial_plans`
   - `0074_paypal_start_now`
2. **Create the 4 free-articles PayPal plans.** Run step 5's script again, with the live values in the window, **without** `--switch-mode`:

   ```powershell
   $env:PAYPAL_ENV = "live"
   $env:PAYPAL_CLIENT_ID = "<live client id>"
   $env:PAYPAL_CLIENT_SECRET = "<live secret>"
   node scripts/paypal-setup.mjs --live
   Remove-Item Env:PAYPAL_ENV, Env:PAYPAL_CLIENT_ID, Env:PAYPAL_CLIENT_SECRET
   ```

   Expected: for each of the 4 plans, "plan unchanged" and then "free-articles plan created". The Grow and Scale products are reused ("product exists"). Then a table in which every plan has both ids, and the last line "All plans have a PayPal plan and a free-articles plan. PayPal checkout is ready." If it stops with "do not exist in LIVE PayPal", stop and ask: the live plan ids have changed.
3. **Deploy** (push `main`). No new Inngest function, so no resync.
4. **Test** with step 8, "Free articles with PayPal".

Steps 2 and 3 can come in either order. Before the script, PayPal simply charges at once, as it did. Before the deploy, the old code ignores the new plans.

## Decisions still open

1. Still open from the review: price changes do not reach PayPal (M3), plan changes through PayPal are unverified and do not charge the difference on an upgrade (M5), and old PayPal plan ids are forgotten (M8). (M1, cancelling keeps the time paid for, and L9, a pause switch, were done on 2026-10-20: see above. The free articles with PayPal were done on 2026-10-22. Their "Start my plan now" does not use PayPal's plan change: it is a new subscription, charged in full on approval.)

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
   - Do not add `PAYPAL_CHECKOUT`. Set it to `off` only when you want to pause new PayPal checkouts (see "Other rules").
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

   Expected: "recreating (--switch-mode)" for each of the 4 plans, each followed by "free-articles plan created", 2 products created, a table in which every plan has both ids, then "All plans have a PayPal plan and a free-articles plan. PayPal checkout is ready." Keep the output. (Before 2026-10-22 there were only the 4 plans and the line said "All plans have a PayPal plan.")
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

A workspace that has never had a plan gets the free articles instead of paying at once (2026-10-22). For the EUR 99 payment, use either "Start my plan now" in the free-articles test below, or a workspace that has had a plan before.

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

**Free articles with PayPal** (after the release steps above):

1. Sign up with a **new** email address, so the workspace has never had a plan, and enter the code from the email. Add a test website and choose Grow.
2. The line under "Pay with PayPal" says the 3 free articles come first and nothing is charged today. Press it and approve with the personal PayPal account. PayPal's page should show nothing to pay for 30 days, then EUR 99 a month (the wording is PayPal's).
3. Back on RepGet, within a minute, Billing shows:
   - the status "Free articles";
   - "Your Grow plan starts on <30 days later>", with a **Start my plan now** button;
   - nothing paid in Admin, Payments (at most a "No charge" line).
4. Then do one of these:
   - **Start my plan now** (EUR 99, refunded afterwards): approve in PayPal. Within a minute, Billing shows Grow, active, and Admin, Payments shows EUR 99.00 paid. In the personal PayPal account, under Automatic payments, the free subscription is cancelled and a new one is active. Refund and cancel the new one as in steps 4-5 above.
   - **Spend nothing:** cancel the free subscription in PayPal. RepGet shows the plan ended at once.
5. Delete the test website and workspace.

## 9. The first week

Every day:
1. PayPal, Webhooks events: look for failed deliveries.
2. Vercel logs: search `[paypal-webhook]`, `[paypal]`, `[billing]`, `[checkouts]` and `[cancellations]`.
3. Admin: the past-due count.
4. Run the read-only report from `platform/`: `npm run reconcile:report`. Look at:
   - `releasedApprovalsToRefund` - see below;
   - `replacedFreeArticlesToRefund` - see below;
   - `owedCancellations` - cancellations the app could not finish yet;
   - `duplicateLiveSubscriptions` - a website paying twice;
   - `unsettledCheckouts` - checkouts that never settled.

**Refunds you must make by hand.** A customer can walk away from PayPal ("Cancel and return"), pay by card, and later approve the old PayPal page anyway. The app then cancels the PayPal subscription by itself. But PayPal takes the first payment when it activates. You will see it in `releasedApprovalsToRefund`, and in the logs as `REFUND its first payment in PayPal`. Refund that sale in full in PayPal (Activity, the payment, Refund). It then drops off the report.

The same goes for `replacedFreeArticlesToRefund`, which should stay empty. It lists a payment PayPal took on a free-articles subscription that "Start my plan now" replaced. That happens only if the customer starts the plan at the very end of the 30 days, and PayPal bills the free subscription before the new one is active. The customer then paid twice: refund the sale listed there, in full, in PayPal.

Other rules:
- PayPal refunds are made in PayPal, not in the RepGet admin. Cancel the subscription separately if the customer is leaving.
- To stop PayPal for new customers, set `PAYPAL_CHECKOUT` = `off` in Vercel (Production) and redeploy. Existing PayPal customers are not affected: their webhooks keep working. Remove it and redeploy to offer PayPal again. Never remove the PayPal credentials for this: that would also refuse every webhook for existing PayPal customers.

## Not verified without a sandbox test

These come from PayPal's documentation, not a test. The code takes the safe path for each.
- How long an unfinished approval link keeps working, and whether PayPal ever ends an approval left pending. If a customer just closes the PayPal tab (no "Cancel and return"), the approval still blocks card payment and deletion for that website. Since 2026-10-20 the billing page and the plan step show such an approval after 10 minutes, with a "Cancel the PayPal payment" button that releases it (review H1).
- Whether PayPal accepts a plan change to another tier or interval, and when it charges for it (M5).
- How long webhooks take in live. The app no longer depends on them for the first activation.
- The free-articles plans (2026-10-22). These are taken from PayPal's documentation and examples, and checked only against stubbed PayPal answers:
  - a trial cycle priced 0, then the regular cycle;
  - PayPal reporting the trial cycle as completed from its first day;
  - the first charge coming when the 30 days end.

  The free-articles test in step 8 is the first real check: Billing must say "Free articles" on day 1.
- How long PayPal takes from approving "Start my plan now" to activating it. RepGet waits for activation, keeps asking, and the free articles carry on meanwhile.
