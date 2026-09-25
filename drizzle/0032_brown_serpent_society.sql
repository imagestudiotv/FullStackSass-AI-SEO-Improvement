ALTER TABLE "websites" ADD COLUMN "first_article_sent_at" timestamp;--> statement-breakpoint
-- Websites that have already sent an article are past their first one, so the
-- "first article goes out immediately" rule must never fire for them.
UPDATE "websites" w
SET "first_article_sent_at" = now()
WHERE "first_article_sent_at" IS NULL
  AND EXISTS (
    SELECT 1 FROM "articles" a
    WHERE a."website_id" = w."id"
      AND (a."status" = 'published' OR a."published_url" IS NOT NULL)
  );
