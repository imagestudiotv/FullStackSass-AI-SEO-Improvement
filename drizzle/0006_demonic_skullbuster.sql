CREATE INDEX "ga_metrics_website_date_idx" ON "ga_metrics" USING btree ("website_id","date");--> statement-breakpoint
/*
 * NULLS NOT DISTINCT: page_url and query are nullable (a site-wide total row
 * has no page). Postgres treats NULLs as distinct by default, so without this
 * two identical site-wide rows would never conflict and the upsert would
 * duplicate them on every import.
 */
CREATE UNIQUE INDEX "ga_metrics_unique_idx" ON "ga_metrics" USING btree ("website_id","date","page_url") NULLS NOT DISTINCT;--> statement-breakpoint
CREATE UNIQUE INDEX "gsc_metrics_unique_idx" ON "gsc_metrics" USING btree ("website_id","date","page_url","query") NULLS NOT DISTINCT;