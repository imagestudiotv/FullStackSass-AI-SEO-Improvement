/* De-duplicate before the unique index: keyword rows written before this
 * constraint existed may repeat a term for one website. Keeps the newest. */
DELETE FROM "keywords" a USING "keywords" b
WHERE a.website_id = b.website_id AND a.term = b.term
  AND (a.created_at, a.id) < (b.created_at, b.id);--> statement-breakpoint
CREATE UNIQUE INDEX "keywords_website_term_uidx" ON "keywords" USING btree ("website_id","term");