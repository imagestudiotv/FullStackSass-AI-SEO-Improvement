ALTER TABLE "blog_autopilot_topics" ADD COLUMN "article_type" text DEFAULT 'informative' NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_autopilot_topics" ADD COLUMN "comparison" jsonb;
