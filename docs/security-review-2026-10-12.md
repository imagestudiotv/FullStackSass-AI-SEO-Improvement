# Security hardening - 2026-10-12

Seven findings from the previous review, rechecked against the current code and fixed here. Nothing in this document is a secret value; credentials are named by variable only.

Status words used below:

- **Implemented and tested**: in the working tree, with tests that pass locally.
- **Prepared, not applied**: needs a deployment, a migration or a plugin install by the owner (see the checklist).
- **Awaiting the owner**: needs access this review did not have (provider consoles, Vercel, the WordPress admin of imagestudio.com).

No production migration, deployment, plugin install, credential rotation, payment or email was performed. Production was only read: catalog/aggregate queries in read-only transactions, and public `GET`s of www.repget.com's headers.

## 1. Database access controls (RLS and grants)

**Found (rechecked read-only on production):** 67 tables, 3 without RLS (`blog_posts`, `blog_categories`, `plugin_connect_requests`); `anon` could `SELECT` all 67 (table privileges from Supabase's default privileges); every function in `public` executable by `PUBLIC`. The app connects as `postgres` (owner, BYPASSRLS, not superuser). No views, no policies.

**Changed:**

- `drizzle/0056_rls_hardening.sql` (forward migration): RLS on every table; revokes table, sequence and function privileges from `anon`/`authenticated` (and `PUBLIC` on functions, extension functions excluded); removes them from the migration role's default privileges so new objects start closed. No policies, no FORCE, `service_role` untouched. Header explains each choice and how to reverse it.
- `src/lib/db/table.ts`: the schema's `pgTable` always enables RLS, so `drizzle-kit generate` keeps emitting it for new tables (fresh installs and upgrades alike).
- `scripts/check-db-security.mjs` / `src/lib/db/security-check.mjs`: read-only check (RLS off, API-role privileges, executable functions, permissive policies, open default privileges); `npm run check:db-security` with an explicit `CHECK_DATABASE_URL`, never `.env.local`.
- CI gate: `src/lib/db/rls.postgres.test.ts` replays every migration into Postgres set up like Supabase and fails on anything open; `src/lib/db/table.test.ts` fails on a table defined without RLS. Rules for new tables/functions: `drizzle/README.md`.

**Status:** implemented and tested (real Postgres 18: roles get `42501` on select/insert/update/delete/truncate of drafts and handshake rows; a stray grant is still stopped by RLS; the app role still runs the blog and the WordPress handshake; the check catches the pre-0056 state). **Prepared, not applied** to production. Production baseline from the read-only check: 149 problems, expected 0 after 0056.

## 2. Google Analytics / Search Console isolation

**Found:** any member (including a viewer) could list every property in the connected Google account; an invited editor could select another client's property; the import trusted whatever property ids were stored.

**Changed:** `src/lib/analytics/property-access.ts` (who may list/choose/replace), `actions.ts` (listing and choosing only for the owner or whoever connected Google; ids validated and checked against the account's own lists; choice stored with an approval bound to the connection), the callback (`connectedBy`; a guest cannot replace the owner's connection), the import (`approvedBinding`, re-checked reachability before fetching), the panel UI and messages in five languages.

**Compatibility:** the existing production connection (legacy, no `connectedBy`) keeps importing; its owner sees a "confirm properties" notice. **Status:** implemented and tested (16 tests); prepared, not applied.

## 3. HTTPS for authenticated integrations

**Found:** WordPress/Ghost/webhook credentials could be sent to an `http://` URL, and redirects could downgrade or change origin.

**Changed:** `safeFetch` gained a `credentialed` mode (HTTPS before any DNS lookup or connection, no downgrade, no cross-origin redirect; `InsecureTransportError`, 426); cross-origin redirects now keep only an allow-list of harmless headers. WordPress, Ghost, webhook and plugin sync use it; Shopify, Webflow, Wix, DataForSEO and Google calls refuse redirects; the connect form refuses `http://`. Public crawling of HTTP sites is unchanged.

**Compatibility:** production has no WordPress/Ghost/webhook integrations; both plugin sync URLs are HTTPS. **Status:** implemented and tested (safe-fetch 67 tests, `https.test.ts` 6).

## 4. Credential exposure and secret hygiene

See [credentials.md](credentials.md): the 2026-10-12 recheck (files still present; DataForSEO known exposed; the plain-text SSH key **verified still registered** on GitHub; nothing verified revoked), the provider-by-provider runbook and the rotation log. Scanner: index copies of staged files, `--history` over every commit (CI now runs it on a full clone), new patterns, never prints values (`src/lib/secret-scan.test.ts`). Ignore rules now cover database dumps.

**Status:** prevention implemented and tested; **every rotation awaits the owner**. The exposure is not resolved.

## 5. Public audit and free-tool abuse

**Found:** the audit's "60 an hour" counted cached successes, so 70 failed attempts all reached the crawler; the other tools had no limit; visitor identity trusted any forwarding header.

**Changed:** `src/lib/tools/public-guard.ts` - capacity reserved atomically in the shared quota store (`reserveAll`, Postgres advisory locks) before any fetch, per visitor (hour/day), per site, overall; one request per site at a time and a bounded pool of concurrent fetches (`operation_leases`); failures count; cached results are free; any store error refuses. Applied to the audit, llms.txt, sitemap, robots, meta tags, readability/keyword density, and AI crawler checks. `src/lib/visitor-key.ts`: forwarding headers only on Vercel or a configured `TRUSTED_CLIENT_IP_HEADER`, valid IPs only, IPv6 per /64; otherwise one shared bucket.

**Status:** implemented and tested (PGlite 12, real Postgres 3 with 12 connections). Takes effect on deploy.

## 6. WordPress placement requests (Image Studio Blog 2.2.0)

**Found and reproduced (real WordPress 6.8.3 + MySQL 8.4, plugin 2.1.0):** 12 requests from one client spoofing CF-Connecting-IP, sent together: 12 accepted (limit 5); 12 requests for one email from 12 addresses at once: 12 accepted (limit 5); 12 sequential requests spoofing X-Forwarded-For: 12 accepted.

**Changed:** `includes/limits.php` - REMOTE_ADDR unless it is a configured trusted proxy, then only the chosen header, X-Forwarded-For read from the right, IPs validated, IPv6 per /64; settings for the proxies/header with a "requested from / counted as" line; atomic reservation in one InnoDB transaction on a lock row (not options or transients), tables created on first use, fail closed. PayPal verification untouched.

**Status:** implemented and tested (stubbed harness; real WordPress concurrency suite in CI: exactly 5/5/7 under 12 simultaneous processes, spoofing, trusted-proxy chains, windows, fail-closed, and PayPal's notice still paying once, only with the request's secret). **Awaiting the owner:** install `wordpress-plugin/releases/imagestudio-blog-2.2.0.zip` on imagestudio.com and do README step 8.

## 7. Content Security Policy enforcement

**Found:** www.repget.com sent its CSP as `Content-Security-Policy-Report-Only` on every page (rechecked 2026-10-12): nothing was blocked. The proxy read `CSP_MODE` at runtime while the cached pages' headers were fixed at build, so the two could disagree. Crisp and Google's tag were allowed with subdomain wildcards (`*.crisp.chat`, `*.googletagmanager.com`) whatever the deployment used.

**Changed** (`src/lib/security-headers.ts`, `src/proxy.ts`, `next.config.ts`):

- **Enforced by default** in production builds. `CSP_MODE=report-only` is a temporary rollback; any other value fails the build.
- **One mode per build**: next.config.ts validates `CSP_MODE` once, writes it into the cached pages' headers and inlines it into the proxy (`env.REPGET_CSP_MODE`); a different runtime value is logged and ignored. Each response carries exactly one policy.
- **Only configured integrations are allowed**, each narrowed to the hosts its vendor documents: Crisp only with `NEXT_PUBLIC_CRISP_WEBSITE_ID` (`client.crisp.chat`, `storage.crisp.chat`, `client.relay.crisp.chat` incl. its websocket and rescue fallback; no frames any more); Google's tag only with a GA4 id or GTM container (`www.googletagmanager.com` for scripts; hits to `*.google-analytics.com` / `*.analytics.google.com`, connect-src only); Google Ads hosts only with a GTM container (`*.doubleclick.net` narrowed to `*.g.doubleclick.net` + `ad.doubleclick.net`); Sentry only with a DSN. YouTube's privacy-enhanced frame host stays (homepage video). `manifest-src 'self'` added.
- **Nonce policy** (fresh 192-bit nonce per response, `'strict-dynamic'`, no `'unsafe-inline'` for scripts, `script-src-attr 'none'`, `no-store`; a caller's `x-nonce` or CSP request header is overwritten) on the dynamic private/auth routes as before, and **now also on the public pages that are rendered per request anyway and show stored or third-party content**: `/blog` and every blog page (also `/<locale>/blog`), `/audit` and the eight dynamic free tools. Those pages were already dynamic (no CDN caching lost) and are where injected content would most likely appear. `npm run check:csp-routes` (CI, after the build) fails if any page under the proxy's matcher is ever prerendered - its scripts could not carry a nonce.
- **Cached public pages (home, pricing, about, FAQ, docs, the static tools index...) - a documented limitation, not a strict policy.** Prerendered/ISR pages cannot carry a per-request nonce, and Next's inline bootstrap scripts differ per build and page, so their policy keeps `script-src 'unsafe-inline'` (with the host allow-list, no `'unsafe-eval'`, `script-src-attr 'none'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, `frame-ancestors 'self'`). It limits where code may come from and blocks inline event handlers, but not an injected inline `<script>`. These pages render no stored user content (the blog moved to the nonce policy), so escaping by React is the defence there. `style-src 'unsafe-inline'` remains everywhere (React style attributes; Crisp requires it). Making cached pages dynamic just to nonce them was rejected: it would give up their CDN caching (the PageSpeed work) for pages without user content.
- No `'unsafe-eval'` anywhere. Checked the production GTM container (GTM-5PB7DF7V, public gtm.js, 2026-10-12): no Custom JavaScript variables and no Custom HTML tags, so nothing in it needs eval. **If Custom JavaScript variables are ever added to the container they will return undefined** under this policy (Google's CSP guide); use Custom Templates instead.

**Verified in enforcement mode** - a local production build (`next build` with CSP_MODE unset = enforce, dummy integration ids, no `.env` files), served by `next start` on a disposable database, driven by headless Chrome. Every third-party request was answered by a local stub (a request reaching the stub is one the policy allowed; nothing left the machine). **68/68 checks passed, zero CSP violations outside the negative controls**:

- headers: one enforced policy per response - baseline on `/`, `/pricing`, `/about`, `/tools`; nonce and `no-store` on `/blog`, a blog post, `/es/blog`, `/audit`, a tool page, `/sign-in`, `/sign-up`, `/dashboard`, `/connect/wordpress`; fresh nonce per response, carried by the page's scripts; spoofed `x-nonce`/CSP request headers ignored; no nonce in cached HTML; `npm run check:csp-routes` on that build: none of 68 prerendered routes under the 22 nonce patterns;
- home page: Crisp's script loads on interaction; cookie banner Accept loads Google's tag; the walkthrough video's frame loads;
- `/blog`, a blog post with FAQ, `/pricing`, a free tool, `/audit` render without violations; on the (now nonce-protected) blog post the chat's script and, after Accept, Google's tag still load - inserted by the nonced bundle;
- email sign-in (only works once the nonced scripts hydrate the form); "Continue with Google" reaches accounts.google.com;
- dashboard, website overview, Google tab, content, billing, settings; admin and admin blog;
- integration setup: "Connect Google" reaches Google's consent screen; WordPress one-click connect approval returns to the WordPress site;
- checkout: "Buy 10 credits" runs its server action and shows its answer (no payment keys in the test: "not configured"). Stripe/PayPal checkout itself was **not** run (no provider calls); it leaves the site exactly like the Google flows above (`window.location.assign` to the provider URL the server returns), which CSP does not restrict;
- negative controls (enforcement really blocks): an injected inline event handler on a nonce page and on a public page, a frame from an unlisted host, a script from an unlisted host.
- Build/runtime agreement: the same enforce build started with `CSP_MODE=report-only` at runtime still sent enforced policies on `/`, `/blog` and `/sign-in`, and logged the mismatch once.

**Verified against the live services, without enforcing anything:** one anonymous visit to www.repget.com's home page with the new production policy substituted as report-only (no clicks besides a scroll, no cookie answer, chat not opened). The real Crisp chatbox rendered, using `client.crisp.chat`, `image.crisp.chat` and `wss://client.relay.crisp.chat`; Google's tag, Analytics and Ads, YouTube's poster and Sentry were used too - **nothing would have been refused**.

**Pre-existing, not CSP:** without JavaScript, approving a WordPress connection does nothing - the page sends no referrer (on purpose, so the request id does not leak), so a plain form POST carries `Origin: null` and Next's server-action check refuses it. With JavaScript (every real browser session) it works under the enforced policy.

**Production setting:** leave `CSP_MODE` unset (or `enforce`) in Vercel for Production and Preview; remove any `report-only` value; redeploy. Rollback: set `CSP_MODE=report-only` and redeploy. **Status:** implemented and tested; prepared, not deployed - production still reports only until this code is deployed.

## Checks run (2026-10-12, local, disposable environments only)

- `npx tsc --noEmit`: 0 errors. `npm run lint`: clean.
- Full test suite with real Postgres (`TEST_POSTGRES_URL` = disposable local PostgreSQL 18, `REQUIRE_TEST_POSTGRES=1`; pgvector absent locally, so the harness substitutes text for the one vector column - CI uses pgvector): final run 174 of 183 files passed (2,370 tests). The other 9 files are the real-Postgres suites; in that run they hit setup/teardown hook timeouts (60-180 s) and 300-1000 ms query deadlines on `select 1` - the single local server overloaded by all of them at once, with no assertion about behaviour failing - so 9 tests failed and 18 were skipped. Re-run one file at a time (`--no-file-parallelism`): **9/9 files, 64/64 tests passed, none skipped**. An earlier full run had 1 such timing failure (in client.postgres.test.ts, which then passed 20/20 alone) plus 10 failures in two tests that had relied on `x-real-ip` being trusted off Vercel; those two tests now declare the Vercel ingress they model and pass. **Not yet seen: one clean single-process full run** - CI (separate pgvector service) is where that should be confirmed.
- Production build (`next build`, no `.env` files, CSP enforce by default): passed, including Next's TypeScript step; `npm run check:csp-routes` on it: passed.
- Enforced-CSP browser run against that build: 68/68 (section 7).
- WordPress: `npm run plugin:test` (both stubbed harnesses), `connect-flow.php`, and against a disposable WordPress 6.8.3 + MySQL 8.4: `real-wordpress.php`, `real-wordpress-concurrency.php` (incl. the 1.5.0 upgrade) and the new `imagestudio-featured.php` - all passed. The 2.2.0 ZIP matches its source.
- `npm run check:secrets -- --all --history`: no findings (1,174 files, 608 commits).
- `npm audit --omit=dev --audit-level=high`: 0 vulnerabilities. `node scripts/audit-check.mjs`: passed with the one accepted `braces` advisory (unchanged scope, review by 2026-11-06); rechecked upstream: braces 3.0.3 is still the latest and still affected, no patched release.

## Deployment and verification checklist (owner)

In this order. Each step says how to check it.

1. **Review and push** the working-tree changes (CI must be green: type-check, lint, tests with real Postgres, build, secret scan with history, WordPress suites).
2. **Database (before or with the deploy - the code does not depend on it):** back up, then apply migration 0056 with the established migration runner (not `drizzle-kit push`). Verify: `CHECK_DATABASE_URL=<connection string> npm run check:db-security` reports 0 problems; the site's blog, admin and a WordPress one-click connect still work.
3. **Vercel environment:** make sure `CSP_MODE` is **unset** (or `enforce`) for Production and Preview - remove any `report-only` value. Nothing else is required; `TRUSTED_CLIENT_IP_HEADER` must stay unset on Vercel.
4. **Deploy a preview first** and check it in a browser with DevTools open (Console shows any "Refused to ..."): home page (chat bubble after scrolling, cookie banner Accept, walkthrough video plays), blog post, pricing, a free tool, sign in with email and with Google, dashboard, a website's Analytics tab ("Connect Google" reaches Google's screen), Billing (a checkout button reaches Stripe's or PayPal's page - do not pay), WordPress one-click connect (if a test site is available), admin.
5. **Deploy production**, then: `curl -sI https://www.repget.com/ | grep -i content-security` shows `Content-Security-Policy` (not `-Report-Only`), and `/sign-in` shows a `'nonce-…'`. Watch Sentry's security reports for a day.
6. **Rollback, if an integration breaks:** set `CSP_MODE=report-only` in Vercel and redeploy (a rebuild is needed - the mode is fixed at build time), fix the policy, then remove the variable and redeploy.
7. **Google properties:** the owner opens the website's Analytics tab and confirms the chosen properties (the notice asks for it). Imports continue meanwhile.
8. **Image Studio:** install plugin 2.2.0 ("Replace current with uploaded"), then README step 8 (check the "requested from / counted as" line from two networks; add proxy ranges only if every visitor shows the same proxy address).
9. **Credentials:** follow the runbook in credentials.md and fill in its rotation log.
