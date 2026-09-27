# Release readiness: audit fixes and migrations 0034–0042

**Status: BLOCKED ON EXTERNAL ACTIONS.** The code, the tests and the migration procedure are ready. Four things are not, and each needs the owner or access nobody has granted (see "Blockers"):

- the staging rehearsal;
- the provider sandbox checks;
- the Stripe portal configuration;
- rotation of the exposed credentials.

Nothing has been committed, pushed, migrated or deployed. No production database, deployment, Inngest environment or live provider account was touched.

| | |
|---|---|
| Base commit | `2bc416e4c430c8dd55bf5e72c8e488ce2134749d` (all changes below are uncommitted on top of it) |
| Release files | 627 tracked and untracked, not-ignored files (`git ls-files -co --exclude-standard`) |
| Code manifest | `c6987ae81b23536d5d97b5cc28a2cb87252a7cd378688206a3c4d040ddbdafe4`: SHA-256 of the sorted `sha256  path` list of every release file outside `docs/` |
| Plugin package | `public/repget-connector.zip`, SHA-256 `4cdad728eace83b8faa13016ebf8dc62b84fbe001e9d4839fb9035f8b9664fc4`, plugin 1.5.2. Unzipped, it is byte-identical to `wordpress-plugin/repget-connector/`, the tested source |
| Migrations | 0034–0042, applied after 0033. Journal: 9 entries added, none changed. 0000–0033 are unchanged from the base commit |

To recompute the manifest from `platform/`, in Git Bash:

```sh
git ls-files -co --exclude-standard | grep -v '^docs/' | while read f; do [ -f "$f" ] && printf '%s  %s\n' "$(sha256sum "$f" | cut -d' ' -f1)" "$f"; done | LC_ALL=C sort -k2 | sha256sum
```

## Evidence levels

- **L – local or simulated:** unit tests, PGlite, stubbed WordPress, mocked providers.
- **DB – real database:** disposable PostgreSQL (pgvector PostgreSQL 17.11, Docker) or disposable MySQL 8.4.3 with WordPress 6.8.3, reached over independent connections or separate processes.
- **P – provider:** real Stripe test mode or PayPal sandbox API responses.
- **S – staging:** a restored copy of production data and a staging deployment.
- **PR – production.**

**No S or PR evidence exists.** P evidence is read-only (listed below).

## Checklist

Statuses: **verified**, **fixed and verified**, **blocked**, **accepted documented residual risk**.

### Security and access

| Requirement | Status | Evidence |
|---|---|---|
| Admin access requires a proven address (`emailVerified === true`) as well as `ADMIN_EMAILS`, in `requireAdmin()` and `isAdmin()`; the UI flag uses the same rule | fixed and verified | **L:** `guard.test.ts` covers unauthenticated, unverified, verification missing, null, `"true"` or `1`, verified non-admin, verified admin, and an empty allowlist. **L (real Better Auth over HTTP, PGlite):** `admin-auth.integration.test.ts` covers the real signup/session flow. **DB (built app, pgvector):** `/admin`, `/admin/payments` and the admin API route return 404 when unauthenticated, when unverified-allowlisted, and for a verified non-admin; a verified admin gets 200; the serialized `isAdmin` prop matched in every case. **Control:** against the base commit's guard and auth, 7 of the 17 new tests fail, including the real-flow intrusion |
| Endpoints that verify an address without revoking earlier access (`/email-otp/verify-email`, the password-reset paths) are disabled; one-time-code sign-in, which revokes earlier sessions and passwords, remains the owner's path; account linking keeps `requireLocalEmailVerified`; email change stays disabled | fixed and verified | **L:** the integration test shows every disabled path returns 404, and that after the owner's one-time-code sign-in the intruder's session and password are gone. **DB:** the built app returns 404 on `/api/auth/email-otp/verify-email` |
| No existing user is marked verified | verified | No migration or script sets `email_verified`. The UI check marked disposable test users only |
| Tenant boundaries, the owner's plan paying for guests (issue 14), OAuth state (issue 13), publishing credentials (issue 12), SSRF | verified | **L:** `tenant.test.ts`, `ownership.test.ts`, `oauth-state.test.ts`, `publishing/credentials.test.ts`, `safe-fetch*.test.ts`, `image-download.test.ts`. **DB:** another workspace's user gets the not-found page for a site's content page, and no data from that site appears in it |
| Backlink target ownership (issue 15); backlinks charged only after verified publication | verified | **L:** `ownership.test.ts`, `placements.test.ts` |
| Original issue 1 | not assessed separately | Its title is not in the requests or transcripts available here. The areas it could cover are verified by the rows above |

### Billing, quotas and jobs

| Requirement | Status | Evidence |
|---|---|---|
| Issue 2 (kept as implemented, with its regression tests) | verified | Full suite |
| Issues 3, 5 and 9: checkout reuse, unresolved and lost-response checkouts block without age-based release, cross-provider blocking, trial eligibility from history, checkout versus deletion, owner-only deletion with retained billing history | verified | **L:** `checkouts.test.ts` (48), `deletion.test.ts` (19). **DB:** `billing-concurrency.test.ts` (11, independent connections) |
| Issue 9: webhook ordering and ownership (claim tokens, stale snapshots, dead-worker recovery) | verified | **L:** `webhook-events.test.ts`, `late-webhooks.test.ts`. **DB (built app + Inngest dev server):** a dead claim and a released event were recovered by `billing-maintenance` |
| Issue 6: exact subscription targeting; durable owed cancellations | verified | **L:** `cancellation-targeting.test.ts`. **DB (Inngest):** an owed cancellation retried after 1, 2 and 4 minutes, with no provider reachable |
| Issues 4 and 7: durable consumption baseline, spend-started marker, monthly periods, released reservations, legacy baseline | verified | **L:** `spend-quota.test.ts`, `paid-operations.test.ts`, `generate-article.test.ts`, `credits-and-periods.test.ts`. **DB:** `cutover.test.ts`. **L:** `baseline-trigger-prerequisite.test.ts` (PGlite). The built app showed "0 of 30 articles left" after 30 articles were written and 11 of them deleted |
| Issue 8: atomic add-on and referral credits | verified | **L:** `credits-and-periods.test.ts` |
| Issues 11 and 16: transactional job delivery, ownership-safe terminal cleanup | verified | **L:** `outbox.test.ts`. **DB (Inngest):** `job-outbox-deliver` delivered new and previously failed jobs on its minute, including during the freeze |
| Selected-site billing | verified | **DB (built app):** `/billing?site=A` labels A's plan (Pro) "Current plan"; `?site=B` labels B's (Starter) |
| Pending-checkout messages, deletion-refusal messages, queued/retrying/failed job display | verified at function level only | **L:** the functions return these messages and states (`checkouts.test.ts`, `deletion.test.ts`, `outbox.test.ts`). **Not verified in a browser.** They are server-action responses, and no browser automation was run |

### WordPress plugin (issue 10)

| Requirement | Status | Evidence |
|---|---|---|
| Durable identity guid, ownership-checked lock, same-second renewal, acknowledgement retries, keep-oldest de-duplication | fixed and verified | **L:** `sync-idempotency.php` (stubbed WordPress). **DB:** `real-wordpress.php` (single process) |
| Genuinely concurrent processes | fixed and verified | **DB:** `real-wordpress-concurrency.php`, 45 checks, separate PHP processes released together at a file barrier: 8-way lock race; same-second renewal against 4 contenders; overlapping remote, cron and two manual syncs; lease takeover with the stalled owner unable to renew or release; a process killed between the post row and its meta, then recovered into the same post; failed acknowledgements retried by two overlapping processes; posts made by 1.5.0 updated, not duplicated. **Control:** four overlapping syncs with plugin 1.5.0 made 16 posts for 4 articles; 1.5.2 made 4 |
| Package matches the tested source | verified | The ZIP unzips byte-identical to the source. The plugin did not change in this round, so it was not rebuilt |

### Migrations and cutover

| Requirement | Status | Evidence |
|---|---|---|
| Real migration sequence with pgvector; freeze and drain; concurrent writers and cascading deletes; trigger prerequisites; read-only reconciliation; unfreeze only once the prerequisites pass | verified (disposable, synthetic data) | **DB:** both paths on pgvector PostgreSQL 17.11 with the unmodified files. 0 successful writes inside the freeze, by the database clock. Every post-unfreeze article, including cascade-deleted ones, counted exactly once. Details in `docs/migration-cutover.md` → Rehearsal record |
| Failure and recovery | verified (disposable) | **DB:** a lock timeout injected at 0042 (path B, after 0041 committed) and at 0041 (path A, fully rolled back). The freeze held, the unfreeze refused, and recovery followed the runbook. 0041 was never run a second time |
| Early-transaction test (a transaction begun before the freeze, writing after it) | verified | **DB:** `cutover.test.ts`, unchanged |
| Application rollback against the migrated schema | verified, with hazards documented | **DB:** HEAD's schema and statements against the migrated database, 7 checks. HEAD swallows webhook events awaiting recovery and has no outbox drain; see Rollback in the runbook |
| Staging rehearsal on a restored, authorized backup | **blocked** | No staging database or backup was available or authorized |
| Inngest registration, recovery and pause semantics | verified (isolated) | **DB:** built app + local Inngest dev server + disposable database, with no keys; 19 functions registered, and the crons ran on schedule. Pausing drops events (Inngest documentation), so the runbook now says not to pause |

### Automation, dependencies and credentials

| Requirement | Status | Evidence |
|---|---|---|
| CI: `npm ci`, typegen, tsc, lint, tests with required pgvector Postgres, build with no secrets, PHP harness, ZIP identity, real WordPress + MySQL, concurrency | fixed; verified locally | `.github/workflows/ci.yml`. Each command was run locally (below). **The workflow has not run on GitHub**, because nothing was pushed |
| Clean install and build without `.env` files | verified | **L:** an isolated copy took `npm ci` (npm 10.9.8, Node 22.22.3) → typegen → tsc → lint → 440/440 tests (pgvector required) → `next build` with an empty environment, exit 0 |
| Secret scan | verified | `docs/credentials.md` → Secret scan: working tree, staged content and history reported separately |
| `npm audit` (4 moderate), `--omit=dev` (4), `--omit=optional` (4), `--omit=dev --omit=optional` (0) | accepted documented residual risk | Every finding is esbuild 0.18.20, via drizzle-kit → `@esbuild-kit/*` (GHSA-67mh-4wv8-2f99, dev-server CORS). The latest stable drizzle-kit (0.31.11) still has it; only a 1.0 prerelease drops it. No runtime path found; see `docs/dependencies.md` |
| DataForSEO credential rotation | **blocked** | Needs the account's dashboard login and the owner's authorization. Steps in `docs/credentials.md` |
| Other exposed credentials (the notes file outside the repository, the SSH key) | **blocked** | Owner plan in `docs/credentials.md`. Nothing was moved, deleted or revoked |

### Providers

**Read-only facts (P).** Stripe was used with a test key (`sk_test_`), account `acct_…NfJ`. PayPal was used in sandbox, where the OAuth token was issued.

- **Webhook endpoints.** Test-mode webhooks for both providers deliver to `full-stack-sass-ai-seo-improvement.vercel.app`. Stripe sends 6 event types, and PayPal 7; the PayPal endpoint is the one `PAYPAL_WEBHOOK_ID` names.
- **Existing test data.** 23 test subscriptions exist: 9 active, 6 trialing, 8 canceled.
- **Portal.** The default portal configuration has `subscription_update` **disabled** with 0 products; cancellation is at period end.
- **Plans and prices.** PayPal has 5 sandbox plans (4 active). Stripe has 11 active test prices, 7 of them recurring.

| Requirement | Status | Evidence |
|---|---|---|
| Stripe test-mode and PayPal sandbox behaviour: checkout reuse, pending, unresolved and lost-response checkouts, cross-provider blocking, trials, plan changes, cancellation targeting, checkout versus deletion, duplicate and delayed webhooks, cancellation recovery, portal flows, create idempotency, plan-revision approval links | **blocked** | Any test resource would send webhooks to the deployed app above, which runs the old code against a database this work may not write to. **Only L evidence (mocked providers) exists; it is not sandbox verification** |
| Stripe portal supports plan changes | **blocked (configuration)** | "Switch to this plan" uses `subscription_update_confirm`. Stripe requires the price to be in `features.subscription_update.products`, and the test default configuration is disabled. Plan changes fail there until the owner configures it (runbook → Operator follow-up) |
| PayPal `custom_id` length | verified (L plus documentation) | `organizationId:websiteId:checkoutId` is at most 36+1+36+1+36 = 110 characters, within PayPal's 127. Not exercised against the sandbox |

## Blockers and the minimum owner action

1. **Sandbox isolation.** Give the checks an isolated webhook destination. Either:
   - create a separate Stripe sandbox and a separate PayPal sandbox app, each with its own webhook pointing at a preview deployment backed by a disposable database; or
   - authorize pausing the two test-mode endpoints for the duration.

   Then run the provider checklist above.
2. **Stripe Customer Portal.** In test and live: enable "Customers can switch plans" and add every plan's product and price.
3. **Staging.** Name a staging database and deployment, restore an authorized production backup into it, and run `docs/migration-cutover.md` from step 1.
4. **Credentials.** Rotate the DataForSEO API password (steps in `docs/credentials.md`), then work through the rest of that document's plan.
5. **Production.** Requires explicit authorization for the exact target, once 1–4 are done.

## Commands run for this release (2026-09-26)

| Command | Where | Result |
|---|---|---|
| `npm ci --no-audit --no-fund` | isolated copy, no `.env` | 1189 packages, exit 0 |
| `npx next typegen`, `npx tsc --noEmit`, `npx eslint` | isolated copy and working tree | exit 0 |
| `npx vitest run` with `TEST_POSTGRES_URL` (pgvector), `REQUIRE_TEST_POSTGRES=1`, `REQUIRE_PGVECTOR=1` | isolated copy (twice) and working tree | 27 files, 440 passed, 0 skipped |
| `npx vitest run` with no Postgres | working tree | 421 passed, 19 skipped: `cutover.test.ts` (8) and `billing-concurrency.test.ts` (11), which need `TEST_POSTGRES_URL`. Two of the first three runs failed in the admin integration test on timeouts under load: once in setup (60 s hook limit), and once in a single test. 9 further runs passed unchanged. Its timeouts were then raised (setup 180 s, tests 120 s), and two full runs executed concurrently both passed |
| `next build`, empty environment | isolated copy | exit 0 |
| `npm run plugin:test` | working tree | ALL PASSED |
| `php wordpress-plugin/tests/real-wordpress.php …` | MySQL 8.4.3, WordPress 6.8.3 | ALL PASSED |
| `php wordpress-plugin/tests/real-wordpress-concurrency.php …` | same | 45/45 |
| `npm run check:secrets`, `-- --all`, history scan | working tree | nothing found |
| four `npm audit` variants | isolated copy (same lockfile) | 4 / 4 / 4 / 0 moderate |
