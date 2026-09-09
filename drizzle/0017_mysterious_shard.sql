ALTER TABLE "brand_voice" ADD COLUMN "article_instructions" text;--> statement-breakpoint
ALTER TABLE "brand_voice" ADD COLUMN "example_article_urls" jsonb;--> statement-breakpoint
ALTER TABLE "websites" ADD COLUMN "auto_publish" boolean DEFAULT false NOT NULL;