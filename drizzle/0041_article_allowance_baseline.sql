-- Historical article-allowance baseline (issue 4). Data only; additive and
-- idempotent - safe to run again, and after deploy as a reconciliation.
--
-- WHY. The monthly article allowance is counted from the spend_reservations
-- ledger, which only knows about articles created since the ledger existed.
-- The transition used max(ledger, article rows in the period), so deleting an
-- article created by the NEW code lowered nothing, but deleting a LEGACY one
-- lowered the row count and handed its slot back - and with limit 3, two
-- legacy articles and one new one, deleting the new one still left
-- max(1, 2) = 2 and another article was allowed.
--
-- WHAT. One consumed ledger row per existing article, dated when the article
-- was created, so past consumption becomes durable history that no deletion
-- can undo, and usage is simply the ledger from then on:
--   operation   'article.legacy', spend_outcome 'legacy'
--   key         'articles:<website_id>'  (usage.ts articleAllowanceKey)
--   subject_id  the article id          (unique with operation and key)
--   counted_at  articles.created_at     (so it falls in its own month)
--
-- NO DOUBLE COUNTING. An article the new code created already has a live
-- 'article.generate' row for its key naming it (subject_id, or metadata
-- articleId / calendarItemId for rows written before subject_id existed),
-- and is skipped. The same statement runs lazily under the key's lock the
-- first time a website reserves after deploy (usage.ts
-- materializeArticleBaseline), which covers articles the old code created
-- between this migration and the deploy.
--
-- 62 days back is enough: allowance windows are at most one month
-- (usage.ts entitlementPeriod), so older rows can never be counted.
--
-- timestamp columns hold UTC wall-clock times (drizzle writes toISOString),
-- so "now" is timezone('utc', now()) - correct whatever the session's
-- TimeZone setting is.
INSERT INTO "spend_reservations" (
  "key", "operation", "organization_id", "website_id", "state",
  "limit_value", "counted_at", "spend_outcome", "consumed_at",
  "subject_id", "metadata", "created_at", "updated_at"
)
SELECT
  'articles:' || a."website_id",
  'article.legacy',
  w."organization_id",
  a."website_id",
  'consumed',
  0,
  a."created_at",
  'legacy',
  timezone('utc', now()),
  a."id"::text,
  jsonb_build_object('source', 'baseline'),
  timezone('utc', now()),
  timezone('utc', now())
FROM "articles" a
JOIN "websites" w ON w."id" = a."website_id"
WHERE a."created_at" >= timezone('utc', now()) - interval '62 days'
  AND NOT EXISTS (
    SELECT 1 FROM "spend_reservations" r
    WHERE r."key" = 'articles:' || a."website_id"
      AND r."state" IN ('reserved', 'consumed')
      AND (
        r."subject_id" = a."id"::text
        OR r."metadata" ->> 'articleId' = a."id"::text
        OR (
          a."calendar_item_id" IS NOT NULL
          AND r."metadata" ->> 'calendarItemId' = a."calendar_item_id"::text
        )
      )
  )
ON CONFLICT ("operation", "key", "subject_id") WHERE "subject_id" IS NOT NULL
DO NOTHING;
