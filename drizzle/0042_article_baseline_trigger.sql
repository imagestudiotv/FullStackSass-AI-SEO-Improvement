-- Closes the article-allowance baseline gap left by 0041 (issue 4). Additive
-- and safe to re-run. See docs/migration-cutover.md.
--
-- THE GAP. 0041 turns every existing article into a durable ledger row, and
-- the new code does the same lazily before it reserves. An article created by
-- the OLD code AFTER 0041 ran (an old server instance or queued job still
-- running during the rollout) and deleted before the new code next reserved
-- for that website was counted by nobody: its slot came back.
--
-- THE FIX, IN THE DATABASE. A trigger on articles records a consumed
-- 'article.legacy' ledger row for any article inserted WITHOUT a reservation
-- naming it - which is exactly what old code does. It fires in the inserting
-- transaction, so by the time the article exists its consumption is durable
-- and no deletion can undo it, whichever version of the code created it. The
-- new code reserves first (subject_id = article id), so the trigger finds the
-- reservation and writes nothing: nothing is counted twice.
--
-- COVERAGE IS BY THE ARTICLE'S OWN RESERVATION IN ANY STATE. 0041 only looked
-- at reserved/consumed rows, so an article whose job was never delivered
-- (reservation released, slot correctly returned) would have been counted
-- again by a later baseline run. The backfill below uses the corrected rule;
-- run THIS statement, not 0041's, for any later reconciliation.

CREATE OR REPLACE FUNCTION article_allowance_baseline() RETURNS trigger AS $$
BEGIN
  INSERT INTO "spend_reservations" (
    "key", "operation", "organization_id", "website_id", "state",
    "limit_value", "counted_at", "spend_outcome", "consumed_at",
    "subject_id", "metadata", "created_at", "updated_at"
  )
  SELECT
    'articles:' || NEW."website_id", 'article.legacy', w."organization_id",
    NEW."website_id", 'consumed', 0, NEW."created_at", 'legacy',
    timezone('utc', now()), NEW."id"::text,
    jsonb_build_object('source', 'trigger'),
    timezone('utc', now()), timezone('utc', now())
  FROM "websites" w
  WHERE w."id" = NEW."website_id"
    AND NOT EXISTS (
      SELECT 1 FROM "spend_reservations" r
      WHERE r."key" = 'articles:' || NEW."website_id"
        AND (
          r."subject_id" = NEW."id"::text
          OR r."metadata" ->> 'articleId' = NEW."id"::text
          OR (
            NEW."calendar_item_id" IS NOT NULL
            AND r."state" IN ('reserved', 'consumed')
            AND r."metadata" ->> 'calendarItemId' = NEW."calendar_item_id"::text
          )
        )
    )
  ON CONFLICT ("operation", "key", "subject_id") WHERE "subject_id" IS NOT NULL
  DO NOTHING;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "articles_allowance_baseline" ON "articles";
--> statement-breakpoint
CREATE TRIGGER "articles_allowance_baseline"
  AFTER INSERT ON "articles"
  FOR EACH ROW EXECUTE FUNCTION article_allowance_baseline();
--> statement-breakpoint
-- The corrected backfill, AFTER the trigger exists: anything created between
-- 0041 and this point is caught here, anything created from now on by the
-- trigger. 62 days covers any monthly allowance window.
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
