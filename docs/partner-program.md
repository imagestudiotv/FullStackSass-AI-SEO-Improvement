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

Transactions are short. No Stripe call ever runs inside one. Stripe is called between transactions, and its answer is re-checked in the next. Lock order everywhere: partner, balance projection, attribution, commissions, settlement.

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
  - **Part 4 events:** `payout.created`, `payout.updated`, `payout.paid`, `payout.failed`, `payout.canceled`.
  - Events are stored in `webhook_events` with provider `stripe_connect`, and the billing-maintenance recovery job replays them.

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
