# Day 1 security work — 2026-10-05

Scope: article HTML, shared authentication throttling, CSP rollout, dependency
advisories and credential-rotation evidence. UI redesign and backlink/SEO policy
changes belong to subsequent days. No deployment or production migration was
performed as part of this work.

## Changes

- `sanitize-html` 2.18 replaces regex-based HTML parsing. The malformed-quote
  payloads that retained `onerror` and `javascript:` URLs are regression cases.
  The same policy runs on saves, previews, admin review, public blog bodies and
  FAQ answers, and the exact payload sent to a CMS. Existing stored revisions
  receive protection without rewriting their approval state.
- Safe formatting, heading IDs, image dimensions, tables, internal links and
  the existing recorded-placement policy remain supported. Delivery adds its
  trusted formatting only after sanitization and is idempotent.
- Authentication uses a shared PostgreSQL bucket per Better Auth visitor/path
  key, stored as a SHA-256 digest. A conditional `INSERT ... ON CONFLICT`
  checks and increments under the database row lock. Limits survive process
  restarts. Rejected attempts do not extend the window. Store errors fail
  closed; no memory fallback exists. Old buckets are removed in bounded batches.
- CSP supports `CSP_MODE=report-only` (default) and `CSP_MODE=enforce`. Private
  application and authentication documents receive a fresh nonce, strict
  script policy, no inline event handlers and no-store caching. Cached public
  pages retain their inline Next.js bootstrap allowance; this is deliberately
  not a claim of strict nonce protection on every route. Styles still allow
  inline CSS. Crisp initialization now runs from the trusted application bundle.
- A scoped override upgrades the deprecated `@esbuild-kit/core-utils` chain to
  esbuild 0.25.12, without downgrading Drizzle Kit. CI audits both production
  dependencies and the complete dependency tree.

The sanitizer requires Node >=22.12.0; CI uses Node 22.

## Release sequence

1. Confirm Node >=22.12.0, back up the target database and apply migration **0050_auth_rate_limits**
   using the established migration runner, after 0049. It only adds the rate
   limit table and expiry index, with RLS enabled. The application database
   role needs server-side access, as for the existing auth tables. Do not
   substitute schema push for the migration runner.
2. Deploy a staging build with `CSP_MODE=enforce`. Set it at both build time
   and runtime: Next's global headers are built into the release, while the
   nonce proxy reads runtime configuration. Do not change just one side.
3. Check sign-in, OTP, Google OAuth, customer/admin article previews, editor
   saves, chat, CMS delivery and payment redirects using staging/test accounts.
   Inspect browser CSP violations and Sentry reports. Local fixtures cannot
   establish that every live provider origin and redirect is allowed.
4. Run the stored-content inventory below against a restored copy first, then
   an explicitly selected production read-only connection. Review flagged
   records before any repair. Sanitization can change harmless serialization,
   so a flagged row is not automatically a confirmed attack.
5. Once staging checks pass, deploy the same tested code with migration 0050
   already present. Enable enforcement with a rebuild after validating the
   production integration origins. A report-only deployment reports violations
   but does **not** block them. CSP applies to the loaded document; client-side
   navigation does not replace that document's existing policy.

Do not deploy the new auth code before the migration: missing/denied table
access intentionally prevents authentication requests from bypassing limits.
If CSP breaks an integration, rebuild with `CSP_MODE=report-only` on both sides
while correcting the policy. Keep the sanitizer, shared limiter and migration.
The IP headers are trusted only behind an ingress that overwrites them (the
current Vercel deployment); a directly exposed origin needs its own trusted
proxy configuration.

## Read-only stored-content inventory

`npm run check:stored-html` requires **SCAN_HTML_DATABASE_URL** explicitly.
It never loads `.env.local` or falls back to `DATABASE_URL`. Use a read-only
database role where available. The script also starts a server-enforced
read-only, repeatable-read transaction, pages through articles, article
versions and blog bodies/FAQ answers, and has a 15-second statement timeout.

Output contains table names, record IDs and changed field names, followed by
counts. It contains no article bodies or connection credentials. There is no
write mode. It has only been exercised against disposable local fixtures;
production content has **not** been scanned or repaired.

## Dependency finding still open

Full lockfile audit: **9 high findings, 0 moderate, 0 critical**. All nine are
the dependency graph for one upstream issue,
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), in
`braces` through ESLint/shadcn/globbing tools. The advisory lists no patched
release as of this review. These packages are build/development tooling;
that does not make processing untrusted input in CI harmless.

The complete-dependency CI audit intentionally remains red until a compatible
fix is available or an owner explicitly accepts a narrowly scoped exception.
No advisory is silently suppressed. Keep untrusted builds isolated from
secrets; do not downgrade Next's lint configuration or Drizzle Kit merely to
make `npm audit` green. Dependabot remains configured for updates.

The esbuild development-server issue
[GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) is removed
from the updated lockfile by the scoped override. Do not start exposed legacy
development servers from older installs.

## Credential evidence

The repository secret scan checks code, not provider revocation. Existing
`docs/credentials.md` and `docs/release-readiness.md` still record credential
rotation as blocked/unconfirmed. No new provider-side rotation evidence was
available in this review. In particular, the previously exposed DataForSEO
credential and WordPress connector key must not be marked resolved based on
a clean scan or a changed local environment file.

The account owner must record provider-side replacement/revocation evidence,
deployment verification and the date, without recording secret values. Follow
the existing credential-specific caveats, especially the CMS credential
encryption key's re-encryption requirement. No credentials were rotated here.

## Validation

Only disposable PostgreSQL and local browser fixtures are used; no paid
provider call, real WordPress publish, production migration, commit or
deployment is part of these checks.

- Production Next.js/Turbopack build: passed, including its TypeScript check.
  All dotenv configuration was overridden with empty values or local fixture
  settings. The build/runtime used `CSP_MODE=enforce` and a disposable database.
- ESLint: full-project run passed. A later targeted lint and standalone
  TypeScript check also passed after updating the serialization assertions.
- Focused security tests: 62 passed initially; nonce/header tests: 17 passed.
  After the full-run failures, an isolated rerun of all affected files plus the
  limiter and read-only scan passed **83 tests in 10 files, with none skipped**.
- Real PostgreSQL 18: repeated 36-request races over 12 separate connections
  admitted exactly 10 requests; expiry/reset races, restart persistence,
  visitor/path isolation, bounded pruning and unavailable-table refusal passed.
  The local server lacks pgvector, so the existing test harness substitutes
  text for the unrelated vector column. CI still requires real pgvector.
- Chrome against the production build: sign-in hydration, fresh nonces,
  parser-inserted script/event-handler rejection, dashboard, article preview,
  admin review and public page checked with zero unexpected CSP violations or
  page errors. Chat loaded on interaction under CSP using an intercepted fixture
  SDK response; this does not certify the complete live Crisp service.
- Chrome without CSP: the original malformed-tag payload executed as a
  positive control, while the new browser sanitizer removed its handler and
  a malformed `javascript:` anchor. Sanitization therefore stands independently
  of CSP enforcement.
- Read-only inventory: reports a stored malformed payload and leaves its
  original database row unchanged. No production scan was run.
- esbuild-kit synchronous/asynchronous transforms and Drizzle Kit generation
  of a disposable fixture schema passed with the override. `npm ci --dry-run`
  validates the manifest/lockfile combination. Runtime audit: **0 findings**;
  full audit: **9 high**, the unresolved upstream graph above.
- Secret scan (`--all`): **986 files**, no findings. This is not evidence of
  credential rotation and does not certify external notes or provider accounts.

The initial full-suite run, concurrent with a cold production build, had two
serialization expectation failures (corrected), one timing-sensitive database
assertion failure and six database setup/cleanup hook timeouts. The isolated
83-test rerun passed all affected cases.

The final full-suite run passed **1,888 tests**, with **one test skipped** because
its file's disposable-database setup exceeded the 180-second hook timeout.
Result: 140 files passed, one failed; the full command exited nonzero. Vitest
also reported a worker-shutdown timeout. PostgreSQL logged a 273-second
checkpoint, including 147 seconds syncing files, which supports disk contention
as a contributor but does not establish the sole cause. A subsequent isolated
run of `stored-html-scan.postgres.test.ts` passed **both tests in 11.35 seconds**.
There were no assertion failures in the final full run, but it is **not a clean
full-suite pass**. Rerun the full suite in CI or a stable local environment before
release; the separate dependency-audit gate also remains unresolved as above.
