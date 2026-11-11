-- RepGet Customer Showcase (client, 2026-11-11 round 2): /discover lists the businesses and
-- /discover/<slug> shows one. A business profile IS a published "Customer stories" blog post with
-- its Business section filled (migration 0090), so its upvotes and comments are the post's own.
-- Additive: the profile's fields on blog_posts (all nullable, or an empty list), its address
-- (unique per language, so a translation keeps the same address under its language's prefix),
-- and a per-day view counter with the day's visitor keys (hashed, kept two days) that stop one
-- visitor counting more than once a day.
ALTER TABLE "blog_posts" ADD COLUMN "business_slug" text;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "business_tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "business_location" text;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "business_availability" text;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "business_about" text;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "business_audience" text;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "business_services" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "business_industry" text;--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_business_slug_locale_uidx" ON "blog_posts" USING btree ("locale","business_slug") WHERE "blog_posts"."business_slug" is not null;--> statement-breakpoint
CREATE TABLE "blog_post_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blog_post_views" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "blog_post_view_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"day" date NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blog_post_view_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "blog_post_views" ADD CONSTRAINT "blog_post_views_post_id_blog_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "blog_post_views_post_day_uidx" ON "blog_post_views" USING btree ("post_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_post_view_keys_key_uidx" ON "blog_post_view_keys" USING btree ("key");--> statement-breakpoint
CREATE INDEX "blog_post_view_keys_day_idx" ON "blog_post_view_keys" USING btree ("day");
