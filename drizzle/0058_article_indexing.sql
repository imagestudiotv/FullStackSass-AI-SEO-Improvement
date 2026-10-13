-- Google indexing of published articles through SpeedyIndex (client,
-- 2026-10-13: "Your article was indexed" in the 7-day wins). A new table
-- only; nothing existing changes. Nothing is sent until SPEEDYINDEX_API_KEY
-- is set. Run before deploying the code that reads it: the dashboard's
-- 7-day wins and the admin overview query this table.
CREATE TABLE "article_indexing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"website_id" uuid NOT NULL,
	"url" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"task_id" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp,
	"checked_at" timestamp,
	"indexed_at" timestamp,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "article_indexing" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "article_indexing" ADD CONSTRAINT "article_indexing_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_indexing" ADD CONSTRAINT "article_indexing_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "article_indexing_article_url_uidx" ON "article_indexing" USING btree ("article_id","url");--> statement-breakpoint
CREATE INDEX "article_indexing_status_idx" ON "article_indexing" USING btree ("status");--> statement-breakpoint
CREATE INDEX "article_indexing_website_indexed_idx" ON "article_indexing" USING btree ("website_id","indexed_at");