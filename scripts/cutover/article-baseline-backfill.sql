-- The ONLY article-baseline statement that may be run again after cutover.
--
--   psql "$DIRECT_URL" --single-transaction -v ON_ERROR_STOP=1 -f scripts/cutover/article-baseline-backfill.sql
--
-- It is migration 0042's final INSERT, unchanged: an article counts as
-- covered by ANY reservation of its own, whatever its state, so an article
-- whose job was never delivered - its slot correctly RELEASED - is never
-- counted again. Re-running a migration FILE is never the way to reconcile:
-- 0041 treats a released reservation as not covering its article and would
-- consume that returned slot (see docs/migration-cutover.md).
--
-- Prerequisite, enforced below: 0042's trigger is installed on
-- public.articles and enabled for normal writes. With it in place this
-- normally finds nothing; it only fills a gap if the trigger was ever
-- disabled. Safe while the application is running.

-- The baseline trigger counts only if it is the one 0042 installs, and it
-- fires for ordinary application writes: named articles_allowance_baseline,
-- on public.articles (not a same-named trigger elsewhere), calling
-- public.article_allowance_baseline(), AFTER INSERT FOR EACH ROW (tgtype
-- bits: 1 = row, 2 = before, 4 = insert), and enabled as 'O' (origin) or
-- 'A' (always). 'D' (disabled) and 'R' (replica only - skipped by normal
-- sessions) do not count. The same check is in unfreeze-article-writes.sql,
-- article-baseline-backfill.sql and the articleBaselineTriggerMissing report.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    WHERE t.tgname = 'articles_allowance_baseline'
      AND t.tgrelid = to_regclass('public.articles')
      AND NOT t.tgisinternal
      AND t.tgfoid = to_regprocedure('public.article_allowance_baseline()')
      AND t.tgenabled IN ('O', 'A')
      AND (t.tgtype & 1) = 1
      AND (t.tgtype & 2) = 0
      AND (t.tgtype & 4) = 4
  ) THEN
    RAISE EXCEPTION 'articles_allowance_baseline is missing, disabled, replica-only or not the trigger 0042 installs: apply 0042 first';
  END IF;
END
$$;

INSERT INTO "spend_reservations" (
  "key", "operation", "organization_id", "website_id", "state",
  "limit_value", "counted_at", "spend_outcome", "consumed_at",
  "subject_id", "metadata", "created_at", "updated_at"
)
SELECT
  'articles:' || a."website_id", 'article.legacy', w."organization_id",
  a."website_id", 'consumed', 0, a."created_at", 'legacy',
  timezone('utc', now()), a."id"::text,
  jsonb_build_object('source', 'baseline'),
  timezone('utc', now()), timezone('utc', now())
FROM "articles" a
JOIN "websites" w ON w."id" = a."website_id"
WHERE a."created_at" >= timezone('utc', now()) - interval '62 days'
  AND NOT EXISTS (
    SELECT 1 FROM "spend_reservations" r
    WHERE r."key" = 'articles:' || a."website_id"
      AND (
        r."subject_id" = a."id"::text
        OR r."metadata" ->> 'articleId' = a."id"::text
        OR (
          a."calendar_item_id" IS NOT NULL
          AND r."state" IN ('reserved', 'consumed')
          AND r."metadata" ->> 'calendarItemId' = a."calendar_item_id"::text
        )
      )
  )
ON CONFLICT ("operation", "key", "subject_id") WHERE "subject_id" IS NOT NULL
DO NOTHING;
