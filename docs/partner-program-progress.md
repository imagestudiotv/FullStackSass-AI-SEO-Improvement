# Partner program: implementation progress

Five sequential phases, one commit each. This file maps every requirement to the phase that delivers it and records what was actually verified. Design and decisions: [partner-program.md](partner-program.md).

Statuses: **done** (implemented and verified as stated), **in progress**, **planned**, **blocked** (needs something outside this repository).

| Phase | Commit title | Status |
|---|---|---|
| 1 | `feat(partners): [1/5] establish domain architecture and persistence` | done |
| 2 | `feat(partners): [2/5] implement onboarding and referral attribution` | planned |
| 3 | `feat(partners): [3/5] implement commissions and billing reconciliation` | planned |
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

| Requirement | Status |
|---|---|
| Public `/partners` page and application flow | planned |
| Legacy credit referrals still reachable | planned |
| Admin review, approval, rejection, suspension | planned |
| Same-login portal without subscription | planned |
| Referral codes, links, welcome email (once) | planned |
| Secure tracking, signup eligibility, expiry, locking | planned |
| Email / Google / one-time-code signup; invitation exclusion | planned |
| Coupon ownership and attribution rules | planned |
| Consent, rate limits | planned |
| Stripe connected account and hosted onboarding, readiness states | planned |

## Phase 3: Stripe billing and commissions

| Requirement | Status |
|---|---|
| Durable affiliate work recorded inside the webhook boundary | planned |
| Invoice payment normalization (cash, tax, discounts, credits) | planned |
| Refund / dispute normalization, cumulative reversals | planned |
| Tier history and rate snapshots | planned |
| Ledger entries and adjustments | planned |
| Duplicate / concurrent / delayed / out-of-order handling | planned |
| Recovery job and reconciliation queries | planned |
| Coupon / promotion-code integration | planned |

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
