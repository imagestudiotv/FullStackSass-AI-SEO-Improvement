CREATE TABLE "site_daily_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"website_id" uuid NOT NULL,
	"date" date NOT NULL,
	"gsc_clicks" integer,
	"gsc_impressions" integer,
	"gsc_position" real,
	"ga_sessions" integer,
	"ga_users" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "site_daily_metrics" ADD CONSTRAINT "site_daily_metrics_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "site_daily_metrics_unique_idx" ON "site_daily_metrics" USING btree ("website_id","date");--> statement-breakpoint
-- Row Level Security, like every other table (see 0026_enable_rls.sql): no
-- policies, so nothing but the app's bypassrls connection can read it.
ALTER TABLE "site_daily_metrics" ENABLE ROW LEVEL SECURITY;
