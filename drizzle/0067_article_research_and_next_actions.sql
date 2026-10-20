CREATE TABLE "next_action_preferences" (
	"website_id" uuid NOT NULL,
	"task_key" text NOT NULL,
	"snoozed_until" timestamp NOT NULL,
	"actor_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "next_action_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "search_import_coverage" (
	"website_id" uuid NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "search_import_coverage" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "research" jsonb;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "research_review_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "research_approved_hash" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "research_approved_by" text;--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN "research_approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "next_action_preferences" ADD CONSTRAINT "next_action_preferences_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_import_coverage" ADD CONSTRAINT "search_import_coverage_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "next_action_preferences_key" ON "next_action_preferences" USING btree ("website_id","task_key");--> statement-breakpoint
CREATE UNIQUE INDEX "search_import_coverage_site" ON "search_import_coverage" USING btree ("website_id");