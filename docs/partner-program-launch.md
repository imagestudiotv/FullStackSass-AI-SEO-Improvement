# Partner program: launch readiness, rollout and runbooks

For the people who will switch the cash partner program on and support it. Design and business rules: [partner-program.md](partner-program.md). What was built and verified, phase by phase: [partner-program-progress.md](partner-program-progress.md).

**Status.** The code is complete and tested against fakes of Stripe (unit, integration, real-PostgreSQL concurrency and browser end-to-end). It has **not** been verified against Stripe test mode, and live payouts must stay off until the prerequisites at the end of this page are done. Nothing here has been deployed or migrated.

## 1. Rollout order

The order matters: the Stripe webhook already hands partner work to the new tables, so code deployed before the migrations would fail billing webhooks.

1. **Migrate production**: `drizzle/0063_partner_program.sql`, `drizzle/0064_partner_program_guards.sql`, then `drizzle/0065_partner_program_review_fixes.sql` (20 tables, the append-only ledger trigger, the version-1 program policy; then a partial run index, `resumed_at`, and the signup fingerprint hashes). Production was at 0062. Owner action.
2. **Deploy the code.** All three program switches are off (a missing row means off), so nothing changes for customers: the public `/partners` page shows "applications are closed", partner links record nothing, Stripe events are recorded and wait.
3. **Sync Inngest** so it registers the new functions (section 6). Owner action.
4. **Set the environment variables** (section 2).
5. **Configure Stripe** (sections 3 and 4).
6. **Verify in Stripe test mode** on an isolated preview (section 5).
7. **Switch on, in this order, each with a reason** (`/admin/partners`):
   1. Program visibility: applications and partner-link tracking open.
   2. Commission processing: recorded Stripe work is processed (nothing is lost while it was off).
   3. Payouts: in test mode first; for live money also `PARTNER_LIVE_PAYOUTS=enabled` after funding (section 7).

## 2. Environment variables

Names only. Values belong in the host's settings, never in the repository ([credentials.md](credentials.md)).

| Variable | New? | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | existing | Its prefix (`sk_test_` / `sk_live_`, `rk_...`) decides the partner environment: test and live rows never mix |
| `STRIPE_WEBHOOK_SECRET` | existing | Platform webhook; must also receive the partner events (section 4) |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | new | The Connect endpoint (events on connected accounts) |
| `PARTNER_LIVE_PAYOUTS` | new | `enabled` allows live transfers and bank payouts. Anything else keeps live money still, whatever the switch says |
| `PARTNER_PAYOUT_COUNTRIES` | new, optional | ISO countries partners may be paid in. Default: US, CA, GB, CH and the EEA. **See section 3 on currencies before keeping non-EUR countries** |
| `PARTNER_TRACKING_SECRET` | new, optional | Key for pseudonymous visitor hashes; falls back to `BETTER_AUTH_SECRET` |
| `NEXT_PUBLIC_APP_URL` | existing | The partner links (`/go/<code>`) and Stripe return URLs are built from it |
| `ADMIN_EMAILS` | existing | Who can open `/admin/partners` |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | existing | The partner jobs (section 6) |
| `RESEND_API_KEY` | existing | Welcome and payout emails to partners |
| `TRUSTED_CLIENT_IP_HEADER` | existing | Off Vercel only: the header carrying the client address. Without it (and off Vercel) the shared-network fraud signal cannot fire |

## 3. Stripe Connect enablement

- **Enable Connect** on the platform account and complete the platform profile. Accounts are created by RepGet as **Express** accounts with `controller.fees.payer = application` and `controller.losses.payments = application`: RepGet pays Stripe's Connect fees for them and is responsible for negative balances. Check the current Connect pricing for the per-account and per-payout fees.
- **Capabilities:** `transfers` only (no card payments). **Payout schedule:** manual - RepGet creates each bank payout after its transfer is confirmed.
- **Countries.** Partners choose a payout country from `PARTNER_PAYOUT_COUNTRIES`. Stripe decides which countries a platform in RepGet's country can create accounts in and transfer to; confirm this in the Dashboard (Connect settings) and keep the variable to the countries Stripe accepts. A country Stripe refuses shows the partner an error when they start payout setup.
- **Currencies - a launch limitation.** Commissions and payouts are in the currency the customer paid; only EUR has a payout threshold (EUR 25.00), so only EUR balances are paid automatically. A transfer in EUR to an account that settles in another currency (for example a US account in USD) is converted by Stripe on arrival, and the bank-payout step, which pays out in the settlement's currency, then cannot run. It waits and, after 72 hours, opens a `payout_discrepancy` case (the transfer itself is settled; the money is in the partner's Stripe balance). **Recommendation for launch:** limit `PARTNER_PAYOUT_COUNTRIES` to countries whose accounts hold EUR (the euro area), or verify the behaviour for each other country in test mode first.
- **Branding** of the hosted onboarding (name, icon, colour) in the Connect settings.

## 4. Webhook events to enable

**Platform endpoint** (`/api/stripe/webhook`, existing, secret `STRIPE_WEBHOOK_SECRET`) - add:

`invoice.paid`, `invoice.payment_succeeded`, `invoice_payment.paid`, `credit_note.created`, `credit_note.updated`, `credit_note.voided`, `charge.refunded`, `charge.refund.updated`, `refund.created`, `refund.updated`, `refund.failed`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `charge.dispute.funds_withdrawn`, `charge.dispute.funds_reinstated`, `transfer.reversed`, `transfer.updated`.

**Connect endpoint** (`/api/stripe/connect-webhook`, new, "events on connected accounts", secret `STRIPE_CONNECT_WEBHOOK_SECRET`):

`account.updated`, `account.application.deauthorized`, `capability.updated`, `account.external_account.created`, `account.external_account.updated`, `account.external_account.deleted`, `payout.created`, `payout.updated`, `payout.paid`, `payout.failed`, `payout.canceled`, `payout.reconciliation_completed`.

Both endpoints exist once in test mode and once in live mode, each with its own secret. Events only ever trigger a re-read from Stripe; their payloads are never trusted for amounts or states. A missed event is recovered: the daily reconciliation finds payments without commission facts, and the sweeps poll unknown transfers and pending payouts.

## 5. Stripe test-mode verification (not yet done)

Needs a deployment that is NOT production (a preview), its own test-mode secret key, and its own test-mode webhook endpoints pointing at that preview - the existing test key delivers webhooks to the deployed production app, so it must not be used for this. Then, in order:

1. Apply for the program with an existing account; approve it in `/admin/partners/applications`.
2. Start payout setup; complete the hosted onboarding with Stripe's test data; check the portal shows "Payouts are ready" (and that a restricted test account shows "Stripe needs more information").
3. Open the partner link in a private window, sign up, subscribe with a test card; check one commission of the right amount appears (EUR 99.00 -> EUR 24.75).
4. Refund it partially in the Dashboard; check the reversal.
5. With a test clock or backdated test data, let commissions mature; fund the test platform balance (`4000000000000077` card charges go straight to the available balance); run the payout for the partner (`/admin/partners/payouts`, "Prepare now"); check the transfer, then the bank payout, and that "Paid to your bank" changes only when Stripe reports the payout paid.
6. Create a coupon from the partner's page; redeem it with a new test customer.
7. Check the Connect events arrive (`webhook_events`, provider `stripe_connect`) and the reconciliation reports nothing unexpected.

Record the outcome in `partner-program-progress.md`.

## 6. Jobs and schedules (Inngest, UTC)

| Job | When | Does |
|---|---|---|
| `partner-provider-event` | on each recorded Stripe event | Processes the affiliate work one event implies (commission, refund, dispute, transfer reversal) |
| `partner-commissions-sweep` | every 5 minutes | Retries due work, marks matured commissions (Net 30), activates coupons whose start has come |
| `partner-tiers-daily` | 03:10 | Re-counts qualifying customers per partner; tier changes are effective-dated |
| `partner-reconciliation` | 03:40 | Recovers missed payments, reports discrepancies as review cases, rebuilds and reports drifted projections, checks settlements against Stripe, deletes old unattributed clicks |
| `partner-payouts-monthly` | 00:00 on the 1st | The monthly run: one settlement per partner and currency with enough mature earnings |
| `partner-settlement-execute` | on each prepared settlement | The transfer, then the bank payout |
| `partner-payouts-sweep` | every 10 minutes | Executes due settlements: lost jobs, unknown transfers, bank payouts to create or poll |
| `partner-welcome` | on approval | The welcome email, once |

## 7. Money: funding, transfers and bank payouts

- **Funding.** Transfers draw on the platform's **available** balance in the settlement currency. Before the 1st of each month it must cover the month's payouts (the admin payouts page previews the run). The platform's own automatic payouts sweep that balance to RepGet's bank; plan a reserve or the timing. Too little balance is retried (8 attempts), then a `payout_funding` case is opened and the settlement released for the next run - nothing is half-paid.
- **Three records, never merged.**
  - The **ledger** says what RepGet owes. It changes when a commission is earned or adjusted, and when Stripe confirms a transfer or a reversal.
  - A **transfer** moves money from RepGet's Stripe balance to the partner's Stripe balance. Confirmed, it settles the liability (`transfer_confirmed`, keyed by the Stripe transfer id).
  - A **bank payout** moves the partner's own money from their Stripe balance to their bank. It is not an expense of RepGet and never touches the ledger, so a failed or repeated bank payout can never pay the same earnings twice.
- **Accounting view:** commission expense when earned (net of later reversals); the liability falls on confirmed transfers; reversals recovered from partners reduce it again. Bank payouts are the partner's movements. Corrections are new ledger entries; nothing is edited.
- **Refunds after payment** are deducted from the partner's next payouts (shown to them). An administrator may also recover the amount by transfer reversal (at most what is owed back and what remains of the transfer); Stripe may refuse it if the partner already withdrew the money - the deduction then stays.

## 8. Support procedures

| Situation | Where | What to do |
|---|---|---|
| "Where is my payout?" | `/admin/partners/payouts/<id>` | Two steps, each confirmed by Stripe: "Transfer" then "Bank payout". Bank arrival dates come from Stripe |
| Transfer outcome unknown | same | Wait: the sweep looks the transfer up by its group and repeats the request only with the same idempotency key - and only while payouts are switched on and the partner may be paid; otherwise it only looks. **Never create a transfer by hand.** "Retry now" does the same check immediately |
| Bank payout failed | same | Usually bank details: the partner fixes them in their Stripe dashboard ("Open your Stripe dashboard" in the portal); the sweep retries. After 3 failures a case is opened |
| Payout needs review | `/admin/partners/reviews` and the payout's page | The case says why (repeated bank-payout failures, connected balance short after 72 h, a transfer that does not match, a reversal made outside RepGet). Once the cause is fixed, **Resume after review** returns it to the state Stripe's evidence supports and runs it again (bank-payout failures are counted afresh). Before any transfer could exist it can be **cancelled** instead. Resolve the case with what was done |
| Platform balance too low | `payout_funding` case | Fund the balance; the settlement was released and is paid by the next run (or "Prepare now") |
| Refund or chargeback | automatic | The commission is reversed (cumulatively, never twice). An open dispute holds it; won releases it; lost reverses it. After a payout: deducted from the next payout, or reverse the transfer from the settlement page |
| Fraud signal | `/admin/partners/attribution?status=review` and the case | Shared network or device with the partner never rejects automatically. Confirm (commissions approved) or disqualify (unpaid commissions rejected; paid ones stay recorded - recover by reversal) |
| Credit and cash referral | the case | A customer referred by a customer (credit) and a partner (cash): decide which applies; approve or reject the commission |
| Partner breaks the rules | partner page | Suspend (history stays visible; nothing paid automatically) or hold payouts only. Both need a reason and are logged |
| Correction | partner page, "Adjust balance" | A signed ledger entry with a reason. A positive amount can only cancel an earlier deduction |
| Transfer reversal unanswered | payout page, case | No second reversal is allowed until Stripe's view of the transfer confirms or refuses it (the `transfer.reversed` event or the daily reconciliation reads it) |
| Stripe work failed every retry | `/admin/partners` | Fix the cause, then **Queue again**: the work is idempotent |
| Refund undone after payout | `financial_inconsistency` case | The amount is owed again but no payout includes it automatically; decide how it reaches the partner |
| Account creation unresolved | `payout_discrepancy` case | Look for a connected account with the partner's `repget_partner_id` metadata in the Stripe Dashboard before the partner retries |
| Exports for finance | `/admin/partners` | Commissions, payouts and ledger as CSV (exact decimals, no customer names, emails or bank details) |

## 9. Disabling safely and rolling back

- **Stop money first:** switch off Payouts. No new settlement, transfer or bank payout starts; operations already sent to Stripe keep being tracked and reconciled. For live mode, removing `PARTNER_LIVE_PAYOUTS` (and redeploying) blocks live money even if the switch is on.
- **Pause commissions:** switch off Commission processing. Stripe events are still recorded and wait; switching it on processes them. Nothing is lost.
- **Close the program:** switch off Program visibility. No applications, no new tracking; partners keep their portal and history.
- **Rolling the code back** to a version without the program is possible after the switches are off: the tables stay and keep the full history. Payments made while the old code runs are not recorded as partner work; after redeploying, the daily reconciliation recovers them (payments of attributed customers without commission facts).
- **Never** drop the partner tables, delete ledger rows or "fix" a balance by editing rows: the ledger refuses UPDATE, DELETE and TRUNCATE, and the projections are rebuilt from it. There is no down migration on purpose.

## 10. Remaining external prerequisites (exact)

1. Production migration of 0063, 0064 and 0065, before the deploy (owner).
2. Stripe: Connect enabled with the platform profile; Express branding; the countries and currencies RepGet's platform can pay confirmed and `PARTNER_PAYOUT_COUNTRIES` set accordingly (see the currency limitation in section 3).
3. Stripe webhooks: the 18 platform events added to the existing endpoint; the Connect endpoint with its 12 events and `STRIPE_CONNECT_WEBHOOK_SECRET`, in test and in live mode.
4. Inngest resync after the deploy, so the eight partner functions are registered.
5. A non-production preview with its own Stripe test keys and webhook endpoints, and the test-mode verification in section 5 carried out and recorded.
6. Platform balance funding in EUR before the first live run, and a decision on the platform's own payout timing.
7. Owner review of the partner rules shown on `/partners` and in the portal, the privacy policy's cookie paragraph, and any tax reporting the partners' countries require (outside this implementation).
8. Only then: the switches in order, and `PARTNER_LIVE_PAYOUTS=enabled` for live money.

Optional: run the browser end-to-end suite in CI ([e2e/partners/README.md](../e2e/partners/README.md)); it needs a database, an app copy and Chrome on the runner.
