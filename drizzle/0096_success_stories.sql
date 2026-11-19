CREATE TABLE "success_stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"website_url" text,
	"logo_url" text,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"category_label" text,
	"body_html" text DEFAULT '' NOT NULL,
	"metrics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"discover_slug" text,
	"seo_title" text,
	"seo_description" text,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "success_stories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "success_stories_slug_uidx" ON "success_stories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "success_stories_published_order_idx" ON "success_stories" USING btree ("published","sort_order");