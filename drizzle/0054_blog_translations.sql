-- The blog in more than one language (client, 2026-10-09; lib/blog/locale.ts).
-- Every existing post becomes English (the default). Adds columns and
-- indexes only: no existing row loses or changes content.
ALTER TABLE "blog_posts" ADD COLUMN "locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "translation_of" uuid;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "needs_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_translation_of_blog_posts_id_fk" FOREIGN KEY ("translation_of") REFERENCES "public"."blog_posts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blog_posts_locale_status_published_idx" ON "blog_posts" USING btree ("locale","status","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_translation_locale_uidx" ON "blog_posts" USING btree ("translation_of","locale");