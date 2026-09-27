# Cutover: migrations 0034–0042 and the audited code

A runbook for moving a database and deployment from the committed code (HEAD) to the audited code. **Rehearse it on staging, on a restored copy of production data; never on a shared or production database first.** Nobody has applied any of it anywhere yet.

## What changes

| Migrations | Kind | Old code affected? |
|---|---|---|
| 0034–0040 | New tables, new columns with defaults, indexes, row-level security | No. Old code neither reads nor writes them, and every new NOT NULL column has a default. |
| 0041 | Data: records every article from the last 62 days as a consumed `article.legacy` ledger row | No |
| 0042 | Installs the `articles_allowance_baseline` trigger, then backfills with the corrected rule | No. Old code's article inserts now also write a ledger row, which it never reads. |

## The window, and why article writes are frozen

After cutover, an article's consumption is durable: every article counts against its month's allowance even if it is later deleted. This is kept complete by the trigger 0042 installs.

- **Before 0041 runs**, articles are counted the old way: by the rows that exist.
- **Between 0041's backfill and 0042's trigger**, an article the old code inserts *and deletes* is counted by nobody.

That window exists on **both** migration paths:

- **psql, one file at a time:** each file commits on its own, so the window lasts from 0041's commit to 0042's.
- **`drizzle-kit migrate`:** it runs every pending migration in ONE transaction, but that does not close the window. Other sessions still commit between its statements (READ COMMITTED), and it takes no lock on `articles` until 0042's `CREATE TRIGGER`.

Both were reproduced on real PostgreSQL (`src/lib/billing/cutover.test.ts`). **Empty reconciliation reports do not show that nothing was lost.** `articleBaselineGaps` only sees articles that still exist, and a deleted article leaves nothing for it to find.

The window is therefore closed by **freezing article writes at the database** for the whole migration: `scripts/cutover/freeze-article-writes.sql`. It covers every writer:

- **Every source of writes.** Old server instances, old Inngest workers, admin tools, and deletes that cascade from a website or workspace deletion (cascades fire row triggers).
- **In-flight requests drain first.** Installing the freeze waits for every transaction that has already written to `articles` to finish. From the moment it commits, every INSERT or DELETE on `articles` fails with *"article writes are paused for a database migration"*. That includes a transaction that started earlier but had not written yet.
- **Reads are never blocked.**
- **It can only be lifted once 0042's trigger is in and working.** `unfreeze-article-writes.sql` checks for the exact trigger 0042 installs, not just its name:
  - on `public.articles`, calling `public.article_allowance_baseline()`;
  - `AFTER INSERT … FOR EACH ROW`;
  - enabled for ordinary application writes (`O` or `A`). Disabled (`D`) and replica-only (`R`) do not count.

  If the check fails, the whole file aborts and the freeze stays on. The standalone backfill and the `articleBaselineTriggerMissing` report use the same check.

During the freeze, customers cannot generate or delete articles, delete a website, or be deleted as a workspace. Those actions fail with an error and can be retried afterwards. Plan a short window of minutes, at low traffic.

## Re-running: what may and may not run again

- **No migration file is ever run again by hand.** That includes 0040, 0041 and 0042, whatever their header comments say. Those comments predate this runbook and are superseded by it; the files themselves are not edited, because they are historical.
  - **0041 is harmful to re-run.** Its rule treats a *released* reservation as not covering its article. So an article whose job was never delivered (slot correctly returned) is counted again, and the returned allowance is consumed.
  - **0042** drops and re-creates its trigger. Outside a single transaction that re-opens the window.
- **The only baseline statement that may run again** is `scripts/cutover/article-baseline-backfill.sql`, which is 0042's corrected backfill on its own.
  - An article counts as covered by *any* reservation of its own, in any state.
  - It refuses to run unless 0042's trigger passes the same check as the unfreeze (above).
  - It is safe while the application runs, and normally finds nothing.
  - Use it only when a check shows a gap, for example after the trigger was disabled.

## Choosing the migration path

`db:push` must not be used: it only syncs `schema.ts` and never runs the SQL files, so it would skip the backfills, the trigger and the row-level security statements.

**Prerequisite: the `vector` extension.** Migration 0001 declares `pages.embedding vector(1536)`, and no migration creates the extension, so it must already exist wherever you restore or migrate. Supabase provides pgvector. On any other server, run `CREATE EXTENSION IF NOT EXISTS vector` first.

**Determine the schema version from the history, not from two tables.** Path A: `select count(*), max(created_at) from drizzle.__drizzle_migrations` must show 34 rows (0000–0033), and the latest `created_at` must equal the `when` of `0033_funny_wendigo` in `drizzle/meta/_journal.json`. Path B has no history table, so compare the live schema with a scratch database migrated to 0033: `pg_dump --schema-only` both and diff them. The two table checks below are a quick screen, not the proof.

- **Path A — `npx drizzle-kit migrate`**, when the target has drizzle's migration table (`drizzle.__drizzle_migrations`) and its latest row corresponds to 0033. It applies 0034–0042 in one transaction and records them.
- **Path B — psql, file by file**, when the schema was managed with `db:push` and drizzle has no record. First confirm the schema is at 0033: `billing_checkouts` does not exist yet, and `subscriptions.website_id` does. Then:

  ```sh
  for f in 0034 0035 0036 0037 0038 0039 0040 0041 0042; do
    sed 's/--> statement-breakpoint//g' drizzle/${f}_*.sql |
      psql "$DIRECT_URL" --single-transaction -v ON_ERROR_STOP=1 || break
  done
  ```

  If a file fails, stop there. Fix the cause, and continue from the failed file, not from 0034.

Both paths run inside the same freeze, below.

## Steps

**T–1 day. Rehearse**

1. Take a backup, or confirm point-in-time recovery is on. Record the restore procedure.
2. Restore that backup into a staging database. Run this whole sequence against it, with a script issuing article inserts and deletes throughout, as in the rehearsal described at the end. Deploy the new code to a preview pointed at staging and run the staging checks in the audit report: Stripe test mode, PayPal sandbox, a test WordPress site.

**T0. Announce and quiet**

3. Post the maintenance notice. **Do not pause Inngest functions.**
   - Inngest's documentation (https://www.inngest.com/docs/guides/pause-functions, read 2026-09-26) says events that arrive while a function is paused are stored but marked *skipped*, and "will not be reprocessed automatically" after resuming. They can only be replayed by hand, within the plan's history limit. Pausing therefore loses work.
   - Nothing needs pausing. The freeze refuses only INSERT and DELETE on `articles`. The one INSERT runs in the request that queues an article, in the same transaction as its reservation and its outbox job, so during the freeze the whole request rolls back and the customer is told to retry. No Inngest job is left half done.
   - `job-outbox-deliver` and `billing-maintenance` keep working through the freeze. This was verified: a job queued while frozen was delivered within a minute, and maintenance retried an owed cancellation.

**T0 + 2 min. Freeze**

4. Run:

   ```sh
   psql "$DIRECT_URL" --single-transaction -v ON_ERROR_STOP=1 -f scripts/cutover/freeze-article-writes.sql
   ```

   It prints `freeze active` with the article count and the table's insert and delete counters. **Record them.**
   - If it fails with a lock timeout, a long transaction is holding `articles`. Nothing changed; wait and run it again.

**T0 + 5 min. Migrate (path A or B)**

5. Apply 0034–0042.

**Verify, still frozen.** The evidence is positive, not an empty report:

6. The freeze was in place for the whole migration. It was installed in step 4, before 0041, and it cannot be lifted until 0042's trigger passes the check (step 8 enforces this).
7. Nothing was written or deleted meanwhile. Run the query below and compare with step 4. The article count, `inserted_total` and `deleted_total` must be unchanged:

   ```sql
   SELECT (SELECT count(*) FROM articles) AS articles, n_tup_ins AS inserted_total, n_tup_del AS deleted_total
   FROM pg_stat_user_tables WHERE relname = 'articles';
   ```

   The counters are updated when each transaction ends; wait a few seconds before reading them.

   Then, as consistency checks, run `npm run reconcile:report -- articleBaselineTriggerMissing articleBaselineGaps uncountedDeletedArticles`. All three must be 0.
   - A row in `articleBaselineGaps` here means the migration did not complete. Do not run anything again; investigate first.

**T0 + 10 min. Unfreeze and deploy**

8. Run:

   ```sh
   psql "$DIRECT_URL" --single-transaction -v ON_ERROR_STOP=1 -f scripts/cutover/unfreeze-article-writes.sql
   ```

   It refuses, and leaves the freeze on, unless the trigger passes the check: installed on `articles`, the right shape, and enabled for normal writes. From here, old code still running is covered by the trigger.
9. Promote the new deployment.
   - Old `article/generate.requested` events carry no `reservations` or `websiteId`. The new job accepts them: it re-checks entitlement before every paid call, and the article was counted when its row was inserted.
10. In Inngest, confirm that the app synced and that the two new scheduled functions are registered and succeeding:
    - `job-outbox-deliver`, `* * * * *`;
    - `billing-maintenance`, `*/5 * * * *`.

    Watch at least one run of each. Retries are finite, and exhausted work is found like this:

    | Work | Retry limit | Found by |
    |---|---|---|
    | Outbox delivery | Backoff of 1, 2, 4, 8… minutes, up to `MAX_DELIVERY_ATTEMPTS` (10), then `failed` | `undeliveredJobs` report |
    | Webhook recovery | Up to `MAX_RECOVERY_ATTEMPTS` (12) per event | `stuckWebhookEvents` report |
    | Owed cancellations | Backoff, up to `MAX_CANCELLATION_ATTEMPTS` (25), then `abandoned` | `owedCancellations` report |
    | Checkouts nobody is waiting on | Never released on age | `unsettledCheckouts` report (see Operator follow-up) |
    | Inngest functions themselves | `retries: 1–2` each, then the function's failure handler | Inngest's failed runs, and the `strandedWork` report |

**T0 + 20 min. Review**

11. Run `npm run reconcile:report` (read-only) and review every finding with a person. Nothing is repaired automatically.

## After cutover: detecting and repairing earlier mistakes

If an environment was ever migrated differently, the ledger may be wrong in one of two ways. For example: 0041 applied on its own and left, or 0041 or 0042 re-run by hand. Both are detectable read-only:

| Report | Finds | Why it happens |
|---|---|---|
| `baselineDoubleCounts` | Legacy baseline rows for an article that also has a reservation of its own. Only new code creates those, so the legacy row counts the article twice, or re-consumes a released slot. | 0041 re-run after the new code ran |
| `uncountedDeletedArticles` | Articles that were generated (their outline call was metered in `usage_events`) and later deleted, with no ledger row. | An article deleted inside an unfrozen migration window |

Limitation: an article deleted before its outline step never spent anything and leaves no trace, so it cannot be found. It also cost nothing.

**Repairs are operator-reviewed, one finding at a time**, never in bulk:

1. Take the finding from the report.
2. Confirm it against the customer's history.
3. Run the matching script with that one id:
   - `scripts/cutover/repair-baseline-double-count.sql -v reservation_id=<id>` releases that one legacy row. The row is kept as a record, with the reason.
   - `scripts/cutover/repair-uncounted-article.sql -v article_id=<id>` records that one article's consumption in the month it was generated.

Each script is guarded to do nothing if the row does not match its finding, and prints what it changed. Neither changes any other consumption.

## Rollback

**Code: redeploying the previous version works against the migrated schema, but it is not free.** This was checked by running HEAD's own drizzle schema and its write statements against a pgvector database migrated to 0042 with the real files:

- **Compatible:**
  - every HEAD table and column still exists and reads;
  - every column new since HEAD is nullable or defaulted, so HEAD's inserts succeed;
  - HEAD's article inserts and deletes are counted by the trigger, and the count survives a cascading website delete;
  - HEAD's credit-ledger inserts are unaffected by the new partial unique index.
- **Hazard: webhook events in flight are lost.** HEAD's idempotency gate treats *any* existing `webhook_events` row as done. An event the new code left for recovery (`received` with attempts, or a stale `processing` claim) is answered by HEAD as a duplicate and never applied. The provider's retries hit the same row.
- **Hazard: queued jobs stall.** HEAD has no outbox drain, so `job_outbox` rows stay pending until the new code returns. Owed cancellations, checkout reconciliation and reservation sweeps also stop, because `billing-maintenance` is new.
- **Difference: deleting a website keeps its subscription.** After 0035, `subscriptions.website_id` is `ON DELETE SET NULL`. HEAD's schema says cascade, so under HEAD a website deletion leaves the subscription row with no website. The row is kept, which is the intent; HEAD simply does not expect it.

**Before a code rollback:**

1. Run `npm run reconcile:report -- stuckWebhookEvents undeliveredJobs owedCancellations`. Let the new code drain them, or list them for manual follow-up in the provider dashboards.
2. After rolling back, re-deploy the new code as soon as possible. Its maintenance picks up whatever accumulated.
3. Never "fix" a stranded webhook by deleting its row while HEAD runs. That hands the next provider retry to HEAD with no record of what the new code already did.

- **Schema:** do **not** drop the new tables or columns. They hold payment links, owed cancellations and ledger history.
- **Trigger:** leave it in place. Removing it re-opens the gap for any old code still running.
- **Freeze:** if the migration fails part-way, the freeze stays on (the unfreeze refuses without the trigger). Either finish the migration, or restore the backup. Only drop the freeze trigger by hand (`DROP TRIGGER cutover_article_write_freeze ON articles`) once the database has been restored to its pre-0041 state.

## Operator follow-up

- **Unsettled checkouts.** `unsettledCheckouts` lists checkouts that block new checkouts and deletion for their website until the provider confirms they cannot complete.
  - Check each one in the Stripe or PayPal dashboard.
  - Only then record it:

    ```sql
    update billing_checkouts
    set status = 'expired', provider_state = 'confirmed_by_operator', updated_at = timezone('utc', now())
    where id = '<checkout id>' and status in ('open', 'unresolved', 'abandoned');
    ```

- **Credentials:** rotation and file cleanup are in `docs/credentials.md`. The owner must carry them out.
- **Stripe Customer Portal (required before plan changes work).** "Switch to this plan" on a card subscription opens the portal's `subscription_update_confirm` flow. Stripe requires the target price to be in the portal configuration's `features.subscription_update.products`.
  - The test-mode default configuration was read on 2026-09-26: `subscription_update` is **disabled**, with 0 products, so plan changes fail there as configured.
  - Before release, in Stripe Dashboard → Settings → Billing → Customer portal, in **each** mode (test and live): enable "Customers can switch plans", and add every plan product and price the app sells.
  - Cancellation is already enabled (at period end), which is what `subscription_cancel` needs.
- **Still to verify outside this repository:** the Stripe test-mode and PayPal sandbox checks. The test accounts deliver their webhooks to a deployed app (see `docs/release-readiness.md`), so they were not run.

## Rehearsal record

Run only against disposable databases, never a shared one. The real-Postgres test suites now run on pgvector PostgreSQL 17 (with `REQUIRE_TEST_POSTGRES=1 REQUIRE_PGVECTOR=1`); they ran on PostgreSQL 18 before.

- **`src/lib/billing/cutover.test.ts`**, real PostgreSQL, separate connections:
  - reproduces the loss on both paths;
  - shows the freeze closes it on both;
  - shows it drains an in-flight writer and stops cascading website deletion;
  - refuses the write of a transaction that had already begun and run a statement before the freeze committed (explicitly sequenced, and confirmed still open in `pg_stat_activity`);
  - cannot be lifted before 0042, nor with 0042's trigger disabled.
- **`src/lib/billing/baseline-trigger-prerequisite.test.ts`**:
  - the unfreeze, the standalone backfill and the report all refuse a missing trigger, a disabled one, a same-named trigger on another table, a replica-only trigger, and a same-named trigger of the wrong shape (fires on delete, or once per statement);
  - after each refused unfreeze, the freeze is still in force;
  - a valid trigger lifts the freeze, and an old-code article inserted then deleted afterwards keeps its ledger entry;
  - all three consumers use the identical check.
- **`src/inngest/functions/generate-article.test.ts`**, "article baseline reconciliation after cutover":
  - re-running 0041 re-consumes a returned slot, and the corrected backfill does not;
  - both reports find their cases, and both repairs fix exactly those rows.
- **The steps above, run with the real tools, on pgvector PostgreSQL 17.11 (pgvector 0.8.6), 2026-09-26.** A disposable Docker container (`pgvector/pgvector:pg17`) was used; the migration files were byte-identical to the release artifact, and `pages.embedding` was `vector(1536)` before and after. Both paths ran with:
  - two old-code writers inserting and then deleting articles with no reservation;
  - one writer deleting websites that had articles (a cascading delete);
  - an injected failure mid-migration, followed by the recovery this runbook prescribes.

  | | Path B (psql, file by file) | Path A (`drizzle-kit migrate`) |
  |---|---|---|
  | Injected failure | Another session held `ACCESS EXCLUSIVE` on `articles`, so 0042's `DROP TRIGGER` hit a 2 s lock timeout after 0034–0041 had committed | Same lock. The single transaction failed at 0041's baseline insert and rolled back fully: 34 recorded migrations, no new tables |
  | While failed | Unfreeze refused (trigger missing). The freeze trigger was still present | Same |
  | Recovery | Continued from the failed file (0042 only; 0041 was not run again) | Ran `drizzle-kit migrate` again: 43 recorded |
  | Counters (articles, inserted, deleted), freeze vs step 7 | 31/55/24 = 31/55/24 | 32/55/23 = 32/55/23 |
  | Writes refused during the freeze | 144 inserts, 17 cascades | 183 inserts, 19 cascades |
  | Successful writes executed inside the freeze (database clock) | 0 | 0 |
  | Articles written or cascade-deleted after the unfreeze, checked in the ledger | 41, all counted exactly once | 40, all counted exactly once |
  | Surviving articles not in the ledger; duplicate ledger rows | 0; 0 | 0; 0 |
  | Full `reconcile:report` | 0 findings | 0 findings |

  **This was not a staging rehearsal.** No staging database, backup or restored copy of production was available, and the data was synthetic. Repeat the rehearsal on a restored backup before production (step 2).
- **Rollback check** (see Rollback): HEAD's schema and statements against the migrated schema, 7 checks, all passed. The hazards listed there were reproduced.
- **Inngest, isolated.** The built release ran with no provider or Inngest keys, pointed at a local Inngest dev server and a disposable database, on 2026-09-26:
  - all 19 functions registered;
  - `job-outbox-deliver` delivered a fresh job and one whose earlier delivery had failed, on its minute;
  - `billing-maintenance` recovered a dead webhook claim and a released one;
  - an owed cancellation failed without a key and was retried after 1, 2 and 4 minutes;
  - an unconfirmable checkout stayed open and was not released;
  - with the freeze installed, delivery and maintenance continued while article inserts were refused.
