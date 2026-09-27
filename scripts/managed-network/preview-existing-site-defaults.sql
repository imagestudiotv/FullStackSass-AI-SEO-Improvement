-- DRY RUN ONLY: what the new-site defaults WOULD change on existing websites.
--
--   psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f scripts/managed-network/preview-existing-site-defaults.sql
--
-- Migration 0043 changes only column DEFAULTS, so websites created before it
-- keep every setting they had. The client did not ask for existing sites to
-- be switched, and publishing or backlink participation must never be
-- enabled for a customer who did not choose it - so NO bulk update ships.
--
-- This script lists, per setting, the existing websites that differ from the
-- new defaults, so an operator can discuss them with each customer. It runs
-- in a READ ONLY transaction and rolls back: it cannot change anything. A
-- customer who wants the new behaviour switches it on in their own settings
-- (Article Settings, Publishing, Backlinks).

BEGIN TRANSACTION READ ONLY;

-- Totals.
SELECT
  count(*)                                                     AS websites,
  count(*) FILTER (WHERE NOT auto_publish)                     AS not_auto_publishing,
  count(*) FILTER (WHERE auto_publish AND publish_as <> 'live') AS publishing_as_draft,
  count(*) FILTER (WHERE NOT table_of_contents)                AS no_table_of_contents,
  count(*) FILTER (WHERE NOT mention_similar_products)         AS no_similar_products,
  count(*) FILTER (WHERE NOT powered_by_link)                  AS powered_by_off,
  count(*) FILTER (WHERE NOT EXISTS (
    SELECT 1 FROM network_sites n WHERE n.website_id = w.id AND n.accepting_links
  ))                                                           AS not_in_partner_network
FROM websites w;

-- Per website, only those that differ somewhere.
SELECT
  w.id,
  w.domain,
  w.organization_id,
  CASE WHEN NOT w.auto_publish THEN 'review'
       WHEN w.publish_as = 'draft' THEN 'draft'
       ELSE 'live' END                                          AS publishing_mode_now,
  w.table_of_contents,
  w.mention_similar_products,
  w.powered_by_link,
  coalesce(n.accepting_links, false)                            AS in_partner_network
FROM websites w
LEFT JOIN network_sites n ON n.website_id = w.id
WHERE NOT w.auto_publish
   OR w.publish_as <> 'live'
   OR NOT w.table_of_contents
   OR NOT w.mention_similar_products
   OR NOT w.powered_by_link
   OR NOT coalesce(n.accepting_links, false)
ORDER BY w.created_at;

ROLLBACK;
