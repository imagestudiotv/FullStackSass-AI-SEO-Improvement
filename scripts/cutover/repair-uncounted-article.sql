-- OPERATOR-REVIEWED repair for ONE `uncountedDeletedArticles` finding.
-- Never run in bulk or automatically; see docs/migration-cutover.md.
--
--   psql "$DIRECT_URL" --single-transaction -v ON_ERROR_STOP=1 \
--        -v article_id=<article_id from the report> \
--        -f scripts/cutover/repair-uncounted-article.sql
--
-- Records the consumption of an article that was generated and then deleted
-- without the ledger ever counting it, dated when it was generated so it
-- falls in the month it was used. The guard makes it a no-op if the article
-- still exists or anything already counts it; RETURNING shows the new row.

INSERT INTO spend_reservations (
  key, operation, organization_id, website_id, state, limit_value,
  counted_at, spend_outcome, consumed_at, subject_id, metadata,
  created_at, updated_at
)
SELECT 'articles:' || u.website_id, 'article.legacy', u.organization_id, u.website_id,
       'consumed', 0, min(u.created_at), 'legacy', timezone('utc', now()),
       :'article_id', jsonb_build_object('source', 'operator_repair'),
       timezone('utc', now()), timezone('utc', now())
FROM usage_events u
WHERE u.metadata ->> 'purpose' = 'article_outline'
  AND u.metadata ->> 'articleId' = :'article_id'
  AND u.website_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM articles a WHERE a.id::text = :'article_id')
  AND NOT EXISTS (
    SELECT 1 FROM spend_reservations r
    WHERE r.key = 'articles:' || u.website_id
      AND (r.subject_id = :'article_id' OR r.metadata ->> 'articleId' = :'article_id'))
GROUP BY u.website_id, u.organization_id
ON CONFLICT (operation, key, subject_id) WHERE subject_id IS NOT NULL DO NOTHING
RETURNING id, key, subject_id AS article_id, counted_at;
