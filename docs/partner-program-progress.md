# Partner program: implementation progress

Five sequential phases, one commit each. This file maps every requirement to the phase that delivers it and records what was actually verified. Design and decisions: [partner-program.md](partner-program.md).

Statuses: **done** (implemented and verified as stated), **in progress**, **planned**, **blocked** (needs something outside this repository).

| Phase | Commit title | Status |
|---|---|---|
| 1 | `feat(partners): [1/5] establish domain architecture and persistence` | done (7184a11) |
| 2 | `feat(partners): [2/5] implement onboarding and referral attribution` | done (3b22c46) |
| 3 | `feat(partners): [3/5] implement commissions and billing reconciliation` | done |
| 4 | `feat(partners): [4/5] deliver dashboards and automated payouts` | planned |
| 5 | `test(partners): [5/5] verify end-to-end flows and launch readiness` | planned |

## Phase 1: architecture, domain and database

| Requirement | Status | Where | Verified by |
|---|---|---|---|
| Repository assessment and baseline checks | done | — | Baseline on 1a1cbdc: `tsc` clean; vitest 2858 passed, 79 skipped (real-Postgres suites without `TEST_POSTGRES_URL`) |
| Architecture and decision documents | done | `docs/partner-program.md` | — |
| Exact money arithmetic | done | `domain/value-objects/money.ts`, `commission-rate.ts`, `currency.ts` | `money.test.ts`: bigint beyond 2^53, half-up rounding, EUR 24.75 / 22.28, currency mismatch, allowlisted exponents, string serialisation |
| Domain policies | done | `domain/policies/*` | `policies.test.ts`: eligibility window boundaries, tiers at 9/10/24/25 and 17/25 progress, tax / discount / credit / partial-payment bases, cumulative refund and dispute reversal, signup and coupon attribution, fraud signals, maturity, settlement planning (24.75 below 25.00, offsets, no threshold) |
| State models | done | `domain/entities/*` | Transition tables used by the use cases in Parts 2-4 |
| Schema, migrations, indexes, constraints | done | `src/lib/db/partner-tables.ts`, `drizzle/0063_partner_program.sql`, `drizzle/0064_partner_program_guards.sql` | `persistence.test.ts` (PGlite, all migrations replayed): RLS on all 20 tables, policy seed matches code, append-only ledger (UPDATE / DELETE / TRUNCATE refused), every uniqueness guarantee, restrict on financial history |
| Real-Postgres migration, privileges and races | done | `persistence.postgres.test.ts`, existing `rls.postgres.test.ts` | Disposable PostgreSQL 18.3 cluster (scratch `initdb`, 127.0.0.1:55461, UTC): all migrations replayed; RLS and no `anon` / `authenticated` / `PUBLIC` privileges on the new tables and trigger function; four connections racing one approval make one profile, four partners racing one organization make one attribution, the same ledger operation written concurrently is written once |
| Authorization boundaries | done | `presentation/guards.ts` | `guards.test.ts`: signed out, unverified (user row, not session), applicant without workspace or plan, owner-only profile lookup, suspended can view but not act |
| Application interfaces | done | `application/ports/*`, `application/contracts/*` | `tsc` |
| Persistence foundations | done | `infrastructure/persistence/*` | `persistence.test.ts` |
| Server-only composition root | done | `src/lib/partners/server.ts` (lazy) | `architecture.test.ts` |
| Versioned settings; separate live-payout enablement | done | `partner_program_versions`; `platform_controls` keys; `PARTNER_LIVE_PAYOUTS` (`infrastructure/settings.ts`) | `persistence.test.ts` (all switches off by default) |
| Domain dependency boundaries | done | `architecture.test.ts` | Mutation check: a planted `drizzle-orm` import in domain and a planted infrastructure import in application both fail the test |
| Admin audit actions registered | done | `lib/admin/audit.ts`, `app/admin/activity/action-meta.ts` | `tsc` (the label map is exhaustive over the action union) |

## Phase 2: applications, approval and attribution

| Requirement | Status | Where | Verified by |
|---|---|---|---|
| Public `/partners` page (5 languages), figures from the policy | done | `app/(marketing)/partners*`, `presentation/copy.ts` | `partners-ui.render.test.ts`: every locale, no unfilled placeholder, 25/30/35%, 12 months, EUR 25.00, rates follow the policy. Meta-length, i18n path, sitemap and hreflang tests |
| Legacy credit referrals unchanged and still reachable | done | `/affiliate`, `/r/CODE` and the settings card untouched; linked from `/partners` | Existing `referrals.test.ts` suite green. `entry-points.test.ts`: `/go` never sets `ref` |
| Application flow, same login, verified address | done | `use-cases/submit-application.ts`, `/partner/apply` | `onboarding.test.ts`: no new user or workspace; one open application; existing partner refused; validation; rate limit; closed program. `guards.test.ts` |
| Admin review, approval, rejection, suspension, payout hold | done | `use-cases/review-application.ts`, `/admin/partners/*` | `onboarding.test.ts`; audit entries checked |
| Approval idempotent (profiles, emails, Stripe accounts) | done | Profile ON CONFLICT; outbox id `partners/welcome:<id>`; account reserve plus idempotency key | `onboarding.test.ts`. `onboarding.postgres.test.ts` (real PostgreSQL, 4 connections): one profile and one job; 4 payout setups give one account row and one idempotency key |
| Welcome email once | done | `sendWelcome` (claim, release on failure) | `onboarding.test.ts`: a failure is retried, then exactly one email |
| Partners without subscriptions use the portal | done | `(partner)` route group: session only, never `requireOrg` / `requirePlan` | `guards.test.ts`; layout code review |
| Secure tracking, expiry, first touch, locking | done | `/go/<code>`, `record-referral-click.ts`, `tracking-cookie.ts` | `onboarding.test.ts`: hash only, first touch, expiry, duplicates, unknown / suspended / closed / flood. `entry-points.test.ts`: httpOnly, allowlisted redirects only, never fails the visitor |
| Signup eligibility (email, Google, one-time code); invitations; existing users; extra organizations; self-referral; tampering | done | `attribute-new-customer.ts`, `signup-hook.ts`, `lib/auth.ts` hook | `attribution.test.ts`. `entry-points.test.ts`: the hook reads cookie and method from the auth context and never throws |
| Coupon ownership and attribution rules; conflicts become review cases | done for the attribution rule and review case; Stripe coupon objects in Part 3 | `attributeByCoupon` | `attribution.test.ts` |
| Consent and rate limits | done | First-party attribution cookie (documented); quota and burst limiters | Privacy policy updated; tests above |
| Stripe account association and hosted onboarding; readiness states | done | `manage-payout-account.ts`, `connect-onboarding.ts`, `/partner/settings`, `/partner/connect/refresh`, Connect webhook | `payout-account.test.ts`: one account; same idempotency key after a lost answer; the return proves nothing; readiness states; wrong partner / environment / owner refused. `entry-points.test.ts`: signature, stored for recovery, duplicate, unknown account |
| Stripe test-mode verification | blocked | — | No Stripe test-mode run in this phase: the only Stripe test key available delivers webhooks to the deployed app, and creating connected accounts with it was not authorised. Adapter shapes come from SDK 22.6.0 types (API 2026-08-26.dahlia) and are exercised with fakes |

## Phase 3: Stripe billing and commissions

| Requirement | Status | Where | Verified by |
|---|---|---|---|
| Durable affiliate work inside the webhook boundary | done | `processStripeEvent` → `recordPartnerPlatformWork` (`partner_provider_events`) before the event completes; recovery job replays it | `coupons.test.ts` (recorded once per event id; part of `processStripeEvent`; other environment and unrelated events ignored); existing billing suites green |
| Payment normalization: cash, tax, discounts, credits, partial collections | done | `infrastructure/stripe/billing-source.ts`, `use-cases/process-payment.ts` | `stripe-adapters.test.ts`: verified only with a succeeded intent, the full amount received and a captured charge; payment records are out-of-band; paginated lines; non-subscription lines flagged; charges with disputes. `commissions.test.ts`: EUR 99.00 → 24.75; EUR 89.10 → 22.28 with no double discount; inclusive tax; credit balance; partial collections counted once each |
| Free trials, zero invoices, failed and out-of-band payments | done | same | `commissions.test.ts` |
| Renewals, annual billing, upgrades, downgrades, cancellations | done | same; tiers stop counting a lapsed subscription | `commissions.test.ts` (one more commission per renewal, none twice per invoice; proration paid; downgrade credit earns nothing; lapsed / fully refunded customers not counted) |
| Eligibility cutoff | done | `process-payment.ts` window | `commissions.test.ts`: 1 ms before the end commissioned; at the end outside; annual renewal outside |
| Tier boundaries 10 and 25, rate snapshots, late payments | done | `refresh-partner-tier.ts`, tier history | `commissions.test.ts`: 9 → base, 10 → growth, 25 → premier; a payment made before the promotion but processed after keeps 25%; after it 30% (EUR 29.70) |
| Immutable ledger and adjustments | done | `partner_ledger_entries` (trigger), `reversal:<id>:<n>` keys | `commissions.test.ts`, `persistence.test.ts` |
| Partial, repeated and full refunds; disputes; overlap; refund before payment; refund after payout | done | `process-adjustment.ts` | `commissions.test.ts`; `commissions.postgres.test.ts` (4 connections applying one refund → reversed once) |
| Duplicate, concurrent, delayed and out-of-order handling | done | unique facts, commissions and operation keys; attribution row lock; state read from Stripe | `commissions.postgres.test.ts`: 4 connections processing one payment → one fact, one commission, one earned entry; two renewals racing → window from the earlier payment |
| Missed-event recovery and reconciliation | done | `reconcile-commissions.ts`, `partner-reconciliation` job, `npm run reconcile:report` partner reports | `commissions.test.ts` (missed payment recovered then commissioned; recovered once); `reconciliation-sql.test.ts` (reports run on the migrated schema, SELECT only) |
| Stripe coupon / promotion-code integration | done | `manage-coupon.ts`, `stripeCouponGateway` | `coupons.test.ts` (campaign durations including the annual acknowledgement; taken code; suspended partner; Stripe refusal → failed; future start inactive then activated; deactivation with a reason); `stripe-adapters.test.ts` (Stripe parameters and idempotency keys); coupon-attributed commission in `commissions.test.ts` |
| Review cases for ambiguous financial information | done | see `docs/partner-program.md` | `commissions.test.ts` (mixed invoice, unsupported currency, credit/cash conflict) |
| Commission processing switch | done | `processProviderEvents` defers without claiming | `commissions.test.ts` (work waits with 0 attempts, then is processed) |
| Never from a checkout-success page | done | commissions only from verified Stripe reads in the worker; no success-page code path exists | code review |
| Stripe test-mode verification | blocked | — | As in Phase 2: no isolated Stripe test-mode webhook destination was available |

## Phase 4: dashboards and automated payouts

| Requirement | Status |
|---|---|
| Partner dashboard, commissions, payouts, resources, settings | planned |
| Admin partners, applications, attribution, commissions, coupons, fraud, payouts | planned |
| Monthly settlement and reservations | planned |
| Stripe transfer and bank payout adapter, stable operation ids | planned |
| Failed / unknown recovery, reversals, negative adjustments | planned |

## Phase 5: end-to-end validation and launch readiness

| Requirement | Status |
|---|---|
| Browser E2E (20 flows) | planned |
| Full suites, build, lint, security checks | planned |
| Runbooks, rollout order, external prerequisites | planned |
