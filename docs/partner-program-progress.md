# Partner program: implementation progress

Five sequential phases, one commit each. This file maps every requirement to the phase that delivers it and records what was actually verified. Design and decisions: [partner-program.md](partner-program.md).

Statuses: **done** (implemented and verified as stated), **in progress**, **planned**, **blocked** (needs something outside this repository).

| Phase | Commit title | Status |
|---|---|---|
| 1 | `feat(partners): [1/5] establish domain architecture and persistence` | done (7184a11) |
| 2 | `feat(partners): [2/5] implement onboarding and referral attribution` | done (3b22c46) |
| 3 | `feat(partners): [3/5] implement commissions and billing reconciliation` | done (c306075) |
| 4 | `feat(partners): [4/5] deliver dashboards and automated payouts` | done (60c87f2) |
| 5 | `test(partners): [5/5] verify end-to-end flows and launch readiness` | done (this commit); Stripe test-mode verification blocked |

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

| Requirement | Status | Where | Verified by |
|---|---|---|---|
| Monthly settlement selection and reservations | done | `use-cases/prepare-settlement.ts`, `partner-payouts-monthly` (00:00 UTC on the 1st) | `settlements.test.ts`: EUR 24.75 carried forward below EUR 25.00, then paid with the next mature commission (EUR 49.50) a month later; a re-run reserves nothing twice; suspended / held / unready / switched off pay nothing |
| Stripe transfer and bank-payout adapter, stable operation ids | done | `infrastructure/stripe/payout-gateway.ts`; `partner-transfer:<id>:<n>`, `partner-payout:<id>:<n>`, `partner-reversal:<id>:<n>` | `settlements.test.ts` with a fake Connect that is idempotent like Stripe; adapter parameters from the SDK 22.6.0 types |
| Successful transfer with bank payout still pending; bank paid only on Stripe's word | done | `execute-transfer.ts`, `execute-bank-payout.ts`, Connect `payout.*` events | `settlements.test.ts`; `dashboards.test.ts` (transferred, not bank-paid) |
| Account restrictions, insufficient platform funds | done | transfer pre-flight | `settlements.test.ts`: a restricted account's payout is cancelled and its commissions released; too little platform balance waits with nothing sent, and after 8 attempts opens a `payout_funding` case and releases the payout |
| Live money only with `PARTNER_LIVE_PAYOUTS=enabled`; one unsettled payout at a time; payouts already sent keep moving with the switch off | done | settings, partial unique index, payout stage | `settlements.test.ts` |
| Timeouts and ambiguous outcomes | done | `transfer_unknown` resolved by `transfer_group`, same idempotency key within 23 h | `settlements.test.ts`: timeout, and an answer lost after the transfer was made → one transfer |
| Failed bank payout retries never create a second transfer | done | bank payout attempts separate from transfers | `settlements.test.ts` |
| Concurrent jobs cannot pay the same earnings twice | done | balance-row lock, settlement lease, one-live-transfer index | `settlements.postgres.test.ts` (real PostgreSQL, 4 connections): four runs reserve once; four workers make one transfer and one ledger entry |
| Admin hold racing the monthly run | done | locks in the documented order | `settlements.postgres.test.ts`: 8 alternating rounds, both orders exercised; a held commission is never inside a payout. Mutation check: without the reserved-status guard the test fails |
| Deadlock between ledger writes and partner locks | done (found and fixed in this phase) | every row lock `FOR NO KEY UPDATE` | The race test above hit `deadlock detected` about once in six runs; `settlements.postgres.test.ts` now reproduces the exact interleaving deterministically (fails with `FOR UPDATE`, passes with `FOR NO KEY UPDATE`); 10 consecutive runs of the race suite clean |
| Transfer reversals and negative adjustments | done | `reconcile-settlement.ts`, `manage-commission.ts` | `settlements.test.ts`: refund after payout offset against the next payout or recovered once by reversal, never more than owed; outside reversal recorded once with a case. `dashboards.test.ts`: negative adjustment deducted; a credit no commission backs refused |
| Suspended / held partners cannot receive automatic payouts | done | prepare and pre-flight | `settlements.test.ts` |
| Complete partner dashboard (five figures, definitions, metrics, tier, link, setup, coupons) | done | `/partner`, `queries/partner-dashboard.ts`, `presentation/views.ts`, `components/partners/dashboard-views.tsx` | `dashboards.test.ts`: figures reconcile with the raw ledger after reservation, transfer and a refund (earned = pending + available + in payout + transferred − corrections); the admin area shows the same numbers. Render tests in all five languages |
| Commission, payout and referral histories; privacy-safe labels | done | `/partner/commissions`, `/partner/payouts`, `/partner/referrals` | `dashboards.test.ts`: own records only, masked domain or opaque reference; a context naming another partner's id sees nothing |
| Promotional resources | done | `/partner/resources`, `public/partners/banners/*` (5 languages × 3 sizes) | Render tests: downloads, every template with the partner's link, rules |
| Full administrator controls | done | `/admin/partners/{attribution,commissions,payouts,payouts/[id],reviews,coupons}`, partner detail | `dashboards.test.ts`: hold / release (dispute hold refused), reject with a reversing entry, approve, adjust, prepare now (once per month), retry (audited; refused under review), reconcile now (audited), preview with blockers; admin reports refuse a non-admin context |
| Reports and exports | done | `/admin/partners/export/[report]` | `dashboards.test.ts` (exact decimals, no email); `presentation.test.ts` (formula injection, CSV format) |
| Configuration readiness and actionable errors | done | `/admin/partners`, `/admin/partners/payouts` readiness; admin action messages | Code review; browser check below |
| Mobile / desktop, light / dark; keyboard; dialogs; states | done | isolated production build (app copy with no `.env` files, empty environment, throwaway database on the disposable cluster, seeded through the real use cases with fake Stripe gateways) | Headless Chrome, 7 partner and 12 admin pages × desktop 1440 / phone 390 × light / dark = 76 renders: all 200, no horizontal overflow, no console or CSP errors (other than Vercel Insights, absent off Vercel), no unfilled placeholder. Partner blocked from `/admin/partners` and the CSV export (404); signed out sent to sign-in; visible focus on every control reached by keyboard; coupon, adjustment, hold and disqualify dialogs fit a 390 px phone with focus inside; CSV export is an attachment without emails. Contrast: the danger buttons were changed to the danger tokens after the shared `destructive` variant measured 3.5-4.2:1; no partner-page finding remains. Remaining, outside this work: the admin sidebar's "Admin" label (3.69:1) and the default orange primary button (3.46:1) |
| Real Stripe test-mode flow | blocked | — | Not run: the only Stripe test key available delivers webhooks to the deployed application, and creating connected accounts, transfers or payouts with it was not authorised. Every Stripe path is exercised against fakes that follow the SDK types |

## Phase 5: end-to-end validation and launch readiness

| Requirement | Status | Where | Verified by |
|---|---|---|---|
| Browser E2E of the 20 flows | done | `e2e/partners/*` (runner `app.mjs`, Chrome over the DevTools protocol, vitest; [README](../e2e/partners/README.md)) | 37 tests in 4 files covering the 20 flows (+ the Connect route and a refund between transfer and bank payout), against an isolated production build and a throwaway database: 37 passed in three consecutive runs on the final build. What is real and what is faked is listed in the README: the app, routes, sign-up/sign-in forms, guards, pages, server actions and the Stripe webhook routes are real; Stripe is a fake at the adapter boundary and the Stripe-dependent step of a flow runs as the real use case in the tests' process |
| Defects found by the E2E run and by a review of the complete diff, fixed | done | see [partner-program.md](partner-program.md), "Review fixes (Part 5)"; migration `0065_partner_program_review_fixes.sql` | `review-fixes.test.ts` (16), new cases in `settlements.test.ts`, `attribution.test.ts`, `entry-points.test.ts`, `persistence.test.ts`, `presentation.test.ts`, `dashboards.test.ts`; mutation checks: undoing the rejected-is-final, one-reversal-at-a-time, no-re-send-while-off and coupon-fraud fixes each fails its test; undoing the IPv6 comparison fails its test |
| Unit, integration and offline regression suites | done | `npm test` | 3103 passed, 93 skipped (the real-PostgreSQL files without `TEST_POSTGRES_URL`); no unrelated baseline failure |
| Financial concurrency on real PostgreSQL | done | every `*.postgres.test.ts` | 16 files, 94 passed, sequentially on a disposable PostgreSQL 18.3 cluster (127.0.0.1:55461) |
| TypeScript, lint, architecture | done | `tsc --noEmit`, `eslint .`, `architecture.test.ts` | clean; architecture test passes |
| Production build with a safe isolated configuration | done | `node e2e/partners/app.mjs build` on an app copy with no `.env` file and an environment built from scratch | succeeded (Next.js 16.3.8, all partner routes compiled) |
| Repository security and database checks | done | `check:secrets`, `check:db-security` (on the throwaway database), `check:csp-routes` (on the isolated build), `plugin:test` | no credentials found; 93 tables with RLS and no API-role privileges; no prerendered route under the nonce CSP; plugin harness all passed |
| Launch documentation | done | [partner-program-launch.md](partner-program-launch.md) | Rollout order, environment variable names, Stripe Connect enablement and currency limitation, webhook events, test/live isolation, funding, transfer vs bank-payout accounting, schedules, support procedures, disablement and rollback, exact external prerequisites |
| Stripe test-mode verification | blocked in Part 5; **done 2026-10-20** | [partner-program-launch.md](partner-program-launch.md) section 5 | Part 5: not run (the only test key delivered webhooks to production). 2026-10-20: run against a separate sandbox through the Stripe CLI and a local Inngest. It found that Stripe refuses Accounts v1 for new Connect platforms; fixed with Accounts v2 plus a manual payout schedule. Then all seven steps passed: onboarding ready; EUR 24.75 commission; partial refund reversing EUR 2.48; coupon attribution with EUR 22.28 on EUR 89.10; one transfer of EUR 44.55; a failed bank payout (`no_account`), then paid after the partner fixed the bank account and the admin retried; reconciliation with 0 findings |
| Live payouts | not ready | — | Require the production migration, Stripe Connect configuration, the test-mode verification above, platform funding and `PARTNER_LIVE_PAYOUTS=enabled`; all off by default |
| Disposable fixtures removed; production untouched | done | — | Throwaway databases (`repget_e2e_partners`, `partner_preview`), the run's state file with its generated secrets, the preview seed and browser profiles removed; the disposable cluster stopped. Production checked read-only (a READ ONLY transaction printing counts only): 63 migrations applied (up to 0062), no partner tables, no partner switches, no ledger trigger - unchanged. Nothing was deployed or pushed |
