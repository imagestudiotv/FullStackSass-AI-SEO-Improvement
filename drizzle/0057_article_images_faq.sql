-- Article settings for the client's request of 2026-10-13: pictures inside
-- the article (0-3, default 3) and an FAQ section at the end (default on).
-- Both default ON for websites that already exist, as comparison_table did
-- (0049). Additive only: the code that reads them must not be deployed before
-- this has run, because every query that loads a whole websites row would then
-- name columns that do not exist yet.
ALTER TABLE "websites" ADD COLUMN "body_images" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "faq_section" boolean DEFAULT true NOT NULL;