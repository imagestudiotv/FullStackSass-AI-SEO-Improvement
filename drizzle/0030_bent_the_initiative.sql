CREATE TABLE "gsc_page_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"date" date NOT NULL,
	"page_url" text NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"position" real
);
--> statement-breakpoint
ALTER TABLE "gsc_page_metrics" ADD CONSTRAINT "gsc_page_metrics_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gsc_page_metrics_unique_idx" ON "gsc_page_metrics" USING btree ("website_id","date","page_url");--> statement-breakpoint
-- Row Level Security, like every other table (see 0026_enable_rls.sql).
ALTER TABLE "gsc_page_metrics" ENABLE ROW LEVEL SECURITY;
