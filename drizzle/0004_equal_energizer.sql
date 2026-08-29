/*
 * De-duplicate before the unique indexes below.
 *
 * These tables have been writing duplicates (onConflictDoNothing had no
 * conflict target to match), so any database that ran an analysis twice holds
 * rows that would fail index creation. Keeps the newest row of each group.
 */
DELETE FROM "competitors" a USING "competitors" b
WHERE a.website_id = b.website_id AND a.domain = b.domain
  AND a.created_at < b.created_at;--> statement-breakpoint
DELETE FROM "pages" a USING "pages" b
WHERE a.website_id = b.website_id AND a.url = b.url
  AND (a.crawled_at, a.id) < (b.crawled_at, b.id);--> statement-breakpoint
CREATE UNIQUE INDEX "competitors_website_domain_uidx" ON "competitors" USING btree ("website_id","domain");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_website_url_uidx" ON "pages" USING btree ("website_id","url");