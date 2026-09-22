ALTER TABLE "websites" ADD COLUMN "publish_as" text DEFAULT 'live' NOT NULL;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "article_style" text DEFAULT 'expert' NOT NULL;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "internal_link_target" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "target_word_count" integer;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "sitemap_url" text;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "blog_url" text;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "example_article_url" text;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "brand_color" text;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "image_style" text DEFAULT 'realistic' NOT NULL;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "featured_image_style" text DEFAULT 'sketch' NOT NULL;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "image_brief" text;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "image_instructions" text;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "table_of_contents" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "youtube_video" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "author_perspective" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "mention_similar_products" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "powered_by_link" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "author_name" text;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "author_bio" text;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "author_avatar_url" text;