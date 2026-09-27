-- OPERATOR-REVIEWED repair for ONE `baselineDoubleCounts` finding.
-- Never run in bulk or automatically; see docs/migration-cutover.md.
--
--   psql "$DIRECT_URL" --single-transaction -v ON_ERROR_STOP=1 \
--        -v reservation_id=<legacy_reservation_id from the report> \
--        -f scripts/cutover/repair-baseline-double-count.sql
--
-- Releases one legacy baseline row that duplicates an article's own
-- reservation (the article was created by new code, so the legacy row is
-- wrong by construction). The row is kept - released, with a reason - so the
-- correction is on record. The guard makes it a no-op for any legacy row
-- that is NOT such a duplicate; RETURNING shows what, if anything, changed.

UPDATE spend_reservations AS legacy
SET state = 'released',
    released_at = timezone('utc', now()),
    release_reason = 'baseline_correction: duplicates the article''s own reservation',
    updated_at = timezone('utc', now())
WHERE legacy.id = :'reservation_id'
  AND legacy.operation = 'article.legacy'
  AND legacy.state = 'consumed'
  AND EXISTS (
    SELECT 1 FROM spend_reservations own
    WHERE own.key = legacy.key
      AND own.operation <> 'article.legacy'
      AND (own.subject_id = legacy.subject_id OR own.metadata ->> 'articleId' = legacy.subject_id)
  )
RETURNING legacy.id, legacy.key, legacy.subject_id AS article_id, legacy.state;
