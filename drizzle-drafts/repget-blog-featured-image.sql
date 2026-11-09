-- DRAFT, not a canonical migration (assignment 01-repget, 2026-11-07).
-- The integrator generates the real migration with drizzle-kit from the
-- combined schema, then deletes this file. Until then the test databases
-- (src/test/db.ts, src/test/postgres.ts) apply it after drizzle/'s chain.
--
-- A blog post's own cover: one of the blog's pictures, and its alt text.
-- Both null for every existing post, which keeps the drawn cover (no backfill).
ALTER TABLE "blog_posts" ADD COLUMN "featured_image_url" text;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "featured_image_alt" text;
