# Release notes: billing integrity, quotas, admin verification, WordPress plugin 1.5.2

For the team deploying this release. Readiness, evidence and blockers are in `docs/release-readiness.md`. The deployment procedure is in `docs/migration-cutover.md`, which must be followed: this release contains data migrations and a write freeze.

## What changes for customers

- **Billing is per website and cannot be bought twice.**
  - A checkout that is still open, or whose outcome the provider has not confirmed, blocks a second checkout for that website, on either provider, and blocks deleting the website until it is settled.
  - Trials are granted once per workspace, from its history.
  - "Switch to this plan" changes the existing subscription instead of creating a second one.
  - The billing page describes the selected website's plan.
- **Article allowance is durable.** Every article generated in a month counts against that month, even if it is deleted later. Work that fails before anything is spent gives its slot back. Work that may have spent money does not.
- **Deleting a website or workspace keeps the billing history.** The provider subscription is cancelled first. A cancellation the provider has not confirmed is retried in the background until it is.
- **WordPress plugin 1.5.2.**
  - Overlapping syncs no longer create duplicate posts.
  - A sync interrupted mid-publish is repaired into the same post on the next run.
  - Posts made by earlier versions are updated, not duplicated.
  - Customers update the plugin as usual; nothing on their site needs changing.

## What changes for operators

- **Admin access now requires a verified email address** as well as `ADMIN_EMAILS`.
  - An administrator whose account is not verified sees 404 on `/admin` until they sign in once with an emailed one-time code (or with Google).
  - That sign-in also removes any password or session someone else attached to the address before it was proven.
  - No account was marked verified automatically.
- **Password reset and email-verification-by-code endpoints are disabled.** The app never used them. Sign-in by one-time code is the recovery path.
- **Two new Inngest functions:**
  - `job-outbox-deliver` (every minute) delivers background jobs recorded in the database;
  - `billing-maintenance` (every 5 minutes) recovers webhook events, retries owed cancellations, reconciles checkouts and sweeps abandoned reservations.

  Both must be registered after deploy.
- **`npm run reconcile:report`** lists what needs a person's decision. It never changes data.

## Required before release

1. **Stripe Customer Portal**, in test and in live: enable plan switching and add every plan's product and price. Without it, card plan changes fail.
2. **Staging rehearsal** of `docs/migration-cutover.md` on a restored backup. It needs the `vector` extension, as production has.
3. **Provider checks** in Stripe test mode and the PayPal sandbox, against an isolated webhook destination.
4. **Rotate the exposed DataForSEO credential** (`docs/credentials.md`).

## Migrations

0034–0042, in journal order, inside the article write freeze. Never re-run a migration file by hand. The only baseline statement that may be run again is `scripts/cutover/article-baseline-backfill.sql`.

## Rollback

Redeploying the previous code works against the migrated schema, but it swallows webhook events waiting for recovery, and it stops background job delivery. Drain those first, and return to this release quickly (`docs/migration-cutover.md` → Rollback). Never drop the new tables or the baseline trigger.

## Known residual risk

`npm audit` reports 4 moderate advisories: esbuild 0.18.20, reached through drizzle-kit, a development tool. No stable drizzle-kit removes it, and no runtime path to it was found (`docs/dependencies.md`).
