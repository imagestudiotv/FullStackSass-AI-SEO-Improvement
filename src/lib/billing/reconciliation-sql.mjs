/**
 * The SQL behind every read-only reconciliation report, as plain strings so
 * the app (src/lib/billing/reconciliation.ts, where the tests run them) and
 * the operator script (scripts/reconcile-report.mjs) execute the identical
 * statements. SELECT only; no parameters.
 *
 * Every "now" is timezone('utc', now()): timestamp columns hold UTC wall-clock
 * values, so this is right whatever the session's TimeZone is.
 */
export const RECONCILIATION_SQL = {
  /**
   * Cutover: legacy baseline rows for an article that ALSO has a reservation
   * of its own - which only new code creates, so the legacy row counts that
   * article a second time, or (own reservation released) consumes a slot
   * that was correctly returned. How 0041 re-run by hand produces them.
   * Repair is operator-reviewed: scripts/cutover/repair-baseline-double-count.sql.
   */
  baselineDoubleCounts: `
    select legacy.id as legacy_reservation_id, legacy.key, legacy.subject_id as article_id,
           legacy.created_at as legacy_recorded_at,
           array_agg(own.state order by own.created_at) as own_reservation_states
    from spend_reservations legacy
    join spend_reservations own
      on own.key = legacy.key
     and own.operation <> 'article.legacy'
     and (own.subject_id = legacy.subject_id or own.metadata ->> 'articleId' = legacy.subject_id)
    where legacy.operation = 'article.legacy' and legacy.state = 'consumed'
    group by legacy.id, legacy.key, legacy.subject_id, legacy.created_at
    order by legacy.created_at`,

  /**
   * Cutover: articles that were generated (the outline call was metered) and
   * later DELETED without the ledger ever recording them - an article that
   * slipped through a migration window. Empty reports elsewhere prove
   * nothing about deleted rows; this looks at what survives them. Articles
   * deleted before their outline step spent nothing and leave no trace.
   * Repair is operator-reviewed: scripts/cutover/repair-uncounted-article.sql.
   */
  uncountedDeletedArticles: `
    select u.metadata ->> 'articleId' as article_id, u.website_id, u.organization_id,
           min(u.created_at) as generated_at
    from usage_events u
    where u.metadata ->> 'purpose' = 'article_outline'
      and u.created_at >= timezone('utc', now()) - interval '62 days'
      and u.website_id is not null
      and not exists (select 1 from articles a where a.id::text = u.metadata ->> 'articleId')
      and not exists (
        select 1 from spend_reservations r
        where r.key = 'articles:' || u.website_id
          and (r.subject_id = u.metadata ->> 'articleId'
               or r.metadata ->> 'articleId' = u.metadata ->> 'articleId'))
    group by u.metadata ->> 'articleId', u.website_id, u.organization_id
    order by generated_at`,

  /**
   * Cutover check (docs/migration-cutover.md): the trigger that makes every
   * article's consumption durable must exist AND fire for normal writes - on
   * public.articles, calling article_allowance_baseline(), AFTER INSERT FOR
   * EACH ROW, enabled 'O' or 'A'. A row here means it does not. The same
   * check guards unfreeze-article-writes.sql and article-baseline-backfill.sql.
   */
  articleBaselineTriggerMissing: `
    select 'articles_allowance_baseline is missing, disabled, replica-only or not the trigger 0042 installs' as problem
    where not exists (
      SELECT 1 FROM pg_trigger t
        WHERE t.tgname = 'articles_allowance_baseline'
          AND t.tgrelid = to_regclass('public.articles')
          AND NOT t.tgisinternal
          AND t.tgfoid = to_regprocedure('public.article_allowance_baseline()')
          AND t.tgenabled IN ('O', 'A')
          AND (t.tgtype & 1) = 1
          AND (t.tgtype & 2) = 0
          AND (t.tgtype & 4) = 4)`,

  /**
   * Cutover check: articles inside any current allowance window that the
   * ledger does not cover (same rule as migration 0042). Expected to be
   * empty once 0042 has run; a row here is an article whose consumption a
   * deletion could still hand back.
   */
  articleBaselineGaps: `
    select a.id as article_id, a.website_id, a.created_at
    from articles a
    where a.created_at >= timezone('utc', now()) - interval '62 days'
      and not exists (
        select 1 from spend_reservations r
        where r.key = 'articles:' || a.website_id
          and (
            r.subject_id = a.id::text
            or r.metadata ->> 'articleId' = a.id::text
            or (a.calendar_item_id is not null
                and r.state in ('reserved', 'consumed')
                and r.metadata ->> 'calendarItemId' = a.calendar_item_id::text)
          )
      )
    order by a.created_at`,

  /** Issue 8: credit add-ons recorded as paid with no credit entry behind them. */
  purchasesWithoutCredits: `
    select p.id as purchase_id, p.organization_id, p.stripe_session_id,
           a.slug as addon, a.credits_granted, p.created_at
    from addon_purchases p
    join addons a on a.id = p.addon_id
    where a.kind = 'credits' and a.credits_granted > 0
      and not exists (
        select 1 from credit_ledger c
        where c.type = 'purchase'
          and (c.reference_id = p.id::text or c.idempotency_key = 'purchase:' || p.id)
      )
    order by p.created_at`,

  /** Issue 8: referrals marked rewarded whose reward never reached the ledger. */
  rewardedReferralsWithoutCredits: `
    select r.id as referral_id, r.referrer_org_id, r.referred_org_id,
           r.reward_credits, r.rewarded_at
    from referrals r
    where r.status = 'rewarded'
      and not exists (
        select 1 from credit_ledger c
        where c.type = 'referral'
          and (c.reference_id = r.id::text or c.idempotency_key = 'referral:' || r.id)
      )
    order by r.rewarded_at`,

  /**
   * Issue 5: websites with more than one subscription that can still bill -
   * the attached one plus any detached rows bought for the same site. NOT
   * cancelled automatically: which one the customer means to keep is theirs
   * to say.
   */
  duplicateLiveSubscriptions: `
    select coalesce(s.website_id, s.claimed_website_id) as website_id,
           s.organization_id,
           count(*)::int as live_subscriptions,
           array_agg(coalesce(s.stripe_subscription_id, s.paypal_subscription_id)
                     order by s.created_at) as provider_subscription_ids,
           array_agg(s.provider order by s.created_at) as providers
    from subscriptions s
    where s.status not in ('canceled', 'incomplete_expired', 'inactive')
      and (s.stripe_subscription_id is not null or s.paypal_subscription_id is not null)
      and coalesce(s.website_id, s.claimed_website_id) is not null
    group by coalesce(s.website_id, s.claimed_website_id), s.organization_id
    having count(*) > 1`,

  /** Issues 3/9: provider cancellations still owed, or given up on. */
  owedCancellations: `
    select provider, provider_subscription_id, reason, status, attempts,
           next_attempt_at, last_error, created_at
    from provider_cancellations
    where status <> 'completed'
    order by created_at`,

  /**
   * Issue 5: checkouts that never reached a settled state. Unresolved and
   * abandoned rows block new checkouts AND deletion of their website until
   * someone confirms with the provider that they cannot complete (see
   * docs/migration-cutover.md, operator steps).
   */
  unsettledCheckouts: `
    select id, organization_id, website_id, provider, status, provider_state,
           stripe_session_id, provider_subscription_id, created_at, last_checked_at
    from billing_checkouts
    where status in ('unresolved', 'abandoned')
       or (status = 'open' and created_at < timezone('utc', now()) - interval '1 day')
    order by created_at`,

  /** Issue 9: webhook events that failed or were abandoned mid-processing. */
  stuckWebhookEvents: `
    select id, provider, type, status, attempts, claimed_at, next_attempt_at, last_error
    from webhook_events
    where (status = 'processing' and claimed_at < timezone('utc', now()) - interval '5 minutes')
       or (status = 'received' and attempts > 0)
    order by processed_at`,

  /**
   * Issue 11: placements charged under the old model (at draft time) with no
   * verified live URL, and live placements whose charge or host reward is
   * missing from the ledger.
   */
  inconsistentPlacements: `
    select p.id as placement_id, p.status, p.live_url, p.article_id, p.credits,
           ar.status as article_status, ar.published_url,
           exists (select 1 from credit_ledger c
                   where c.type = 'link_received' and c.reference_id = p.id::text) as charged,
           exists (select 1 from credit_ledger c
                   where c.type = 'link_given' and c.reference_id = p.id::text) as host_rewarded
    from placements p
    left join articles ar on ar.id = p.article_id
    where (p.status = 'live' and p.live_url is null)
       or (p.status = 'live' and not exists (
             select 1 from credit_ledger c
             where c.type = 'link_received' and c.reference_id = p.id::text))
       or (p.status in ('pending', 'drafted', 'published', 'unverified') and exists (
             select 1 from credit_ledger c
             where c.type = 'link_received' and c.reference_id = p.id::text)
           and not exists (
             select 1 from credit_ledger c
             where c.type = 'refund' and c.reference_id = p.id::text))
    order by p.created_at`,

  /** Issue 16: jobs whose delivery was given up on, or has been failing. */
  undeliveredJobs: `
    select event_id, name, status, attempts, next_attempt_at, last_error, created_at
    from job_outbox
    where status = 'failed' or (status = 'pending' and attempts > 0)
    order by created_at`,

  /**
   * Issue 16: work sitting in a waiting state with no delivery on record -
   * stranded before the outbox existed, or by a delivery given up on.
   */
  strandedWork: `
    select 'article' as kind, a.id::text as id, a.website_id, a.status, a.updated_at
    from articles a
    where a.status in ('queued', 'generating')
      and a.updated_at < timezone('utc', now()) - interval '1 hour'
      and not exists (
        select 1 from job_outbox o
        where o.status in ('pending', 'sent') and o.data ->> 'articleId' = a.id::text
          and o.created_at >= a.updated_at - interval '1 minute')
    union all
    select 'website', w.id::text, w.id, w.status, w.updated_at
    from websites w
    where w.status in ('pending', 'analyzing')
      and w.updated_at < timezone('utc', now()) - interval '1 hour'
    order by 5`,
};
