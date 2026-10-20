# Partner program: browser end-to-end tests

The twenty flows of the partner program, driven through the running application in a real Chrome, against a throwaway database.

## What is real and what is not

| Real | Faked |
|---|---|
| The application: routes, sign-up and sign-in forms, sessions, guards, pages, server actions, the Stripe webhook route and its signature check | **Stripe**: billing reads, Connect transfers, bank payouts, reversals, coupons (`src/test/partners.ts` fakes, idempotent like Stripe) |
| Every partner-program use case (commissions, attribution, settlements, payouts, reconciliation), run in the tests' process against the same database - the functions the webhook worker, the monthly run and the sweeps call | **Email delivery**: an address is marked verified as clicking the emailed link would |
| PostgreSQL (a throwaway database on a local server) | **The clock** of the in-process side, set relative to now (e.g. "paid 40 days ago") |
| Chrome (the installed one) | **Client addresses**: each simulated person sends their own `x-real-ip` from the IPv6 documentation prefix |

Nothing in a run reaches Stripe, email, Inngest or any other external service: the app gets an invalid test-mode Stripe key, webhook secrets generated for the run, and Inngest pointed at a closed local port. Payouts and coupons are therefore created by the in-process use cases with the fake Stripe, not by clicking "Run payouts" or "Create coupon" in the app (that would call Stripe). Real Stripe test-mode verification is a separate, manual step (`docs/partner-program-launch.md`).

## Running

```sh
# 1. A local PostgreSQL you are happy to create databases on (Docker or a scratch initdb).
node e2e/partners/app.mjs db --admin-url postgres://postgres@127.0.0.1:55432/postgres --name repget_e2e_partners

# 2. A copy of the app OUTSIDE the repository, with no .env file (Next.js would load .env.local, which holds real credentials).
node e2e/partners/app.mjs prepare --dir ../repget-e2e-app
(cd ../repget-e2e-app && npm ci)

# 3. Build and start it with an environment built from scratch.
node e2e/partners/app.mjs build --dir ../repget-e2e-app --db postgres://postgres@127.0.0.1:55432/repget_e2e_partners
node e2e/partners/app.mjs start --dir ../repget-e2e-app --db postgres://postgres@127.0.0.1:55432/repget_e2e_partners   # leave running

# 4. The tests.
npm run test:e2e:partners
```

Create the database before building: the build prerenders the marketing pages, which read it.

`start` writes the run's address, database and generated secrets to `repget-e2e-partners.json` in the OS temp directory (or `E2E_STATE`); the tests read it. Use the same `--port` for `build` and `start` (the address is built into the client). `CHROME_PATH` selects another Chrome.

Guards: the runner and the test config refuse a database that is not on localhost or not named `repget_e2e_*`, an app copy inside the repository or containing a `.env` file, and an app address that is not localhost.

## The flows

| # | Flow | File |
|---|---|---|
| 1 | Existing user applies and is approved, same login; the link name suggested from their name; an administrator renames it and both the old and new `?ref=` links count | `onboarding.e2e.ts` |
| 2 | Portal without a workspace or subscription | `onboarding.e2e.ts` |
| 3 | Payout setup: incomplete, ready, restricted | `onboarding.e2e.ts` |
| 4 | Click on `repget.com/?ref=<name>` (through the real `next.config.ts` redirect), signup (real form) and payment give the right commission | `commissions.e2e.ts` |
| 5 | A renewal adds exactly one commission | `commissions.e2e.ts` |
| 6 | Existing users and invited team members do not qualify (`/pricing?ref=` in capitals with a `utm_` tag lands on /pricing, tag kept; `/go/<name>` still works) | `onboarding.e2e.ts` |
| 7 | Matching and conflicting coupons | `commissions.e2e.ts` |
| 8 | Tax, discounts and credit | `commissions.e2e.ts` |
| 9 | Tier transition to Growth (30%) | `commissions.e2e.ts` |
| 10 | Net 30 and carry-forward below EUR 25.00 | `payouts.e2e.ts` |
| 11 | Reservation, transfer, bank payout | `payouts.e2e.ts` |
| 12 | Transfer confirmed while the bank payout is pending | `payouts.e2e.ts` |
| 13 | Failed bank payout retried without another transfer | `payouts.e2e.ts` |
| 14 | Duplicate and out-of-order Stripe events through the real platform webhook route; the Connect route's signature check, duplicates and storage without bank details | `commissions.e2e.ts` |
| 15 | Refund before the transfer, between the transfer and the bank payout, and after the payout | `commissions.e2e.ts`, `payouts.e2e.ts` |
| 16 | Refused transfer reversal; negative and refused adjustments | `payouts.e2e.ts` |
| 17 | Partner isolation and admin authorization | `onboarding.e2e.ts` |
| 18 | Fraud review (shared network), payout hold, suspension | `onboarding.e2e.ts` |
| 19 | Legacy credit referrals unchanged; a customer of both is reviewed | `onboarding.e2e.ts` |
| 20 | Phone / desktop, light / dark: status, overflow, console, placeholders, contrast, keyboard focus, dialogs; the public `/partners` page in three languages, its earnings estimate (10, 25 and 3 customers) and its FAQ structured data | `ui.e2e.ts` |

## Why not Playwright

The suite drives Chrome over the DevTools protocol (`browser.ts`, about 340 lines) with Node's built-in WebSocket and the project's vitest, so it adds no dependency. Adding `@playwright/test` would change the lockfile, which in this repository needs npm 11 and the splice-and-verify procedure in `docs/dependencies.md`. The trade-off is a smaller driver to maintain; the tests themselves would port to Playwright almost line for line if the lockfile change is made later.

The suite is not in CI yet: it needs a running app copy, a database and Chrome on the runner.

What it does not cover: Connect events that re-read an account or payout from Stripe (the route is driven, but such an event's processing needs Stripe; the same processing runs in-process here and in `entry-points.test.ts`), Stripe-hosted onboarding, and anything against Stripe test mode.
