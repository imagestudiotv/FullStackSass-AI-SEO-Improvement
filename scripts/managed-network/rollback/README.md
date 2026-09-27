# Rollback-compatible previous release

Deploying the release before the managed Partner Network (`d62e257`) unchanged
onto a database the newer build has migrated would publish held articles and
could duplicate posts. That release does not know `review_status`, the
publication freeze or the dispatch boundary, and its Publish button and publish
job only check that an article has content.

`previous-release-gate.patch` makes that release hold what it cannot handle
safely. It adds `src/lib/publishing/rollback-gate.ts` and one check on each
publishing path:

| Path | Check |
|---|---|
| Plugin feed (`lib/plugin/due.ts`) | `rollbackReleasableSql` in the due query |
| First-article release (`lib/publishing/policy.ts`) | `rollbackReleasableSql` |
| Scheduled release (`inngest/functions/scheduled-articles.ts`) | `rollbackReleasableSql` |
| Publish button (`lib/publishing/actions.ts`) | `rollbackHold()` |
| Publish job (`inngest/functions/publish-article.ts`) | `rollbackHold()` when preparing, and again at every send attempt |

Each check holds an article when any of these is true:

- It is under the managed review at all (`review_status` set): pending **and
  approved**.
- It has a delivery whose outcome is unknown: `in_flight` of **any** age (a
  lease running out is not completion), `uncertain` (a create whose answer was
  lost), or an unacknowledged plugin hand-over (`expired`, `abandoned` before
  migration 0045).
- Publishing is frozen.

**Why approved articles are held too (limitation).** The patched build has no
row lock between its check and its send and no dispatch coordination, so it
cannot stop an edit made at the same instant from going out on an approval the
edit invalidated. The earlier version of this patch released approved,
unchanged articles and relied on the freeze to cover that window; once
unfrozen, the window was open again. Now, on this build, publishing reviewed
articles stays frozen: after unfreezing it publishes only what the release
before always published (unreviewed articles without an unresolved delivery).
Approved network articles wait for the newer build. The patched build cannot
approve, and nothing is mass-approved or mass-resolved.

**Why unresolved deliveries are held.** That release creates a new post
whenever it has no delivery on record. For an uncertain or still-running send,
that could make a second post. It has no ownership lookup, so it waits for the
newer build (or an operator's audited decision there) instead.

## Rollback procedure

1. **Freeze publishing** at Admin → Partner Network → Operations. Enabling the
   freeze waits for claims already being made; after that nothing more is
   admitted. If the admin UI is unavailable, run this against the database
   (it takes the same lock):

   ```sql
   begin;
   select pg_advisory_xact_lock(hashtext('repget:publication-freeze'));
   insert into platform_controls (key, enabled, reason, updated_by)
   values ('publication_freeze', true, 'rollback', '<operator>')
   on conflict (key) do update
     set enabled = true, reason = 'rollback', updated_by = '<operator>', updated_at = timezone('utc', now());
   commit;
   ```

2. **Drain.** The Operations page says **Drained** only when no delivery has an
   unknown outcome. Resolve what it lists (uncertain sends are looked up
   automatically; the rest needs an audited decision there). Equivalent query,
   which must return 0 rows:

   ```sql
   select status, count(*) from publication_dispatches
   where status in ('in_flight', 'uncertain', 'expired', 'abandoned')
   group by status;
   ```

   Do not use "in flight in the last 10 minutes = 0" as the signal: a send
   whose lease ran out may still complete remotely. (Any row left unresolved
   is harmless to the patched build - it holds that article - but it stays
   held until the newer build returns.)

3. **Build and deploy the patched previous release.** Check out `d62e257`,
   apply the patch with `git apply previous-release-gate.patch`, then build and
   deploy. Do not run or roll back migrations. The database keeps 0043-0045.
4. **Verify** on the rolled-back deployment that a held article appears neither
   in the plugin feed nor in the scheduled release.
5. **Unfreeze only if needed** (`enabled = false`). The patched build then
   publishes unreviewed articles without unresolved deliveries, and keeps
   holding everything else.

Never redeploy the previous release without this patch.

## Rehearsal (performed locally)

The rehearsal runs the previous release's code against a disposable PGlite
database migrated through 0045. That is "database ahead of code", the state
after a rollback. The test drives the old code's own plugin feed, scheduled
release, Publish button and publish job:

1. `git archive d62e257` into a scratch directory, and apply the patch.
2. Copy `drizzle/0043_*` to `drizzle/0045_*` and `drizzle/meta/*` from this build.
3. Copy `rollback-rehearsal.test.ts.txt` to `src/rollback-rehearsal.test.ts`.
4. Run `npx vitest run src/rollback-rehearsal.test.ts`, then the full old suite
   and `tsc`.

Results on 2026-09-27 (current patch):

| Check | Result |
|---|---|
| Rehearsal | 11/11 passed |
| The same rehearsal with the earlier patch | 4 failed: approved article, delayed send, uncertain send, expired/abandoned hand-over |
| Previous release's own suite, with the patch | 432 passed, 19 skipped (real-Postgres tests) |
| `tsc` | 0 errors |

Scenarios: pending, approved-then-edited and approved articles held on every
path; an unreviewed article released as before; the freeze stops every path,
including a queued job's send attempt; an article with a dispatch in flight
(within the lease, and 2 hours past it), uncertain, expired or abandoned is
held on every path with nothing created; a settled (failed) delivery does not
hold; the plugin feed hands out nothing held.

Not rehearsed here: a real deployment switch, and a real WordPress site
completing a delayed request after the rollback (the patched build holds the
article, so it cannot send a second copy; the plugin's own identity check
would update rather than duplicate).
