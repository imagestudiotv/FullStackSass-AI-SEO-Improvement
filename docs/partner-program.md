# Partner program (cash affiliates)

RepGet's native affiliate program: partners apply with their existing RepGet login, share a referral link or an assigned coupon, earn a recurring cash commission on the Stripe subscription revenue their referred customers actually pay, and are paid through Stripe Connect.

**This release supports Stripe-paid subscriptions only.** PayPal payments earn no partner commission and are never shown as processed. PayPal itself, its history and the legacy account-credit referral program are unchanged.

Progress against the requirements, phase by phase: [partner-program-progress.md](partner-program-progress.md).

## Architecture

A modular monolith inside the existing Next.js app, PostgreSQL database, Better Auth and Inngest. The code lives in `src/lib/partners/`.

```
presentation/   guards, validation, server actions, serializers   (pages, routes, webhooks call these)
application/    use cases, queries, ports (interfaces), contracts
domain/         money, rates, eligibility, attribution, tiers, maturity, fraud, state machines - pure
infrastructure/ Drizzle repositories, Stripe adapters, outbox, mailer, clock, settings
server.ts       the composition root (server-only, built lazily)
```

Dependency direction, enforced by `src/lib/partners/architecture.test.ts`:

- Presentation → Application → Domain.
- Infrastructure → Application interfaces and Domain types.
- Domain imports nothing but domain: no Next.js, Drizzle, Stripe, HTTP or email.
- Application never constructs a database or Stripe client and never imports infrastructure.
- Client components never import server-only partner modules. No UI imports the commission or maturity policies.
- No floating-point money arithmetic outside the domain.

`server.ts` is the only module that builds concrete adapters. It does so on first use, so importing a route needs no database connection and no Stripe key. That matters because `next build` evaluates every route module.

Transactions are short. No Stripe call ever runs inside one. Stripe is called between transactions, and its answer is re-checked in the next. Lock order everywhere: partner, balance projection, attribution, payment fact, commissions, settlement; every row lock is `FOR NO KEY UPDATE` (see Payouts, Locking).

## Identities

| Identity | What it is |
|---|---|
| User | The existing RepGet login (Better Auth `user`). |
| Partner | `partner_profiles`: one approved affiliate profile per user. Not an organization, not an organization role, never an administrator. |
| Referred customer | The new account's founding user plus the workspace created at that signup (`partner_attributions.organization_id`, `founding_user_id`). |
| Stripe Customer | Pays for subscriptions (`billing_customers`). Never used to pay a partner. |
| Stripe connected account | Receives partner money (`partner_stripe_accounts`), one per partner and environment. |

Partner access belongs to the user. It needs no paid plan, no website and no customer workspace. Membership of an organization grants no partner access.

## Data and financial records

Tables are defined in `src/lib/db/partner-tables.ts`, migrations `0063_partner_program` and `0064_partner_program_guards`. Every table is created through the RLS-enabling `pgTable` wrapper (`src/lib/db/table.ts`) and has no policies. The server role bypasses RLS, so authorization lives in the guards and use cases.

- **Money** is integer minor units in `bigint` columns, always with an explicit currency column. Amounts are never `numeric` and never floats. The domain `Money` type uses `bigint`, and the browser receives amounts as decimal strings.
- **Financial history outlives accounts.** Financial rows reference customer organizations and users by text id with no foreign key, like `admin_audit_log`. They reference each other with `ON DELETE RESTRICT`. Deleting a workspace or user never cascades into them.
- **`partner_ledger_entries` is append-only.** A trigger refuses UPDATE, DELETE and TRUNCATE. Each entry's `amount` is its signed effect on what RepGet owes the partner:

| kind | sign | when |
|---|---|---|
| `commission_earned` | + | a commission is created |
| `commission_adjustment` | ± | refund, chargeback, rejection, administrator correction |
| `transfer_confirmed` | − | Stripe confirmed a transfer to the partner |
| `transfer_reversal` | + | Stripe confirmed money reversed back from the partner |

- **Derived totals:**
  - Net earned = earnings + adjustments.
  - Net transferred = confirmed transfers − confirmed reversals.
  - Outstanding liability = net earned − net transferred.
- **Bank payouts are not ledger entries.** They move money the partner already holds. A bank payout can therefore never deduct liability a second time.
- **`partner_balance_projections`** has one row per partner, environment and currency. It is a rebuildable projection for dashboards and the row a settlement locks. It is never the source of truth.
- **Unique constraints** enforce the money guarantees independently of webhook deduplication:
  - one profile per user;
  - one open application per user;
  - one attribution per customer organization;
  - one payment fact per Stripe invoice payment;
  - one commission per payment fact;
  - one ledger entry per operation key;
  - one active allocation per commission;
  - one pre-transfer settlement per partner and currency;
  - one settlement per monthly run;
  - per settlement, one transfer that may have moved money;
  - per settlement, one bank payout that may still pay.
- **Environments.** Every Stripe-derived row carries `environment` (`test` | `live`), taken from the configured secret key's prefix. Test and live ids, balances and settlements never mix.

## Business rules and decisions

### Commission rates and tiers

| Tier | Rate | From |
|---|---|---|
| Base Partner | 25% | 0 qualifying customers |
| Growth Partner | 30% | 10 |
| Premier Partner | 35% | 25 |

The rules are versioned in `partner_program_versions`. Version 1 is seeded by migration 0064, and every commission records its version.

- **What counts.** Tiers count distinct referred customer **organizations**. Users, seats, websites, invoices and subscriptions are never counted. An organization qualifies while three things hold:
  - its attribution is `active` (not disqualified or under review);
  - it has a Stripe subscription with status `active` whose current period has not ended (a cancellation at period end counts until then);
  - at least one of its commissionable payments has not been fully refunded or charged back.

  `trialing` and `past_due` periods are not paid periods and do not count.
- **Timing (deterministic).** A tier change is recorded in `partner_tier_history` with the time it was evaluated, and applies to payments from then on. Each payment uses the tier in force at its own provider timestamp. A late or concurrent payment therefore gets the same rate whatever order it is processed in.
  - The payment that brings a partner to a threshold is itself paid at the previous rate.
  - Tiers move both ways: if qualifying customers drop below a threshold, future payments use the lower rate.
  - History is never rewritten.

### Eligibility (12 months)

- The window is 12 calendar months from the first qualifying successful Stripe payment, meaning the first payment with a positive eligible base. It is UTC and start-inclusive, end-exclusive.
- Times are the provider's payment timestamps, never webhook arrival.
- A month from the 31st lands on the last day of a shorter month.
- Annual payments follow the same rule, so the renewal exactly twelve months later is outside the window.
- If a payment with an earlier timestamp is processed after the window was set, the window start becomes the earliest qualifying payment, recomputed under the attribution's row lock. A commission that would then fall outside the window becomes a review case.

### Eligible revenue

The base is subscription revenue actually collected, excluding tax (`domain/policies/commission.ts`):

- **Cash only.** Only verified Stripe invoice payments count: the payment intent succeeded and the charge was captured. "Invoice paid" and "subscription active" are never proof. Out-of-band payments never count.
- **Discounts** are already out of the invoice total, so nothing is subtracted again.
- **Credits** are excluded. Customer-balance credit and other non-cash settlement are excluded because only cash is counted.
- **Tax** is excluded, whether inclusive or exclusive. When an invoice is paid partly by credit, its tax-free revenue is allocated to the cash in proportion, cumulatively in payment order: `eligible(c) = floor(revenue × cumulative cash / total)`. Several partial payments add up exactly to what one full payment would. There is no rounding drift.
- **Stripe fees** are not subtracted.
- **Rounding.** The commission is base × rate in integer basis points, rounded half up once at the final minor unit:
  - EUR 99.00 × 25% = EUR 24.75
  - EUR 89.10 × 25% = EUR 22.28
- **Ambiguity becomes a review case**, never a guessed commission. Examples: a non-subscription invoice line, a truncated line list, more cash than the invoice total, an unsupported currency, a charge shared with other invoices.

### Refunds and disputes

- **Cumulative.** The reversed commission for a collection is recomputed from total cash returned (refunds plus lost disputes, capped at the cash collected). Only the difference from what is already reversed is applied.
  - Duplicated or out-of-order events converge.
  - More than the original commission is never reversed.
  - A refund overlapping a lost dispute counts once.
  - A full refund reverses exactly the whole commission.
- **Dispute outcomes:**
  - an open dispute holds the commission;
  - a lost dispute reverses it;
  - a won dispute releases the hold once.
- **After the partner has been paid**, a refund's negative adjustment leaves the partner owing RepGet. That position is offset against later earnings, once.
- **Transfer reversals.** An administrator may instead recover the money with a Stripe transfer reversal. Its confirmation raises the liability back, so the same amount is never both recovered and offset.

### Money and currencies

- **Currencies.** Supported currencies are an explicit allowlist with Stripe's exponents (`domain/value-objects/currency.ts`). Stripe's special cases (HUF, ISK, TWD, UGX) and three-decimal currencies are refused.
- **Separation.** Currencies are kept separate everywhere. Nothing is converted.
- **Thresholds.** Automatic payouts need a threshold per currency. Only EUR has one (EUR 25.00). A balance in a currency without a threshold is shown as such and never paid automatically.

### Payout eligibility

- **Schedule.** The monthly run is on the first day of each month at 00:00 UTC.
- **Eligible commissions.** It pays commissions that are all of:
  - at least 30 days past their payment;
  - approved;
  - not held;
  - not reserved.
- **What it pays.** `payable = min(E, L − P − R)` (`domain/policies/maturity.ts`):
  - E = the eligible commissions' net amounts;
  - L = ledger liability;
  - P = what L still contains for unpaid, not-yet-payable commissions;
  - R = amounts reserved by unconfirmed transfers.
- **Below threshold** the balance carries forward. Monthly scheduling can pay later than the exact maturity date, never earlier.
- **Requirements.** An active partner without a payout hold, and a payout-ready connected account.

### Attribution

- **Tracking.** The attribution window is 90 days, carried by a dedicated cash-affiliate cookie that is separate from the legacy `ref` credit-referral cookie.
  - The cookie holds a random 256-bit token. The click row stores only its SHA-256, so a cookie cannot be forged into another partner's click.
  - The first valid approved partner link within the window wins.
- **Capture.** Eligibility is captured on the server once, when a RepGet account is created (`partner_signup_eligibility`). It is captured for email, one-time-code and Google sign-up alike.
- **Who is not eligible:**
  - *Existing accounts* never get eligibility, so a later click changes nothing.
  - *Invited team members* are excluded even though signup also creates an (empty) workspace for them. An address is "invited" when any `website_invitations` row names it (rows are kept after acceptance or expiry) or a pending organization invitation does.
  - *Other organizations*: only the organization founded at that signup can be attributed.
- **Self-referrals.** Clear self-referrals are rejected: the partner's own address, or the partner being a member of the organization.
- **Fraud signals.** Weaker signals hold the attribution's commissions for review and never reject on their own:
  - a plus-address of the partner's mailbox;
  - a network or browser shared with one of the partner's own sessions.
- **Locking.** An attribution is locked once written: one per organization, enforced by a unique index. A later link or another partner's coupon never replaces it.

### Coupons

- **Assignment.** Coupons are optional and assigned by administrators. The default is no discount: a partner gets no coupon unless one is assigned. A coupon is a Stripe coupon plus a promotion code, created through the API.
  - The existing subscription Checkout already accepts promotion codes (`allow_promotion_codes`).
  - Redemption is read from the paid invoice's discounts, never trusted from a form.
- **Coupon-only attribution** requires all of:
  - signup eligibility captured at account creation;
  - no prior payment;
  - the first checkout paid within 90 days of signup.
- **Conflicts.** A coupon belonging to a different partner than an existing attribution opens a review case, and the discount still applies. Attribution never moves silently.

### Credit referral coexistence

- **Unchanged.** The legacy program (`referral_codes`, `referrals`, account credits, `/r/CODE`, cookie `ref`) works exactly as before.
- **No crossover.** A cash affiliate link never grants legacy credits, and a legacy referral never creates a cash attribution.
- **Conflicts.** If the same customer organization has both a legacy credit referral and a cash attribution, its cash commissions are created as `needs_review` (held) and a `credit_cash_conflict` review case is opened.

## Applications, approval and the portal

- **Applying.** `/partner/apply` requires a signed-in user whose address is PROVEN. The proof is read from the user row, never from the session.
  - Unverified users get the same one-time code the plan step uses (`lib/auth/confirm-email-actions.ts`).
  - Applications are rate-limited: 3 per user per day and 60 per hour overall.
  - A user can have one open application at a time.
- **Approval** (Admin → Affiliate partners → Partner applications) runs in one transaction under the application's row lock. It:
  - creates the user's single profile (ON CONFLICT on `user_id`) with a random 10-character code from an unambiguous alphabet;
  - opens the base tier;
  - records ONE welcome email in the outbox (`partners/welcome:<partnerId>`).

  Retried or concurrent approvals return the same profile (verified with 4 connections on real PostgreSQL). The email is claimed before it is sent, so a retried job sends it once. Rejection needs a reason, and every decision is audited.
- **The portal** is the `(partner)` route group: `/partner`, `/partner/apply`, `/partner/settings`.
  - It needs a session and nothing else: no plan, no website and no workspace. `requireOrg` is never called, so a visit cannot create one.
  - Every page re-checks access through `presentation/guards.ts`.
  - A suspended partner can see their history but cannot act.
  - Partner access never grants admin access.
- **Account menu.** Users with a partner profile see "Partner portal" in the account menu.

## Tracking and signup attribution

- **Links.** A partner link is `/go/<code>`. It records a click and redirects to the home page, or to an allowlisted page given in `?to=`.
  - **Rate limits:** 30 per visitor per minute, 3,000 per minute overall.
  - **Never fails a visitor.** An unknown code, a suspended partner, the closed program or a database error still lands the visitor on the site.
- **Cookie.** It is `repget_partner`: httpOnly, SameSite=Lax, 90 days. Its value is a random 256-bit token, and the click row stores only its SHA-256.
  - It is separate from the legacy `ref` cookie. Neither link touches the other's cookie.
  - The first valid link wins. A later link counts as a click for its partner but does not move the cookie.
  - The visitor's network is stored only as an HMAC (`PARTNER_TRACKING_SECRET`, else `BETTER_AUTH_SECRET`).
- **Consent.** Like `ref`, the cookie is first-party attribution, not analytics or advertising, so it is set without the Google consent banner, whose choices govern Google's tags only. The privacy policy names both cookies (updated 19 October 2026).
- **Signup capture.** Better Auth's user-create hook (`lib/auth.ts` → `presentation/signup-hook.ts`) runs once for every new account, whether by email, one-time code or Google, after the signup workspace exists. It:
  - reads the cookie and the method from the auth context;
  - records `partner_signup_eligibility`;
  - for a valid click, locks the founding workspace's attribution.

  It never throws. If the hook could not create the workspace, the attribution is completed when the app creates it (`eligibilityForOrganization`).

- **Network signals and IPv6.** Better Auth stores a session's address as the IPv4 address or, for IPv6, its /64 network in expanded form. A signup's address is compared in that same form (`sessionAddressForm` in `infrastructure/directory.ts`), so a signup from the partner's own IPv6 network is flagged. The browser tests found the mismatch: before, the shared-network signal could never fire for IPv6.

## Stripe Connect

- **Account** (`infrastructure/stripe/connect-onboarding.ts`), created when the partner first clicks "Set up payouts", never on approval. The row is reserved first (one per partner and environment), then the account is created with the stable idempotency key `partner-account:<partnerId>:<environment>`.
  - `controller.stripe_dashboard.type = express`, so the partner manages their bank in Stripe's Express Dashboard.
  - `controller.fees.payer = application` and `controller.losses.payments = application`.
  - `capabilities.transfers.requested = true`, with no card payments.
  - `settings.payouts.schedule.interval = manual`, so funds wait until RepGet creates the bank payout for a settlement.
  - `country` = the partner's payout country, which must be in `PARTNER_PAYOUT_COUNTRIES`.
  - `metadata.repget_partner_id`, which is checked on every read.

  If Stripe refuses the configuration for a country, the refusal is shown to the partner as an error, not hidden.
- **Onboarding** is Stripe-hosted, through `accountLinks.create` (type `account_onboarding`, `collection_options.fields = eventually_due`).
  - **Return URL:** `/partner/settings?onboarding=returned`. The return proves nothing: the page re-reads the account from Stripe.
  - **Refresh URL:** `/partner/connect/refresh`. It makes a new single-use link for the signed-in partner's own existing account and never creates one.
- **Readiness** comes from the account itself:
  - `onboarding`: details not submitted;
  - `restricted`: a disabled reason, past-due requirements, or transfers inactive;
  - `verification_pending`: transfers pending, or payouts not yet enabled;
  - `ready`: transfers active and payouts enabled.

  A read for a different partner (metadata), a different environment, or an unknown account changes nothing.
- **Connect webhook:** `/api/stripe/connect-webhook`, secret `STRIPE_CONNECT_WEBHOOK_SECRET`. Configure it in Stripe as an endpoint for **events on connected accounts**.
  - **Part 2 events:** `account.updated`, `account.application.deauthorized`, `capability.updated`, `account.external_account.created`, `account.external_account.updated`, `account.external_account.deleted`.
  - **Part 4 events:** `payout.created`, `payout.updated`, `payout.paid`, `payout.failed`, `payout.canceled`, `payout.reconciliation_completed`.
  - Events are stored in `webhook_events` with provider `stripe_connect`, and the billing-maintenance recovery job replays them.

## Commissions from Stripe payments

### The flow

1. **Hand-off.** The existing platform webhook (`/api/stripe/webhook`) runs the billing work. `processStripeEvent` then records the affiliate work the event implies in `partner_provider_events` (`presentation/webhooks.ts`). This happens BEFORE the webhook event is marked complete:
   - a crash in between leaves the event unfinished, so it is retried, and the billing work is idempotent;
   - the recovery job replays it through the same function.

   Only the object id is taken from the event, and an event for the other environment is ignored.
2. **Processing.** The `partner-provider-event` job (delivered through the outbox) and the five-minute `partner-commissions-sweep` claim due work with a token and a lease.
   - Failures retry with backoff (1 minute doubling, capped at 2 hours). After 12 attempts the work is marked failed and a review case opens.
   - While `partner_commissions` is off nothing is claimed; the work waits without using attempts.
3. **Invoice** (`use-cases/process-payment.ts`). The Stripe reads all happen outside any transaction (`infrastructure/stripe/billing-source.ts`):
   - the invoice, every line (paginated), every invoice payment, each payment intent (expanded to its charge), the charge's refunds and disputes, and the redeemed promotion codes.

   Then ONE short transaction under the customer's attribution row lock:
   - complete a link attribution waiting for its workspace;
   - apply a partner coupon (attribute, or a conflict case);
   - record one `partner_payment_facts` row per VERIFIED invoice payment (unique per Stripe invoice payment, so a duplicate webhook is the same fact);
   - set the 12-month window;
   - create the commission at the tier in force at the payment's own time, with the policy version, and write its `commission_earned` ledger entry;
   - apply the charge's current refunds and disputes.

   Tier and balance projections are refreshed after commit. Customers that are neither attributed nor eligible are skipped without a Stripe call.
4. **Refunds and disputes** (`use-cases/process-adjustment.ts`) re-read the charge and apply the cumulative rule (see "Refunds and disputes" above).
   - Each change is a new ledger entry (`reversal:<commissionId>:<n>`).
   - A refund after payout also opens a review case: offset, or recover by transfer reversal (Part 4).
5. **Net 30.** The sweep marks matured commissions available. `partner-tiers-daily` re-counts every active partner's qualifying customers and rebuilds the balance projections.

### Stripe events to enable

On the EXISTING platform endpoint, in addition to what billing already uses:

- **Invoices:** `invoice.paid`, `invoice.payment_succeeded`, `invoice_payment.paid`
- **Credit notes:** `credit_note.created`, `credit_note.updated`, `credit_note.voided`
- **Refunds:** `charge.refunded`, `charge.refund.updated`, `refund.created`, `refund.updated`, `refund.failed`
- **Disputes:** `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `charge.dispute.funds_withdrawn`, `charge.dispute.funds_reinstated`
- **Transfers:** `transfer.reversed`, `transfer.updated`

The list lives in code as `PARTNER_PLATFORM_EVENTS` (`infrastructure/stripe/event-normalizer.ts`). An event that is not subscribed is still recovered by reconciliation for payments (see below), but refunds and disputes rely on these events.

### Review cases instead of guesses

| Kind | When |
|---|---|
| `financial_inconsistency` | Any of: a non-subscription line; cash beyond the invoice total; an unsupported currency; a charge that also paid something else; a credit note credited without a refund; an earlier payment arriving late that moves the window start |
| `coupon_conflict` | Another partner's coupon redeemed by an attributed customer (the attribution never moves) |
| `credit_cash_conflict` | The customer is also a legacy credit referral; its cash commissions are created `needs_review` |
| `fraud_signal` | Shared network or device with the partner, or a plus-address; the attribution is `review` |
| `reconciliation` | A refund after payout; a discrepancy found by the daily reconciliation; Stripe work that failed 12 times |

### Coupons

An administrator creates a coupon (`use-cases/manage-coupon.ts`): a Stripe coupon plus its promotion code, with idempotency keys derived from the row. Customers enter promotion codes in the existing subscription Checkout (`allow_promotion_codes`). Redemption is read from the PAID invoice's discounts.

Campaign types and their durations:

| Campaign type | Duration | Behaviour |
|---|---|---|
| `percent_first_payment` | `once` | Applies to the first payment, monthly or annual |
| `percent_first_3_months` | `repeating`, 3 months | On a monthly plan, the first three payments. On an annual plan, the whole first annual payment. RepGet's monthly and annual prices share a product, so this cannot be restricted to monthly. Creating it requires `acknowledgeAnnualBehaviour` |
| `fixed_amount` | `once` | Fixed amount off the first payment, in the coupon's currency |
| `custom` | `once`, `repeating` N months, or `forever` | Percent or fixed amount |

Restrictions Stripe enforces: products, expiry, currency, maximum redemptions, first-time customers only. A start date in the future creates the code inactive, and the sweep activates it when the date comes. A Stripe refusal leaves the coupon `failed`, never active.

### Reconciliation

The daily `partner-reconciliation` job (03:40 UTC, `use-cases/reconcile-commissions.ts`):

- **Recovers missed payments.** A Stripe payment of real money for an attributed customer with no payment fact is recorded again as affiliate work.
- **Reports discrepancies** as review cases: a fact without its commission, a missing or doubled earned entry, a reversal that differs from its ledger entries.
- **Rebuilds AND reports** a drifted balance projection.
- **Deletes** unattributed clicks 30 days after their window.

The same checks are available read-only through `npm run reconcile:report -- partnerPaymentsWithoutFacts partnerEarnedMismatches partnerReversalMismatches partnerStuckProviderEvents partnerOpenReviewCases`.

## Payouts

Three separate records, never merged: what RepGet owes (the ledger), the **transfer** from RepGet's Stripe balance to the partner's connected account, and the **bank payout** from that account to the partner's bank. Only Stripe's evidence moves a settlement forward; no screen and no administrator action can mark money transferred or paid.

### The monthly run

`partner-payouts-monthly` runs at 00:00 UTC on the 1st (`use-cases/prepare-settlement.ts`). For each partner and currency with a balance, in ONE short transaction:

1. lock the partner row, then the partner/currency balance row (the serialisation point every settlement for that balance passes through);
2. re-check the partner: active, no payout hold;
3. lock the unpaid commissions and compute the plan from the ledger (`payable = min(E, L − P − R)`, see Payout eligibility);
4. create the settlement (run key `YYYY-MM`, `transfer_group` = `repget-partner-settlement-<uuid>`), reserve each allocated commission (one active allocation per commission), and record the execution job in the outbox (`partners/settlement.execute`).

Before that transaction: the `partner_payouts` switch, the live-money key for live mode, and a payout-ready connected account. Anything short of a payout is a **carry forward** with its reason: `nothing_payable`, `below_threshold` (EUR 24.75 stays below EUR 25.00), `negative_position`, `no_threshold`.

### Stage 2: the transfer

`executeSettlement` (`use-cases/execute-transfer.ts`) takes the settlement's 5-minute work lease. A lease running out does not prove a Stripe call failed: anything that may have reached Stripe is recorded first and reconciled after.

- **Pre-flight**, every time, before any money moves: both switches, the live-money key, the environment of the Stripe key, the partner (active, no hold), the connected account re-read from Stripe (ready, owned by this partner per its metadata), the platform's available balance in that currency, and the allocations unchanged (checked again in the same transaction that records the attempt). A failed pre-flight cancels the settlement and releases the commissions. Too little platform balance is retried; after 8 attempts a `payout_funding` review case is opened and the settlement is cancelled.
- **The attempt** is recorded as `processing` BEFORE the request, with the operation id `partner-transfer:<settlementId>:<n>`. That id is both the Stripe idempotency key and the transfer's metadata; the transfer carries the settlement's `transfer_group`.
- **Outcomes:**
  - success: `transfer_confirmed` is written to the ledger once (operation key `transfer:<tr_id>`), the settlement becomes `transferred`, its commissions `paid`;
  - refused and retryable (`balance_insufficient`, `rate_limited`, `lock_timeout`): back to `reserved` for a later attempt;
  - refused permanently: the attempt fails, a review case is opened, the settlement is cancelled;
  - **no answer** (timeout, 5xx): `transfer_unknown`. It is resolved by looking the settlement's `transfer_group` up at Stripe. Within 23 hours the SAME request is repeated with the SAME idempotency key, so Stripe returns the original transfer if it was made. After that, a transfer absent from the group never existed and a new attempt may be made.
- The database allows ONE transfer per settlement that may have moved money (partial unique index on live attempts), so no retry, worker race or bank payout failure can pay the same earnings twice.

### Stage 3: the bank payout

`payoutStage` (`use-cases/execute-bank-payout.ts`) creates the payout ON the connected account (the `Stripe-Account` header; the account's payout schedule is manual), with the operation id `partner-payout:<settlementId>:<n>` as idempotency key and metadata, after checking the connected balance.

- Statuses come from Stripe only: Connect `payout.*` events and polling. `paid` only when Stripe says `paid`; `in_transit` and `pending` are shown as such.
- A failed payout (`payout_failed`) leaves the money in the partner's Stripe balance and is retried with a new attempt; it never repeats the transfer. After 3 failures a `payout_discrepancy` review case is opened.
- The connected balance in the settlement's currency must cover the payout. If it still does not 72 hours after the transfer (most likely Stripe converted the transfer into the account's own currency, or the partner moved the money), the settlement goes to review with a `payout_discrepancy` case instead of waiting silently. See the currency limitation in [partner-program-launch.md](partner-program-launch.md).
- A payout RepGet did not create (for example one the partner triggered) is never matched to a settlement: an `unexpected_payout` review case is opened.
- The `partner_payouts` switch off stops NEW bank payouts. Payouts already created keep being tracked.

### After payment: refunds, reversals and adjustments

- **A refund or chargeback after the transfer** reverses the commission in the ledger. What RepGet owes falls below the unpaid commissions, and the difference is **deducted from upcoming payouts** (shown to the partner as "will be deducted"). It is never hidden by editing a balance.
- **Transfer reversal**, by an administrator with a reason: at most what the partner owes back and at most what remains of the transfer, operation id `partner-reversal:<attemptId>:<n>`. It is recorded from Stripe's own view of the transfer (`transfer_reversal`, keyed by the Stripe reversal id). A reversal made outside RepGet is recorded once and opens a `payout_discrepancy` case.
- **Manual adjustments** are signed ledger entries (`manual:<uuid>`). A negative one is deducted from upcoming payouts. A positive one may only cancel an earlier deduction: payouts pay commissions, so a credit that no commission backs would be shown as owed but could never be paid, and is refused (`unbacked_credit`).

### Recovery

- `partner-payouts-sweep` (every 10 minutes) executes due settlements: new ones whose job was lost, unknown transfers, bank payouts to create or poll.
- The daily reconciliation adds settlement checks: a reservation abandoned for more than 7 days, transfers still unknown, settlements needing review, failing bank payouts, and every confirmed transfer compared with Stripe (missing, different amount, reversed outside RepGet). Each finding is a review case.

### Locking

Lock order everywhere: partner, balance projection, attribution, payment fact, commission, settlement. Every row lock is `FOR NO KEY UPDATE`: it excludes other lockers exactly as `FOR UPDATE` does, but not the `FOR KEY SHARE` lock a foreign-key check takes. With `FOR UPDATE`, a refund (holding a commission, writing a ledger row that references the partner) and the monthly run (holding the partner, waiting for that commission) deadlocked. The real-Postgres race tests found it, and `settlements.postgres.test.ts` reproduces the exact interleaving. Keys are never changed and these rows are never deleted, so nothing needs the stronger lock.

## Dashboards and reports

Dedicated read queries (`application/queries/partner-dashboard.ts`, `admin-reports.ts`, `infrastructure/persistence/repositories/reporting.ts`). Partner and admin pages read the same records with the same status mapping (`commissionDisplayStatus`, `transferDisplayState`, `bankDisplayState` in the domain). Nothing is recomputed in React.

**The five figures**, per currency (never converted), computed from the ledger and the commissions by the function that maintains the balance projection, so they are current rather than as of the last rebuild:

| Figure | Definition |
|---|---|
| Total earned | Commission earned minus refunds, chargebacks and corrections, all time |
| Pending | Unpaid and not payable yet: maturing (Net 30), held or under review |
| Available | Unpaid and payable at the next monthly run |
| Transferred | Net amount sent to the partner's Stripe balance |
| Paid to your bank | The part of Transferred that Stripe confirmed paid to the bank |

They never count money twice: earned = pending + available + in a payout (shown as "being sent now") + transferred − corrections still to deduct. `dashboards.test.ts` checks this against the raw ledger after a payout and a refund.

**Metrics** for a chosen range (last 30, 90 or 365 days, UTC, both ends shown): link opens recorded; new accounts the link rule attributed; customers attributed (link or coupon); attributed customers with a commissionable payment in the range; and conversion = paying customers ÷ clicks ("-" without clicks).

**Privacy.** A partner sees a referred customer as a shortened website address (`ex•••.com`) or an opaque reference (`Customer 3FA2C1`), never a name, an email or a full address. Administrators see the workspace name, the website and the same reference.

**Exports** (`/admin/partners/export/{commissions,settlements,ledger}`, optionally `?partner=<id>`): administrators only (404 to anyone else), CSV with exact decimal amounts in their own currency, the customer as reference and internal workspace id only, no secret and no bank detail. Cells that could run as spreadsheet formulas are neutralised. At most 20,000 rows; a cut export says so in the `x-export-truncated` header.

## Administrator controls

Every action calls `requireAdmin()` itself and is recorded in the activity log in the same transaction as the change. Every override needs a reason of at least 5 characters; approving an application takes an optional note, and creating a coupon records its campaign instead.

| Page | Actions |
|---|---|
| `/admin/partners` | The three switches; readiness; counts of what needs attention; queue failed Stripe work again; exports (optionally for a period) |
| `/admin/partners/applications`, `/admin/partners/partners` | Approve, reject, suspend, reactivate, hold or release payouts |
| `/admin/partners/partners/[id]` | Balances per currency, recent payouts, the ledger, coupons (create, deactivate), balance adjustment |
| `/admin/partners/attribution` | Attribution history; confirm a referral held for review; disqualify (unpaid commissions rejected) |
| `/admin/partners/commissions` | Filter by status and payment period; approve (held for review), reject (a reversing ledger entry; final - later refunds and disputes no longer touch it), hold, release (a dispute's hold can be neither replaced nor released) |
| `/admin/partners/payouts` | Next-run preview with blockers; run this month's payouts now; prepare one partner now (still one payout per currency per month); reconcile now; every settlement |
| `/admin/partners/payouts/[id]` | Every attempt with its operation id; retry (reconciles before anything new); resume a settlement under review (back to the state Stripe's evidence supports, with a fresh count of bank-payout failures); cancel (only before anything may have reached Stripe, also from review); transfer reversal (one at a time: refused while an earlier one is unconfirmed) |
| `/admin/partners/reviews` | Resolve or dismiss a case; for referral cases, confirm or disqualify the referral |
| `/admin/partners/coupons` | Every coupon and campaign; deactivate |

## Promotional resources

`/partner/resources`: the brand files as shipped (`public/images`: logo for light and dark backgrounds, icon), banners in the partner's language (`public/partners/banners`, 728×90, 300×250 and 1200×628, one factual line and a call to action), and ready-made texts with the partner's own link filled in, plus the promotion rules. No figures, testimonials or performance claims.

## Program switches

Three independent `platform_controls` rows, all off until an administrator switches them on with a reason (a missing row means off):

| Key | Controls | While off |
|---|---|---|
| `partner_program` | Public page, applications, new tracking | Approved partners keep their portal and history |
| `partner_commissions` | Commission processing | Stripe events still record their affiliate work; it waits and is processed when switched on |
| `partner_payouts` | New settlements, transfers and new bank payouts | Status ingestion and reconciliation of operations already submitted to Stripe continue |

**Live money needs a fourth key outside the database:** `PARTNER_LIVE_PAYOUTS=enabled` in the deployment environment. Without it, live-mode transfers and payouts never start, whatever the database says. Test mode needs only the database switch. It is off by default.

## Environment variables

Names only; values belong in the host's environment settings (see [credentials.md](credentials.md)).

| Variable | Purpose |
|---|---|
| `STRIPE_SECRET_KEY` | Existing. Its prefix (`sk_test_` / `sk_live_`, `rk_…`) selects the partner environment |
| `STRIPE_WEBHOOK_SECRET` | Existing platform webhook |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | Connect webhook (events on connected accounts), Part 2 |
| `PARTNER_LIVE_PAYOUTS` | `enabled` allows live transfers and bank payouts; anything else keeps live money still |
| `PARTNER_PAYOUT_COUNTRIES` | Optional comma-separated ISO countries partners may be paid in; defaults to US, CA, GB, CH and the EEA |
| `PARTNER_TRACKING_SECRET` | Optional key for pseudonymous visitor hashes; falls back to `BETTER_AUTH_SECRET` |

## Launch and verification

- Rollout order, Stripe configuration, funding, schedules, support procedures and the remaining external prerequisites: [partner-program-launch.md](partner-program-launch.md).
- Browser end-to-end tests of the twenty flows: [e2e/partners/README.md](../e2e/partners/README.md).

## Review fixes (Part 5) and known limitations

A review of the complete program before launch found the following defects; each is fixed and pinned by a test (`review-fixes.test.ts` unless noted):

- A rejected or disqualified commission was not final: a later refund or lost dispute reversed it a second time, and balances kept counting it. It is now terminal everywhere.
- An administrator's hold could replace a dispute's hold, and releasing it cleared the dispute hold.
- A transfer reversal with no answer could be requested again (a second, real reversal); and a later reversal of the same amount could be matched to a refused request. One reversal at a time now, matched by its operation id, with a case for an unknown outcome.
- A settlement under review had no way out. It can be resumed (to the state Stripe's evidence supports) or cancelled before anything reached Stripe; unconfirmed settlements under review count as in flight when the next run plans.
- A transfer or bank payout whose outcome was unknown was re-sent within Stripe's idempotency window even after the payouts switch was turned off or the partner suspended. It is now only looked up until a new one would be allowed.
- A cancelled settlement used up the month (migration 0065 makes the run index ignore cancelled rows), and a fully refunded commission was released as "pending" instead of "reversed".
- Lock order: cancelling and confirming a settlement locked the settlement before its commissions, the opposite of the transfer submission.
- Fraud signals: a coupon attribution never compared the signup with the coupon partner's sessions, and a link attribution completed after signup (workspace created later) dropped the signals recorded at signup. Signups now store keyed hashes of their network and browser (migration 0065) for later comparisons. IPv6 addresses are compared in Better Auth's /64 form (found by the browser tests).
- Connect events were stored whole in `webhook_events`, including bank-account objects; only the event's id, type, account and object id are kept now (`entry-points.test.ts`).
- A first-touch cookie of a partner suspended since still held the browser; unknown referral codes were not rate-limited per visitor; a partner could repeatedly trigger Stripe calls from payout setup (now 12 a minute per partner); an account creation unresolved after Stripe's idempotency window could be retried into a second account (now a review case).
- Coupon activation read only the first 200 coupons; a transfer's reversals were read from the embedded list (10 at most).
- A refund undone after the commission was paid left an amount owed that no payout could include; it now opens a `financial_inconsistency` case.
- A confirmed transfer whose connected balance never covers the bank payout (e.g. converted by Stripe into the account's currency) waited silently; after 72 hours it now goes to review (`settlements.test.ts`).
- The portal had no loading or error state of its own; the admin area had no list or retry of failed Stripe work, no activity figures per partner and no report periods.

Known limitations and deliberate differences from the original specification:

- **States.** Commissions have `paid` and `reversed` states besides pending / available / reserved; "held" and "review" are views of unpaid money, not stored states. A bank payout that is returned after being paid goes from paid to failed (Stripe's own model), not to a separate "returned" state.
- **Records.** Payment facts do not link to RepGet's `payments` row (`payment_id` is empty); the Stripe invoice payment id is the reference. Balance-transaction ids are stored for transfers, not for bank payouts or reversals. Program versions have an effective-from date only (each version applies until the next). Transfer and bank-payout attempts record `unknown` plus when they were last checked, rather than a separate reconciliation state.
- **Retention.** Clicks that never led to an attribution are deleted 30 days after their window; clicks that did are kept with their pseudonymous visitor hash as attribution evidence. Partner profiles and applications keep the partner's name and contact email after their user account is deleted, because they are part of the financial history; erase them on request by hand if no longer needed for legal or tax purposes.
- **Reconciliation scope.** The daily check compares the newest 500 settlements' transfers with Stripe; older history is not re-read every day.
- **Notifications** to partners are emails only (the app's in-app notifications are for customer workspaces).
- **Reporting.** Admin lists have status filters and the commissions list a payment period; search exists for applications, partners and coupons. Partner histories paginate without filters. Exports are CSV.
- **Logs** are plain messages with the relevant ids, not structured JSON.
- **Tests.** The architecture test checks imports inside `src/lib/partners` and client components, and scans for float operations on money in the application and infrastructure layers; it is a guard, not a proof. In the browser tests the Stripe-dependent step of a flow (a payment, a transfer, a bank payout) runs as the real use case in the tests' process with a fake Stripe, and the app's own clock is not controlled ([e2e/partners/README.md](../e2e/partners/README.md)). No test runs against Stripe test mode yet.
