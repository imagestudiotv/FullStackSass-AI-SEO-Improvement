# Rollback-compatible previous release

Deploying the release before the managed Partner Network (`d62e257`) unchanged
onto a database the newer build has migrated would publish held articles. That
release does not know `review_status`, the publication freeze or in-flight
sends, and its Publish button and publish job only check that an article has
content.

`previous-release-gate.patch` makes that release honour all three. It adds
`src/lib/publishing/rollback-gate.ts` and one check on each publishing path:

| Path | Check |
|---|---|
| Plugin feed (`lib/plugin/due.ts`) | `rollbackReleasableSql` in the due query |
| First-article release (`lib/publishing/policy.ts`) | `rollbackReleasableSql` |
| Scheduled release (`inngest/functions/scheduled-articles.ts`) | `rollbackReleasableSql` |
| Publish button (`lib/publishing/actions.ts`) | `rollbackHold()` |
| Publish job (`inngest/functions/publish-article.ts`) | `rollbackHold()` when preparing, and again at every send attempt |

Each check holds an article when any of these is true:

- Its review is pending.
- It was approved, but changed since approval.
- It is a reviewed article before its planned day.
- Publishing is frozen.
- A newer build is still delivering it.

The patched build cannot approve articles. Held articles stay held until the
newer build is deployed again. Nothing is mass-approved.

**Residual window.** Within the patched previous build there is no row lock
between its check and its send. A customer edit made in the same instant as a
send can still go out on an approval that the edit invalidated. That is why the
procedure below freezes publishing before switching builds.

## Rollback procedure

1. **Freeze publishing.** Use Admin → Partner Network → Operations, or run this
   against the database:

   ```sql
   insert into platform_controls (key, enabled, reason, updated_by)
   values ('publication_freeze', true, 'rollback', '<operator>')
   on conflict (key) do update
     set enabled = true, reason = 'rollback', updated_by = '<operator>', updated_at = timezone('utc', now());
   ```

   The newer build stops sending at its next dispatch claim. Sends already in
   flight complete. Wait until this query returns 0 (at most 10 minutes):

   ```sql
   select count(*) from publication_dispatches
   where status = 'in_flight'
     and claimed_at > timezone('utc', now()) - interval '10 minutes';
   ```

2. **Build and deploy the patched previous release.** Check out `d62e257`, apply
   the patch with `git apply previous-release-gate.patch`, then build and
   deploy. Do not run migrations. The database keeps 0043 and 0044, which this
   build needs.
3. **Verify** on the rolled-back deployment that a held article appears neither
   in the plugin feed nor in the scheduled release.
4. **Unfreeze** when ready: set `enabled = false`. The patched build then
   publishes approved and unreviewed articles, and keeps holding the rest.

Never redeploy the previous release without this patch.

## Rehearsal (performed locally)

The rehearsal runs the previous release's code against a disposable PGlite
database migrated through 0044. That is "database ahead of code", the state
after a rollback. The test drives the old code's own plugin feed, scheduled
release, Publish button and publish job:

1. `git archive d62e257` into a scratch directory, and apply the patch.
2. Copy `drizzle/0043_*`, `drizzle/0044_*` and `drizzle/meta/*` from this build.
3. Copy `rollback-rehearsal.test.ts.txt` to `src/rollback-rehearsal.test.ts`.
4. Run `npx vitest run src/rollback-rehearsal.test.ts`, then the full old suite
   and `tsc` (after `next typegen`).

Results on 2026-09-27:

| Check | Result |
|---|---|
| Rehearsal | 6/6 passed |
| Previous release's own suite, with the patch | 427 passed, 19 skipped (real-Postgres tests) |
| `tsc` | 0 errors |

Held articles were held on every path, including a queued job's send attempt
after a freeze. Approved and unreviewed articles were released as before.
